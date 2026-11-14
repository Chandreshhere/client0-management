import { useSyncExternalStore } from "react";

/**
 * Profile actions taken in this browser session — flags to the doctor (F8), assignments to
 * nutrition or yoga (F5) and precaution changes. Kept in sessionStorage (this tab only); nothing
 * leaves the device. Each item also lands on the patient's Timeline.
 */

export type FlagUrgency = "routine" | "same-day";

export interface LocalFlag {
  id: string;
  patientId: string;
  by: string;
  byRole: "nutrition" | "yoga";
  toId: string;
  /** set when the patient's doctor is away and someone else covers */
  via: string | null;
  text: string;
  urgency: FlagUrgency;
  at: string;
}

export interface LocalAssignment {
  id: string;
  patientId: string;
  fromId: string;
  toId: string;
  discipline: "nutrition" | "yoga";
  goals: string;
  guidance: string;
  at: string;
}

export interface LocalPrecaution {
  id: string;
  patientId: string;
  text: string;
  reason: string;
  by: string;
  at: string;
}

interface ProfileState {
  flags: LocalFlag[];
  assignments: LocalAssignment[];
  precautions: LocalPrecaution[];
}

const EMPTY: ProfileState = { flags: [], assignments: [], precautions: [] };
const KEY = "carelane.profile.v1";

let state: ProfileState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return;
    const v = JSON.parse(raw) as Partial<ProfileState> | null;
    if (v && typeof v === "object") {
      state = {
        flags: Array.isArray(v.flags) ? v.flags : [],
        assignments: Array.isArray(v.assignments) ? v.assignments : [],
        precautions: Array.isArray(v.precautions) ? v.precautions : [],
      };
    }
  } catch {
    // Storage blocked or corrupt: keep working from memory.
  }
}

/** Apply a change. Returns false when it could only be kept in memory (storage unavailable). */
export function updateProfile(fn: (s: ProfileState) => ProfileState): boolean {
  load();
  state = fn(state);
  let persisted = true;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    persisted = false;
  }
  listeners.forEach((l) => l());
  return persisted;
}

function subscribe(fn: () => void) {
  load();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Select a slice. Selectors must return stored references (filter in useMemo, not here). */
export function useProfileStore<T>(select: (s: ProfileState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return select(state);
    },
    () => select(EMPTY),
  );
}

export const profileId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
