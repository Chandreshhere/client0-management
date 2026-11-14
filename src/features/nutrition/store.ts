import type { PlanStatus } from "@/data/types";
import { FOLLOW_UPS, FOOD_LOGS, GUIDANCE, type FollowUpEntry, type FoodLog, type LogComment, type SlotId } from "./data";
import { buildInitialPlans, emptySlots, slotsFromTemplate, type PlanRecord, type SlotItems } from "./model";
import { createSessionStore, useSessionStore } from "./session-store";

/**
 * Nutrition demo state for this browser session: plan edits, versions, releases, follow-up
 * entries, food-log reviews (Pro) and follow-up tasks. Nothing leaves the browser.
 */
export interface LocalTask {
  id: string;
  title: string;
  patientId: string;
  ownerId: string;
  createdBy: string;
  at: string;
}

export interface NutritionState {
  plans: Record<string, PlanRecord>;
  order: string[];
  logs: Record<string, FoodLog>;
  /** follow-up entries (weight, adherence, notes), newest first */
  followUps: FollowUpEntry[];
  tasks: LocalTask[];
}

const initialPlans = buildInitialPlans();

const INITIAL: NutritionState = {
  plans: initialPlans,
  order: Object.keys(initialPlans),
  logs: Object.fromEntries(FOOD_LOGS.map((l) => [l.id, l])),
  followUps: FOLLOW_UPS,
  tasks: [],
};

export const nutritionStore = createSessionStore<NutritionState>("carelane.nutrition.v1", INITIAL);
export const useNutrition = () => useSessionStore(nutritionStore);

const patchPlan = (id: string, fn: (p: PlanRecord) => PlanRecord) =>
  nutritionStore.set((s) => (s.plans[id] ? { ...s, plans: { ...s.plans, [id]: fn(s.plans[id]) } } : s));

export const planActions = {
  updateSlots(id: string, fn: (slots: SlotItems) => SlotItems, at: string) {
    patchPlan(id, (p) => ({ ...p, slots: fn(p.slots), updatedAt: at }));
  },

  submitForReview(id: string, by: string, at: string) {
    patchPlan(id, (p) => ({ ...p, status: "in-review", updatedAt: at, history: upsertVersion(p, "in-review", by, at) }));
  },

  returnToDraft(id: string, by: string, at: string) {
    patchPlan(id, (p) => ({ ...p, status: "draft", updatedAt: at, history: upsertVersion(p, "draft", by, at) }));
  },

  publish(id: string, by: string, at: string, why: string, changes: string[]) {
    patchPlan(id, (p) => {
      const history = p.history.map((v) => (v.status === "published" ? { ...v, status: "superseded" as PlanStatus } : v));
      const rest = history.filter((v) => v.version !== p.version);
      const current = history.find((v) => v.version === p.version);
      const entry = { version: p.version, status: "published" as PlanStatus, by, at, why: why || current?.why || "Published after individual review.", changes: changes.length ? changes : current?.changes ?? [] };
      return { ...p, status: "published", updatedAt: at, baseline: p.slots, templateReview: null, history: [...rest, entry].sort((a, b) => a.version - b.version) };
    });
  },

  newVersion(id: string, by: string, at: string) {
    patchPlan(id, (p) => {
      const version = p.version + 1;
      return { ...p, version, status: "draft", updatedAt: at, ack: null, history: [...p.history, { version, status: "draft", by, at, why: "", changes: [] }] };
    });
  },

  /** Pro (F13): release the published version to the patient app — a separate step from publishing. */
  release(id: string, by: string, at: string) {
    patchPlan(id, (p) => (p.status === "published" ? { ...p, released: { version: p.version, by, at } } : p));
  },

  acknowledge(id: string, guidanceVersion: string, by: string, at: string) {
    patchPlan(id, (p) => ({ ...p, ack: { guidanceVersion, by, at } }));
  },

  clearAck(id: string) {
    patchPlan(id, (p) => ({ ...p, ack: null }));
  },

  applyTemplate(id: string, templateId: string) {
    patchPlan(id, (p) => ({
      ...p,
      slots: slotsFromTemplate(templateId, `${id}-t${Date.now().toString(36)}`),
      templateReview: { early: false, breakfast: false, midmorning: false, lunch: false, evening: false, dinner: false },
    }));
  },

  restore(id: string, slots: SlotItems, templateReview: PlanRecord["templateReview"]) {
    patchPlan(id, (p) => ({ ...p, slots, templateReview }));
  },

  markSlotReviewed(id: string, slot: SlotId) {
    patchPlan(id, (p) => {
      if (!p.templateReview) return p;
      const next = { ...p.templateReview, [slot]: true };
      return { ...p, templateReview: Object.values(next).every(Boolean) ? null : next };
    });
  },

  create(input: { id: string; patientId: string; title: string; preference: string; templateId: string | null; by: string; at: string }) {
    const slots = input.templateId ? slotsFromTemplate(input.templateId, input.id) : emptySlots();
    const g = GUIDANCE[input.patientId];
    const plan: PlanRecord = {
      id: input.id, patientId: input.patientId, title: input.title, version: 1, status: "draft", authorId: input.by, updatedAt: input.at,
      preference: input.preference, calories: g?.targets.kcal ?? 1800, adherenceNote: "New plan — no logs yet", nextReview: "2026-11-27T11:00:00+05:30",
      slots, baseline: emptySlots(), ack: null, createdLocally: true,
      templateReview: input.templateId ? { early: false, breakfast: false, midmorning: false, lunch: false, evening: false, dinner: false } : null,
      history: [{ version: 1, status: "draft", by: input.by, at: input.at, why: "Created in this browser session.", changes: input.templateId ? ["+ Started from a reusable template — needs individual review"] : [] }],
    };
    nutritionStore.set((s) => ({ ...s, plans: { ...s.plans, [plan.id]: plan }, order: [plan.id, ...s.order] }));
  },
};

function upsertVersion(p: PlanRecord, status: PlanStatus, by: string, at: string) {
  const exists = p.history.some((v) => v.version === p.version);
  if (!exists) return [...p.history, { version: p.version, status, by, at, why: "", changes: [] }];
  return p.history.map((v) => (v.version === p.version ? { ...v, status } : v));
}

const patchLog = (id: string, fn: (l: FoodLog) => FoodLog) =>
  nutritionStore.set((s) => (s.logs[id] ? { ...s, logs: { ...s.logs, [id]: fn(s.logs[id]) } } : s));

export const logActions = {
  markReviewed(id: string, by: string, at: string) {
    patchLog(id, (l) => ({ ...l, status: "reviewed", reviewedBy: { by, at }, flag: undefined }));
  },
  reopen(id: string) {
    patchLog(id, (l) => ({ ...l, status: "new", reviewedBy: undefined }));
  },
  flag(id: string, reason: string, by: string, at: string) {
    patchLog(id, (l) => ({ ...l, status: "flagged", flag: { reason, by, at } }));
  },
  unflag(id: string) {
    patchLog(id, (l) => ({ ...l, status: "new", flag: undefined }));
  },
  comment(id: string, comment: LogComment) {
    patchLog(id, (l) => ({ ...l, comments: [...l.comments, comment] }));
  },
};

export const followUpActions = {
  add(entry: FollowUpEntry) {
    nutritionStore.set((s) => ({ ...s, followUps: [entry, ...s.followUps] }));
  },
};

export const taskActions = {
  add(task: LocalTask) {
    nutritionStore.set((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  },
};
