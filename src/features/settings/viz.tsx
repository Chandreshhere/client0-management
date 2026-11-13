"use client";

import { motion } from "motion/react";
import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Tip } from "@/components/ui/tooltip";

/**
 * Small visual pieces shared by the administration pages (billing, team, settings).
 *
 * FitBubbles — the kit's cobalt-card bubble chart (ref 6) with one fix: the kit packer fills 42%
 * of the box, which leaves no legal slot when there are only 3–4 similar-sized bubbles, so it
 * falls back to the centre and bubbles overlap. Here the fill steps down until every bubble has
 * a real slot. Area ∝ value; values are in the accessible name and on hover/focus.
 * (Upstream request: same loop in components/viz/bubble-chart.tsx, then delete this fork.)
 */
type Bubble = { id: string; label: string; value: number; display?: string; detail?: string };
type Placed = { it: Bubble & { r: number }; x: number; y: number };

function packOnce(items: Bubble[], W: number, H: number, fill: number, pad = 6): { placed: Placed[]; ok: boolean } {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const scale = Math.sqrt((W * H * fill) / (Math.PI * total));
  const sorted = [...items].sort((a, b) => b.value - a.value).map((it) => ({ ...it, r: Math.max(14, Math.sqrt(it.value) * scale) }));
  const placed: Placed[] = [];
  let ok = true;
  for (const it of sorted) {
    if (!placed.length) {
      placed.push({ it, x: W * 0.42, y: H / 2 });
      continue;
    }
    let best: { x: number; y: number; d: number } | null = null;
    for (let rad = 0; rad < Math.max(W, H); rad += 3) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
        const x = W * 0.45 + Math.cos(a) * rad;
        const y = H / 2 + Math.sin(a) * rad * 0.8;
        if (x - it.r < 4 || x + it.r > W - 4 || y - it.r < 4 || y + it.r > H - 4) continue;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.it.r + it.r + pad)) {
          const d = Math.hypot(x - W / 2, y - H / 2);
          if (!best || d < best.d) best = { x, y, d };
        }
      }
      if (best) break;
    }
    if (!best) ok = false;
    placed.push({ it, x: best?.x ?? W / 2, y: best?.y ?? H / 2 });
  }
  return { placed, ok };
}

function pack(items: Bubble[], W: number, H: number): Placed[] {
  let last: Placed[] = [];
  for (let fill = 0.42; fill > 0.12; fill -= 0.02) {
    const { placed, ok } = packOnce(items, W, H, fill);
    last = placed;
    if (ok) break;
  }
  // rounded so the server (Node) and browser trig produce identical markup
  return last.map((p) => ({ ...p, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, it: { ...p.it, r: Math.round(p.it.r * 10) / 10 } }));
}

export function FitBubbles({
  items,
  title,
  unit,
  className,
  height = 220,
  onSelect,
  selected,
}: {
  items: Bubble[];
  title: string;
  unit?: string;
  className?: string;
  height?: number;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const W = 320;
  const H = height;
  const placed = useMemo(() => pack(items, W, H), [items, H]);
  const top = placed[0]?.it.id;
  const describe = (it: Bubble) => `${it.label}: ${it.display ?? it.value}${unit ? ` ${unit}` : ""}${it.detail ? ` · ${it.detail}` : ""}`;
  return (
    <div className={cn("relative w-full", className)} role={onSelect ? "group" : "img"} aria-label={`${title}: ${items.map(describe).join(", ")}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
        {placed.map(({ it, x, y }, i) => {
          const big = it.id === top;
          const on = selected === it.id;
          const interactive = !!onSelect;
          const onKey = (e: KeyboardEvent) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onSelect?.(it.id);
            }
          };
          return (
            <Tip key={it.id} label={describe(it)}>
              <motion.g
                tabIndex={0}
                role={interactive ? "button" : undefined}
                aria-label={interactive ? describe(it) : undefined}
                aria-pressed={interactive ? on : undefined}
                onClick={interactive ? () => onSelect?.(it.id) : undefined}
                onKeyDown={onKey}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...pop, delay: i * 0.05 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
                className={cn("outline-none [&:focus-visible>circle]:stroke-white [&:focus-visible>circle]:stroke-2", interactive ? "cursor-pointer" : "cursor-default")}
              >
                <circle cx={x} cy={y} r={it.r} fill={big ? "#ffffff" : on ? "rgb(255 255 255 / 0.3)" : "rgb(255 255 255 / 0.16)"} stroke={on ? "#ffffff" : "rgb(255 255 255 / 0.28)"} strokeWidth={big ? 0 : on ? 2 : 1} />
                {it.r > 22 ? (
                  <>
                    <text x={x} y={y - (big ? 4 : 2)} textAnchor="middle" className={cn("font-light", big ? "fill-ink" : "fill-white")} style={{ fontSize: big ? Math.min(30, it.r * 0.5) : Math.min(18, it.r * 0.42) }}>
                      {it.display ?? it.value}
                    </text>
                    <text x={x} y={y + (big ? 16 : 12)} textAnchor="middle" className={big ? "fill-muted" : "fill-white/80"} style={{ fontSize: Math.min(11, Math.max(9, it.r * 0.2)) }}>
                      {it.label}
                    </text>
                  </>
                ) : (
                  <text x={x} y={y} dy="0.35em" textAnchor="middle" className="fill-white" style={{ fontSize: 10 }}>
                    {it.display ?? it.value}
                  </text>
                )}
              </motion.g>
            </Tip>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Day track (07:00–20:00 by default): a recessed rail, the working window in white, booked
 * blocks in charcoal, breaks hatched, and a hairline at "now". Used for staff hours and room
 * bookings. Pass a text summary as `label` — the track itself is decorative for screen readers.
 */
export type TrackBlock = { start: number; end: number; label: string; tone?: "booked" | "done" | "muted" };

export function DayTrack({
  from = 7 * 60,
  to = 20 * 60,
  window: win,
  blocks = [],
  breaks = [],
  now,
  label,
  className,
  height = "h-3",
}: {
  from?: number;
  to?: number;
  window?: { start: number; end: number } | null;
  blocks?: TrackBlock[];
  breaks?: { start: number; end: number }[];
  now?: number;
  label: string;
  className?: string;
  height?: string;
}) {
  const span = to - from;
  const pos = (m: number) => `${((Math.max(from, Math.min(to, m)) - from) / span) * 100}%`;
  const width = (a: number, b: number) => `${((Math.min(to, b) - Math.max(from, a)) / span) * 100}%`;
  return (
    <div role="img" aria-label={label} className={cn("relative w-full rounded-full bg-sunken", height, className)}>
      {win ? <span className="absolute inset-y-0 rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line-strong)]" style={{ left: pos(win.start), width: width(win.start, win.end) }} /> : null}
      {breaks.map((b, i) => (
        <span key={`b${i}`} className="bg-hatch absolute inset-y-0" style={{ left: pos(b.start), width: width(b.start, b.end) }} />
      ))}
      {blocks.map((b, i) => (
        <span
          key={`k${i}`}
          title={b.label}
          className={cn("absolute inset-y-px rounded-[3px]", b.tone === "done" ? "bg-ink-2/45" : b.tone === "muted" ? "bg-line-strong" : "bg-charcoal")}
          style={{ left: pos(b.start), width: `max(3px, ${width(b.start, b.end)})` }}
        />
      ))}
      {typeof now === "number" && now >= from && now <= to ? <span className="absolute -inset-y-1 w-px bg-ink" style={{ left: pos(now) }} aria-hidden="true" /> : null}
    </div>
  );
}

/** Hour labels under a DayTrack. */
export function DayTrackScale({ from = 7, to = 20, ticks = [7, 10, 13, 16, 19], className }: { from?: number; to?: number; ticks?: number[]; className?: string }) {
  return (
    <div className={cn("relative h-4 text-[11px] text-muted tabular", className)} aria-hidden="true">
      {ticks.map((h) => (
        <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - from) / (to - from)) * 100}%` }}>
          {String(h).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}

/** One labelled horizontal meter row (ranked bars, one hue). */
export function MeterRow({ label, value, max, display, sub, tone = "ink", className }: { label: ReactNode; value: number; max: number; display: ReactNode; sub?: ReactNode; tone?: "ink" | "warning" | "danger" | "muted"; className?: string }) {
  const fill = { ink: "bg-charcoal", warning: "bg-warning", danger: "bg-danger", muted: "bg-faint" }[tone];
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5", className)}>
      <span className="min-w-0 truncate text-sm text-ink-2">{label}</span>
      <span className="text-right text-sm text-ink tabular">{display}</span>
      <span className="col-span-2 flex h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        <span className={cn("h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]", fill)} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </span>
      {sub ? <span className="col-span-2 -mt-0.5 text-xs text-muted">{sub}</span> : null}
    </div>
  );
}
