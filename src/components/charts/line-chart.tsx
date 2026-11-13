"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { linear, monotonePath, niceTicks } from "./geometry";
import { Legend } from "./legend";

/**
 * Responsive line chart following the dataviz spec: 2px lines, ≥8px end dots with a 2px
 * surface ring, hairline solid grid, one y-axis, crosshair + one tooltip listing every series,
 * keyboard (←/→) parity, legend for ≥2 series. `hollow` points mark self-reported values
 * (secondary encoding, explained in the legend note).
 */
export type LineSeries = {
  id: string;
  name: string;
  color: string; // CSS colour (use tokens: var(--color-primary) …)
  points: { x: string; y: number; hollow?: boolean }[]; // x = ISO date
};

export function LineChart({
  series,
  height = 220,
  band,
  formatY = (v) => String(v),
  formatX = (iso) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)),
  ariaLabel,
  hollowNote,
  className,
  yPadding = 0.12,
}: {
  series: LineSeries[];
  height?: number;
  band?: { from: number; to: number; label: string };
  formatY?: (v: number) => string;
  formatX?: (iso: string) => string;
  ariaLabel: string;
  hollowNote?: string;
  className?: string;
  yPadding?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xs = useMemo(() => Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort(), [series]);
  const times = xs.map((x) => new Date(x).getTime());

  const allY = series.flatMap((s) => s.points.map((p) => p.y)).concat(band ? [band.from, band.to] : []);
  const yMin0 = Math.min(...allY), yMax0 = Math.max(...allY);
  const pad = (yMax0 - yMin0 || 1) * yPadding;
  const ticks = niceTicks(yMin0 - pad, yMax0 + pad, 4);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];

  const m = { t: 12, r: 16, b: 28, l: 44 };
  const iw = Math.max(0, width - m.l - m.r), ih = height - m.t - m.b;
  const sx = linear(times[0], times[times.length - 1], m.l, m.l + iw);
  const sy = linear(yMin, yMax, m.t + ih, m.t);

  const onMove = useCallback(
    (e: PointerEvent<SVGRectElement>) => {
      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
      const px = e.clientX - rect.left;
      let best = 0, bd = Infinity;
      times.forEach((t, i) => {
        const d = Math.abs(sx(t) - px);
        if (d < bd) { bd = d; best = i; }
      });
      setActive(best);
    },
    [times, sx],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setActive((a) => Math.min(xs.length - 1, (a ?? -1) + 1)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); setActive((a) => Math.max(0, (a ?? xs.length) - 1)); }
    if (e.key === "Escape") setActive(null);
  };

  const ax = active !== null ? xs[active] : null;
  const tipLeft = ax ? sx(new Date(ax).getTime()) : 0;
  // X ticks spaced by time: keep a tick only if it is ≥ 64px from the previous one (last always kept)
  const xTickIdx: number[] = [];
  times.forEach((t, i) => {
    const px = sx(t);
    const prev = xTickIdx.length ? sx(times[xTickIdx[xTickIdx.length - 1]]) : -Infinity;
    if (i === times.length - 1) {
      while (xTickIdx.length && px - sx(times[xTickIdx[xTickIdx.length - 1]]) < 64) xTickIdx.pop();
      xTickIdx.push(i);
    } else if (px - prev >= 64) xTickIdx.push(i);
  });

  return (
    <div className={cn("w-full", className)}>
      {series.length >= 2 || hollowNote ? (
        <Legend className="mb-3" items={series.length >= 2 ? series.map((s) => ({ label: s.name, color: s.color, shape: "line" as const })) : []} note={hollowNote} />
      ) : null}
      <div
        ref={wrap}
        className="relative outline-none focus-visible:rounded-inner focus-visible:outline-2 focus-visible:outline-primary"
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {width > 0 ? (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
            <defs>
              <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-ink)" strokeOpacity="0.1" strokeWidth="1" />
              </pattern>
            </defs>
            {band ? (
              <rect x={m.l} width={iw} y={sy(Math.min(band.to, yMax))} height={Math.max(0, sy(Math.max(band.from, yMin)) - sy(Math.min(band.to, yMax)))} fill={`url(#${uid}-hatch)`} rx={6} />
            ) : null}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">{formatY(t)}</text>
              </g>
            ))}
            {xTickIdx.map((i) => (
              <text key={xs[i]} x={sx(times[i])} y={height - 8} textAnchor={i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                {formatX(xs[i])}
              </text>
            ))}
            {series.map((s) => {
              const pts = s.points.map((p) => ({ x: sx(new Date(p.x).getTime()), y: sy(p.y) }));
              return <path key={s.id} d={monotonePath(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
            })}
            {series.map((s) =>
              s.points.map((p, i) => {
                const isEnd = i === s.points.length - 1;
                const isActive = ax === p.x;
                if (!isEnd && !isActive && !p.hollow) return null;
                return (
                  <circle
                    key={`${s.id}-${p.x}`}
                    cx={sx(new Date(p.x).getTime())}
                    cy={sy(p.y)}
                    r={isActive ? 5 : 4}
                    fill={p.hollow ? "var(--color-surface)" : s.color}
                    stroke={p.hollow ? s.color : "var(--color-surface)"}
                    strokeWidth={2}
                  />
                );
              }),
            )}
            {ax ? <line x1={tipLeft} x2={tipLeft} y1={m.t} y2={m.t + ih} stroke="var(--color-ink)" strokeOpacity={0.25} strokeWidth={1} /> : null}
            <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        ) : null}
        {ax ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[140px] rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop"
            style={{ left: Math.min(Math.max(tipLeft + 12, 0), Math.max(0, width - 170)) }}
          >
            <div className="mb-1 text-white/60">{formatX(ax)}</div>
            {series.map((s) => {
              const p = s.points.find((q) => q.x === ax);
              if (!p) return null;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="font-medium tabular">{formatY(p.y)}</span>
                  <span className="text-white/60">{s.name}{p.hollow ? " · self-reported" : ""}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
