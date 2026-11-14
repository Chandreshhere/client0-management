import { redirect } from "next/navigation";
import { withQuery } from "@/features/patient/profile/session";

/** Earlier URL, kept so existing links work: /documents now lives at /reports in the five-section profile. */
export default async function LegacyDocuments({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  redirect(withQuery(`/patients/${id}/reports`, await searchParams));
}
