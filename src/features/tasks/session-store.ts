import { useSyncExternalStore } from "react";

/**
 * Tiny per-tab store for demo changes — the "Saved in this browser session" promise made literal.
 *
 * - The server render and hydration always use the seed, so markup matches on both sides.
 * - After hydration, the tab's sessionStorage copy (if any) is read once and kept in memory, so a
 *   change made on /messages ("Turn into task") is still there when you open /tasks.
 * - If sessionStorage is unavailable (private mode, quota), changes live in memory for the page
 *   lifetime; the UI copy already says nothing leaves this browser.
 */
export interface SessionStore<T> {
  get: () => T;
  getServer: () => T;
  update: (fn: (state: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSessionStore<T extends object>(key: string, seed: T): SessionStore<T> {
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
        if (parsed && typeof parsed === "object") next = { ...seed, ...(parsed as Partial<T>) };
      }
    } catch (err) {
      // Unreadable or blocked storage: fall back to the seed (in-memory only for this page).
      console.warn(`[carelane] session state "${key}" unavailable; using in-memory state`, err);
    }
    state = next;
    return state;
  };

  return {
    get: load,
    getServer: () => seed,
    update(fn) {
      state = fn(load());
      try {
        window.sessionStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn(`[carelane] could not persist "${key}"; keeping it in memory`, err);
      }
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

export function useSessionStore<T>(store: SessionStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

let seq = 0;
/** Locally unique id for records created in this session. */
export const localId = (prefix: string) => `${prefix}-local-${Date.now().toString(36)}${(seq++).toString(36)}`;
