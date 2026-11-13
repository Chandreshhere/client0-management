import { useMemo } from "react";
import type { Discipline, Priority, Task, TaskStatus } from "@/data/types";
import { TASKS } from "@/data/care";
import { staffById } from "@/data/staff";
import { createSessionStore, localId, useSessionStore } from "./session-store";
import { TASK_HISTORY, type ActivityKind, type TaskActivity } from "./data";
import { NOW_ISO, byTime } from "./time";

/**
 * Tasks = the shared fixtures + whatever was created or changed in this browser session
 * (new task modal, "Turn into task" in messages, follow-ups from document review, chasers from
 * referrals). Nothing is sent anywhere.
 */
export interface CareTask extends Task {
  notes?: string;
  local?: boolean;
}

interface TaskState {
  created: CareTask[];
  patches: Record<string, Partial<CareTask>>;
  activity: Record<string, TaskActivity[]>;
}

const SEED: TaskState = { created: [], patches: {}, activity: {} };
export const taskStore = createSessionStore<TaskState>("carelane.care.tasks.v1", SEED);

export function useTasks(): CareTask[] {
  const s = useSessionStore(taskStore);
  return useMemo(() => [...s.created, ...TASKS].map((t) => (s.patches[t.id] ? { ...t, ...s.patches[t.id] } : t)), [s]);
}

export function useTaskActivity(id: string | null): TaskActivity[] {
  const s = useSessionStore(taskStore);
  return useMemo(() => (id ? [...(TASK_HISTORY[id] ?? []), ...(s.activity[id] ?? [])].sort((a, b) => byTime(a.at, b.at)) : []), [s, id]);
}

const entry = (actorId: string, kind: ActivityKind, text: string): TaskActivity => ({ id: localId("act"), at: NOW_ISO, actorId, kind, text });

export interface NewTaskInput {
  title: string;
  patientId?: string;
  ownerId: string;
  due: string;
  priority: Priority;
  source: string;
  discipline?: Discipline;
  notes?: string;
  status?: TaskStatus;
}

export function createTask(input: NewTaskInput, actorId: string): CareTask {
  const owner = staffById(input.ownerId);
  const task: CareTask = {
    id: localId("task"),
    title: input.title,
    patientId: input.patientId,
    ownerId: input.ownerId,
    createdBy: actorId,
    due: input.due,
    priority: input.priority,
    status: input.status ?? "todo",
    source: input.source,
    discipline: input.discipline ?? owner?.discipline ?? "operations",
    notes: input.notes,
    local: true,
  };
  const manual = input.source.startsWith("Created by");
  const created = entry(actorId, "created", input.notes ? `Created — “${input.notes}”` : manual ? "Created this task." : `Created from ${input.source}.`);
  taskStore.update((s) => ({ ...s, created: [task, ...s.created], activity: { ...s.activity, [task.id]: [created] } }));
  return task;
}

export function updateTask(id: string, patch: Partial<CareTask>, log?: { actorId: string; kind: ActivityKind; text: string }) {
  taskStore.update((s) => ({
    ...s,
    patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } },
    activity: log ? { ...s.activity, [id]: [...(s.activity[id] ?? []), entry(log.actorId, log.kind, log.text)] } : s.activity,
  }));
}

export function addTaskComment(id: string, actorId: string, text: string) {
  taskStore.update((s) => ({ ...s, activity: { ...s.activity, [id]: [...(s.activity[id] ?? []), entry(actorId, "comment", text)] } }));
}
