import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Status badges. Semantic colours are a separate axis from the cobalt accent.
 * Always pair colour with text (and a dot shape) so state never relies on colour alone.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "dark" | "draft";

const toneClass: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-sunken text-ink-2", dot: "bg-faint" },
  info: { wrap: "bg-primary-soft text-primary-ink", dot: "bg-primary" },
  success: { wrap: "bg-success-soft text-success", dot: "bg-success" },
  warning: { wrap: "bg-warning-soft text-warning", dot: "bg-warning" },
  danger: { wrap: "bg-danger-soft text-danger", dot: "bg-danger" },
  dark: { wrap: "bg-charcoal text-white", dot: "bg-white" },
  draft: { wrap: "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] [border-style:dashed]", dot: "border border-faint bg-transparent" },
};

export function StatusBadge({ tone = "neutral", children, className, dot = true, pulse }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; pulse?: boolean }) {
  const t = toneClass[tone];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", t.wrap, className)}>
      {dot ? (
        <span className="relative flex size-1.5">
          {pulse ? <span className={cn("absolute inset-0 rounded-full animate-pulse-ring", t.dot)} /> : null}
          <span className={cn("relative size-1.5 rounded-full", t.dot)} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** Tone lookup helpers for common domain states. */
export const appointmentTone = (s: string): Tone =>
  ({ booked: "neutral", arrived: "info", waiting: "warning", "in-session": "dark", checkout: "info", completed: "success", cancelled: "neutral", "no-show": "danger" } as Record<string, Tone>)[s] ?? "neutral";

export const recordTone = (s: string): Tone =>
  ({ draft: "draft", signed: "success", amended: "info", completed: "success", "awaiting-review": "warning", "self-reported": "neutral", scheduled: "info" } as Record<string, Tone>)[s] ?? "neutral";

export const priorityTone = (p: string): Tone => ({ low: "neutral", normal: "info", high: "warning", urgent: "danger" } as Record<string, Tone>)[p] ?? "neutral";

export const invoiceTone = (s: string): Tone =>
  ({ paid: "success", "partially-paid": "info", due: "warning", overdue: "danger", refunded: "neutral", failed: "danger" } as Record<string, Tone>)[s] ?? "neutral";
