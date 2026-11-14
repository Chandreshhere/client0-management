"use client";

import Link from "next/link";
import { ClockCounterClockwise, FirstAidKit, NotePencil, Pill } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status";
import { useRole } from "@/components/shell/role-context";
import { formatDate } from "@/lib/format";
import { authorName } from "@/features/patient/event-meta";
import { readableDates } from "@/features/patient-record/record-model";
import { ProfileFrame } from "./frame";
import { conditionEvents, conditionsOf, currentMedicines, firstName, medicineHistory } from "./derive";
import { sectionHref } from "./sections";

const fmtMonth = (d: string) => formatDate(d, { month: "short", year: "numeric" });
const fmtDay = (d: string) => formatDate(d, { day: "numeric", month: "short", year: "numeric" });

/** Medical → conditions and medicines, each with its history. Doctors change them in a consultation (F3). */
export function ConditionsView({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role } = useRole();
  const doctor = role === "doctor";
  const conditions = conditionsOf(patientId);
  const meds = currentMedicines(patientId);
  const history = medicineHistory(patientId);
  const first = firstName(patient);

  return (
    <ProfileFrame
      patient={patient}
      title="Conditions & medicines"
      description={doctor ? "Add, update or stop them in today's consultation note — every change keeps its date and author." : "Read-only. The doctor updates conditions and medicines in a consultation note."}
      actions={
        doctor ? (
          <Button asChild variant="primary" leading={<NotePencil />}>
            <Link href={`${sectionHref(patientId, "medical")}?new=1`}>Update in a consultation note</Link>
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 @[960px]:grid-cols-2">
        <Group>
          <GroupHeader icon={<FirstAidKit />} title="Conditions" subtitle={`${conditions.filter((c) => c.status !== "Resolved").length} active · ${conditions.filter((c) => c.status === "Resolved").length} resolved`} />
          {conditions.length === 0 ? (
            <Inset>
              <p className="text-sm text-muted">No conditions recorded for {first} yet. They&apos;re added at the first consultation.</p>
            </Inset>
          ) : (
            <ul className="flex flex-col gap-2">
              {conditions.map((c) => {
                const recorded = conditionEvents(patientId, c.id).at(-1);
                return (
                  <li key={c.id} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{c.name}</p>
                        <p className="text-xs text-muted">
                          Since {fmtMonth(c.since)}
                          {recorded ? ` · recorded by ${authorName(recorded.authorId)}` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={c.status === "Active" ? "warning" : c.status === "Resolved" ? "neutral" : "info"}>{c.status}</StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Group>

        <div className="flex min-w-0 flex-col gap-6">
          <Group>
            <GroupHeader icon={<Pill />} title="Current medicines" subtitle={meds.length ? `${meds.length} on the record` : "None recorded"} />
            {meds.length === 0 ? (
              <Inset>
                <p className="text-sm text-muted">No medicines recorded for {first}.</p>
              </Inset>
            ) : (
              <ul className="flex flex-col gap-2">
                {meds.map((m) => (
                  <li key={m.id} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm text-ink">{m.name}</p>
                      <span className="shrink-0 text-xs text-muted">Since {fmtDay(m.since)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-2">{m.detail}</p>
                    <p className="mt-1 text-xs text-muted">Prescribed by {authorName(m.by)}</p>
                    {m.reported ? <p className="mt-1 text-xs text-warning">Patient reports: {m.reported.toLowerCase()}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Group>

          <Group>
            <GroupHeader icon={<ClockCounterClockwise />} title="Medicines history" subtitle="Started, changed and stopped — newest first" />
            {history.length === 0 ? (
              <Inset>
                <p className="text-sm text-muted">No medicine changes on record.</p>
              </Inset>
            ) : (
              <ol className="flex flex-col gap-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm text-ink">{h.title}</p>
                      <span className="shrink-0 text-xs text-muted">{fmtDay(h.date)}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{readableDates(h.detail)}</p>
                    <p className="mt-1 text-xs text-muted">{authorName(h.by)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Group>
        </div>
      </div>
    </ProfileFrame>
  );
}
