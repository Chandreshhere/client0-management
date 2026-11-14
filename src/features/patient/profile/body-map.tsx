"use client";

import Link from "next/link";
import { ArrowLeft, Heartbeat } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import type { PatientRecord } from "@/data/record";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PatientOverview } from "@/features/patient/patient-overview";
import { firstName } from "./derive";
import { sectionHref } from "./sections";

/**
 * Body map — the record organised by body system, organ and year (fix 9). Optional and for doctors
 * only: nobody lands here by default; the Summary is the profile's starting point.
 */
export function BodyMapView({ patient, record }: { patient: Patient; record: PatientRecord | null }) {
  const back = (
    <Button asChild variant="secondary" leading={<ArrowLeft />}>
      <Link href={sectionHref(patient.id, "summary")}>Back to summary</Link>
    </Button>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${patient.name} · optional doctor view`}
        title="Body map"
        description="The same record grouped by body system, with documented links between events. Lines show links the record documents — not cause and effect."
        actions={back}
      />
      {record && record.systems.length ? (
        <PatientOverview patient={patient} record={record} />
      ) : (
        <Card className="py-6">
          <EmptyState
            icon={<Heartbeat />}
            title={`No conditions recorded for ${firstName(patient)} yet`}
            description="The body map groups the record by the body systems of recorded conditions. It fills in after the first consultation."
            action={back}
          />
        </Card>
      )}
    </div>
  );
}
