import type { ClinicalDocument } from "@/data/types";
import type { ScanKind } from "@/data/featured";

/**
 * Synthetic extras for the patient-record tabs (notes, documents, labs, imaging, vital signs).
 * Shared entities (patients, staff, care events, lab panels, vital series) are imported from
 * `@/data/*`; this module only adds what those don't carry. All values are fictional.
 */

export type RecordTab = "notes" | "documents" | "labs" | "imaging" | "vitals";

export const TAB_NOUN: Record<RecordTab, string> = {
  notes: "consultation notes",
  documents: "documents",
  labs: "lab results",
  imaging: "imaging studies",
  vitals: "vital signs",
};

export const recordHref = (patientId: string, tab?: RecordTab) => `/patients/${patientId}${tab ? `/${tab}` : ""}`;

/* ------------------------------------------------------------------ documents */

export type DocSource = ClinicalDocument["source"] | "Clinic upload";
export type DocType = ClinicalDocument["type"];

/** A clinical document as the record tabs see it: the shared shape plus preview hints. */
export type RecordDocument = Omit<ClinicalDocument, "source"> & {
  source: DocSource;
  /** care event that holds this document's structured values / summary */
  eventId?: string;
  /** one-line summary for documents without a care event */
  summary?: string;
  /** set for rows added in this browser session */
  fileName?: string;
  local?: boolean;
};

export const DOC_TYPES: DocType[] = ["Lab report", "Imaging", "Discharge summary", "Prescription", "Referral letter", "Consent form"];
export const DOC_SOURCES: DocSource[] = ["Clinic upload", "Patient upload", "Front desk scan", "Email import", "Lab partner"];

/** Shared registry documents → the care event that carries their values. */
export const DOC_EVENT: Record<string, string> = { d1: "e26-24", d10: "e26-10" };

/** Kabir's historical documents (the shared registry only holds this week's intake). */
export const EXTRA_DOCUMENTS: RecordDocument[] = [
  { id: "kd-ecg19", title: "ECG — 2019 (older report)", patientId: "p-kabir", type: "Lab report", reportDate: "2019-03-02", uploadedAt: "2026-11-10T20:30:00+05:30", uploadedBy: "Kabir Malhotra", source: "Patient upload", reviewerId: "s-ananya", dueBy: "2026-11-17T18:00:00+05:30", status: "awaiting-review", sensitivity: "standard", pages: 1, summary: "Resting 12-lead ECG from a 2019 health check. Historical — not a new test." },
  { id: "kd-rx-meto", title: "Prescription — metoprolol 50 mg", patientId: "p-kabir", type: "Prescription", reportDate: "2026-03-03", uploadedAt: "2026-03-03T11:20:00+05:30", uploadedBy: "Dr. Ananya Rao", source: "Clinic upload", reviewerId: "s-ananya", dueBy: null, status: "filed", sensitivity: "standard", pages: 1, eventId: "e26-05" },
  { id: "kd-consent", title: "Consent — Heart Health programme", patientId: "p-kabir", type: "Consent form", reportDate: "2026-09-08", uploadedAt: "2026-09-08T10:15:00+05:30", uploadedBy: "Sneha Kulkarni", source: "Front desk scan", reviewerId: null, dueBy: null, status: "filed", sensitivity: "standard", pages: 2, summary: "Programme enrolment, data-sharing within the care team, and photo consent for food logs." },
  { id: "kd-ref", title: "Referral — Heart Health programme", patientId: "p-kabir", type: "Referral letter", reportDate: "2026-08-14", uploadedAt: "2026-08-14T12:05:00+05:30", uploadedBy: "Dr. Ananya Rao", source: "Clinic upload", reviewerId: "s-ananya", dueBy: null, status: "filed", sensitivity: "standard", pages: 1, eventId: "e26-15" },
  { id: "kd-lft", title: "Lipid profile & LFT", patientId: "p-kabir", type: "Lab report", reportDate: "2026-08-16", uploadedAt: "2026-08-17T09:00:00+05:30", uploadedBy: "Lab partner · Anand Diagnostics", source: "Lab partner", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 2, eventId: "e26-16" },
  { id: "kd-tmt", title: "Treadmill stress test & echo", patientId: "p-kabir", type: "Imaging", reportDate: "2026-08-03", uploadedAt: "2026-08-03T16:10:00+05:30", uploadedBy: "Dr. Ananya Rao", source: "Clinic upload", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 3, eventId: "e26-14" },
  { id: "kd-spiro", title: "Spirometry", patientId: "p-kabir", type: "Lab report", reportDate: "2026-05-05", uploadedAt: "2026-05-06T09:00:00+05:30", uploadedBy: "Lab partner · BreathWell Labs", source: "Lab partner", reviewerId: "s-sana", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 2, eventId: "e26-r2" },
  { id: "kd-holter", title: "Holter monitor · 48 h", patientId: "p-kabir", type: "Lab report", reportDate: "2026-04-02", uploadedAt: "2026-04-04T10:00:00+05:30", uploadedBy: "Lab partner · HeartTrace", source: "Lab partner", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 6, eventId: "e26-08" },
  { id: "kd-cxr", title: "Chest X-ray · PA", patientId: "p-kabir", type: "Imaging", reportDate: "2026-02-24", uploadedAt: "2026-02-24T12:15:00+05:30", uploadedBy: "Lab partner · Clearview Imaging", source: "Lab partner", reviewerId: "s-sana", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 1, eventId: "e26-r1" },
  { id: "kd-mra", title: "MR angiography (time-of-flight)", patientId: "p-kabir", type: "Imaging", reportDate: "2026-02-10", uploadedAt: "2026-02-11T09:30:00+05:30", uploadedBy: "Lab partner · Clearview Imaging", source: "Lab partner", reviewerId: "s-sana", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 2, eventId: "e26-n1" },
  { id: "kd-mri", title: "Cardiac MRI (non-contrast)", patientId: "p-kabir", type: "Imaging", reportDate: "2026-01-14", uploadedAt: "2026-01-14T16:40:00+05:30", uploadedBy: "Lab partner · Clearview Imaging", source: "Lab partner", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 3, eventId: "e26-04" },
  { id: "kd-trop", title: "Troponin I trend", patientId: "p-kabir", type: "Lab report", reportDate: "2026-01-09", uploadedAt: "2026-01-09T18:05:00+05:30", uploadedBy: "Lab partner · Anand Diagnostics", source: "Lab partner", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 1, eventId: "e26-02" },
  { id: "kd-dis", title: "Discharge summary — St. Martha's", patientId: "p-kabir", type: "Discharge summary", reportDate: "2026-01-05", uploadedAt: "2026-01-06T15:20:00+05:30", uploadedBy: "Email import", source: "Email import", reviewerId: "s-ananya", dueBy: null, status: "reviewed", sensitivity: "standard", pages: 4, eventId: "e26-01" },
];

/* ------------------------------------------------------------------ notes */

export const LAST_VISIT = "2026-11-06T10:30:00+05:30";

export type SectionKey = "history" | "findings" | "assessment" | "advice" | "followUp";

export const NOTE_SECTIONS: { key: SectionKey; label: string; hint: string; placeholder: string }[] = [
  { key: "history", label: "History", hint: "Symptoms, interval events, adherence", placeholder: "What the patient reports since the last visit…" },
  { key: "findings", label: "Findings", hint: "Examination and today's measurements", placeholder: "BP, heart rate, examination findings…" },
  { key: "assessment", label: "Assessment", hint: "Your clinical assessment", placeholder: "Problems addressed today and their status…" },
  { key: "advice", label: "Advice", hint: "Medication and lifestyle advice", placeholder: "Advice given, medication changes…" },
  { key: "followUp", label: "Follow-up", hint: "Next review, tests, referrals", placeholder: "When and why the patient should be seen next…" },
];

/** Today's consultation (Heart Health review · week 9, 11:00) — started before the visit. */
export const SEED_DRAFT = {
  id: "draft-1113",
  title: "Heart Health review · week 9",
  createdAt: "2026-11-13T09:12:00+05:30",
  appointment: { at: "2026-11-13T11:00:00+05:30", room: "Consult 1" },
  sections: {
    history: "Feels well. Walking about 30 min on most days. No chest pain or breathlessness. Missed one yoga session (8 Nov).",
    findings: "",
    assessment: "",
    advice: "",
    followUp: "",
  } satisfies Record<SectionKey, string>,
};

export type MedReport = "taking" | "partial" | "not-taking";

/** Medication reconciliation: prescribed vs what the patient reports taking (doc §2B). */
export const MEDICATIONS: { id: string; name: string; dose: string; prescribed: string; by: string; reported: MedReport; reportedNote: string }[] = [
  { id: "m-asp", name: "Aspirin", dose: "75 mg once daily", prescribed: "2026-01-05", by: "s-ananya", reported: "taking", reportedNote: "Takes daily after breakfast" },
  { id: "m-ator", name: "Atorvastatin", dose: "40 mg at night", prescribed: "2026-04-15", by: "s-ananya", reported: "taking", reportedNote: "Takes at night" },
  { id: "m-meto", name: "Metoprolol", dose: "50 mg once daily", prescribed: "2026-03-03", by: "s-ananya", reported: "partial", reportedNote: "Occasionally misses a dose" },
  { id: "m-bud", name: "Budesonide inhaler", dose: "100 µg twice daily", prescribed: "2026-06-22", by: "s-sana", reported: "taking", reportedNote: "Morning and night" },
];
export const MED_RECONCILED = { at: "2026-09-07", by: "s-ananya", source: "Consultation note CN-26-0907" };

export type ChangeKind = "report" | "plan" | "guidance" | "missed";

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  report: "New reports",
  plan: "Plan changes",
  guidance: "Guidance",
  missed: "Missed sessions",
};

export type ChangeTarget = { tab: RecordTab; docId?: string } | { href: string; label: string };

export interface RecordChange {
  id: string;
  kind: ChangeKind;
  date: string;
  title: string;
  detail: string;
  by: string;
  target: ChangeTarget;
  selfReported?: boolean;
}

/** "What changed since I last saw this patient?" (doc §5D) — every item opens its original record. */
export const CHANGES: RecordChange[] = [
  { id: "ch-lipid", kind: "report", date: "2026-11-11", title: "Lipid profile", detail: "LDL-C 118 mg/dL (high), HDL-C 44, triglycerides 148. Reported 11 Nov, uploaded 12 Nov.", by: "lab:Anand Diagnostics", target: { tab: "documents", docId: "d1" } },
  { id: "ch-bp", kind: "report", date: "2026-11-12", title: "Home BP log · 7 days", detail: "Average 126/80 mmHg, resting HR 68.", by: "p-kabir", target: { tab: "vitals" }, selfReported: true },
  { id: "ch-ecg", kind: "report", date: "2026-11-10", title: "ECG from 2019 uploaded", detail: "Report dated 2 Mar 2019 — historical, not a new test.", by: "p-kabir", target: { tab: "documents", docId: "kd-ecg19" } },
  { id: "ch-np4", kind: "plan", date: "2026-11-12", title: "Nutrition plan v4 published", detail: "Dinner by 19:30 on office days; millet swaps added.", by: "s-meera", target: { href: "/nutrition", label: "Open nutrition plans" } },
  { id: "ch-move", kind: "plan", date: "2026-11-11", title: "Movement plan updated", detail: "Supported standing poses added; 17 of 24 sessions done.", by: "s-kavya", target: { href: "/classes", label: "Open classes" } },
  { id: "ch-ack", kind: "guidance", date: "2026-11-07", title: "Exercise guidance acknowledged", detail: "Kavya Nair confirmed: keep HR below 110 bpm, no breath retention.", by: "s-kavya", target: { href: "/patients/p-kabir", label: "Open care plan on overview" } },
  { id: "ch-miss", kind: "missed", date: "2026-11-08", title: "Missed cardiac rehab yoga · session 16", detail: "Saturday class — no reason recorded. Coordinator notified.", by: "s-kavya", target: { href: "/classes", label: "Open classes" } },
];

/* ------------------------------------------------------------------ labs */

/** Care-plan thresholds drawn on lab trends in addition to the reference limits. */
export const LAB_PLAN_THRESHOLDS: Record<string, { value: number; label: string }[]> = {
  "LDL-C": [{ value: 100, label: "Plan: review if > 100" }],
};

/* ------------------------------------------------------------------ imaging */

/** Render kinds: the shared illustrative scans plus local renders (spine MRI, unlabelled echo). */
export type StudyKind = ScanKind | "spine-mri" | "echo-plain";

export const MODALITY: Record<StudyKind, { short: string; long: string }> = {
  "cardiac-mri": { short: "MRI", long: "Cardiac MRI" },
  echo: { short: "Echo", long: "Echocardiography" },
  "echo-plain": { short: "Echo", long: "Echocardiography" },
  "brain-mra": { short: "MRA", long: "MR angiography" },
  carotid: { short: "Doppler", long: "Carotid doppler ultrasound" },
  "chest-xray": { short: "X-ray", long: "Chest radiograph" },
  "chest-ct": { short: "CT", long: "Computed tomography" },
  "spine-mri": { short: "MRI", long: "MRI · spine" },
};

/**
 * Technique lines for the featured patient's studies (they cite his own history — the contrast
 * allergy, the treadmill test). Other patients' reports don't carry a technique section.
 */
export const TECHNIQUE: Record<ScanKind, string> = {
  "cardiac-mri": "1.5 T cine SSFP, short-axis stack. No gadolinium — documented contrast allergy.",
  echo: "Transthoracic, standard views, after Bruce-protocol treadmill test.",
  "brain-mra": "3D time-of-flight MRA, circle of Willis. Non-contrast.",
  carotid: "B-mode and colour doppler, both carotid bifurcations.",
  "chest-xray": "PA erect projection.",
  "chest-ct": "Thin-section HRCT, inspiratory and expiratory. Non-contrast.",
};

/* ------------------------------------------------------------------ vitals */

export type VitalId = "bp" | "hr" | "spo2" | "weight";

export interface VitalMeta {
  label: string;
  short: string;
  unit: string;
  /** units accepted by "Add reading"; values are stored in `unit` */
  units: string[];
  range?: { low?: number; high?: number; label: string };
  thresholds?: { value: number; label: string }[];
  /** plausible input bounds (validation, not clinical ranges) */
  bounds: [number, number];
  bounds2?: [number, number];
  decimals: number;
}

export const VITAL_META: Record<VitalId, VitalMeta> = {
  bp: {
    label: "Blood pressure", short: "BP", unit: "mmHg", units: ["mmHg"],
    thresholds: [{ value: 130, label: "Systolic target < 130" }, { value: 80, label: "Diastolic target < 80" }],
    bounds: [60, 260], bounds2: [30, 160], decimals: 0,
  },
  hr: { label: "Resting heart rate", short: "Heart rate", unit: "bpm", units: ["bpm"], range: { low: 55, high: 75, label: "Target 55 – 75 bpm" }, bounds: [25, 250], decimals: 0 },
  spo2: { label: "Oxygen saturation", short: "SpO₂", unit: "%", units: ["%"], range: { low: 95, high: 100, label: "Target 95 – 100 %" }, bounds: [50, 100], decimals: 0 },
  weight: { label: "Weight", short: "Weight", unit: "kg", units: ["kg", "lb"], range: { high: 74, label: "Target ≤ 74 kg (BMI 25)" }, bounds: [20, 300], decimals: 1 },
};

export const VITAL_ORDER: VitalId[] = ["bp", "hr", "spo2", "weight"];

