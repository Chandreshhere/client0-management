"use client";

import { Pill as PillIcon, Warning } from "@phosphor-icons/react";
import { CARE_PLAN } from "@/data/featured";
import { staffById } from "@/data/staff";
import { Panel } from "../ui";
import { ME, MEDICINES, SYSTEMS } from "../record";
import { shortDate } from "../time";

/** Current medicines (released care plan + prescriptions), the doctor's standing guidance and allergies. */
export function MedicinesPanel() {
  const doctor = staffById(CARE_PLAN.medical.by);
  const guidance = CARE_PLAN.medical.text
    .split(".")
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
  const allergies = ME.allergies;

  return (
    <Panel icon={<PillIcon />} title="Medicines" subtitle={`${doctor?.name} · care plan updated ${shortDate(`${CARE_PLAN.medical.updated}T12:00:00+05:30`)}`}>
      <ul className="flex flex-col gap-2">
        {MEDICINES.map((m) => (
          <li key={m.name} className="flex items-start gap-3 rounded-inner bg-surface p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <PillIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm text-ink">
                  {m.name} <span className="text-ink-2">{m.dose}</span>
                </span>
                <span className="text-xs text-ink-2">{m.when}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {m.purpose} · {SYSTEMS.find((s) => s.id === m.systemId)?.area ?? ""}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {guidance.length ? (
        <div className="rounded-inner bg-surface p-4">
          <p className="text-sm text-ink">{doctor?.name.replace(/^Dr\.\s*/, "Dr. ")}&apos;s guidance</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2 marker:text-faint">
            {guidance.map((g) => (
              <li key={g}>{g}.</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-inner bg-surface p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning" aria-hidden="true">
          <Warning size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-ink">Allergies on your record</span>
          <span className="block text-xs text-muted">
            {allergies === null ? "Not recorded yet — tell the front desk at your next visit." : allergies.length ? allergies.join(" · ") : "No known allergies recorded."}
          </span>
        </span>
      </div>
    </Panel>
  );
}
