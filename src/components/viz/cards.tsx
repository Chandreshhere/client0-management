"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarBlank, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Small compositions from refs 2, 3 and 5:
 * - ChipGroup: filter chips — "dark" (ref 5: selected = charcoal) or "dot" (ref 2: leading dot).
 * - MediaStatCard: dark image card with a big number (ref 5 "47 Final Diastolic Dimension").
 * - PeopleList: doctor/staff rows with a count bubble (ref 5 left column).
 * - ScheduleCard: next check-up with date stepper, doctors and a primary action (ref 3).
 * - SectionLabel: "• My Heart Condition" heading (ref 3).
 */

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  variant = "dark",
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; dot?: string; count?: number }[];
  value: T[];
  onChange: (v: T[]) => void;
  variant?: "dark" | "dot";
  ariaLabel: string;
  className?: string;
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs transition-[background-color,color,box-shadow] duration-200",
              variant === "dark"
                ? on
                  ? "bg-charcoal text-white"
                  : "text-muted hover:bg-surface hover:text-ink"
                : on
                  ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                  : "bg-sunken text-muted hover:text-ink",
            )}
          >
            {variant === "dot" ? <span className="size-1.5 rounded-full" style={{ background: o.dot ?? (on ? "var(--color-primary)" : "var(--color-faint)") }} aria-hidden="true" /> : null}
            {o.label}
            {typeof o.count === "number" ? <span className={cn("rounded-full px-1.5 text-[10px] tabular", on && variant === "dark" ? "bg-white/20" : "bg-sunken")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function MediaStatCard({ value, label, media, onOpen, className, time }: { value: ReactNode; label: string; media: ReactNode; onOpen?: () => void; className?: string; time?: string }) {
  return (
    <div className={cn("relative isolate h-[132px] overflow-hidden rounded-card bg-charcoal text-white", className)}>
      <div className="absolute inset-y-0 right-0 w-[62%] opacity-90 [mask-image:linear-gradient(to_right,transparent,black_35%)]">{media}</div>
      <div className="relative z-[1] flex h-full flex-col justify-between p-4">
        <span className="pr-12 text-[11px] text-white/60 tabular">{time}</span>
        <span>
          <span className="block text-[32px] font-light leading-none tracking-[-0.02em] tabular">{value}</span>
          <span className="mt-1 block max-w-[14ch] text-[11px] leading-tight text-white/70">{label}</span>
        </span>
      </div>
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={`Open ${label}`} className="absolute right-3 top-3 z-[2] flex size-9 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95">
          <ArrowUpRight size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function PeopleList({
  people,
  selected,
  onSelect,
  className,
}: {
  people: { id: string; name: string; role: string; avatar?: string | null; count?: number }[];
  selected?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {people.map((p) => {
        const on = p.id === selected;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect?.(p.id)}
              aria-pressed={onSelect ? on : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-[20px] p-2 pr-3 text-left transition-[background-color,box-shadow] duration-200",
                on ? "bg-surface shadow-[0_8px_24px_-12px_rgb(33_38_34/0.25)]" : "bg-sunken/70 hover:bg-surface",
              )}
            >
              <Avatar src={p.avatar} name={p.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-muted">{p.role}</span>
                <span className="block truncate text-sm text-ink">{p.name}</span>
              </span>
              {typeof p.count === "number" ? (
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular", on ? "bg-charcoal text-white" : "bg-surface text-ink-2")}>{p.count}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ScheduleCard({
  title = "Next check-up",
  date,
  dayLabel,
  onPrev,
  onNext,
  people,
  selected,
  onSelect,
  action,
  className,
}: {
  title?: string;
  date: string;
  dayLabel: string;
  onPrev?: () => void;
  onNext?: () => void;
  people: { id: string; name: string; avatar?: string | null; note?: string }[];
  selected?: string;
  onSelect?: (id: string) => void;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-card bg-surface p-4", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
          <CalendarBlank size={18} />
        </span>
        <div>
          <p className="text-[11px] text-muted">{title}</p>
          <p className="text-sm text-ink">{date}</p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-full bg-sunken p-1">
        <button type="button" aria-label="Previous day" onClick={onPrev} className="flex size-8 items-center justify-center rounded-full hover:bg-surface">
          <ArrowLeft size={14} />
        </button>
        <span className="text-xs text-ink-2 tabular">{dayLabel}</span>
        <button type="button" aria-label="Next day" onClick={onNext} className="flex size-8 items-center justify-center rounded-full hover:bg-surface">
          <ArrowRight size={14} />
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {people.map((p) => {
          const on = p.id === selected;
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect?.(p.id)} aria-pressed={on} className={cn("flex w-full items-center gap-3 rounded-[16px] p-1.5 text-left transition-colors", on ? "bg-canvas" : "hover:bg-canvas")}>
                <Avatar src={p.avatar} name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-xs", on ? "text-ink" : "text-muted")}>{p.name}</span>
                  {p.note ? <span className="block truncate text-[11px] text-faint">{p.note}</span> : null}
                </span>
                {on ? <Check size={14} className="text-primary" aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {action ? (
        <Button variant="primary" className="justify-between rounded-[16px]" trailing={<ArrowRight />} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function SectionLabel({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="flex items-center gap-2 text-sm text-ink">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        {children}
      </h2>
      {actions}
    </div>
  );
}
