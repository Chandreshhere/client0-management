import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { patientById } from "@/data/patients";
import { NotesTab } from "@/features/patient-record/notes/notes-tab";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Notes` : "Consultation notes" };
}

/** Patient record → Notes: split view (context | structured note). `?new=1` opens a blank draft. */
export default async function PatientNotesPage({ params }: Props) {
  const { id } = await params;
  if (!patientById(id)) notFound();
  return (
    <Suspense>
      <NotesTab patientId={id} />
    </Suspense>
  );
}
