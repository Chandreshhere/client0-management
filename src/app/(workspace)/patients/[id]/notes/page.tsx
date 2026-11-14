import { redirect } from "next/navigation";
import { withQuery } from "@/features/patient/profile/session";

/** Earlier URL, kept so existing links work: /notes now lives at /medical in the five-section profile. */
export default async function LegacyNotes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  redirect(withQuery(`/patients/${id}/medical`, await searchParams));
}
