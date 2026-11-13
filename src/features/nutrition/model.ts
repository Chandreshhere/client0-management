import type { NutritionPlanSummary, PlanStatus } from "@/data/types";
import type { Tone } from "@/components/ui/status";
import { NUTRITION_PLANS } from "@/data/programs";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { PLAN_HISTORY, PLAN_SOURCE, SLOTS, SLOT_LABEL, SWAPS, foodById, templateById, type Food, type SlotId, type SubReason, type VersionEntry } from "./data";

/** Pure helpers for the nutrition workspace (no React, safe on server and client). */

export interface Alternative {
  id: string;
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  reason: SubReason;
  note: string;
}

export interface PlanItem {
  id: string;
  foodId: string | null;
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  fibre: number;
  note: string;
  alternatives: Alternative[];
}

export type SlotItems = Record<SlotId, PlanItem[]>;

export interface PlanRecord extends NutritionPlanSummary {
  slots: SlotItems;
  /** the last saved version — what "changes in this session" are measured against */
  baseline: SlotItems;
  history: VersionEntry[];
  ack: { guidanceVersion: string; by: string; at: string } | null;
  /** set when a reusable template was applied: every slot needs individual review before publishing */
  templateReview: Partial<Record<SlotId, boolean>> | null;
  createdLocally?: boolean;
}

export const PLAN_TONE: Record<PlanStatus, Tone> = { draft: "draft", "in-review": "warning", published: "success", superseded: "neutral" };

let seq = 0;
/** Runtime ids for things created in the browser (never during render). */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptySlots = (): SlotItems => ({ early: [], breakfast: [], midmorning: [], lunch: [], evening: [], dinner: [] });

export function altFromFood(food: Food, id: string, reason: SubReason, note: string): Alternative {
  return { id, name: food.name, portion: food.portion, kcal: food.kcal, protein: food.protein, reason, note };
}

export function itemFromFood(food: Food, id: string, note = ""): PlanItem {
  const alternatives = (SWAPS[food.id] ?? []).flatMap((s, i) => {
    const alt = foodById(s.foodId);
    return alt ? [altFromFood(alt, `${id}-alt${i}`, s.reason, s.note)] : [];
  });
  return { id, foodId: food.id, name: food.name, portion: food.portion, kcal: food.kcal, protein: food.protein, fibre: food.fibre, note, alternatives };
}

export function slotsFromTemplate(templateId: string, prefix: string, notes: Partial<Record<string, string>> = {}): SlotItems {
  const t = templateById(templateId);
  const out = emptySlots();
  if (!t) return out;
  for (const s of SLOTS) {
    out[s.id] = t.slots[s.id].flatMap((foodId, i) => {
      const food = foodById(foodId);
      return food ? [itemFromFood(food, `${prefix}-${s.id}-${i}`, notes[foodId] ?? "")] : [];
    });
  }
  return out;
}

export function sumItems(items: PlanItem[]) {
  return items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, protein: acc.protein + it.protein, fibre: acc.fibre + it.fibre }), { kcal: 0, protein: 0, fibre: 0 });
}

export function totals(slots: SlotItems) {
  const all = SLOTS.flatMap((s) => slots[s.id]);
  return { ...sumItems(all), items: all.length };
}

const sameItem = (a: PlanItem, b: PlanItem) =>
  a.name === b.name && a.portion === b.portion && a.kcal === b.kcal && a.protein === b.protein && a.note === b.note && a.alternatives.length === b.alternatives.length;

/** Human-readable diff between two versions of the meal slots (+ added · − removed · ~ changed). */
export function diffSlots(base: SlotItems, current: SlotItems): string[] {
  const lines: string[] = [];
  for (const s of SLOTS) {
    const before = new Map(base[s.id].map((i) => [i.id, i]));
    const after = new Map(current[s.id].map((i) => [i.id, i]));
    for (const it of current[s.id]) {
      const prev = before.get(it.id);
      if (!prev) lines.push(`+ ${it.name} (${s.label})`);
      else if (!sameItem(prev, it)) lines.push(`~ ${it.name} (${s.label})`);
    }
    for (const it of base[s.id]) if (!after.has(it.id)) lines.push(`− ${it.name} (${s.label})`);
  }
  return lines;
}

/** Why a food conflicts with the patient's recorded preference (null = fine). */
export function preferenceConflict(food: Pick<Food, "diet" | "jain">, preference: string): string | null {
  const p = preference.toLowerCase();
  if (p.startsWith("jain")) {
    if (food.diet !== "veg") return "Not vegetarian — patient follows a Jain diet";
    if (!food.jain) return "Has root vegetables, onion or garlic — not Jain";
    return null;
  }
  if (p === "vegetarian" && food.diet !== "veg") return food.diet === "egg" ? "Contains egg — patient is vegetarian" : "Non-veg — patient is vegetarian";
  if (p === "eggetarian" && food.diet === "nonveg") return "Non-veg — patient is eggetarian";
  return null;
}

export function buildInitialPlans(): Record<string, PlanRecord> {
  const out: Record<string, PlanRecord> = {};
  for (const p of NUTRITION_PLANS) {
    const src = PLAN_SOURCE[p.id];
    const slots = src ? slotsFromTemplate(src.template, p.id, src.notes) : emptySlots();
    out[p.id] = { ...p, slots, baseline: slots, history: PLAN_HISTORY[p.id] ?? [], ack: null, templateReview: null };
  }
  return out;
}

/** The version the patient currently follows = latest published version. */
export const followedVersion = (plan: PlanRecord) => [...plan.history].reverse().find((v) => v.status === "published")?.version ?? null;

/** Demo-clock stamp for actions taken in this session. */
export const nowIso = () => TODAY.toISOString();

export function stamp(iso: string) {
  const d = new Date(iso);
  if (d.getTime() >= TODAY.getTime() - 60_000) return `today ${formatTime(iso)}`;
  return `${formatDate(iso, { day: "numeric", month: "short" })}, ${formatTime(iso)}`;
}

export const slotLabel = (id: SlotId) => SLOT_LABEL[id];

export const kcal = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
export const grams = (n: number) => `${Math.round(n * 10) / 10} g`;
