import { FEATURE_GROUPS, FEATURES, PLANS, addedFeatures, monthlyCost, planById, type Billing, type FeatureGroup, type FeatureId, type Plan, type PlanId } from "@/data/plans";
import { DEMO_USER } from "@/data/staff";
import type { Role } from "@/data/types";
import { formatINR } from "@/lib/format";

/**
 * Server-safe pricing helpers (no "use client"): price lines, seat and cost maths, feature
 * grouping. Every figure is derived from @/data/plans — nothing is hard-coded here.
 * Model (spec "Plans overview"): a monthly price per practitioner (doctor, nutritionist, yoga
 * instructor), before GST; admin / reception seats free up to `freeSeats`, then `extraSeat` each;
 * a one-time onboarding fee. Each plan includes everything in the one before it.
 */

/** Roles billed per practitioner. Everyone else signs in on an admin / reception seat. */
export const PRACTITIONER_ROLES: Role[] = ["doctor", "nutritionist", "yoga"];
export const isPractitioner = (r: Role) => PRACTITIONER_ROLES.includes(r);

/** The spec's worked example: five practitioners, billed annually. */
export const EXAMPLE_PRACTITIONERS = 5;

export const MIN_PRACTITIONERS = 1;
export const MAX_PRACTITIONERS = 30;
export const MAX_STAFF_SEATS = 12;

export const BILLING_LABEL: Record<Billing, string> = { annual: "Billed annually", monthly: "Billed monthly" };

/** "₹999" + unit, kept apart so the number can be set large. */
export function priceParts(plan: Plan, billing: Billing = "annual") {
  return { amount: formatINR(plan.price[billing]), unit: "per practitioner / month" };
}

/** "₹999 / practitioner / month" */
export const monthlyLine = (plan: Plan, billing: Billing = "annual") => `${formatINR(plan.price[billing])} / practitioner / month`;

export const onboardingLine = (plan: Plan) => `${formatINR(plan.onboardingFee)} one-time onboarding`;

/** "2 free, then ₹300 each / month" */
export const seatsLine = (plan: Plan) => `${plan.freeSeats} free, then ${formatINR(plan.extraSeat)} each / month`;

export const branchesLabel = (plan: Plan) => (plan.branches === "unlimited" ? "Unlimited branches" : plan.branches === 1 ? "1 branch" : `${plan.branches} branches`);
export const branchesShort = (plan: Plan) => (plan.branches === "unlimited" ? "Unlimited" : String(plan.branches));
export const storageLabel = (plan: Plan) => `${plan.storageGb} GB`;

/** Seats charged beyond the free admin / reception seats. */
export const extraSeats = (plan: Plan, staffSeats: number) => Math.max(0, staffSeats - plan.freeSeats);

/** One plan's bill for a team: monthly, yearly (12 × monthly), one-time onboarding and the first year in total. */
export function planCost(plan: Plan, practitioners: number, staffSeats: number, billing: Billing) {
  const monthly = monthlyCost(plan, practitioners, staffSeats, billing);
  const yearly = monthly * 12;
  return {
    plan,
    monthly,
    yearly,
    practitionerPart: practitioners * plan.price[billing],
    extra: extraSeats(plan, staffSeats),
    seatPart: extraSeats(plan, staffSeats) * plan.extraSeat,
    onboarding: plan.onboardingFee,
    firstYear: yearly + plan.onboardingFee,
  };
}

export const costRows = (practitioners: number, staffSeats: number, billing: Billing) => PLANS.map((p) => planCost(p, practitioners, staffSeats, billing));

/** Features in FEATURE_GROUPS order, empty groups dropped. */
export function groupFeatures(ids: FeatureId[]) {
  return FEATURE_GROUPS.map((group) => ({ group, features: FEATURES.filter((f) => f.group === group && ids.includes(f.id)) })).filter((g) => g.features.length > 0);
}

/** What a plan card lists: everything for the base plan, otherwise only what the plan adds. */
export const cardFeatures = (plan: Plan) => groupFeatures(plan.includesPrevious ? addedFeatures(plan) : plan.features);

export const basePlanName = (plan: Plan) => (plan.includesPrevious ? planById(plan.includesPrevious).name : null);

export const roleLabel = (role: Role) => DEMO_USER[role].label;

/** Roles a plan adds over the plan it builds on (all roles for the base plan). */
export const addedRoles = (plan: Plan): Role[] => {
  const prev = plan.includesPrevious ? planById(plan.includesPrevious).roles : [];
  return plan.roles.filter((r) => !prev.includes(r));
};

/** Plans from `plan` upwards, e.g. Clinic → [Clinic, Pro]. */
export const plansFrom = (id: PlanId) => PLANS.slice(PLANS.findIndex((p) => p.id === id));

/** "Every plan" · "Clinic and Pro" · "Pro only" — where something first appears and upwards. */
export function availabilityLabel(first: Plan) {
  const from = plansFrom(first.id);
  if (from.length === PLANS.length) return "Every plan";
  if (from.length === 1) return `${first.name} only`;
  return from.map((p) => p.name).join(" and ");
}

/** The cheapest plan that carries every feature of a group (groups are built tier by tier). */
export const groupFirstPlan = (group: FeatureGroup) => {
  const ids = FEATURES.filter((f) => f.group === group).map((f) => f.id);
  return PLANS.find((p) => ids.some((id) => p.features.includes(id)))!;
};

export const planAnchor = (id: PlanId) => `plan-${id}`;
