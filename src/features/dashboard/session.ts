import { useSyncExternalStore } from "react";

/**
 * What the role homes remember for this browser session — the honest meaning of "saved" in a
 * demo without a backend: assignments opened (assigned → seen), precaution changes acknowledged,
 * attendance saved and payments recorded by hand. Server render and hydration use the empty
 * snapshot; anything saved earlier in the session is swapped in right after hydration.
 * (Kept inside the dashboard so the homes don't depend on other features' stores.)
 */
export type Mark = "present" | "late" | "absent";
export type PayMethod = "Cash" | "UPI" | "Card";

export interface DashboardState {
  /** assignment (referral) id → time it was opened */
  seen: Record<string, string>;
  /** patient id → time the instructor acknowledged the changed precaution */
  acks: Record<string, string>;
  /** class id → saved attendance marks */
  attendance: Record<string, { marks: Record<string, Mark>; at: string }>;
  /** invoice id → payment recorded at the desk */
  payments: Record<string, { method: PayMethod; amount: number; at: string }>;
}

const KEY = "carelane.dashboard.v1";
const INITIAL: DashboardState = { seen: {}, acks: {}, attendance: {}, payments: {} };

let state = INITIAL;
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) state = { ...INITIAL, ...(JSON.parse(raw) as Partial<DashboardState>) };
  } catch (err) {
    console.warn(`[${KEY}] session storage unavailable`, err);
  }
}

function persist() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn(`[${KEY}] could not persist session state`, err);
    }
  }, 150);
}

function update(fn: (s: DashboardState) => DashboardState) {
  load();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

const get = () => {
  load();
  return state;
};
const getInitial = () => INITIAL;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useDashboardState = () => useSyncExternalStore(subscribe, get, getInitial);

export const dashboardActions = {
  markSeen: (assignmentId: string, at: string) => update((s) => (s.seen[assignmentId] ? s : { ...s, seen: { ...s.seen, [assignmentId]: at } })),
  acknowledge: (patientId: string, at: string) => update((s) => ({ ...s, acks: { ...s.acks, [patientId]: at } })),
  undoAcknowledge: (patientId: string) =>
    update((s) => {
      const acks = { ...s.acks };
      delete acks[patientId];
      return { ...s, acks };
    }),
  saveAttendance: (classId: string, marks: Record<string, Mark>, at: string) => update((s) => ({ ...s, attendance: { ...s.attendance, [classId]: { marks, at } } })),
  recordPayment: (invoiceId: string, method: PayMethod, amount: number, at: string) => update((s) => ({ ...s, payments: { ...s.payments, [invoiceId]: { method, amount, at } } })),
  undoPayment: (invoiceId: string) =>
    update((s) => {
      const payments = { ...s.payments };
      delete payments[invoiceId];
      return { ...s, payments };
    }),
};
