import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { patientById } from "@/data/patients";
import { getRecord } from "@/data/record";
import { JourneyView } from "@/features/patient/journey";
import { PatientSummary } from "@/features/patients/patient-summary";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${patientById(id)?.name ?? "Patient"} · Journey` };
}

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = patientById(id);
  if (!patient) notFound();
  const record = getRecord(id);
  return record && record.systems.length ? <JourneyView patient={patient} record={record} /> : <PatientSummary patient={patient} />;
}
