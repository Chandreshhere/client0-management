"use client";

import type { ReactNode } from "react";
import { CaretDown, CheckCircle, CircleNotch, Info, LockSimple, PencilSimpleLine } from "@phosphor-icons/react";
import type { Discipline, Role, Staff } from "@/data/types";
import { DEMO_USER } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from "@/components/ui/dropdown";
import type { Tone } from "@/components/ui/status";

/** Small pieces shared by the administration pages (billing, team, settings). */

export const ROLE_LABEL = (role: Role) => DEMO_USER[role].label;

export const DISCIPLINE_DOT: Record<Discipline, string> = {
  medical: "bg-medical",
  nutrition: "bg-nutrition",
  movement: "bg-movement",
  operations: "bg-ops",
};

/** Discipline dot + text label — colour is never the only signal. */
export function DisciplineTag({ discipline, label, className }: { discipline: Discipline; label?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DISCIPLINE_DOT[discipline])} aria-hidden="true" />
      {label ?? DISCIPLINE_LABEL[discipline]}
    </span>
  );
}

export const STAFF_STATUS: Record<Staff["status"], { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  "in-session": { label: "In session", tone: "dark" },
  "on-break": { label: "On break", tone: "warning" },
  "on-leave": { label: "On leave", tone: "danger" },
  off: { label: "Off", tone: "neutral" },
};

/**
 * Filter pill + single-choice menu. White at its default value; charcoal once it narrows the list
 * (the reference's selected pill), so an active filter reads at a glance.
 */
export function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
  icon,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string; count?: number }[];
  onChange: (v: T) => void;
  defaultValue: T;
  icon?: ReactNode;
  className?: string;
}) {
  const active = value !== defaultValue;
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-4",
            active
              ? "bg-charcoal text-white hover:bg-ink-2"
              : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
            className,
          )}
        >
          {icon}
          <span className={active ? "text-white/70" : "text-muted"}>{label}</span>
          <span className="max-w-[160px] truncate">{current}</span>
          <CaretDown className={active ? "text-white/70" : "text-muted"} aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[260px]">
        <DropdownLabel>{label}</DropdownLabel>
        <div data-lenis-prevent className="scrollbar-thin max-h-[min(420px,60dvh)] overflow-y-auto">
          <DropdownRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <DropdownRadioItem key={o.value} value={o.value} description={o.description}>
                <span className="flex items-center justify-between gap-2">
                  {o.label}
                  {typeof o.count === "number" ? <span className="rounded-full bg-sunken px-1.5 text-[11px] text-muted tabular">{o.count}</span> : null}
                </span>
              </DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

/** Quiet explanatory note on the recessed grey surface. */
export function InfoNote({ children, icon, className, tone = "neutral" }: { children: ReactNode; icon?: ReactNode; className?: string; tone?: "neutral" | "warning" | "danger" }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-[12px] p-3 text-xs",
        tone === "neutral" && "bg-sunken text-ink-2",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
        className,
      )}
    >
      <span className="mt-px shrink-0 [&_svg]:size-4" aria-hidden="true">
        {icon ?? <Info />}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Banner shown when the current role can look but not change. */
export function ReadOnlyBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card bg-surface p-4 sm:items-center sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
        <LockSimple size={18} />
      </span>
      <p className="text-sm text-ink-2">{children}</p>
    </div>
  );
}

export type SaveStatus = { kind: "clean" } | { kind: "dirty" } | { kind: "saving" } | { kind: "saved"; at: string };

/** Honest save-state chip: Unsaved changes · Saving… · Saved locally 09:40. */
export function SaveState({ status, className }: { status: SaveStatus; className?: string }) {
  if (status.kind === "clean") return null;
  const map = {
    dirty: { icon: <PencilSimpleLine />, text: "Unsaved changes", cls: "bg-warning-soft text-warning" },
    saving: { icon: <CircleNotch className="animate-spin" />, text: "Saving…", cls: "bg-sunken text-ink-2" },
    saved: { icon: <CheckCircle weight="fill" />, text: status.kind === "saved" ? `Saved locally · ${status.at}` : "", cls: "bg-success-soft text-success" },
  } as const;
  const s = map[status.kind];
  return (
    <span role="status" className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs [&_svg]:size-4", s.cls, className)}>
      {s.icon}
      {s.text}
    </span>
  );
}

/** Table wrapper: white card, horizontal scroll inside (never the page), Lenis-safe. */
export function TableCard({ children, className, minWidth = 960 }: { children: ReactNode; className?: string; minWidth?: number }) {
  return (
    <div data-lenis-prevent className={cn("scrollbar-thin relative overflow-x-auto rounded-card bg-surface", className)}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}
