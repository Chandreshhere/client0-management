import { OBSERVATIONS, type Observation, type SessionPlan } from "./data";
import { NEEDS_REASON, key, type ClassesState, type Decision, type Escalation, type Mark } from "./model";
import { createSessionStore, useSessionStore } from "./session-store";

/**
 * Classes demo state for this browser session: attendance, clearance decisions, session status,
 * escalations, coordinator routing, private observations and session-plan edits. Nothing leaves
 * the browser.
 */
const INITIAL: ClassesState = {
  marks: {},
  drafts: {},
  savedAt: {},
  acks: {},
  holds: {},
  sessions: {},
  escalations: [],
  routed: {},
  observations: OBSERVATIONS,
  plans: {},
  offers: {},
};

export const classesStore = createSessionStore<ClassesState>("carelane.classes.v1", INITIAL);
export const useClasses = () => useSessionStore(classesStore);

export const classActions = {
  setDraft(classId: string, patientId: string, mark: Mark) {
    classesStore.set((s) => ({ ...s, drafts: { ...s.drafts, [classId]: { ...(s.drafts[classId] ?? {}), [patientId]: mark } } }));
  },

  discard(classId: string) {
    classesStore.set((s) => {
      const drafts = { ...s.drafts };
      delete drafts[classId];
      return { ...s, drafts };
    });
  },

  /** Commits drafts; returns patient ids still missing a required reason (nothing is saved then). */
  save(classId: string, at: string): string[] {
    let missing: string[] = [];
    classesStore.set((s) => {
      const draft = s.drafts[classId] ?? {};
      missing = Object.entries(draft)
        .filter(([, m]) => NEEDS_REASON.includes(m.state) && !m.reason.trim())
        .map(([pid]) => pid);
      if (missing.length) return s;
      const marks = { ...s.marks };
      for (const [pid, m] of Object.entries(draft)) marks[key(classId, pid)] = { state: m.state, reason: m.reason.trim() };
      const drafts = { ...s.drafts };
      delete drafts[classId];
      return { ...s, marks, drafts, savedAt: { ...s.savedAt, [classId]: at } };
    });
    return missing;
  },

  acknowledge(patientId: string, decision: Decision) {
    classesStore.set((s) => ({ ...s, acks: { ...s.acks, [patientId]: decision } }));
  },

  hold(classId: string, patientId: string, decision: Decision) {
    classesStore.set((s) => ({
      ...s,
      holds: { ...s.holds, [key(classId, patientId)]: decision },
      marks: { ...s.marks, [key(classId, patientId)]: { state: "rescheduled", reason: `Held from session — ${decision.note || "clearance under review"}` } },
    }));
  },

  start(classId: string, by: string, at: string) {
    classesStore.set((s) => ({ ...s, sessions: { ...s.sessions, [classId]: { status: "in-progress", startedAt: at, by } } }));
  },

  end(classId: string, at: string) {
    classesStore.set((s) => {
      const cur = s.sessions[classId];
      return { ...s, sessions: { ...s.sessions, [classId]: { status: "ended", startedAt: cur?.startedAt ?? at, endedAt: at, by: cur?.by ?? "" } } };
    });
  },

  escalate(e: Escalation) {
    classesStore.set((s) => ({ ...s, escalations: [e, ...s.escalations] }));
  },

  route(patientId: string, to: string, by: string, at: string) {
    classesStore.set((s) => ({ ...s, routed: { ...s.routed, [patientId]: { to, by, at } } }));
  },

  observe(o: Observation) {
    classesStore.set((s) => ({ ...s, observations: [o, ...s.observations] }));
  },

  updatePlan(classId: string, plan: SessionPlan) {
    classesStore.set((s) => ({ ...s, plans: { ...s.plans, [classId]: plan } }));
  },

  offer(classId: string, patientId: string, by: string, at: string) {
    classesStore.set((s) => ({ ...s, offers: { ...s.offers, [key(classId, patientId)]: { by, at } } }));
  },
};
