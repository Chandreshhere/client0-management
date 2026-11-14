"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { ChatCircleDots, Eye, Info } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { TODAY, formatDayLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GroupHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useRole } from "@/components/shell/role-context";
import { CLINIC, DEMO_USER, staffById } from "@/data/staff";
import type { Discipline } from "@/data/types";
import { MESSAGE_ROUTE } from "./record";

/**
 * Portal building blocks. They only compose kit pieces so the patient's pages speak the
 * reference's language: light display headings, recessed grey groups holding white insets,
 * circular ↗ links and exactly one cobalt focal card per view.
 */

/** Page header with the date eyebrow, plus a staff-preview banner when a staff role opens it. */
export function PortalHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <StaffPreviewBanner />
      <PageHeader eyebrow={`${formatDayLabel(TODAY.toISOString())} · ${CLINIC.name}`} title={title} description={description} actions={actions} />
    </div>
  );
}

/** Staff opening /portal/* see the patient's view, labelled — they're not the patient. */
function StaffPreviewBanner() {
  const { role, setRole } = useRole();
  if (role === "patient") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 pl-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink" aria-hidden="true">
        <Eye size={18} />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink-2">
        You&apos;re previewing <span className="text-ink">Kabir Malhotra&apos;s patient portal</span> as {DEMO_USER[role].label.toLowerCase()}. Patients only ever see released content.
      </p>
      <Button size="sm" variant="dark" onClick={() => setRole("patient", { navigate: false })}>
        Switch to patient view
      </Button>
    </div>
  );
}

/**
 * Secure message to the care team (F15). The tooltip says where it goes — the owner set for the
 * patient (by default the primary doctor) — and the target reply time.
 */
export function MessageButton({ children = "Message my care team", className }: { children?: ReactNode; className?: string }) {
  return (
    <Tip label={MESSAGE_ROUTE}>
      <Button asChild variant="secondary" className={className}>
        <Link href="/messages?new=1">
          <ChatCircleDots />
          {children}
        </Link>
      </Button>
    </Tip>
  );
}

/** Spring reveal: transform + opacity only, staggered by index. */
export function Reveal({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(index, 8) * 0.05 }} className={className}>
      {children}
    </motion.div>
  );
}

/** Recessed grey group (reference) with an icon header and white insets as children. */
export function Panel({
  icon,
  title,
  subtitle,
  href,
  actionLabel,
  action,
  className,
  children,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  href?: string;
  actionLabel?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2 rounded-card bg-sunken p-2", className)}>
      <GroupHeader
        icon={icon}
        title={
          <h2 id={id} className="truncate">
            {title}
          </h2>
        }
        subtitle={subtitle}
        href={href}
        actionLabel={actionLabel}
        action={action}
      />
      {children}
    </section>
  );
}

/** Cobalt frame with an 8px inset so nested white insets keep concentric 16px corners. */
export function FocalCard({ className, labelledBy, ...props }: ComponentProps<"section"> & { labelledBy: string }) {
  return <section aria-labelledby={labelledBy} className={cn("flex flex-col gap-2 rounded-card bg-primary p-2 text-white", className)} {...props} />;
}

/** Header block inside the focal card (16px + the frame's 8px = 24px to the text). */
export function FocalHead({ id, label, title, meta, aside }: { id: string; label: ReactNode; title: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-4 pb-2">
      <div className="min-w-0 flex-1">
        <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">{label}</span>
        <h2 id={id} className="mt-4 text-title font-normal text-white">
          {title}
        </h2>
        {meta ? <div className="mt-2 text-sm text-white">{meta}</div> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/** Small heading for white cards/insets. */
export function CardTitle({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h3 id={id} className={cn("text-sm text-ink", className)}>
      {children}
    </h3>
  );
}

/** Patient-entered data stays visibly self-reported until a practitioner reviews it (doc §3B). */
export function SelfReportedBadge({ reviewed, pending = "awaiting review", className }: { reviewed?: { by: string; at: string } | null; pending?: string; className?: string }) {
  if (reviewed) {
    const who = staffById(reviewed.by)?.name ?? "your care team";
    return (
      <StatusBadge tone="neutral" className={className}>
        Self-reported · reviewed by {who}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="draft" className={className}>
      Self-reported · {pending}
    </StatusBadge>
  );
}

/** Honest one-liner for demo actions: what actually happened (nothing left the browser). */
export function DemoNote({ children, className, tone = "muted" }: { children: ReactNode; className?: string; tone?: "muted" | "light" }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs", tone === "light" ? "text-white" : "text-muted", className)}>
      <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const DISCIPLINE_DOT: Record<Discipline, string> = {
  medical: "bg-medical",
  nutrition: "bg-nutrition",
  movement: "bg-movement",
  operations: "bg-ops",
};

export const DISCIPLINE_TEXT: Record<Discipline, string> = {
  medical: "Doctor",
  nutrition: "Nutrition",
  movement: "Yoga & movement",
  operations: "Clinic team",
};

/** Discipline mark: a small categorical dot, always paired with its label in text. */
export function DisciplineTag({ discipline, className }: { discipline: Discipline; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DISCIPLINE_DOT[discipline])} aria-hidden="true" />
      {DISCIPLINE_TEXT[discipline]}
    </span>
  );
}

/** Avatar + name + secondary line for a staff member. */
export function StaffLine({ staffId, detail, size = "sm", className }: { staffId: string; detail?: ReactNode; size?: "xs" | "sm" | "md"; className?: string }) {
  const s = staffById(staffId);
  if (!s) return null;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar src={s.avatar} name={s.name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{s.name}</span>
        <span className="block truncate text-xs text-muted">{detail ?? s.title.split(" · ")[0]}</span>
      </span>
    </span>
  );
}

/** Label/value line used in summaries and drawers. */
export function MetaRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 text-sm", className)}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

/** Triggers a client-side file download (receipts, calendar files). Nothing is uploaded. */
export function downloadFile(name: string, content: string, type: string) {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.warn("[carelane] download unavailable in this browser", err);
    return false;
  }
}

/** Copies text with the async clipboard API; resolves false when the browser refuses. */
export async function copyText(text: string) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
