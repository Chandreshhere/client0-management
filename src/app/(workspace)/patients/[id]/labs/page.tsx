import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { patientById } from "@/data/patients";
import { LabsTab } from "@/features/patient-record/labs-tab";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Labs` : "Lab results" };
}

/** Patient record → Labs: panel results by report date, per-analyte trend with reference band. */
export default async function PatientLabsPage({ params }: Props) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  return <LabsTab patientId={id} />;
}
