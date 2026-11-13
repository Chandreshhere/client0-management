import type { Role } from "@/data/types";
import { BRANCHES, CLINIC, DEMO_USER, staffById } from "@/data/staff";
import { monthlyCost, planById, type Plan, type PlanId } from "@/data/plans";

/**
 * Onboarding wizard model: data shape, defaults, per-step validation, derived costs and
 * sessionStorage persistence. Pure TypeScript (no React) so it can be unit-tested and shared
 * with the sign-up form, which seeds it.
 */

export type Speciality = "medical" | "nutrition" | "yoga";
export type StaffRole = Exclude<Role, "patient">;
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const SPECIALITIES: { id: Speciality; label: string; detail: string; color: string }[] = [
  { id: "medical", label: "Medical", detail: "Doctor consultations, notes and prescriptions", color: "var(--color-medical)" },
  { id: "nutrition", label: "Nutrition", detail: "Assessments, meal plans and food logs", color: "var(--color-nutrition)" },
  { id: "yoga", label: "Yoga", detail: "Classes, 1:1 sessions and attendance", color: "var(--color-movement)" },
];
export const specialityLabel = (s: Speciality) => SPECIALITIES.find((x) => x.id === s)?.label ?? s;

export const WEEKDAYS: { id: Weekday; short: string; label: string }[] = [
  { id: "mon", short: "Mon", label: "Monday" },
  { id: "tue", short: "Tue", label: "Tuesday" },
  { id: "wed", short: "Wed", label: "Wednesday" },
  { id: "thu", short: "Thu", label: "Thursday" },
  { id: "fri", short: "Fri", label: "Friday" },
  { id: "sat", short: "Sat", label: "Saturday" },
  { id: "sun", short: "Sun", label: "Sunday" },
];

export const CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Kochi", "Jaipur", "Chandigarh", "Other city"];
export const DURATIONS = [15, 20, 30, 45, 60, 90];
export const MAX_BRANCHES = 5;
export const MAX_USERS = 10;

export const STEPS = [
  { id: "clinic", label: "Clinic", title: "Tell us about your clinic", description: "The basics we use to suggest services, plans and hours." },
  { id: "plan", label: "Plan", title: "Choose a plan", description: "Exact prices. No payment is taken in this prototype." },
  { id: "services", label: "Services", title: "Services you offer", description: "Suggested from your specialities. Edit names, durations and fees." },
  { id: "team", label: "Team", title: "Invite your team", description: "Who will work in Carelane, and in which workspace." },
  { id: "hours", label: "Hours", title: "Working hours", description: "Opening days and times for each branch, including lunch." },
  { id: "review", label: "Review", title: "Review and finish", description: "Check everything once. You can edit any section." },
] as const;
export type StepId = (typeof STEPS)[number]["id"];
export const LAST_STEP = STEPS.length - 1;

export interface ServiceRow {
  id: string;
  name: string;
  speciality: Speciality;
  duration: number;
  /** kept as typed text so the field can be edited freely; validated as whole rupees */
  fee: string;
}

export interface InviteRow {
  id: string;
  name: string;
  email: string;
  role: StaffRole | "";
}

export interface BranchHours {
  id: string;
  name: string;
  days: Weekday[];
  open: string;
  close: string;
  lunch: boolean;
  lunchStart: string;
  lunchEnd: string;
}

export interface OnboardingData {
  clinic: { name: string; city: string; branches: number; specialities: Speciality[] };
  plan: { id: PlanId; users: number };
  services: ServiceRow[];
  /** true once the person edits services; until then suggestions follow the specialities */
  servicesEdited: boolean;
  owner: { name: string; email: string };
  invites: InviteRow[];
  hours: BranchHours[];
}

export interface Progress {
  v: 1;
  step: number;
  /** furthest step visited — the rail lets you jump back to anything up to here */
  reached: number;
  data: OnboardingData;
}

export type Errors = Record<string, string>;

/* ------------------------------------------------------------------ ids */

let seq = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ------------------------------------------------------------- defaults */

const SERVICE_SUGGESTIONS: Record<Speciality, { name: string; duration: number; fee: number }[]> = {
  medical: [
    { name: "New consultation", duration: 30, fee: 1200 },
    { name: "Follow-up consultation", duration: 15, fee: 700 },
  ],
  nutrition: [
    { name: "Nutrition assessment", duration: 45, fee: 1500 },
    { name: "Diet plan review", duration: 30, fee: 800 },
  ],
  yoga: [
    { name: "Therapeutic yoga · 1:1", duration: 60, fee: 1200 },
    { name: "Group yoga class", duration: 60, fee: 400 },
  ],
};

export function suggestedServices(specialities: Speciality[]): ServiceRow[] {
  return SPECIALITIES.filter((s) => specialities.includes(s.id)).flatMap((s) =>
    SERVICE_SUGGESTIONS[s.id].map((x) => ({ id: uid("svc"), name: x.name, speciality: s.id, duration: x.duration, fee: String(x.fee) })),
  );
}

export function blankService(speciality: Speciality): ServiceRow {
  return { id: uid("svc"), name: "", speciality, duration: 30, fee: "" };
}

export function defaultHours(index: number, from?: BranchHours): BranchHours {
  return {
    id: uid("br"),
    name: index === 0 ? "Main branch" : `Branch ${index + 1}`,
    days: from ? [...from.days] : ["mon", "tue", "wed", "thu", "fri", "sat"],
    open: from?.open ?? "09:00",
    close: from?.close ?? "19:00",
    lunch: from?.lunch ?? true,
    lunchStart: from?.lunchStart ?? "13:00",
    lunchEnd: from?.lunchEnd ?? "14:00",
  };
}

export function freshData(): OnboardingData {
  return {
    clinic: { name: "", city: "", branches: 1, specialities: [] },
    plan: { id: "team", users: 4 },
    services: [],
    servicesEdited: false,
    owner: { name: "", email: "" },
    invites: [],
    hours: [defaultHours(0)],
  };
}

export const freshProgress = (): Progress => ({ v: 1, step: 0, reached: 0, data: freshData() });

/* ------------------------------------------------------------ updaters */

/** Branch count drives the number of hour blocks; new branches copy the first branch's hours. */
export function withBranches(d: OnboardingData, count: number): OnboardingData {
  const n = Math.max(1, Math.min(MAX_BRANCHES, count));
  let hours = d.hours.slice(0, n);
  while (hours.length < n) hours = [...hours, defaultHours(hours.length, hours[0])];
  return { ...d, clinic: { ...d.clinic, branches: n }, hours };
}

/** Specialities change: suggestions follow until the person has edited the service list. */
export function withSpecialities(d: OnboardingData, specialities: Speciality[]): OnboardingData {
  const ordered = SPECIALITIES.map((s) => s.id).filter((s) => specialities.includes(s));
  return {
    ...d,
    clinic: { ...d.clinic, specialities: ordered },
    services: d.servicesEdited ? d.services : suggestedServices(ordered),
  };
}

/** "Use sample clinic": the synthetic Prana clinic from the shared fixtures. */
export function withSample(d: OnboardingData): OnboardingData {
  const owner = staffById(DEMO_USER.doctor.personId);
  let next = withSpecialities({ ...d, clinic: { ...d.clinic, name: CLINIC.name, city: BRANCHES[0].city } }, ["medical", "nutrition", "yoga"]);
  next = withBranches(next, BRANCHES.length);
  next = { ...next, hours: next.hours.map((h, i) => ({ ...h, name: BRANCHES[i]?.name ?? h.name })) };
  if (!next.owner.name.trim() && owner) next = { ...next, owner: { name: owner.name, email: owner.email } };
  return next;
}

/* -------------------------------------------------------- derived values */

export function planCosts(d: OnboardingData) {
  const plan = planById(d.plan.id);
  const monthly = monthlyCost(plan, d.plan.users);
  return { plan, monthly, setup: plan.setupFee, firstYear: monthly === null ? null : plan.setupFee + monthly * 12 };
}

/** "Clinic covers 5–10 users" */
export function userRangeText(plan: Plan) {
  return plan.pricing.kind === "flat" ? `${plan.name} is a single-practitioner workspace` : `${plan.name} covers ${plan.pricing.minUsers}–${plan.pricing.maxUsers} users`;
}

/** Seats the person bought on the Plan step (clamped into the plan's range). */
export function seatLimit(d: OnboardingData) {
  const plan = planById(d.plan.id);
  if (plan.pricing.kind === "flat") return 1;
  return Math.max(plan.pricing.minUsers, Math.min(plan.pricing.maxUsers, d.plan.users));
}

/** Roles staff can be invited into on a plan (patients get portal access from their record). */
export const invitableRoles = (planId: PlanId): StaffRole[] => planById(planId).roles.filter((r): r is StaffRole => r !== "patient");

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/** ["mon","tue","wed"] → "Mon–Wed"; ["mon","wed"] → "Mon, Wed" */
export function formatDays(days: Weekday[]) {
  const idx = WEEKDAYS.map((w) => w.id).filter((d) => days.includes(d)).map((d) => WEEKDAYS.findIndex((w) => w.id === d));
  if (!idx.length) return "No days";
  const runs: number[][] = [];
  for (const i of idx) {
    const last = runs[runs.length - 1];
    if (last && i === last[last.length - 1] + 1) last.push(i);
    else runs.push([i]);
  }
  return runs.map((r) => (r.length >= 3 ? `${WEEKDAYS[r[0]].short}–${WEEKDAYS[r[r.length - 1]].short}` : r.map((i) => WEEKDAYS[i].short).join(", "))).join(", ");
}

/* ------------------------------------------------------------ validation */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function validateClinic(d: OnboardingData): Errors {
  const e: Errors = {};
  if (!d.clinic.name.trim()) e["clinic.name"] = "Enter your clinic's name.";
  if (!d.clinic.city) e["clinic.city"] = "Choose the city you practise in.";
  if (!d.clinic.specialities.length) e["clinic.specialities"] = "Pick at least one speciality.";
  return e;
}

export function validatePlan(d: OnboardingData): Errors {
  const e: Errors = {};
  const plan = planById(d.plan.id);
  if (plan.pricing.kind === "per-user" && monthlyCost(plan, d.plan.users) === null) {
    e["plan.users"] = `${userRangeText(plan)}. You chose ${d.plan.users}.`;
  }
  return e;
}

export function validateServices(d: OnboardingData): Errors {
  const e: Errors = {};
  if (!d.services.length) e["services"] = "Add at least one service so patients can be booked.";
  const seen = new Map<string, string>();
  for (const s of d.services) {
    const name = s.name.trim();
    if (!name) e[`services.${s.id}.name`] = "Name this service.";
    else if (seen.has(name.toLowerCase())) e[`services.${s.id}.name`] = "Another service already has this name.";
    else seen.set(name.toLowerCase(), s.id);
    if (!d.clinic.specialities.includes(s.speciality)) e[`services.${s.id}.speciality`] = `${specialityLabel(s.speciality)} isn't one of your specialities.`;
    const fee = s.fee.trim();
    if (!fee) e[`services.${s.id}.fee`] = "Enter a fee (0 if free).";
    else if (!/^\d+$/.test(fee)) e[`services.${s.id}.fee`] = "Whole rupees, digits only.";
    else if (Number(fee) > 100000) e[`services.${s.id}.fee`] = "Keep fees under ₹1,00,000.";
  }
  return e;
}

export function validateTeam(d: OnboardingData): Errors {
  const e: Errors = {};
  const plan = planById(d.plan.id);
  if (!d.owner.name.trim()) e["owner.name"] = "Enter your name.";
  if (!EMAIL_RE.test(d.owner.email.trim())) e["owner.email"] = d.owner.email.trim() ? "Enter an email like name@clinic.in." : "Enter your email.";
  if (plan.pricing.kind === "flat") {
    if (d.invites.length) e["invites"] = "Starter is a 1 practitioner workspace. Remove the invites, or choose Team or Clinic.";
    return e;
  }
  const limit = seatLimit(d);
  const used = 1 + d.invites.length;
  if (used > limit) e["invites"] = `${used} people need ${used} seats, but you chose ${limit} on the Plan step.`;
  const roles = invitableRoles(d.plan.id);
  const emails = new Set([d.owner.email.trim().toLowerCase()]);
  for (const inv of d.invites) {
    if (!inv.name.trim()) e[`invites.${inv.id}.name`] = "Enter a name.";
    const mail = inv.email.trim().toLowerCase();
    if (!mail) e[`invites.${inv.id}.email`] = "Enter an email.";
    else if (!EMAIL_RE.test(mail)) e[`invites.${inv.id}.email`] = "Check this email.";
    else if (emails.has(mail)) e[`invites.${inv.id}.email`] = "Already on the team.";
    else emails.add(mail);
    if (!inv.role) e[`invites.${inv.id}.role`] = "Choose a workspace.";
    else if (!roles.includes(inv.role)) e[`invites.${inv.id}.role`] = `Not available on ${plan.name}.`;
  }
  return e;
}

export function validateHours(d: OnboardingData): Errors {
  const e: Errors = {};
  for (const b of d.hours) {
    if (!b.name.trim()) e[`hours.${b.id}.name`] = "Name this branch.";
    if (!b.days.length) e[`hours.${b.id}.days`] = "Choose at least one working day.";
    const open = toMinutes(b.open);
    const close = toMinutes(b.close);
    if (Number.isNaN(open)) e[`hours.${b.id}.open`] = "Set an opening time.";
    if (Number.isNaN(close)) e[`hours.${b.id}.close`] = "Set a closing time.";
    else if (!Number.isNaN(open) && close <= open) e[`hours.${b.id}.close`] = "Closing must be after opening.";
    if (b.lunch) {
      const ls = toMinutes(b.lunchStart);
      const le = toMinutes(b.lunchEnd);
      if (Number.isNaN(ls) || Number.isNaN(le)) e[`hours.${b.id}.lunch`] = "Set both lunch times, or switch lunch off.";
      else if (le <= ls) e[`hours.${b.id}.lunch`] = "Lunch must end after it starts.";
      // only judge lunch against opening hours once those hours make sense themselves
      else if (!Number.isNaN(open) && !Number.isNaN(close) && close > open && (ls < open || le > close)) e[`hours.${b.id}.lunch`] = "Lunch must fall within opening hours.";
    }
  }
  return e;
}

export const VALIDATORS: ((d: OnboardingData) => Errors)[] = [validateClinic, validatePlan, validateServices, validateTeam, validateHours, () => ({})];

/* ----------------------------------------------------------- persistence */

const KEY = "cl_onboarding";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Defensive read: anything malformed falls back to defaults rather than crashing the wizard. */
function normalize(raw: unknown): Progress | null {
  if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.data)) return null;
  const base = freshData();
  const d = raw.data;
  const clinic = isRecord(d.clinic) ? d.clinic : {};
  const plan = isRecord(d.plan) ? d.plan : {};
  const owner = isRecord(d.owner) ? d.owner : {};
  const specs = SPECIALITIES.map((s) => s.id);
  const days = WEEKDAYS.map((w) => w.id);

  const data: OnboardingData = {
    clinic: {
      name: str(clinic.name, ""),
      city: str(clinic.city, ""),
      branches: Math.max(1, Math.min(MAX_BRANCHES, num(clinic.branches, 1))),
      specialities: Array.isArray(clinic.specialities) ? specs.filter((s) => (clinic.specialities as unknown[]).includes(s)) : [],
    },
    plan: { id: oneOf(plan.id, ["starter", "team", "clinic"] as const, base.plan.id), users: Math.max(1, Math.min(MAX_USERS, num(plan.users, base.plan.users))) },
    services: Array.isArray(d.services)
      ? d.services.filter(isRecord).map((s) => ({
          id: str(s.id, uid("svc")),
          name: str(s.name, ""),
          speciality: oneOf(s.speciality, specs, "medical"),
          duration: num(s.duration, 30),
          fee: str(s.fee, ""),
        }))
      : [],
    servicesEdited: d.servicesEdited === true,
    owner: { name: str(owner.name, ""), email: str(owner.email, "") },
    invites: Array.isArray(d.invites)
      ? d.invites.filter(isRecord).map((i) => ({
          id: str(i.id, uid("inv")),
          name: str(i.name, ""),
          email: str(i.email, ""),
          role: oneOf(i.role, ["", "admin", "doctor", "nutritionist", "yoga", "frontdesk", "coordinator"] as const, ""),
        }))
      : [],
    hours: Array.isArray(d.hours)
      ? d.hours.filter(isRecord).map((h, i) => ({
          ...defaultHours(i),
          id: str(h.id, uid("br")),
          name: str(h.name, i === 0 ? "Main branch" : `Branch ${i + 1}`),
          days: Array.isArray(h.days) ? days.filter((x) => (h.days as unknown[]).includes(x)) : [],
          open: str(h.open, "09:00"),
          close: str(h.close, "19:00"),
          lunch: h.lunch !== false,
          lunchStart: str(h.lunchStart, "13:00"),
          lunchEnd: str(h.lunchEnd, "14:00"),
        }))
      : base.hours,
  };
  const synced = withBranches({ ...data, hours: data.hours.length ? data.hours : base.hours }, data.clinic.branches);
  const step = Math.max(0, Math.min(LAST_STEP, Math.round(num(raw.step, 0))));
  const reached = Math.max(step, Math.min(LAST_STEP, Math.round(num(raw.reached, step))));
  return { v: 1, step, reached, data: synced };
}

export function loadProgress(): Progress | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refuses storage (private mode, blocked site data). */
export function saveProgress(p: Progress): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/** Sign-up hands its details to setup: clinic name and the owner (the person signing up). */
export function primeFromSignup(input: { name: string; email: string; clinicName: string }): boolean {
  const current = loadProgress() ?? freshProgress();
  return saveProgress({
    ...current,
    data: { ...current.data, owner: { name: input.name, email: input.email }, clinic: { ...current.data.clinic, name: input.clinicName } },
  });
}
