/**
 * Patient record builder. Kabir (featured) uses his hand-written record. Every other patient
 * gets a record DERIVED from their own data — never random decoration:
 *  - body systems & organs from their recorded conditions (anatomy.ts),
 *  - condition-specific monitoring (HbA1c for diabetes, TSH for thyroid, eGFR for CKD…) with
 *    trends that move the way treatment would move them, ending at the values in their notes,
 *  - their real appointments, documents, referrals, nutrition plans and class attendance from
 *    the shared fixtures, and documented links (ordered → result → reviewed in → led to).
 * Deterministic (seeded by patient id), so server and client always agree.
 */
import { SYSTEM_INFO, organForSystem, patientSystems, type SystemKey } from "./anatomy";
import { BODY_SYSTEMS, CARE_EVENTS, CARE_PLAN, CONDITIONS, type BodySystem, type CareEvent, type CareEventType, type Condition, type LinkKind, type VitalReading } from "./featured";
import { PATIENTS, FEATURED_PATIENT_ID, patientById } from "./patients";
import { WEEK_APPOINTMENTS } from "./appointments";
import { DOCUMENTS } from "./records";
import { REFERRALS, TASKS } from "./care";
import { CLASSES, NUTRITION_PLANS } from "./programs";
import { STAFF } from "./staff";
import type { Patient } from "./types";

export interface CarePlanLite {
  goal: string;
  episode: string;
  responsible: string | undefined;
  medical: { text: string; by: string; updated: string } | null;
  nutrition: { text: string; by: string; updated: string } | null;
  movement: { text: string; by: string; updated: string } | null;
  nextReview: { at: string; with: string; label: string } | null;
  actions: { id: string; label: string; owner: string; due: string; status: "open" | "in-progress" | "done" }[];
}

export interface PatientRecord {
  patientId: string;
  systems: BodySystem[];
  conditions: Condition[];
  events: CareEvent[];
  /** years that have events, newest first (max 3) */
  years: number[];
  carePlan: CarePlanLite | null;
  generated: boolean;
}

const TODAY_ISO = "2026-11-13";

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const addMonths = (iso: string, m: number, day?: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  if (day) d.setUTCDate(Math.min(28, day));
  return d.toISOString().slice(0, 10);
};
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Monitoring protocol per body system: what gets measured, how often, and how it trends. */
type Measure = { type: CareEventType; title: string; label: string; unit: string; start: number; end: number; low?: number; high?: number; every: number; author: "lab" | "doctor" | "patient" | "nutritionist" | "yoga"; decimals?: number };
const MEASURES: Record<SystemKey, Measure[]> = {
  cardiovascular: [
    { type: "vitals", title: "Blood pressure review", label: "Systolic BP", unit: "mmHg", start: 152, end: 132, high: 130, every: 2, author: "doctor" },
    { type: "lab", title: "Lipid profile", label: "LDL-C", unit: "mg/dL", start: 162, end: 108, high: 100, every: 4, author: "lab" },
  ],
  respiratory: [
    { type: "lab", title: "Spirometry", label: "FEV1/FVC", unit: "ratio", start: 0.6, end: 0.64, low: 0.7, every: 6, author: "lab", decimals: 2 },
    { type: "vitals", title: "Peak-flow diary (self-reported)", label: "Peak flow", unit: "L/min", start: 290, end: 340, low: 350, every: 2, author: "patient" },
  ],
  neurological: [
    { type: "vitals", title: "Headache diary (self-reported)", label: "Headache days / month", unit: "days", start: 9, end: 4, high: 4, every: 2, author: "patient" },
    { type: "consult", title: "Neurology review", label: "Sleep", unit: "h/night", start: 5.5, end: 6.8, low: 7, every: 4, author: "doctor", decimals: 1 },
  ],
  renal: [
    { type: "lab", title: "Kidney function (eGFR)", label: "eGFR", unit: "mL/min/1.73m²", start: 74, end: 68, low: 60, every: 3, author: "lab" },
    { type: "lab", title: "Urine albumin:creatinine", label: "uACR", unit: "mg/g", start: 46, end: 31, high: 30, every: 6, author: "lab" },
  ],
  hepatic: [
    { type: "lab", title: "Liver function tests", label: "ALT", unit: "U/L", start: 82, end: 51, high: 45, every: 3, author: "lab" },
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 92, end: 86.5, every: 1, author: "nutritionist", decimals: 1 },
  ],
  haematology: [
    { type: "lab", title: "CBC & ferritin", label: "Haemoglobin", unit: "g/dL", start: 9.8, end: 11.6, low: 12, every: 2, author: "lab", decimals: 1 },
    { type: "lab", title: "Iron studies", label: "Ferritin", unit: "ng/mL", start: 9, end: 24, low: 30, every: 3, author: "lab" },
  ],
  endocrine: [
    { type: "lab", title: "Thyroid panel", label: "TSH", unit: "mIU/L", start: 8.4, end: 3.1, high: 4.5, every: 3, author: "lab", decimals: 1 },
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 71, end: 68.2, every: 2, author: "doctor", decimals: 1 },
  ],
  metabolic: [
    { type: "lab", title: "HbA1c", label: "HbA1c", unit: "%", start: 9.2, end: 7.4, high: 7, every: 3, author: "lab", decimals: 1 },
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 98, end: 92.4, every: 1, author: "nutritionist", decimals: 1 },
  ],
  musculoskeletal: [
    { type: "vitals", title: "Pain score (self-reported)", label: "Pain", unit: "/10", start: 7, end: 4, high: 3, every: 1, author: "patient" },
    { type: "movement", title: "Mobility check", label: "Walking", unit: "min/day", start: 10, end: 32, low: 30, every: 2, author: "yoga" },
  ],
  reproductive: [
    { type: "vitals", title: "Cycle log (self-reported)", label: "Cycle length", unit: "days", start: 44, end: 34, high: 35, every: 2, author: "patient" },
    { type: "lab", title: "Hormone panel", label: "Fasting insulin", unit: "µIU/mL", start: 24, end: 15, high: 17, every: 4, author: "lab" },
  ],
  digestive: [
    { type: "vitals", title: "Symptom diary (self-reported)", label: "Symptom score", unit: "/10", start: 7, end: 3, high: 3, every: 1, author: "patient" },
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 66, end: 66.8, every: 3, author: "nutritionist", decimals: 1 },
  ],
};

/** Condition-specific monitoring overrides (checked before the system default). */
const CONDITION_MEASURES: [RegExp, Measure[]][] = [
  [/pregnan|trimester/i, [
    { type: "vitals", title: "Antenatal check", label: "Systolic BP", unit: "mmHg", start: 108, end: 114, high: 140, every: 1, author: "doctor" },
    { type: "vitals", title: "Antenatal weight", label: "Weight", unit: "kg", start: 57.5, end: 63.2, every: 1, author: "nutritionist", decimals: 1 },
  ]],
  [/menopaus/i, [
    { type: "vitals", title: "Symptom diary (self-reported)", label: "Hot flushes / day", unit: "per day", start: 8, end: 3, high: 3, every: 1, author: "patient" },
    { type: "vitals", title: "Sleep log (self-reported)", label: "Sleep", unit: "h/night", start: 5.2, end: 6.6, low: 7, every: 1, author: "patient", decimals: 1 },
  ]],
  [/anxiety/i, [
    { type: "vitals", title: "GAD-7 questionnaire (self-reported)", label: "GAD-7", unit: "score", start: 15, end: 8, high: 10, every: 2, author: "patient" },
    { type: "vitals", title: "Resting heart rate", label: "Resting HR", unit: "bpm", start: 98, end: 78, high: 90, every: 2, author: "doctor" },
  ]],
  [/insomnia/i, [{ type: "vitals", title: "Sleep log (self-reported)", label: "Sleep", unit: "h/night", start: 4.8, end: 6.4, low: 7, every: 1, author: "patient", decimals: 1 }]],
  [/atrial fibrillation/i, [
    { type: "lab", title: "INR check", label: "INR", unit: "", start: 1.6, end: 2.4, low: 2, high: 3, every: 1, author: "lab", decimals: 1 },
    { type: "vitals", title: "Heart rate review", label: "Resting HR", unit: "bpm", start: 112, end: 78, high: 100, every: 2, author: "doctor" },
  ]],
  [/obesity/i, [
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 108, end: 98.5, every: 1, author: "nutritionist", decimals: 1 },
    { type: "vitals", title: "Waist measurement", label: "Waist", unit: "cm", start: 114, end: 105, high: 90, every: 2, author: "nutritionist" },
  ]],
  [/apnoea|apnea/i, [
    { type: "lab", title: "Sleep study (AHI)", label: "AHI", unit: "events/h", start: 32, end: 16, high: 15, every: 6, author: "lab" },
    { type: "vitals", title: "Epworth sleepiness (self-reported)", label: "ESS", unit: "score", start: 15, end: 9, high: 10, every: 2, author: "patient" },
  ]],
  [/pre-diabetes|insulin resistance/i, [
    { type: "lab", title: "HbA1c", label: "HbA1c", unit: "%", start: 6.3, end: 5.9, high: 5.7, every: 3, author: "lab", decimals: 1 },
    { type: "vitals", title: "Weight check", label: "Weight", unit: "kg", start: 78, end: 74.6, every: 1, author: "nutritionist", decimals: 1 },
  ]],
  [/rheumatoid/i, [
    { type: "vitals", title: "Joint count & stiffness", label: "Morning stiffness", unit: "min", start: 75, end: 30, high: 30, every: 1, author: "doctor" },
    { type: "lab", title: "Inflammation markers", label: "CRP", unit: "mg/L", start: 24, end: 9, high: 5, every: 3, author: "lab" },
  ]],
];

const measuresFor = (key: SystemKey, conditionNames: string[]) => {
  for (const [re, ms] of CONDITION_MEASURES) if (conditionNames.some((c) => re.test(c))) return ms;
  return MEASURES[key];
};

/** Treatment started at diagnosis, by condition wording. */
const TREATMENTS: [RegExp, string][] = [
  [/atrial fibrillation/i, "Warfarin, INR-guided; rate control with metoprolol"],
  [/infarct|coronary/i, "Aspirin 75 mg, atorvastatin 40 mg, metoprolol 25 mg started"],
  [/hypertension/i, "Telmisartan 40 mg started; home BP log advised"],
  [/dyslipid/i, "Rosuvastatin 10 mg started"],
  [/tachycard/i, "Lifestyle triggers reviewed; propranolol 10 mg as needed"],
  [/gestational/i, "Post-partum glucose follow-up plan agreed"],
  [/diabet/i, "Metformin 500 mg BD started"],
  [/pre-diabetes|insulin resistance/i, "Lifestyle programme; metformin considered at review"],
  [/obesity/i, "Weight-management plan agreed (nutrition + movement)"],
  [/hypothyroid/i, "Levothyroxine 50 µg started"],
  [/copd/i, "Tiotropium inhaler started; pulmonary rehab breathing plan"],
  [/asthma/i, "Budesonide/formoterol inhaler started; action plan given"],
  [/apnoea|apnea/i, "CPAP trial discussed; weight-loss plan"],
  [/migraine/i, "Propranolol 40 mg prophylaxis; headache diary"],
  [/anxiety/i, "CBT referral; paced-breathing practice"],
  [/insomnia/i, "Sleep-hygiene plan; CBT-I resources"],
  [/ckd/i, "BP target < 130/80; renal-friendly diet; avoid NSAIDs"],
  [/nafld/i, "Lifestyle plan: 7–10% weight loss target"],
  [/anaemia|anemia/i, "Ferrous ascorbate 100 mg daily started"],
  [/rheumatoid/i, "Hydroxychloroquine 200 mg started (methotrexate not tolerated)"],
  [/osteoarthritis|osteopenia/i, "Physio-led strengthening; calcium + vitamin D"],
  [/spondyl|lumbar|cervical/i, "Back-care programme; paracetamol as needed"],
  [/pcos/i, "Lifestyle programme; metformin 500 mg started"],
  [/pregnan|trimester/i, "Folic acid & iron; antenatal schedule agreed"],
  [/menopaus/i, "Symptom diary; non-hormonal options discussed"],
  [/irritable|ibs/i, "Low-FODMAP trial started"],
];

const OWNER_BY_AUTHOR = (p: Patient, a: Measure["author"]): { id: string; role: string } => {
  if (a === "lab") return { id: "lab:Anand Diagnostics", role: "Lab partner" };
  if (a === "patient") return { id: p.id, role: "Patient" };
  if (a === "nutritionist") return { id: p.careTeam.nutritionist ?? p.careTeam.doctor ?? "s-meera", role: p.careTeam.nutritionist ? "Nutritionist" : "Doctor" };
  if (a === "yoga") return { id: p.careTeam.yoga ?? p.careTeam.doctor ?? "s-arjun", role: p.careTeam.yoga ? "Yoga instructor" : "Doctor" };
  return { id: p.careTeam.doctor ?? "s-vikram", role: "Doctor" };
};

const fmt = (v: number, d = 0) => v.toFixed(d);

function vitalFrom(m: Measure, series: number[], source: VitalReading["source"]): VitalReading {
  const lo = Math.min(...series, m.low ?? Infinity, m.high ?? Infinity) * 0.95;
  const hi = Math.max(...series, m.low ?? -Infinity, m.high ?? -Infinity) * 1.05;
  const norm = (v: number) => Math.max(0.05, Math.min(0.95, (v - lo) / (hi - lo || 1)));
  // resample the real series to a smooth 48-point wave
  const wave = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * (series.length - 1);
    const a = Math.floor(t), b = Math.min(series.length - 1, a + 1);
    return +norm(series[a] + (series[b] - series[a]) * (t - a)).toFixed(3);
  });
  const band: [number, number] = m.high !== undefined ? [0.05, norm(m.high)] : m.low !== undefined ? [norm(m.low), 0.95] : [norm(series[series.length - 1]) - 0.15, norm(series[series.length - 1]) + 0.15];
  const range = m.high !== undefined ? `< ${m.high}` : m.low !== undefined ? `≥ ${m.low}` : "Trend";
  return { label: m.label, value: fmt(series[series.length - 1], m.decimals ?? 0), unit: m.unit, range, band, wave, source };
}

function generate(p: Patient): PatientRecord {
  const rand = rng(hashSeed(p.id));
  const sys = patientSystems(p);
  const events: CareEvent[] = [];
  const conditions: Condition[] = [];
  const systems: BodySystem[] = [];
  let n = 0;
  const id = () => `${p.id}-g${++n}`;
  const team = p.careTeam;
  const doctor = team.doctor ?? STAFF.find((s) => s.role === "doctor")!.id;

  for (const s of sys) {
    const info = SYSTEM_INFO[s.key];
    const conds = s.conditions.map((name, ci) => {
      const resolved = /resolved/i.test(name);
      const monthsAgo = p.status === "onboarding" ? 0 : 4 + Math.floor(rand() * 20) + ci * 3;
      const since = addMonths(p.registeredAt, -Math.max(0, monthsAgo - monthsBetween(p.registeredAt.slice(0, 10), TODAY_ISO)), 2 + Math.floor(rand() * 20));
      const c: Condition = {
        id: `${p.id}:${slug(name)}`,
        systemId: s.key,
        name: titleCase(name.replace(/\s*\((resolved)\)/i, "")),
        short: name.length > 18 ? name.split(/[ (—-]/)[0] : name,
        status: resolved ? "Resolved" : p.status === "needs-attention" ? "Active" : ci === 0 ? "Active" : "Monitoring",
        markers: 0,
        since: since < "2023-01-01" ? "2023-01-15" : since > TODAY_ISO ? TODAY_ISO : since,
      };
      return c;
    });
    conditions.push(...conds);

    // diagnosis + treatment start, then protocol monitoring until today
    const vitals: VitalReading[] = [];
    const measures = measuresFor(s.key, s.conditions);
    for (const c of conds) {
      const dx: CareEvent = {
        id: id(), date: c.since, enteredAt: `${c.since}T11:00:00+05:30`, type: "consult", systemId: s.key, conditionId: c.id,
        title: `Diagnosis recorded · ${c.name}`, summary: `${c.name} documented${p.primaryConcern.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]) ? ` — ${p.primaryConcern}` : ""}.`,
        authorId: doctor, authorRole: "Doctor", state: "signed", source: `Consultation note CN-${c.since.replace(/-/g, "").slice(2)}`, released: true, weight: 3, links: [],
      };
      events.push(dx);
      const tx = TREATMENTS.find(([re]) => re.test(c.name));
      if (tx && c.status !== "Resolved") {
        const t: CareEvent = {
          id: id(), date: addMonths(c.since, 0, Number(c.since.slice(8, 10)) + 1), enteredAt: `${c.since}T11:30:00+05:30`, type: "medication", systemId: s.key, conditionId: c.id,
          title: tx[1].split(";")[0], summary: tx[1], authorId: doctor, authorRole: "Doctor", state: "signed", source: "Prescription / plan", released: true, weight: 2, links: [],
        };
        events.push(t);
        dx.links!.push({ to: t.id, kind: "led-to" });
      }
    }
    // monitoring series for the system's lead condition
    const lead = conds.find((c) => c.status !== "Resolved") ?? conds[0];
    const span = Math.max(0, monthsBetween(lead.since, TODAY_ISO));
    // patient-specific anchors from their notes and referrals, e.g. "HbA1c 8.4%", "ferritin 9 ng/mL"
    const anchorText = [p.primaryConcern, ...REFERRALS.filter((r) => r.patientId === p.id).map((r) => r.reason)].join(" · ");
    measures.forEach((m, mi) => {
      const series: number[] = [];
      let prev = events.find((e) => e.conditionId === lead.id && e.title.startsWith("Diagnosis")) ?? events[events.length - 1];
      const anchor = anchorText.match(new RegExp(`${m.label}\\s*([0-9.]+)`, "i"));
      const count = Math.max(1, Math.min(8, Math.floor(span / m.every) + 1));
      const dates = Array.from({ length: count }, (_, k) => addMonths(lead.since, k * m.every, 6 + ((k * 7 + mi * 5) % 20))).filter((d) => d <= TODAY_ISO);
      if (!dates.length) dates.push(lead.since);
      for (let k = 0; k < dates.length; k++) {
        const date = dates[k];
        // improvement depends on months on treatment (new patients stay near baseline)
        const onTreatment = Math.min(1, monthsBetween(lead.since, date) / 12);
        const isLast = k === dates.length - 1;
        const value = isLast && anchor ? Number(anchor[1]) : m.start + (m.end - m.start) * (1 - Math.pow(1 - onTreatment, 1.6)) + (isLast ? 0 : (rand() - 0.5) * Math.abs(m.start - m.end) * 0.08);
        series.push(value);
        const who = OWNER_BY_AUTHOR(p, m.author);
        const flag = m.high !== undefined && value > m.high ? "high" : m.low !== undefined && value < m.low ? "low" : undefined;
        const ev: CareEvent = {
          id: id(), date, enteredAt: `${date}T${m.author === "patient" ? "21:10" : "17:40"}:00+05:30`, type: m.type, systemId: s.key, conditionId: lead.id,
          title: m.title, summary: `${m.label} ${fmt(value, m.decimals ?? 0)} ${m.unit}${flag ? ` (${flag === "high" ? "above" : "below"} target)` : ""}.`,
          authorId: who.id, authorRole: who.role, state: m.author === "patient" ? "self-reported" : m.type === "lab" ? "completed" : "signed",
          source: m.author === "lab" ? `Lab report LR-${date.replace(/-/g, "").slice(2)}` : m.author === "patient" ? "Patient log" : "Clinic measurement", released: true, weight: m.type === "lab" ? 2 : 1,
          values: [{ label: m.label, value: fmt(value, m.decimals ?? 0), unit: m.unit, flag }], links: [],
        };
        if (isLast && date >= "2026-11-01" && m.type === "lab") {
          ev.state = "awaiting-review";
          ev.released = false;
        }
        events.push(ev);
        if (m.type === "lab") prev.links!.push({ to: ev.id, kind: k === 0 ? "ordered" : "follow-up" });
        prev = ev;
      }
      if (vitals.length < 2 && series.length) vitals.push(vitalFrom(m, series.length > 1 ? series : [series[0], series[0]], m.author === "lab" ? "Lab" : m.author === "patient" ? "Home device (self-reported)" : "Clinic"));
    });
    while (vitals.length < 2) vitals.push({ label: "No readings yet", value: "—", unit: "", range: "", band: [0.4, 0.6], wave: Array(48).fill(0.5), source: "Clinic" });

    systems.push({ id: s.key, key: s.key, name: info.name, organ: organForSystem(s.key, s.conditions), conditionIds: conds.map((c) => c.id), featuredConditionId: conds.find((c) => c.status !== "Resolved")?.id ?? conds[0].id, vitals: [vitals[0], vitals[1]], records: [], imaging: [] });
  }

  const primary = systems[0];
  const sysForDiscipline = (d: string) => (d === "nutrition" ? systems.find((s) => ["metabolic", "hepatic", "haematology", "digestive", "renal"].includes(s.id)) ?? primary : d === "movement" ? systems.find((s) => ["musculoskeletal", "respiratory", "cardiovascular", "reproductive"].includes(s.id)) ?? primary : primary);

  if (primary) {
    // shared fixtures: appointments, documents, referrals, plans, classes
    for (const a of WEEK_APPOINTMENTS.filter((x) => x.patientId === p.id)) {
      const s = sysForDiscipline(a.discipline);
      const date = a.start.slice(0, 10);
      const past = a.start < "2026-11-13T09:40:00+05:30";
      events.push({
        id: `${p.id}-${a.id}`, date, enteredAt: a.start, type: a.discipline === "nutrition" ? "nutrition" : a.discipline === "movement" ? "movement" : "consult", systemId: s.id, conditionId: s.featuredConditionId,
        title: a.service, summary: `${a.service} · ${a.room}${a.status === "no-show" ? " — did not attend" : a.status === "cancelled" ? " — cancelled" : ""}.`,
        authorId: a.staffId, authorRole: STAFF.find((x) => x.id === a.staffId)?.title.split(" ·")[0] ?? "Clinician",
        state: past ? (a.status === "completed" ? "completed" : a.status === "no-show" || a.status === "cancelled" ? "completed" : "signed") : "scheduled",
        source: `Appointment ${a.id}`, released: true, weight: 2,
      });
    }
    for (const d of DOCUMENTS.filter((x) => x.patientId === p.id)) {
      const s = d.type === "Imaging" ? (systems.find((x) => x.id === "musculoskeletal") ?? primary) : primary;
      const ev: CareEvent = {
        id: `${p.id}-${d.id}`, date: d.reportDate, enteredAt: d.uploadedAt, type: d.type === "Imaging" ? "imaging" : d.type === "Lab report" ? "lab" : "document", systemId: s.id, conditionId: s.featuredConditionId,
        title: d.title, summary: `${d.type} from ${d.source.toLowerCase()} — reported ${d.reportDate}, uploaded ${d.uploadedAt.slice(0, 10)}.`,
        authorId: d.reviewerId ?? doctor, authorRole: d.source, state: d.status === "awaiting-review" || d.status === "unclassified" ? "awaiting-review" : "completed",
        source: `Document ${d.id.toUpperCase()}`, released: d.status === "reviewed" || d.status === "filed", weight: 3,
      };
      events.push(ev);
      if (d.type === "Imaging") s.imaging.push({ id: `img-${d.id}`, title: d.title, date: d.reportDate, kind: /spine|lumbar/i.test(d.title) ? "chest-ct" : /echo/i.test(d.title) ? "echo" : "chest-xray", eventId: ev.id });
    }
    for (const r of REFERRALS.filter((x) => x.patientId === p.id)) {
      const s = sysForDiscipline(r.toDiscipline);
      const refId = `${p.id}-${r.id}`;
      events.push({
        id: refId, date: r.requestedAt.slice(0, 10), enteredAt: r.requestedAt, type: "document", systemId: s.id, conditionId: s.featuredConditionId,
        title: `Referral → ${r.toDiscipline === "nutrition" ? "nutrition" : "movement"}`, summary: `${r.reason}. Stage: ${r.stage}.`,
        authorId: r.fromId, authorRole: "Doctor", state: r.stage === "acknowledged" || r.stage === "completed" ? "completed" : "awaiting-review", source: `Referral ${r.id.toUpperCase()}`, released: false, weight: 3, links: [],
      });
    }
    for (const np of NUTRITION_PLANS.filter((x) => x.patientId === p.id)) {
      const s = sysForDiscipline("nutrition");
      const planId = `${p.id}-${np.id}`;
      events.push({
        id: planId, date: np.updatedAt.slice(0, 10), enteredAt: np.updatedAt, type: "nutrition", systemId: s.id, conditionId: s.featuredConditionId,
        title: `Nutrition plan v${np.version} · ${np.status === "published" ? "published" : np.status}`, summary: `${np.title}, ${np.calories} kcal. ${np.adherenceNote}.`,
        authorId: np.authorId, authorRole: "Nutritionist", state: np.status === "published" ? "signed" : "draft", source: `Plan ${np.id.toUpperCase()} v${np.version}`, released: np.status === "published", weight: 2,
      });
      const ref = events.find((e) => e.id.startsWith(`${p.id}-r`) && e.title.includes("nutrition"));
      if (ref) (ref.links ??= []).push({ to: planId, kind: "referred" });
    }
    for (const c of CLASSES) {
      const en = c.enrolled.find((x) => x.patientId === p.id);
      if (!en || en.attendance === "pending") continue;
      const s = sysForDiscipline("movement");
      events.push({
        id: `${p.id}-${c.id}`, date: c.start.slice(0, 10), enteredAt: c.start, type: "movement", systemId: s.id, conditionId: s.featuredConditionId,
        title: `${c.title} · ${en.attendance}`, summary: `${c.focus}.${en.precaution ? ` Precaution: ${en.precaution}.` : ""}`,
        authorId: c.instructorId, authorRole: "Yoga instructor", state: "completed", source: `Session ${c.id}`, released: false, weight: en.attendance === "absent" ? 2 : 1,
      });
    }
    // records cards = latest two signed/documented items per system
    for (const s of systems) {
      const docs = events.filter((e) => e.systemId === s.id && ["document", "consult", "lab"].includes(e.type) && e.state !== "scheduled").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
      s.records = docs.map((e, i) => ({ id: `rec-${s.id}-${i}`, title: e.title.split(" · ")[0].slice(0, 22), subtitle: e.authorRole, stamp: `${e.date.slice(8, 10)}.${e.date.slice(5, 7)}`, eventId: e.id }));
    }
  }

  // markers = linked events per condition
  for (const c of conditions) c.markers = events.filter((e) => e.conditionId === c.id).length;

  events.sort((a, b) => a.date.localeCompare(b.date));
  const years = Array.from(new Set(events.map((e) => Number(e.date.slice(0, 4))))).sort((a, b) => b - a).slice(0, 3);

  const nextAppt = WEEK_APPOINTMENTS.filter((a) => a.patientId === p.id && a.start > "2026-11-13T09:40:00+05:30").sort((a, b) => a.start.localeCompare(b.start))[0];
  const plan = NUTRITION_PLANS.find((x) => x.patientId === p.id && x.status !== "superseded");
  const carePlan: CarePlanLite | null = systems.length
    ? {
        goal: `${p.primaryConcern}${p.program ? ` — ${p.program}` : ""}`,
        episode: p.program ?? "Ongoing care",
        responsible: team.doctor,
        medical: team.doctor ? { text: events.filter((e) => e.type === "medication").map((e) => e.summary).slice(-2).join(" · ") || "Monitoring plan agreed.", by: team.doctor, updated: events.filter((e) => e.authorId === team.doctor).slice(-1)[0]?.date ?? p.registeredAt.slice(0, 10) } : null,
        nutrition: team.nutritionist ? { text: plan ? `${plan.title} (v${plan.version}, ${plan.status})` : "Assessment pending.", by: team.nutritionist, updated: plan?.updatedAt.slice(0, 10) ?? p.registeredAt.slice(0, 10) } : null,
        movement: team.yoga ? { text: CLASSES.filter((c) => c.enrolled.some((e) => e.patientId === p.id)).map((c) => c.title).slice(0, 2).join(", ") || "Movement plan to be set at first session.", by: team.yoga, updated: p.lastVisit?.slice(0, 10) ?? p.registeredAt.slice(0, 10) } : null,
        nextReview: nextAppt ? { at: nextAppt.start, with: nextAppt.staffId, label: nextAppt.service } : null,
        actions: TASKS.filter((t) => t.patientId === p.id).map((t) => ({ id: t.id, label: t.title, owner: t.ownerId, due: t.due.slice(0, 10), status: t.status === "done" ? "done" : t.status === "in-progress" ? "in-progress" : "open" })),
      }
    : null;

  return { patientId: p.id, systems, conditions, events, years: years.length ? years : [2026], carePlan, generated: true };
}

const cache = new Map<string, PatientRecord>();

export function getRecord(patientId: string): PatientRecord | null {
  const hit = cache.get(patientId);
  if (hit) return hit;
  const p = patientById(patientId);
  if (!p) return null;
  let rec: PatientRecord;
  if (patientId === FEATURED_PATIENT_ID) {
    rec = {
      patientId, systems: BODY_SYSTEMS, conditions: CONDITIONS, events: CARE_EVENTS, years: [2026, 2025, 2024], generated: false,
      carePlan: { ...CARE_PLAN, actions: CARE_PLAN.actions.map((a) => ({ ...a })) },
    };
  } else {
    rec = generate(p);
  }
  cache.set(patientId, rec);
  return rec;
}

/** True when the patient has at least one classified condition (has a body-system record). */
export const hasRecord = (patientId: string) => (getRecord(patientId)?.systems.length ?? 0) > 0;

export const ALL_RECORD_PATIENTS = PATIENTS.filter((p) => p.id === FEATURED_PATIENT_ID || patientSystems(p).length > 0).map((p) => p.id);

export type { LinkKind };
