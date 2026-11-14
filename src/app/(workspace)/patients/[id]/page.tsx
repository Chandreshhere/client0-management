import { notFound, redirect } from "next/navigation";
import { patientById } from "@/data/patients";
import { entryFor, profileSession } from "@/features/patient/profile/session";

/** F1: the profile opens on the section for the role (doctor → Summary, nutritionist → Nutrition, instructor → Yoga). */
export default async function PatientEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  const { role, has } = await profileSession();
  redirect(entryFor(id, role, has));
}
