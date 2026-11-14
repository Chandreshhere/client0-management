import { VITAL_META, VITAL_ORDER, type VitalId } from "./data";
import { readingPatient, type AddedReading } from "./store";
import { vitalPoints } from "./vitals-data";
import { isFeaturedPatient, measureSeries, recordOf, targetText, type SeriesSource } from "./record-model";

/**
 * Measurements for the Vital signs tab, one shape for everyone:
 * the featured patient's hand-written series (BP, heart rate, SpO₂, weight), or a generated
 * patient's monitored measures from their record. Session readings ("Add reading") are merged
 * in, still marked self-reported when they came from a home device.
 */

export type SparkKind = "range-bars" | "bars" | "ecg" | "dots" | "wave";

export interface MeasurePoint {
  d: string;
  v: number;
  v2?: number;
  self: boolean;
  added?: boolean;
  eventId?: string;
}

export interface VitalMeasure {
  key: string;
  label: string;
  /** short name for sentences ("BP", "Peak flow") */
  short: string;
  unit: string;
  /** units accepted by Add reading (values are stored in `unit`) */
  units: string[];
  /** body system it is monitored for (organ in the section header) */
  systemId?: string;
  lab: boolean;
  points: MeasurePoint[];
  range?: { low?: number; high?: number; label: string };
  thresholds?: { value: number; label: string }[];
  targetLabel: string;
  decimals: number;
  /** plausible input bounds for Add reading (validation, not clinical ranges) */
  bounds: [number, number];
  bounds2?: [number, number];
  twoValues: boolean;
  spark: SparkKind;
  source: SeriesSource;
  /** how the latest value compares with the target */
  status: "above" | "below" | "within" | "none";
}

/** Featured patient's vital signs are tracked by his Heart Health programme (circulatory). */
const KABIR_SYSTEM: Record<VitalId, string> = { bp: "circulatory", hr: "circulatory", spo2: "respiratory", weight: "circulatory" };
const KABIR_SPARK: Record<VitalId, SparkKind> = { bp: "range-bars", hr: "ecg", spo2: "dots", weight: "wave" };

/** Spark that fits the measure: rate → ECG trace, counts/scores → bars from zero, labs → one dot per report, continuous → wave. */
export function sparkFor(label: string, unit: string, lab: boolean): SparkKind {
  if (/heart rate|resting hr|pulse/i.test(label)) return "ecg";
  if (lab) return "dots";
  if (/^(\/10|score|days|per day|min|min\/day)$/i.test(unit)) return "bars";
  return "wave";
}

/** Plausible-entry bounds by unit (catches typos; not clinical ranges). */
function boundsFor(unit: string, values: number[]): [number, number] {
  const table: Record<string, [number, number]> = {
    "/10": [0, 10], score: [0, 30], days: [0, 31], "per day": [0, 60], "%": [0, 100], ratio: [0, 1], "h/night": [0, 24], "min/day": [0, 1440], min: [0, 600],
    bpm: [25, 250], mmHg: [60, 260], kg: [20, 300], cm: [30, 250], "L/min": [50, 900],
  };
  return table[unit] ?? [0, Math.ceil(Math.max(1, ...values) * 3)];
}

function statusOf(v: number | undefined, low?: number, high?: number): VitalMeasure["status"] {
  if (v === undefined || (low === undefined && high === undefined)) return "none";
  if (high !== undefined && v > high) return "above";
  if (low !== undefined && v < low) return "below";
  return "within";
}

/** A session reading from the other provenance turns a single-source series into "Clinic & home". */
function mergeSource(base: SeriesSource, added: MeasurePoint[]): SeriesSource {
  if (base === "Lab" || !added.length) return base;
  const home = added.some((a) => a.self), clinic = added.some((a) => !a.self);
  if ((base === "Clinic" && home) || (base === "Home device (self-reported)" && clinic)) return "Clinic & home";
  return base;
}

function kabirMeasures(readings: AddedReading[]): VitalMeasure[] {
  return VITAL_ORDER.map((id) => {
    const meta = VITAL_META[id];
    const points = vitalPoints(id, readings);
    const latest = points[points.length - 1];
    const selfCount = points.filter((p) => p.self).length;
    return {
      key: id,
      label: meta.label,
      short: meta.short,
      unit: meta.unit,
      units: meta.units,
      systemId: KABIR_SYSTEM[id],
      lab: false,
      points,
      range: meta.range,
      thresholds: meta.thresholds,
      targetLabel: meta.range?.label ?? meta.thresholds?.map((t) => t.label).join(" · ") ?? "",
      decimals: meta.decimals,
      bounds: meta.bounds,
      bounds2: meta.bounds2,
      twoValues: id === "bp",
      spark: KABIR_SPARK[id],
      source: selfCount === points.length ? "Home device (self-reported)" : selfCount ? "Clinic & home" : "Clinic",
      // BP targets are "systolic < 130 and diastolic < 80"
      status: id === "bp" ? (latest ? (latest.v >= 130 || (latest.v2 ?? 0) >= 80 ? "above" : "within") : "none") : statusOf(latest?.v, meta.range?.low, meta.range?.high),
    };
  });
}

function generatedMeasures(patientId: string, readings: AddedReading[]): VitalMeasure[] {
  return measureSeries(patientId).map((s) => {
    const added: MeasurePoint[] = readings
      .filter((r) => readingPatient(r) === patientId && r.series === s.key)
      .map((r) => ({ d: r.d, v: r.v, self: r.self, added: true }));
    const points: MeasurePoint[] = [...s.points.map((p) => ({ d: p.d, v: p.v, self: p.self, eventId: p.eventId })), ...added].sort((a, b) => a.d.localeCompare(b.d));
    const latest = points[points.length - 1];
    const label = targetText(s.low, s.high, s.unit);
    const hasRange = s.low !== undefined || s.high !== undefined;
    return {
      key: s.key,
      label: s.label,
      short: s.label,
      unit: s.unit,
      units: s.unit === "kg" ? ["kg", "lb"] : [s.unit],
      systemId: s.systemId,
      lab: s.lab,
      points,
      range: hasRange ? { low: s.low, high: s.high, label } : undefined,
      thresholds: [
        ...(s.low !== undefined ? [{ value: s.low, label: `Target ≥ ${s.low}` }] : []),
        ...(s.high !== undefined ? [{ value: s.high, label: `Target < ${s.high}` }] : []),
      ],
      targetLabel: label,
      decimals: s.decimals,
      bounds: boundsFor(s.unit, points.map((p) => p.v)),
      twoValues: false,
      spark: sparkFor(s.label, s.unit, s.lab),
      source: mergeSource(s.source, added),
      status: statusOf(latest?.v, s.low, s.high),
    };
  });
}

export function vitalMeasures(patientId: string, readings: AddedReading[], selfReport = true): VitalMeasure[] {
  const list = isFeaturedPatient(patientId) ? kabirMeasures(readings) : recordOf(patientId) ? generatedMeasures(patientId, readings) : [];
  return selfReport ? list : list.map(clinicOnly).filter((m) => m.points.length > 0);
}

/**
 * Home readings need the patient app (Pro, spec F14). On Core and Clinic only clinic and lab
 * values exist, so self-reported points are dropped and the latest status is recomputed.
 */
function clinicOnly(m: VitalMeasure): VitalMeasure {
  const points = m.points.filter((p) => !p.self);
  if (points.length === m.points.length) return m;
  const latest = points[points.length - 1];
  const status: VitalMeasure["status"] = m.twoValues ? (latest ? (latest.v >= 130 || (latest.v2 ?? 0) >= 80 ? "above" : "within") : "none") : statusOf(latest?.v, m.range?.low, m.range?.high);
  return { ...m, points, source: m.lab ? m.source : "Clinic", status };
}

export const measureValueText = (m: VitalMeasure, p: MeasurePoint) => (m.twoValues ? `${p.v}/${p.v2 ?? "—"}` : p.v.toFixed(m.decimals));

export const STATUS_TEXT: Record<VitalMeasure["status"], string> = {
  above: "Above target",
  below: "Below target",
  within: "Within target",
  none: "No target set",
};
