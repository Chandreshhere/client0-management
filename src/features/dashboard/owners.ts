import { ASSIGNMENT_RETURN_HOURS, REFERRALS, TASKS, assignmentState } from "@/data/care";
import { DOCUMENTS } from "@/data/records";
import { PATIENTS, patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { CLASSES } from "@/data/programs";
import { planHas, type PlanId } from "@/data/plans";
import type { Referral } from "@/data/types";
import { hoursSince, minutesUntil, shortDate } from "./data";

/**
 * One owner per item (spec rule 2, fix 7). Every pending item a role home shows comes from here,
 * and each item resolves to exactly one owner — the only person whose starting view lists it.
 * Everyone else on the care team sees it on the patient profile and timeline.
 *
 *   Item                               Owner
 *   Report to review (F4)              the reviewing doctor
 *   Note to sign (F3)                  the doctor who wrote it
 *   Flag to the doctor (F8)            the patient's doctor (the person who raised it sees it as "waiting")
 *   Assignment, not seen, < 48 h (F5)  the nutritionist or instructor it was assigned to
 *   Assignment, not seen, ≥ 48 h       Pro: the care coordinator · Core/Clinic: back to the assigning doctor
 *   Follow-up overdue                  Pro: the patient's care coordinator · otherwise the primary doctor
 *   Repeated missed sessions           Pro: the care coordinator (no starting view without one — profile only)
 *   Changed precaution (F7)            the instructor running the patient's sessions
 */

const COORDINATOR = DEMO_USER.coordinator.personId;

// ---------------------------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------------------------

/** Reports waiting for this doctor's review, oldest deadline first. */
export const reportsToReview = (doctorId: string) =>
  DOCUMENTS.filter((d) => d.reviewerId === doctorId && d.status === "awaiting-review" && d.patientId).sort((a, b) => (a.dueBy ?? "9").localeCompare(b.dueBy ?? "9"));

/** Draft consultation notes waiting for this doctor's signature. */
export const notesToSign = (doctorId: string) => TASKS.filter((t) => t.ownerId === doctorId && t.source === "Unsigned draft" && t.status !== "done" && t.patientId);

// ---------------------------------------------------------------------------------------------
// Flags (F8): a nutritionist or instructor raises a concern to the patient's doctor.
// ---------------------------------------------------------------------------------------------

export interface Flag {
  id: string;
  patientId: string;
  raisedBy: string;
  doctorId: string;
  what: string;
  urgency: "same-day" | "routine";
  due: string;
}

const RAISERS = new Set(["nutritionist", "yoga"]);

export const FLAGS: Flag[] = TASKS.filter((t) => t.status !== "done" && t.patientId && RAISERS.has(staffById(t.createdBy)?.role ?? "") && staffById(t.ownerId)?.role === "doctor").map((t) => {
  const what = t.title.replace(/^Clinical review:\s*/i, "");
  return {
    id: t.id,
    patientId: t.patientId!,
    raisedBy: t.createdBy,
    doctorId: t.ownerId,
    what: what.charAt(0).toUpperCase() + what.slice(1),
    urgency: t.priority === "urgent" || t.priority === "high" ? "same-day" : "routine",
    due: t.due,
  };
});

export const flagsTo = (doctorId: string) => FLAGS.filter((f) => f.doctorId === doctorId);
export const flagsRaisedBy = (staffId: string) => FLAGS.filter((f) => f.raisedBy === staffId);

// ---------------------------------------------------------------------------------------------
// Assignments (F5): assigned → seen. Unseen for 48 h, it leaves the recipient's list.
// ---------------------------------------------------------------------------------------------

export type AssignmentHolder = "recipient" | "doctor" | "coordinator";

/** When an unseen assignment leaves the recipient's list. */
export const returnsAt = (r: Referral) => new Date(Date.parse(r.requestedAt) + ASSIGNMENT_RETURN_HOURS * 3_600_000).toISOString();

/** Who holds an assignment that hasn't been opened yet (null once seen — nothing is pending). */
export function assignmentHolder(r: Referral, plan: PlanId, seen: Record<string, string> = {}): AssignmentHolder | null {
  if (assignmentState(r) === "seen" || seen[r.id]) return null;
  if (hoursSince(r.requestedAt) < ASSIGNMENT_RETURN_HOURS) return "recipient";
  // Spec F5: unseen after 48 h it goes back to the assigning doctor's pending list (every plan);
  // on Pro the care coordinator also sees it in the stalled-care list, with the doctor as owner.
  return "doctor";
}

/** New assignments for a nutritionist or instructor: assigned to them, not yet opened, within 48 h. */
export const newAssignmentsFor = (staffId: string, plan: PlanId, seen: Record<string, string>) =>
  REFERRALS.filter((r) => r.toId === staffId && assignmentHolder(r, plan, seen) === "recipient").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

/** Assignments this doctor sent that came back unseen after 48 h (every plan). */
export const returnedAssignmentsFor = (doctorId: string, plan: PlanId, seen: Record<string, string>) =>
  REFERRALS.filter((r) => r.fromId === doctorId && assignmentHolder(r, plan, seen) === "doctor");

/** Pro: unseen assignments past 48 h — owned by the assigning doctor, visible to the coordinator to chase. */
export const unseenAssignmentsForCoordinator = (plan: PlanId, seen: Record<string, string>) =>
  planHas(plan, "coordinator") ? REFERRALS.filter((r) => assignmentHolder(r, plan, seen) === "doctor").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)) : [];

// ---------------------------------------------------------------------------------------------
// Follow-ups overdue: an active patient whose follow-up has passed with nothing booked, plus
// (Pro) the coordinator's own overdue programme follow-ups.
// ---------------------------------------------------------------------------------------------

export interface FollowUp {
  id: string;
  patientId: string;
  reason: string;
  detail: string;
  ownerId: string;
  since: string;
}

const followUpOwner = (patientId: string, plan: PlanId) => {
  const p = patientById(patientId);
  if (planHas(plan, "coordinator") && p?.careTeam.coordinator) return p.careTeam.coordinator;
  return p?.careTeam.doctor ?? null;
};

export function overdueFollowUps(plan: PlanId): FollowUp[] {
  const out: FollowUp[] = [];
  const calendar = planHas(plan, "calendar");
  for (const p of PATIENTS) {
    if (p.nextAppointment || !p.lastVisit || p.status === "completed") continue;
    const owner = followUpOwner(p.id, plan);
    if (!owner) continue;
    // A no-show today is the latest missed visit; it only exists where there is a calendar.
    const missed = calendar ? TODAY_APPOINTMENTS.find((a) => a.patientId === p.id && a.status === "no-show") : undefined;
    out.push({
      id: `fu-${p.id}`,
      patientId: p.id,
      reason: missed ? "Missed a visit today, not rebooked" : "Review overdue",
      detail: missed ? `${missed.service} with ${staffById(missed.staffId)?.name}` : `Last seen ${shortDate(p.lastVisit)} · ${calendar ? "nothing booked" : "no follow-up date set"}`,
      ownerId: owner,
      since: missed?.start ?? p.lastVisit,
    });
  }
  if (planHas(plan, "coordinator")) {
    // The coordinator's own overdue follow-ups after a programme ended (programmes are Pro).
    for (const t of TASKS.filter((x) => x.ownerId === COORDINATOR && x.patientId && x.status !== "done" && /programme ended/i.test(x.source) && minutesUntil(x.due) < 0)) {
      out.push({ id: `fu-${t.id}`, patientId: t.patientId!, reason: t.title, detail: `${t.source} · was due ${shortDate(t.due)}`, ownerId: COORDINATOR, since: t.due });
    }
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}

export const followUpsOwnedBy = (staffId: string, plan: PlanId) => overdueFollowUps(plan).filter((f) => f.ownerId === staffId);

// ---------------------------------------------------------------------------------------------
// Repeated missed sessions (Pro → care coordinator): two or more absences across class lists.
// ---------------------------------------------------------------------------------------------

export function repeatedMissedSessions(plan: PlanId) {
  if (!planHas(plan, "coordinator")) return [];
  const byPatient = new Map<string, { at: string; instructorId: string }[]>();
  for (const c of CLASSES) for (const e of c.enrolled) if (e.attendance === "absent") byPatient.set(e.patientId, [...(byPatient.get(e.patientId) ?? []), { at: c.start, instructorId: c.instructorId }]);
  return [...byPatient.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([patientId, list]) => ({ id: `ms-${patientId}`, patientId, absences: list.sort((a, b) => a.at.localeCompare(b.at)), ownerId: COORDINATOR }));
}
