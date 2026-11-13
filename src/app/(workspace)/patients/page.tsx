import type { Metadata } from "next";
import { PatientRegistry } from "@/features/patients/registry";

export const metadata: Metadata = { title: "Patients" };

const VIEWS = ["table", "cards", "browse"] as const;
type View = (typeof VIEWS)[number];
const isView = (v: unknown): v is View => typeof v === "string" && (VIEWS as readonly string[]).includes(v);

/**
 * Patient registry. Interactive UI (filters, layouts, register, duplicate checks) lives in the
 * client feature module; `?view=browse|cards|table` picks the first layout so a shared link
 * renders the right one without a flash.
 */
export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view } = await searchParams;
  return <PatientRegistry initialView={isView(view) ? view : "table"} />;
}
