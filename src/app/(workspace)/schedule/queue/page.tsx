import type { Metadata } from "next";
import { QueueView } from "@/features/schedule/queue-board";

export const metadata: Metadata = { title: "Queue" };

/** Front-desk token queue: arrivals, waiting, with practitioner, checkout, done. */
export default function QueuePage() {
  return <QueueView />;
}
