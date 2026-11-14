import type { Metadata } from "next";
import { QueueView } from "@/features/schedule/queue-board";

export const metadata: Metadata = { title: "Check-in" };

/** Check-in board: arrived → waiting → with practitioner → checkout → done, plus walk-ins. */
export default function QueuePage() {
  return <QueueView />;
}
