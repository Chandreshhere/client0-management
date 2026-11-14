import { createPortalStore, localId } from "../store";
import { TODAY_KEY, nowIso } from "../time";

/** What the patient logs or ticks on "My plan". Saved in this browser tab only (see ../store.ts). */
export type ReadingKind = "bp" | "hr" | "weight" | "peakflow";

export interface LoggedReading {
  id: string;
  kind: ReadingKind;
  value: number;
  /** diastolic for blood pressure */
  value2?: number;
  /** when it was measured (ISO, IST) */
  measuredAt: string;
  /** when it was entered here */
  enteredAt: string;
  device?: string;
  note?: string;
}

/** Food log (F14): each meal logged against the plan. Self-reported until the nutritionist reviews it. */
export type MealMatch = "as-planned" | "partly" | "skipped";
export const MEAL_MATCH_LABEL: Record<MealMatch, string> = { "as-planned": "As planned", partly: "Partly as planned", skipped: "Skipped" };

export interface MealLog {
  slotId: string;
  match: MealMatch;
  /** when it was logged here */
  at: string;
}

export interface PlanState {
  /** checklist ticks keyed `${day}:${itemId}` so yesterday's ticks never leak into today */
  ticks: Record<string, boolean>;
  readings: LoggedReading[];
  /** meals logged in this session, keyed `${day}:${slotId}` */
  meals: Record<string, MealLog>;
}

export const planStore = createPortalStore<PlanState>("carelane.portal.plan.v1", { ticks: {}, readings: [], meals: {} });

export const tickKey = (itemId: string) => `${TODAY_KEY}:${itemId}`;
export const setTick = (itemId: string, value: boolean) => planStore.update((s) => ({ ...s, ticks: { ...s.ticks, [tickKey(itemId)]: value } }));

export const logMeal = (slotId: string, match: MealMatch) =>
  planStore.update((s) => ({ ...s, meals: { ...s.meals, [tickKey(slotId)]: { slotId, match, at: nowIso() } } }));
export const clearMeal = (slotId: string) =>
  planStore.update((s) => {
    const meals = { ...s.meals };
    delete meals[tickKey(slotId)];
    return { ...s, meals };
  });
/** Today's meal logs from this session. */
export const todaysMeals = (meals: Record<string, MealLog> | undefined) => Object.entries(meals ?? {}).filter(([k]) => k.startsWith(`${TODAY_KEY}:`)).map(([, v]) => v);

export function addReading(r: Omit<LoggedReading, "id" | "enteredAt">): LoggedReading {
  const reading: LoggedReading = { ...r, id: localId("reading"), enteredAt: nowIso() };
  planStore.update((s) => ({ ...s, readings: [...s.readings, reading] }));
  return reading;
}

export const removeReading = (id: string) => planStore.update((s) => ({ ...s, readings: s.readings.filter((r) => r.id !== id) }));
