import { useSyncExternalStore } from "react";
import { FEATURED_PATIENT_ID } from "@/data/patients";
import type { RecordDocument } from "./data";

/**
 * Demo-session state shared by the record tabs, so a report reviewed under Documents shows as
 * reviewed under Labs and Notes. Kept in sessionStorage (this browser tab) — nothing leaves the
 * device. Note drafts live separately in localStorage (see notes/use-drafts.ts).
 */

export type ReviewOutcome = "no-action" | "discuss" | "action" | "repeat";

export const REVIEW_OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  "no-action": "No action needed",
  discuss: "Discuss at next visit",
  action: "Action needed — task created",
  repeat: "Repeat the test",
};

export interface LocalReview {
  outcome: ReviewOutcome;
  comment: string;
  by: string;
  at: string;
}

export interface AddedReading {
  id: string;
  /** featured patient: a VitalId ("bp", "hr"…); everyone else: the measure label ("Peak flow") */
  series: string;
  /** readings stored before per-patient readings existed belong to the featured patient */
  patientId?: string;
  d: string;
  v: number;
  v2?: number;
  self: boolean;
  by: string;
  at: string;
  note?: string;
}

export interface LocalAddendum {
  id: string;
  noteId: string;
  text: string;
  by: string;
  at: string;
}

export interface RecordState {
  uploads: RecordDocument[];
  reviews: Record<string, LocalReview>;
  readings: AddedReading[];
  addenda: LocalAddendum[];
}

const EMPTY: RecordState = { uploads: [], reviews: {}, readings: [], addenda: [] };
const KEY = "carelane.record.v1";

let current: RecordState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function parse(raw: string): RecordState | null {
  try {
    const v = JSON.parse(raw) as Partial<RecordState> | null;
    if (!v || typeof v !== "object") return null;
    return {
      uploads: Array.isArray(v.uploads) ? v.uploads : [],
      reviews: v.reviews && typeof v.reviews === "object" ? v.reviews : {},
      readings: Array.isArray(v.readings) ? v.readings : [],
      addenda: Array.isArray(v.addenda) ? v.addenda : [],
    };
  } catch {
    return null;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? parse(raw) : null;
    if (parsed) current = parsed;
  } catch {
    // Storage blocked (private mode, policy): keep working from memory.
  }
}

/** Apply a change. Returns false when it could only be kept in memory (storage unavailable). */
export function updateRecord(fn: (s: RecordState) => RecordState): boolean {
  ensureLoaded();
  current = fn(current);
  let persisted = true;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    persisted = false;
  }
  listeners.forEach((l) => l());
  return persisted;
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Select a slice of the record state. Selectors must return stored references (no new arrays). */
export function useRecord<T>(select: (s: RecordState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(current),
    () => select(EMPTY),
  );
}

export const readingPatient = (r: AddedReading) => r.patientId ?? FEATURED_PATIENT_ID;

export const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
