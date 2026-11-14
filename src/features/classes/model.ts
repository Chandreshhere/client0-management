import type { AttendanceState, YogaClass } from "@/data/types";
import { CLASSES } from "@/data/programs";
import type { PlanId } from "@/data/plans";
import { TODAY, formatDate } from "@/lib/format";
import { ATTENDANCE_HISTORY, BASE_REASONS, CLEARANCES, EARLIER_SESSIONS, LATER_SESSIONS, SESSION_PLANS, type ProgressNote, type SessionPlan } from "./data";

/** Pure helpers + state shape for the sessions workspace (safe on server and client). */

export const WEEK_CLASSES: YogaClass[] = [...CLASSES, ...EARLIER_SESSIONS, ...LATER_SESSIONS].sort((a, b) => a.start.localeCompare(b.start));
/** Fixture sessions only (server-safe). Sessions logged in this browser are looked up with `allClasses`. */
export const classById = (id: string) => WEEK_CLASSES.find((c) => c.id === id);
export const isLoggedId = (id: string) => id.startsWith("c-local-");

/** Mon 9 – Sat 14 Nov, matching the shared week diary. */
export const WEEK_DAYS = [9, 10, 11, 12, 13, 14].map((d) => `2026-11-${String(d).padStart(2, "0")}`);
export const TODAY_KEY = "2026-11-13";

export const endOf = (c: YogaClass) => new Date(new Date(c.start).getTime() + c.durationMin * 60_000);

/** Attendance an instructor marks (spec F7). Cancelled / held places are read-only. */
export const MARKABLE: AttendanceState[] = ["present", "late", "absent"];
export const isReleased = (st: AttendanceState) => st === "cancelled" || st === "rescheduled";
/** "rescheduled" is how a participant held from one session is stored, so it reads "Held". */
export const ATT_LABEL: Record<AttendanceState, string> = { present: "Present", late: "Late", absent: "Absent", cancelled: "Cancelled", rescheduled: "Held", pending: "Not marked" };

export interface Mark {
  state: AttendanceState;
  reason: string;
}

export interface Decision {
  kind: "acknowledged" | "held";
  note: string;
  by: string;
  at: string;
}

/** A session logged by an instructor in this browser (spec "Session log": 1:1 or group, date, patients). */
export type LoggedClass = YogaClass & { weekly?: boolean; loggedBy: string };

export interface ClassesState {
  /** saved attendance, keyed classId:patientId */
  marks: Record<string, Mark>;
  /** unsaved attendance edits per class */
  drafts: Record<string, Record<string, Mark>>;
  savedAt: Record<string, string>;
  /** changed/expired precaution acknowledged by an instructor (applies to every session) */
  acks: Record<string, Decision>;
  /** participant held from one session, keyed classId:patientId */
  holds: Record<string, Decision>;
  sessions: Record<string, { status: "in-progress" | "ended"; startedAt: string; endedAt?: string; by: string }>;
  /** repeated absence handed to the coordinator (Pro) or reception (Clinic), keyed by patient */
  routed: Record<string, { to: string; at: string; by: string }>;
  notes: ProgressNote[];
  plans: Record<string, SessionPlan>;
  offers: Record<string, { at: string; by: string }>;
  created: LoggedClass[];
}

export const key = (classId: string, patientId: string) => `${classId}:${patientId}`;

type Enrolment = YogaClass["enrolled"][number];

/** Fixture sessions plus the ones logged in this browser session, in time order. */
export function allClasses(s: ClassesState): YogaClass[] {
  if (!s.created.length) return WEEK_CLASSES;
  return [...WEEK_CLASSES, ...s.created].sort((a, b) => a.start.localeCompare(b.start));
}

export function savedMark(s: ClassesState, c: YogaClass, e: Enrolment): Mark {
  return s.marks[key(c.id, e.patientId)] ?? { state: e.attendance, reason: BASE_REASONS[key(c.id, e.patientId)] ?? "" };
}

export function currentMark(s: ClassesState, c: YogaClass, e: Enrolment): Mark {
  return s.drafts[c.id]?.[e.patientId] ?? savedMark(s, c, e);
}

export type Phase = "upcoming" | "in-progress" | "ended";

export function phaseOf(s: ClassesState, c: YogaClass): Phase {
  const recorded = s.sessions[c.id]?.status;
  if (recorded) return recorded;
  const now = TODAY.getTime();
  if (endOf(c).getTime() <= now) return "ended";
  // A logged session the instructor hasn't started yet stays "upcoming" even if its time has come.
  if (new Date(c.start).getTime() <= now && !isLoggedId(c.id)) return "in-progress";
  return "upcoming";
}

/**
 * The precaution as the instructor reads it: fixture notes such as "(changed 13 Nov by …)" or
 * "— needs instructor review" are shown as state elsewhere, not inside the rule itself.
 */
export const precautionText = (p?: string) =>
  p
    ?.replace(/\s*\((changed [^)]*)\)\s*$/i, "")
    .replace(/\s*—\s*needs instructor review\s*$/i, "")
    .replace(/\bchanged to\s+/i, "")
    .trim();

/** Changed or expired precaution — the instructor must acknowledge it before the session starts. */
export const isFlagged = (e: Enrolment) => e.clearance !== "current";
export const isResolved = (s: ClassesState, c: YogaClass, e: Enrolment) => !isFlagged(e) || !!s.acks[e.patientId] || !!s.holds[key(c.id, e.patientId)];
export const openIssues = (s: ClassesState, c: YogaClass) => c.enrolled.filter((e) => !isResolved(s, c, e));

/**
 * Who approved the precaution shown on this enrolment. A past session that still carries the
 * earlier precaution is attributed to the earlier approval, not to the later change.
 */
export function approvalFor(e: Enrolment) {
  const c = CLEARANCES[e.patientId];
  if (!c) return null;
  if (c.previous && e.clearance === "current" && e.precaution === c.previous.text) return { by: c.previous.by, at: c.previous.at, validUntil: null, coveringFor: undefined };
  return { by: c.by, at: c.at, validUntil: c.validUntil, coveringFor: c.coveringFor };
}

/** Absences on record between two instants: earlier history + this week's saved attendance. */
export function absences(s: ClassesState, patientId: string, sinceIso: string, untilIso: string) {
  const out: { date: string; title: string }[] = [];
  const inWindow = (iso: string) => iso >= sinceIso && iso <= untilIso;
  for (const h of ATTENDANCE_HISTORY[patientId] ?? []) if (h.state === "absent" && inWindow(h.date)) out.push({ date: h.date, title: h.title });
  for (const c of allClasses(s)) {
    const e = c.enrolled.find((x) => x.patientId === patientId);
    if (!e || !inWindow(c.start)) continue;
    if (savedMark(s, c, e).state === "absent") out.push({ date: c.start, title: c.title });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Repeated absence = 3 or more in the 14 days up to a session.
 * Measured at the session's own date, so an earlier absence isn't flagged with hindsight.
 */
export const repeatedAbsence = (s: ClassesState, patientId: string, atIso: string = TODAY.toISOString()) => {
  const since = new Date(new Date(atIso).getTime() - 14 * 86_400_000).toISOString();
  const list = absences(s, patientId, since, atIso);
  return list.length >= 3 ? list : null;
};

export function attendanceRate(s: ClassesState, classes: YogaClass[]) {
  let came = 0;
  let marked = 0;
  for (const c of classes) {
    if (phaseOf(s, c) !== "ended") continue;
    for (const e of c.enrolled) {
      const m = savedMark(s, c, e).state;
      if (m === "present" || m === "late") {
        came += 1;
        marked += 1;
      } else if (m === "absent") marked += 1;
    }
  }
  return { came, marked, pct: marked ? Math.round((came / marked) * 100) : null };
}

/**
 * Who follows up a repeated absence: the care coordinator (Pro) or reception (Clinic). Core has
 * neither role, so the instructor flags the doctor instead (null).
 */
export function absenceOwner(plan: PlanId): { id: string; label: string } | null {
  if (plan === "pro") return { id: "s-farhan", label: "coordinator" };
  if (plan === "clinic") return { id: "s-sneha", label: "reception" };
  return null;
}

export const planFor = (s: ClassesState, c: YogaClass): SessionPlan =>
  s.plans[c.id] ?? SESSION_PLANS[c.title] ?? { objectives: [], steps: [], modifications: [], props: [] };

/**
 * "Weekly · Mon, Wed, Fri" for a recurring group class (Clinic+ scheduling): the weekdays this week
 * on which the same class runs with the same instructor. 1:1 sessions don't recur.
 */
export function recurrence(s: ClassesState, c: YogaClass): string | null {
  if (c.kind !== "group") return null;
  const logged = s.created.find((x) => x.id === c.id);
  if (logged) return logged.weekly ? `Weekly · ${formatDate(c.start, { weekday: "short" })}` : null;
  const days = allClasses(s)
    .filter((x) => x.kind === "group" && x.title === c.title && x.instructorId === c.instructorId)
    .map((x) => formatDate(x.start, { weekday: "short" }));
  return `Weekly · ${[...new Set(days)].join(", ")}`;
}
