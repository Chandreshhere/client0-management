"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Phone, ShieldWarning, Warning } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { clinicNumber } from "@/data/patients";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/misc";
import { useRole } from "@/components/shell/role-context";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useClasses } from "@/features/classes/store";
import { SUB_VIEWS, isFrontOffice, sectionHref, sectionOfPath } from "./sections";
import { precautionsOf } from "./derive";
import { useProfileStore } from "./profile-store";

/**
 * Frame for every profile section: one compact patient banner (what must never be missed for
 * this role), the section's sub-views where it has them, then the section heading and content.
 * The container-query root for the sections.
 */
export function ProfileFrame({ patient, title, description, actions, children }: { patient: Patient; title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <PatientBanner patient={patient} />
      <SectionSubNav patientId={patient.id} />
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

/**
 * Who this is and what this role must not miss: allergies for clinicians, precautions for the
 * instructor, contact details for the front office. No diagnoses or organ views here (fix 9).
 */
export function PatientBanner({ patient }: { patient: Patient }) {
  const { role } = useRole();
  const next = patient.nextAppointment;
  const sameDay = next ? formatDate(next) === formatDate(TODAY.toISOString()) : false;
  const nextLabel = next ? `${sameDay ? "Today" : formatDate(next, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(next)}` : null;
  const frontOffice = isFrontOffice(role);
  const clinician = role === "doctor" || role === "nutritionist";

  return (
    <section aria-label="Patient" className="flex items-center gap-3 rounded-card bg-sunken p-2">
      <Avatar src={patient.avatar} name={patient.name} size="md" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
          <p className="truncate text-xs text-muted">
            {patient.age} y · {patient.sex} · <span className="font-mono">{clinicNumber(patient.id)}</span>
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {clinician ? <AllergyChip allergies={patient.allergies} /> : null}
          {role === "yoga" ? <PrecautionChip patientId={patient.id} /> : null}
          {frontOffice ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs text-ink-2">
              <Phone size={14} aria-hidden="true" />
              {patient.phone}
            </span>
          ) : null}
          {patient.program && (clinician || role === "coordinator") ? <span className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-xs text-ink-2">{patient.program}</span> : null}
        </div>
        {nextLabel ? (
          <p className="ml-auto hidden pr-2 text-xs text-muted @[880px]:block">
            Next visit <span className="text-ink-2">{nextLabel}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PrecautionChip({ patientId }: { patientId: string }) {
  const local = useProfileStore((s) => s.precautions);
  const acks = useClasses().acks;
  const p = precautionsOf(patientId, local);
  const ack = acks[patientId];
  const pending = (p.state === "changed" || p.state === "expired") && !ack;
  if (!p.lines.length) return <span className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-xs text-muted">No precautions recorded</span>;
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-[16px] px-3 py-1 text-xs", pending ? "bg-warning-soft text-warning" : "bg-surface text-ink-2")}>
      <ShieldWarning size={16} className="shrink-0" aria-hidden="true" />
      {pending ? "Precautions changed · not acknowledged yet" : `${p.lines.length} ${p.lines.length === 1 ? "precaution" : "precautions"} · current`}
    </span>
  );
}

/** Sub-views of Medical and Reports (clinical roles only — the front office sees documents only). */
function SectionSubNav({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const { role } = useRole();
  const section = sectionOfPath(pathname);
  const views = section ? SUB_VIEWS[section] : undefined;
  if (!section || !views || isFrontOffice(role)) return null;
  const sub = pathname.split("/")[4];
  return (
    <nav aria-label="Views" className="scrollbar-none -my-2 overflow-x-auto py-2">
      <div className="flex w-max items-center gap-1 rounded-full bg-sunken p-1">
        {views.map((v) => {
          const active = (v.sub ?? undefined) === sub;
          return (
            <Link
              key={v.label}
              href={sectionHref(patientId, section, v.sub)}
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-xs transition-colors duration-200", active ? "bg-charcoal text-white" : "text-ink-2 hover:text-ink")}
            >
              {v.label}
            </Link>
          );
        })}
      </div>
    </nav>
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
