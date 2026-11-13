"use client";

import type { ReactNode } from "react";
import { Briefcase, ClockCounterClockwise, CookingPot, ForkKnife, Stethoscope, Wallet, Warning } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { StatusBadge } from "@/components/ui/status";
import type { Guidance, Routine } from "./data";
import { PLAN_TONE, followedVersion, stamp, type PlanRecord } from "./model";

/* ------------------------------------------------------------------ routine */

/** "Adapt the plan to the patient's routine" (doc §2C differentiator) — visible while building. */
export function RoutinePanel({ patient, routine }: { patient: Patient; routine: Routine | undefined }) {
  const first = patient.name.split(" ")[0];
  return (
    <Group>
      <GroupHeader icon={<Briefcase />} title="Routine" subtitle={`Plan around how ${first} actually lives`} />
      {routine ? (
        <div className="flex flex-col gap-2">
          <Inset>
            <RailLabel icon={<Briefcase size={16} />} label="Work & schedule" extra={routine.officeDays ? <Pill size="sm" tone="neutral">{routine.officeDays}</Pill> : null} />
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{routine.work}</p>
            <p className="mt-2 text-xs text-muted">{routine.appetite}</p>
          </Inset>
          <Inset>
            <RailLabel icon={<CookingPot size={16} />} label="Cooking & food access" />
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{routine.cooking}</p>
            <p className="mt-2 text-xs text-muted">{routine.availability}</p>
          </Inset>
          <Inset>
            <RailLabel icon={<Wallet size={16} />} label="Budget" />
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{routine.budget}</p>
          </Inset>
          <Inset>
            <RailLabel icon={<ForkKnife size={16} />} label="Preferences & allergies" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {routine.preferences.map((p) => (
                <Pill key={p} size="sm" tone="neutral">{p}</Pill>
              ))}
            </div>
            <Allergies patient={patient} />
          </Inset>
        </div>
      ) : (
        <Inset>
          <p className="text-sm text-ink-2">Routine not captured yet.</p>
          <p className="mt-1 text-xs text-muted">Record work hours, cooking access, budget and preferences at the assessment so the plan can fit them.</p>
          <Allergies patient={patient} />
        </Inset>
      )}
    </Group>
  );
}

function Allergies({ patient }: { patient: Patient }) {
  if (patient.allergies === null) {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
        <Warning size={14} className="mt-px shrink-0" aria-hidden="true" />
        Allergies not recorded — confirm before publishing
      </p>
    );
  }
  if (patient.allergies.length === 0) return <p className="mt-3 text-xs text-muted">No known allergies (confirmed)</p>;
  return <p className="mt-3 text-xs text-ink-2">Allergies: {patient.allergies.join(", ")}</p>;
}

function RailLabel({ icon, label, extra }: { icon: ReactNode; label: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="text-ink-2" aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ guidance */

/** Current doctor guidance; publishing requires acknowledging this exact version (doc §2C). */
export function GuidanceCard({
  guidance,
  plan,
  editable,
  onAck,
}: {
  guidance: Guidance | undefined;
  plan: PlanRecord;
  editable: boolean;
  onAck: (checked: boolean) => void;
}) {
  if (!guidance) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-ink">
          <Stethoscope size={18} className="text-ink-2" aria-hidden="true" />
          Doctor guidance
        </div>
        <p className="mt-3 text-sm text-muted">No clinical guidance is on record for this patient. Ask the referring doctor before publishing if there are medical conditions.</p>
      </Card>
    );
  }
  const doc = staffById(guidance.by);
  const acked = plan.ack?.guidanceVersion === guidance.version;
  const staleAck = plan.ack && !acked;
  const ackId = `ack-${plan.id}`;
  return (
    <Card id="doctor-guidance" className="scroll-mt-28">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Doctor guidance</h2>
        {guidance.changed ? <StatusBadge tone="warning">Changed {formatDate(guidance.changed.at, { day: "numeric", month: "short" })}</StatusBadge> : <StatusBadge tone="success">Current</StatusBadge>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Avatar src={doc?.avatar} name={doc?.name ?? "Doctor"} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{doc?.name}</p>
          <p className="truncate text-xs text-muted">
            {guidance.version} · effective {formatDate(guidance.effective, { day: "numeric", month: "short" })} · review {formatDate(guidance.review, { day: "numeric", month: "short" })}
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {guidance.lines.map((l) => (
          <li key={l} className="flex gap-2 text-sm leading-relaxed text-ink-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-medical" aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
      {guidance.changed ? (
        <div className="mt-4 rounded-inner bg-warning-soft p-4">
          <p className="text-xs text-warning">What changed</p>
          <p className="mt-1 text-sm text-ink">{guidance.changed.summary}</p>
        </div>
      ) : null}
      <div className={cn("mt-4 flex items-start gap-3 rounded-inner p-4", acked ? "bg-success-soft" : "bg-canvas")}>
        <Checkbox id={ackId} checked={acked} disabled={!editable} onCheckedChange={(v) => onAck(v === true)} className="mt-0.5" aria-describedby={`${ackId}-hint`} />
        <div className="min-w-0">
          <label htmlFor={ackId} className={cn("text-sm text-ink", editable && "cursor-pointer")}>
            I&apos;ve reviewed guidance {guidance.version} and this plan follows it
          </label>
          <p id={`${ackId}-hint`} className={cn("mt-1 text-xs", acked ? "text-success" : "text-muted")}>
            {acked && plan.ack
              ? `Acknowledged by ${staffById(plan.ack.by)?.name ?? "you"} · ${stamp(plan.ack.at)}`
              : staleAck
                ? "Your earlier acknowledgement was for an older version — review again."
                : "Required before this plan can be published."}
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ history */

function DiffLine({ line }: { line: string }) {
  const sign = line[0];
  const text = line.slice(2);
  const tone = sign === "+" ? "text-success" : sign === "−" ? "text-danger" : "text-muted";
  const label = sign === "+" ? "Added" : sign === "−" ? "Removed" : "Changed";
  return (
    <li className="flex gap-2 text-xs leading-relaxed text-ink-2">
      <span className={cn("w-3 shrink-0 text-center font-mono", tone)} aria-label={label}>{sign}</span>
      <span>{text}</span>
    </li>
  );
}

/** What changed, why, who changed it and which version the patient follows (doc §2C). */
export function VersionHistory({ plan, sessionChanges }: { plan: PlanRecord; sessionChanges: string[] }) {
  const follows = followedVersion(plan);
  const patientFollows = follows ? `Patient follows v${follows}` : "No published version yet — the patient sees nothing";
  const versions = [...plan.history].sort((a, b) => b.version - a.version);
  return (
    <Group>
      <GroupHeader icon={<ClockCounterClockwise />} title="Version history" subtitle={patientFollows} />
      <ol className="flex flex-col gap-2">
        {versions.map((v) => {
          const author = staffById(v.by);
          const current = v.version === plan.version;
          const unpublished = current && plan.status !== "published" && plan.status !== "superseded" && sessionChanges.length > 0;
          return (
            <li key={v.version}>
              <Inset className={cn(current && "shadow-[inset_0_0_0_1px_var(--color-line-strong)]")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink">v{v.version}</span>
                  <StatusBadge tone={PLAN_TONE[v.status]}>{PLAN_STATUS_LABEL[v.status]}</StatusBadge>
                  {follows === v.version ? <Pill size="sm" tone="primary">Patient follows</Pill> : null}
                  <span className="ml-auto text-xs text-muted">{formatDate(v.at, { day: "numeric", month: "short" })}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Avatar src={author?.avatar} name={author?.name ?? "Staff"} size="xs" />
                  <span className="text-xs text-ink-2">{author?.name ?? "Unknown"}</span>
                </div>
                {v.why ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.why}</p> : null}
                {v.changes.length ? (
                  <ul className="mt-2 flex flex-col gap-1" aria-label={`Changes in v${v.version}`}>
                    {v.changes.map((c) => (
                      <DiffLine key={c} line={c} />
                    ))}
                  </ul>
                ) : null}
                {unpublished ? (
                  <div className="-mx-2 -mb-2 mt-3 rounded-[8px] bg-canvas p-3">
                    <p className="text-xs text-muted">Unpublished changes · this session</p>
                    <ul className="mt-1 flex flex-col gap-1" aria-label="Unpublished changes in this session">
                      {sessionChanges.map((c) => (
                        <DiffLine key={c} line={c} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Inset>
            </li>
          );
        })}
      </ol>
    </Group>
  );
}
