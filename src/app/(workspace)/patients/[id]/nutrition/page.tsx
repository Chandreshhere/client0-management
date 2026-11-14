import type { Metadata } from "next";
import { NutritionSection } from "@/features/patient/profile/nutrition";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Nutrition") };
}

/** Nutrition — current plan, versions with reasons, assessment, follow-ups, the doctor's guidance alongside. */
export default async function NutritionPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "nutrition");
  return <NutritionSection patientId={id} />;
}
