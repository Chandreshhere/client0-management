import { STAFF } from "@/data/staff";
import { PLANS, monthlyCost, planById, type PlanId } from "@/data/plans";
import type { Role } from "@/data/types";
import { formatINR } from "@/lib/format";
import type { StaffRole } from "./data";
import type { Invite } from "./store";

/**
 * Seats under the plan model (spec "Plans overview"): practitioners — doctors, nutritionists and
 * yoga instructors — are billed each, so they never run out of seats; admin / reception seats
 * (admin, reception, care coordinator) are free up to the plan's `freeSeats`, then `extraSeat` a
 * month each. Deactivated accounts free their seat. Draft invites count once they are ready.
 */
export const PRACTITIONER_ROLES: StaffRole[] = ["doctor", "nutritionist", "yoga"];
export const isPractitionerRole = (r: Role) => (PRACTITIONER_ROLES as Role[]).includes(r);

/** Roles staff can be invited into on a plan (patients get the app from their own record). */
export const invitableRoles = (plan: PlanId): StaffRole[] => planById(plan).roles.filter((r): r is StaffRole => r !== "patient");

export interface SeatInfo {
  planName: string;
  /** active practitioner accounts + ready practitioner invites (billed each) */
  practitioners: number;
  /** active admin / reception / coordinator accounts + ready invites for those roles */
  staff: number;
  freeSeats: number;
  extraSeat: number;
  /** admin / reception seats beyond the free ones (each billed `extraSeat`) */
  paidSeats: number;
  /** free admin / reception seats still open */
  freeLeft: number;
  pricePerPractitioner: number;
  /** current monthly bill at annual rates, before GST */
  monthly: number;
  active: number;
  ready: number;
  waiting: number;
  /** @deprecated seat caps no longer exist (practitioners are billed each); kept so older callers compile. */
  flat: boolean;
  /** @deprecated see `flat` */
  min: number;
  /** @deprecated seats usable without an extra-seat charge: practitioners + the larger of staff and free seats */
  max: number;
  /** @deprecated always the free admin / reception seats left */
  free: number;
  /** @deprecated nothing is ever over a cap now */
  over: number;
}

export function seatInfo(plan: PlanId, deactivated: Record<string, string>, invites: Invite[]): SeatInfo {
  const p = planById(plan);
  const activeStaff = STAFF.filter((s) => !deactivated[s.id]);
  const readyInvites = invites.filter((i) => i.status === "ready");
  const roles: Role[] = [...activeStaff.map((s) => s.role), ...readyInvites.map((i) => i.role)];
  const practitioners = roles.filter(isPractitionerRole).length;
  const staff = roles.length - practitioners;
  const paidSeats = Math.max(0, staff - p.freeSeats);
  const freeLeft = Math.max(0, p.freeSeats - staff);
  return {
    planName: p.name,
    practitioners,
    staff,
    freeSeats: p.freeSeats,
    extraSeat: p.extraSeat,
    paidSeats,
    freeLeft,
    pricePerPractitioner: p.price.annual,
    monthly: monthlyCost(p, practitioners, staff),
    active: activeStaff.length,
    ready: readyInvites.length,
    waiting: invites.length - readyInvites.length,
    flat: false,
    min: 0,
    max: practitioners + Math.max(staff, p.freeSeats),
    free: freeLeft,
    over: 0,
  };
}

/** What adding one person in `role` does to the bill on `plan`, given the current seats. */
export function inviteCost(plan: PlanId, role: StaffRole, seats: SeatInfo): { amount: number; text: string } {
  const p = planById(plan);
  if (isPractitionerRole(role)) return { amount: p.price.annual, text: `Adds ${formatINR(p.price.annual)} a month — practitioners are billed each on ${p.name}.` };
  if (seats.freeLeft > 0) return { amount: 0, text: `Uses one of the ${seats.freeLeft} free admin / reception ${seats.freeLeft === 1 ? "seat" : "seats"} left on ${p.name}.` };
  return { amount: p.extraSeat, text: `Adds ${formatINR(p.extraSeat)} a month — ${p.name} includes ${p.freeSeats} admin / reception seats free.` };
}

/** Seat rules per plan, for the comparison inside the invite modal and the team page. */
export const PLAN_RANGES = PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  range: `${p.freeSeats} seats free`,
  detail: `${formatINR(p.price.annual)} / practitioner`,
  /** @deprecated seat caps no longer exist */
  max: p.freeSeats,
}));
