import type { Patient, YogaClass } from "@/data/types";
import type { FeatureId } from "@/data/plans";
import type { CareEvent, Condition } from "@/data/featured";
import { CARE_EVENTS, CONDITIONS } from "@/data/featured";
import { REFERRALS, ASSIGNMENT_RETURN_HOURS, assignmentState } from "@/data/care";
import { WEEK_APPOINTMENTS } from "@/data/appointments";
import { BRANCHES, staffById } from "@/data/staff";
import { TODAY } from "@/lib/format";
import { MEDICATIONS, recordHref, type ChangeKind, type RecordDocument } from "@/features/patient-record/data";
import { isFeaturedPatient, readableDates, recordOf, treatments } from "@/features/patient-record/record-model";
import { changesFor, sinceFor } from "@/features/patient-record/notes/notes-data";
import { CLEARANCES, type Clearance } from "@/features/classes/data";
import { WEEK_CLASSES, precautionText } from "@/features/classes/model";
import { sectionHref } from "./sections";
import type { LocalAssignment, LocalPrecaution } from "./profile-store";

/**
 * What the profile sections show, derived from the patient's own record and the shared fixtures
 * (never invented per view). Pure; anything that changes in this browser session (plans, flags,
 * attendance) is merged in by the components from their stores.
 */

export const NOW_ISO = "2026-11-13T09:40:00+05:30";
const HOUR = 3_600_000;

export const firstName = (p: Patient) => p.name.split(" ")[0];

/* ------------------------------------------------------------------ medicines & conditions */

export interface MedicineLine {
  id: string;
  name: string;
  detail: string;
  since: string;
  by: string;
  /** patient-reported adherence note when it differs from the prescription */
  reported?: string;
}

/** Current medicines: reconciled list for the featured patient; started treatments for the rest. */
export function currentMedicines(patientId: string): MedicineLine[] {
  if (isFeaturedPatient(patientId)) {
    return MEDICATIONS.map((m) => ({ id: m.id, name: m.name, detail: m.dose, since: m.prescribed, by: m.by, reported: m.reported === "taking" ? undefined : m.reportedNote }));
  }
  return treatments(patientId).map((t) => {
    // "Tiotropium inhaler started; pulmonary rehab breathing plan" → name + the rest as detail
    const rest = t.detail.startsWith(t.name) ? t.detail.slice(t.name.length).replace(/^[\s;,.]+/, "") : t.detail;
    const name = t.name.replace(/\s+started$/i, "");
    return { id: t.id, name: name.charAt(0).toUpperCase() + name.slice(1), detail: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "As prescribed", since: t.prescribed, by: t.by };
  });
}

/** Every medicine change on record (started, changed, stopped, reconciled), newest first. */
export function medicineHistory(patientId: string): { id: string; date: string; title: string; detail: string; by: string }[] {
  const events = isFeaturedPatient(patientId) ? CARE_EVENTS : (recordOf(patientId)?.events ?? []);
  return events
    .filter((e) => e.type === "medication" && e.state !== "scheduled")
    .map((e) => ({ id: e.id, date: e.date, title: e.title, detail: readableDates(e.summary), by: e.authorId }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function conditionsOf(patientId: string): Condition[] {
  const list = isFeaturedPatient(patientId) ? CONDITIONS : (recordOf(patientId)?.conditions ?? []);
  const rank = (c: Condition) => (c.status === "Resolved" ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || b.since.localeCompare(a.since));
}

/** Diagnosis entries for a condition (when it was recorded and by whom). */
export function conditionEvents(patientId: string, conditionId: string): CareEvent[] {
  const events = isFeaturedPatient(patientId) ? CARE_EVENTS : (recordOf(patientId)?.events ?? []);
  return events.filter((e) => e.conditionId === conditionId && e.state !== "scheduled").sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------------------ care team & assignments */

export type TeamKey = "doctor" | "nutritionist" | "yoga" | "coordinator";
export const TEAM_LABEL: Record<TeamKey, string> = { doctor: "Primary doctor", nutritionist: "Nutritionist", yoga: "Yoga instructor", coordinator: "Care coordinator" };

export interface AssignmentView {
  id: string;
  toId: string;
  fromId: string;
  discipline: "nutrition" | "yoga";
  state: "assigned" | "seen";
  at: string;
  reason: string;
  /** not seen within 48 hours → back on the assigning doctor's list */
  overdue: boolean;
  local: boolean;
}

/** Assignments to nutrition or yoga for this patient (assigned → seen), newest first. */
export function assignmentsOf(patientId: string, local: LocalAssignment[]): AssignmentView[] {
  const fromFixtures: AssignmentView[] = REFERRALS.filter((r) => r.patientId === patientId && (r.toDiscipline === "nutrition" || r.toDiscipline === "movement")).map((r) => {
    const state = assignmentState(r);
    return {
      id: r.id, toId: r.toId, fromId: r.fromId, discipline: r.toDiscipline === "nutrition" ? "nutrition" : "yoga", state, at: r.requestedAt, reason: r.reason,
      overdue: state === "assigned" && TODAY.getTime() - new Date(r.requestedAt).getTime() > ASSIGNMENT_RETURN_HOURS * HOUR, local: false,
    };
  });
  const fromSession: AssignmentView[] = local
    .filter((a) => a.patientId === patientId)
    .map((a) => ({ id: a.id, toId: a.toId, fromId: a.fromId, discipline: a.discipline, state: "assigned", at: a.at, reason: [a.goals, a.guidance].filter(Boolean).join(" · "), overdue: false, local: true }));
  return [...fromSession, ...fromFixtures].sort((a, b) => b.at.localeCompare(a.at));
}

export interface TeamMember {
  key: TeamKey;
  staffId: string | undefined;
  assignment: AssignmentView | undefined;
}

export function careTeamOf(patient: Patient, assignments: AssignmentView[], has: (f: FeatureId) => boolean): TeamMember[] {
  const keys: TeamKey[] = ["doctor", "nutritionist", "yoga", ...(has("coordinator") ? (["coordinator"] as TeamKey[]) : [])];
  return keys.map((key) => {
    const latest = key === "nutritionist" ? assignments.find((a) => a.discipline === "nutrition") : key === "yoga" ? assignments.find((a) => a.discipline === "yoga") : undefined;
    // a session assignment to someone new shows them as the (pending) team member
    const staffId = latest?.local ? latest.toId : (patient.careTeam[key] ?? latest?.toId);
    return { key, staffId, assignment: latest && latest.toId === staffId ? latest : undefined };
  });
}

/* ------------------------------------------------------------------ follow-up */

export interface FollowUp {
  at: string;
  withId: string | undefined;
  label: string;
  room: string | undefined;
}

/** Next follow-up: the booked appointment, or the review date on the care plan. */
export function nextFollowUp(patient: Patient): FollowUp | null {
  if (patient.nextAppointment) {
    const a = WEEK_APPOINTMENTS.find((x) => x.patientId === patient.id && x.start === patient.nextAppointment);
    return { at: patient.nextAppointment, withId: a?.staffId, label: a?.service ?? "Follow-up", room: a?.room };
  }
  const review = recordOf(patient.id)?.carePlan?.nextReview;
  return review ? { at: review.at, withId: review.with, label: review.label, room: undefined } : null;
}

/* ------------------------------------------------------------------ what changed */

export interface ChangeItem {
  id: string;
  kind: ChangeKind;
  date: string;
  title: string;
  detail: string;
  by: string;
  selfReported: boolean;
  href: string;
}

/**
 * "What changed since the last visit": reports, plan versions, guidance and missed sessions that
 * reached the record after the last visit. Self-reported items need the patient app (Pro).
 */
export function changesSinceLastVisit(patient: Patient, has: (f: FeatureId) => boolean): { since: string; items: ChangeItem[] } {
  const pid = patient.id;
  const items = changesFor(pid)
    .filter((c) => has("self-report") || !c.selfReported)
    .map((c): ChangeItem => {
      const t = c.target;
      let href: string;
      if ("tab" in t) href = `${recordHref(pid, t.tab)}${t.docId ? `?doc=${t.docId}` : ""}`;
      else if (t.href.startsWith("/nutrition")) href = sectionHref(pid, "nutrition");
      else if (t.href.startsWith("/classes")) href = sectionHref(pid, "yoga");
      else if (t.href.endsWith("/journey")) href = sectionHref(pid, "timeline");
      else if (t.href === `/patients/${pid}`) href = sectionHref(pid, c.kind === "guidance" ? "yoga" : "timeline");
      else href = t.href;
      return { id: c.id, kind: c.kind, date: c.date, title: c.title, detail: readableDates(c.detail), by: c.by, selfReported: !!c.selfReported, href };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return { since: sinceFor(patient), items };
}

/** Reports by date issued (an old report uploaded today is never shown as a new result). */
export const byDateIssued = (a: RecordDocument, b: RecordDocument) => b.reportDate.localeCompare(a.reportDate) || b.uploadedAt.localeCompare(a.uploadedAt);

/* ------------------------------------------------------------------ demographics */

/** Emergency contacts captured at registration (synthetic; blank means not recorded). */
const EMERGENCY: Record<string, { name: string; relation: string; phone: string }> = {
  "p-kabir": { name: "Anjali Malhotra", relation: "Mother", phone: "+91 98•• ••• 330" },
  "p-aditi": { name: "Rohit Sharma", relation: "Husband", phone: "+91 99•• ••• 412" },
  "p-rajesh": { name: "Leela Pillai", relation: "Wife", phone: "+91 97•• ••• 108" },
  "p-arun": { name: "Shobha Kumar", relation: "Wife", phone: "+91 94•• ••• 771" },
  "p-rekha": { name: "Srinivas Iyengar", relation: "Son", phone: "+91 80•• ••• 905" },
  "p-lakshmi-n": { name: "Anand Narayan", relation: "Son · caregiver", phone: "+91 80•• ••• 662" },
  "p-ishita": { name: "Arnab Banerjee", relation: "Husband", phone: "+91 96•• ••• 254" },
  "p-harish": { name: "Kavitha Gowda", relation: "Wife", phone: "+91 96•• ••• 019" },
  "p-vivek": { name: "Divya Menon", relation: "Wife", phone: "+91 98•• ••• 846" },
  "p-sunita": { name: "Mahesh Patil", relation: "Husband", phone: "+91 97•• ••• 532" },
  "p-meenakshi": { name: "Ravi Sundaram", relation: "Husband", phone: "+91 94•• ••• 618" },
  "p-gaurav": { name: "Pooja Tiwari", relation: "Sister", phone: "+91 99•• ••• 337" },
};

export function demographicsOf(patient: Patient) {
  const branch = BRANCHES.find((b) => b.id === patient.branch);
  const desk = patient.branch === "hsr" ? "s-ishaan" : "s-sneha";
  return {
    emergency: EMERGENCY[patient.id] ?? null,
    consent: { at: patient.registeredAt, by: desk, guardianPending: patient.tags.some((t) => /guardian/i.test(t)) },
    branch: branch ? `${branch.name}, ${branch.city}` : patient.branch,
  };
}

/* ------------------------------------------------------------------ yoga */

/** Every session this patient is on (this week's diary plus earlier ones), newest first. */
export function sessionsOf(patientId: string): { cls: YogaClass; enrolment: YogaClass["enrolled"][number] }[] {
  return WEEK_CLASSES.flatMap((cls) => {
    const enrolment = cls.enrolled.find((e) => e.patientId === patientId);
    return enrolment ? [{ cls, enrolment }] : [];
  }).sort((a, b) => b.cls.start.localeCompare(a.cls.start));
}

export interface Precautions {
  lines: string[];
  /** the latest session's precaution state: changed or expired ones need acknowledging */
  state: "current" | "changed" | "expired" | null;
  /** who set the precautions shown, and when */
  by: string | undefined;
  coveringFor: string | undefined;
  at: string | undefined;
  /** what it replaced and why (only for a change) */
  previous: string | undefined;
  reason: string | undefined;
  validUntil: string | null;
}

/** The doctor's precautions as the instructor sees them (never diagnoses), plus changes made in this session. */
export function precautionsOf(patientId: string, local: LocalPrecaution[]): Precautions {
  const sessions = sessionsOf(patientId);
  const flagged = sessions.find((s) => s.enrolment.clearance !== "current" && s.enrolment.precaution);
  const latest = flagged ?? sessions.find((s) => s.enrolment.precaution);
  const clearance: Clearance | undefined = CLEARANCES[patientId];
  const mine = local.filter((p) => p.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at))[0];
  const fixtureText = precautionText(latest?.enrolment.precaution) ?? "";
  const split = (text: string) =>
    text
      .split(/;\s*|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  if (mine) {
    return { lines: split(mine.text), state: "changed", by: mine.by, coveringFor: undefined, at: mine.at, previous: fixtureText || undefined, reason: mine.reason || undefined, validUntil: null };
  }
  const state = latest ? latest.enrolment.clearance : clearance ? "current" : null;
  return {
    lines: split(fixtureText),
    state,
    by: clearance?.by,
    coveringFor: clearance?.coveringFor,
    at: clearance?.at,
    previous: state !== "current" ? clearance?.previous?.text : undefined,
    reason: state !== "current" ? clearance?.reason : undefined,
    validUntil: clearance?.validUntil ?? null,
  };
}

/** Goals agreed for yoga (worded for the instructor — no diagnoses). */
export const YOGA_GOALS: Record<string, string[]> = {
  "p-kabir": ["30 minutes of activity daily without symptoms", "Tree pose at the wall, 30 s each side", "Paced breathing 4-6 at home, 5 minutes a day"],
  "p-rekha": ["Pursed-lip breathing on every stair climb", "Walk 10 minutes without stopping", "Balance work with chair support"],
  "p-arun": ["Seated practice 3× a week", "Return to standing work after the doctor's review"],
  "p-vivek": ["Steady low-intensity flow, 3× a week", "Evening relaxation routine for sleep"],
  "p-gaurav": ["Low-impact flow, 2× a week", "Side-lying relaxation instead of supine"],
  "p-karthik": ["Paced breathing to bring resting HR down", "Weekly relaxation practice"],
  "p-aditi": ["Strength-biased flow 2× a week", "Home practice on non-class days"],
  "p-fatima": ["Bridge with block, 3 × 8", "Neutral-spine habits at the desk"],
  "p-lakshmi-n": ["Chair-supported balance, 2× a week", "Get up from a chair without using hands"],
  "p-meenakshi": ["Gentle joint mobility each morning", "Wrist-friendly variations in every class"],
  "p-ishita": ["Side-lying relaxation and pelvic-floor awareness", "Comfortable breathing in late pregnancy"],
  "p-mohit": ["Breath control before exertion", "Inhaler within reach at every session"],
  "p-zoya": ["Regular relaxation practice", "Stop and rest at the first sign of symptoms"],
  "p-neelam": ["Evening wind-down routine", "Strength flow 2× a week"],
  "p-deepak": ["Desk posture breaks every hour", "Home neck-mobility routine"],
};

/* ------------------------------------------------------------------ dates */

export const hoursAgo = (iso: string) => (TODAY.getTime() - new Date(iso).getTime()) / HOUR;
export const staffName = (id: string | undefined) => staffById(id)?.name ?? "Not assigned";
