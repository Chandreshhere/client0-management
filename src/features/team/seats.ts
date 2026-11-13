import { STAFF } from "@/data/staff";
import { PLANS, planById, type PlanId } from "@/data/plans";
import type { Invite } from "./store";

/**
 * Seats = active staff accounts (deactivated ones free their seat). Plan ranges come from the
 * shared plan matrix: Starter is a flat single-practitioner workspace, Team covers 1–5 users,
 * Clinic 5–10. Over the range, new invites are kept as "needs a seat" — never sent.
 */
export interface SeatInfo {
  planName: string;
  flat: boolean;
  min: number;
  max: number;
  active: number;
  ready: number;
  waiting: number;
  free: number;
  over: number;
}

export function seatInfo(plan: PlanId, deactivated: Record<string, string>, invites: Invite[]): SeatInfo {
  const p = planById(plan);
  const active = STAFF.filter((s) => !deactivated[s.id]).length;
  const ready = invites.filter((i) => i.status === "ready").length;
  const waiting = invites.length - ready;
  const flat = p.pricing.kind === "flat";
  const min = p.pricing.kind === "per-user" ? p.pricing.minUsers : 1;
  const max = p.pricing.kind === "per-user" ? p.pricing.maxUsers : 1;
  const used = active + ready;
  return {
    planName: p.name,
    flat,
    min,
    max,
    active,
    ready,
    waiting,
    free: Math.max(0, max - used),
    over: Math.max(0, active - max),
  };
}

/** Plan ranges for the comparison inside the invite modal. */
export const PLAN_RANGES = PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  range: p.pricing.kind === "per-user" ? `${p.pricing.minUsers}–${p.pricing.maxUsers} users` : "1 practitioner",
  max: p.pricing.kind === "per-user" ? p.pricing.maxUsers : 1,
}));
