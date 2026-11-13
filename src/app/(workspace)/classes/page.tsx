import type { Metadata } from "next";
import { ClassesWeek } from "@/features/classes/week-view";

export const metadata: Metadata = { title: "Classes" };

/** Yoga instructor workspace — week of classes and 1:1 sessions (doc §2D). */
export default function ClassesPage() {
  return <ClassesWeek />;
}
