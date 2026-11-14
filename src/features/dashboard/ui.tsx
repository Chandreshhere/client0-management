"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { TODAY, formatDayLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { useRole } from "@/components/shell/role-context";
import { staffById } from "@/data/staff";
import type { Discipline } from "@/data/types";
import { NOW_LABEL, branchFor, firstName } from "./data";

/**
 * Building blocks shared by the seven role homes. Each home answers one question with 3–5 short
 * sections: one cobalt focal card (the answer), plus recessed grey groups holding white insets.
 * Every row opens the patient profile section it belongs to, or its own screen.
 */

/** Page header: date + branch eyebrow, light display greeting, one-line answer, 1–2 quick actions. */
export function DashboardHeader({ actions, summary }: { actions?: ReactNode; summary?: ReactNode }) {
  const { role, user, has } = useRole();
  const branch = branchFor(role);
  return (
    <PageHeader
      eyebrow={has("branches") ? `${formatDayLabel(TODAY.toISOString())} · ${branch.name}` : formatDayLabel(TODAY.toISOString())}
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

/**
 * Side rail in a three-column dashboard: a shorter column stays in view while the longer side
 * scrolls, instead of ending early and leaving a blank column. Capped at the window height;
 * anything taller scrolls inside the rail. The grid item stretches over its rows and an inner box
 * is sticky — Chrome bounds a sticky grid item by the whole grid.
 */
export function Rail({ index = 0, className, innerClassName, children }: { index?: number; className?: string; innerClassName?: string; children: ReactNode }) {
  return (
    <Reveal index={index} className={className}>
      <div className={cn("scrollbar-thin flex flex-col gap-4 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-96px)] xl:overflow-y-auto xl:rounded-card", innerClassName)}>{children}</div>
    </Reveal>
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
export function FocalHead({ id, label, title, meta, aside, className }: { id: string; label: ReactNode; title: ReactNode; meta?: ReactNode; aside?: ReactNode; className?: string }) {
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

/** Big number + caption in the focal head's corner. */
export function FocalStat({ value, caption }: { value: ReactNode; caption: ReactNode }) {
  return (
    <div className="text-right">
      <p className="text-title font-normal tabular">{value}</p>
      <p className="text-xs text-white/90">{caption}</p>
    </div>
  );
}

/** White inset sitting on the cobalt frame. */
export function FocalInset({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-inner bg-surface p-4 text-ink", className)} {...props} />;
}

/** Small section label on the cobalt surface (labels stay ≥90% white for 4.5:1 contrast). */
export function FocalLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("px-4 pt-2 text-xs text-white/90", className)}>{children}</p>;
}

/** White inset that holds a list of compact rows (rows recede to canvas on hover). */
export function InsetList({ className, label, children }: { className?: string; label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className={cn("flex flex-col rounded-inner bg-surface p-2 text-ink", className)}>
      {children}
    </ul>
  );
}

/**
 * One compact row inside an InsetList: lead (time / avatar) · title + meta · trailing badge.
 * With `href` the whole row opens the item; trailing wraps under the text on narrow cards.
 */
export function ListRow({
  href,
  lead,
  title,
  meta,
  trailing,
  muted,
  className,
  ariaLabel,
}: {
  href?: string;
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  muted?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const body = (
    <span className="flex items-start gap-3">
      {lead}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", muted ? "text-muted" : "text-ink")}>{title}</span>
        {meta ? <span className="block text-xs text-muted">{meta}</span> : null}
        {trailing ? <span className="mt-2 flex flex-wrap gap-1.5 @md:hidden">{trailing}</span> : null}
      </span>
      {trailing ? <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 @md:flex">{trailing}</span> : null}
    </span>
  );
  return (
    <li className={cn("@container", className)}>
      {href ? (
        <Link href={href} aria-label={ariaLabel} className="block rounded-[12px] px-2 py-2 transition-colors duration-200 hover:bg-canvas">
          {body}
        </Link>
      ) : (
        <div className="rounded-[12px] px-2 py-2">{body}</div>
      )}
    </li>
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

/**
 * A pending item inside a Panel: avatar · name (opens the profile) · what it is · badge, with
 * optional actions underneath. Without actions the whole card is the link.
 */
export function ItemCard({
  href,
  avatar,
  name,
  lines,
  badge,
  actions,
  footer,
  ariaLabel,
  className,
}: {
  href: string;
  avatar?: { src?: string | null; name: string };
  name: ReactNode;
  lines?: ReactNode[];
  badge?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  // The badge sits on the name row so the detail lines use the card's full width.
  const head = (linked: boolean) => (
    <span className="flex items-start gap-3">
      {avatar ? <Avatar src={avatar.src} name={avatar.name} size="sm" /> : null}
      <span className="min-w-0 flex-1">
        <span className="flex min-h-6 items-start justify-between gap-2">
          {linked ? (
            <Link href={href} className="min-w-0 truncate pt-0.5 text-sm text-ink underline-offset-4 hover:underline">
              {name}
            </Link>
          ) : (
            <span className="min-w-0 truncate pt-0.5 text-sm text-ink">{name}</span>
          )}
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </span>
        {lines?.filter(Boolean).map((l, i) => (
          <span key={i} className="block text-xs text-muted">
            {l}
          </span>
        ))}
      </span>
    </span>
  );
  if (!actions && !footer) {
    return (
      <RowLink href={href} aria-label={ariaLabel} className={className}>
        {head(false)}
      </RowLink>
    );
  }
  return (
    <div className={cn("flex flex-col rounded-inner bg-surface p-4", className)}>
      {head(true)}
      {footer ? <div className="mt-3">{footer}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

/** Empty state sized for a panel. */
export function PanelEmpty({ icon, title, description }: { icon: ReactNode; title: string; description?: ReactNode }) {
  return (
    <Inset className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-muted [&_svg]:size-[18px]" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm text-ink">{title}</p>
      {description ? <p className="max-w-[40ch] text-xs text-muted">{description}</p> : null}
    </Inset>
  );
}

/** "Owner" line: avatar + name (or "You"), so every pending item shows who it belongs to. */
export function OwnerTag({ staffId, me, prefix = "Owner", className }: { staffId: string; me?: string; prefix?: string; className?: string }) {
  const s = staffById(staffId);
  return (
    <span className={cn("flex min-w-0 items-center gap-2 text-xs text-muted", className)}>
      <Avatar src={s?.avatar} name={s?.name ?? ""} size="xs" />
      <span className="min-w-0 truncate">
        {prefix} · <span className="text-ink-2">{staffId === me ? "You" : s?.name}</span>
      </span>
    </span>
  );
}

/** Live "now" marker for time-ordered lists (demo clock 09:40). */
export function NowMarker({ className }: { className?: string }) {
  return (
    <li className={cn("flex items-center gap-2 px-2 py-1", className)} aria-label={`Now, ${NOW_LABEL}`}>
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-charcoal" />
        <span className="relative size-2 rounded-full bg-charcoal" />
      </span>
      <span className="text-xs font-medium text-ink tabular" aria-hidden="true">
        Now · {NOW_LABEL}
      </span>
      <span className="h-px flex-1 bg-charcoal/30" aria-hidden="true" />
    </li>
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

/** Time column for time-ordered rows. */
export function TimeLead({ time, sub, muted }: { time: string; sub?: string; muted?: boolean }) {
  return (
    <span className="w-12 shrink-0">
      <span className={cn("block text-sm tabular", muted ? "text-muted" : "text-ink")}>{time}</span>
      {sub ? <span className="block text-xs text-muted">{sub}</span> : null}
    </span>
  );
}
