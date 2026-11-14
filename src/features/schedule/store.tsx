"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WAITLIST } from "@/data/appointments";
import { CLASSES } from "@/data/programs";
import { PATIENTS, clinicNumber } from "@/data/patients";
import { staffById } from "@/data/staff";
import type { Appointment, AppointmentStatus, Discipline, Priority } from "@/data/types";
import { useRole } from "@/components/shell/role-context";
import { logAudit, type AuditCategory } from "@/features/settings/audit";
import { NOW_ISO, NOW_MIN, SEED_APPOINTMENTS, WAITLIST_MATCH, type TimePreference } from "./data";
import { buildEvents, dateOf, doubleBooked, isoAt, minOf, nextToken, occupantsFrom, type Booking, type DiaryEvent, type Occupant } from "./engine";

/**
 * Session store for the schedule area (calendar, queue, waitlist). It lives in the schedule
 * layout, so a check-in on the calendar shows up in the queue and a waitlist booking shows up on
 * the calendar while you move between those pages. Nothing leaves the browser and a reload
 * resets it — every toast says so.
 */

export type Person = {
  id: string;
  name: string;
  avatar: string | null;
  clinicNo: string;
  age: number | null;
  sex: string | null;
  phone: string;
  intakeComplete: boolean;
  local: boolean;
};

export type WaitOffer =
  | { kind: "slot"; date: string; start: number; duration: number; staffId: string; room: string }
  | { kind: "class"; classId: string };

export type WaitEntry = {
  id: string;
  patientId: string;
  want: string;
  preferred: string;
  addedAt: string;
  discipline: Discipline;
  priority: Priority;
  status: "waiting" | "offered" | "booked";
  staffIds: string[];
  serviceId: string;
  classId?: string;
  prefer?: TimePreference;
  /** set by "Add to waitlist": any of these windows is acceptable */
  prefers?: TimePreference[];
  offer?: WaitOffer;
  bookedId?: string;
  note?: string;
  local?: boolean;
};

export type NewPatientInput = { name: string; phone: string; age: number | null; sex: string | null };

type Ctx = {
  bookings: Booking[];
  events: DiaryEvent[];
  occupants: Occupant[];
  doubleIds: Set<string>;
  waitlist: WaitEntry[];
  localPatients: Person[];
  classSeats: Record<string, number>;
  recentIds: string[];
  /** recurring group classes are in the plan (Clinic and Pro) */
  groupClasses: boolean;
  privacy: boolean;
  setPrivacy: (v: boolean) => void;
  queueDisplay: boolean;
  setQueueDisplay: (v: boolean) => void;
  callingId: string | null;
  setCallingId: (id: string | null) => void;
  person: (id: string) => Person | undefined;
  allPeople: () => Person[];
  addBookings: (drafts: Omit<Booking, "id">[]) => Booking[];
  /** `action` (e.g. "Cancelled — Patient unwell") is added to the booking's history and the activity log */
  patchBooking: (id: string, patch: Partial<Booking>, action?: string, category?: AuditCategory) => Booking | undefined;
  restoreBooking: (prev: Booking) => void;
  checkIn: (id: string, withToken: boolean) => string | undefined;
  issueToken: () => string;
  registerPatient: (input: NewPatientInput) => Person;
  addWaitlist: (entry: Omit<WaitEntry, "id" | "status" | "addedAt">) => WaitEntry;
  patchWaitlist: (id: string, patch: Partial<WaitEntry>) => void;
  removeWaitlist: (id: string) => { entry: WaitEntry; index: number } | undefined;
  restoreWaitlist: (entry: WaitEntry, index: number) => void;
  takeClassSeat: (classId: string) => void;
};

const ScheduleCtx = createContext<Ctx | null>(null);

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule must be used inside <ScheduleProvider>");
  return ctx;
}

/** State whose latest value is readable synchronously inside event handlers. */
function useMirror<T>(initial: () => T) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  const set = useCallback((next: (prev: T) => T) => {
    const value = next(ref.current);
    ref.current = value;
    setState(value);
    return value;
  }, []);
  return [state, set, ref] as const;
}

const SEEN: AppointmentStatus[] = ["in-session", "checkout", "completed"];

/**
 * Arrival times come from the shared fixtures (`arrivedAt`). They don't record when someone was
 * called in or finished, so for visits already past that point those are derived: called at the
 * later of arrival and the booked start, finished after the booked duration.
 */
function withTimings(a: Appointment): Booking {
  if (!a.arrivedAt || !SEEN.includes(a.status) || a.kind === "class") return { ...a };
  const called = Math.max(minOf(a.arrivedAt), minOf(a.start));
  const day = dateOf(a.start);
  return {
    ...a,
    calledAt: isoAt(day, called),
    doneAt: a.status === "completed" ? isoAt(day, Math.min(called + a.durationMin, NOW_MIN)) : undefined,
  };
}

const seedBookings = (): Booking[] => SEED_APPOINTMENTS.map(withTimings);

const seedWaitlist = (): WaitEntry[] =>
  WAITLIST.map((w) => {
    const m = WAITLIST_MATCH[w.id];
    return { ...w, status: "waiting", staffIds: m?.staffIds ?? [], serviceId: m?.serviceId ?? "", classId: m?.classId, prefer: m?.prefer };
  });

const fromPatient = (id: string): Person | undefined => {
  const p = PATIENTS.find((x) => x.id === id);
  if (!p) return undefined;
  return { id: p.id, name: p.name, avatar: p.avatar, clinicNo: clinicNumber(p.id), age: p.age, sex: p.sex, phone: p.phone, intakeComplete: p.intakeComplete, local: false };
};

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { has, user } = useRole();
  const groupClasses = has("group-classes");
  const [bookings, setBookings, bookingsRef] = useMirror(seedBookings);
  const [waitlist, setWaitlist, waitlistRef] = useMirror(seedWaitlist);
  const [localPatients, setLocalPatients, localRef] = useMirror<Person[]>(() => []);
  const [classSeats, setClassSeats] = useMirror<Record<string, number>>(() => ({}));
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState(false);
  const [queueDisplay, setQueueDisplay] = useState(false);
  const [callingId, setCallingId] = useState<string | null>(null);
  const seq = useRef(0);
  const recentTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(recentTimer.current), []);

  // Group classes are recurring and plan-gated; 1:1 sessions are ordinary diary bookings.
  const classes = useMemo(() => (groupClasses ? CLASSES : CLASSES.filter((c) => c.kind === "individual")), [groupClasses]);
  const events = useMemo(() => buildEvents(bookings, classes), [bookings, classes]);
  const occupants = useMemo(() => occupantsFrom(events), [events]);
  const doubleIds = useMemo(() => doubleBooked(events), [events]);

  const person = useCallback((id: string) => fromPatient(id) ?? localRef.current.find((p) => p.id === id), [localRef]);
  const allPeople = useCallback(() => [...localRef.current, ...PATIENTS.map((p) => fromPatient(p.id)!)], [localRef]);

  /** Activity-log entry for a booking change (metadata only — no clinical content). */
  const audit = useCallback(
    (b: Pick<Booking, "patientId">, action: string, category: AuditCategory = "schedule") => {
      const name = fromPatient(b.patientId)?.name ?? localRef.current.find((p) => p.id === b.patientId)?.name ?? "Patient";
      logAudit({ actorId: user.id, category, action, target: { kind: "patient", id: b.patientId, label: name }, scope: category === "payment" ? "financial" : "metadata" });
    },
    [user.id, localRef],
  );
  const entry = useCallback((action: string) => ({ at: NOW_ISO, by: user.name, action }), [user.name]);

  const addBookings = useCallback(
    (drafts: Omit<Booking, "id">[]) => {
      const created = drafts.map((d) => ({ ...d, id: `local-a-${++seq.current}`, local: true, history: d.history ?? [entry(d.kind === "walk-in" ? `Walk-in added · token ${d.token ?? "—"}` : "Booked")] }));
      const first = created[0];
      const withWho = first ? ` with ${staffById(first.staffId)?.name ?? "a practitioner"}` : "";
      if (first) audit(first, created.length > 1 ? `Booked ${created.length} weekly appointments${withWho}` : first.kind === "walk-in" ? `Added a walk-in${withWho} · token ${first.token ?? "—"}` : `Booked an appointment${withWho}`);
      setBookings((xs) => [...xs, ...created].sort((a, b) => a.start.localeCompare(b.start)));
      setRecentIds(created.map((c) => c.id));
      window.clearTimeout(recentTimer.current);
      recentTimer.current = window.setTimeout(() => setRecentIds([]), 2400);
      return created;
    },
    [setBookings, audit, entry],
  );

  const patchBooking = useCallback(
    (id: string, patch: Partial<Booking>, action?: string, category?: AuditCategory) => {
      const prev = bookingsRef.current.find((b) => b.id === id);
      if (!prev) return undefined;
      const next: Partial<Booking> = action ? { ...patch, history: [...(prev.history ?? []), entry(action)] } : patch;
      setBookings((xs) => xs.map((b) => (b.id === id ? { ...b, ...next } : b)).sort((a, b) => a.start.localeCompare(b.start)));
      if (action) audit(prev, action, category);
      return prev;
    },
    [bookingsRef, setBookings, audit, entry],
  );

  /** Undo: puts the booking back as it was; an undone logged change is logged as its own entry. */
  const restoreBooking = useCallback(
    (prev: Booking) => {
      const cur = bookingsRef.current.find((b) => b.id === prev.id);
      const undone = cur?.history?.slice(prev.history?.length ?? 0).at(-1);
      setBookings((xs) => xs.map((b) => (b.id === prev.id ? prev : b)).sort((a, b) => a.start.localeCompare(b.start)));
      if (undone) audit(prev, `Undid “${undone.action}”`);
    },
    [bookingsRef, setBookings, audit],
  );

  const issueToken = useCallback(() => nextToken(bookingsRef.current), [bookingsRef]);

  const checkIn = useCallback(
    (id: string, withToken: boolean) => {
      const b = bookingsRef.current.find((x) => x.id === id);
      if (!b) return undefined;
      const token = withToken ? b.token ?? nextToken(bookingsRef.current) : b.token;
      const action = `Checked in${token ? ` · token ${token}` : ""}`;
      setBookings((xs) => xs.map((x) => (x.id === id ? { ...x, status: "arrived", arrivedAt: NOW_ISO, token, history: [...(x.history ?? []), entry(action)] } : x)));
      audit(b, action);
      return token;
    },
    [bookingsRef, setBookings, audit, entry],
  );

  const registerPatient = useCallback(
    (input: NewPatientInput) => {
      const n = localRef.current.length + 1;
      const p: Person = { id: `local-p-${n}`, name: input.name, avatar: null, clinicNo: `PR-${String(1040 + (PATIENTS.length - 1 + n) * 7).padStart(5, "0")}`, age: input.age, sex: input.sex, phone: input.phone, intakeComplete: false, local: true };
      setLocalPatients((xs) => [p, ...xs]);
      return p;
    },
    [localRef, setLocalPatients],
  );

  const addWaitlist = useCallback(
    (entry: Omit<WaitEntry, "id" | "status" | "addedAt">) => {
      const e: WaitEntry = { ...entry, id: `local-w-${++seq.current}`, status: "waiting", addedAt: NOW_ISO, local: true };
      setWaitlist((xs) => [e, ...xs]);
      return e;
    },
    [setWaitlist],
  );

  const patchWaitlist = useCallback((id: string, patch: Partial<WaitEntry>) => setWaitlist((xs) => xs.map((w) => (w.id === id ? { ...w, ...patch } : w))), [setWaitlist]);

  const removeWaitlist = useCallback(
    (id: string) => {
      const index = waitlistRef.current.findIndex((w) => w.id === id);
      if (index < 0) return undefined;
      const entry = waitlistRef.current[index];
      setWaitlist((xs) => xs.filter((w) => w.id !== id));
      return { entry, index };
    },
    [waitlistRef, setWaitlist],
  );

  const restoreWaitlist = useCallback(
    (entry: WaitEntry, index: number) =>
      setWaitlist((xs) => {
        const next = xs.filter((w) => w.id !== entry.id);
        next.splice(Math.min(index, next.length), 0, entry);
        return next;
      }),
    [setWaitlist],
  );

  const takeClassSeat = useCallback((classId: string) => setClassSeats((m) => ({ ...m, [classId]: (m[classId] ?? 0) + 1 })), [setClassSeats]);

  const value = useMemo<Ctx>(
    () => ({
      bookings,
      events,
      occupants,
      doubleIds,
      waitlist,
      localPatients,
      classSeats,
      recentIds,
      groupClasses,
      privacy,
      setPrivacy,
      queueDisplay,
      setQueueDisplay,
      callingId,
      setCallingId,
      person,
      allPeople,
      addBookings,
      patchBooking,
      restoreBooking,
      checkIn,
      issueToken,
      registerPatient,
      addWaitlist,
      patchWaitlist,
      removeWaitlist,
      restoreWaitlist,
      takeClassSeat,
    }),
    [bookings, events, occupants, doubleIds, waitlist, localPatients, classSeats, recentIds, groupClasses, privacy, queueDisplay, callingId, person, allPeople, addBookings, patchBooking, restoreBooking, checkIn, issueToken, registerPatient, addWaitlist, patchWaitlist, removeWaitlist, restoreWaitlist, takeClassSeat],
  );

  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

/** Display name under privacy mode: initials only ("K. M."). */
export function displayName(name: string, privacy: boolean) {
  if (!privacy) return name;
  return name
    .replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => `${p[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
}
