import { useMemo } from "react";
import type { Discipline, Referral } from "@/data/types";
import { ASSIGNMENT_RETURN_HOURS, REFERRALS } from "@/data/care";
import { createSessionStore, localId, useSessionStore } from "@/features/tasks/session-store";
import { NOW_ISO } from "@/features/tasks/time";
import { ASSIGNMENT_EXTRAS } from "./data";

/**
 * Assignments (spec F5) = the shared REFERRALS fixtures + changes made in this browser session.
 * Two states only: assigned → seen. "Seen" is stored as the fixture's stage moving past
 * "requested" (see `assignmentState` in src/data/care.ts), so every screen reads it the same way.
 */
export interface CareReferral extends Referral {
  goals: string;
  /** nutrition guidance or yoga precautions */
  guidance: string;
  seenAt?: string;
  seenBy?: string;
  remindedAt?: string;
  /** set when the doctor or a coordinator moved it to someone else */
  reassigned?: { fromId: string; at: string; by: string };
  local?: boolean;
}

interface AssignmentState {
  created: CareReferral[];
  patches: Record<string, Partial<CareReferral>>;
}

const SEED: AssignmentState = { created: [], patches: {} };
export const referralStore = createSessionStore<AssignmentState>("carelane.care.assignments.v2", SEED);

const BASE: CareReferral[] = REFERRALS.map((r) => {
  const x = ASSIGNMENT_EXTRAS[r.id];
  const seen = r.stage !== "requested";
  return {
    ...r,
    goals: x?.goals ?? r.reason,
    guidance: x?.guidance ?? "",
    seenAt: seen ? (r.stageDates.accepted ?? r.stageDates[r.stage]) : undefined,
    seenBy: seen ? (x?.seenBy ?? r.toId) : undefined,
  };
});

export function useReferrals(): CareReferral[] {
  const s = useSessionStore(referralStore);
  return useMemo(() => [...s.created, ...BASE].map((r) => (s.patches[r.id] ? { ...r, ...s.patches[r.id], stageDates: { ...r.stageDates, ...s.patches[r.id].stageDates } } : r)), [s]);
}

const patch = (id: string, p: Partial<CareReferral>) => referralStore.update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], ...p } } }));

/** The recipient opened it → seen. Opening it again changes nothing. */
export function markSeen(r: CareReferral, userId: string) {
  // Check the live session state too, so a repeat open (or a stale copy) never re-stamps it.
  if (r.stage !== "requested" || userId !== r.toId || referralStore.get().patches[r.id]?.seenAt) return false;
  patch(r.id, { stage: "accepted", stageDates: { accepted: NOW_ISO }, seenAt: NOW_ISO, seenBy: userId });
  return true;
}

export function remind(r: CareReferral) {
  patch(r.id, { remindedAt: NOW_ISO });
}

/** Move an unseen assignment to someone else; the 48-hour window starts again. */
export function reassign(r: CareReferral, toId: string, byId: string) {
  patch(r.id, { toId, stage: "requested", requestedAt: NOW_ISO, stageDates: { requested: NOW_ISO }, seenAt: undefined, seenBy: undefined, remindedAt: undefined, reassigned: { fromId: r.toId, at: NOW_ISO, by: byId } });
}

export function createAssignment(input: { patientId: string; fromId: string; toId: string; toDiscipline: Discipline; goals: string; guidance: string }): CareReferral {
  const r: CareReferral = {
    id: localId("asg"),
    patientId: input.patientId,
    fromId: input.fromId,
    toId: input.toId,
    toDiscipline: input.toDiscipline,
    reason: input.goals,
    goals: input.goals,
    guidance: input.guidance,
    stage: "requested",
    requestedAt: NOW_ISO,
    stageDates: { requested: NOW_ISO },
    dueBy: new Date(Date.parse(NOW_ISO) + ASSIGNMENT_RETURN_HOURS * 3_600_000).toISOString(),
    priority: "normal",
    local: true,
  };
  referralStore.update((s) => ({ ...s, created: [r, ...s.created] }));
  return r;
}
