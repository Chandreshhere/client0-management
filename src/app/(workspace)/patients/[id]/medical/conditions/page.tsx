import type { Metadata } from "next";
import { ConditionsView } from "@/features/patient/profile/conditions";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Conditions & medicines") };
}

/** Medical → conditions and the history of medicine changes. */
export default async function ConditionsPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "medical", { clinical: true });
  return <ConditionsView patientId={id} />;
}
