"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Stethoscope } from "@phosphor-icons/react";
import { formatTime, pluralize } from "@/lib/format";
import { spring } from "@/lib/motion";
import { AvatarStack } from "@/components/ui/avatar";
import { Inset } from "@/components/ui/card";
import { SegmentedBar } from "@/components/charts/bar-chart";
import { OrganCarousel } from "@/components/viz/organ";
import type { OrganKind } from "@/data/anatomy";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import type { AppointmentStatus } from "@/data/types";
import { NOW_MIN, istMinutes } from "./data";
import { caseMix, type CaseMixGroup } from "./derive";
import { Panel } from "./ui";
import { OrganBadge } from "./viz";

/**
 * Admin "Today's case-mix" (ref 3 body-condition carousel, applied to the clinic): every patient
 * on today's diary placed on the organ of their primary recorded condition. Admins route work,
 * they don't read charts — so the panel shows counts, disciplines and practitioners, never which
 * patient carries which condition.
 */

type OrganGroup = CaseMixGroup & { key: OrganKind };

const DISCIPLINES = [
  { id: "medical", color: "var(--color-medical)" },
  { id: "nutrition", color: "var(--color-nutrition)" },
  { id: "movement", color: "var(--color-movement)" },
] as const;

const IN_CLINIC = new Set<AppointmentStatus>(["arrived", "waiting", "in-session", "checkout"]);

export function CaseMixPanel({ className }: { className?: string }) {
  const groups = useMemo(() => caseMix(), []);
  const organs = groups.filter((g): g is OrganGroup => g.key !== "unrecorded");
  const unrecorded = groups.find((g) => g.key === "unrecorded");
  const patientTotal = groups.reduce((s, g) => s + g.patients.length, 0);
  const [selected, setSelected] = useState<OrganKind | undefined>(organs[0]?.key);
  const group = organs.find((g) => g.key === selected) ?? organs[0];

  return (
    <Panel
      icon={<Stethoscope />}
      title="Today's case-mix"
      subtitle={`${pluralize(patientTotal, "patient")} on today's diary · by the organ of their primary recorded condition`}
      href="/schedule"
      actionLabel="Open today's schedule"
      className={className}
    >
      {group ? (
        <>
          <Inset className="min-w-0">
            <OrganCarousel
              title="Organs on today's diary"
              items={organs.map((g) => ({ kind: g.key, label: `${g.label} · ${g.patients.length}`, note: pluralize(g.visits.length, "visit") }))}
              selected={group.key}
              onSelect={setSelected}
            />
          </Inset>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={group.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="min-w-0">
              <GroupDetail group={group} />
            </motion.div>
          </AnimatePresence>
          <p className="px-2 pb-1 pt-1 text-xs text-muted">
            Number on each organ = patients whose first recorded condition sits there; a patient counts once however many visits they have.
            {unrecorded ? ` ${pluralize(unrecorded.patients.length, "patient")} with nothing recorded yet ${unrecorded.patients.length === 1 ? "is" : "are"} not placed on an organ.` : ""} Counts only — names stay with each care team.
          </p>
        </>
      ) : (
        <Inset className="text-sm text-muted">No patients with a recorded condition are on today&apos;s diary.</Inset>
      )}
    </Panel>
  );
}

function GroupDetail({ group }: { group: OrganGroup }) {
  const parts = DISCIPLINES.map((d) => ({ label: DISCIPLINE_LABEL[d.id], value: group.visits.filter((v) => v.discipline === d.id).length, color: d.color }));
  const staff = [...new Set(group.visits.map((v) => v.staffId))].map((id) => staffById(id)).filter((s) => s !== undefined);
  const inClinic = group.visits.filter((v) => IN_CLINIC.has(v.status)).length;
  const next = group.visits.find((v) => v.status === "booked" && istMinutes(v.start) > NOW_MIN);
  const done = group.visits.filter((v) => v.status === "completed").length;
  const missed = group.visits.filter((v) => v.status === "no-show" || v.status === "cancelled").length;
  const flow = [
    inClinic ? `${inClinic} in clinic now` : null,
    next ? `next at ${formatTime(next.start)}` : "no more visits today",
    done ? `${done} done` : null,
    missed ? `${missed} missed or cancelled` : null,
  ].filter(Boolean);

  return (
    <Inset className="grid grid-cols-1 gap-6 md:grid-cols-3" aria-live="polite">
      <div className="flex items-start gap-3">
        <OrganBadge kind={group.key} size={48} tone="sunken" label={group.label} />
        <div className="min-w-0">
          <p className="text-xs text-muted">{group.label}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[32px] font-light leading-none tracking-[-0.02em] tabular">{group.patients.length}</span>
            <span className="text-sm text-ink-2">{group.patients.length === 1 ? "patient" : "patients"} · {pluralize(group.visits.length, "visit")}</span>
          </p>
          <p className="mt-2 text-xs text-muted">{flow.join(" · ")}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">Recorded conditions · patients</p>
        <ul className="flex flex-col gap-1">
          {group.conditions.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{c.name}</span>
              <span className="shrink-0 tabular text-ink-2">{c.patients}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-3 text-xs text-muted">Visits by discipline</p>
          <SegmentedBar parts={parts.filter((p) => p.value > 0)} label={`${group.label} visits by discipline today`} />
        </div>
        <div className="flex items-start gap-3">
          <AvatarStack people={staff.map((s) => ({ name: s.name, avatar: s.avatar }))} size="xs" max={4} />
          <p className="min-w-0 text-xs text-muted">Seen by {staff.map((s) => s.name).join(", ")}</p>
        </div>
      </div>
    </Inset>
  );
}
