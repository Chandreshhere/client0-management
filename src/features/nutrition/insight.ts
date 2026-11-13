import type { BodySystem, CareEvent, Condition } from "@/data/featured";
import type { OrganKind } from "@/data/anatomy";
import { getRecord, type PatientRecord } from "@/data/record";
import { latestMeasurements } from "@/data/insights";
import { formatDate } from "@/lib/format";
import { SLOTS, type FoodLog, type LogMatch, type SlotId } from "./data";
import { grams, kcal, sumItems, type SlotItems } from "./model";

/**
 * Derived figures for the nutrition visuals. Every organ, bar and dot on the nutrition pages comes
 * from one of these functions — the patient's record (systems, conditions, measurements), the plan's
 * own meal slots, or the self-reported food logs — and the UI states which.
 */

/** Systems a diet plan usually addresses, in the order the record builder files nutrition work. */
const DIET_SYSTEMS = ["metabolic", "hepatic", "haematology", "digestive", "renal"];

export interface PlanFocus {
  system: BodySystem;
  organ: OrganKind;
  /** the condition the plan's record entries are documented against */
  condition: Condition | null;
  /** every recorded condition in that system (hotspots) */
  conditions: Condition[];
  /** how the system was chosen — shown under the organ */
  basis: string;
}

/**
 * The body system a patient's nutrition plan addresses: the system its nutrition entries are filed
 * under in the shared record (e.g. Kabir → circulatory, Sameer → hepatic, Ishita → blood). Patients
 * with no nutrition entry yet fall back to their diet-related system, then their first recorded one.
 * Null when no condition is recorded at all — the UI then shows no organ.
 */
export function planFocus(patientId: string): PlanFocus | null {
  const record = getRecord(patientId);
  if (!record || record.systems.length === 0) return null;
  const entry = record.events
    .filter((e) => e.type === "nutrition" && record.systems.some((s) => s.id === e.systemId))
    .sort((a, b) => b.date.localeCompare(a.date))[0] as CareEvent | undefined;
  const system =
    (entry && record.systems.find((s) => s.id === entry.systemId)) ??
    record.systems.find((s) => DIET_SYSTEMS.includes(s.key ?? s.id)) ??
    record.systems[0];
  const conditions = record.conditions.filter((c) => c.systemId === system.id);
  const condition = conditions.find((c) => c.id === entry?.conditionId) ?? conditions.find((c) => c.id === system.featuredConditionId) ?? conditions[0] ?? null;
  const basis = entry
    ? `Nutrition entries are filed under this system · latest “${entry.title}”, ${formatDate(entry.date, { day: "numeric", month: "short" })}`
    : "No nutrition entry on the record yet · diet-related system from the recorded conditions";
  return { system, organ: system.organ, condition, conditions, basis };
}

export interface PlanMarker {
  label: string;
  value: string;
  unit?: string;
  flag?: "high" | "low";
  date: string;
  selfReported: boolean;
  source: string;
  history: { date: string; value: number }[];
}

/** One measured analyte's readings within a system, oldest → newest. */
function systemHistory(record: PatientRecord, systemId: string, label: string) {
  return record.events
    .filter((e) => e.systemId === systemId)
    .flatMap((e) => (e.values ?? []).filter((v) => v.label === label).map((v) => ({ date: e.date, value: Number(v.value) })))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The clinical marker the diet is meant to move, from the same system: a lab value with a history
 * first (LDL-C, HbA1c, ALT, ferritin…), then any repeated measurement, then a single reading.
 */
export function planMarker(patientId: string, systemId: string): PlanMarker | null {
  const record = getRecord(patientId);
  if (!record) return null;
  const options = latestMeasurements(record, systemId).map((m) => ({ m, history: systemHistory(record, systemId, m.label) }));
  const pick = options.find((o) => o.m.event.type === "lab" && o.history.length > 1) ?? options.find((o) => o.history.length > 1) ?? options[0];
  if (!pick) return null;
  const e = pick.m.event;
  return {
    label: pick.m.label,
    value: pick.m.value,
    unit: pick.m.unit || undefined,
    flag: pick.m.flag,
    date: e.date,
    selfReported: e.state === "self-reported",
    source: e.state === "self-reported" ? "Self-reported" : e.type === "lab" ? "Lab" : e.authorRole,
    history: pick.history,
  };
}

/* ------------------------------------------------------------------ plan day */

export type MacroKey = "kcal" | "protein" | "fibre";
export interface Targets {
  kcal: number;
  protein: number;
  fibre: number;
}

/** Energy, protein and fibre per meal slot, in eating order (early morning → dinner). */
export function perSlot(slots: SlotItems) {
  return SLOTS.map((s) => ({ id: s.id as SlotId, label: s.label, ...sumItems(slots[s.id]) }));
}

export type Verdict = { text: string; short: string; tone: "success" | "warning" };

/** Energy is a range: 90–105 % of target counts as within it. */
export function energyVerdict(value: number, target: number): Verdict {
  const pct = value / target;
  if (pct < 0.9) return { text: `${kcal(target - value)} kcal below target`, short: `${kcal(target - value)} under`, tone: "warning" };
  if (pct > 1.05) return { text: `${kcal(value - target)} kcal above target`, short: `${kcal(value - target)} over`, tone: "warning" };
  return { text: "Within target range", short: "in range", tone: "success" };
}

/** Protein and fibre targets are minimums. */
export function minimumVerdict(value: number, target: number): Verdict {
  return value >= target ? { text: "Meets the minimum", short: "meets min", tone: "success" } : { text: `${grams(target - value)} short`, short: `${grams(target - value)} short`, tone: "warning" };
}

/* ------------------------------------------------------------------ self-reported logs */

const DAY_MS = 86_400_000;

/** IST calendar days ending today (13 Nov), oldest first. */
export function lastDays(count: number, end = "2026-11-13") {
  const base = new Date(`${end}T12:00:00+05:30`).getTime();
  return Array.from({ length: count }, (_, i) => new Date(base - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

export const MATCH_ORDER: LogMatch[] = ["as-planned", "partly", "different", "skipped"];

export function matchCounts(logs: FoodLog[]) {
  const c: Record<LogMatch, number> = { "as-planned": 0, partly: 0, different: 0, skipped: 0 };
  for (const l of logs) c[l.match] += 1;
  return c;
}

/** A patient's self-reported entries grouped by the day they ate (IST), one bucket per day. */
export function logsByDay(logs: FoodLog[], patientId: string, days: string[]) {
  const own = logs.filter((l) => l.patientId === patientId);
  return days.map((d) => ({ day: d, entries: own.filter((l) => l.eatenAt.startsWith(d)).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt)) }));
}

export const shortDay = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => formatDate(`${day}T12:00:00+05:30`, opts);
