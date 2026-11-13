import type { ClinicalDocument, Invoice, MessageThread } from "./types";

/** Synthetic document intake/review queue, message threads and invoices. */

export const DOCUMENTS: ClinicalDocument[] = [
  { id: "d1", title: "Lipid profile", patientId: "p-kabir", type: "Lab report", reportDate: "2026-11-11", uploadedAt: "2026-11-12T18:15:00+05:30", uploadedBy: "Lab partner · Anand Diagnostics", source: "Lab partner", reviewerId: "s-ananya", dueBy: "2026-11-13T18:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 2 },
  { id: "d2", title: "Scanned report — patient not matched", patientId: null, type: "Lab report", reportDate: "2026-10-29", uploadedAt: "2026-11-13T09:02:00+05:30", uploadedBy: "Sneha Kulkarni", source: "Front desk scan", reviewerId: null, dueBy: null, status: "unclassified", sensitivity: "standard", pages: 3 },
  { id: "d3", title: "Echocardiogram report", patientId: "p-arun", type: "Imaging", reportDate: "2026-11-07", uploadedAt: "2026-11-10T11:30:00+05:30", uploadedBy: "Arun Kumar", source: "Patient upload", reviewerId: "s-ananya", dueBy: "2026-11-12T18:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 4 },
  { id: "d4", title: "Discharge summary — Apollo (2019)", patientId: "p-harish", type: "Discharge summary", reportDate: "2019-06-14", uploadedAt: "2026-11-12T15:00:00+05:30", uploadedBy: "Harish Gowda", source: "Patient upload", reviewerId: "s-ananya", dueBy: "2026-11-19T18:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 6 },
  { id: "d5", title: "HbA1c & fasting glucose", patientId: "p-rajesh", type: "Lab report", reportDate: "2026-10-20", uploadedAt: "2026-10-21T09:10:00+05:30", uploadedBy: "Lab partner · Anand Diagnostics", source: "Lab partner", reviewerId: "s-vikram", dueBy: "2026-10-23T18:00:00+05:30", status: "reviewed", sensitivity: "standard", pages: 1 },
  { id: "d6", title: "Thyroid panel (TSH, FT4)", patientId: "p-priya", type: "Lab report", reportDate: "2026-11-09", uploadedAt: "2026-11-11T20:40:00+05:30", uploadedBy: "Priya Venkatesh", source: "Patient upload", reviewerId: "s-vikram", dueBy: "2026-11-13T14:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 1 },
  { id: "d7", title: "Psychiatric evaluation", patientId: "p-karthik", type: "Referral letter", reportDate: "2026-10-15", uploadedAt: "2026-10-16T10:00:00+05:30", uploadedBy: "Email import", source: "Email import", reviewerId: "s-ananya", dueBy: null, status: "filed", sensitivity: "restricted", pages: 3 },
  { id: "d8", title: "Spirometry", patientId: "p-rekha", type: "Lab report", reportDate: "2026-11-12", uploadedAt: "2026-11-12T19:00:00+05:30", uploadedBy: "Lab partner · BreathWell Labs", source: "Lab partner", reviewerId: "s-sana", dueBy: "2026-11-13T12:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 2 },
  { id: "d9", title: "Consent — programme enrolment", patientId: "p-tanvi", type: "Consent form", reportDate: "2026-11-12", uploadedAt: "2026-11-12T11:00:00+05:30", uploadedBy: "Sneha Kulkarni", source: "Front desk scan", reviewerId: null, dueBy: "2026-11-13T16:00:00+05:30", status: "unclassified", sensitivity: "standard", pages: 1 },
  { id: "d10", title: "Prescription renewal — atorvastatin 40 mg", patientId: "p-kabir", type: "Prescription", reportDate: "2026-09-08", uploadedAt: "2026-09-08T10:40:00+05:30", uploadedBy: "Dr. Ananya Rao", source: "Email import", reviewerId: "s-ananya", dueBy: null, status: "filed", sensitivity: "standard", pages: 1 },
  { id: "d11", title: "MRI lumbar spine", patientId: "p-fatima", type: "Imaging", reportDate: "2026-10-02", uploadedAt: "2026-10-05T09:30:00+05:30", uploadedBy: "Fatima Khan", source: "Patient upload", reviewerId: "s-sana", dueBy: "2026-10-08T18:00:00+05:30", status: "reviewed", sensitivity: "standard", pages: 5 },
  { id: "d12", title: "CBC & ferritin", patientId: "p-tanvi", type: "Lab report", reportDate: "2026-11-10", uploadedAt: "2026-11-12T10:30:00+05:30", uploadedBy: "Tanvi Rao", source: "Patient upload", reviewerId: "s-vikram", dueBy: "2026-11-13T16:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 2 },
];

export const DOC_STATUS_LABEL = {
  unclassified: "Needs identification",
  "awaiting-review": "Awaiting review",
  reviewed: "Reviewed",
  filed: "Filed",
} as const;

export const THREADS: MessageThread[] = [
  { id: "m1", subject: "Swap Saturday class?", patientId: "p-kabir", participants: ["p-kabir", "s-kavya", "s-farhan"], lastMessage: "Can I swap the Saturday class for Sunday this week?", lastAt: "2026-11-13T07:55:00+05:30", unread: 1, channel: "patient", expectedResponse: "Reply within 1 working day" },
  { id: "m2", subject: "Arun — dizziness in class", patientId: "p-arun", participants: ["s-kavya", "s-ananya", "s-farhan"], lastMessage: "Seated variations only until you review, please confirm.", lastAt: "2026-11-13T08:10:00+05:30", unread: 2, channel: "care-team", expectedResponse: "Care team · same day" },
  { id: "m3", subject: "Food log photos this week", patientId: "p-sameer", participants: ["p-sameer", "s-rohan"], lastMessage: "Uploaded 6 photos — weekend was tough!", lastAt: "2026-11-12T21:30:00+05:30", unread: 0, channel: "patient", expectedResponse: "Reply within 2 working days" },
  { id: "m4", subject: "Rekha — new SpO₂ floor", patientId: "p-rekha", participants: ["s-vikram", "s-lakshmi", "s-farhan"], lastMessage: "Covering for Dr. Sana: raised floor to 92% after spirometry. Please adapt today's session.", lastAt: "2026-11-13T08:44:00+05:30", unread: 1, channel: "care-team", expectedResponse: "Care team · same day" },
  { id: "m5", subject: "Invoice question", patientId: "p-neelam", participants: ["p-neelam", "s-sneha"], lastMessage: "Was the October session included in the package?", lastAt: "2026-11-11T14:20:00+05:30", unread: 0, channel: "patient", expectedResponse: "Reply within 1 working day" },
  { id: "m6", subject: "Plan v4 — dinner timing", patientId: "p-kabir", participants: ["p-kabir", "s-meera"], lastMessage: "Moved dinner alternatives to 19:30 on office days.", lastAt: "2026-11-12T17:12:00+05:30", unread: 0, channel: "patient", expectedResponse: "Reply within 1 working day" },
  { id: "m7", subject: "Cover for Dr. Sana's patients", patientId: null, participants: ["s-neha", "s-vikram", "s-farhan"], lastMessage: "I can take the two urgent reviews on Monday.", lastAt: "2026-11-12T19:05:00+05:30", unread: 0, channel: "care-team", expectedResponse: "Internal" },
  { id: "m8", subject: "Reschedule request", patientId: "p-fatima", participants: ["p-fatima", "s-ishaan"], lastMessage: "Could I move Friday to 18:30?", lastAt: "2026-11-12T09:40:00+05:30", unread: 0, channel: "patient", expectedResponse: "Reply within 1 working day" },
];

export const INVOICES: Invoice[] = [
  { id: "i1", number: "INV-2611-0418", patientId: "p-vivek", issuedAt: "2026-11-13T10:05:00+05:30", items: [{ label: "Follow-up consultation", amount: 900 }], total: 900, paid: 0, status: "due", method: null },
  { id: "i2", number: "INV-2611-0412", patientId: "p-harish", issuedAt: "2026-11-12T16:30:00+05:30", items: [{ label: "Cardiology review", amount: 1500 }, { label: "ECG", amount: 400 }, { label: "Previous balance", amount: 1300 }], total: 3200, paid: 0, status: "failed", method: "UPI" },
  { id: "i3", number: "INV-2611-0409", patientId: "p-kabir", issuedAt: "2026-11-06T11:10:00+05:30", items: [{ label: "Heart Health · week 8 review", amount: 0 }, { label: "Package credit applied", amount: 0 }], total: 0, paid: 0, status: "paid", method: "Package credit" },
  { id: "i4", number: "INV-2611-0405", patientId: "p-aditi", issuedAt: "2026-11-10T16:40:00+05:30", items: [{ label: "PCOS review", amount: 1200 }, { label: "Nutrition follow-up", amount: 800 }], total: 2000, paid: 2000, status: "paid", method: "Card" },
  { id: "i5", number: "INV-2611-0398", patientId: "p-rajesh", issuedAt: "2026-10-21T11:45:00+05:30", items: [{ label: "Diabetes review", amount: 1200 }, { label: "HbA1c", amount: 600 }, { label: "Nutrition plan", amount: 1200 }], total: 3000, paid: 600, status: "overdue", method: "Cash" },
  { id: "i6", number: "INV-2611-0391", patientId: "p-arun", issuedAt: "2026-10-30T12:40:00+05:30", items: [{ label: "Cardiac rehab review", amount: 1500 }, { label: "Lipid profile", amount: 900 }], total: 2400, paid: 600, status: "partially-paid", method: "UPI" },
  { id: "i7", number: "INV-2611-0387", patientId: "p-meenakshi", issuedAt: "2026-10-31T10:00:00+05:30", items: [{ label: "Rheumatology consult", amount: 1500 }], total: 1500, paid: 0, status: "due", method: null },
  { id: "i8", number: "INV-2611-0380", patientId: "p-neelam", issuedAt: "2026-10-28T11:30:00+05:30", items: [{ label: "Consultation", amount: 900 }], total: 900, paid: 0, status: "overdue", method: null },
  { id: "i9", number: "INV-2611-0372", patientId: "p-deepak", issuedAt: "2026-10-09T19:00:00+05:30", items: [{ label: "Back Care · unused sessions", amount: -1600 }], total: -1600, paid: -1600, status: "refunded", method: "Bank transfer" },
  { id: "i10", number: "INV-2611-0366", patientId: "p-gaurav", issuedAt: "2026-11-10T08:15:00+05:30", items: [{ label: "Weight Management · month 6", amount: 6500 }], total: 6500, paid: 6500, status: "paid", method: "UPI" },
  { id: "i11", number: "INV-2611-0359", patientId: "p-ishita", issuedAt: "2026-11-09T10:40:00+05:30", items: [{ label: "Prenatal yoga · 4 sessions", amount: 3200 }], total: 3200, paid: 3200, status: "paid", method: "Card" },
  { id: "i12", number: "INV-2611-0351", patientId: "p-sameer", issuedAt: "2026-11-12T19:30:00+05:30", items: [{ label: "Metabolic Reset · review", amount: 1200 }], total: 1200, paid: 1200, status: "paid", method: "UPI" },
  { id: "i13", number: "INV-2611-0344", patientId: "p-lakshmi-n", issuedAt: "2026-11-07T09:45:00+05:30", items: [{ label: "Consultation", amount: 900 }, { label: "Vitamin D test", amount: 700 }], total: 1600, paid: 1600, status: "paid", method: "Cash" },
  { id: "i14", number: "INV-2611-0337", patientId: "p-sunita", issuedAt: "2026-11-06T12:00:00+05:30", items: [{ label: "BP & renal follow-up", amount: 1200 }, { label: "Creatinine, eGFR", amount: 500 }], total: 1700, paid: 1700, status: "paid", method: "UPI" },
];

// Payment attempts (only confirmed ones count as collected; the failed UPI callback is not)
const PAY: Record<string, Invoice["payments"]> = {
  "INV-2611-0412": [{ at: "2026-11-12T16:34:00+05:30", amount: 3200, method: "UPI", confirmed: false }],
  "INV-2611-0405": [{ at: "2026-11-10T16:45:00+05:30", amount: 2000, method: "Card", confirmed: true }],
  "INV-2611-0398": [{ at: "2026-10-21T11:50:00+05:30", amount: 600, method: "Cash", confirmed: true }],
  "INV-2611-0391": [{ at: "2026-10-30T12:45:00+05:30", amount: 600, method: "UPI", confirmed: true }],
  "INV-2611-0366": [{ at: "2026-11-10T08:20:00+05:30", amount: 6500, method: "UPI", confirmed: true }],
  "INV-2611-0359": [{ at: "2026-11-13T08:52:00+05:30", amount: 3200, method: "Card", confirmed: true }],
  "INV-2611-0351": [{ at: "2026-11-12T19:35:00+05:30", amount: 1200, method: "UPI", confirmed: true }],
  "INV-2611-0344": [{ at: "2026-11-07T09:50:00+05:30", amount: 1600, method: "Cash", confirmed: true }],
  "INV-2611-0337": [{ at: "2026-11-06T12:05:00+05:30", amount: 1700, method: "UPI", confirmed: true }],
  "INV-2611-0372": [{ at: "2026-10-09T19:10:00+05:30", amount: -1600, method: "Bank transfer", confirmed: true }],
};
for (const inv of INVOICES) inv.payments = PAY[inv.number] ?? [];

/** Confirmed collections between two ISO timestamps (default: today). */
export function collected(from = "2026-11-13T00:00:00+05:30", to = "2026-11-13T23:59:59+05:30") {
  return INVOICES.flatMap((i) => i.payments ?? []).filter((p) => p.confirmed && p.at >= from && p.at <= to).reduce((s, p) => s + p.amount, 0);
}

export const INVOICE_STATUS_LABEL = {
  paid: "Paid",
  "partially-paid": "Partially paid",
  due: "Due",
  overdue: "Overdue",
  refunded: "Refunded",
  failed: "Payment not confirmed",
} as const;
