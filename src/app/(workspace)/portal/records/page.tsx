import type { Metadata } from "next";
import { RecordsView } from "@/features/portal/records/records-view";

export const metadata: Metadata = { title: "My records" };

/** Patient portal: released summaries, labs, imaging and prescriptions by body system; uploads (?upload=1) and record-rights requests. */
export default function PortalRecordsPage() {
  return <RecordsView />;
}
