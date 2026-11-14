import type { Metadata } from "next";
import { VitalsTab } from "@/features/patient-record/vitals-tab";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Vital signs") };
}

/** Medical → vital signs: latest readings and trends with targets. */
export default async function VitalsPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "medical", { clinical: true });
  return <VitalsTab patientId={id} />;
}
