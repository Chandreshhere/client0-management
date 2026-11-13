import type { Discipline, Staff } from "@/data/types";
import { LUNCH, NOW_MIN, TODAY_KEY, type Hours } from "./data";
import { findConflicts, hhmm, hoursOn, isActive, shortDay, touchesLunch, type DiaryEvent, type Occupant } from "./engine";

/**
 * Schedule insights, computed only from the diary (bookings + classes) and staff profiles:
 * bookings starting per hour / per day by discipline, practitioner utilisation (booked minutes ÷
 * working minutes) and the next free slot inside working hours. Pure functions — no React.
 */

export const CARE_DISCIPLINES = ["medical", "nutrition", "movement"] as const;
export type CareDiscipline = (typeof CARE_DISCIPLINES)[number];

const isCare = (d: Discipline): d is CareDiscipline => d !== "operations";
const pad = (n: number) => String(n).padStart(2, "0");

/** Cancelled and no-show bookings free their slot, so they don't count as load. */
export const activeOnly = (evs: DiaryEvent[]) => evs.filter((e) => !e.booking || isActive(e.booking));

/**
 * What a load chart counts. "bookings": diary entries (a class is one entry). "patients": people
 * due to start — a class counts its enrolled places (cancelled places excluded, places offered from
 * the waitlist in this session included).
 */
export type LoadMeasure = "patients" | "bookings";

export function placesOf(e: DiaryEvent, classSeats: Record<string, number>) {
  if (!e.cls) return 1;
  return e.cls.enrolled.filter((x) => x.attendance !== "cancelled").length + (classSeats[e.cls.id] ?? 0);
}

const weightOf = (e: DiaryEvent, measure: LoadMeasure, classSeats: Record<string, number>) => (measure === "patients" ? placesOf(e, classSeats) : 1);

export type LoadBin = {
  key: string;
  /** axis label, e.g. "09:00" or "Fri 13" */
  label: string;
  /** compact axis label for narrow charts, e.g. "09" or "Fri" */
  short: string;
  /** tooltip / table heading, e.g. "09:00–10:00" or "Fri 13 Nov" */
  title: string;
  counts: Record<CareDiscipline, number>;
  total: number;
  /** the active bookings and classes in this bin, in time order */
  events: DiaryEvent[];
  /** fully before 09:40 today */
  past: boolean;
  /** contains "now" */
  current: boolean;
  /** hour bins: minutes from midnight; day bins: the date */
  start?: number;
  date?: string;
};

const emptyCounts = (): Record<CareDiscipline, number> => ({ medical: 0, nutrition: 0, movement: 0 });

function tally(evs: DiaryEvent[], measure: LoadMeasure, classSeats: Record<string, number>) {
  const counts = emptyCounts();
  for (const e of evs) if (isCare(e.discipline)) counts[e.discipline] += weightOf(e, measure, classSeats);
  return { counts, total: counts.medical + counts.nutrition + counts.movement };
}

/** Load starting in each clinic hour of one day. */
export function hourlyLoad(events: DiaryEvent[], date: string, range: { start: number; end: number }, measure: LoadMeasure, classSeats: Record<string, number>): LoadBin[] {
  const first = Math.floor(range.start / 60);
  const last = Math.ceil(range.end / 60) - 1;
  const active = activeOnly(events).filter((e) => e.date === date);
  const out: LoadBin[] = [];
  for (let h = first; h <= last; h++) {
    const inBin = active.filter((e) => e.start >= h * 60 && e.start < h * 60 + 60);
    out.push({
      key: pad(h),
      label: `${pad(h)}:00`,
      short: pad(h),
      title: `${pad(h)}:00–${pad(h + 1)}:00`,
      ...tally(inBin, measure, classSeats),
      events: inBin,
      past: date < TODAY_KEY || (date === TODAY_KEY && (h + 1) * 60 <= NOW_MIN),
      current: date === TODAY_KEY && h * 60 <= NOW_MIN && NOW_MIN < (h + 1) * 60,
      start: h * 60,
    });
  }
  return out;
}

/** Load per day of the week, by discipline. */
export function dailyLoad(events: DiaryEvent[], days: string[], measure: LoadMeasure, classSeats: Record<string, number>): LoadBin[] {
  const active = activeOnly(events);
  return days.map((d) => {
    const inBin = active.filter((e) => e.date === d);
    const [wd, day] = shortDay(d).split(" ");
    return {
      key: d,
      label: `${wd} ${day}`,
      short: wd,
      title: shortDay(d),
      ...tally(inBin, measure, classSeats),
      events: inBin,
      past: d < TODAY_KEY,
      current: d === TODAY_KEY,
      date: d,
    };
  });
}

/** Per-hour booking counts for each day (for the week strip's density dots). */
export function hourDensity(events: DiaryEvent[], days: string[], firstHour: number, lastHour: number): Record<string, number[]> {
  const active = activeOnly(events);
  return Object.fromEntries(
    days.map((d) => {
      const row = Array.from({ length: lastHour - firstHour + 1 }, () => 0);
      for (const e of active) {
        if (e.date !== d) continue;
        const i = Math.floor(e.start / 60) - firstHour;
        if (i >= 0 && i < row.length) row[i]++;
      }
      return [d, row];
    }),
  );
}

// ---------------------------------------------------------------- intervals
type Span = [number, number];

function union(spans: Span[]): Span[] {
  const sorted = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

const length = (spans: Span[]) => spans.reduce((n, [a, b]) => n + (b - a), 0);

function overlap(a: Span[], b: Span[]) {
  let n = 0;
  for (const [s1, e1] of a) for (const [s2, e2] of b) n += Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  return n;
}

/** Working window minus the 13:00–14:00 lunch break. */
function workSpans(h: Hours): Span[] {
  if (LUNCH.end <= h.start || LUNCH.start >= h.end) return [[h.start, h.end]];
  return ([[h.start, LUNCH.start], [LUNCH.end, h.end]] as Span[]).filter(([a, b]) => b > a);
}

export const lunchExcluded = (h: Hours) => LUNCH.start < h.end && h.start < LUNCH.end;

// ---------------------------------------------------------------- utilisation
export type Utilisation = {
  staff: Staff;
  /** minutes of working time in the period (lunch excluded) */
  workMin: number;
  /** booked minutes inside working time */
  bookedMin: number;
  /** booked minutes that fall outside the profile hours or in lunch */
  outsideMin: number;
  /** null when the practitioner isn't working in the period */
  pct: number | null;
  /** single-day view: that day's working window */
  hours: Hours | null;
  /** number of active bookings and classes counted */
  bookings: number;
};

/**
 * Booked minutes ÷ working minutes for one practitioner across `days`. Overlapping bookings (a
 * squeezed-in walk-in) are merged, so time is never double-counted. `events` should already be
 * scoped to the diary filters.
 */
export function utilisation(staff: Staff, days: string[], events: DiaryEvent[]): Utilisation {
  let workMin = 0;
  let bookedMin = 0;
  let outsideMin = 0;
  let bookings = 0;
  let hours: Hours | null = null;
  const mine = activeOnly(events).filter((e) => e.staffId === staff.id);
  for (const d of days) {
    const h = hoursOn(staff.id, d);
    const busy = union(mine.filter((e) => e.date === d).map((e) => [e.start, e.end] as Span));
    bookings += mine.filter((e) => e.date === d).length;
    if (days.length === 1) hours = h;
    if (!h) {
      outsideMin += length(busy);
      continue;
    }
    const work = workSpans(h);
    workMin += length(work);
    const inside = overlap(busy, work);
    bookedMin += inside;
    outsideMin += length(busy) - inside;
  }
  return { staff, workMin, bookedMin, outsideMin, pct: workMin ? Math.round((bookedMin / workMin) * 100) : null, hours, bookings };
}

/**
 * Earliest start on `date` for a `duration`-minute booking inside the practitioner's working hours,
 * clear of lunch, where both they and their room are free (checked against every booking and class,
 * not just filtered ones). Today it starts from 09:40. Null if nothing fits or the day has passed.
 */
export function nextFreeStart(staff: Staff, date: string, occupants: Occupant[], duration: number): number | null {
  const h = hoursOn(staff.id, date);
  if (!h || date < TODAY_KEY) return null;
  const room = staff.room ?? "Consult 1";
  let t = Math.ceil(Math.max(h.start, date === TODAY_KEY ? NOW_MIN : 0) / 15) * 15;
  for (; t + duration <= h.end; t += 15) {
    if (touchesLunch(t, duration)) continue;
    if (findConflicts({ staffId: staff.id, room, date, start: t, duration }, occupants).length === 0) return t;
  }
  return null;
}

/** Minutes a walk-in takes (the walk-in form books 20 minutes). */
export const WALK_IN_MIN = 20;

/**
 * Can this practitioner see someone right now (09:40)? On shift, not in a session and nothing
 * booked in the next 20 minutes — otherwise says why ("Starts 10:00", "In a session now"…).
 */
export function availabilityNow(staff: Staff, events: DiaryEvent[]): { free: boolean; label: string } {
  const h = hoursOn(staff.id, TODAY_KEY);
  if (!h) return { free: false, label: "Not working today" };
  if (NOW_MIN < h.start) return { free: false, label: `Starts ${hhmm(h.start)}` };
  if (NOW_MIN + WALK_IN_MIN > h.end) return { free: false, label: "Finished for today" };
  const open = activeOnly(events).filter((e) => e.date === TODAY_KEY && e.staffId === staff.id && e.booking?.status !== "completed");
  if (open.some((e) => e.booking?.status === "in-session")) return { free: false, label: "In a session now" };
  const soon = open.filter((e) => e.start < NOW_MIN + WALK_IN_MIN && NOW_MIN < e.end).sort((a, b) => a.start - b.start)[0];
  if (soon) return { free: false, label: `Booked ${hhmm(soon.start)}–${hhmm(soon.end)}` };
  return { free: true, label: "Free now" };
}

/** "4 h 20 min", "45 min", "7 h" */
export function minutesLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Compact form for tight rows: "4:20 h" / "0:45 h". */
export const hoursClock = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
