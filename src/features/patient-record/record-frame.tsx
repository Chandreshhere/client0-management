"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CalendarPlus, ClipboardText, LockSimple, Warning } from "@phosphor-icons/react";
import type { Patient, Role } from "@/data/types";
import { ORGAN_LABEL } from "@/data/anatomy";
import { clinicNumber } from "@/data/patients";
import { staffById } from "@/data/staff";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import { OrganImage, type OrganKind } from "@/components/viz/organ";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TAB_NOUN, recordHref, type RecordTab } from "./data";
import { roleLabel } from "./access";
import { nextVisit, recordOf, systemConditionText, todaysMedicalVisit } from "./record-model";

/**
 * Patient banner for the record tabs: who this is, what must never be missed (allergies) and
 * which body systems their record covers — each organ comes from their recorded conditions, the
 * one the current tab is about in colour. One compact row (wraps under the name on phones).
 */
export function RecordStrip({ patient, focusSystemId }: { patient: Patient; focusSystemId?: string }) {
  const next = patient.nextAppointment;
  const sameDay = next ? formatDate(next) === formatDate(TODAY.toISOString()) : false;
  const nextLabel = next ? `${sameDay ? "Today" : formatDate(next, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(next)}` : null;

  return (
    <section aria-label="Patient" className="flex items-start gap-3 rounded-card bg-sunken p-2 @[640px]:items-center">
      <Avatar src={patient.avatar} name={patient.name} size="md" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
          <p className="truncate text-xs text-muted">
            {patient.age} y · {patient.sex} · <span className="font-mono">{clinicNumber(patient.id)}</span>
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <AllergyChip allergies={patient.allergies} />
          {patient.program ? <span className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-xs text-ink-2">{patient.program}</span> : null}
          <SystemOrgans patientId={patient.id} focusSystemId={focusSystemId} />
        </div>
        {nextLabel ? (
          <p className="ml-auto hidden pr-2 text-xs text-muted @[880px]:block">
            Next visit <span className="text-ink-2">{nextLabel}</span>
          </p>
        ) : null}
      </div>
      <Tip label="Patient overview" side="bottom">
        <Link
          href={recordHref(patient.id)}
          aria-label={`Open ${patient.name}'s overview`}
          className="flex size-10 shrink-0 items-center justify-center self-start rounded-full bg-surface text-ink transition-[background-color,transform] duration-200 hover:bg-canvas active:scale-95 @[640px]:self-center"
        >
          <ArrowUpRight size={18} />
        </Link>
      </Tip>
    </section>
  );
}

/** Organ render cropped into a circle (the WebP has generous transparent padding). */
export function OrganThumb({ kind, active = true, size = "md", className }: { kind: OrganKind; active?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = { sm: "size-6", md: "size-8", lg: "size-12" }[size];
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas", box, className)} aria-hidden="true">
      <OrganImage kind={kind} variant={active ? "color" : "grey"} className="absolute size-[160%] max-w-none" />
    </span>
  );
}

/**
 * The patient's body systems as organs: the focused system (or the primary one) in colour with
 * its organ and conditions named; the others as grey thumbnails with the same detail on hover.
 */
function SystemOrgans({ patientId, focusSystemId }: { patientId: string; focusSystemId?: string }) {
  const record = recordOf(patientId);
  if (!record) {
    return <span className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-xs text-muted">No conditions recorded yet</span>;
  }
  const focus = record.systems.find((s) => s.id === focusSystemId) ?? record.systems[0];
  const others = record.systems.filter((s) => s.id !== focus.id);
  const focusText = systemConditionText(record, focus);
  // first condition named, the rest counted (all of them are in the tooltip)
  const [firstCondition, ...more] = focusText.split(", ");
  const shortText = more.length ? `${firstCondition} +${more.length}` : firstCondition;
  return (
    <span className="inline-flex h-10 min-w-0 max-w-full items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 @[1080px]:max-w-[360px]">
      <Tip label={`${focus.name} system · organ shown for ${focusText}`}>
        <span tabIndex={0} className="flex rounded-full">
          <OrganThumb kind={focus.organ} />
        </span>
      </Tip>
      <span className="min-w-0 truncate text-xs text-ink-2">
        {ORGAN_LABEL[focus.organ]} <span className="text-muted">· {shortText}</span>
      </span>
      {others.length ? (
        <span className="flex shrink-0 -space-x-1.5">
          {others.map((s) => (
            <Tip key={s.id} label={`${ORGAN_LABEL[s.organ]} · ${s.name} — ${systemConditionText(record, s)}`}>
              <span tabIndex={0} className="flex rounded-full ring-2 ring-surface">
                <OrganThumb kind={s.organ} active={false} size="sm" />
              </span>
            </Tip>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** Allergies: listed → alert chip; empty list → confirmed none; null → not recorded (never "none"). */
export function AllergyChip({ allergies, className }: { allergies: string[] | null; className?: string }) {
  if (allergies === null) {
    return (
      <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-[16px] bg-warning-soft px-3 py-1 text-xs text-warning", className)}>
        <Warning size={16} aria-hidden="true" />
        Allergies not recorded — ask before prescribing
      </span>
    );
  }
  if (allergies.length === 0) {
    return <span className={cn("inline-flex h-8 items-center rounded-full bg-surface px-3 text-xs text-ink-2", className)}>No known allergies (confirmed)</span>;
  }
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-[16px] bg-danger-soft px-3 py-1 text-xs text-danger", className)}>
      <Warning size={16} className="shrink-0" aria-hidden="true" />
      <span>
        <span className="sr-only">Allergies: </span>
        <span aria-hidden="true">Allergies · </span>
        {allergies.join(", ")}
      </span>
    </span>
  );
}

/** Strip + page heading + tab content. The container query root for every record tab. */
export function RecordFrame({
  patient,
  title,
  description,
  actions,
  focusSystemId,
  children,
}: {
  patient: Patient;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  focusSystemId?: string;
  children: ReactNode;
}) {
  return (
    <div className="@container flex flex-col gap-6">
      <RecordStrip patient={patient} focusSystemId={focusSystemId} />
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

/**
 * Nothing clinical recorded yet (no classified condition): say so plainly and point to where the
 * record starts — registration & intake, and the first consultation.
 */
export function NoRecordState({ patient, tab }: { patient: Patient; tab: RecordTab }) {
  const first = patient.name.split(" ")[0];
  const visit = todaysMedicalVisit(patient.id) ?? nextVisit(patient.id);
  const withName = visit ? staffById(visit.staffId)?.name : undefined;
  const visitText = visit
    ? `${formatDate(visit.start) === formatDate(TODAY.toISOString()) ? "Today" : formatDate(visit.start, { weekday: "short", day: "numeric", month: "short" })} ${formatTime(visit.start)} · ${visit.service}${withName ? ` with ${withName}` : ""} (${APPOINTMENT_STATUS_LABEL[visit.status].toLowerCase()})`
    : null;
  return (
    <Card className="py-6">
      <EmptyState
        icon={<ClipboardText />}
        title={`No ${TAB_NOUN[tab]} for ${first} yet`}
        description={
          <>
            Nothing clinical is on {first}&apos;s record — no conditions, results or notes. Registered {formatDate(patient.registeredAt, { day: "numeric", month: "short", year: "numeric" })}
            {patient.intakeComplete ? "" : "; the intake form isn't complete"}.
            {visitText ? (
              <span className="mt-2 block text-ink-2">{visitText}</span>
            ) : (
              <span className="mt-2 block">No consultation booked yet.</span>
            )}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="dark">
              <Link href={recordHref(patient.id)}>
                Open registration &amp; intake
                <ArrowUpRight />
              </Link>
            </Button>
            {!visit ? (
              <Button asChild variant="secondary">
                <Link href="/schedule?new=1">
                  <CalendarPlus />
                  Book first consultation
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
    </Card>
  );
}

/** Roles that route records without reading clinical contents. */
export function RestrictedRecord({ role, tab }: { role: Role; tab: RecordTab }) {
  const noun = TAB_NOUN[tab];
  return (
    <Card className="py-6">
      <EmptyState
        icon={<LockSimple />}
        title={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} aren't shown to the ${roleLabel(role)} role`}
        description="Front desk and admin can register patients and route reports without reading clinical contents. In production the server enforces this on every request; the role switcher here is a demo affordance."
      />
    </Card>
  );
}

