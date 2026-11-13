import { createPortalStore } from "../store";
import type { PortalAppt } from "./data";

/** A change the patient asked for. Nothing is sent: the original booking stays until the clinic confirms. */
export type ApptChange = { kind: "reschedule"; to: string; reason?: string; at: string } | { kind: "cancel"; reason?: string; at: string };

export interface ApptState {
  requests: PortalAppt[];
  changes: Record<string, ApptChange>;
  /** "How to prepare" ticks, keyed `${appointmentId}:${itemId}` */
  prepare: Record<string, boolean>;
}

export const apptStore = createPortalStore<ApptState>("carelane.portal.appointments.v1", { requests: [], changes: {}, prepare: {} });

export const addRequest = (a: PortalAppt) => apptStore.update((s) => ({ ...s, requests: [...s.requests, a] }));
export const withdrawRequest = (id: string) => apptStore.update((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== id) }));

export const setChange = (id: string, change: ApptChange) => apptStore.update((s) => ({ ...s, changes: { ...s.changes, [id]: change } }));
export function clearChange(id: string) {
  apptStore.update((s) => {
    const next = { ...s.changes };
    delete next[id];
    return { ...s, changes: next };
  });
}

export const togglePrep = (key: string, value: boolean) => apptStore.update((s) => ({ ...s, prepare: { ...s.prepare, [key]: value } }));
