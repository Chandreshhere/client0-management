"use client";

import { OrganImage } from "@/components/viz/organ";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import { PROOF_PATIENTS } from "@/features/marketing/care-map-model";
import { documentedLinks } from "@/features/marketing/journey-model";
import { OpenRecordLink } from "@/features/marketing/open-record";

/**
 * "Start from a patient" on /demo: four synthetic records, each shown with the organ its own
 * conditions open on, and counts computed from that record (events, documented links, span).
 * Opening one enters the demo on the Clinic plan as the doctor.
 */
export function DemoPatients() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PROOF_PATIENTS.map(({ patient, record, focus, lead, organLabel }) => {
        const links = documentedLinks(record).length;
        const first = record.events.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
        return (
          <li key={patient.id} className="flex flex-col rounded-card bg-surface p-2">
            <div className="relative flex h-[160px] items-center justify-center overflow-hidden rounded-inner bg-sunken">
              <OrganImage kind={focus.organ} className="size-[136px]" alt={`Illustration: ${organLabel.toLowerCase()}`} />
              <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-[11px] text-ink-2">{focus.name}</span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center gap-3">
                <Avatar src={patient.avatar} name={patient.name} size="md" loading="eager" />
                <div className="min-w-0">
                  <p className="truncate text-base text-ink">{patient.name}</p>
                  <p className="truncate text-xs text-muted">
                    {patient.age} years · {lead.name}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Events</dt>
                  <dd className="mt-1 text-[18px] font-light leading-none text-ink tabular">{record.events.length}</dd>
                </div>
                <div>
                  <dt className="text-muted">Links</dt>
                  <dd className="mt-1 text-[18px] font-light leading-none text-ink tabular">{links}</dd>
                </div>
                <div>
                  <dt className="text-muted">Since</dt>
                  <dd className="mt-1 text-[18px] font-light leading-none text-ink tabular">{first ? formatDate(first, { year: "numeric" }) : "—"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-muted">Recorded events, documented links between them, and the year of the first entry.</p>
              <div className="mt-auto pt-3">
                <OpenRecordLink patientId={patient.id} className="-ml-3">
                  Open {patient.name.split(" ")[0]}&apos;s record
                </OpenRecordLink>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
