import { useSyncExternalStore } from "react";

/**
 * Per-tab store for everything the patient changes in the portal demo — the literal meaning of
 * "Saved in this browser session".
 *
 * - Server render and hydration use the seed, so markup matches on both sides.
 * - After hydration the tab's sessionStorage copy (if any) is read once and kept in memory.
 * - When storage is blocked (private mode, quota, disabled cookies) changes stay in memory for
 *   the page's lifetime; the UI copy already says nothing leaves this browser.
 */
export interface PortalStore<T> {
  get: () => T;
  getServer: () => T;
  update: (fn: (state: T) => T) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPortalStore<T extends object>(key: string, seed: T): PortalStore<T> {
  let state: T | null = null;
  const listeners = new Set<() => void>();

  const load = (): T => {
    if (state) return state;
    if (typeof window === "undefined") return seed;
    let next = seed;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) next = { ...seed, ...(parsed as Partial<T>) };
      }
    } catch (err) {
      console.warn(`[carelane] portal state "${key}" unavailable; using in-memory state`, err);
    }
    state = next;
    return state;
  };

  const persist = () => {
    try {
      if (state) window.sessionStorage.setItem(key, JSON.stringify(state));
      else window.sessionStorage.removeItem(key);
    } catch (err) {
      console.warn(`[carelane] could not persist "${key}"; keeping it in memory`, err);
    }
  };

  return {
    get: load,
    getServer: () => seed,
    update(fn) {
      state = fn(load());
      persist();
      listeners.forEach((l) => l());
    },
    reset() {
      state = seed;
      persist();
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function usePortalStore<T>(store: PortalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

let seq = 0;
/** Locally unique id for records created in this browser session. */
export const localId = (prefix: string) => `${prefix}-local-${Date.now().toString(36)}${(seq++).toString(36)}`;
