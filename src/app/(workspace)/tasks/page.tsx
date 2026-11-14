import type { Metadata } from "next";
import { TasksView } from "@/features/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

/** Pending items per role (one owner each): Mine · Raised by me · Whole clinic; detail drawer, ?new=1 modal. */
export default function TasksPage() {
  return <TasksView />;
}
