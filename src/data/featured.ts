/**
 * Full synthetic record for the featured patient (Kabir Malhotra, 30).
 * Mirrors the reference dashboard: body systems → conditions → dated care events on a
 * year timeline. Every event keeps event date and entry date separate, plus author, state,
 * source record and patient-release flag (doc/explanantion.md §5C).
 */

import type { OrganKind, SystemKey } from "./anatomy";

/** Body-system ids are record-specific strings (Kabir: circulatory/nervous/respiratory). */
export type BodySystemId = string;
export type OrganShape = OrganKind;
/** Documented relationship between two events (drives journey connectors). */
export type LinkKind = "ordered" | "reviewed-in" | "led-to" | "referred" | "revised" | "follow-up";
export const LINK_LABEL: Record<LinkKind, string> = {
  ordered: "ordered",
  "reviewed-in": "reviewed in",
  "led-to": "led to",
  referred: "referred to",
  revised: "revised as",
  "follow-up": "follow-up",
};
export type CareEventType = "note" | "lab" | "vitals" | "medication" | "imaging" | "consult" | "nutrition" | "movement" | "document";
export type RecordState = "draft" | "signed" | "amended" | "completed" | "awaiting-review" | "self-reported" | "scheduled";

export interface Condition {
  id: string;
  systemId: BodySystemId;
  name: string;
  short: string;
  status: "Active" | "Remission period" | "Monitoring" | "Resolved";
  markers: number;
  since: string;
}

export interface VitalReading {
  label: string;
  value: string;
  unit: string;
  range: string;
  /** 0..1 position of the reference band within the wave chart */
  band: [number, number];
  /** wave samples normalised 0..1 */
  wave: number[];
  source: "Clinic" | "Lab" | "Home device (self-reported)";
}

export interface BodySystem {
  id: BodySystemId;
  /** anatomy system this maps to (drives organ + vitals for generated records) */
  key?: SystemKey;
  name: string;
  organ: OrganShape;
  conditionIds: string[];
  featuredConditionId: string;
  vitals: [VitalReading, VitalReading];
  records: { id: string; title: string; subtitle: string; stamp: string; eventId: string }[];
  imaging: { id: string; title: string; date: string; kind: ScanKind; eventId: string }[];
}

export type ScanKind = "cardiac-mri" | "echo" | "brain-mra" | "carotid" | "chest-xray" | "chest-ct";

export interface CareEvent {
  id: string;
  date: string; // when it happened (YYYY-MM-DD)
  enteredAt: string; // when it was recorded in Carelane (ISO)
  type: CareEventType;
  systemId: BodySystemId;
  conditionId: string;
  title: string;
  summary: string;
  authorId: string; // staff id, or patient id for self-reports, or "lab:<name>"
  authorRole: string;
  state: RecordState;
  source: string;
  released: boolean;
  weight: 1 | 2 | 3;
  values?: { label: string; value: string; unit?: string; flag?: "high" | "low" }[];
  /** documented links to later events (e.g. this consult ordered that lab) */
  links?: { to: string; kind: LinkKind }[];
}

export const CONDITIONS: Condition[] = [
  { id: "c-cad", systemId: "circulatory", name: "Coronary Artery Disease", short: "CA Disease", status: "Remission period", markers: 17, since: "2026-01-02" },
  { id: "c-nodal", systemId: "circulatory", name: "Nodal Tachycardia", short: "Nodal tachycardia", status: "Monitoring", markers: 8, since: "2025-11-20" },
  { id: "n-aneurysm", systemId: "nervous", name: "Vascular Aneurysm", short: "Aneurysm", status: "Monitoring", markers: 6, since: "2025-06-18" },
  { id: "n-athero", systemId: "nervous", name: "Atherosclerosis", short: "Atherosclerosis", status: "Active", markers: 9, since: "2026-01-14" },
  { id: "n-tga", systemId: "nervous", name: "Transient Amnesia", short: "TGA", status: "Resolved", markers: 3, since: "2025-06-17" },
  { id: "r-asthma", systemId: "respiratory", name: "Bronchial Asthma", short: "Asthma", status: "Active", markers: 11, since: "2012-04-01" },
  { id: "r-postviral", systemId: "respiratory", name: "Post-viral Syndrome", short: "Post-viral", status: "Monitoring", markers: 4, since: "2025-12-02" },
];

export const conditionById = (id: string) => CONDITIONS.find((c) => c.id === id);

const wave = (seed: number, n = 48, amp = 0.32, base = 0.5) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return +(base + amp * Math.sin(t * Math.PI * 2.2 + seed) * (0.75 + 0.25 * Math.cos(t * 7 + seed * 2))).toFixed(3);
  });

export const BODY_SYSTEMS: BodySystem[] = [
  {
    id: "circulatory", key: "cardiovascular", name: "Blood Circulatory", organ: "heart", conditionIds: ["c-cad", "c-nodal"], featuredConditionId: "c-cad",
    vitals: [
      { label: "Erythrocytes", value: "5.20", unit: "×10¹²/L", range: "4.5 – 5.9", band: [0.32, 0.7], wave: wave(0.4), source: "Lab" },
      { label: "Oxygen", value: "97", unit: "%", range: "95 – 100", band: [0.4, 0.78], wave: wave(2.1, 48, 0.26, 0.56), source: "Clinic" },
    ],
    records: [
      { id: "rec-1", title: "Acute CAD", subtitle: "Hospitalisation", stamp: "02.01", eventId: "e26-01" },
      { id: "rec-2", title: "MRI", subtitle: "Cardiologist", stamp: "14.01", eventId: "e26-04" },
    ],
    imaging: [
      { id: "img-1", title: "Cardiac MRI · short axis", date: "2026-01-14", kind: "cardiac-mri", eventId: "e26-04" },
      { id: "img-2", title: "Echocardiogram", date: "2026-08-03", kind: "echo", eventId: "e26-14" },
    ],
  },
  {
    id: "nervous", key: "neurological", name: "Nervous", organ: "brain", conditionIds: ["n-aneurysm", "n-athero", "n-tga"], featuredConditionId: "n-aneurysm",
    vitals: [
      { label: "Blood pressure", value: "128/82", unit: "mmHg", range: "< 130/80", band: [0.3, 0.62], wave: wave(1.2, 48, 0.28, 0.52), source: "Clinic" },
      { label: "MoCA score", value: "29", unit: "/ 30", range: "≥ 26", band: [0.5, 0.92], wave: wave(3.3, 48, 0.12, 0.72), source: "Clinic" },
    ],
    records: [
      { id: "rec-3", title: "MR angiography", subtitle: "Neurologist", stamp: "10.02", eventId: "e26-n1" },
      { id: "rec-4", title: "Carotid doppler", subtitle: "Radiology", stamp: "08.06", eventId: "e26-n3" },
    ],
    imaging: [
      { id: "img-3", title: "Brain MRA (non-contrast)", date: "2026-02-10", kind: "brain-mra", eventId: "e26-n1" },
      { id: "img-4", title: "Carotid doppler", date: "2026-06-08", kind: "carotid", eventId: "e26-n3" },
    ],
  },
  {
    id: "respiratory", key: "respiratory", name: "Respiratory", organ: "lungs", conditionIds: ["r-asthma", "r-postviral"], featuredConditionId: "r-asthma",
    vitals: [
      { label: "Peak flow", value: "480", unit: "L/min", range: "> 450", band: [0.42, 0.82], wave: wave(0.9, 48, 0.3, 0.55), source: "Home device (self-reported)" },
      { label: "Oxygen", value: "97", unit: "%", range: "95 – 100", band: [0.4, 0.78], wave: wave(2.1, 48, 0.26, 0.56), source: "Clinic" },
    ],
    records: [
      { id: "rec-5", title: "Spirometry", subtitle: "Pulmonology", stamp: "05.05", eventId: "e26-r2" },
      { id: "rec-6", title: "Post-viral review", subtitle: "General physician", stamp: "24.02", eventId: "e26-r1" },
    ],
    imaging: [
      { id: "img-5", title: "Chest X-ray · PA", date: "2026-02-24", kind: "chest-xray", eventId: "e26-r1" },
      { id: "img-6", title: "HRCT chest (non-contrast)", date: "2025-12-04", kind: "chest-ct", eventId: "e25-r2" },
    ],
  },
];

export const systemById = (id: BodySystemId) => BODY_SYSTEMS.find((s) => s.id === id)!;

const E = (
  id: string, date: string, entered: string, type: CareEventType, systemId: BodySystemId, conditionId: string, title: string, summary: string,
  authorId: string, authorRole: string, state: RecordState, source: string, released: boolean, weight: 1 | 2 | 3 = 2, values?: CareEvent["values"],
): CareEvent => ({ id, date, enteredAt: entered, type, systemId, conditionId, title, summary, authorId, authorRole, state, source, released, weight, values });

/** 2026 — hand-written so the circulatory year matches the reference's rhythm. */
const EVENTS_2026: CareEvent[] = [
  // January — hospitalisation and work-up
  E("e26-01", "2026-01-02", "2026-01-06T15:20:00+05:30", "document", "circulatory", "c-cad", "Hospitalisation · acute coronary syndrome", "Admitted with chest pain; NSTEMI ruled in. Single-vessel disease (LAD 70%), managed medically. Discharged day 4.", "s-ananya", "Doctor", "signed", "Discharge summary · St. Martha's (external)", true, 3),
  E("e26-02", "2026-01-09", "2026-01-09T18:05:00+05:30", "lab", "circulatory", "c-cad", "Troponin I trend", "Down-trending troponin consistent with resolving myocardial injury.", "lab:Anand Diagnostics", "Lab partner", "completed", "Lab report LR-26-0119", true, 2, [{ label: "Troponin I", value: "0.08", unit: "ng/mL", flag: "high" }]),
  E("e26-03", "2026-01-11", "2026-01-13T10:00:00+05:30", "vitals", "circulatory", "c-nodal", "Holter monitor · 24 h", "Brief runs of junctional rhythm at rest; no pauses > 2 s.", "s-ananya", "Doctor", "signed", "Device report HM-2201", false, 2),
  E("e26-04", "2026-01-14", "2026-01-14T16:40:00+05:30", "imaging", "circulatory", "c-cad", "Cardiac MRI (non-contrast)", "Preserved EF 56%. Small area of anterior wall hypokinesia. Gadolinium avoided — documented contrast allergy.", "s-ananya", "Cardiologist", "signed", "Imaging study IMG-26-014", true, 3),
  // February
  E("e26-n1", "2026-02-10", "2026-02-11T09:30:00+05:30", "imaging", "nervous", "n-aneurysm", "MR angiography (time-of-flight)", "3 mm left ICA aneurysm, unchanged from June 2025. Annual surveillance.", "s-sana", "Doctor", "signed", "Imaging study IMG-26-031", true, 3),
  E("e26-r1", "2026-02-24", "2026-02-24T12:15:00+05:30", "consult", "respiratory", "r-postviral", "Post-viral review", "Residual cough improving; chest X-ray clear.", "s-sana", "Doctor", "signed", "Consultation note CN-26-0218", true, 2),
  // March
  E("e26-05", "2026-03-03", "2026-03-03T11:20:00+05:30", "medication", "circulatory", "c-nodal", "Metoprolol 25 → 50 mg", "Dose increased for symptomatic palpitations. Review HR in 4 weeks.", "s-ananya", "Doctor", "signed", "Prescription RX-26-0303", true, 2),
  E("e26-06", "2026-03-16", "2026-03-17T09:10:00+05:30", "lab", "circulatory", "c-cad", "Lipid profile", "LDL improving on statin; target < 70 mg/dL not yet met.", "lab:Anand Diagnostics", "Lab partner", "completed", "Lab report LR-26-0316", true, 2, [{ label: "LDL-C", value: "142", unit: "mg/dL", flag: "high" }, { label: "HDL-C", value: "38", unit: "mg/dL", flag: "low" }]),
  E("e26-07", "2026-03-18", "2026-03-18T13:00:00+05:30", "note", "circulatory", "c-cad", "Cardiology follow-up", "Asymptomatic. Continue DAPT until July. Lifestyle programme discussed.", "s-ananya", "Doctor", "signed", "Consultation note CN-26-0318", true, 2),
  // April
  E("e26-08", "2026-04-02", "2026-04-04T10:00:00+05:30", "vitals", "circulatory", "c-nodal", "Holter monitor · 48 h", "Junctional runs reduced by ~60% on higher beta-blocker dose.", "s-ananya", "Doctor", "signed", "Device report HM-2214", false, 2),
  E("e26-09", "2026-04-04", "2026-04-04T17:30:00+05:30", "document", "circulatory", "c-nodal", "Holter interpretation", "Formal report filed; no indication for EP study at this time.", "s-ananya", "Doctor", "signed", "Report DOC-26-0404", true, 1),
  E("e26-10", "2026-04-15", "2026-04-15T12:20:00+05:30", "medication", "circulatory", "c-cad", "Atorvastatin 20 → 40 mg", "Up-titrated; LDL above target. LFT at next lipid check.", "s-ananya", "Doctor", "signed", "Prescription RX-26-0415", true, 2),
  // May–July
  E("e26-r2", "2026-05-05", "2026-05-06T09:00:00+05:30", "lab", "respiratory", "r-asthma", "Spirometry", "Mild obstruction, 14% reversibility. Well controlled on ICS.", "lab:BreathWell Labs", "Lab partner", "completed", "Lab report LR-26-0505", true, 2, [{ label: "FEV1/FVC", value: "0.72" }]),
  E("e26-n2", "2026-05-20", "2026-05-20T15:40:00+05:30", "consult", "nervous", "n-athero", "Neurology review", "No further amnesic episodes. Vascular risk factors addressed via cardiology plan.", "s-sana", "Doctor", "signed", "Consultation note CN-26-0520", true, 2),
  E("e26-n3", "2026-06-08", "2026-06-09T11:00:00+05:30", "imaging", "nervous", "n-athero", "Carotid doppler", "Mild bilateral intimal thickening, < 30% stenosis.", "s-sana", "Doctor", "signed", "Imaging study IMG-26-112", true, 2),
  E("e26-r3", "2026-06-22", "2026-06-22T10:30:00+05:30", "medication", "respiratory", "r-asthma", "Inhaler step-down", "Budesonide 200 → 100 µg BD after 3 months of control.", "s-sana", "Doctor", "signed", "Prescription RX-26-0622", true, 2),
  E("e26-r4", "2026-07-03", "2026-07-03T18:00:00+05:30", "note", "respiratory", "r-postviral", "Post-viral syndrome resolved", "Fatigue resolved; discharge from follow-up.", "s-sana", "Doctor", "signed", "Consultation note CN-26-0703", true, 1),
  E("e26-n4", "2026-07-15", "2026-07-15T12:00:00+05:30", "note", "nervous", "n-tga", "TGA — one-year review", "No recurrence. No driving restriction.", "s-sana", "Doctor", "signed", "Consultation note CN-26-0715", true, 1),
  // August
  E("e26-14", "2026-08-03", "2026-08-03T16:10:00+05:30", "vitals", "circulatory", "c-cad", "Treadmill stress test & echo", "Bruce protocol 11 min, no ischaemic changes. EF 58%.", "s-ananya", "Doctor", "signed", "Test report TMT-26-0803", true, 3),
  E("e26-15", "2026-08-14", "2026-08-14T11:45:00+05:30", "document", "circulatory", "c-cad", "Cardiology review", "Stopped clopidogrel (12 months post-ACS planned). Continue aspirin, statin, beta-blocker.", "s-ananya", "Doctor", "signed", "Consultation note CN-26-0814", true, 2),
  E("e26-16", "2026-08-16", "2026-08-17T09:00:00+05:30", "lab", "circulatory", "c-cad", "Lipid profile & LFT", "LDL 96 mg/dL; liver enzymes normal on 40 mg.", "lab:Anand Diagnostics", "Lab partner", "completed", "Lab report LR-26-0816", true, 2, [{ label: "LDL-C", value: "96", unit: "mg/dL", flag: "high" }, { label: "ALT", value: "28", unit: "U/L" }]),
  // September — programme start
  E("e26-17", "2026-09-07", "2026-09-07T10:20:00+05:30", "medication", "circulatory", "c-cad", "Medication reconciliation", "Patient-reported: takes atorvastatin at night, occasionally misses metoprolol. Pill organiser advised.", "s-ananya", "Doctor", "signed", "Consultation note CN-26-0907", true, 2),
  E("e26-18", "2026-09-08", "2026-09-08T10:05:00+05:30", "vitals", "circulatory", "c-nodal", "Heart Health baseline vitals", "Resting HR 78, BP 132/84, BMI 27.1, waist 94 cm.", "s-ananya", "Doctor", "signed", "Programme intake PI-26-0908", true, 2),
  E("e26-19", "2026-09-12", "2026-09-12T12:30:00+05:30", "nutrition", "circulatory", "c-cad", "Nutrition plan v1 published", "Heart-healthy vegetarian plan; oil budget 3 tsp/day; 30 g fibre target.", "s-meera", "Nutritionist", "signed", "Plan NP-KM v1", true, 2),
  E("e26-20", "2026-09-21", "2026-09-21T08:40:00+05:30", "movement", "circulatory", "c-cad", "Cardiac rehab yoga · session 3", "Tolerated well; peak HR 104 bpm. Added seated twists.", "s-kavya", "Yoga instructor", "completed", "Session log SL-0921", false, 1),
  // October
  E("e26-21", "2026-10-03", "2026-10-03T15:00:00+05:30", "nutrition", "circulatory", "c-cad", "Nutrition plan v3", "Swapped evening snack to roasted chana; dinner alternatives for late meetings.", "s-meera", "Nutritionist", "signed", "Plan NP-KM v3", true, 1),
  E("e26-n5", "2026-10-09", "2026-10-09T10:00:00+05:30", "lab", "nervous", "n-athero", "Homocysteine & hs-CRP", "Within range.", "lab:Anand Diagnostics", "Lab partner", "completed", "Lab report LR-26-1009", true, 1),
  E("e26-r5", "2026-10-19", "2026-10-19T21:00:00+05:30", "vitals", "respiratory", "r-asthma", "Peak-flow diary (self-reported)", "Morning readings 470–490 L/min for 14 days.", "p-kabir", "Patient", "self-reported", "Patient log PL-1019", true, 1),
  E("e26-22", "2026-10-24", "2026-10-24T08:45:00+05:30", "movement", "circulatory", "c-cad", "Cardiac rehab yoga · session 12", "Introduced paced breathing 4-6; HR recovery 18 bpm at 1 min.", "s-kavya", "Yoga instructor", "completed", "Session log SL-1024", false, 1),
  // November
  E("e26-23", "2026-11-06", "2026-11-06T11:05:00+05:30", "note", "circulatory", "c-cad", "Heart Health · week 8 review", "Asymptomatic, exercise tolerance improving. Repeat lipids; consider statin intensification if LDL > 100.", "s-ananya", "Doctor", "signed", "Consultation note CN-26-1106", true, 2),
  E("e26-24", "2026-11-11", "2026-11-12T18:15:00+05:30", "lab", "circulatory", "c-cad", "Lipid profile", "Reported 11 Nov, uploaded 12 Nov. Awaiting doctor review.", "lab:Anand Diagnostics", "Lab partner", "awaiting-review", "Lab report LR-26-1111", false, 3, [{ label: "LDL-C", value: "118", unit: "mg/dL", flag: "high" }, { label: "HDL-C", value: "44", unit: "mg/dL" }, { label: "Triglycerides", value: "148", unit: "mg/dL" }]),
  E("e26-25", "2026-11-12", "2026-11-12T21:10:00+05:30", "vitals", "circulatory", "c-nodal", "Home BP log (self-reported)", "7-day average 126/80, resting HR 68.", "p-kabir", "Patient", "self-reported", "Patient log PL-1112", true, 1),
  E("e26-26", "2026-11-12", "2026-11-12T17:05:00+05:30", "nutrition", "circulatory", "c-cad", "Nutrition plan v4 published", "Dinner window moved to 19:30 on office days; added millet swaps.", "s-meera", "Nutritionist", "signed", "Plan NP-KM v4", true, 2),
  // Upcoming
  E("e26-27", "2026-11-13", "2026-11-04T10:00:00+05:30", "consult", "circulatory", "c-cad", "Heart Health review · week 9", "Today 11:00 with Dr. Ananya Rao · Consult 1.", "s-sneha", "Front desk", "scheduled", "Appointment a-1100", true, 2),
  E("e26-28", "2026-12-04", "2026-11-06T11:20:00+05:30", "consult", "circulatory", "c-cad", "Programme completion review", "Week 12 — care plan review with all disciplines.", "s-farhan", "Care coordinator", "scheduled", "Appointment request", true, 2),
  E("e26-29", "2026-12-18", "2026-11-06T11:25:00+05:30", "vitals", "circulatory", "c-cad", "Repeat stress test", "Booked at partner lab.", "s-farhan", "Care coordinator", "scheduled", "External booking", false, 2),
  E("e26-n6", "2026-12-09", "2026-11-01T10:00:00+05:30", "imaging", "nervous", "n-aneurysm", "Annual MRA surveillance", "Non-contrast TOF MRA.", "s-sana", "Doctor", "scheduled", "Imaging request", false, 2),
  E("e26-r6", "2026-12-15", "2026-11-01T10:05:00+05:30", "consult", "respiratory", "r-asthma", "Asthma review", "Winter action plan.", "s-sana", "Doctor", "scheduled", "Appointment request", true, 1),
];

// ---------- earlier years: seeded, lighter ----------
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEMPLATES: { systemId: BodySystemId; conditionId: string; type: CareEventType; title: string; summary: string; author: string; role: string }[] = [
  { systemId: "circulatory", conditionId: "c-nodal", type: "vitals", title: "Resting ECG", summary: "Sinus rhythm with occasional junctional beats.", author: "s-ananya", role: "Doctor" },
  { systemId: "circulatory", conditionId: "c-nodal", type: "consult", title: "Palpitations review", summary: "Lifestyle triggers discussed; caffeine reduced.", author: "s-ananya", role: "Doctor" },
  { systemId: "circulatory", conditionId: "c-cad", type: "lab", title: "Lipid profile", summary: "LDL elevated; dietary advice given.", author: "lab:Anand Diagnostics", role: "Lab partner" },
  { systemId: "circulatory", conditionId: "c-cad", type: "medication", title: "Medication review", summary: "No changes.", author: "s-ananya", role: "Doctor" },
  { systemId: "circulatory", conditionId: "c-cad", type: "document", title: "Annual health check", summary: "BP borderline; BMI 27.", author: "s-sana", role: "Doctor" },
  { systemId: "nervous", conditionId: "n-tga", type: "document", title: "ER visit · transient amnesia", summary: "6-hour episode of anterograde amnesia; CT normal; TGA diagnosed.", author: "s-sana", role: "Doctor" },
  { systemId: "nervous", conditionId: "n-aneurysm", type: "imaging", title: "MR angiography", summary: "Incidental 3 mm left ICA aneurysm.", author: "s-sana", role: "Doctor" },
  { systemId: "nervous", conditionId: "n-athero", type: "consult", title: "Neurology consult", summary: "Vascular risk review.", author: "s-sana", role: "Doctor" },
  { systemId: "respiratory", conditionId: "r-asthma", type: "medication", title: "Inhaler renewal", summary: "Budesonide/formoterol continued.", author: "s-sana", role: "Doctor" },
  { systemId: "respiratory", conditionId: "r-asthma", type: "vitals", title: "Peak-flow diary (self-reported)", summary: "Seasonal dip in October.", author: "p-kabir", role: "Patient" },
  { systemId: "respiratory", conditionId: "r-postviral", type: "consult", title: "Viral bronchitis", summary: "Persistent cough 5 weeks after viral illness.", author: "s-sana", role: "Doctor" },
];

function generateYear(year: number, count: number, seed: number): CareEvent[] {
  const rand = mulberry32(seed);
  const out: CareEvent[] = [];
  for (let i = 0; i < count; i++) {
    const t = TEMPLATES[Math.floor(rand() * TEMPLATES.length)];
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 27);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const selfReported = t.author.startsWith("p-");
    out.push(
      E(`e${year % 100}-${i}`, date, `${date}T${String(9 + Math.floor(rand() * 9)).padStart(2, "0")}:00:00+05:30`, t.type, t.systemId, t.conditionId, t.title, t.summary,
        t.author, t.role, selfReported ? "self-reported" : t.type === "lab" ? "completed" : "signed", `Archive ${year}-${100 + i}`, true, (1 + Math.floor(rand() * 3)) as 1 | 2 | 3),
    );
  }
  // fixed anchors referenced elsewhere
  if (year === 2025) {
    out.push(E("e25-n1", "2025-06-17", "2025-06-17T22:00:00+05:30", "document", "nervous", "n-tga", "ER visit · transient global amnesia", "Six-hour amnesic episode; CT and MRI DWI normal. Diagnosis: TGA.", "s-sana", "Doctor", "signed", "External ER summary", true, 3));
    out.push(E("e25-r2", "2025-12-04", "2025-12-04T12:00:00+05:30", "imaging", "respiratory", "r-postviral", "HRCT chest (non-contrast)", "No interstitial change; mild bronchial wall thickening.", "s-sana", "Doctor", "signed", "Imaging study IMG-25-302", true, 2));
  }
  return out;
}

/** Documented relationships in Kabir's 2026 record (who ordered what, what led to which change). */
const LINKS_2026: [string, string, LinkKind][] = [
  ["e26-01", "e26-02", "ordered"],
  ["e26-01", "e26-03", "ordered"],
  ["e26-01", "e26-04", "ordered"],
  ["e26-03", "e26-05", "led-to"],
  ["e26-06", "e26-07", "reviewed-in"],
  ["e26-07", "e26-08", "ordered"],
  ["e26-08", "e26-09", "reviewed-in"],
  ["e26-07", "e26-10", "led-to"],
  ["e26-14", "e26-15", "reviewed-in"],
  ["e26-15", "e26-16", "ordered"],
  ["e26-15", "e26-17", "follow-up"],
  ["e26-17", "e26-18", "referred"],
  ["e26-17", "e26-19", "referred"],
  ["e26-17", "e26-20", "referred"],
  ["e26-19", "e26-21", "revised"],
  ["e26-20", "e26-22", "follow-up"],
  ["e26-21", "e26-26", "revised"],
  ["e26-22", "e26-23", "reviewed-in"],
  ["e26-23", "e26-24", "ordered"],
  ["e26-24", "e26-27", "reviewed-in"],
  ["e26-25", "e26-27", "reviewed-in"],
  ["e26-27", "e26-28", "follow-up"],
  ["e26-27", "e26-29", "ordered"],
  ["e26-n1", "e26-n6", "follow-up"],
  ["e26-n2", "e26-n3", "ordered"],
  ["e26-r1", "e26-r4", "follow-up"],
  ["e26-r2", "e26-r3", "led-to"],
  ["e26-r3", "e26-r6", "follow-up"],
];
for (const [from, to, kind] of LINKS_2026) {
  const e = EVENTS_2026.find((x) => x.id === from);
  if (e) (e.links ??= []).push({ to, kind });
}

export const CARE_EVENTS: CareEvent[] = [...EVENTS_2026, ...generateYear(2025, 26, 2025), ...generateYear(2024, 18, 2024)].sort((a, b) => a.date.localeCompare(b.date));

export const TIMELINE_YEARS = [2026, 2025, 2024] as const;

export const eventsForYear = (year: number) => CARE_EVENTS.filter((e) => e.date.startsWith(String(year)));

export const RECORD_STATE_LABEL: Record<RecordState, string> = {
  draft: "Draft",
  signed: "Signed",
  amended: "Amended",
  completed: "Completed",
  "awaiting-review": "Awaiting review",
  "self-reported": "Self-reported",
  scheduled: "Scheduled",
};

export const EVENT_TYPE_LABEL: Record<CareEventType, string> = {
  note: "Clinical note",
  lab: "Lab result",
  vitals: "Vitals & tests",
  medication: "Medication",
  imaging: "Imaging",
  consult: "Consultation",
  nutrition: "Nutrition",
  movement: "Movement",
  document: "Document",
};

/** Shared care plan (doc §5A) — the link between the portals. */
export const CARE_PLAN = {
  goal: "Return to full-time work and 30 minutes of daily activity without symptoms; LDL-C below 70 mg/dL by March 2027.",
  episode: "Heart Health · 12 weeks (week 9 of 12)",
  responsible: "s-ananya",
  medical: { text: "Aspirin 75 mg, atorvastatin 40 mg, metoprolol 50 mg. Keep exercise HR below 110 bpm. No breath retention practices.", by: "s-ananya", updated: "2026-11-06" },
  nutrition: { text: "Plan v4 · heart-healthy vegetarian, 2,100 kcal, oil 3 tsp/day, 30 g fibre. Dinner by 19:30 on office days.", by: "s-meera", updated: "2026-11-12" },
  movement: { text: "Cardiac rehab yoga 3× weekly (17 of 24 sessions). Paced breathing 4-6, seated twists, supported standing poses.", by: "s-kavya", updated: "2026-11-11" },
  nextReview: { at: "2026-12-04T11:00:00+05:30", with: "s-ananya", label: "Programme completion review" },
  actions: [
    { id: "ca1", label: "Review lipid profile from 11 Nov", owner: "s-ananya", due: "2026-11-13", status: "open" as const },
    { id: "ca2", label: "Log home BP for 7 days", owner: "p-kabir", due: "2026-11-19", status: "in-progress" as const },
    { id: "ca3", label: "Book repeat stress test", owner: "s-farhan", due: "2026-11-15", status: "done" as const },
    { id: "ca4", label: "Swap Saturday class (patient request)", owner: "s-kavya", due: "2026-11-14", status: "open" as const },
  ],
};

/** Consultation notes for the Notes tab (split view). */
export const NOTES = [
  {
    id: "note-1106", date: "2026-11-06T10:30:00+05:30", authorId: "s-ananya", title: "Heart Health · week 8 review", state: "signed" as RecordState, signedAt: "2026-11-06T11:05:00+05:30", released: true,
    sections: {
      history: "No chest pain or breathlessness. Walking 25 min daily. Occasional palpitations after coffee.",
      findings: "BP 128/82, HR 70 regular, BMI 26.4. Chest clear.",
      assessment: "CAD — stable, in remission period. Nodal tachycardia — well controlled.",
      advice: "Continue current medication. Limit coffee to 1 cup before noon. Repeat lipid profile.",
      followUp: "Review 13 Nov with lipid results.",
    },
    addenda: [{ at: "2026-11-07T09:10:00+05:30", by: "s-ananya", text: "Correction: walking 25 min daily (not 35 as dictated)." }],
  },
  {
    id: "note-0814", date: "2026-08-14T11:00:00+05:30", authorId: "s-ananya", title: "Cardiology review", state: "signed" as RecordState, signedAt: "2026-08-14T11:45:00+05:30", released: true,
    sections: {
      history: "Completed 12 months since ACS. No angina.",
      findings: "TMT negative for ischaemia, EF 58%.",
      assessment: "Stable CAD.",
      advice: "Stop clopidogrel. Continue aspirin, atorvastatin 40 mg, metoprolol 50 mg.",
      followUp: "Refer to Heart Health programme (nutrition + yoga).",
    },
    addenda: [],
  },
  {
    id: "note-0318", date: "2026-03-18T12:30:00+05:30", authorId: "s-ananya", title: "Cardiology follow-up", state: "signed" as RecordState, signedAt: "2026-03-18T13:00:00+05:30", released: true,
    sections: {
      history: "Palpitations improved on metoprolol 50 mg.",
      findings: "BP 134/86, HR 66.",
      assessment: "CAD, nodal tachycardia.",
      advice: "Continue DAPT until July.",
      followUp: "Lipids in 4 weeks.",
    },
    addenda: [],
  },
];

/** Lab panels with history for the Labs tab. Values are synthetic. */
export const LAB_PANELS = [
  {
    id: "lipid", name: "Lipid profile", unitNote: "mg/dL",
    analytes: [
      { name: "LDL-C", unit: "mg/dL", range: "< 70 (target)", points: [{ d: "2026-01-09", v: 168 }, { d: "2026-03-16", v: 142 }, { d: "2026-08-16", v: 96 }, { d: "2026-11-11", v: 118 }], high: 70 },
      { name: "HDL-C", unit: "mg/dL", range: "> 40", points: [{ d: "2026-01-09", v: 34 }, { d: "2026-03-16", v: 38 }, { d: "2026-08-16", v: 42 }, { d: "2026-11-11", v: 44 }], low: 40 },
      { name: "Triglycerides", unit: "mg/dL", range: "< 150", points: [{ d: "2026-01-09", v: 212 }, { d: "2026-03-16", v: 188 }, { d: "2026-08-16", v: 151 }, { d: "2026-11-11", v: 148 }], high: 150 },
    ],
  },
  {
    id: "cbc", name: "Complete blood count", unitNote: "",
    analytes: [
      { name: "Haemoglobin", unit: "g/dL", range: "13.5 – 17.5", points: [{ d: "2026-01-09", v: 14.1 }, { d: "2026-08-16", v: 14.6 }, { d: "2026-11-11", v: 14.8 }], low: 13.5, high: 17.5 },
      { name: "Erythrocytes", unit: "×10¹²/L", range: "4.5 – 5.9", points: [{ d: "2026-01-09", v: 4.9 }, { d: "2026-08-16", v: 5.1 }, { d: "2026-11-11", v: 5.2 }], low: 4.5, high: 5.9 },
      { name: "Platelets", unit: "×10⁹/L", range: "150 – 410", points: [{ d: "2026-01-09", v: 262 }, { d: "2026-08-16", v: 248 }, { d: "2026-11-11", v: 255 }], low: 150, high: 410 },
    ],
  },
  {
    id: "metabolic", name: "Metabolic & liver", unitNote: "",
    analytes: [
      { name: "HbA1c", unit: "%", range: "< 5.7", points: [{ d: "2026-01-09", v: 5.6 }, { d: "2026-08-16", v: 5.5 }], high: 5.7 },
      { name: "ALT", unit: "U/L", range: "< 45", points: [{ d: "2026-04-28", v: 31 }, { d: "2026-08-16", v: 28 }], high: 45 },
      { name: "Creatinine", unit: "mg/dL", range: "0.7 – 1.3", points: [{ d: "2026-01-09", v: 0.92 }, { d: "2026-08-16", v: 0.95 }], low: 0.7, high: 1.3 },
    ],
  },
];

/** Vital sign series for the Vital Signs tab. `self` marks patient-reported values. */
export const VITAL_SERIES = [
  { id: "bp", name: "Blood pressure", unit: "mmHg", target: "< 130/80", points: [
    { d: "2026-01-09", v: 142, v2: 90, self: false }, { d: "2026-03-18", v: 134, v2: 86, self: false }, { d: "2026-05-20", v: 131, v2: 84, self: false },
    { d: "2026-08-14", v: 130, v2: 84, self: false }, { d: "2026-09-08", v: 132, v2: 84, self: false }, { d: "2026-10-10", v: 129, v2: 82, self: true },
    { d: "2026-11-06", v: 128, v2: 82, self: false }, { d: "2026-11-12", v: 126, v2: 80, self: true } ] },
  { id: "hr", name: "Resting heart rate", unit: "bpm", target: "55 – 75", points: [
    { d: "2026-01-09", v: 92, self: false }, { d: "2026-03-18", v: 66, self: false }, { d: "2026-05-20", v: 72, self: false }, { d: "2026-08-14", v: 70, self: false },
    { d: "2026-09-08", v: 78, self: false }, { d: "2026-10-10", v: 72, self: true }, { d: "2026-11-06", v: 70, self: false }, { d: "2026-11-12", v: 68, self: true } ] },
  { id: "spo2", name: "Oxygen saturation", unit: "%", target: "95 – 100", points: [
    { d: "2026-01-09", v: 95, self: false }, { d: "2026-03-18", v: 97, self: false }, { d: "2026-08-14", v: 98, self: false }, { d: "2026-11-06", v: 97, self: false } ] },
  { id: "weight", name: "Weight", unit: "kg", target: "≤ 74 kg (BMI 25)", points: [
    { d: "2026-01-09", v: 84.2, self: false }, { d: "2026-03-18", v: 82.9, self: false }, { d: "2026-05-20", v: 81.6, self: false }, { d: "2026-08-14", v: 80.1, self: false },
    { d: "2026-09-08", v: 80.4, self: false }, { d: "2026-10-10", v: 79.0, self: true }, { d: "2026-11-06", v: 78.3, self: false } ] },
];
