import { redirect } from "next/navigation";
import { withQuery } from "@/features/patient/profile/session";

/** Earlier URL, kept so existing links work: /labs now lives at /reports/labs in the five-section profile. */
export default async function LegacyLabs({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  redirect(withQuery(`/patients/${id}/reports/labs`, await searchParams));
}
