import type { Metadata } from "next";
import { TimelineSection } from "@/features/patient/profile/timeline";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Timeline") };
}

/** Timeline (F9) — every event in date order, filterable by discipline, type and date. */
export default async function TimelinePage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "timeline");
  return <TimelineSection patientId={id} />;
}
