import type { Discipline, Role } from "@/data/types";
import type { PlanId } from "@/data/plans";
import { BRANCHES, CLINIC } from "@/data/staff";
import { INVOICES } from "@/data/records";
import { TODAY_APPOINTMENTS, WEEK_APPOINTMENTS } from "@/data/appointments";
import { istDayKey, istMinutes } from "./time";

/**
 * Settings fixtures. Clinic identity comes from the shared CLINIC/BRANCHES; the service
 * catalogue is synthetic but priced exactly as the shared invoices bill, and each service lists
 * the diary/invoice labels it covers so bookings and billing can be counted from shared data.
 */

// ---------------------------------------------------------------------------------------------
// Who may change what
// ---------------------------------------------------------------------------------------------

/** On Clinic, administrators manage settings; on Starter/Team the doctor is the practice owner. */
export function settingsAccess(role: Role, plan: PlanId) {
  const owner = role === "admin" || (role === "doctor" && plan !== "clinic");
  return { canEditClinic: owner, canEditServices: owner, ownerLabel: plan === "clinic" ? "administrators" : "the practice owner (doctor)" };
}

// ---------------------------------------------------------------------------------------------
// Clinic profile
// ---------------------------------------------------------------------------------------------

/** Common prefix of the shared invoice numbers ("INV-2611-"). */
const INVOICE_PREFIX = (() => {
  const nums = INVOICES.map((i) => i.number);
  let p = nums[0] ?? "";
  for (const n of nums) while (!n.startsWith(p)) p = p.slice(0, -1);
  return p;
})();

export interface ClinicProfile {
  name: string;
  shortName: string;
  legal: string;
  phone: string;
  email: string;
  slotMinutes: string;
  receiptNote: string;
}

export const CLINIC_SEED: ClinicProfile = {
  name: CLINIC.name,
  shortName: CLINIC.shortName,
  legal: CLINIC.legal,
  phone: "+91 80 4000 2626",
  email: "hello@prana.example",
  slotMinutes: "30",
  receiptNote: "Receipts are issued only after a payment is confirmed by the gateway, the bank or the desk.",
};

export const CLINIC_FIXED = {
  invoicePrefix: INVOICE_PREFIX,
  timezone: "Asia/Kolkata · IST (UTC+05:30)",
  currency: "Indian rupee (₹)",
  week: "Monday – Saturday",
  hours: { start: 7 * 60, end: 20 * 60 },
};

export const BRANCH_ADDRESS: Record<string, string> = {
  indiranagar: "12, 100 Feet Road, Indiranagar (fictional)",
  hsr: "41, 27th Main, HSR Layout Sector 1 (fictional)",
};

// ---------------------------------------------------------------------------------------------
// Rooms in use today (from the shared diary)
// ---------------------------------------------------------------------------------------------

export function roomBookingsToday(room: string) {
  return TODAY_APPOINTMENTS.filter((a) => a.room === room && a.status !== "cancelled")
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((a) => {
      const start = istMinutes(a.start);
      return { id: a.id, start, end: start + a.durationMin, service: a.service, status: a.status, minutes: a.durationMin };
    });
}

// ---------------------------------------------------------------------------------------------
// Service catalogue
// ---------------------------------------------------------------------------------------------

export type ServiceCategory = "consultations" | "nutrition" | "movement" | "diagnostics";

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  consultations: "Consultations",
  nutrition: "Nutrition",
  movement: "Movement",
  diagnostics: "Diagnostics",
};

/** Category → discipline colour (diagnostics are billed items, shown neutral). */
export const CATEGORY_DISCIPLINE: Record<ServiceCategory, Discipline> = {
  consultations: "medical",
  nutrition: "nutrition",
  movement: "movement",
  diagnostics: "operations",
};

export type ServiceBilling = "per-visit" | "programme-credit" | "lab-partner";

export const BILLING_LABEL: Record<ServiceBilling, string> = {
  "per-visit": "Billed per visit",
  "programme-credit": "Uses a programme credit",
  "lab-partner": "Sample sent to lab partner",
};

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  price: number;
  billing: ServiceBilling;
  rooms: string[];
  /** diary service names / invoice item labels this entry covers (case-insensitive substring) */
  match: string[];
  archived?: boolean;
  local?: boolean;
}

/** Ordered: the first service whose match fits a label claims it. */
export const SERVICE_SEED: Service[] = [
  { id: "sv-cardio", name: "Cardiology review", category: "consultations", durationMin: 30, price: 1500, billing: "per-visit", rooms: ["Consult 1"], match: ["cardiology", "heart health", "cardiac rehab review", "ecg review"] },
  { id: "sv-specialist", name: "Specialist review", category: "consultations", durationMin: 30, price: 1200, billing: "per-visit", rooms: ["Consult 2"], match: ["diabetes review", "thyroid follow-up", "pcos review", "bp & renal", "metabolic reset"] },
  { id: "sv-new", name: "New consultation", category: "consultations", durationMin: 45, price: 1500, billing: "per-visit", rooms: ["Consult 1", "Consult 2", "Consult A"], match: ["new consultation", "rheumatology consult"] },
  { id: "sv-walkin", name: "Walk-in consultation", category: "consultations", durationMin: 20, price: 900, billing: "per-visit", rooms: ["Consult 1", "Consult 3"], match: ["walk-in"] },
  { id: "sv-followup", name: "Follow-up consultation", category: "consultations", durationMin: 30, price: 900, billing: "per-visit", rooms: ["Consult 3", "Consult A", "Consult B"], match: ["hypertension follow-up", "neurology follow-up", "follow-up consultation", "consultation"] },
  { id: "sv-nutri-assess", name: "Nutrition assessment", category: "nutrition", durationMin: 45, price: 1200, billing: "per-visit", rooms: ["Nutrition Studio", "Studio"], match: ["nutrition assessment", "nutrition plan"] },
  { id: "sv-nutri-follow", name: "Nutrition follow-up", category: "nutrition", durationMin: 30, price: 800, billing: "per-visit", rooms: ["Nutrition Studio", "Studio"], match: ["nutrition review", "nutrition follow-up", "meal-plan check-in"] },
  { id: "sv-yoga-1to1", name: "Therapeutic yoga · 1:1", category: "movement", durationMin: 45, price: 800, billing: "per-visit", rooms: ["Yoga Hall", "Yoga Deck"], match: ["yoga therapy", "cardiac rehab yoga"] },
  { id: "sv-breath", name: "Breathwork · 1:1", category: "movement", durationMin: 45, price: 800, billing: "per-visit", rooms: ["Therapy Room"], match: ["breathwork"] },
  { id: "sv-prenatal", name: "Prenatal yoga · 1:1", category: "movement", durationMin: 45, price: 800, billing: "per-visit", rooms: ["Therapy Room"], match: ["prenatal yoga"] },
  { id: "sv-class", name: "Group class", category: "movement", durationMin: 60, price: 0, billing: "programme-credit", rooms: ["Yoga Hall", "Yoga Deck"], match: ["rehab flow", "breath & balance", "back care"] },
  { id: "sv-ecg", name: "ECG", category: "diagnostics", durationMin: 10, price: 400, billing: "per-visit", rooms: ["Consult 1"], match: ["ecg"] },
  { id: "sv-hba1c", name: "HbA1c", category: "diagnostics", durationMin: 10, price: 600, billing: "lab-partner", rooms: [], match: ["hba1c"] },
  { id: "sv-lipid", name: "Lipid profile", category: "diagnostics", durationMin: 10, price: 900, billing: "lab-partner", rooms: [], match: ["lipid profile"] },
  { id: "sv-vitd", name: "Vitamin D", category: "diagnostics", durationMin: 10, price: 700, billing: "lab-partner", rooms: [], match: ["vitamin d"] },
  { id: "sv-renal", name: "Creatinine & eGFR", category: "diagnostics", durationMin: 10, price: 500, billing: "lab-partner", rooms: [], match: ["creatinine", "egfr"] },
];

const norm = (s: string) => s.toLowerCase();

/** Which catalogue entry a diary or invoice label belongs to (first match wins). */
export function serviceFor(label: string, services: Service[]): Service | undefined {
  const l = norm(label);
  return services.find((s) => (s.match.length ? s.match : [s.name]).some((m) => l.includes(norm(m))));
}

/** Diary bookings this week (Mon–Sat, cancellations excluded) per service id. */
export function bookingsThisWeek(services: Service[]) {
  const counts: Record<string, number> = {};
  let unmatched = 0;
  for (const a of WEEK_APPOINTMENTS) {
    if (a.status === "cancelled") continue;
    const s = serviceFor(a.service, services);
    if (s) counts[s.id] = (counts[s.id] ?? 0) + 1;
    else unmatched += 1;
  }
  return { counts, unmatched, total: WEEK_APPOINTMENTS.filter((a) => a.status !== "cancelled").length };
}

/** Invoice line items issued in November per service id (count + amount), from shared invoices. */
export function billedThisMonth(services: Service[]) {
  const out: Record<string, { count: number; amount: number; last: string }> = {};
  for (const inv of INVOICES) {
    if (!istDayKey(inv.issuedAt).startsWith("2026-11")) continue;
    for (const item of inv.items) {
      if (item.amount <= 0 && !/review/i.test(item.label)) continue;
      const s = serviceFor(item.label, services);
      if (!s) continue;
      const cur = out[s.id] ?? { count: 0, amount: 0, last: inv.issuedAt };
      out[s.id] = { count: cur.count + 1, amount: cur.amount + Math.max(0, item.amount), last: Date.parse(inv.issuedAt) > Date.parse(cur.last) ? inv.issuedAt : cur.last };
    }
  }
  return out;
}

/** "Mon 9 – Sat 14 Nov": the diary days WEEK_APPOINTMENTS covers. */
export const DIARY_WEEK_LABEL = (() => {
  const keys = [...new Set(WEEK_APPOINTMENTS.map((a) => istDayKey(a.start)))].sort();
  const f = (k: string) => `${new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${k}T12:00:00Z`))} ${Number(k.slice(8, 10))}`;
  return keys.length ? `${f(keys[0])} – ${f(keys[keys.length - 1])} Nov` : "";
})();

export const ALL_ROOMS = BRANCHES.flatMap((b) => b.rooms.map((r) => ({ branch: b.id, branchName: b.name, room: r })));

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

export type TemplateChannel = "SMS" | "WhatsApp" | "Email" | "Print" | "Note";
export type TemplateStatus = "published" | "awaiting-review" | "draft";

export interface Template {
  id: string;
  name: string;
  purpose: string;
  channel: TemplateChannel;
  /** clinical templates: an administrator's edit waits for the clinical lead */
  clinical: boolean;
  owner: string;
  body: string;
  status: TemplateStatus;
  editedBy: string;
  editedAt: string;
}

export const TEMPLATE_SEED: Template[] = [
  {
    id: "tp-reminder", name: "Appointment reminder", purpose: "Sent the evening before a booking", channel: "SMS", clinical: false, owner: "Front desk",
    body: "Hi {{patient.firstName}}, a reminder of your {{appointment.service}} with {{appointment.clinician}} on {{appointment.date}} at {{appointment.time}}, {{branch.name}}. Reply C to confirm or call {{clinic.phone}} to change it. - {{clinic.shortName}}",
    status: "published", editedBy: "s-sneha", editedAt: "2026-10-14T11:20:00+05:30",
  },
  {
    id: "tp-intake", name: "Intake form invite", purpose: "Before a first visit", channel: "WhatsApp", clinical: false, owner: "Front desk",
    body: "Hi {{patient.firstName}}, please fill in your intake form before your visit on {{appointment.date}}: {{link.intake}}\nIt takes about 8 minutes and saves time at the desk. - {{clinic.shortName}}",
    status: "published", editedBy: "s-sneha", editedAt: "2026-09-30T16:05:00+05:30",
  },
  {
    id: "tp-payment", name: "Payment reminder", purpose: "Open balance after 7 days", channel: "WhatsApp", clinical: false, owner: "Billing",
    body: "Hi {{patient.firstName}}, invoice {{invoice.number}} has {{invoice.balance}} outstanding. You can pay at the desk or with the UPI link we send separately. If you've already paid, please ignore this — bank confirmations can take a day. - {{clinic.shortName}}",
    status: "published", editedBy: "s-neha", editedAt: "2026-10-21T10:00:00+05:30",
  },
  {
    id: "tp-receipt", name: "Payment receipt", purpose: "Issued after a confirmed payment", channel: "Print", clinical: false, owner: "Billing",
    body: "Receipt for {{invoice.number}}\n{{clinic.legal}}\n\nReceived {{payment.amount}} by {{payment.method}} on {{payment.date}}.\nConfirmation: {{payment.confirmation}}\n\n{{clinic.receiptNote}}",
    status: "published", editedBy: "s-neha", editedAt: "2026-08-02T09:30:00+05:30",
  },
  {
    id: "tp-consent", name: "Programme enrolment consent", purpose: "Signed before a programme starts", channel: "Print", clinical: false, owner: "Front desk · clinical lead",
    body: "I, {{patient.name}}, agree to join {{programme.name}} at {{clinic.name}}.\nI understand my doctor, nutritionist and yoga instructor will share one record so they can plan my care together, and that I can ask what is shared and with whom.\n\nSigned: ____________  Date: {{today}}",
    status: "published", editedBy: "s-ananya", editedAt: "2026-07-11T15:40:00+05:30",
  },
  {
    id: "tp-followup", name: "Follow-up consultation note", purpose: "Structured note for review visits", channel: "Note", clinical: true, owner: "Clinical lead",
    body: "Subjective: [patient's account since the last visit]\nObjective: [vitals, examination, new results]\nAssessment: [clinician's assessment per condition]\nPlan: [medication, tests, referrals, next review]\nShared guidance for nutrition and movement: [what the care team should do]",
    status: "published", editedBy: "s-ananya", editedAt: "2026-06-02T18:10:00+05:30",
  },
  {
    id: "tp-referral", name: "Referral letter", purpose: "To an external specialist", channel: "Print", clinical: true, owner: "Clinical lead",
    body: "Dear colleague,\nI am referring {{patient.name}} for [reason for referral].\nRelevant history: [clinician summary]\nCurrent medication: [list]\nThe question I'd like answered: [question]\n\nWith thanks,\n{{clinician.name}}, {{clinic.name}}",
    status: "published", editedBy: "s-ananya", editedAt: "2026-05-19T12:00:00+05:30",
  },
  {
    id: "tp-precaution", name: "Precaution card", purpose: "Shown to yoga instructors", channel: "Print", clinical: true, owner: "Clinical lead",
    body: "Approved precautions for {{patient.firstName}}: [clinician-approved precautions]\nApproved by [clinician] on [date].\nStop the session and tell the instructor about dizziness, breathlessness or chest discomfort.",
    status: "published", editedBy: "s-ananya", editedAt: "2026-09-08T10:45:00+05:30",
  },
];

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  published: "In use",
  "awaiting-review": "Awaiting clinical review",
  draft: "Draft",
};

/** Text-message segments: GSM-7 160/153, otherwise Unicode (₹, —, emoji) 70/67. */
export function smsSegments(text: string) {
  const gsm = /^[A-Za-z0-9 \n\r@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[\]~|€]*$/.test(text);
  const len = [...text].length;
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return { gsm, len, segments: len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / multi), single, multi };
}
