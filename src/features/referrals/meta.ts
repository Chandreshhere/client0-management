import { ASSIGNMENT_RETURN_HOURS, assignmentState, type AssignmentState } from "@/data/care";
import { TODAY } from "@/lib/format";
import { byTime } from "@/features/tasks/time";
import type { CareReferral } from "./store";

/**
 * Assignment status (spec F5, rule 5): assigned → seen. An assignment nobody has opened within
 * 48 hours is "back with the doctor" — it leaves the recipient's pending list and returns to the
 * assigning doctor's (rule 2: one owner per pending item).
 */
export type AssignmentStatus = "new" | "back" | "seen";

export interface AssignmentInfo {
  state: AssignmentState;
  status: AssignmentStatus;
  /** hours since it was assigned (or reassigned) */
  hours: number;
  /** when it returns (or returned) to the doctor */
  returnsAt: string;
  /** who owns the pending item right now — null once seen */
  ownerId: string | null;
}

export function assignmentInfo(r: CareReferral): AssignmentInfo {
  const state = assignmentState(r);
  const hours = (TODAY.getTime() - Date.parse(r.requestedAt)) / 3_600_000;
  const returnsAt = new Date(Date.parse(r.requestedAt) + ASSIGNMENT_RETURN_HOURS * 3_600_000).toISOString();
  const status: AssignmentStatus = state === "seen" ? "seen" : hours >= ASSIGNMENT_RETURN_HOURS ? "back" : "new";
  return { state, status, hours, returnsAt, ownerId: status === "seen" ? null : status === "back" ? r.fromId : r.toId };
}

const RANK: Record<AssignmentStatus, number> = { back: 0, new: 1, seen: 2 };

/** Not seen in 48 h first, then waiting (oldest first), then seen (most recent first). */
export function byStatus(a: CareReferral, b: CareReferral) {
  const ia = assignmentInfo(a);
  const ib = assignmentInfo(b);
  if (ia.status !== ib.status) return RANK[ia.status] - RANK[ib.status];
  return ia.status === "seen" ? byTime(b.seenAt ?? b.requestedAt, a.seenAt ?? a.requestedAt) : byTime(a.requestedAt, b.requestedAt);
}

/** "3 h" · "2 days" — how long something has waited. */
export function ageText(hours: number) {
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

/** Hours left before an unseen assignment goes back to the doctor ("in 3 h"). */
export const hoursLeft = (info: AssignmentInfo) => Math.max(0, Math.ceil(ASSIGNMENT_RETURN_HOURS - info.hours));

export const DISCIPLINE_WORD: Record<string, string> = { nutrition: "Nutrition", movement: "Yoga", medical: "Medical", operations: "Operations" };
