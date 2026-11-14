import type { Metadata } from "next";
import { YogaSection } from "@/features/patient/profile/yoga";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Yoga") };
}

/** Yoga — precautions (and their acknowledgement), goals, sessions, attendance, progress notes. */
export default async function YogaPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "yoga");
  return <YogaSection patientId={id} />;
}
