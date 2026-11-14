import { useMemo } from "react";
import type { FeatureId } from "@/data/plans";
import { usePlan } from "@/components/shell/role-context";
import { createSessionStore, localId, useSessionStore } from "./session";
import { NOW_ISO, newestFirst } from "./time";

/**
 * Activity log (every plan — compliance is never an upsell). The seed is synthetic but every entry
 * agrees with the shared fixtures (payments recorded at the desk, document uploads, the guidance
 * change Dr. Vikram Iyer made while covering, the branch move behind the access review, Dr. Sana
 * Qureshi's leave). Payments are recorded by hand and reports are scanned in: a payment gateway
 * and lab integrations are add-ons, so the log never shows them working. Entries are shaped to the
 * plan: appointments and payments need Clinic, patient-app uploads and branches need Pro, and
 * below Clinic the admin does the desk work Reception does on Clinic.
 * Actions taken on the billing, team and settings pages in this browser session are appended
 * with `logAudit` — entries are never edited or removed, an undo is logged as its own entry.
 */

export type AuditCategory = "account" | "access" | "record" | "document" | "payment" | "export" | "schedule" | "settings";

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  account: "Accounts",
  access: "Access",
  record: "Patient record",
  document: "Documents",
  payment: "Payments",
  export: "Exports",
  schedule: "Schedule",
  settings: "Settings",
};

export const AUDIT_CATEGORIES = Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[];

export type AuditTarget = { kind: "patient" | "invoice" | "staff" | "document" | "service" | "template" | "branch" | "clinic"; id: string; label: string };

export interface AuditEvent {
  id: string;
  at: string;
  /** staff id, or null for a system / partner / patient actor described by actorLabel */
  actorId: string | null;
  actorLabel?: string;
  category: AuditCategory;
  action: string;
  target?: AuditTarget;
  detail?: string;
  /** "metadata only" = the action routed or classified without opening clinical content */
  scope?: "metadata" | "clinical" | "financial" | "account";
  /** recorded in this browser session */
  local?: boolean;
  /** seed only: the plan feature this entry depends on (dropped on plans without it) */
  needs?: FeatureId;
  /** seed only: how a patient-app upload reads below Pro (the report was brought in and scanned) */
  portal?: { action: string };
}

const at = (day: number, hhmm: string, month = 11) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const AUDIT_SEED: AuditEvent[] = [
  // ---------- Fri 13 Nov ----------
  { id: "au-01", at: at(13, "09:31"), actorId: "s-neha", category: "account", action: "Signed in", detail: "Indiranagar · clinic manager workstation", scope: "account" },
  { id: "au-02", at: at(13, "09:02"), actorId: "s-sneha", category: "document", action: "Scanned a 3-page report into the intake queue — patient not matched", target: { kind: "document", id: "d2", label: "Scanned report · unmatched" }, scope: "metadata" },
  { id: "au-03", at: at(13, "08:55"), actorId: "s-sneha", category: "record", action: "Registered Kunal Mehta — flagged as a possible duplicate (same phone as Kabir Malhotra) for the admin to review", target: { kind: "patient", id: "p-kunal", label: "Kunal Mehta" }, scope: "metadata" },
  { id: "au-04", at: at(13, "08:52"), actorId: "s-sneha", category: "payment", action: "Recorded a card payment of ₹3,200 at the desk", target: { kind: "invoice", id: "i11", label: "INV-2611-0359 · Ishita Banerjee" }, detail: "Approval AUTH 771045 · ••0932", scope: "financial" },
  { id: "au-05", at: at(13, "08:44"), actorId: "s-vikram", category: "record", action: "Changed session guidance — SpO₂ floor 90% → 92%, covering for Dr. Sana Qureshi", target: { kind: "patient", id: "p-rekha", label: "Rekha Iyengar" }, detail: "Opened under temporary cover (until 18 Nov)", scope: "clinical" },
  { id: "au-06", at: at(13, "08:41"), actorId: "s-vikram", category: "access", action: "Opened a record under temporary cover for Dr. Sana Qureshi", target: { kind: "patient", id: "p-rekha", label: "Rekha Iyengar" }, detail: "Cover access granted 10 Nov · ends 18 Nov", scope: "clinical" },
  { id: "au-07", at: at(13, "08:10"), actorId: "s-sneha", category: "schedule", action: "Moved a neurology follow-up to 1 Dec (Dr. Sana Qureshi on leave) and added the patient to the waitlist", target: { kind: "patient", id: "p-zoya", label: "Zoya Siddiqui" }, scope: "metadata" },
  { id: "au-09", at: at(13, "07:02"), actorId: "s-kavya", category: "account", action: "Signed in", detail: "Indiranagar · yoga hall tablet", scope: "account" },

  // ---------- Thu 12 Nov ----------
  { id: "au-10", at: at(12, "19:35"), actorId: "s-ishaan", category: "payment", action: "Recorded a UPI payment of ₹1,200 at the desk", target: { kind: "invoice", id: "i12", label: "INV-2611-0351 · Sameer Joshi" }, detail: "Reference UTR 331712 908113", scope: "financial" },
  { id: "au-11", at: at(12, "19:00"), actorId: "s-sneha", category: "document", action: "Scanned a spirometry report (issued 12 Nov) — routed to the primary doctor, Dr. Sana Qureshi, for review", target: { kind: "patient", id: "p-rekha", label: "Rekha Iyengar" }, detail: "Reviewer is on leave — see team reassignment", scope: "metadata" },
  { id: "au-12", at: at(12, "18:15"), actorId: "s-sneha", category: "document", action: "Scanned a lipid profile (issued 11 Nov) — routed to Dr. Ananya Rao for review", target: { kind: "patient", id: "p-kabir", label: "Kabir Malhotra" }, scope: "metadata" },
  { id: "au-13", at: at(12, "17:05"), actorId: "s-meera", category: "record", action: "Published nutrition plan v4", target: { kind: "patient", id: "p-kabir", label: "Kabir Malhotra" }, scope: "clinical" },
  { id: "au-15", at: at(12, "16:30"), actorId: "s-sneha", category: "payment", action: "Issued an invoice for ₹3,200 (includes ₹1,300 previous balance)", target: { kind: "invoice", id: "i2", label: "INV-2611-0412 · Harish Gowda" }, scope: "financial" },
  { id: "au-16", at: at(12, "15:00"), actorId: null, actorLabel: "Harish Gowda · patient portal", category: "document", action: "Uploaded a 2019 discharge summary — in the intake queue for review", target: { kind: "patient", id: "p-harish", label: "Harish Gowda" }, scope: "metadata", portal: { action: "Scanned a 2019 discharge summary the patient brought in" } },
  { id: "au-17", at: at(12, "11:00"), actorId: "s-sneha", category: "document", action: "Scanned a signed consent form — not yet classified", target: { kind: "patient", id: "p-tanvi", label: "Tanvi Rao" }, scope: "metadata" },
  { id: "au-18", at: at(12, "10:30"), actorId: "s-neha", category: "account", action: "Moved Ishaan Gupta from Indiranagar to HSR Layout — access review opened", target: { kind: "staff", id: "s-ishaan", label: "Ishaan Gupta" }, detail: "Old branch access is not removed automatically", scope: "account", needs: "branches" },
  { id: "au-19", at: at(12, "09:15"), actorId: "s-ananya", category: "access", action: "Opened a restricted document as treating clinician — reason recorded", target: { kind: "patient", id: "p-karthik", label: "Karthik Subramanian" }, detail: "Psychiatric evaluation · restricted", scope: "clinical" },

  // ---------- Wed 11 Nov ----------
  { id: "au-20", at: at(11, "20:40"), actorId: null, actorLabel: "Priya Venkatesh · patient portal", category: "document", action: "Uploaded a thyroid panel (issued 9 Nov) — in the intake queue for review", target: { kind: "patient", id: "p-priya", label: "Priya Venkatesh" }, scope: "metadata", portal: { action: "Scanned a thyroid panel (issued 9 Nov) the patient brought in" } },
  { id: "au-21", at: at(11, "18:30"), actorId: "s-neha", category: "export", action: "Exported the appointment list for 12–14 Nov — no clinical fields", detail: "CSV · names, times and rooms only", scope: "metadata", needs: "calendar" },

  // ---------- Tue 10 Nov ----------
  { id: "au-22", at: at(10, "16:45"), actorId: "s-sneha", category: "payment", action: "Recorded a card payment of ₹2,000 at the desk", target: { kind: "invoice", id: "i4", label: "INV-2611-0405 · Aditi Sharma" }, detail: "Approval AUTH 820193 · ••4417", scope: "financial" },
  { id: "au-23", at: at(10, "11:30"), actorId: null, actorLabel: "Arun Kumar · patient portal", category: "document", action: "Uploaded an echocardiogram report (issued 7 Nov) — in the intake queue for review", target: { kind: "patient", id: "p-arun", label: "Arun Kumar" }, scope: "metadata", portal: { action: "Scanned an echocardiogram report (issued 7 Nov) the patient brought in" } },
  { id: "au-24", at: at(10, "09:05"), actorId: "s-neha", category: "access", action: "Granted Dr. Vikram Iyer temporary cover for Dr. Sana Qureshi's patients until 18 Nov", target: { kind: "staff", id: "s-vikram", label: "Dr. Vikram Iyer" }, detail: "Approved by the clinical lead, Dr. Ananya Rao", scope: "account" },
  { id: "au-25", at: at(10, "09:00"), actorId: "s-neha", category: "account", action: "Recorded annual leave for Dr. Sana Qureshi, 10–18 Nov — reassignment task created", target: { kind: "staff", id: "s-sana", label: "Dr. Sana Qureshi" }, scope: "account" },
  { id: "au-26", at: at(10, "08:20"), actorId: "s-sneha", category: "payment", action: "Recorded a UPI payment of ₹6,500 at the desk", target: { kind: "invoice", id: "i10", label: "INV-2611-0366 · Gaurav Tiwari" }, detail: "Reference UTR 331410 220846", scope: "financial" },

  // ---------- earlier ----------
  { id: "au-27", at: at(7, "09:50"), actorId: "s-sneha", category: "payment", action: "Cash payment of ₹1,600 counted at the desk", target: { kind: "invoice", id: "i13", label: "INV-2611-0344 · Lakshmi Narayan" }, scope: "financial" },
  { id: "au-28", at: at(6, "12:05"), actorId: "s-sneha", category: "payment", action: "Recorded a UPI payment of ₹1,700 at the desk", target: { kind: "invoice", id: "i14", label: "INV-2611-0337 · Sunita Patil" }, detail: "Reference UTR 331006 451290", scope: "financial" },
  { id: "au-29", at: at(6, "11:12"), actorId: "s-sneha", category: "payment", action: "Applied a Heart Health package credit — no charge", target: { kind: "invoice", id: "i3", label: "INV-2611-0409 · Kabir Malhotra" }, scope: "financial" },
  { id: "au-30", at: at(9, "19:10", 10), actorId: "s-neha", category: "payment", action: "Refunded ₹1,600 by bank transfer for 2 unused Back Care sessions", target: { kind: "invoice", id: "i9", label: "INV-2611-0372 · Deepak Saxena" }, detail: "NEFT PRNA0910RF16", scope: "financial" },
  { id: "au-31", at: at(1, "17:30", 10), actorId: "s-neha", category: "access", action: "Completed the quarterly access review — 12 accounts confirmed", detail: "Next review due 1 Jan", scope: "account" },
];

// ---------------------------------------------------------------------------------------------
// Session log
// ---------------------------------------------------------------------------------------------

const auditStore = createSessionStore<{ events: AuditEvent[] }>("carelane.admin.audit.v1", { events: [] });

/** Append an entry for an action taken in this browser session. Nothing is sent anywhere. */
export function logAudit(e: Omit<AuditEvent, "id" | "at" | "local">) {
  const entry: AuditEvent = { ...e, id: localId("au"), at: NOW_ISO, local: true };
  auditStore.update((s) => ({ events: [entry, ...s.events] }));
  return entry.id;
}

const DESK_STAFF = ["s-sneha", "s-ishaan"];

/** A seed entry as it reads on a plan, or null when the plan doesn't include what it records. */
export function seedForPlan(e: AuditEvent, has: (f: FeatureId) => boolean): AuditEvent | null {
  if (e.needs && !has(e.needs)) return null;
  if (e.category === "payment" && !has("billing")) return null;
  if (e.category === "schedule" && !has("calendar")) return null;
  let out = e;
  // Patient-app uploads exist on Pro only; below it the patient brings the report and it's scanned.
  if (e.portal && !has("portal")) out = { ...out, actorId: "s-sneha", actorLabel: undefined, action: e.portal.action };
  // Reception is a Clinic role; on Core the admin does the desk work.
  if (out.actorId && DESK_STAFF.includes(out.actorId) && !has("calendar")) out = { ...out, actorId: "s-neha" };
  return out;
}

/** Session entries first (newest first, insertion order on the frozen demo clock), then the seed for this plan. */
export function useAuditEvents(): AuditEvent[] {
  const s = useSessionStore(auditStore);
  const { has } = usePlan();
  return useMemo(
    () => [
      ...s.events,
      ...[...AUDIT_SEED]
        .sort((a, b) => newestFirst(a.at, b.at))
        .map((e) => seedForPlan(e, has))
        .filter((e): e is AuditEvent => !!e),
    ],
    [s, has],
  );
}
