"use client";

import { cn } from "@/lib/cn";
import { Legend } from "@/components/charts/legend";
import { Tip } from "@/components/ui/tooltip";
import type { ActivityMonth } from "./anatomy";

const PRIMARY = "var(--color-primary)";
const OTHER = "var(--color-ops)";
const H = 72;
const grow = "w-2 shrink-0 transition-[height] duration-500 [transition-timing-function:var(--ease-spring)]";

/**
 * Events per month for one patient (dataviz "emphasis" form: the selected body system in cobalt
 * on the baseline, every other system stacked above it in grey). 8px bars, 4px rounded data-end,
 * 2px surface gap between segments, per-bar tooltip on hover and keyboard focus, legend when two
 * series are drawn, recessive baseline and a labelled scale line (busiest month, at least 4 — so
 * a single event doesn't read as a peak).
 */
export function ActivityBars({ months, systemName, multi, className }: { months: ActivityMonth[]; systemName: string; multi: boolean; className?: string }) {
  const peak = months.reduce((a, b) => (b.selected + b.other > a.selected + a.other ? b : a), months[0]);
  const max = Math.max(4, ...months.map((m) => m.selected + m.other));
  const px = (n: number) => Math.round((n / max) * H);

  return (
    <div className={className}>
      <div className="flex gap-2">
        {/* y-axis: the scale line's value and the zero baseline */}
        <div className="flex w-4 shrink-0 flex-col justify-between text-right text-[11px] leading-none text-muted tabular" style={{ height: H + 1 }} aria-hidden="true">
          <span className="-translate-y-1/2">{max}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative flex min-w-0 flex-1 items-end gap-1 shadow-[inset_0_-1px_0_var(--color-line-strong)]" style={{ height: H + 1 }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden="true" />
          {months.map((m) => {
            const total = m.selected + m.other;
            const label = total
              ? `${m.label}: ${total} ${total === 1 ? "event" : "events"}${multi ? ` — ${m.selected} ${systemName}, ${m.other} other systems` : ""}`
              : `${m.label}: no events`;
            return (
              <Tip key={m.key} label={label}>
                <span
                  tabIndex={0}
                  aria-label={label}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-[6px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {m.other > 0 ? <span className={cn(grow, "rounded-t-[4px]")} style={{ height: Math.max(2, px(m.other) - (m.selected > 0 ? 2 : 0)), background: OTHER }} /> : null}
                  {m.other > 0 && m.selected > 0 ? <span className="h-0.5 w-2 shrink-0" aria-hidden="true" /> : null}
                  {m.selected > 0 ? <span className={cn(grow, m.other > 0 ? "" : "rounded-t-[4px]")} style={{ height: Math.max(2, px(m.selected)), background: PRIMARY }} /> : null}
                </span>
              </Tip>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-1 pl-6" aria-hidden="true">
        {months.map((m, i) => (
          <span key={m.key} className={cn("min-w-0 flex-1 text-center text-[11px] tabular", i === months.length - 1 ? "text-ink" : "text-muted")}>
            {m.initial}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {multi ? (
          <Legend
            items={[
              { label: systemName, color: PRIMARY, shape: "rect" },
              { label: "Other body systems", color: OTHER, shape: "rect" },
            ]}
          />
        ) : (
          <span className="text-xs text-muted">{systemName} events</span>
        )}
        {peak && peak.selected + peak.other > 0 ? (
          <span className="text-xs text-muted">
            Busiest: {peak.label.split(" (")[0]} · <span className="tabular text-ink-2">{peak.selected + peak.other}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
