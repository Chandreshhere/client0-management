import { TODAY, formatDate, formatTime } from "@/lib/format";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { BRANCHES, DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import type { Appointment, BranchId, Role } from "@/data/types";

/**
 * Dashboard helpers + the few feature-local fixtures the shared data does not carry.
 * Every number on the role homes is derived from `src/data/*` so it agrees with the other
 * pages; anything defined here is labelled as dashboard-only demo data.
 *
 * Time maths is done in IST minutes from the fixed demo clock (TODAY = Fri 13 Nov 2026 09:40),
 * independent of the machine's timezone, so the server render and the client hydrate match.
 */

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export const NOW_ISO = TODAY.toISOString();

/** Minutes after midnight in IST. */
export function istMinutes(iso: string) {
  const t = new Date(iso).getTime() + IST_OFFSET_MS;
  return Math.floor((((t % DAY_MS) + DAY_MS) % DAY_MS) / 60_000);
}

/** YYYY-MM-DD of an instant, in IST. */
export const istDayKey = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export const NOW_MIN = istMinutes(NOW_ISO); // 580
export const NOW_LABEL = formatTime(NOW_ISO); // "09:40"
export const TODAY_KEY = istDayKey(NOW_ISO); // "2026-11-13"

export const minutesUntil = (iso: string) => Math.round((new Date(iso).getTime() - TODAY.getTime()) / 60_000);

/** 80 → "1 h 20 min" */
export function spanLabel(totalMin: number) {
  const m = Math.abs(Math.round(totalMin));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "in 1 h 20 min" · "45 min ago" · "now" */
export function untilLabel(iso: string) {
  const d = minutesUntil(iso);
  if (d === 0) return "now";
  return d > 0 ? `in ${spanLabel(d)}` : `${spanLabel(d)} ago`;
}

/** Calendar days (IST) between a date and today (positive = in the past), e.g. 11 Nov → 2. */
export const daysSince = (iso: string) => Math.round((Date.parse(TODAY_KEY) - Date.parse(istDayKey(iso))) / DAY_MS);

export const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

/** "Today 11:00" · "Tomorrow 09:30" · "19 Nov" */
export function whenLabel(iso: string) {
  const key = istDayKey(iso);
  if (key === TODAY_KEY) return `Today ${formatTime(iso)}`;
  const diff = Math.round((Date.parse(key) - Date.parse(TODAY_KEY)) / DAY_MS);
  if (diff === 1) return `Tomorrow ${formatTime(iso)}`;
  if (diff === -1) return `Yesterday ${formatTime(iso)}`;
  return shortDate(iso);
}

export const firstName = (name: string) => name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").split(/\s+/)[0] ?? name;

export const byStart = (a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start);

export const endMinutes = (a: Appointment) => istMinutes(a.start) + a.durationMin;

/** Today's appointments for one practitioner, in time order. */
export const appointmentsFor = (staffId: string) => TODAY_APPOINTMENTS.filter((a) => a.staffId === staffId).sort(byStart);

/** Index of the first item that starts after "now" (where the live marker goes). */
export const nowIndex = (items: { start: string }[]) => {
  const i = items.findIndex((a) => istMinutes(a.start) > NOW_MIN);
  return i === -1 ? items.length : i;
};

export const personName = (id: string) => staffById(id)?.name ?? patientById(id)?.name ?? id;
export const personAvatar = (id: string) => staffById(id)?.avatar ?? patientById(id)?.avatar ?? null;

/** The demo identity's branch (all demo users work at Indiranagar). */
export function branchFor(role: Role): { id: BranchId; name: string } {
  const id = DEMO_USER[role].personId;
  const branch = staffById(id)?.branch ?? patientById(id)?.branch ?? "indiranagar";
  return { id: branch, name: BRANCHES.find((b) => b.id === branch)?.name ?? "Indiranagar" };
}

/** Parses the medication sentence of the shared care plan ("Aspirin 75 mg, atorvastatin 40 mg, …"). */
export function splitMedicines(text: string): { medicines: string[]; guidance: string } {
  const [first, ...rest] = text.split(/\.\s+/);
  const medicines = first.split(/,\s*/).map((m) => m.charAt(0).toUpperCase() + m.slice(1).replace(/\.$/, ""));
  return { medicines, guidance: rest.join(". ").replace(/\.$/, "") };
}

// ---------------------------------------------------------------------------------------------
// Dashboard-only demo fixtures (not in the shared data layer).
// ---------------------------------------------------------------------------------------------

export type ContactChannel = "Call" | "SMS" | "WhatsApp" | "Email";
export type ContactOutcome = "No answer" | "Spoke to patient" | "Left message" | "No reply" | "Wrong number";

export interface ContactAttempt {
  id: string;
  patientId: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string;
  at: string;
  byId: string;
}

export const CONTACT_CHANNELS: ContactChannel[] = ["Call", "SMS", "WhatsApp", "Email"];
export const CONTACT_OUTCOMES: ContactOutcome[] = ["No answer", "Spoke to patient", "Left message", "No reply", "Wrong number"];

/** Care-coordinator contact log (demo). */
export const CONTACT_ATTEMPTS: ContactAttempt[] = [
  { id: "ca-1", patientId: "p-rajesh", channel: "Call", outcome: "No answer", note: "After the 09:00 nutrition no-show. Retry after lunch.", at: "2026-11-13T09:25:00+05:30", byId: "s-farhan" },
  { id: "ca-2", patientId: "p-arun", channel: "Call", outcome: "Spoke to patient", note: "Said he would attend Friday's 07:30 class — marked absent today.", at: "2026-11-12T11:15:00+05:30", byId: "s-farhan" },
  { id: "ca-3", patientId: "p-harish", channel: "WhatsApp", outcome: "Left message", note: "Asked him to call back to book the overdue cardiology review.", at: "2026-11-11T17:40:00+05:30", byId: "s-farhan" },
  { id: "ca-4", patientId: "p-deepak", channel: "Email", outcome: "No reply", note: "Programme completion summary — asked which format he prefers.", at: "2026-11-10T10:05:00+05:30", byId: "s-farhan" },
];

export type ActivityKind = "registration" | "document" | "guidance" | "schedule" | "payment" | "account" | "export" | "plan";

/**
 * Admin activity history. Times are taken from the shared records where one exists
 * (document uploads, registrations, notifications); account and export entries are demo-only.
 */
export const ACTIVITY: { id: string; at: string; actorId: string | null; actorLabel?: string; action: string; kind: ActivityKind }[] = [
  { id: "ac-1", at: "2026-11-13T09:02:00+05:30", actorId: "s-sneha", action: "Scanned a 3-page report into the intake queue — patient not matched", kind: "document" },
  { id: "ac-2", at: "2026-11-13T08:55:00+05:30", actorId: "s-sneha", action: "Registered walk-in Kunal Mehta — flagged as a possible duplicate", kind: "registration" },
  { id: "ac-3", at: "2026-11-13T08:45:00+05:30", actorId: "s-sana", action: "Changed session guidance for Rekha Iyengar (SpO₂ floor 92%)", kind: "guidance" },
  { id: "ac-4", at: "2026-11-13T08:10:00+05:30", actorId: "s-sneha", action: "Moved Zoya Siddiqui's follow-up to 1 Dec and added her to the waitlist", kind: "schedule" },
  { id: "ac-5", at: "2026-11-13T08:05:00+05:30", actorId: null, actorLabel: "Payment gateway", action: "UPI confirmation for INV-2611-0412 not received — invoice left unpaid", kind: "payment" },
  { id: "ac-6", at: "2026-11-12T18:15:00+05:30", actorId: null, actorLabel: "Lab partner · Anand Diagnostics", action: "Uploaded a lipid profile for Kabir Malhotra (reported 11 Nov)", kind: "document" },
  { id: "ac-7", at: "2026-11-12T17:05:00+05:30", actorId: "s-meera", action: "Published nutrition plan v4 for Kabir Malhotra", kind: "plan" },
  { id: "ac-8", at: "2026-11-12T10:30:00+05:30", actorId: "s-neha", action: "Moved Ishaan Gupta from Indiranagar to HSR Layout — access review opened", kind: "account" },
  { id: "ac-9", at: "2026-11-11T18:30:00+05:30", actorId: "s-neha", action: "Exported the appointment list (no clinical fields)", kind: "export" },
];

/** Patient home: "What I should do today" (meals / practice / logs) for Kabir, from his shared care plan. */
export const PATIENT_TODAY: { id: string; label: string; detail: string; kind: "meal" | "practice" | "log"; recordedBy?: string }[] = [
  { id: "class", label: "Cardiac rehab yoga · 07:30", detail: "Marked present by Kavya Nair", kind: "practice", recordedBy: "s-kavya" },
  { id: "breakfast", label: "Breakfast from plan v4", detail: "Heart-healthy vegetarian · oil budget 3 tsp today", kind: "meal" },
  { id: "breathing", label: "Paced breathing 4-6 · 10 min", detail: "From your movement plan", kind: "practice" },
  { id: "lunch", label: "Lunch with 30 g fibre in mind", detail: "Millet swaps added in plan v4", kind: "meal" },
  { id: "snack", label: "Evening snack: roasted chana", detail: "Swap agreed in plan v3", kind: "meal" },
  { id: "dinner", label: "Dinner by 19:30", detail: "Office day — dinner alternatives in plan v4", kind: "meal" },
  { id: "bp", label: "Log today's blood pressure", detail: "Part of your 7-day home log, due 19 Nov", kind: "log" },
];

/** Patient home: how to prepare for the next appointment. */
export const PREPARE_ITEMS: { id: string; label: string; detail?: string }[] = [
  { id: "bp-log", label: "Bring your home BP readings", detail: "The last 7 days — they stay marked self-reported" },
  { id: "meds", label: "Bring the medicines you take now" },
  { id: "symptoms", label: "Note any palpitations or chest discomfort since 6 Nov" },
  { id: "arrive", label: "Arrive by 10:50 to check in at reception" },
];
