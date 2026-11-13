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

export interface PlanState {
  /** checklist ticks keyed `${day}:${itemId}` so yesterday's ticks never leak into today */
  ticks: Record<string, boolean>;
  readings: LoggedReading[];
}

export const planStore = createPortalStore<PlanState>("carelane.portal.plan.v1", { ticks: {}, readings: [] });

export const tickKey = (itemId: string) => `${TODAY_KEY}:${itemId}`;
export const setTick = (itemId: string, value: boolean) => planStore.update((s) => ({ ...s, ticks: { ...s.ticks, [tickKey(itemId)]: value } }));

export function addReading(r: Omit<LoggedReading, "id" | "enteredAt">): LoggedReading {
  const reading: LoggedReading = { ...r, id: localId("reading"), enteredAt: nowIso() };
  planStore.update((s) => ({ ...s, readings: [...s.readings, reading] }));
  return reading;
}

export const removeReading = (id: string) => planStore.update((s) => ({ ...s, readings: s.readings.filter((r) => r.id !== id) }));
