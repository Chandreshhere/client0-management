import { REFERRALS } from "@/data/care";
import { NUTRITION_PLANS } from "@/data/programs";
import { createPortalStore, localId } from "../store";
import { ME, PATIENT_ID } from "../record";
import { nowIso } from "../time";

/**
 * Patient preferences. Seed values come from the record where it has them (phone, ABHA link,
 * registration and programme dates); everything the patient changes is saved in this browser
 * session only ("Saved locally").
 */

export type Channel = "portal" | "whatsapp" | "sms" | "email" | "call";
export const CHANNEL_LABEL: Record<Channel, string> = { portal: "Portal", whatsapp: "WhatsApp", sms: "SMS", email: "Email", call: "Phone call" };

export type Topic = "reminders" | "results" | "plan" | "billing" | "news";
export const TOPICS: { id: Topic; label: string; detail: string; allowed: Channel[] }[] = [
  { id: "reminders", label: "Appointment reminders", detail: "Before each visit, class or 1:1 session", allowed: ["whatsapp", "sms", "email", "call"] },
  { id: "results", label: "Results released", detail: "Only that something is ready — results stay in the portal", allowed: ["portal", "whatsapp", "sms", "email"] },
  { id: "plan", label: "Plan updates", detail: "When your doctor, nutritionist or yoga instructor changes your plan", allowed: ["portal", "whatsapp", "email"] },
  { id: "billing", label: "Invoices & receipts", detail: "After a visit with a charge", allowed: ["sms", "whatsapp", "email"] },
  { id: "news", label: "Clinic news & workshops", detail: "Occasional, never more than twice a month", allowed: ["whatsapp", "email"] },
];

export type Lead = "24h" | "3h" | "1h";
export const LEAD_LABEL: Record<Lead, string> = { "24h": "1 day before", "3h": "3 hours before", "1h": "1 hour before" };
export const LEAD_MIN: Record<Lead, number> = { "24h": 24 * 60, "3h": 3 * 60, "1h": 60 };

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "kn", label: "ಕನ್ನಡ · Kannada" },
  { value: "hi", label: "हिन्दी · Hindi" },
  { value: "ta", label: "தமிழ் · Tamil" },
  { value: "te", label: "తెలుగు · Telugu" },
  { value: "ml", label: "മലയാളം · Malayalam" },
  { value: "mr", label: "मराठी · Marathi" },
  { value: "bn", label: "বাংলা · Bengali" },
];

export type ConsentId = "care" | "team" | "labs" | "abha" | "research";
export interface Consent {
  given: boolean;
  /** when it was given or withdrawn; null = not recorded */
  at: string | null;
}
export const CONSENT_INFO: Record<ConsentId, { label: string; detail: string; source: string; locked?: string; withdrawWarning?: string }> = {
  care: { label: "Care and treatment at the clinic", detail: "Needed to book visits and keep your record", source: "Registration form", locked: "To end your care with the clinic, talk to the front desk." },
  team: {
    label: "Share my record with my care team",
    detail: "Your doctor, nutritionist, yoga instructor and care coordinator see the parts they need",
    source: "Heart Health programme enrolment",
    withdrawWarning: "Your nutritionist and yoga instructor would stop seeing your doctor's guidance and precautions — your programme can't run safely without it.",
  },
  labs: { label: "Labs send results straight to my record", detail: "Partner labs (Anand Diagnostics, BreathWell Labs) upload reports for review", source: "Registration form", withdrawWarning: "You'd need to upload lab reports yourself." },
  abha: { label: "Linked ABHA health ID", detail: "Lets you pull reports from other hospitals into your record", source: "ABHA link" },
  research: { label: "Use my de-identified data for research", detail: "Optional — never affects your care", source: "Not asked yet" },
};

const firstReferral = REFERRALS.filter((r) => r.patientId === PATIENT_ID).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))[0];

export interface Prefs {
  channels: Record<Topic, Channel[]>;
  email: string;
  lead: Lead;
  morningOf: boolean;
  quiet: boolean;
  language: string;
  largeText: boolean;
  consents: Record<ConsentId, Consent>;
}

export const SEED_PREFS: Prefs = {
  channels: { reminders: ["whatsapp", "sms"], results: ["portal", "whatsapp"], plan: ["portal"], billing: ["sms"], news: [] },
  email: "",
  lead: "24h",
  morningOf: true,
  quiet: true,
  language: "en",
  largeText: false,
  consents: {
    care: { given: true, at: ME.registeredAt },
    team: { given: true, at: firstReferral?.requestedAt ?? ME.registeredAt },
    labs: { given: true, at: ME.registeredAt },
    abha: { given: ME.abhaLinked, at: null },
    research: { given: false, at: null },
  },
};

// ---------------------------------------------------------------------------------------------
// Caregivers (scoped access)
// ---------------------------------------------------------------------------------------------

export type Scope = "appointments" | "plan" | "records" | "billing";
export const SCOPE_LABEL: Record<Scope, { label: string; detail: string }> = {
  appointments: { label: "Appointments", detail: "Times, places and how to prepare" },
  plan: { label: "My plan", detail: "Meals, movement and medicines" },
  records: { label: "Records & results", detail: "Released summaries, labs and scans" },
  billing: { label: "Billing", detail: "Invoices and package balance" },
};

export interface Caregiver {
  id: string;
  name: string;
  relation: string;
  phone: string;
  scopes: Scope[];
  since: string;
  until: string | null;
  status: "active" | "invited";
  reason?: string;
}

const firstPlan = NUTRITION_PLANS.find((p) => p.patientId === PATIENT_ID);
/** Seed: the family member who cooks gets the meal plan (added when the first plan went out). */
const SEED_CAREGIVERS: Caregiver[] = [
  {
    id: "cg-seed-1",
    name: "Asha Malhotra",
    relation: "Mother",
    phone: "+91 98•• ••• 671",
    scopes: ["plan"],
    since: "2026-09-12T12:30:00+05:30",
    until: null,
    status: "active",
    reason: `Cooks for the family — follows your ${firstPlan ? "meal plan" : "plan"}`,
  },
];

export interface PrefsState {
  saved: Prefs;
  savedAt: string | null;
  caregivers: Caregiver[];
}

export const prefsStore = createPortalStore<PrefsState>("carelane.portal.preferences.v1", { saved: SEED_PREFS, savedAt: null, caregivers: SEED_CAREGIVERS });

export const savePrefs = (p: Prefs) => prefsStore.update((s) => ({ ...s, saved: p, savedAt: nowIso() }));
export function addCaregiver(c: Omit<Caregiver, "id" | "since" | "status">): Caregiver {
  const cg: Caregiver = { ...c, id: localId("caregiver"), since: nowIso(), status: "invited" };
  prefsStore.update((s) => ({ ...s, caregivers: [...s.caregivers, cg] }));
  return cg;
}
export const removeCaregiver = (id: string) => prefsStore.update((s) => ({ ...s, caregivers: s.caregivers.filter((c) => c.id !== id) }));
export const restoreCaregiver = (c: Caregiver) => prefsStore.update((s) => ({ ...s, caregivers: [...s.caregivers.filter((x) => x.id !== c.id), c].sort((a, b) => a.since.localeCompare(b.since)) }));
