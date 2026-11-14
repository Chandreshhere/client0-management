import type { Metadata } from "next";
import { ClassesWeek } from "@/features/classes/week-view";

export const metadata: Metadata = { title: "Sessions" };

/** Yoga sessions (spec F7): precautions to acknowledge, this week's sessions, session log. */
export default function ClassesPage() {
  return <ClassesWeek />;
}
