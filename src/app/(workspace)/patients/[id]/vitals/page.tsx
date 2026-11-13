import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { patientById } from "@/data/patients";
import { VitalsTab } from "@/features/patient-record/vitals-tab";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Vital signs` : "Vital signs" };
}

/** Patient record → Vital Signs: latest readings, trends with targets, self-reported markers. */
export default async function PatientVitalsPage({ params }: Props) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  return <VitalsTab patientId={id} />;
}
