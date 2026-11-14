import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesTab } from "@/features/patient-record/notes/notes-tab";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Medical") };
}

/** Medical → consultation notes (draft → signed, addenda). `?new=1` opens a blank draft. */
export default async function MedicalPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "medical");
  return (
    <Suspense>
      <NotesTab patientId={id} />
    </Suspense>
  );
}
