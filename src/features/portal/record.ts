import { ORGAN_LABEL, type OrganKind } from "@/data/anatomy";
import { CARE_PLAN, EVENT_TYPE_LABEL, LAB_PANELS, VITAL_SERIES, type CareEvent, type CareEventType, type Condition, type ScanKind } from "@/data/featured";
import { patientById } from "@/data/patients";
import { getRecord } from "@/data/record";
import { measureHistory } from "@/data/insights";
import { DOCUMENTS } from "@/data/records";
import { REFERRALS } from "@/data/care";
import { DEMO_USER, staffById } from "@/data/staff";
import type { ClinicalDocument } from "@/data/types";
import { TODAY_KEY } from "./time";

/**
 * The patient's view of their own record. Everything the portal shows is read from the shared
 * record (`getRecord`) and filtered to what the care team has RELEASED. Unreleased work is never
 * shown — at most the portal says that something exists and who is reviewing it.
 */

export const PATIENT_ID = DEMO_USER.patient.personId;
export const ME = patientById(PATIENT_ID)!;
export const RECORD = getRecord(PATIENT_ID)!;

/** Released to the patient (includes their own self-reported entries). */
export const RELEASED: CareEvent[] = RECORD.events.filter((e) => e.released);
/** Released and already happened (scheduled items are appointments, not records). */
export const RELEASED_PAST: CareEvent[] = RELEASED.filter((e) => e.state !== "scheduled" && e.date <= TODAY_KEY);
/** Received by the clinic but not released yet: say it exists, never what it says. */
export const WITHHELD: CareEvent[] = RECORD.events.filter((e) => !e.released && e.state === "awaiting-review");

export const eventById = (id: string) => RECORD.events.find((e) => e.id === id);

// ---------------------------------------------------------------------------------------------
// Body systems in plain language (organ comes from the record — never hard-coded)
// ---------------------------------------------------------------------------------------------

export const ORGAN_PLAIN: Record<OrganKind, { area: string; short: string }> = {
  heart: { area: "Heart & circulation", short: "heart" },
  brain: { area: "Brain & blood vessels", short: "brain" },
  lungs: { area: "Lungs & breathing", short: "lung" },
  kidney: { area: "Kidneys", short: "kidney" },
  liver: { area: "Liver", short: "liver" },
  cells: { area: "Blood", short: "blood" },
  thyroid: { area: "Thyroid", short: "thyroid" },
  pancreas: { area: "Blood sugar", short: "blood sugar" },
  spine: { area: "Back & spine", short: "back" },
  uterus: { area: "Reproductive health", short: "reproductive" },
  gut: { area: "Digestion", short: "gut" },
  knee: { area: "Joints", short: "joint" },
};

export interface PortalSystem {
  id: string;
  name: string;
  area: string;
  organ: OrganKind;
  organLabel: string;
  conditions: Condition[];
  /** released, past records filed against this system */
  records: CareEvent[];
}

export const SYSTEMS: PortalSystem[] = RECORD.systems.map((s) => ({
  id: s.id,
  name: s.name,
  area: ORGAN_PLAIN[s.organ].area,
  organ: s.organ,
  organLabel: ORGAN_LABEL[s.organ],
  conditions: RECORD.conditions.filter((c) => c.systemId === s.id),
  records: RELEASED_PAST.filter((e) => e.systemId === s.id),
}));

export const systemById = (id: string) => SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];
export const PRIMARY_SYSTEM = SYSTEMS[0];

export const CONDITION_STATUS_PLAIN: Record<Condition["status"], string> = {
  Active: "Being treated",
  "Remission period": "Settled after treatment",
  Monitoring: "Being watched",
  Resolved: "Resolved",
};

/** Plain-language explainers for the patient (education copy, no numbers). */
const EXPLAIN: [RegExp, string][] = [
  [/coronary/i, "Narrowed arteries that feed the heart muscle. Medicines and the Heart Health programme keep it settled."],
  [/tachycard/i, "Spells of a fast heartbeat. Metoprolol keeps them in check — tell us about palpitations."],
  [/aneurysm/i, "A small bulge in a blood vessel in the head. It has not changed, so it is re-checked with a scan once a year."],
  [/atherosclerosis/i, "Mild hardening of the neck arteries. The same plan that protects your heart protects these vessels."],
  [/amnesia/i, "A one-off episode of memory loss. It has not come back and needs no treatment."],
  [/asthma/i, "Long-standing asthma, well controlled. Keep your inhaler with you during classes."],
  [/post-viral/i, "Cough and tiredness after an infection. It has fully cleared."],
];
export const explain = (c: Condition) => EXPLAIN.find(([re]) => re.test(c.name))?.[1] ?? null;

/** Records (released, past) linked to one condition. */
export const conditionRecords = (conditionId: string) => RELEASED_PAST.filter((e) => e.conditionId === conditionId);

// ---------------------------------------------------------------------------------------------
// Programme (weeks are counted from when the first programme referral was completed)
// ---------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const firstReferral = REFERRALS.filter((r) => r.patientId === PATIENT_ID && r.stageDates.completed)
  .map((r) => r.stageDates.completed!.slice(0, 10))
  .sort()[0];
const episodeWeeks = CARE_PLAN.episode.match(/(\d+)\s*weeks?/i);
export const PROGRAMME = {
  name: ME.program ?? CARE_PLAN.episode.split(" · ")[0],
  start: firstReferral ?? TODAY_KEY,
  weeks: episodeWeeks ? Number(episodeWeeks[1]) : 12,
};
/** Programme week (1-based) for a YYYY-MM-DD date. */
export const programmeWeek = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${PROGRAMME.start}T00:00:00Z`)) / (7 * DAY_MS)) + 1;
export const CURRENT_WEEK = programmeWeek(TODAY_KEY);

// ---------------------------------------------------------------------------------------------
// Measurements: one model for vitals, labs and the patient's own readings
// ---------------------------------------------------------------------------------------------

export type MetricId = "bp" | "hr" | "weight" | "spo2" | "ldl" | "hdl" | "tg" | "peakflow" | "fev1fvc";

export interface MetricPoint {
  date: string; // YYYY-MM-DD or ISO
  value: number;
  value2?: number;
  self: boolean;
  source: string;
  /** added in this browser session */
  local?: boolean;
}

export interface Target {
  text: string;
  below?: number;
  above?: number;
  /** second value for paired readings (diastolic) */
  below2?: number;
}

export interface Metric {
  id: MetricId;
  label: string;
  plain: string;
  unit: string;
  decimals: number;
  target: Target;
  points: MetricPoint[];
}

/** Lab dates that belong to a report already released to the patient. */
const RELEASED_LAB_DATES = new Set(RELEASED_PAST.filter((e) => e.type === "lab").map((e) => e.date));

const vital = (id: string) => VITAL_SERIES.find((v) => v.id === id);
const fromVital = (id: string): MetricPoint[] =>
  (vital(id)?.points ?? []).map((p) => {
    const pt = p as { d: string; v: number; v2?: number; self: boolean };
    return { date: pt.d, value: pt.v, value2: pt.v2, self: pt.self, source: pt.self ? "Your home reading" : "Measured at the clinic" };
  });

/** The record as the patient may see it: released, already-happened events only. */
const RELEASED_VIEW = { ...RECORD, events: RELEASED_PAST };

/** Structured values from released events, via the shared `measureHistory` (e.g. LDL-C, spirometry). */
function releasedValues(label: string): MetricPoint[] {
  return measureHistory(RELEASED_VIEW, label).map((p) => {
    const e = RELEASED_PAST.find((x) => x.date === p.date && x.values?.some((v) => v.label === label));
    return { date: p.date, value: p.value, self: e?.state === "self-reported", source: e ? (e.type === "lab" ? `${e.title} · lab report` : e.title) : "Released record" };
  });
}

/**
 * Lab history = values filed on released events (`measureHistory`) plus the full panel rows
 * from the same released reports (a lipid report carries HDL and triglycerides even when the
 * event summary only lists LDL). The event's own value wins when both exist for a date.
 */
function labPoints(name: string): MetricPoint[] {
  const fromRecord = releasedValues(name);
  const seen = new Set(fromRecord.map((p) => p.date));
  for (const panel of LAB_PANELS) {
    const a = panel.analytes.find((x) => x.name === name);
    if (!a) continue;
    const fromPanel = a.points
      .filter((p) => RELEASED_LAB_DATES.has(p.d) && !seen.has(p.d))
      .map((p): MetricPoint => ({ date: p.d, value: p.v, self: false, source: `${panel.name} · lab report` }));
    return [...fromRecord, ...fromPanel].sort((x, y) => x.date.localeCompare(y.date));
  }
  return fromRecord;
}

/** Peak flow: the released diary entry, valued from the respiratory system's home reading. */
function peakFlowPoints(): MetricPoint[] {
  const diary = RELEASED_PAST.filter((e) => /peak-flow/i.test(e.title) && e.date.startsWith(TODAY_KEY.slice(0, 4))).at(-1);
  const reading = RECORD.systems.flatMap((s) => s.vitals).find((v) => v.label === "Peak flow");
  if (!diary || !reading || !Number.isFinite(Number(reading.value))) return [];
  return [{ date: diary.date, value: Number(reading.value), self: true, source: diary.summary.replace(/\.$/, "") }];
}

export const METRICS: Record<MetricId, Metric> = {
  bp: { id: "bp", label: "Blood pressure", plain: "Pressure in your arteries", unit: "mmHg", decimals: 0, target: { text: vital("bp")?.target ?? "< 130/80", below: 130, below2: 80 }, points: fromVital("bp") },
  hr: { id: "hr", label: "Resting heart rate", plain: "Beats per minute at rest", unit: "bpm", decimals: 0, target: { text: vital("hr")?.target ?? "55 – 75", below: 75, above: 55 }, points: fromVital("hr") },
  weight: { id: "weight", label: "Weight", plain: "Body weight", unit: "kg", decimals: 1, target: { text: vital("weight")?.target ?? "≤ 74 kg", below: 74 }, points: fromVital("weight") },
  spo2: { id: "spo2", label: "Oxygen level", plain: "Oxygen saturation (SpO₂)", unit: "%", decimals: 0, target: { text: vital("spo2")?.target ?? "95 – 100", above: 95 }, points: fromVital("spo2") },
  ldl: { id: "ldl", label: "LDL cholesterol", plain: "The “bad” cholesterol your plan lowers", unit: "mg/dL", decimals: 0, target: { text: "< 70", below: 70 }, points: labPoints("LDL-C") },
  hdl: { id: "hdl", label: "HDL cholesterol", plain: "The “good” cholesterol", unit: "mg/dL", decimals: 0, target: { text: "> 40", above: 40 }, points: labPoints("HDL-C") },
  tg: { id: "tg", label: "Triglycerides", plain: "Fats in your blood", unit: "mg/dL", decimals: 0, target: { text: "< 150", below: 150 }, points: labPoints("Triglycerides") },
  peakflow: { id: "peakflow", label: "Peak flow", plain: "How fast you can breathe out", unit: "L/min", decimals: 0, target: { text: "> 450", above: 450 }, points: peakFlowPoints() },
  fev1fvc: { id: "fev1fvc", label: "Airflow ratio", plain: "FEV1/FVC from spirometry", unit: "", decimals: 2, target: { text: "≥ 0.70", above: 0.7 }, points: releasedValues("FEV1/FVC") },
};

/** Which measurements belong to which body system (anatomy mapping, like classifyCondition). */
export const SYSTEM_METRICS: Record<string, MetricId[]> = {
  circulatory: ["bp", "hr", "ldl", "weight"],
  respiratory: ["spo2", "peakflow", "fev1fvc"],
  nervous: ["bp"],
};

export type TargetStatus = "on" | "near" | "above" | "below" | "none";

/** Where a value sits against its target. "near" = within 3% of the limit. */
export function targetStatus(t: Target, value: number, value2?: number): TargetStatus {
  const near = (v: number, limit: number) => Math.abs(v - limit) <= Math.abs(limit) * 0.03;
  if (t.below !== undefined && t.above !== undefined) {
    if (value > t.below) return near(value, t.below) ? "near" : "above";
    if (value < t.above) return near(value, t.above) ? "near" : "below";
    return "on";
  }
  if (t.below !== undefined) {
    if (value >= t.below || (t.below2 !== undefined && value2 !== undefined && value2 >= t.below2)) {
      const nearMain = value >= t.below ? near(value, t.below) : true;
      const near2 = t.below2 !== undefined && value2 !== undefined && value2 >= t.below2 ? near(value2, t.below2) : true;
      return nearMain && near2 ? "near" : "above";
    }
    return "on";
  }
  if (t.above !== undefined) return value < t.above ? (near(value, t.above) ? "near" : "below") : "on";
  return "none";
}

export const STATUS_TEXT: Record<TargetStatus, string> = {
  on: "On target",
  near: "Close to target",
  above: "Above your target",
  below: "Below your target",
  none: "No target set",
};

export const formatValue = (m: Pick<Metric, "decimals">, v: number) => v.toFixed(m.decimals);
export const pointLabel = (m: Metric, p: MetricPoint) => (p.value2 !== undefined ? `${formatValue(m, p.value)}/${formatValue(m, p.value2)}` : formatValue(m, p.value));

/** Labels of measurements inside reports the clinic hasn't released (to say "a newer result is being reviewed"). */
export const WITHHELD_LABELS = new Set(WITHHELD.flatMap((e) => (e.values ?? []).map((v) => v.label)));

// ---------------------------------------------------------------------------------------------
// Lab results (released reports only) in plain language
// ---------------------------------------------------------------------------------------------

export interface LabResult {
  id: string;
  name: string;
  plain: string;
  unit: string;
  range: string;
  low?: number;
  high?: number;
  points: MetricPoint[];
  systemId: string;
  /** the report panel it is printed on (Lipid profile, Complete blood count…) */
  panel: string;
  /** a newer value exists in a report the clinic hasn't released */
  newerWithheld: boolean;
}

const LAB_PLAIN: Record<string, { plain: string; systemId: string }> = {
  "LDL-C": { plain: "LDL — the “bad” cholesterol", systemId: "circulatory" },
  "HDL-C": { plain: "HDL — the “good” cholesterol", systemId: "circulatory" },
  Triglycerides: { plain: "Fats carried in your blood", systemId: "circulatory" },
  Haemoglobin: { plain: "Carries oxygen in red blood cells", systemId: "circulatory" },
  Erythrocytes: { plain: "Red blood cell count", systemId: "circulatory" },
  Platelets: { plain: "Cells that help blood clot", systemId: "circulatory" },
  HbA1c: { plain: "Average blood sugar over 3 months", systemId: "circulatory" },
  ALT: { plain: "Liver enzyme — checked while on a statin", systemId: "circulatory" },
  Creatinine: { plain: "How well your kidneys clear waste", systemId: "circulatory" },
};

export const LAB_RESULTS: LabResult[] = [
  ...LAB_PANELS.flatMap((panel) =>
    panel.analytes.map((a) => {
      const meta = LAB_PLAIN[a.name] ?? { plain: panel.name, systemId: PRIMARY_SYSTEM.id };
      const bounds = a as { low?: number; high?: number };
      return {
        id: `lab-${a.name}`,
        name: a.name,
        plain: meta.plain,
        unit: a.unit,
        range: a.range,
        low: bounds.low,
        high: bounds.high,
        points: labPoints(a.name),
        systemId: meta.systemId,
        panel: panel.name,
        newerWithheld: WITHHELD_LABELS.has(a.name),
      };
    }),
  ),
  {
    id: "lab-FEV1/FVC",
    name: "FEV1/FVC",
    plain: "Airflow ratio from your breathing test",
    unit: "",
    range: "≥ 0.70",
    low: 0.7,
    points: releasedValues("FEV1/FVC"),
    systemId: "respiratory",
    panel: RELEASED_PAST.filter((e) => e.values?.some((v) => v.label === "FEV1/FVC")).at(-1)?.title ?? "Breathing test",
    newerWithheld: false,
  },
].filter((l) => l.points.length > 0);

export function labStatus(l: LabResult): TargetStatus {
  const last = l.points.at(-1);
  if (!last) return "none";
  return targetStatus({ text: l.range, below: l.high, above: l.low }, last.value);
}

// ---------------------------------------------------------------------------------------------
// Imaging (released studies only) — key finding read from the released report text
// ---------------------------------------------------------------------------------------------

export interface ImagingStudy {
  id: string;
  title: string;
  date: string;
  kind: ScanKind;
  systemId: string;
  event: CareEvent;
  finding: { value: string; label: string } | null;
}

export function imagingFinding(summary: string): ImagingStudy["finding"] {
  let m = summary.match(/EF (\d+)%/);
  if (m) return { value: `${m[1]}%`, label: "Pumping strength (EF)" };
  m = summary.match(/(\d+(?:\.\d+)?)\s*mm\b/);
  if (m) return { value: `${m[1]} mm`, label: "Aneurysm size" };
  m = summary.match(/<\s*(\d+)%\s*stenosis/i);
  if (m) return { value: `<${m[1]}%`, label: "Artery narrowing" };
  if (/x-ray clear/i.test(summary)) return { value: "Clear", label: "Chest X-ray" };
  if (/no interstitial change/i.test(summary)) return { value: "Clear", label: "Lung tissue" };
  return null;
}

export const IMAGING: ImagingStudy[] = RECORD.systems
  .flatMap((s) =>
    s.imaging.map((i) => {
      const event = eventById(i.eventId);
      return event && event.released ? { id: i.id, title: i.title, date: i.date, kind: i.kind, systemId: s.id, event, finding: imagingFinding(event.summary) } : null;
    }),
  )
  .filter((x): x is ImagingStudy => x !== null)
  .sort((a, b) => b.date.localeCompare(a.date));

// ---------------------------------------------------------------------------------------------
// Summaries, letters and prescriptions
// ---------------------------------------------------------------------------------------------

const SUMMARY_TYPES: CareEventType[] = ["note", "consult", "document", "medication", "nutrition"];
export const SUMMARIES: CareEvent[] = RELEASED_PAST.filter((e) => SUMMARY_TYPES.includes(e.type)).sort((a, b) => b.date.localeCompare(a.date) || b.enteredAt.localeCompare(a.enteredAt));

/** Filed documents for the patient that are not already part of the hand-written record. */
export const FILED_DOCUMENTS: ClinicalDocument[] = DOCUMENTS.filter((d) => d.patientId === PATIENT_ID && (d.status === "filed" || d.status === "reviewed"));

/** Released records per type for a year (bubble chart). */
export function releasedByType(year: number, systemId?: string) {
  const counts = new Map<CareEventType, number>();
  for (const e of RELEASED_PAST) {
    if (!e.date.startsWith(String(year))) continue;
    if (systemId && e.systemId !== systemId) continue;
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, value]) => ({ id: type, type, label: EVENT_TYPE_LABEL[type], value })).sort((a, b) => b.value - a.value);
}

export const RECORD_YEARS = Array.from(new Set(RELEASED_PAST.map((e) => Number(e.date.slice(0, 4))))).sort((a, b) => b - a);

/** Display name for whoever authored an event ("Dr. Ananya Rao", "Anand Diagnostics", "You"). */
export function authorName(e: CareEvent) {
  if (e.authorId === PATIENT_ID) return "You";
  if (e.authorId.startsWith("lab:")) return e.authorId.slice(4);
  return staffById(e.authorId)?.name ?? e.authorRole;
}

// ---------------------------------------------------------------------------------------------
// Medicines (from the released care plan + released prescriptions)
// ---------------------------------------------------------------------------------------------

export interface Medicine {
  name: string;
  dose: string;
  when: string;
  purpose: string;
  systemId: string;
  source: string;
}

/** "Aspirin 75 mg, atorvastatin 40 mg, metoprolol 50 mg." → names + doses from the care plan. */
const planMeds = (CARE_PLAN.medical.text.split(".")[0] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
/** Timing notes come from the 7 Sep medication reconciliation (statin at night; pill organiser advised). */
const PURPOSE: [RegExp, string, string][] = [
  [/aspirin/i, "Stops clots forming in your heart arteries", "Once a day, after food"],
  [/atorvastatin/i, "Lowers LDL cholesterol", "Once a day, at night"],
  [/metoprolol/i, "Keeps your heart rate steady", "Once a day — use your pill organiser"],
];
const inhaler = RELEASED_PAST.filter((e) => e.type === "medication" && /inhaler|budesonide/i.test(`${e.title} ${e.summary}`)).at(-1);

export const MEDICINES: Medicine[] = [
  ...planMeds.map((m) => {
    const [, name = m, dose = ""] = m.match(/^([A-Za-z]+)\s+(.*)$/) ?? [];
    const p = PURPOSE.find(([re]) => re.test(name));
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      dose,
      when: p?.[2] ?? "As prescribed",
      purpose: p?.[1] ?? "As prescribed by your doctor",
      systemId: PRIMARY_SYSTEM.id,
      source: `Care plan · ${staffById(CARE_PLAN.medical.by)?.name ?? "your doctor"}`,
    };
  }),
  ...(inhaler
    ? [
        {
          name: "Budesonide inhaler",
          dose: inhaler.summary.match(/→\s*(\d+\s*µg)/)?.[1] ?? "",
          when: /\bBD\b/.test(inhaler.summary) ? "Twice a day" : "As prescribed",
          purpose: "Keeps asthma under control",
          systemId: inhaler.systemId,
          source: `${inhaler.title} · ${authorName(inhaler)}`,
        },
      ]
    : []),
];
