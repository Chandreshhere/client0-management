import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { patientById } from "@/data/patients";
import { getRecord } from "@/data/record";
import { PatientOverview } from "@/features/patient/patient-overview";
import { PatientSummary } from "@/features/patients/patient-summary";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = patientById(id);
  return { title: p ? `${p.name} · Overview` : "Patient" };
}

/** Patient workspace overview, built from this patient's own record (organs, systems and events
 *  derive from their conditions). Patients with nothing recorded yet get the registry summary. */
export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = patientById(id);
  if (!patient) notFound();
  const record = getRecord(id);
  return record && record.systems.length ? <PatientOverview patient={patient} record={record} /> : <PatientSummary patient={patient} />;
}
