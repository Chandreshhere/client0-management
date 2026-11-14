import type { Appointment, AppointmentStatus, BranchId, Discipline, Patient, PatientStatus, Role } from "@/data/types";
import type { FeatureId } from "@/data/plans";
import { PATIENTS, clinicNumber } from "@/data/patients";
import { STAFF, staffById } from "@/data/staff";
import { TODAY_APPOINTMENTS, WEEK_APPOINTMENTS } from "@/data/appointments";
import { CLASSES } from "@/data/programs";
import { TODAY, formatDate } from "@/lib/format";

/**
 * Patients area logic: derived visits and flags, filtering, sorting, duplicate detection and
 * first-visit slots. Pure functions over the shared synthetic data (no React here).
 *
 * Source of truth: the patient record (`nextAppointment`, `lastVisit`) and the hand-written
 * TODAY_APPOINTMENTS. The seeded week generator books some "not rebooked" patients on Sat 14 and
 * logs completed visits after a patient's recorded last visit, so generated entries are only
 * used where they agree with the record (see `upcomingVisits` / `recentVisits`).
 */

// ---------------------------------------------------------------- types

export type Sex = Patient["sex"] | "Other";

/** Extra details captured when a patient is registered in this browser session. */
export interface LocalDetails {
  clinicNo: string;
  dob: string;
  email: string | null;
  language: string;
  /** ABHA number as typed — voluntary, never verified here (no ABDM connection). */
  abha: string | null;
  /** Full address as given at registration; `area` holds its last part (the locality). */
  address?: string;
  emergency?: { name: string; phone: string };
  /** DPDP consent: when and by whom it was recorded. */
  consentAt: string;
  consentBy?: string;
  /** Possible matches the registrar continued past. An admin reviews them; nothing is merged automatically. */
  duplicateOf: string[];
  registeredBy: string;
}

/** A registry row's patient: a shared synthetic patient, or one registered in this session. */
export interface RegistryPatient extends Omit<Patient, "sex" | "avatar"> {
  sex: Sex;
  avatar: string | null;
  local?: LocalDetails;
}

export interface Visit {
  id: string;
  start: string;
  durationMin: number | null;
  service: string | null;
  staffId: string | null;
  room: string | null;
  status: AppointmentStatus;
  discipline: Discipline | null;
  kind: Appointment["kind"] | null;
  formsComplete: boolean | null;
  notes: string | null;
  /** diary = shared synthetic diary · record = patient record field only · session = booked in this browser session */
  source: "diary" | "record" | "session";
}

export type FlagId = "duplicate" | "intake" | "rebook" | "balance" | "allergies";

export interface Row {
  patient: RegistryPatient;
  next: Visit | null;
  last: string | null;
  flags: FlagId[];
  team: string[];
}

export type Scope = "all" | "mine" | "attention" | "new" | "duplicates";
export type SortKey = "name" | "next" | "last" | "status";

export interface Filters {
  status: PatientStatus[];
  programme: string[];
  team: string[];
  branch: BranchId[];
  flags: FlagId[];
}

export const EMPTY_FILTERS: Filters = { status: [], programme: [], team: [], branch: [], flags: [] };
/** Facet value meaning "none" (no programme / no care team). */
export const NONE = "__none";
export const PAGE_SIZE = 10;

// ---------------------------------------------------------------- demo clock

export const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const NOW = TODAY.getTime();
const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const ymd = (iso: string | number | Date) => ymdFormat.format(new Date(iso));

export const TODAY_YMD = ymd(TODAY);
const TOMORROW_YMD = ymd(NOW + DAY_MS);
const YESTERDAY_YMD = ymd(NOW - DAY_MS);
const TODAY_START = Date.parse(`${TODAY_YMD}T00:00:00+05:30`);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayIndex = WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(TODAY));
/** Monday 00:00 of the demo week — "New this week" counts from here. */
export const WEEK_START = TODAY_START - Math.max(0, weekdayIndex) * DAY_MS;

/** "Today", "Tomorrow", "Yesterday" or "Mon 16 Nov" (IST). */
export function dayWord(iso: string) {
  const d = ymd(iso);
  if (d === TODAY_YMD) return "Today";
  if (d === TOMORROW_YMD) return "Tomorrow";
  if (d === YESTERDAY_YMD) return "Yesterday";
  return formatDate(iso, { weekday: "short", day: "numeric", month: "short" });
}

export const isToday = (iso: string) => ymd(iso) === TODAY_YMD;

// ---------------------------------------------------------------- identity

export const clinicNoOf = (p: RegistryPatient) => p.local?.clinicNo ?? clinicNumber(p.id);

/** Continues the registry's PR-xxxxx sequence for session registrations. */
export function nextClinicNumber(local: RegistryPatient[]) {
  const nums = [...PATIENTS.map((p) => clinicNumber(p.id)), ...local.map(clinicNoOf)].map((s) => Number(s.replace(/\D/g, "")));
  return `PR-${String(Math.max(...nums) + 7).padStart(5, "0")}`;
}

export const careTeamIds = (t: Patient["careTeam"]) => [t.doctor, t.nutritionist, t.yoga, t.coordinator].filter((x): x is string => !!x);

export const CARE_SLOTS = [
  { key: "doctor", label: "Doctor", role: "doctor" },
  { key: "nutritionist", label: "Nutritionist", role: "nutritionist" },
  { key: "yoga", label: "Yoga instructor", role: "yoga" },
  { key: "coordinator", label: "Care coordinator", role: "coordinator" },
] as const;

export type CareSlot = (typeof CARE_SLOTS)[number]["key"];

export const staffWithRole = (role: Role) => STAFF.filter((s) => s.role === role);

/** Roles that see balances (billing is the front desk's, Clinic plan and up). */
export const BILLING_ROLES: Role[] = ["admin", "frontdesk"];
/** Roles that sit on care teams — "My patients" means "on my care team" for them. */
export const CARE_ROLES: Role[] = ["doctor", "nutritionist", "yoga", "coordinator"];
/** Admin and Reception see demographics only: no diagnoses, concerns or conditions. */
export const DEMOGRAPHIC_ROLES: Role[] = ["admin", "frontdesk"];
/** Who can register a patient and edit demographics (spec: Doctor, Admin, Reception). */
export const REGISTER_ROLES: Role[] = ["doctor", "admin", "frontdesk"];
/** Who sets a patient's care team (spec: Doctor, Admin). */
export const CARE_TEAM_ROLES: Role[] = ["doctor", "admin"];
/** Who books appointments (Clinic plan and up). */
export const BOOKING_ROLES: Role[] = ["doctor", "frontdesk", "admin", "coordinator"];

/**
 * What the registry shows a role on a plan. Admin and Reception get demographics and routing only;
 * scheduling detail needs the calendar (Clinic+), balances need billing, programmes and branches
 * are Pro. Nothing from a higher plan is shown.
 */
export interface RegistryLens {
  clinical: boolean;
  /**
   * What the concern column shows: diagnoses (doctor, nutritionist — read-only for the
   * nutritionist), the doctor's precautions (yoga instructors never see diagnoses), or nothing
   * (coordinator: status only; Admin and Reception: demographics).
   */
  concern: "diagnosis" | "precautions" | "none";
  /** The organ-led Browse layout — an optional doctor view. */
  browse: boolean;
  diary: boolean;
  showBalance: boolean;
  programmes: boolean;
  branches: boolean;
  canRegister: boolean;
  canAssignTeam: boolean;
  canMerge: boolean;
  canBook: boolean;
  canMessage: boolean;
  coordinators: boolean;
}

export function registryLens(role: Role, has: (f: FeatureId) => boolean): RegistryLens {
  const clinical = !DEMOGRAPHIC_ROLES.includes(role);
  return {
    clinical,
    concern: role === "doctor" || role === "nutritionist" ? "diagnosis" : role === "yoga" ? "precautions" : "none",
    browse: role === "doctor",
    diary: has("calendar"),
    showBalance: has("billing") && BILLING_ROLES.includes(role),
    programmes: has("programmes"),
    branches: has("branches"),
    canRegister: REGISTER_ROLES.includes(role),
    canAssignTeam: CARE_TEAM_ROLES.includes(role),
    canMerge: role === "admin",
    canBook: has("calendar") && BOOKING_ROLES.includes(role),
    canMessage: has("messages") && CARE_ROLES.includes(role),
    coordinators: has("coordinator"),
  };
}

// ---------------------------------------------------------------- visits

const LIVE: AppointmentStatus[] = ["arrived", "waiting", "in-session", "checkout"];
export const isLive = (v: Visit) => LIVE.includes(v.status);

const fromAppointment = (a: Appointment, source: Visit["source"]): Visit => ({
  id: a.id,
  start: a.start,
  durationMin: a.durationMin,
  service: a.service,
  staffId: a.staffId,
  room: a.room,
  status: a.status,
  discipline: a.discipline,
  kind: a.kind,
  formsComplete: a.formsComplete ?? null,
  notes: a.notes ?? null,
  source,
});

const recordVisit = (id: string, start: string, status: AppointmentStatus): Visit => ({
  id,
  start,
  durationMin: null,
  service: null,
  staffId: null,
  room: null,
  status,
  discipline: null,
  kind: null,
  formsComplete: null,
  notes: null,
  source: "record",
});

/** Live and upcoming visits: today's diary, session bookings, then the record's next appointment. */
export function upcomingVisits(p: RegistryPatient, sessionVisits: Appointment[] = []): Visit[] {
  const mine = (a: Appointment) => a.patientId === p.id;
  const out: Visit[] = [
    ...TODAY_APPOINTMENTS.filter((a) => mine(a) && (LIVE.includes(a.status) || (a.status === "booked" && Date.parse(a.start) >= NOW))).map((a) => fromAppointment(a, "diary")),
    ...sessionVisits.filter((a) => mine(a) && Date.parse(a.start) >= NOW).map((a) => fromAppointment(a, "session")),
  ];
  const rec = p.nextAppointment;
  if (rec && Date.parse(rec) >= NOW && !out.some((v) => v.start === rec)) {
    const diary = WEEK_APPOINTMENTS.find((a) => mine(a) && a.start === rec);
    out.push(diary ? fromAppointment(diary, "diary") : recordVisit(`record-next-${p.id}`, rec, "booked"));
  }
  return out.sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || Date.parse(a.start) - Date.parse(b.start));
}

export const nextVisit = (p: RegistryPatient, sessionVisits: Appointment[] = []) => upcomingVisits(p, sessionVisits)[0] ?? null;

/** Most recent completed visit: a visit completed earlier today, else the record's last visit. */
export function lastVisitAt(p: RegistryPatient): string | null {
  const today = TODAY_APPOINTMENTS.filter((a) => a.patientId === p.id && a.status === "completed")
    .map((a) => a.start)
    .sort()
    .at(-1);
  if (today && (!p.lastVisit || Date.parse(today) > Date.parse(p.lastVisit))) return today;
  return p.lastVisit;
}

/** Past visits, newest first. Generated "completed" entries never post-date the recorded last visit. */
export function recentVisits(p: RegistryPatient): Visit[] {
  const last = lastVisitAt(p);
  const lastMs = last ? Date.parse(last) : Number.NEGATIVE_INFINITY;
  const past = WEEK_APPOINTMENTS.filter((a) => {
    if (a.patientId !== p.id) return false;
    const t = Date.parse(a.start);
    if (t >= TODAY_START) return a.status === "completed" || a.status === "no-show" || a.status === "cancelled";
    if (a.status === "booked") return false;
    return a.status !== "completed" || t <= lastMs;
  }).map((a) => fromAppointment(a, "diary"));
  if (p.lastVisit && Date.parse(p.lastVisit) < NOW && !past.some((v) => v.status === "completed" && v.start === p.lastVisit)) {
    past.push(recordVisit(`record-last-${p.id}`, p.lastVisit, "completed"));
  }
  return past.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

// ---------------------------------------------------------------- flags & rows

export const FLAG_ORDER: FlagId[] = ["duplicate", "intake", "rebook", "balance", "allergies"];
export const FLAG_LABEL: Record<FlagId, string> = {
  duplicate: "Possible duplicate",
  intake: "Intake pending",
  rebook: "Not rebooked",
  balance: "Balance due",
  allergies: "Allergies not recorded",
};

export function flagsFor(p: RegistryPatient, next: Visit | null, diary = true): FlagId[] {
  const out: FlagId[] = [];
  if (p.tags.includes("Possible duplicate") || (p.local?.duplicateOf.length ?? 0) > 0) out.push("duplicate");
  if (!p.intakeComplete) out.push("intake");
  // "Not rebooked" is a front-office signal — only plans with appointments raise it.
  if (diary && !next && p.status !== "completed" && lastVisitAt(p) !== null) out.push("rebook");
  if (p.balanceDue > 0) out.push("balance");
  // null = not recorded. An empty list is a confirmed "no known allergies" and is not a flag.
  if (p.allergies === null) out.push("allergies");
  return out;
}

/**
 * Registry rows. Without the diary (Core has no appointments) the next date is the follow-up date
 * on the record, and nothing comes from today's check-in queue.
 */
export function buildRows(patients: RegistryPatient[], sessionVisits: Appointment[], opts: { diary: boolean; coordinators?: boolean } = { diary: true }): Row[] {
  return patients.map((patient) => {
    const next = opts.diary ? nextVisit(patient, sessionVisits) : followUpVisit(patient);
    const last = opts.diary ? lastVisitAt(patient) : patient.lastVisit;
    // Care coordinators are a Pro role; below Pro they aren't part of anyone's care team.
    const team = careTeamIds(opts.coordinators === false ? { ...patient.careTeam, coordinator: undefined } : patient.careTeam);
    return { patient, next, last, flags: flagsFor(patient, next, opts.diary), team };
  });
}

/** The next follow-up date on the record (Core: no booking, no queue). */
export function followUpVisit(p: RegistryPatient): Visit | null {
  const rec = p.nextAppointment;
  return rec && Date.parse(rec) >= NOW ? recordVisit(`record-next-${p.id}`, rec, "booked") : null;
}

// ---------------------------------------------------------------- search, scope, filters, sort

/**
 * Search by clinic ID, phone or name (F1). Phones are stored masked ("+91 98•• ••• 214"), so a
 * number matches on its visible digits: a full 10-digit mobile on its first two and last three,
 * a shorter run on the start or end. Clinical roles can also search by concern or condition;
 * Admin and Reception can't, so a search never reveals a diagnosis.
 */
export function matchesQuery(p: RegistryPatient, q: string, opts: { clinical?: boolean } = {}) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const cn = clinicNoOf(p).toLowerCase();
  const digits = s.replace(/\D/g, "");
  const textOnly = digits.length === 0;
  return (
    p.name.toLowerCase().includes(s) ||
    cn.includes(s) ||
    (digits.length >= 3 && cn.replace(/\D/g, "").includes(digits)) ||
    matchesPhone(p.phone, digits) ||
    (!!opts.clinical && textOnly && (p.primaryConcern.toLowerCase().includes(s) || p.conditions.some((c) => c.toLowerCase().includes(s))))
  );
}

export function matchesPhone(masked: string, typed: string) {
  const parts = maskedParts(masked);
  if (!parts) return false;
  const full = phoneDigits(typed);
  if (full.length === 10) return full.slice(0, 2) === parts[1] && full.slice(7) === parts[2];
  // The last three digits, as people read them out ("ending 214").
  const d = typed.replace(/\D/g, "");
  return d.length === 3 && parts[2] === d;
}

export function inScope(row: Row, scope: Scope, ctx: { role: Role; userId: string }) {
  switch (scope) {
    case "all":
      return true;
    case "mine":
      return CARE_ROLES.includes(ctx.role)
        ? row.team.includes(ctx.userId)
        : TODAY_APPOINTMENTS.some((a) => a.patientId === row.patient.id) || (row.next !== null && isToday(row.next.start));
    case "attention":
      return row.patient.status === "needs-attention";
    case "duplicates":
      return row.flags.includes("duplicate");
    case "new":
      return Date.parse(row.patient.registeredAt) >= WEEK_START;
  }
}

/** Search results with the user's own patients first (F1); the chosen sort holds within each group. */
export function mineFirst(rows: Row[], userId: string) {
  const mine = rows.filter((r) => r.team.includes(userId));
  return mine.length ? [...mine, ...rows.filter((r) => !r.team.includes(userId))] : rows;
}

export function passesFilters(row: Row, f: Filters) {
  const p = row.patient;
  if (f.status.length && !f.status.includes(p.status)) return false;
  if (f.programme.length && !f.programme.includes(p.program ?? NONE)) return false;
  if (f.team.length && !f.team.some((id) => (id === NONE ? row.team.length === 0 : row.team.includes(id)))) return false;
  if (f.branch.length && !f.branch.includes(p.branch)) return false;
  if (f.flags.length && !f.flags.some((fl) => row.flags.includes(fl))) return false;
  return true;
}

export const activeFilterCount = (f: Filters) => f.status.length + f.programme.length + f.team.length + f.branch.length + f.flags.length;

export const STATUS_ORDER: PatientStatus[] = ["needs-attention", "onboarding", "active", "completed"];

const nextKey = (r: Row) => (r.next ? (isLive(r.next) ? NOW - 1 : Date.parse(r.next.start)) : Number.POSITIVE_INFINITY);

export function sortRows(rows: Row[], key: SortKey) {
  const byName = (a: Row, b: Row) => a.patient.name.localeCompare(b.patient.name);
  const sorted = [...rows];
  switch (key) {
    case "name":
      return sorted.sort(byName);
    case "next":
      return sorted.sort((a, b) => nextKey(a) - nextKey(b) || byName(a, b));
    case "last": {
      const t = (r: Row) => (r.last ? Date.parse(r.last) : Number.NEGATIVE_INFINITY);
      return sorted.sort((a, b) => t(b) - t(a) || byName(a, b));
    }
    case "status":
      return sorted.sort((a, b) => STATUS_ORDER.indexOf(a.patient.status) - STATUS_ORDER.indexOf(b.patient.status) || byName(a, b));
  }
}

export const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  next: "Next appointment",
  last: "Last visit",
  status: "Status",
};

// ---------------------------------------------------------------- registration helpers

export const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam", "Marathi", "Bengali", "Urdu"];

/** Strip formatting and a leading +91 / 0 from an Indian mobile number. */
export function phoneDigits(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export const isIndianMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

/** Same masked shape as the registry ("+91 98•• ••• 214") — the full number is never stored. */
export const maskPhone = (d: string) => `+91 ${d.slice(0, 2)}•• ••• ${d.slice(7)}`;

export function ageOn(dob: string): number | null {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [ty, tm, td] = TODAY_YMD.split("-").map(Number);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  let age = ty - y;
  if (tm < mo || (tm === mo && td < d)) age -= 1;
  return age;
}

/** 14-digit ABHA number, shown as XX-XXXX-XXXX-XXXX. */
export const abhaDigits = (raw: string) => raw.replace(/\D/g, "");
export const formatAbha = (d: string) => (d.length === 14 ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10)}` : d);

// ---------------------------------------------------------------- duplicate detection

export interface DuplicateMatch {
  patient: RegistryPatient;
  reasons: string[];
  score: number;
}

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** 2 = same or near-identical full name, 1 = a first or last name matches, 0 = no match. */
function nameScore(input: string, existing: string) {
  const a = normalizeName(input);
  const b = normalizeName(existing.replace(/^(dr|mr|ms|mrs)\.?\s+/i, ""));
  if (a.length < 3) return 0;
  if (similarity(a, b) >= 0.85) return 2;
  const ta = a.split(" ").filter((t) => t.length >= 3);
  const tb = b.split(" ");
  return ta.some((t) => tb.some((u) => similarity(t, u) >= 0.8)) ? 1 : 0;
}

/** Visible parts of a masked number: "+91 98•• ••• 214" → ["98", "214"]. */
const maskedParts = (phone: string) => phone.match(/\+91\s*(\d{2})\D+(\d{3})\s*$/);

/**
 * Possible existing records for a registration in progress. Uses several identity fields; a shared
 * phone number alone is a signal, never grounds to merge (doc §2A). Age alone never matches.
 */
export function findDuplicates(input: { name: string; phone: string; dob: string }, pool: RegistryPatient[]): DuplicateMatch[] {
  const digits = phoneDigits(input.phone);
  const age = ageOn(input.dob);
  const out: DuplicateMatch[] = [];
  for (const p of pool) {
    const reasons: string[] = [];
    let score = 0;
    let identity = false;
    const parts = maskedParts(p.phone);
    if (digits.length === 10 && parts && digits.slice(0, 2) === parts[1] && digits.slice(7) === parts[2]) {
      reasons.push(`Same mobile ${parts[1]}•• ••• ${parts[2]}`);
      score += 3;
      identity = true;
    }
    const n = nameScore(input.name, p.name);
    if (n > 0) {
      reasons.push(n === 2 ? "Same name" : "Similar name");
      score += n;
      identity = true;
    }
    if (age !== null && age === p.age) {
      reasons.push(`Same age (${age})`);
      score += 1;
    }
    if (identity && score >= 2) out.push({ patient: p, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name)).slice(0, 3);
}

/**
 * Existing records that share identity signals with a registered patient — the same signals the
 * registration check uses (masked mobile, name, age). A signal for a reviewer; nothing is merged.
 */
export function relatedRecords(p: RegistryPatient, pool: RegistryPatient[]): DuplicateMatch[] {
  const mine = maskedParts(p.phone);
  const out: DuplicateMatch[] = [];
  for (const q of pool) {
    if (q.id === p.id) continue;
    const reasons: string[] = [];
    let score = 0;
    let identity = false;
    const theirs = maskedParts(q.phone);
    if (mine && theirs && mine[1] === theirs[1] && mine[2] === theirs[2]) {
      reasons.push(`Same mobile ${mine[1]}•• ••• ${mine[2]}`);
      score += 3;
      identity = true;
    }
    const n = nameScore(p.name, q.name);
    if (n > 0) {
      reasons.push(n === 2 ? "Same name" : "Similar name");
      score += n;
      identity = true;
    }
    if (p.age === q.age) {
      reasons.push(`Same age (${p.age})`);
      score += 1;
    }
    if (identity && score >= 2) out.push({ patient: q, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name)).slice(0, 3);
}

// ---------------------------------------------------------------- first visit (register while booking)

export const FIRST_VISIT_SERVICES: { id: string; label: string; role: "doctor" | "nutritionist" | "yoga"; discipline: Discipline; durationMin: number; feature: FeatureId | null }[] = [
  { id: "consult", label: "New consultation", role: "doctor", discipline: "medical", durationMin: 45, feature: null },
  { id: "nutrition", label: "Nutrition assessment", role: "nutritionist", discipline: "nutrition", durationMin: 45, feature: "nutrition" },
  { id: "movement", label: "Yoga therapy assessment · 1:1", role: "yoga", discipline: "movement", durationMin: 45, feature: "classes" },
];

/** Practitioner busy blocks across consultations, sessions and classes (one reservation view). */
function busyBlocks(staffId: string, sessionVisits: Appointment[]) {
  const appts = [...WEEK_APPOINTMENTS, ...sessionVisits]
    .filter((a) => a.staffId === staffId && a.status !== "cancelled")
    .map((a) => [Date.parse(a.start), Date.parse(a.start) + a.durationMin * MIN_MS] as const);
  const classes = CLASSES.filter((c) => c.instructorId === staffId).map((c) => [Date.parse(c.start), Date.parse(c.start) + c.durationMin * MIN_MS] as const);
  return [...appts, ...classes];
}

/** Free slots today (from 20 min after now) and tomorrow, inside working hours, without overlaps. */
export function freeSlots(staffId: string, durationMin: number, sessionVisits: Appointment[]) {
  const s = staffById(staffId);
  if (!s || s.status === "on-leave") return [];
  const h = s.workingHours.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
  if (!h) return [];
  const open = Number(h[1]) * 60 + Number(h[2]);
  const close = Number(h[3]) * 60 + Number(h[4]);
  const busy = busyBlocks(staffId, sessionVisits);
  const out: { value: string; label: string }[] = [];
  for (const day of [TODAY_YMD, TOMORROW_YMD]) {
    for (let m = open; m + durationMin <= close; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const iso = `${day}T${hh}:${mm}:00+05:30`;
      const start = Date.parse(iso);
      if (start < NOW + 20 * MIN_MS) continue;
      const end = start + durationMin * MIN_MS;
      if (busy.some(([b0, b1]) => start < b1 && b0 < end)) continue;
      out.push({ value: iso, label: `${dayWord(iso)} · ${hh}:${mm}` });
    }
  }
  return out;
}

export const branchLabel = (b: BranchId) => (b === "hsr" ? "HSR Layout" : "Indiranagar");

/**
 * The doctor's yoga precautions for a patient, as recorded on their class places — what an
 * instructor sees instead of a diagnosis. `changed` = a precaution changed and awaits acknowledgement.
 */
export function precautionsFor(patientId: string): { text: string; changed: boolean } | null {
  const all = [...new Set(CLASSES.flatMap((c) => c.enrolled.filter((e) => e.patientId === patientId && e.precaution).map((e) => e.precaution as string)))];
  if (!all.length) return null;
  const text = [...all].sort((a, b) => a.length - b.length)[0];
  const changed = CLASSES.some((c) => c.enrolled.some((e) => e.patientId === patientId && e.clearance === "changed"));
  return { text, changed };
}

/** Locality from a typed address: its last comma-separated part ("12, 3rd Cross, Domlur" → "Domlur"). */
export const localityOf = (address: string) => address.split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? address.trim();

/** The patient's primary doctor — the owner of their reports and the default for messages. */
export const primaryDoctorOf = (p: { careTeam: Patient["careTeam"] }) => staffById(p.careTeam.doctor);
