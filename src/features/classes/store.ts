import { PROGRESS_NOTES, type ProgressNote, type SessionPlan } from "./data";
import { key, type ClassesState, type Decision, type LoggedClass, type Mark } from "./model";
import { createSessionStore, useSessionStore } from "./session-store";

/**
 * Sessions demo state for this browser session: attendance, precaution acknowledgements, session
 * status, repeated-absence routing, progress notes, session-plan edits and logged sessions.
 * Nothing leaves the browser. (Flags to the doctor live in the shared tasks store.)
 */
const INITIAL: ClassesState = {
  marks: {},
  drafts: {},
  savedAt: {},
  acks: {},
  holds: {},
  sessions: {},
  routed: {},
  notes: PROGRESS_NOTES,
  plans: {},
  offers: {},
  created: [],
};

export const classesStore = createSessionStore<ClassesState>("carelane.classes.v2", INITIAL);
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

  save(classId: string, at: string) {
    classesStore.set((s) => {
      const draft = s.drafts[classId] ?? {};
      const marks = { ...s.marks };
      for (const [pid, m] of Object.entries(draft)) marks[key(classId, pid)] = { state: m.state, reason: m.reason.trim() };
      const drafts = { ...s.drafts };
      delete drafts[classId];
      return { ...s, marks, drafts, savedAt: { ...s.savedAt, [classId]: at } };
    });
  },

  acknowledge(patientId: string, decision: Decision) {
    classesStore.set((s) => ({ ...s, acks: { ...s.acks, [patientId]: decision } }));
  },

  hold(classId: string, patientId: string, decision: Decision) {
    classesStore.set((s) => ({
      ...s,
      holds: { ...s.holds, [key(classId, patientId)]: decision },
      marks: { ...s.marks, [key(classId, patientId)]: { state: "rescheduled", reason: `Held from this session — ${decision.note || "precaution approval expired"}` } },
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

  route(patientId: string, to: string, by: string, at: string) {
    classesStore.set((s) => ({ ...s, routed: { ...s.routed, [patientId]: { to, by, at } } }));
  },

  addNote(n: ProgressNote) {
    classesStore.set((s) => ({ ...s, notes: [n, ...s.notes] }));
  },

  updatePlan(classId: string, plan: SessionPlan) {
    classesStore.set((s) => ({ ...s, plans: { ...s.plans, [classId]: plan } }));
  },

  offer(classId: string, patientId: string, by: string, at: string) {
    classesStore.set((s) => ({ ...s, offers: { ...s.offers, [key(classId, patientId)]: { by, at } } }));
  },

  log(c: LoggedClass) {
    classesStore.set((s) => ({ ...s, created: [...s.created, c] }));
  },
};
