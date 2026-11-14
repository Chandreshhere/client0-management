import type { Metadata } from "next";
import { getRecord } from "@/data/record";
import { BodyMapView } from "@/features/patient/profile/body-map";
import { openSection, profileTitle } from "@/features/patient/profile/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: profileTitle((await params).id, "Body map") };
}

/** Optional doctor-only view (fix 9): the record organised by body system, organ and year. */
export default async function BodyMapPage({ params }: Props) {
  const { id } = await params;
  const { patient } = await openSection(id, "summary", { roles: ["doctor"] });
  return <BodyMapView patient={patient} record={getRecord(id)} />;
}
