"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { TODAY, formatDayLabel, formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { LockBadge } from "@/components/shell/plan-switcher";
import { useRole } from "@/components/shell/role-context";
import { featureById, minPlanFor, type FeatureId } from "@/data/plans";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { patientById } from "@/data/patients";
import type { Appointment, Discipline, ReferralStage } from "@/data/types";
import { NOW_LABEL, branchFor, firstName } from "./data";

/**
 * Building blocks shared by the seven role homes. They only compose kit pieces
 * (Group / Inset / GroupHeader / PageHeader) so every home speaks the reference's language:
 * white cards, recessed grey groups holding white insets, circular ↗ links, and exactly one
 * cobalt focal card per view.
 */

/** Page header: date + branch eyebrow, light display greeting, 1–2 quick actions. */
export function DashboardHeader({ actions, summary }: { actions?: ReactNode; summary?: ReactNode }) {
  const { role, user } = useRole();
  const branch = branchFor(role);
  return (
    <PageHeader
      eyebrow={`${formatDayLabel(TODAY.toISOString())} · ${branch.name}`}
      title={`Good morning, ${firstName(user.name)}`}
      description={summary}
      actions={actions}
    />
  );
}

/** Spring reveal for dashboard cards — transform + opacity only, staggered by index. */
export function Reveal({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(index, 8) * 0.05 }} className={className}>
      {children}
    </motion.div>
  );
}

/** Three-column dashboard grid that collapses to one column on phones. */
export function DashGrid({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3", className)} {...props} />;
}

// ---------------------------------------------------------------------------------------------
// Cobalt focal card — the one accent per view.
// ---------------------------------------------------------------------------------------------

/** Cobalt frame with an 8px inset, so nested white insets keep concentric 16px corners. */
export function FocalCard({ className, labelledBy, ...props }: ComponentProps<"section"> & { labelledBy: string }) {
  return <section aria-labelledby={labelledBy} className={cn("flex flex-col gap-2 rounded-card bg-primary p-2 text-white", className)} {...props} />;
}

/** Header block inside the focal card (16px + the frame's 8px = 24px to the text). */
export function FocalHead({
  id,
  label,
  title,
  meta,
  aside,
  className,
}: {
  id: string;
  label: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 p-4", className)}>
      <div className="min-w-0 flex-1">
        <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">{label}</span>
        <h2 id={id} className="mt-4 text-title font-normal text-white">
          {title}
        </h2>
        {meta ? <div className="mt-2 text-sm text-white">{meta}</div> : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}

/** White inset sitting on the cobalt frame (reads like the reference's white chips on blue). */
export function FocalInset({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-inner bg-surface p-4 text-ink", className)} {...props} />;
}

/** Small label/value fact on the cobalt surface. Labels stay at ≥90% white for 4.5:1 contrast. */
export function FocalFact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-white/90">{label}</p>
      <div className="mt-1 text-sm text-white">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Neutral panels
// ---------------------------------------------------------------------------------------------

/** Recessed grey group with a reference-style header (icon · title/subtitle · ↗ link). */
export function Panel({
  icon,
  title,
  subtitle,
  href,
  actionLabel,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  href?: string;
  actionLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const id = useId();
  return (
    <Group role="region" aria-labelledby={id} className={cn("flex flex-col", className)}>
      <GroupHeader icon={icon} title={<h2 id={id}>{title}</h2>} subtitle={subtitle} href={href} actionLabel={actionLabel ?? `Open ${title.toLowerCase()}`} action={action} />
      <div className={cn("flex flex-1 flex-col gap-2", bodyClassName)}>{children}</div>
    </Group>
  );
}

/** A whole-row link inside a Panel (white inset, hover recedes to canvas). */
export function RowLink({ href, className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cn("block rounded-inner bg-surface p-4 transition-colors duration-200 hover:bg-canvas", className)} {...props}>
      {children}
    </Link>
  );
}

/** Empty state sized for a panel. */
export function PanelEmpty({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <Inset className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-muted [&_svg]:size-[18px]" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm text-ink">{title}</p>
      {description ? <p className="max-w-[36ch] text-xs text-muted">{description}</p> : null}
    </Inset>
  );
}

/** Live "now" marker for time-ordered lists (demo clock 09:40). */
export function NowMarker({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-2 py-1", className)} role="note" aria-label={`Now, ${NOW_LABEL}`}>
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-charcoal" />
        <span className="relative size-2 rounded-full bg-charcoal" />
      </span>
      <span className="text-xs font-medium text-ink tabular" aria-hidden="true">
        Now · {NOW_LABEL}
      </span>
      <span className="h-px flex-1 bg-charcoal/30" aria-hidden="true" />
    </div>
  );
}

/** Requested → Accepted → Booked → Completed → Acknowledged, with the stalled step ringed. */
export function StageTrack({ stage, stalled = false, className }: { stage: ReferralStage; stalled?: boolean; className?: string }) {
  const idx = REFERRAL_STAGES.indexOf(stage);
  return (
    <span role="img" aria-label={`Referral stage: ${REFERRAL_STAGE_LABEL[stage]}, step ${idx + 1} of ${REFERRAL_STAGES.length}`} className={cn("inline-flex items-center", className)}>
      {REFERRAL_STAGES.map((s, i) => (
        <span key={s} className="flex items-center" aria-hidden="true">
          {i > 0 ? <span className={cn("h-px w-3", i <= idx ? "bg-charcoal" : "bg-line-strong")} /> : null}
          <span
            className={cn(
              "size-2 rounded-full",
              i <= idx ? "bg-charcoal" : i === idx + 1 && stalled ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-warning)]" : "bg-line-strong",
            )}
          />
        </span>
      ))}
    </span>
  );
}

/** Generic progress track (e.g. Booked → Attended → Rebooked) with the stalled step ringed. */
export function StepTrack({ steps, reached, className }: { steps: string[]; reached: number; className?: string }) {
  return (
    <span role="img" aria-label={`${steps[Math.min(reached, steps.length - 1)]} reached; stopped before ${steps[reached + 1] ?? "the end"}`} className={cn("inline-flex items-center", className)}>
      {steps.map((s, i) => (
        <span key={s} className="flex items-center" aria-hidden="true">
          {i > 0 ? <span className={cn("h-px w-3", i <= reached ? "bg-charcoal" : "bg-line-strong")} /> : null}
          <span className={cn("size-2 rounded-full", i <= reached ? "bg-charcoal" : i === reached + 1 ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-warning)]" : "bg-line-strong")} />
        </span>
      ))}
    </span>
  );
}

/** Compact tile for a widget the current plan doesn't include. */
export function LockedTile({ feature, title, icon, description, className }: { feature: FeatureId; title: string; icon: ReactNode; description?: string; className?: string }) {
  const plan = minPlanFor(feature);
  const id = useId();
  return (
    <Group role="region" aria-labelledby={id} className={cn("flex flex-col", className)}>
      <GroupHeader
        icon={icon}
        title={
          <h2 id={id} className="flex items-center gap-2">
            {title}
            <LockBadge />
          </h2>
        }
        subtitle={`Not in your plan · available on ${plan.name}`}
      />
      <Inset className="flex flex-1 flex-col items-start justify-between gap-4">
        <p className="text-sm text-muted">{description ?? featureById(feature).description}</p>
        <Link href="/pricing" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-xs text-ink transition-colors duration-200 hover:bg-sunken-2">
          Available on {plan.name}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </Inset>
    </Group>
  );
}

const DISCIPLINE_COLOR: Record<Discipline, string> = {
  medical: "bg-medical",
  nutrition: "bg-nutrition",
  movement: "bg-movement",
  operations: "bg-ops",
};

/** Small categorical mark for a discipline — always paired with its text label. */
export function DisciplineDot({ discipline, className }: { discipline: Discipline; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", DISCIPLINE_COLOR[discipline], className)} />;
}

/** One appointment in a time-ordered list: time · patient · service · status. */
export function AppointmentRow({ appt, detail }: { appt: Appointment; detail?: ReactNode }) {
  const p = patientById(appt.patientId);
  const past = appt.status === "completed" || appt.status === "cancelled" || appt.status === "no-show";
  return (
    <RowLink href={`/patients/${appt.patientId}`} className="@container" aria-label={`${formatTime(appt.start)} ${p?.name ?? "Patient"}, ${appt.service}, ${APPOINTMENT_STATUS_LABEL[appt.status]}`}>
      <span className="flex items-start gap-3">
        <span className="w-12 shrink-0">
          <span className={cn("block text-sm tabular", past ? "text-muted" : "text-ink")}>{formatTime(appt.start)}</span>
          <span className="block text-xs text-muted">{appt.durationMin} min</span>
        </span>
        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", past ? "text-ink-2" : "text-ink")}>{p?.name ?? "Unknown patient"}</span>
          <span className="block truncate text-xs text-muted">{detail ?? appt.service}</span>
          <StatusBadge tone={appointmentTone(appt.status)} className="mt-2 @md:hidden">
            {APPOINTMENT_STATUS_LABEL[appt.status]}
          </StatusBadge>
        </span>
        <StatusBadge tone={appointmentTone(appt.status)} className="hidden @md:inline-flex">
          {APPOINTMENT_STATUS_LABEL[appt.status]}
        </StatusBadge>
      </span>
    </RowLink>
  );
}

/** Small count chip used in panel headers. */
export function CountChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs tabular",
        tone === "neutral" && "bg-surface text-ink-2",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
      )}
    >
      {children}
    </span>
  );
}
