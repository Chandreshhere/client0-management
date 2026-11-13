import { useMemo } from "react";
import type { Referral, ReferralStage } from "@/data/types";
import { REFERRALS } from "@/data/care";
import { createSessionStore, localId, useSessionStore } from "@/features/tasks/session-store";
import { NOW_ISO } from "@/features/tasks/time";
import { REFERRAL_EXTRAS, type ReferralNote } from "./data";

/** Referrals = shared fixtures + extras + changes made in this browser session. */
export interface CareReferral extends Referral {
  bookedFor?: string;
  room?: string;
  actors: Partial<Record<ReferralStage, string>>;
  notes: ReferralNote[];
  linkedTaskId?: string;
  local?: boolean;
}

interface ReferralState {
  created: CareReferral[];
  patches: Record<string, Partial<CareReferral>>;
  notes: Record<string, ReferralNote[]>;
}

const SEED: ReferralState = { created: [], patches: {}, notes: {} };
export const referralStore = createSessionStore<ReferralState>("carelane.care.referrals.v1", SEED);

const BASE: CareReferral[] = REFERRALS.map((r) => {
  const x = REFERRAL_EXTRAS[r.id];
  return { ...r, bookedFor: x?.bookedFor, room: x?.room, actors: x?.actors ?? { requested: r.fromId }, notes: x?.notes ?? [], linkedTaskId: x?.linkedTaskId };
});

export function useReferrals(): CareReferral[] {
  const s = useSessionStore(referralStore);
  return useMemo(
    () =>
      [...s.created, ...BASE].map((r) => {
        const p = s.patches[r.id];
        const extra = s.notes[r.id] ?? [];
        const merged = p ? { ...r, ...p, stageDates: { ...r.stageDates, ...p.stageDates }, actors: { ...r.actors, ...p.actors } } : r;
        return extra.length ? { ...merged, notes: [...merged.notes, ...extra] } : merged;
      }),
    [s],
  );
}

const note = (actorId: string, text: string): ReferralNote => ({ id: localId("rn"), at: NOW_ISO, actorId, text });

/** Move a referral to `stage`, stamping who and when (plus optional booking details). */
export function advanceReferral(r: CareReferral, stage: ReferralStage, actorId: string, extra?: { bookedFor?: string; room?: string; text?: string }) {
  referralStore.update((s) => {
    const prev = s.patches[r.id] ?? {};
    return {
      ...s,
      patches: {
        ...s.patches,
        [r.id]: {
          ...prev,
          stage,
          stageDates: { ...prev.stageDates, [stage]: NOW_ISO },
          actors: { ...prev.actors, [stage]: actorId },
          ...(extra?.bookedFor ? { bookedFor: extra.bookedFor, room: extra.room } : {}),
        },
      },
      notes: extra?.text ? { ...s.notes, [r.id]: [...(s.notes[r.id] ?? []), note(actorId, extra.text)] } : s.notes,
    };
  });
}

export function patchReferral(id: string, patch: Partial<CareReferral>, log?: { actorId: string; text: string }) {
  referralStore.update((s) => ({
    ...s,
    patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } },
    notes: log ? { ...s.notes, [id]: [...(s.notes[id] ?? []), note(log.actorId, log.text)] } : s.notes,
  }));
}

export function addReferralNote(id: string, actorId: string, text: string) {
  referralStore.update((s) => ({ ...s, notes: { ...s.notes, [id]: [...(s.notes[id] ?? []), note(actorId, text)] } }));
}

export function createReferral(input: Omit<CareReferral, "id" | "stage" | "requestedAt" | "stageDates" | "actors" | "notes" | "local">): CareReferral {
  const r: CareReferral = {
    ...input,
    id: localId("ref"),
    stage: "requested",
    requestedAt: NOW_ISO,
    stageDates: { requested: NOW_ISO },
    actors: { requested: input.fromId },
    notes: [],
    local: true,
  };
  referralStore.update((s) => ({ ...s, created: [r, ...s.created] }));
  return r;
}
