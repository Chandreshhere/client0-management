import { createTask } from "@/features/tasks/store";
import { TODAY_KEY, isoAt } from "@/features/tasks/time";
import { newId, nowIso } from "./model";
import { taskActions } from "./store";

/**
 * A follow-up task from the nutrition pages: one pending item with one owner, created in the shared
 * task list (so it shows on the owner's Tasks) and remembered here for the "created" tick.
 */
export function addFollowUpTask(input: { title: string; patientId: string; ownerId: string; byId: string; source: string }) {
  createTask({ title: input.title, patientId: input.patientId, ownerId: input.ownerId, due: isoAt(TODAY_KEY, "17:00"), priority: "normal", source: input.source }, input.byId);
  taskActions.add({ id: newId("task"), title: input.title, patientId: input.patientId, ownerId: input.ownerId, createdBy: input.byId, at: nowIso() });
}
