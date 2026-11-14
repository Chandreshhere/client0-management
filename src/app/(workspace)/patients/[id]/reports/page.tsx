import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsTab } from "@/features/patient-record/documents-tab";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Reports") };
}

/** Reports — every uploaded document with date issued, date uploaded and review status. Supports ?doc= and ?upload=1. */
export default async function ReportsPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "reports");
  return (
    <Suspense>
      <DocumentsTab patientId={id} />
    </Suspense>
  );
}
