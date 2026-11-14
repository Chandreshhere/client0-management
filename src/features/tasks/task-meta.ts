import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  BowlFood,
  ChatCircleText,
  ClipboardText,
  FileText,
  GearSix,
  NotePencil,
  PencilSimpleLine,
  PhoneCall,
  Receipt,
  Siren,
} from "@phosphor-icons/react";
import type { Priority, Task, TaskStatus } from "@/data/types";
import { staffById } from "@/data/staff";
import { planById, type FeatureId, type PlanId } from "@/data/plans";
import type { Tone } from "@/components/ui/status";
import { TODAY, formatTime } from "@/lib/format";
import { TODAY_KEY, addDays, byTime, dayDiff, dayKey, shortDay } from "./time";

/** Labels, grouping and due-date wording for tasks. Grouping is relative to Fri 13 Nov 09:40. */

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", "in-progress": "In progress", blocked: "Blocked", done: "Done" };
export const STATUS_ORDER: TaskStatus[] = ["todo", "in-progress", "blocked", "done"];
export const statusTone = (s: TaskStatus): Tone => ({ todo: "neutral", "in-progress": "info", blocked: "warning", done: "success" } as const)[s];

export const PRIORITY_LABEL: Record<Priority, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"];
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export type Bucket = "overdue" | "today" | "week" | "later" | "done";

const WEEK_END = addDays(TODAY_KEY, 2); // Sun 15 Nov

export const BUCKETS: { id: Bucket; label: string; hint: string }[] = [
  { id: "overdue", label: "Overdue", hint: "Past due — oldest first" },
  { id: "today", label: "Today", hint: "Friday 13 November" },
  { id: "week", label: "This week", hint: "Sat 14 – Sun 15 Nov" },
  { id: "later", label: "Later", hint: "From Monday 16 November" },
  { id: "done", label: "Completed", hint: "Done — kept for the record" },
];

export function bucketOf(t: Pick<Task, "status" | "due">): Bucket {
  if (t.status === "done") return "done";
  if (new Date(t.due).getTime() < TODAY.getTime()) return "overdue";
  const key = dayKey(t.due);
  if (key === TODAY_KEY) return "today";
  if (key <= WEEK_END) return "week";
  return "later";
}

/** Sort inside a group: by due time, then priority. */
export const byDue = (a: Task, b: Task) => byTime(a.due, b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

export function dueLabel(t: Pick<Task, "status" | "due">): { text: string; tone: "danger" | "ink" | "muted" } {
  const key = dayKey(t.due);
  const diff = dayDiff(TODAY_KEY, key);
  const time = formatTime(t.due);
  if (t.status === "done") return { text: diff === 0 ? `Due today ${time}` : `Due ${shortDay(t.due)}`, tone: "muted" };
  if (new Date(t.due).getTime() < TODAY.getTime()) {
    if (diff === 0) return { text: `Overdue · since ${time}`, tone: "danger" };
    const days = -diff;
    return { text: `Overdue · ${days} ${days === 1 ? "day" : "days"}`, tone: "danger" };
  }
  if (diff === 0) return { text: `Today · ${time}`, tone: "ink" };
  if (diff === 1) return { text: `Tomorrow · ${time}`, tone: "ink" };
  return { text: shortDay(t.due), tone: "muted" };
}

// ---------- sources ----------
export type SourceKind = "escalation" | "referral" | "report" | "message" | "billing" | "intake" | "follow-up" | "plan" | "note" | "admin" | "manual";

export const SOURCE_META: Record<SourceKind, { label: string; icon: Icon }> = {
  escalation: { label: "Flags to doctor", icon: Siren },
  referral: { label: "Assignments", icon: ArrowsLeftRight },
  report: { label: "Reports", icon: FileText },
  message: { label: "Messages", icon: ChatCircleText },
  billing: { label: "Billing", icon: Receipt },
  intake: { label: "Intake & consent", icon: ClipboardText },
  "follow-up": { label: "Missed follow-ups", icon: PhoneCall },
  plan: { label: "Plans & guidance", icon: BowlFood },
  note: { label: "Notes & consults", icon: NotePencil },
  admin: { label: "Admin", icon: GearSix },
  manual: { label: "Created manually", icon: PencilSimpleLine },
};

const SOURCE_RULES: [RegExp, SourceKind][] = [
  [/^flag from|escalat/i, "escalation"],
  [/referral/i, "referral"],
  [/message/i, "message"],
  [/lab|report|upload|document|scan/i, "report"],
  [/payment|invoice|upi|billing/i, "billing"],
  [/intake|consent/i, "intake"],
  [/missed|no-show|programme ended|rebook/i, "follow-up"],
  [/plan|food log|guidance/i, "plan"],
  [/draft|note|consult/i, "note"],
  [/duplicate|leave|role change|access/i, "admin"],
];

export function sourceKind(source: string): SourceKind {
  return SOURCE_RULES.find(([re]) => re.test(source))?.[1] ?? "manual";
}

export const DUE_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

// ---------- plan awareness (spec rule 7: the demo shows only what the plan includes) ----------
/** Fixtures that depend on a feature beyond Core, or on an add-on ("add-on" → never shown as working). */
const TASK_NEEDS: Record<string, FeatureId | "add-on"> = {
  t12: "self-report", // food-log photos come from the patient app
  t13: "programmes", // cohort case discussion
  t14: "programmes", // programme completion summary
  t15: "add-on", // UPI gateway callback — the payment gateway is an add-on
  t18: "release", // released to the patient app
};

/** Wording fixes for fixture sources (no lab integration in any plan; flags, not escalations). */
const SOURCE_OVERRIDE: Record<string, string> = {
  t1: "Report uploaded · 12 Nov",
  t3: "Flag from Kavya Nair · same day",
  t6: "Precaution changed · acknowledge before 17:00",
};

export const displaySource = (t: Pick<Task, "id" | "source">) => SOURCE_OVERRIDE[t.id] ?? t.source;

/**
 * Whether a task exists on this plan: its owner's role must be in the plan (no reception in Core,
 * no coordinator below Pro) and anything it depends on must be included. Assignment fixtures are
 * shown from the assignments themselves (assigned → seen), not as tasks.
 */
export function taskInPlan(t: Task, plan: PlanId, has: (f: FeatureId) => boolean): boolean {
  if (sourceKind(t.source) === "referral") return false;
  const need = TASK_NEEDS[t.id];
  if (need === "add-on" || (need && !has(need))) return false;
  const owner = staffById(t.ownerId);
  return !owner || planById(plan).roles.includes(owner.role);
}

/** What a clinical item is, without its clinical content — for roles that route work (admin, coordinator). */
const ROUTING_TITLE: Record<SourceKind, string> = {
  escalation: "Flag to respond to",
  referral: "Assignment",
  report: "Report to review",
  message: "Message to follow up",
  billing: "Billing item",
  intake: "Intake form",
  "follow-up": "Follow-up call",
  plan: "Nutrition plan to finish",
  note: "Note to sign",
  admin: "Admin item",
  manual: "Clinical item",
};

export function routingTitle(t: Pick<Task, "id" | "source">) {
  const src = displaySource(t);
  if (/precaution/i.test(src)) return "Precaution to acknowledge";
  if (/food log/i.test(src)) return "Food log to review";
  return ROUTING_TITLE[sourceKind(src)];
}
