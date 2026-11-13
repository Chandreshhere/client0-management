import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { patientById } from "@/data/patients";
import { ImagingTab } from "@/features/patient-record/imaging-tab";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Imaging` : "Imaging" };
}

/** Patient record → Imaging: study grid and viewer (illustrative renders, never diagnostic). */
export default async function PatientImagingPage({ params }: Props) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  return <ImagingTab patientId={id} />;
}
