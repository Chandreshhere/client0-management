import { FEATURE_GROUPS, FEATURES, PLANS, addedFeatures, monthlyCost, planById, type FeatureId, type Plan, type PlanId } from "@/data/plans";
import { DEMO_USER } from "@/data/staff";
import type { Role } from "@/data/types";
import { formatINR } from "@/lib/format";

/**
 * Server-safe pricing helpers (no "use client"): price lines, first-year totals and feature
 * grouping. Every figure is derived from @/data/plans — nothing is hard-coded here.
 */

export const MIN_USERS = 1;
export const MAX_USERS = 10;

/** "₹2,000" + unit, kept apart so the number can be set large. */
export function priceParts(plan: Plan) {
  return {
    amount: formatINR(plan.pricing.monthly),
    unit: plan.pricing.kind === "flat" ? "per month" : "per user / month",
  };
}

export const monthlyLine = (plan: Plan) =>
  plan.pricing.kind === "flat" ? `${formatINR(plan.pricing.monthly)} / month` : `${formatINR(plan.pricing.monthly)} / user / month`;

export const setupLine = (plan: Plan) => `${formatINR(plan.setupFee)} one-time setup`;

/** Setup + 12 months, or null when the plan doesn't cover that many users. */
export function firstYearTotal(plan: Plan, users: number): number | null {
  const m = monthlyCost(plan, users);
  return m === null ? null : plan.setupFee + 12 * m;
}

/** Features in FEATURE_GROUPS order, empty groups dropped. */
export function groupFeatures(ids: FeatureId[]) {
  return FEATURE_GROUPS.map((group) => ({ group, features: FEATURES.filter((f) => f.group === group && ids.includes(f.id)) })).filter((g) => g.features.length > 0);
}

/** What a plan card lists: everything for the base plan, otherwise only what the plan adds. */
export const cardFeatures = (plan: Plan) => groupFeatures(plan.includesPrevious ? addedFeatures(plan) : plan.features);

export const basePlanName = (plan: Plan) => (plan.includesPrevious ? planById(plan.includesPrevious).name : null);

export const roleLabel = (role: Role) => DEMO_USER[role].label;

/** Plans covering a given user count, cheapest monthly first (Starter is flat, so it always covers). */
export function plansFor(users: number) {
  return PLANS.map((plan) => ({ plan, monthly: monthlyCost(plan, users), firstYear: firstYearTotal(plan, users) }));
}

export const planAnchor = (id: PlanId) => `plan-${id}`;
