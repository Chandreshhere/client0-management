"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { TODAY_KEY } from "./data";
import { dayLabel, hhmm, shortDay } from "./engine";

/**
 * Week navigator in the style of the year scrubber (refs 2 & 6): the six clinic days on a white
 * track, each with its booking count and one dot per clinic hour sized by how many bookings start
 * in that hour. The charcoal pill marks what the diary shows — one day, or the whole week. Every
 * count and dot comes from the diary with the current filters applied.
 */
export function WeekStrip({
  days,
  selected,
  view,
  counts,
  density,
  firstHour,
  onPick,
  className,
}: {
  days: string[];
  selected: string;
  view: "day" | "week";
  /** active bookings per day */
  counts: Record<string, number>;
  /** bookings starting per hour, from `firstHour` */
  density: Record<string, number[]>;
  firstHour: number;
  onPick: (date: string) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, days.indexOf(selected));
  const pill = view === "week" ? { left: "0%", width: "100%" } : { left: `${(index / days.length) * 100}%`, width: `${100 / days.length}%` };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = Math.min(days.length - 1, i + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = days.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onPick(days[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn("rounded-[28px] bg-surface p-1 md:rounded-full", className)}>
      <div role="radiogroup" aria-label={view === "week" ? "Open a day of this week" : "Day"} className="relative grid grid-cols-6">
        <motion.span aria-hidden="true" className="absolute inset-y-0 rounded-[24px] bg-charcoal md:rounded-full" initial={false} animate={pill} transition={snappy} />
        {days.map((d, i) => {
          const on = view === "day" && d === selected;
          const inPill = view === "week" || on;
          const n = counts[d] ?? 0;
          const dots = density[d] ?? [];
          const busiest = dots.reduce((best, c, h) => (c > (dots[best] ?? 0) ? h : best), 0);
          const today = d === TODAY_KEY;
          return (
            <button
              key={d}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={view === "week" ? (i === 0 ? 0 : -1) : on ? 0 : -1}
              aria-label={`${shortDay(d)}${today ? ", today" : ""}: ${n} ${n === 1 ? "booking" : "bookings"}${n ? `, busiest hour ${hhmm((firstHour + busiest) * 60)}` : ""}${view === "week" ? ". Opens the day view" : ""}`}
              onClick={() => onPick(d)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative z-[1] flex min-w-0 flex-col items-center gap-1 rounded-[24px] px-1 py-2 outline-none transition-colors duration-200",
                "md:h-14 md:items-start md:justify-center md:gap-1.5 md:rounded-full md:px-4 md:py-0",
                "focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]",
                !inPill && "hover:bg-sunken/60",
              )}
            >
              {/* phones: weekday / date / count stacked */}
              <span className="flex flex-col items-center md:hidden">
                <span className={cn("text-[11px] leading-4", inPill ? "text-white/70" : "text-muted")}>{dayLabel(d, { weekday: "short" })}</span>
                <span className={cn("text-base font-light leading-5 tabular", inPill ? "text-white" : "text-ink")}>{dayLabel(d, { day: "numeric" })}</span>
                <span className={cn("text-[11px] leading-4 tabular", inPill ? "text-white" : today ? "text-ink" : "text-muted")}>{today ? "Today" : n}</span>
              </span>
              {/* wider screens: "Fri 13 · 15 booked" on one line */}
              <span className="hidden min-w-0 max-w-full items-baseline gap-2 md:flex">
                <span className={cn("flex shrink-0 items-center gap-1.5 text-[13px] leading-5", inPill ? "text-white" : "text-ink")}>
                  {today ? <span className={cn("size-1.5 rounded-full", inPill ? "bg-white" : "bg-ink")} aria-hidden="true" /> : null}
                  {dayLabel(d, { weekday: "short" })} {dayLabel(d, { day: "numeric" })}
                </span>
                <span className={cn("truncate text-[11px] leading-4 tabular", inPill ? "text-white/70" : "text-muted")}>{n} booked</span>
              </span>
              {/* phones: a tiny column per hour (height = bookings); wider screens: dots sized by bookings */}
              <span className="flex h-2 items-end gap-px md:w-full md:items-center md:justify-between md:gap-0" aria-hidden="true">
                {dots.map((c, h) => (
                  <span
                    key={h}
                    className={cn(
                      "h-[var(--bar)] w-[3px] shrink-0 rounded-full md:h-[var(--dot)] md:w-[var(--dot)]",
                      inPill ? (c > 0 ? "bg-white" : "bg-white/25") : c > 0 ? "bg-ink-2" : "bg-line-strong",
                    )}
                    style={{ "--bar": `${barSize(c)}px`, "--dot": `${dotSize(c)}px` } as CSSProperties}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Dots (spread across the day, earliest hour on the left): 0 bookings → 3px, 1 → 4px, 2 → 5px, 3+ → 6px. Bars (phones): 2 / 4 / 6 / 8px tall. */
const dotSize = (c: number) => (c >= 3 ? 6 : c === 2 ? 5 : c === 1 ? 4 : 3);
const barSize = (c: number) => (c >= 3 ? 8 : c === 2 ? 6 : c === 1 ? 4 : 2);
