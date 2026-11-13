import type { ReactNode } from "react";
import { ScheduleProvider } from "@/features/schedule/store";

/** Keeps the diary, queue and waitlist on one session store while moving between them. */
export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return <ScheduleProvider>{children}</ScheduleProvider>;
}
