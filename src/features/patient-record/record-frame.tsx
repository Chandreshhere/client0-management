"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CalendarPlus, ClipboardText, LockSimple, Pulse } from "@phosphor-icons/react";
import { useRole } from "@/components/shell/role-context";
import type { Patient, Role } from "@/data/types";
import { staffById } from "@/data/staff";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { OrganImage, type OrganKind } from "@/components/viz/organ";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TAB_NOUN, recordHref, type RecordTab } from "./data";
import { roleLabel } from "./access";
import { nextVisit, todaysMedicalVisit } from "./record-model";
import { AllergyChip, PatientBanner, ProfileFrame } from "@/features/patient/profile/frame";

export { AllergyChip };

/** Patient banner for the record views — the profile's role-aware banner (no organ views, fix 9). */
export function RecordStrip({ patient }: { patient: Patient; focusSystemId?: string }) {
  return <PatientBanner patient={patient} />;
}

/**
 * Organ render cropped into a circle (the WebP has generous transparent padding). Organ views are
 * an optional doctor view (fix 9): everyone else gets a plain marker in the same footprint.
 */
export function OrganThumb({ kind, active = true, size = "md", className }: { kind: OrganKind; active?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const { role } = useRole();
  const box = { sm: "size-6", md: "size-8", lg: "size-12" }[size];
  if (role !== "doctor") {
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-canvas text-ink-2", box, className)} aria-hidden="true">
        <Pulse size={size === "lg" ? 20 : size === "md" ? 16 : 12} />
      </span>
    );
  }
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas", box, className)} aria-hidden="true">
      <OrganImage kind={kind} variant={active ? "color" : "grey"} className="absolute size-[160%] max-w-none" />
    </span>
  );
}

/** Banner, sub-views, page heading and content: every record view sits in the profile frame. */
export function RecordFrame({
  patient,
  title,
  description,
  actions,
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
    <ProfileFrame patient={patient} title={title} description={description} actions={actions}>
      {children}
    </ProfileFrame>
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
                Open the patient&apos;s profile
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

