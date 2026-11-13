"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/**
 * Small portal-only figures. Each one encodes a single value against a target that comes from
 * the record, and carries an aria-label that says the same thing in words.
 */

/**
 * One reading on a scale with its target zone hatched (used where there is a single released
 * value, so a trend line would mean nothing). `good` says which side of the threshold is on target.
 */
export function RangeGauge({
  min,
  max,
  value,
  threshold,
  good,
  label,
  format = (v) => String(v),
  className,
}: {
  min: number;
  max: number;
  value: number;
  threshold: number;
  good: "above" | "below";
  label: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
  const t = pct(threshold);
  const zone = good === "above" ? { left: `${t}%`, right: "0%" } : { left: "0%", right: `${100 - t}%` };
  return (
    <div role="img" aria-label={label} className={cn("relative h-full min-h-12 w-full", className)}>
      <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-sunken" aria-hidden="true" />
      <span className="bg-hatch absolute top-1/2 h-2 -translate-y-1/2 rounded-full" style={zone} aria-hidden="true" />
      <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink-2" style={{ left: `${t}%` }} aria-hidden="true" />
      <span className="absolute top-0 -translate-x-1/2 text-[11px] leading-none text-muted tabular" style={{ left: `${t}%` }} aria-hidden="true">
        {format(threshold)}
      </span>
      <motion.span
        aria-hidden="true"
        className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_2px_var(--color-surface)]"
        initial={{ left: `${t}%`, x: "-50%" }}
        animate={{ left: `${pct(value)}%`, x: "-50%" }}
        transition={spring}
      />
      <span className="absolute bottom-0 left-0 text-[11px] leading-none text-faint tabular" aria-hidden="true">
        {format(min)}
      </span>
      <span className="absolute bottom-0 right-0 text-[11px] leading-none text-faint tabular" aria-hidden="true">
        {format(max)}
      </span>
    </div>
  );
}

/** Status dot + words (status is never colour alone). */
export function StatusLine({ tone, children, className }: { tone: "good" | "watch" | "neutral"; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", tone === "good" ? "bg-success" : tone === "watch" ? "bg-warning" : "bg-faint")}
      />
      {children}
    </span>
  );
}

/**
 * Chart well with the first and last reading dates under the spark, so a trend line always says
 * which period it covers (sparks space readings evenly; the caption gives the count).
 */
export function DatedWell({ from, to, children }: { from: string; to: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <div className="mt-1 flex justify-between text-[11px] leading-none text-muted tabular" aria-hidden="true">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}
