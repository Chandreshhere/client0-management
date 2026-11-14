"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Appointment, Patient } from "@/data/types";
import type { RegistryPatient } from "./data";

/**
 * Demo persistence for the Patients area: registrations, first visits and care-team changes made
 * in this browser tab. Backed by sessionStorage so it survives navigation and reloads within the
 * tab, and nothing leaves the browser. The server snapshot is always empty, so SSR and hydration
 * match; the stored state appears right after hydration.
 */

type CareTeam = Patient["careTeam"];

/** An admin's decision on a possible duplicate. Records are never merged automatically. */
export interface DuplicateDecision {
  /** "merged" = this record was merged into `into`; "separate" = reviewed, not the same person */
  outcome: "merged" | "separate";
  into?: string;
  at: string;
  by: string;
}

export interface PatientsSession {
  added: RegistryPatient[];
  careTeams: Record<string, CareTeam>;
  visits: Appointment[];
  /** keyed by the reviewed record's id (older sessions may lack it) */
  duplicates?: Record<string, DuplicateDecision>;
}

const KEY = "carelane.patients.session.v1";
const EMPTY: PatientsSession = { added: [], careTeams: {}, visits: [] };

let snapshot: PatientsSession = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isSession(v: unknown): v is PatientsSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return Array.isArray(s.added) && Array.isArray(s.visits) && !!s.careTeams && typeof s.careTeams === "object";
}

function read(): PatientsSession {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : EMPTY;
  } catch {
    // Storage blocked (private mode, policy) or corrupt JSON: start empty; changes still live in memory.
    return EMPTY;
  }
}

function getSnapshot() {
  if (!loaded) {
    loaded = true;
    snapshot = read();
  }
  return snapshot;
}

const getServerSnapshot = () => EMPTY;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(fn: (s: PatientsSession) => PatientsSession) {
  snapshot = fn(getSnapshot());
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable: keep the in-memory copy so the demo still works on this page.
  }
  listeners.forEach((l) => l());
}

export function usePatientsSession() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const actions = useMemo(
    () => ({
      addPatient(patient: RegistryPatient, visit: Appointment | null) {
        update((s) => ({ ...s, added: [...s.added, patient], visits: visit ? [...s.visits, visit] : s.visits }));
      },
      removePatient(id: string) {
        update((s) => {
          const careTeams = { ...s.careTeams };
          delete careTeams[id];
          return { ...s, added: s.added.filter((p) => p.id !== id), visits: s.visits.filter((v) => v.patientId !== id), careTeams };
        });
      },
      /** Replace the care team of each patient (the caller merges per patient). */
      setCareTeams(teams: Record<string, CareTeam>) {
        update((s) => ({ ...s, careTeams: { ...s.careTeams, ...teams } }));
      },
      /** Record an admin's duplicate decision for one or more records. */
      decideDuplicates(decisions: Record<string, DuplicateDecision>) {
        update((s) => ({ ...s, duplicates: { ...(s.duplicates ?? {}), ...decisions } }));
      },
      undoDuplicates(ids: string[]) {
        update((s) => {
          const duplicates = { ...(s.duplicates ?? {}) };
          for (const id of ids) delete duplicates[id];
          return { ...s, duplicates };
        });
      },
    }),
    [],
  );
  return { session, ...actions };
}

/**
 * A patient with this session's duplicate decision applied: a record kept separate loses its
 * "Possible duplicate" flag. Merged-away records are filtered out by the caller.
 */
export function withDuplicateDecision<T extends { id: string; tags: string[]; local?: { duplicateOf: string[] } }>(p: T, session: PatientsSession): T {
  const d = session.duplicates?.[p.id];
  if (!d || d.outcome !== "separate") return p;
  return { ...p, tags: p.tags.filter((t) => t !== "Possible duplicate"), local: p.local ? { ...p.local, duplicateOf: [] } : p.local };
}

/** A patient with any care-team change made in this session applied. */
export function withSessionCareTeam<T extends { id: string; careTeam: CareTeam }>(p: T, session: PatientsSession): T {
  const team = session.careTeams[p.id];
  return team ? { ...p, careTeam: team } : p;
}
