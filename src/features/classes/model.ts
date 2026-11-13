import type { AttendanceState, YogaClass } from "@/data/types";
import { CLASSES } from "@/data/programs";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { TODAY } from "@/lib/format";
import { ATTENDANCE_HISTORY, BASE_REASONS, COVERING, EARLIER_SESSIONS, SESSION_PLANS, type Observation, type SessionPlan } from "./data";

/** Pure helpers + state shape for the classes workspace (safe on server and client). */

export const WEEK_CLASSES: YogaClass[] = [...CLASSES, ...EARLIER_SESSIONS].sort((a, b) => a.start.localeCompare(b.start));
export const classById = (id: string) => WEEK_CLASSES.find((c) => c.id === id);

/** Mon 9 – Sat 14 Nov, matching the shared week diary. */
export const WEEK_DAYS = [9, 10, 11, 12, 13, 14].map((d) => `2026-11-${String(d).padStart(2, "0")}`);
export const TODAY_KEY = "2026-11-13";

export const endOf = (c: YogaClass) => new Date(new Date(c.start).getTime() + c.durationMin * 60_000);

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

export type Urgency = "routine" | "today" | "urgent";

export interface Escalation {
  id: string;
  patientId: string;
  classId: string;
  concern: string;
  urgency: Urgency;
  ownerId: string;
  routedVia: string | null;
  by: string;
  at: string;
}

export interface ClassesState {
  /** saved attendance, keyed classId:patientId */
  marks: Record<string, Mark>;
  /** unsaved attendance edits per class */
  drafts: Record<string, Record<string, Mark>>;
  savedAt: Record<string, string>;
  /** precaution change/expiry acknowledged by an instructor (applies to every session) */
  acks: Record<string, Decision>;
  /** participant held from one session, keyed classId:patientId */
  holds: Record<string, Decision>;
  sessions: Record<string, { status: "in-progress" | "ended"; startedAt: string; endedAt?: string; by: string }>;
  escalations: Escalation[];
  routed: Record<string, { to: string; at: string; by: string }>;
  observations: Observation[];
  plans: Record<string, SessionPlan>;
  offers: Record<string, { at: string; by: string }>;
}

export const key = (classId: string, patientId: string) => `${classId}:${patientId}`;

type Enrolment = YogaClass["enrolled"][number];

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
  if (new Date(c.start).getTime() <= now) return "in-progress";
  return "upcoming";
}

export const isFlagged = (e: Enrolment) => e.clearance !== "current";
export const isResolved = (s: ClassesState, c: YogaClass, e: Enrolment) => !isFlagged(e) || !!s.acks[e.patientId] || !!s.holds[key(c.id, e.patientId)];
export const openIssues = (s: ClassesState, c: YogaClass) => c.enrolled.filter((e) => !isResolved(s, c, e));

/** Reasons are required for these states (doc §2D: attendance states with a reason where needed). */
export const NEEDS_REASON: AttendanceState[] = ["absent", "cancelled", "rescheduled"];

/** Absences on record between two instants: earlier history + this week's saved attendance. */
export function absences(s: ClassesState, patientId: string, sinceIso: string, untilIso: string) {
  const out: { date: string; title: string }[] = [];
  const inWindow = (iso: string) => iso >= sinceIso && iso <= untilIso;
  for (const h of ATTENDANCE_HISTORY[patientId] ?? []) if (h.state === "absent" && inWindow(h.date)) out.push({ date: h.date, title: h.title });
  for (const c of WEEK_CLASSES) {
    const e = c.enrolled.find((x) => x.patientId === patientId);
    if (!e || !inWindow(c.start)) continue;
    if (savedMark(s, c, e).state === "absent") out.push({ date: c.start, title: c.title });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Repeated absence = 3 or more in the 14 days up to a session → route to the coordinator (doc §2D).
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
 * Who a care-team escalation goes to: the patient's doctor; if they are on leave, the doctor
 * covering for them; otherwise (no cover, or no doctor) the coordinator (Clinic plan) or the
 * front desk (Team plan) to reassign it.
 */
export function routeFor(patientId: string, hasCoordinator: boolean): { ownerId: string; via: string | null } {
  const patient = patientById(patientId);
  const doctor = staffById(patient?.careTeam.doctor);
  const fallback = hasCoordinator ? "s-farhan" : "s-sneha";
  if (doctor && doctor.status !== "on-leave") return { ownerId: doctor.id, via: null };
  if (doctor) {
    const leave = /^on leave/i.test(doctor.workingHours) ? doctor.workingHours.charAt(0).toLowerCase() + doctor.workingHours.slice(1) : "on leave";
    const cover = staffById(COVERING[doctor.id]);
    if (cover && cover.status !== "on-leave") return { ownerId: cover.id, via: `${doctor.name} is ${leave} — ${cover.name} is covering` };
    return { ownerId: fallback, via: `${doctor.name} is ${leave}` };
  }
  return { ownerId: fallback, via: "No doctor is assigned to this patient" };
}

/** Repeated-absence follow-up goes to the coordinator; Team plan has no coordinator role → front desk. */
export const absenceOwner = (hasCoordinator: boolean) => (hasCoordinator ? "s-farhan" : "s-sneha");

export const planFor = (s: ClassesState, c: YogaClass): SessionPlan =>
  s.plans[c.id] ?? SESSION_PLANS[c.title] ?? { objectives: [], steps: [], modifications: [], props: [] };
