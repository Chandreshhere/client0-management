import { useSyncExternalStore } from "react";

/**
 * Tiny module store persisted to sessionStorage — the honest meaning of "saved in this browser
 * session". Server render and hydration use the initial snapshot; anything saved earlier in the
 * session is swapped in right after hydration (useSyncExternalStore re-renders, no mismatch).
 * (Kept per feature so the classes area has no dependency on the nutrition folder.)
 */
export interface SessionStore<T> {
  get: () => T;
  getInitial: () => T;
  set: (update: (s: T) => T) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createSessionStore<T extends object>(key: string, initial: T): SessionStore<T> {
  let state = initial;
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) state = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
    } catch (err) {
      console.warn(`[${key}] session storage unavailable`, err);
    }
  };

  const persist = () => {
    if (typeof window === "undefined") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn(`[${key}] could not persist session state`, err);
      }
    }, 200);
  };

  return {
    get: () => {
      load();
      return state;
    },
    getInitial: () => initial,
    set: (update) => {
      load();
      state = update(state);
      persist();
      listeners.forEach((l) => l());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export function useSessionStore<T extends object>(store: SessionStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getInitial);
}
