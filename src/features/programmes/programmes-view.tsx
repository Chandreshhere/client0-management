"use client";

import Link from "next/link";
import { ArrowUpRight, Flag } from "@phosphor-icons/react";
import { PATIENTS } from "@/data/patients";
import { staffById } from "@/data/staff";
import { pluralize } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/avatar";
import { useRole } from "@/components/shell/role-context";
import { PROGRAMMES, type Programme } from "@/features/billing/data";
import { DisciplineTag } from "@/features/settings/ui";

/**
 * Programmes (Pro, spec F16): enrol → milestones (e.g. week 4 and week 8 reviews) → completion
 * review → completion summary. One card per programme template: what it includes, its
 * milestones and who is enrolled now, each opening that patient's profile.
 */
const enrolled = (prog: Programme) => PATIENTS.filter((p) => p.program?.startsWith(prog.match));
/** "Heart Health · 12 weeks · week 9 of 12" → "Week 9 of 12" when the record states it. */
const weekOf = (program?: string | null) => program?.match(/week (\d+) of (\d+)/i)?.[0].replace(/^w/, "W") ?? null;

export function ProgrammesView() {
  const { role } = useRole();
  const clinical = role === "doctor" || role === "nutritionist" || role === "yoga";
  const total = PROGRAMMES.reduce((n, p) => n + enrolled(p).length, 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pro"
        title="Programmes"
        description={`${pluralize(PROGRAMMES.length, "programme")} · ${pluralize(total, "patient")} enrolled. Each runs to set milestones and ends with a completion review and a summary for the patient.`}
      />
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {PROGRAMMES.map((prog) => {
          const people = enrolled(prog);
          return (
            <li key={prog.id} className="flex flex-col gap-4 rounded-card bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-normal leading-tight tracking-[-0.01em] text-ink">{prog.match}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {prog.weeks ? `${prog.weeks} weeks` : "Open-ended"} · {pluralize(people.length, "patient")} enrolled
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted">Included</p>
                <ul className="flex flex-col gap-1.5 rounded-inner bg-sunken p-3">
                  {prog.includes.map((inc) => (
                    <li key={inc.label} className="flex items-center justify-between gap-3">
                      <DisciplineTag discipline={inc.discipline} label={inc.label} />
                      <span className="text-xs text-ink tabular">× {inc.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted">Milestones</p>
                <ol className="flex flex-col gap-1.5">
                  {prog.reviewPoints.map((m, i) => (
                    <li key={m} className="flex items-center gap-2 text-xs text-ink-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] text-ink tabular" aria-hidden="true">
                        {i + 1}
                      </span>
                      {m}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-xs text-ink-2">
                    <Flag size={14} className="ml-0.5 shrink-0 text-muted" aria-hidden="true" />
                    Completion review → completion summary for the patient
                  </li>
                </ol>
              </div>

              <div className="mt-auto">
                <p className="mb-2 text-xs text-muted">Enrolled</p>
                {people.length ? (
                  <ul className="flex flex-col gap-1">
                    {people.map((p) => {
                      const doc = p.careTeam.doctor ? staffById(p.careTeam.doctor) : null;
                      return (
                        <li key={p.id}>
                          <Link href={`/patients/${p.id}`} className="group flex items-center gap-3 rounded-inner p-2 transition-colors hover:bg-canvas">
                            <Avatar src={p.avatar} name={p.name} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{p.name}</span>
                              <span className="block truncate text-xs text-muted">
                                {[weekOf(p.program), clinical || role === "coordinator" ? doc?.name : null].filter(Boolean).join(" · ") || "Enrolled"}
                              </span>
                            </span>
                            <ArrowUpRight size={14} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-inner bg-canvas p-3 text-xs text-muted">Nobody enrolled yet.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
