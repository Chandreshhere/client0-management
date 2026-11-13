import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { patientById } from "@/data/patients";
import { DocumentsTab } from "@/features/patient-record/documents-tab";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Documents` : "Documents" };
}

/** Patient record → Documents. Supports ?doc=<id> (open preview) and ?upload=1 (upload dialog). */
export default async function PatientDocumentsPage({ params }: Props) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  return (
    <Suspense>
      <DocumentsTab patientId={id} />
    </Suspense>
  );
}
