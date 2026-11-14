import type { Metadata } from "next";
import { LabsTab } from "@/features/patient-record/labs-tab";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Lab results") };
}

/** Reports → lab results by date issued, with per-analyte trends. */
export default async function LabsPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "reports", { clinical: true });
  return <LabsTab patientId={id} />;
}
