import type { Metadata } from "next";
import { TasksView } from "@/features/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

/** Care-team tasks: list grouped by due date, board by status, detail drawer, ?new=1 modal. */
export default function TasksPage() {
  return <TasksView />;
}
