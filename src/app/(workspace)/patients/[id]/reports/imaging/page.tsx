import type { Metadata } from "next";
import { ImagingTab } from "@/features/patient-record/imaging-tab";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Imaging") };
}

/** Reports → imaging studies (illustrative renders, never diagnostic). */
export default async function ImagingPage({ params }: Props) {
  const { id } = await params;
  await openSection(id, "reports", { clinical: true });
  return <ImagingTab patientId={id} />;
}
