"use client";

import { motion } from "motion/react";
import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";

/**
 * Horizontal year scrubber (refs 2 & 6): years along a track, month-density dots between them,
 * the selected range drawn as a charcoal pill. Drag the pill or its edges, click a year, or use
 * ←/→ (move) and Shift+←/→ (resize) when focused. Optional dark ± zoom buttons on the left.
 */
export function YearScrubber({
  years,
  density,
  value,
  onChange,
  onZoomIn,
  onZoomOut,
  className,
  label = "Timeline range",
}: {
  years: number[];
  /** events per month for each year (12 numbers) */
  density: Record<number, number[]>;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
  label?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "start" | "end"; x0: number; v0: [number, number] } | null>(null);
  const n = years.length;
  const first = years[0];
  const idx = (y: number) => y - first;
  const clampRange = useCallback(
    (a: number, b: number): [number, number] => {
      const lo = first, hi = years[n - 1];
      let s = Math.max(lo, Math.min(hi, a)), e = Math.max(lo, Math.min(hi, b));
      if (e < s) [s, e] = [e, s];
      return [s, e];
    },
    [first, n, years],
  );

  const yearFromX = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return first + Math.round(((clientX - r.left) / r.width) * n - 0.5);
  };

  const onDown = (mode: "move" | "start" | "end") => (e: PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, x0: e.clientX, v0: value };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current || !track.current) return;
    const r = track.current.getBoundingClientRect();
    const dy = Math.round(((e.clientX - drag.current.x0) / r.width) * n);
    const [s, en] = drag.current.v0;
    if (drag.current.mode === "move") {
      const span = en - s;
      const ns = Math.max(first, Math.min(years[n - 1] - span, s + dy));
      onChange([ns, ns + span]);
    } else if (drag.current.mode === "start") onChange(clampRange(s + dy, en));
    else onChange(clampRange(s, en + dy));
  };
  const onUp = () => (drag.current = null);

  const onKey = (e: KeyboardEvent) => {
    const [s, en] = value;
    if (e.key === "ArrowRight") { e.preventDefault(); onChange(e.shiftKey ? clampRange(s, en + 1) : en < years[n - 1] ? [s + 1, en + 1] : value); }
    if (e.key === "ArrowLeft") { e.preventDefault(); onChange(e.shiftKey ? clampRange(s, Math.max(s, en - 1)) : s > first ? [s - 1, en - 1] : value); }
  };

  const left = (idx(value[0]) / n) * 100;
  const width = ((idx(value[1]) - idx(value[0]) + 1) / n) * 100;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {onZoomIn || onZoomOut ? (
        <div className="flex shrink-0 gap-1.5">
          <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="flex size-10 items-center justify-center rounded-full bg-charcoal text-white transition-transform active:scale-95">
            <Plus size={16} />
          </button>
          <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="flex size-10 items-center justify-center rounded-full bg-charcoal text-white transition-transform active:scale-95">
            <Minus size={16} />
          </button>
        </div>
      ) : null}
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={first}
        aria-valuemax={years[n - 1]}
        aria-valuenow={value[0]}
        aria-valuetext={`${value[0]} to ${value[1]}`}
        onKeyDown={onKey}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={(e) => {
          if (drag.current) return;
          const y = yearFromX(e.clientX);
          const span = value[1] - value[0];
          const s = Math.max(first, Math.min(years[n - 1] - span, y));
          onChange([s, s + span]);
        }}
        className="relative h-12 min-w-0 flex-1 touch-none select-none rounded-full bg-surface outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <motion.div
          className="absolute inset-y-1 z-[1] cursor-grab rounded-full bg-charcoal active:cursor-grabbing"
          animate={{ left: `${left}%`, width: `${width}%` }}
          transition={snappy}
          onPointerDown={onDown("move")}
        >
          <span onPointerDown={onDown("start")} className="absolute inset-y-2 left-1.5 w-1 cursor-ew-resize rounded-full bg-white/50" aria-hidden="true" />
          <span onPointerDown={onDown("end")} className="absolute inset-y-2 right-1.5 w-1 cursor-ew-resize rounded-full bg-white/50" aria-hidden="true" />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 z-[2] flex">
          {years.map((y) => {
            const inRange = y >= value[0] && y <= value[1];
            const d = density[y] ?? [];
            return (
              <div key={y} className="flex flex-1 items-center justify-center gap-2 px-2">
                <span className={cn("text-[11px] tabular", inRange ? "text-white" : "text-muted")}>{y}</span>
                <span className="flex items-center gap-[3px]" aria-hidden="true">
                  {d.filter((_, i) => i % 2 === 0).map((c, i) => (
                    <span
                      key={i}
                      className={cn("rounded-full", inRange ? (c > 0 ? "bg-white" : "bg-white/30") : c > 0 ? "bg-primary" : "bg-line-strong")}
                      style={{ width: c > 2 ? 6 : c > 0 ? 5 : 3, height: c > 2 ? 6 : c > 0 ? 5 : 3 }}
                    />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Month strip (ref 2 bottom): month pills with clusters of event bubbles; the active month is white. */
export function MonthStrip({
  months,
  active,
  onSelect,
  className,
}: {
  months: { key: string; label: string; items: { id: string; icon: ReactNode; label: string }[] }[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <div data-lenis-prevent className={cn("scrollbar-none flex items-center gap-2 overflow-x-auto", className)} role="tablist" aria-label="Months">
      {months.map((m) => {
        const on = m.key === active;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(m.key)}
            className={cn("flex h-12 shrink-0 items-center gap-2 rounded-full pl-4 pr-2 transition-colors", on ? "bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-sunken/60 hover:bg-sunken")}
          >
            <span className={cn("text-xs", on ? "text-ink" : "text-muted")}>{m.label}</span>
            <span className="flex -space-x-2">
              {m.items.slice(0, 4).map((it) => (
                <span key={it.id} title={it.label} className={cn("flex size-8 items-center justify-center rounded-full ring-2 [&_svg]:size-4", on ? "bg-primary text-white ring-surface" : "bg-line-strong text-white ring-sunken")}>
                  {it.icon}
                </span>
              ))}
              {m.items.length === 0 ? <span className="size-2 rounded-full bg-line-strong" aria-hidden="true" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
