import type { Role } from "./types";

/**
 * Commercial plans and the feature matrix — the single source of truth for the pricing page,
 * the sidebar, the workspace switcher and route gating inside the demo.
 * Prices are exactly as specified by the business (INR). Plan names are placeholders.
 */

export type PlanId = "starter" | "team" | "clinic";

export type FeatureId =
  // core records (all plans)
  | "patients" | "overview" | "notes" | "documents" | "calendar" | "tasks" | "billing"
  // multidisciplinary team (Team + Clinic)
  | "multi-role" | "queue" | "waitlist" | "referrals" | "care-plan" | "nutrition" | "classes" | "messages"
  // full clinic (Clinic only)
  | "portal" | "coordinator" | "packages" | "admin" | "access" | "branches" | "analytics";

export type FeatureGroup = "Patient records" | "Scheduling & front desk" | "Care team" | "Patient experience" | "Administration";

export const FEATURES: { id: FeatureId; label: string; description: string; group: FeatureGroup }[] = [
  { id: "patients", label: "Patient registry & profiles", description: "Registration, demographics, allergies, care team and duplicate checks.", group: "Patient records" },
  { id: "overview", label: "Patient overview & care timeline", description: "Body-system summary, connected care map and year timeline.", group: "Patient records" },
  { id: "notes", label: "Consultation notes", description: "Structured notes with drafts, signing and attributed addenda.", group: "Patient records" },
  { id: "documents", label: "Reports & document review", description: "Uploads that keep report date separate from upload date; review inbox.", group: "Patient records" },
  { id: "calendar", label: "Appointment calendar", description: "Day and week diary, booking, rescheduling and cancellations.", group: "Scheduling & front desk" },
  { id: "tasks", label: "Tasks & follow-ups", description: "Follow-ups with an owner, due date and status.", group: "Scheduling & front desk" },
  { id: "billing", label: "Invoices & payments", description: "Invoices, receipts and outstanding balances.", group: "Administration" },
  { id: "multi-role", label: "Role-based workspaces", description: "Separate homes for doctor, nutritionist, yoga instructor and front desk.", group: "Care team" },
  { id: "queue", label: "Front-desk queue & check-in", description: "Walk-ins, tokens, arrivals and checkout.", group: "Scheduling & front desk" },
  { id: "waitlist", label: "Waitlist", description: "Offer freed-up slots to waiting patients.", group: "Scheduling & front desk" },
  { id: "referrals", label: "Referrals & handoffs", description: "Requested → accepted → booked → completed → acknowledged.", group: "Care team" },
  { id: "care-plan", label: "Shared care plans", description: "One plan across medical, nutrition and movement.", group: "Care team" },
  { id: "nutrition", label: "Nutrition plan builder & food logs", description: "Meal plans with versions, alternatives and self-reported logs.", group: "Care team" },
  { id: "classes", label: "Yoga classes & attendance", description: "Rosters, precautions, attendance and escalation.", group: "Care team" },
  { id: "messages", label: "Secure messaging", description: "Care-team and patient conversations with response times.", group: "Care team" },
  { id: "portal", label: "Patient portal", description: "Patients see appointments, plans, records, invoices and messages.", group: "Patient experience" },
  { id: "coordinator", label: "Care coordinator workspace", description: "Stalled care, overdue follow-ups and programme progress.", group: "Patient experience" },
  { id: "packages", label: "Packages & session credits", description: "Programme packages and session balances.", group: "Administration" },
  { id: "admin", label: "Admin console", description: "Staff, services, schedules and templates.", group: "Administration" },
  { id: "access", label: "Access review & audit log", description: "Who can see what, plus an attributed activity history.", group: "Administration" },
  { id: "branches", label: "Multi-branch management", description: "Separate locations, rooms and staff memberships.", group: "Administration" },
  { id: "analytics", label: "Clinic operations dashboard", description: "Today's capacity, queues, intake gaps and collections.", group: "Administration" },
];

export const FEATURE_GROUPS: FeatureGroup[] = ["Patient records", "Scheduling & front desk", "Care team", "Patient experience", "Administration"];

const CORE: FeatureId[] = ["patients", "overview", "notes", "documents", "calendar", "tasks", "billing"];
const TEAM: FeatureId[] = [...CORE, "multi-role", "queue", "waitlist", "referrals", "care-plan", "nutrition", "classes", "messages"];
const CLINIC: FeatureId[] = [...TEAM, "portal", "coordinator", "packages", "admin", "access", "branches", "analytics"];

export type Pricing =
  | { kind: "flat"; monthly: number }
  | { kind: "per-user"; monthly: number; minUsers: number; maxUsers: number };

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  setupFee: number;
  pricing: Pricing;
  usersLabel: string;
  roles: Role[];
  features: FeatureId[];
  /** short "everything in X, plus" framing for the pricing cards */
  includesPrevious?: PlanId;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "A single practitioner getting their records and diary in one place.",
    setupFee: 20000,
    pricing: { kind: "flat", monthly: 2000 },
    usersLabel: "Flat monthly fee",
    roles: ["doctor"],
    features: CORE,
  },
  {
    id: "team",
    name: "Team",
    audience: "A small multidisciplinary team — doctor, nutritionist, yoga and front desk.",
    setupFee: 60000,
    pricing: { kind: "per-user", monthly: 2000, minUsers: 1, maxUsers: 5 },
    usersLabel: "1 – 5 users",
    roles: ["doctor", "nutritionist", "yoga", "frontdesk"],
    features: TEAM,
    includesPrevious: "starter",
  },
  {
    id: "clinic",
    name: "Clinic",
    audience: "A full clinic with coordination, a patient portal and administration.",
    setupFee: 60000,
    pricing: { kind: "per-user", monthly: 1800, minUsers: 5, maxUsers: 10 },
    usersLabel: "5 – 10 users",
    roles: ["doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "admin", "patient"],
    features: CLINIC,
    includesPrevious: "team",
  },
];

export const DEFAULT_PLAN: PlanId = "clinic";
export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!;
export const isPlanId = (v: string | undefined): v is PlanId => v === "starter" || v === "team" || v === "clinic";
export const planHas = (plan: PlanId, f: FeatureId) => planById(plan).features.includes(f);
export const featureById = (id: FeatureId) => FEATURES.find((f) => f.id === id)!;
/** Cheapest plan that includes a feature (for upgrade prompts). */
export const minPlanFor = (f: FeatureId) => PLANS.find((p) => p.features.includes(f))!;
/** Features a plan adds over the plan it builds on. */
export const addedFeatures = (plan: Plan) => {
  const prev = plan.includesPrevious ? planById(plan.includesPrevious).features : [];
  return plan.features.filter((f) => !prev.includes(f));
};

/** Monthly cost for a given user count, or null when the plan doesn't cover that many users. */
export function monthlyCost(plan: Plan, users: number): number | null {
  if (plan.pricing.kind === "flat") return plan.pricing.monthly;
  if (users < plan.pricing.minUsers || users > plan.pricing.maxUsers) return null;
  return plan.pricing.monthly * users;
}

/** Route → feature (longest prefix wins). Routes not listed are available on every plan. */
const ROUTE_FEATURES: [string, FeatureId][] = [
  ["/patients", "patients"],
  ["/schedule/queue", "queue"],
  ["/schedule/waitlist", "waitlist"],
  ["/schedule", "calendar"],
  ["/tasks", "tasks"],
  ["/documents", "documents"],
  ["/billing/packages", "packages"],
  ["/billing", "billing"],
  ["/referrals", "referrals"],
  ["/nutrition", "nutrition"],
  ["/classes", "classes"],
  ["/messages", "messages"],
  ["/team", "admin"],
  ["/settings/access", "access"],
  ["/settings/audit", "access"],
  ["/settings/templates", "admin"],
  ["/portal", "portal"],
];

export function featureForPath(pathname: string): FeatureId | null {
  let best: [string, FeatureId] | null = null;
  for (const entry of ROUTE_FEATURES) {
    if ((pathname === entry[0] || pathname.startsWith(`${entry[0]}/`)) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/** Which roles a plan allows; falls back to the plan's first role. */
export const effectiveRole = (plan: PlanId, role: Role): Role => (planById(plan).roles.includes(role) ? role : planById(plan).roles[0]);
