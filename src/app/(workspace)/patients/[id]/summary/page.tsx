import type { Metadata } from "next";
import { SummarySection } from "@/features/patient/profile/summary";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Summary") };
}

/** Summary — the default section for doctors and coordinators; demographics only for Admin and Reception. */
export default async function SummaryPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "summary");
  return <SummarySection patientId={id} />;
}
