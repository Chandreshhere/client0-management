"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { compact, linear, niceTicks } from "./geometry";
import { Legend } from "./legend";

/**
 * Column chart (optionally stacked). Bars ≤24px, 4px rounded data-end, square at the
 * baseline, 2px surface gap between stacked segments, per-bar hover/focus tooltip,
 * legend for ≥2 series, recessive hairline grid.
 */
export type BarSeries = { id: string; name: string; color: string };

export function BarChart({
  categories,
  series,
  values,
  height = 220,
  ariaLabel,
  formatY = compact,
  className,
  highlight,
}: {
  categories: string[];
  series: BarSeries[];
  /** values[seriesIndex][categoryIndex] */
  values: number[][];
  height?: number;
  ariaLabel: string;
  formatY?: (v: number) => string;
  className?: string;
  /** index of a category to emphasise (e.g. "now") */
  highlight?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = categories.map((_, ci) => values.reduce((sum, row) => sum + (row[ci] ?? 0), 0));
  const ticks = niceTicks(0, Math.max(1, ...totals), 4);
  const yMax = ticks[ticks.length - 1];
  const m = { t: 12, r: 8, b: 28, l: 36 };
  const iw = Math.max(0, width - m.l - m.r), ih = height - m.t - m.b;
  const band = iw / categories.length;
  const bw = Math.min(24, band * 0.56);
  const sy = linear(0, yMax, m.t + ih, m.t);

  return (
    <div className={cn("w-full", className)}>
      {series.length >= 2 ? <Legend className="mb-3" items={series.map((s) => ({ label: s.name, color: s.color, shape: "rect" as const }))} /> : null}
      <div ref={wrap} className="relative" style={{ height }} role="img" aria-label={ariaLabel}>
        {width > 0 ? (
          <svg width={width} height={height} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t} aria-hidden="true">
                <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">{formatY(t)}</text>
              </g>
            ))}
            {categories.map((c, ci) => {
              const cx = m.l + band * ci + band / 2;
              let acc = 0;
              const segs = series.map((s, si) => {
                const v = values[si]?.[ci] ?? 0;
                const y0 = sy(acc), y1 = sy(acc + v);
                acc += v;
                return { s, v, y0, y1 };
              }).filter((g) => g.v > 0);
              const dim = active !== null && active !== ci;
              return (
                <g
                  key={c}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c}: ${segs.map((g) => `${g.s.name} ${formatY(g.v)}`).join(", ") || "none"}`}
                  onPointerEnter={() => setActive(ci)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(ci)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                  style={{ opacity: dim ? 0.55 : 1, transition: "opacity 160ms" }}
                >
                  <rect x={m.l + band * ci} y={m.t} width={band} height={ih} fill="transparent" />
                  {segs.map((g, gi) => {
                    const top = gi === segs.length - 1;
                    const h = Math.max(0, g.y0 - g.y1 - (gi > 0 ? 2 : 0));
                    const y = g.y1;
                    const r = top ? Math.min(4, h) : 0;
                    // rounded data-end only (top), square at the baseline/gap
                    const d = `M${cx - bw / 2},${y + h} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${y + h} Z`;
                    return <path key={g.s.id} d={d} fill={g.s.color} />;
                  })}
                  <text x={cx} y={height - 8} textAnchor="middle" className={cn("text-[11px]", highlight === ci ? "fill-ink font-medium" : "fill-muted")} aria-hidden="true">
                    {c}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
        {active !== null && width > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[132px] rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop"
            style={{ left: Math.min(m.l + band * active + band / 2 + 12, width - 150), top: 0 }}
          >
            <div className="mb-1 text-white/60">{categories[active]}</div>
            {series.map((s, si) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
                <span className="font-medium tabular">{formatY(values[si]?.[active] ?? 0)}</span>
                <span className="text-white/60">{s.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Thin segmented bar: one whole split into parts (8px, rounded, legend lists names in order). */
export function SegmentedBar({ parts, className, label }: { parts: { label: string; value: number; color: string }[]; className?: string; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <Legend className="mt-3" items={parts.map((p) => ({ label: `${p.label} · ${p.value}`, color: p.color, shape: "rect" as const }))} />
    </div>
  );
}

/** Tiny trend sparkline for stat tiles (de-emphasised line, accent end dot). */
export function Sparkline({ values, className, tone = "primary" }: { values: number[]; className?: string; tone?: "primary" | "white" | "muted" }) {
  const W = 120, H = 32;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 6) + 3, H - 4 - ((v - min) / (max - min || 1)) * (H - 8)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const stroke = tone === "white" ? "rgb(255 255 255 / 0.6)" : "var(--color-faint)";
  const dot = tone === "white" ? "#fff" : tone === "muted" ? "var(--color-ink-2)" : "var(--color-primary)";
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-8 w-[120px]", className)} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={dot} stroke={tone === "white" ? "transparent" : "var(--color-surface)"} strokeWidth={2} />
    </svg>
  );
}
