import type { Role } from "./types";

/**
 * Commercial plans, the feature matrix and add-ons — the single source of truth for the pricing
 * page, the demo logins, the sidebar and every feature gate inside the demo.
 * Source: "Carelane — Feature & Flow Spec" (14 Nov 2026). Three plans split by what the clinic does
 * with Carelane, each including everything in the one before it:
 *   Core   — one shared patient record (Doctor, Nutritionist, Yoga instructor, Admin)
 *   Clinic — runs the front office too (+ Reception)
 *   Pro    — patients join the care team (+ Care coordinator, Patient)
 * Rules: a plan sells only what works in that plan; the demo shows only what the plan includes;
 * add-ons appear as add-ons, never as working features; compliance (consent, the activity log,
 * access rules) is in every plan.
 */

export type PlanId = "core" | "clinic" | "pro";

export type FeatureId =
  // Core — the shared record (F1–F9)
  | "patients" // registration, clinic ID, duplicate check, consent, global search, care team
  | "overview" // the patient profile: Summary · Medical · Reports · Nutrition · Yoga + Timeline
  | "notes" // consultation notes draft → signed, addenda
  | "prescriptions" // prescription / visit summary on letterhead
  | "documents" // report upload (date issued vs uploaded) and review
  | "referrals" // assignments to nutrition / yoga: assigned → seen
  | "care-plan" // doctor's precautions and nutrition guidance
  | "nutrition" // assessment, plan builder, versions, plan PDF, follow-up entries
  | "classes" // yoga: precautions + acknowledgement, session log, attendance, progress notes
  | "flags" // flag a concern to the doctor
  | "tasks" // each role's pending items and follow-ups
  | "admin" // staff and roles, clinic profile, templates
  | "access" // access rules (compliance — every plan)
  | "audit" // activity log (compliance — every plan)
  | "export" // full patient record as a PDF
  // Clinic — the front office (F10–F12)
  | "calendar" // day/week calendar, book / reschedule / cancel, no-shows
  | "group-classes" // recurring group yoga classes with capacity and a class list
  | "waitlist"
  | "queue" // check-in, walk-ins, checkout
  | "billing" // service & fee list, invoices, record a payment, daily collections
  | "packages" // session packages, credits, balance alerts
  | "reports" // appointments, collections, package reports
  // Pro — patients join the care team (F13–F16)
  | "portal" // patient app
  | "release" // release signed records to the patient
  | "self-report" // food logs and home readings
  | "messages" // patient ↔ care team messaging
  | "coordinator" // stalled-care list, contact log, reassign
  | "programmes"
  | "branches"
  | "analytics";

export type FeatureGroup = "Shared patient record" | "Front office" | "Patients & programmes" | "Compliance";

export const FEATURES: { id: FeatureId; label: string; description: string; group: FeatureGroup }[] = [
  { id: "patients", label: "Patients & global search", description: "Register with consent and a duplicate check by phone; find anyone by ID, phone or name.", group: "Shared patient record" },
  { id: "overview", label: "Five-section patient profile", description: "Summary, Medical, Reports, Nutrition and Yoga, plus one dated timeline.", group: "Shared patient record" },
  { id: "notes", label: "Consultation notes", description: "Structured notes, draft → signed, with dated addenda.", group: "Shared patient record" },
  { id: "prescriptions", label: "Prescription & visit summary", description: "Printable on the clinic letterhead.", group: "Shared patient record" },
  { id: "documents", label: "Reports & review", description: "Uploads keep the date issued separate from the upload date; the primary doctor reviews.", group: "Shared patient record" },
  { id: "referrals", label: "Assignments", description: "Doctor assigns to nutrition or yoga with goals: assigned → seen.", group: "Shared patient record" },
  { id: "care-plan", label: "Precautions & guidance", description: "Doctor's yoga precautions and nutrition targets beside each plan.", group: "Shared patient record" },
  { id: "nutrition", label: "Nutrition plans", description: "Assessment, plan builder, versions with reasons, plan PDF, follow-ups.", group: "Shared patient record" },
  { id: "classes", label: "Yoga sessions & attendance", description: "Acknowledge precautions, log 1:1 or group sessions, attendance, progress notes.", group: "Shared patient record" },
  { id: "flags", label: "Flag to doctor", description: "Nutritionists and instructors raise a concern with urgency.", group: "Shared patient record" },
  { id: "tasks", label: "Pending items & follow-ups", description: "Every item has one owner; only the owner sees it in their list.", group: "Shared patient record" },
  { id: "admin", label: "Staff, roles & clinic profile", description: "Add staff, assign roles, letterhead, working hours, templates.", group: "Shared patient record" },
  { id: "export", label: "Full record export", description: "A patient's complete record as a PDF.", group: "Shared patient record" },
  { id: "access", label: "Access rules", description: "Role and care-team access; time-limited grants by the doctor.", group: "Compliance" },
  { id: "audit", label: "Activity log", description: "Who did what, when, to which record.", group: "Compliance" },
  { id: "calendar", label: "Appointments & calendar", description: "Day and week view per practitioner and room; book, reschedule, cancel, no-shows.", group: "Front office" },
  { id: "group-classes", label: "Recurring group classes", description: "Weekly yoga classes with capacity and a class list.", group: "Front office" },
  { id: "waitlist", label: "Waitlist", description: "Offer a freed slot or class place to waiting patients.", group: "Front office" },
  { id: "queue", label: "Check-in & checkout", description: "Arrived → waiting → with practitioner → checkout; walk-ins.", group: "Front office" },
  { id: "billing", label: "Billing", description: "Service and fee list, GST-ready invoices, payments recorded manually, daily collections.", group: "Front office" },
  { id: "packages", label: "Session packages", description: "Credits used when attendance is marked; low-balance and expiry alerts.", group: "Front office" },
  { id: "reports", label: "Front-office reports", description: "Appointments, no-shows, collections, dues and package use.", group: "Front office" },
  { id: "portal", label: "Patient app", description: "Appointments, my plan, released records, invoices, caregiver access.", group: "Patients & programmes" },
  { id: "release", label: "Release to patient", description: "Signing and releasing are separate steps.", group: "Patients & programmes" },
  { id: "self-report", label: "Food logs & home readings", description: "Patients log meals, BP, sugar, weight — self-reported until reviewed.", group: "Patients & programmes" },
  { id: "messages", label: "Patient messaging", description: "Secure messages to the care team with a target response time.", group: "Patients & programmes" },
  { id: "coordinator", label: "Care coordination", description: "Stalled-care list, contact log, reassign when someone is away.", group: "Patients & programmes" },
  { id: "programmes", label: "Programmes", description: "Templates, enrolment, milestones and a completion summary.", group: "Patients & programmes" },
  { id: "branches", label: "Multiple branches", description: "Branches, rooms and staff per branch.", group: "Patients & programmes" },
  { id: "analytics", label: "Analytics", description: "Retention, attendance, adherence, programme completion, revenue by discipline.", group: "Patients & programmes" },
];

export const FEATURE_GROUPS: FeatureGroup[] = ["Shared patient record", "Compliance", "Front office", "Patients & programmes"];

const CORE: FeatureId[] = ["patients", "overview", "notes", "prescriptions", "documents", "referrals", "care-plan", "nutrition", "classes", "flags", "tasks", "admin", "export", "access", "audit"];
const CLINIC: FeatureId[] = [...CORE, "calendar", "group-classes", "waitlist", "queue", "billing", "packages", "reports"];
const PRO: FeatureId[] = [...CLINIC, "portal", "release", "self-report", "messages", "coordinator", "programmes", "branches", "analytics"];

/** Price per practitioner (doctor, nutritionist, instructor) per month, before GST. */
export interface Pricing {
  annual: number;
  monthly: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  positioning: string;
  audience: string;
  price: Pricing;
  /** admin / reception seats included free; each extra seat costs `extraSeat` per month */
  freeSeats: number;
  extraSeat: number;
  onboardingFee: number;
  branches: number | "unlimited";
  storageGb: number;
  roles: Role[];
  rolesAdded: string;
  features: FeatureId[];
  /** "everything in X, plus" framing */
  includesPrevious?: PlanId;
}

export const PLANS: Plan[] = [
  {
    id: "core",
    name: "Core",
    positioning: "One shared patient record",
    audience: "Doctors, nutritionists and yoga instructors sharing one record per patient.",
    price: { annual: 999, monthly: 1199 },
    freeSeats: 2,
    extraSeat: 300,
    onboardingFee: 15000,
    branches: 1,
    storageGb: 20,
    roles: ["doctor", "nutritionist", "yoga", "admin"],
    rolesAdded: "Doctor, Nutritionist, Yoga instructor, Admin",
    features: CORE,
  },
  {
    id: "clinic",
    name: "Clinic",
    positioning: "Run the front office too",
    audience: "Appointments, check-in, billing and session packages, with a reception desk.",
    price: { annual: 1499, monthly: 1799 },
    freeSeats: 3,
    extraSeat: 300,
    onboardingFee: 25000,
    branches: 1,
    storageGb: 50,
    roles: ["doctor", "nutritionist", "yoga", "admin", "frontdesk"],
    rolesAdded: "+ Reception",
    features: CLINIC,
    includesPrevious: "core",
  },
  {
    id: "pro",
    name: "Pro",
    positioning: "Patients join the care team",
    audience: "A patient app, care coordination, programmes and multiple branches.",
    price: { annual: 1999, monthly: 2399 },
    freeSeats: 5,
    extraSeat: 300,
    onboardingFee: 40000,
    branches: "unlimited",
    storageGb: 100,
    roles: ["doctor", "nutritionist", "yoga", "admin", "frontdesk", "coordinator", "patient"],
    rolesAdded: "+ Care coordinator, Patient",
    features: PRO,
    includesPrevious: "clinic",
  },
];

export type AddOnId = "messaging" | "payments" | "storage" | "labs" | "abdm" | "telehealth";

/** Add-ons (any plan). The demo shows them as add-ons — never as working features. */
export const ADDONS: { id: AddOnId; label: string; description: string; basis: string }[] = [
  { id: "messaging", label: "WhatsApp / SMS", description: "Appointment reminders, form links, plan sharing.", basis: "Message packs" },
  { id: "payments", label: "Payment gateway", description: "Online payments and confirmed UPI.", basis: "Per-transaction fee" },
  { id: "storage", label: "Extra storage", description: "Beyond the plan's limit.", basis: "Per 20 GB" },
  { id: "labs", label: "Lab integrations", description: "Reports arrive from partner labs automatically.", basis: "Per integration" },
  { id: "abdm", label: "ABDM", description: "Consent-based record sharing via ABHA.", basis: "Per clinic" },
  { id: "telehealth", label: "Teleconsultation", description: "Video visits.", basis: "Per minute or per pack" },
];
export const addOnById = (id: AddOnId) => ADDONS.find((a) => a.id === id)!;

export const DEFAULT_PLAN: PlanId = "pro";
export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!;
export const isPlanId = (v: string | undefined): v is PlanId => v === "core" || v === "clinic" || v === "pro";
export const planHas = (plan: PlanId, f: FeatureId) => planById(plan).features.includes(f);
export const featureById = (id: FeatureId) => FEATURES.find((f) => f.id === id)!;
/** Cheapest plan that includes a feature (for upgrade prompts). */
export const minPlanFor = (f: FeatureId) => PLANS.find((p) => p.features.includes(f))!;
/** Cheapest plan that includes a role. */
export const minPlanForRole = (r: Role) => PLANS.find((p) => p.roles.includes(r))!;
/** Features a plan adds over the plan it builds on. */
export const addedFeatures = (plan: Plan) => {
  const prev = plan.includesPrevious ? planById(plan.includesPrevious).features : [];
  return plan.features.filter((f) => !prev.includes(f));
};

export type Billing = "annual" | "monthly";

/** Monthly cost: practitioners × the per-practitioner price, plus admin/reception seats beyond the free ones. */
export function monthlyCost(plan: Plan, practitioners: number, staffSeats = 0, billing: Billing = "annual"): number {
  return practitioners * plan.price[billing] + Math.max(0, staffSeats - plan.freeSeats) * plan.extraSeat;
}
/** Yearly cost (12 × monthly). Spec example, 5 practitioners billed annually: Core ₹59,940 · Clinic ₹89,940 · Pro ₹1,19,940. */
export const yearlyCost = (plan: Plan, practitioners: number, staffSeats = 0, billing: Billing = "annual") => 12 * monthlyCost(plan, practitioners, staffSeats, billing);

/** "₹999 / practitioner / month, billed annually" */
export const priceLabel = (plan: Plan, billing: Billing = "annual") => `₹${plan.price[billing].toLocaleString("en-IN")} / practitioner / month${billing === "annual" ? ", billed annually" : ", billed monthly"}`;

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
  ["/nutrition/logs", "self-report"],
  ["/nutrition", "nutrition"],
  ["/classes", "classes"],
  ["/messages", "messages"],
  ["/team", "admin"],
  ["/settings/services", "billing"],
  ["/settings/access", "access"],
  ["/settings/audit", "audit"],
  ["/settings/templates", "admin"],
  ["/portal", "portal"],
  ["/programmes", "programmes"],
  ["/reports", "reports"],
];

export function featureForPath(pathname: string): FeatureId | null {
  let best: [string, FeatureId] | null = null;
  for (const entry of ROUTE_FEATURES) {
    if ((pathname === entry[0] || pathname.startsWith(`${entry[0]}/`)) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/** Which roles a plan allows; falls back to the plan's first role (Doctor). */
export const effectiveRole = (plan: PlanId, role: Role): Role => (planById(plan).roles.includes(role) ? role : planById(plan).roles[0]);
