import type { Appointment, AppointmentStatus, Discipline, YogaClass } from "@/data/types";
import { formatDate } from "@/lib/format";
import { DAY_END, DAY_START, LEAVE, LUNCH, NOW_MIN, PROFILE_HOURS, TODAY_KEY, type Hours, type TimePreference } from "./data";

/**
 * Pure scheduling logic: IST wall-clock helpers, the reservation check that prevents practitioner
 * AND room clashes across appointments and classes (doc §7), free-slot search, lane layout for
 * overlapping blocks and token numbering. No React in here.
 */

// ---------------------------------------------------------------- time helpers (IST, TZ-safe)
const pad = (n: number) => String(n).padStart(2, "0");
export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const isoAt = (date: string, min: number) => `${date}T${hhmm(min)}:00+05:30`;
/** All fixture timestamps are written in +05:30, so the wall-clock parts can be read directly. */
export const dateOf = (iso: string) => iso.slice(0, 10);
export const minOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

function utc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(date: string, n: number) {
  const t = utc(date);
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** 0 = Sunday … 6 = Saturday */
export const weekday = (date: string) => utc(date).getUTCDay();
export const mondayOf = (date: string) => addDays(date, -((weekday(date) + 6) % 7));
/** Clinic week: Monday to Saturday (closed on Sundays). */
export const weekDays = (date: string) => Array.from({ length: 6 }, (_, i) => addDays(mondayOf(date), i));
export const isSunday = (date: string) => weekday(date) === 0;
export const isPastDay = (date: string) => date < TODAY_KEY;

export const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => formatDate(isoAt(date, 12 * 60), opts);
const part = (date: string, opts: Intl.DateTimeFormatOptions) => dayLabel(date, opts);
/** "Fri 13 Nov" */
export const shortDay = (date: string) => `${part(date, { weekday: "short" })} ${part(date, { day: "numeric" })} ${part(date, { month: "short" })}`;
/** "Friday 13 November" */
export const longDay = (date: string) => `${part(date, { weekday: "long" })} ${part(date, { day: "numeric" })} ${part(date, { month: "long" })}`;
/** "9 – 14 November" (or "30 Nov – 5 Dec") */
export function weekRangeLabel(days: string[]) {
  const a = days[0];
  const b = days[days.length - 1];
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return sameMonth
    ? `${part(a, { day: "numeric" })} – ${part(b, { day: "numeric" })} ${part(b, { month: "long" })}`
    : `${part(a, { day: "numeric" })} ${part(a, { month: "short" })} – ${part(b, { day: "numeric" })} ${part(b, { month: "short" })}`;
}
export const rangeLabel = (start: number, end: number) => `${hhmm(start)}–${hhmm(end)}`;

export function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function waitLabel(fromIso: string | undefined, nowMin = NOW_MIN) {
  if (!fromIso) return null;
  const mins = Math.max(0, nowMin - minOf(fromIso));
  if (mins < 1) return "just now";
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

// ---------------------------------------------------------------- domain
/** A diary booking: the shared appointment (token and arrival time included) plus session-only fields. */
export type Booking = Appointment & {
  calledAt?: string;
  doneAt?: string;
  cancelReason?: string;
  cancelNote?: string;
  /** created in this browser session */
  local?: boolean;
  seriesId?: string;
  reminder?: boolean;
};

export const INACTIVE: AppointmentStatus[] = ["cancelled", "no-show"];
export const isActive = (b: Booking) => !INACTIVE.includes(b.status);

export type DiaryEvent = {
  id: string;
  type: "booking" | "class";
  date: string;
  start: number;
  end: number;
  staffId: string;
  room: string;
  discipline: Discipline;
  booking?: Booking;
  /** set for group/individual classes (a class-kind booking is linked to its class) */
  cls?: YogaClass;
};

/** A class is "represented" when the diary already holds a booking for the same instructor and start. */
function bookingForClass(c: YogaClass, bookings: Booking[]) {
  return bookings.find((b) => b.staffId === c.instructorId && b.start === c.start);
}

export function buildEvents(bookings: Booking[], classes: YogaClass[]): DiaryEvent[] {
  const out: DiaryEvent[] = bookings.map((b) => {
    const start = minOf(b.start);
    const cls = b.kind === "class" ? classes.find((c) => c.instructorId === b.staffId && c.start === b.start) : undefined;
    return { id: b.id, type: "booking", date: dateOf(b.start), start, end: start + b.durationMin, staffId: b.staffId, room: b.room, discipline: b.discipline, booking: b, cls };
  });
  for (const c of classes) {
    if (bookingForClass(c, bookings)) continue;
    const start = minOf(c.start);
    out.push({ id: c.id, type: "class", date: dateOf(c.start), start, end: start + c.durationMin, staffId: c.instructorId, room: c.room, discipline: "movement", cls: c });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || b.end - a.end);
}

// ---------------------------------------------------------------- reservations & conflicts
export type Occupant = {
  id: string;
  kind: "appointment" | "class";
  date: string;
  start: number;
  end: number;
  staffId: string;
  room: string;
  title: string;
  patientId?: string;
};

/** Everything that holds a practitioner or a room: active bookings plus classes. */
export function occupantsFrom(events: DiaryEvent[]): Occupant[] {
  const out: Occupant[] = [];
  for (const e of events) {
    if (e.booking && !isActive(e.booking)) continue;
    out.push({
      id: e.id,
      kind: e.cls ? "class" : "appointment",
      date: e.date,
      start: e.start,
      end: e.end,
      staffId: e.staffId,
      room: e.room,
      title: e.cls ? e.cls.title : e.booking?.service ?? "Booking",
      patientId: e.cls ? undefined : e.booking?.patientId,
    });
  }
  return out;
}

export type SlotRequest = { staffId: string; room: string; date: string; start: number; duration: number; excludeIds?: string[] };
export type Conflict = { occupant: Occupant; on: ("practitioner" | "room")[] };

export function findConflicts(req: SlotRequest, occ: Occupant[]): Conflict[] {
  const end = req.start + req.duration;
  const out: Conflict[] = [];
  for (const o of occ) {
    if (o.date !== req.date || req.excludeIds?.includes(o.id)) continue;
    if (!(o.start < end && req.start < o.end)) continue;
    const on: Conflict["on"] = [];
    if (o.staffId === req.staffId) on.push("practitioner");
    if (o.room === req.room) on.push("room");
    if (on.length) out.push({ occupant: o, on });
  }
  return out.sort((a, b) => a.occupant.start - b.occupant.start);
}

/**
 * The patient's own commitments that overlap a requested time: their active bookings and any class
 * they're enrolled in (cancelled places excluded). A soft check — joint or back-to-back care across
 * disciplines is normal, so the desk is told rather than blocked.
 */
export function patientOverlaps(patientId: string, req: Pick<SlotRequest, "date" | "start" | "duration" | "excludeIds">, events: DiaryEvent[]): DiaryEvent[] {
  const end = req.start + req.duration;
  return events.filter((e) => {
    if (e.date !== req.date || req.excludeIds?.includes(e.id) || !(e.start < end && req.start < e.end)) return false;
    if (e.booking && !isActive(e.booking)) return false;
    if (e.booking?.patientId === patientId) return true;
    return !!e.cls?.enrolled.some((x) => x.patientId === patientId && x.attendance !== "cancelled");
  });
}

export const onLeave = (staffId: string, date: string) => {
  const l = LEAVE[staffId];
  return l ? date < l.until : false;
};

/**
 * A practitioner's working window on a date: their profile hours, or clinic hours when the
 * profile has none. Null when they don't work that day (Sunday or leave).
 */
export function hoursOn(staffId: string, date: string): Hours | null {
  if (isSunday(date) || onLeave(staffId, date)) return null;
  return PROFILE_HOURS[staffId] ?? { start: DAY_START, end: DAY_END };
}

/** Soft check for manual bookings: a time outside the practitioner's hours is allowed but flagged. */
export function outsideHours(req: Pick<SlotRequest, "staffId" | "date" | "start" | "duration">): Hours | null {
  const h = hoursOn(req.staffId, req.date);
  if (!h) return null;
  return req.start < h.start || req.start + req.duration > h.end ? h : null;
}

export const hoursLabel = (h: Hours) => `${hhmm(h.start)}–${hhmm(h.end)}`;

/** Hard blocks that aren't clashes: closed day, past time, outside clinic hours, leave. */
export function slotProblems(req: SlotRequest): string[] {
  const out: string[] = [];
  if (isSunday(req.date)) out.push("The clinic is closed on Sundays.");
  if (req.date < TODAY_KEY) out.push("That day has already passed.");
  else if (req.date === TODAY_KEY && req.start < NOW_MIN) out.push(`That time has already passed — it's ${hhmm(NOW_MIN)} on Fri 13 Nov in this demo.`);
  if (req.start < DAY_START || req.start + req.duration > DAY_END) out.push(`Bookings must fit inside clinic hours (${hhmm(DAY_START)}–${hhmm(DAY_END)}).`);
  if (onLeave(req.staffId, req.date)) out.push(`The practitioner is ${LEAVE[req.staffId].label.replace(/^On/, "on")}.`);
  return out;
}

export const touchesLunch = (start: number, duration: number) => start < LUNCH.end && LUNCH.start < start + duration;

/** Suggested slots stay inside the practitioner's working hours (manual bookings may go outside, with a note). */
function bookable(req: SlotRequest, occ: Occupant[], avoidLunch: boolean) {
  if (slotProblems(req).length) return false;
  if (outsideHours(req)) return false;
  if (avoidLunch && touchesLunch(req.start, req.duration)) return false;
  return findConflicts(req, occ).length === 0;
}

/** Every start time (stepped) on a day where practitioner and room are both free, within their hours. */
export function freeSlots(req: Omit<SlotRequest, "start">, occ: Occupant[], step = 30, avoidLunch = true): number[] {
  const out: number[] = [];
  for (let t = DAY_START; t + req.duration <= DAY_END; t += step) {
    if (bookable({ ...req, start: t }, occ, avoidLunch)) out.push(t);
  }
  return out;
}

/**
 * First start at or after the request where every weekly occurrence is free for both the
 * practitioner and the room. Searches forward up to `maxDays`, skipping Sundays and leave.
 */
export function nextFreeSlot(req: SlotRequest, occ: Occupant[], opts: { occurrences?: number; step?: number; maxDays?: number } = {}) {
  const step = opts.step ?? 15;
  const occurrences = Math.max(1, opts.occurrences ?? 1);
  const maxDays = opts.maxDays ?? 14;
  for (let d = 0; d <= maxDays; d++) {
    const date = addDays(req.date, d);
    if (isSunday(date) || date < TODAY_KEY) continue;
    let from = d === 0 ? req.start : DAY_START;
    if (date === TODAY_KEY) from = Math.max(from, NOW_MIN);
    from = Math.ceil(from / step) * step;
    for (let t = from; t + req.duration <= DAY_END; t += step) {
      const ok = Array.from({ length: occurrences }, (_, k) => k).every((k) =>
        bookable({ ...req, date: addDays(date, 7 * k), start: t }, occ, true),
      );
      if (ok) return { date, start: t };
    }
  }
  return null;
}

export function matchesPreference(date: string, start: number, p?: TimePreference) {
  if (!p) return true;
  if (p.days && !p.days.includes(weekday(date))) return false;
  if (p.after !== undefined && start < p.after) return false;
  if (p.before !== undefined && start >= p.before) return false;
  if (p.byDate && date > p.byDate) return false;
  return true;
}

// ---------------------------------------------------------------- layout & queue helpers
/** Side-by-side lanes for overlapping blocks within one column (clusters of transitive overlap). */
export function layoutLanes<T extends { id: string; start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: T[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = laneEnds.length;
    for (const it of cluster) result.set(it.id, { lane: result.get(it.id)!.lane, lanes });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    result.set(it.id, { lane, lanes: 0 });
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return result;
}

/** Bookings that overlap another active booking for the same practitioner (legacy double-bookings). */
export function doubleBooked(events: DiaryEvent[]) {
  const ids = new Set<string>();
  const active = events.filter((e) => !e.booking || isActive(e.booking));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.date === b.date && a.staffId === b.staffId && a.start < b.end && b.start < a.end) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

export function nextToken(bookings: Booking[]) {
  const max = bookings.reduce((m, b) => {
    const n = b.token?.match(/^A-(\d+)$/);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `A-${pad(max + 1)}`;
}
