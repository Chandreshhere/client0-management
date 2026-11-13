"use client";

import type { ReactNode } from "react";
import { LockSimple } from "@phosphor-icons/react";
import type { AppointmentStatus, Discipline } from "@/data/types";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { DISCIPLINE_COLOR } from "./data";

/** Small shared pieces for the schedule area. */

export function DisciplineDot({ discipline, className }: { discipline: Discipline; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: DISCIPLINE_COLOR[discipline] }} />;
}

/** Colour is never the only signal: the discipline is always written next to its mark. */
export function DisciplineTag({ discipline, className }: { discipline: Discipline; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <DisciplineDot discipline={discipline} />
      {DISCIPLINE_LABEL[discipline]}
    </span>
  );
}

export function DisciplineLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)} aria-label="Discipline colours">
      {(["medical", "nutrition", "movement"] as const).map((d) => (
        <DisciplineTag key={d} discipline={d} />
      ))}
    </div>
  );
}

export function ApptStatus({ status, className, pulse }: { status: AppointmentStatus; className?: string; pulse?: boolean }) {
  return (
    <StatusBadge tone={appointmentTone(status)} pulse={pulse ?? status === "in-session"} className={className}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

export function IntakeBadge({ complete, className }: { complete: boolean | undefined; className?: string }) {
  if (complete === undefined) return <StatusBadge tone="neutral" className={className}>No intake form</StatusBadge>;
  return complete ? (
    <StatusBadge tone="success" className={className}>Intake complete</StatusBadge>
  ) : (
    <StatusBadge tone="warning" className={className}>Intake missing</StatusBadge>
  );
}

/** Token chip — machine-read, so it's set in Geist Mono. */
export function TokenChip({ token, size = "md", className }: { token: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-charcoal font-mono text-white tabular",
        size === "lg" ? "h-8 px-3 text-sm" : "h-6 px-2.5 text-xs",
        className,
      )}
    >
      {token}
    </span>
  );
}

/** Avatar that drops the illustration (and shows initials) when privacy mode is on. */
export function PersonAvatar({ name, avatar, privacy, size = "md", className }: { name: string; avatar: string | null; privacy: boolean; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  return <Avatar src={privacy ? null : avatar} name={name} size={size} className={className} />;
}

/** Wraps a control that the current plan doesn't include: disabled, with a lock and an explanation. */
export function PlanLocked({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tip label={label}>
      <span className="inline-flex items-center gap-1.5" tabIndex={0}>
        {children}
        <LockSimple size={14} className="text-faint" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    </Tip>
  );
}

/** Key swatch for hatched areas (off duty, lunch, booked outside hours) — same 45° lines as the marks. */
export function HatchSwatch({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={cn("shrink-0 rounded-[3px]", className)}>
      <rect width="10" height="10" fill="var(--color-surface)" />
      {[-4, 0, 4, 8, 12].map((o) => (
        <line key={o} x1={o} y1={10} x2={o + 10} y2={0} stroke="var(--color-ink-2)" strokeOpacity={0.6} strokeWidth="1" />
      ))}
    </svg>
  );
}
