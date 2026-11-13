"use client";

import type { ComponentProps, ReactNode } from "react";
import { Check, Minus, Plus } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import type { Errors, OnboardingData } from "./model";

/** Props every wizard step receives. `errors` is empty until the person tries to continue. */
export interface StepProps {
  data: OnboardingData;
  update: (fn: (d: OnboardingData) => OnboardingData) => void;
  errors: Errors;
  goTo: (step: number, opts?: { fromReview?: boolean }) => void;
}

/** − value + counter. The value is an <output> so it can carry the Field label. */
export function Stepper({
  id,
  value,
  min,
  max,
  onChange,
  noun,
  testId,
  invalid,
  describedBy,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  noun: string;
  testId: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex items-center gap-2" data-error-anchor={invalid ? "true" : undefined}>
      <IconButton label={`Fewer ${noun}`} variant="soft" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} data-testid={`${testId}-dec`}>
        <Minus />
      </IconButton>
      <output
        id={id}
        aria-live="polite"
        aria-describedby={describedBy}
        className={cn("min-w-14 text-center text-[26px] font-light leading-none tracking-[-0.01em] tabular", invalid ? "text-danger" : "text-ink")}
      >
        {value}
      </output>
      <IconButton label={`More ${noun}`} variant="soft" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} data-testid={`${testId}-inc`}>
        <Plus />
      </IconButton>
    </div>
  );
}

/**
 * Multi-select chip: outline at rest (the reference's outline chips), charcoal when on.
 * `aria-pressed` carries the state; the check mark repeats it without relying on colour.
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  dot,
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & { pressed: boolean; onPressedChange: (next: boolean) => void; dot?: string; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex select-none items-center gap-2 whitespace-nowrap rounded-full transition-[background-color,color,box-shadow,transform] duration-200 [transition-timing-function:var(--ease-out-quart)] active:scale-[0.97]",
        size === "sm" ? "h-8 px-3 text-xs [&_svg]:size-3.5" : "h-10 px-4 text-sm [&_svg]:size-4",
        pressed ? "bg-charcoal text-white" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--color-faint)]",
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} /> : null}
      {children}
      {pressed ? <Check weight="bold" aria-hidden="true" /> : null}
    </button>
  );
}

/** Inline error under a row or group (the kit's Field shows its own). */
export function InlineError({ id, children, className }: { id?: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p id={id} className={cn("text-xs text-danger", className)}>
      {children}
    </p>
  );
}

/** Small key/value list used on the review step. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-muted">{r.label}</dt>
          <dd className="min-w-0 text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
