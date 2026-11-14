import type { Metadata } from "next";
import { ProgrammesView } from "@/features/programmes/programmes-view";

export const metadata: Metadata = { title: "Programmes" };

/** Pro (spec F16): programme templates, who is enrolled, milestones and the completion summary. */
export default function ProgrammesPage() {
  return <ProgrammesView />;
}
