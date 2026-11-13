"use client";

import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

/**
 * Items per month (last 12 months, plus everything earlier in one bucket) — documents by report
 * date, signed notes by date. Bars start at zero; each is a button that filters the list to that
 * month, with the count on hover/focus.
 * Text stays in text tokens; the selected month is the charcoal bar.
 */
export type MonthBucket = { key: string; label: string; long: string; count: number; awaiting: number; /** one-letter form for narrow containers */ short?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Buckets ending at `endMonth` (YYYY-MM): "earlier" first, then 12 calendar months. */
export function monthBuckets(dates: { reportDate: string; awaiting: boolean }[], endMonth = "2026-11"): MonthBucket[] {
  const [ey, em] = endMonth.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const t = ey * 12 + (em - 1) - (11 - i);
    const y = Math.floor(t / 12), m = t % 12;
    return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label: MONTHS[m], short: MONTHS[m][0], long: `${LONG[m]} ${y}` };
  });
  const first = months[0].key;
  const earlier = dates.filter((d) => d.reportDate.slice(0, 7) < first);
  return [
    { key: "earlier", label: "Earlier", short: "Old", long: `Before ${months[0].long}`, count: earlier.length, awaiting: earlier.filter((d) => d.awaiting).length },
    ...months.map((m) => {
      const inMonth = dates.filter((d) => d.reportDate.startsWith(m.key));
      return { ...m, count: inMonth.length, awaiting: inMonth.filter((d) => d.awaiting).length };
    }),
  ];
}

export function MonthBars({
  buckets,
  value,
  onChange,
  noun = ["document", "documents"],
  label = "Documents by report month — select a month to filter",
  className,
}: {
  buckets: MonthBucket[];
  value: string | null;
  onChange: (key: string | null) => void;
  /** what one bar counts, singular and plural */
  noun?: [string, string];
  label?: string;
  className?: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const n = (c: number) => `${c} ${c === 1 ? noun[0] : noun[1]}`;
  return (
    // container query: three-letter months need ~21px per bar; below that, one letter
    <div role="group" aria-label={label} className={cn("@container flex h-24 items-end gap-1.5", className)}>
      {buckets.map((b, i) => {
        const on = value === b.key;
        const empty = b.count === 0;
        return (
          <Tip key={b.key} label={`${b.long} · ${n(b.count)}${b.awaiting ? ` · ${b.awaiting} awaiting review` : ""}`}>
            <button
              type="button"
              disabled={empty}
              aria-pressed={on}
              aria-label={`${b.long}: ${n(b.count)}${b.awaiting ? `, ${b.awaiting} awaiting review` : ""}`}
              onClick={() => onChange(on ? null : b.key)}
              className={cn("group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-[8px] px-0.5 pt-1 transition-colors disabled:cursor-default", !empty && "hover:bg-canvas", i === 0 && "flex-[1.4]")}
            >
              <span className="flex w-full max-w-[24px] flex-1 items-end pt-3">
                <span
                  className={cn("relative w-full rounded-t-[4px] transition-[height,background-color] duration-300 [transition-timing-function:var(--ease-spring)]", on ? "bg-charcoal" : empty ? "bg-sunken" : "bg-ink-2/30 group-hover:bg-ink-2/50")}
                  style={{ height: empty ? 2 : `${Math.max(10, (b.count / max) * 100)}%` }}
                >
                  {b.awaiting ? <span className="absolute -top-2.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-warning" aria-hidden="true" /> : null}
                </span>
              </span>
              <span className={cn("max-w-full truncate text-[11px] leading-none tabular", on ? "text-ink" : "text-muted")} aria-hidden="true">
                <span className="@[400px]:hidden">{b.short ?? b.label}</span>
                <span className="hidden @[400px]:inline">{b.label}</span>
              </span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
