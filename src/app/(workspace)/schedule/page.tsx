import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleView } from "@/features/schedule/schedule-view";
import { ScheduleSkeleton } from "@/features/schedule/skeleton";

export const metadata: Metadata = { title: "Schedule" };

/** Calendar (day / week) with booking, conflict checks and appointment actions. Supports ?new=1. */
export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleView />
    </Suspense>
  );
}
