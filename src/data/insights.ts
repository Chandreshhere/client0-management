/**
 * Derived insights for visual components. Every number a chart, card or bubble shows should
 * come from one of these functions (or an equally explicit computation) — with its meaning
 * stated in the UI label. Never hand-type figures into a visual.
 */
import type { CareEvent, CareEventType } from "./featured";
import { EVENT_TYPE_LABEL } from "./featured";
import type { PatientRecord } from "./record";
import { staffById } from "./staff";

const TODAY = "2026-11-13";
const monthsAgo = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** Share of the patient's care activity per body system over the last `months` (default 12). */
export function systemShares(record: PatientRecord, months = 12) {
  const from = monthsAgo(TODAY, months);
  const recent = record.events.filter((e) => e.date >= from && e.date <= TODAY);
  const total = recent.length || 1;
  return record.systems.map((s) => {
    const mine = recent.filter((e) => e.systemId === s.id);
    const open = record.events.filter((e) => e.systemId === s.id && (e.state === "awaiting-review" || e.state === "scheduled" || e.state === "draft")).length;
    return { id: s.id, name: s.name, organ: s.organ, events: mine.length, total: recent.length, percent: Math.round((mine.length / total) * 100), open };
  });
}

/** Event counts by type for a year (bubble charts). */
export function eventsByType(record: PatientRecord, year: number) {
  const counts = new Map<CareEventType, number>();
  for (const e of record.events) if (e.date.startsWith(String(year))) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()].map(([type, value]) => ({ id: type, type, label: EVENT_TYPE_LABEL[type], value })).sort((a, b) => b.value - a.value);
}

/** Events per month for each year in the record (scrubber density). */
export function monthlyDensity(record: PatientRecord) {
  const out: Record<number, number[]> = {};
  for (const y of record.years) out[y] = Array.from({ length: 12 }, (_, m) => record.events.filter((e) => e.date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)).length);
  return out;
}

/** Care-team members ranked by how many of this patient's records they authored. */
export function careTeamActivity(record: PatientRecord) {
  const counts = new Map<string, number>();
  for (const e of record.events) if (staffById(e.authorId)) counts.set(e.authorId, (counts.get(e.authorId) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => ({ staff: staffById(id)!, count })).sort((a, b) => b.count - a.count);
}

/** Latest structured measurements (events that carry values), newest first. */
export function latestMeasurements(record: PatientRecord, systemId?: string) {
  const seen = new Set<string>();
  const out: { label: string; value: string; unit?: string; flag?: "high" | "low"; event: CareEvent }[] = [];
  for (const e of [...record.events].reverse()) {
    if (systemId && e.systemId !== systemId) continue;
    for (const v of e.values ?? []) {
      if (seen.has(v.label)) continue;
      seen.add(v.label);
      out.push({ ...v, event: e });
    }
  }
  return out;
}

/** Upcoming (scheduled) events, soonest first. */
export const upcoming = (record: PatientRecord) => record.events.filter((e) => e.state === "scheduled" && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));

/** History of one measured analyte/vital across the record (oldest → newest). */
export function measureHistory(record: PatientRecord, label: string) {
  return record.events
    .flatMap((e) => (e.values ?? []).filter((v) => v.label === label).map((v) => ({ date: e.date, value: Number(v.value) })))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}
