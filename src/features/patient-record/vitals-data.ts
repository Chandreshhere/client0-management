import { VITAL_SERIES } from "@/data/featured";
import { FEATURED_PATIENT_ID } from "@/data/patients";
import { formatDate } from "@/lib/format";
import { VITAL_META, VITAL_ORDER, type VitalId } from "./data";
import { readingPatient, type AddedReading } from "./store";

/** One vital-sign reading; `self` = patient-reported (home device), `added` = this session. */
export type VitalPoint = { d: string; v: number; v2?: number; self: boolean; added?: boolean };

/** Only blood-pressure points carry a second value (diastolic). */
const diastolicOf = (p: object): number | undefined => ("v2" in p && typeof p.v2 === "number" ? p.v2 : undefined);

/** The featured patient's seeded series + readings added for him in this session, oldest first. */
export function vitalPoints(id: VitalId, readings: AddedReading[]): VitalPoint[] {
  const base = VITAL_SERIES.find((s) => s.id === id);
  const seeded: VitalPoint[] = (base?.points ?? []).map((p) => ({ d: p.d, v: p.v, v2: diastolicOf(p), self: p.self }));
  const added: VitalPoint[] = readings
    .filter((r) => r.series === id && readingPatient(r) === FEATURED_PATIENT_ID)
    .map((r) => ({ d: r.d, v: r.v, v2: r.v2, self: r.self, added: true }));
  return [...seeded, ...added].sort((a, b) => a.d.localeCompare(b.d));
}

export const vitalValueText = (id: VitalId, p: VitalPoint) => (id === "bp" ? `${p.v}/${p.v2 ?? "—"}` : p.v.toFixed(VITAL_META[id].decimals));

/** "BP 126/80 mmHg (home, self-reported, 12 Nov); …" — provenance stays attached to each value. */
export function latestVitalsSentence(readings: AddedReading[]): string {
  const parts = VITAL_ORDER.map((id) => {
    const pts = vitalPoints(id, readings);
    const p = pts[pts.length - 1];
    if (!p) return null;
    const meta = VITAL_META[id];
    return `${meta.short} ${vitalValueText(id, p)} ${meta.unit} (${p.self ? "home device, self-reported" : "clinic"}, ${formatDate(p.d, { day: "numeric", month: "short" })})`;
  }).filter(Boolean);
  return `Latest recorded: ${parts.join("; ")}.`;
}
