"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { niceTicks } from "@/components/charts/geometry";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Kit LineChart + the annotations it doesn't draw yet:
 *  - open-ended reference bands ("< 70", "> 40") as the kit's hatch,
 *  - dashed threshold lines whose labels are placed where they clear the data.
 * Bands and thresholds sit *under* the chart (negative z-index in an isolated wrapper), so the
 * lines, dots, tooltip, keyboard behaviour and time-spaced axis stay the kit's own.
 *
 * Mirrors the kit's plot margins and y-domain (niceTicks over data + band, same padding).
 * Shared change requested: `thresholds` and open-ended `band` on LineChart, after which this
 * wrapper reduces to a pass-through.
 */
const MARGIN = { t: 12, r: 16, b: 28, l: 44 };
const LABEL_H = 16;

export type TrendRange = { low?: number; high?: number; label: string };
export type TrendThreshold = { value: number; label: string };

/**
 * Ticks sit on the measurement dates themselves, and the kit reuses this formatter for the
 * tooltip header — so it keeps the day: "6 Aug" within one calendar year, "6 Aug ’25" across
 * years (fits the kit's 64px tick spacing). Same en-IN month names as every other date in the app.
 */
const tickFormatter = (multiYear: boolean) => (iso: string) =>
  `${formatDate(iso, { day: "numeric", month: "short" })}${multiYear ? ` ’${iso.slice(2, 4)}` : ""}`;
/** Fallback when day-level labels would collide on a narrow plot: "Aug ’25" (tooltip loses the day; the table view keeps it). */
const compactFormatter = (iso: string) => `${formatDate(iso, { month: "short" })} ’${iso.slice(2, 4)}`;
const tickTextWidth = (s: string) => s.length * 5.8;

/**
 * Would the kit's x labels overlap? Replays its thinning (a tick only ≥ 64px after the previous,
 * last always kept) and its anchors (first start, last end, others middle).
 */
function ticksCollide(xs: string[], xOf: (t: number) => number, fmt: (iso: string) => string) {
  const px = xs.map((x) => xOf(new Date(x).getTime()));
  const idx: number[] = [];
  px.forEach((p, i) => {
    if (i === px.length - 1) {
      while (idx.length && p - px[idx[idx.length - 1]] < 64) idx.pop();
      idx.push(i);
    } else if (!idx.length || p - px[idx[idx.length - 1]] >= 64) idx.push(i);
  });
  const span = (k: number) => {
    const i = idx[k], w = tickTextWidth(fmt(xs[i]));
    return k === 0 ? [px[i], px[i] + w] : k === idx.length - 1 ? [px[i] - w, px[i]] : [px[i] - w / 2, px[i] + w / 2];
  };
  for (let k = 1; k < idx.length; k++) if (span(k)[0] - span(k - 1)[1] < 6) return true;
  return false;
}
const textWidth = (s: string) => s.length * 5.7 + 14;
/** Series up to this many points get a marker on every reading (sparser data = each date matters). */
const MARKER_MAX = 16;

type Box = { x0: number; x1: number; y0: number; y1: number };
type Pt = { x: number; y: number };

export function TrendChart({
  series,
  height = 220,
  range,
  thresholds = [],
  ariaLabel,
  formatY,
  hollowNote,
  yPadding = 0.12,
  className,
}: {
  series: LineSeries[];
  height?: number;
  range?: TrendRange;
  thresholds?: TrendThreshold[];
  ariaLabel: string;
  formatY?: (v: number) => string;
  hollowNote?: string;
  /** fraction of the data span added above and below (0 for bounded measures like SpO₂) */
  yPadding?: number;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ top: number; width: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const plot = el.querySelector<HTMLElement>('[role="img"]');
      if (!plot) return;
      const next = { top: plot.offsetTop, width: plot.clientWidth };
      setGeo((g) => (g && g.top === next.top && g.width === next.width ? g : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- y domain, exactly as the kit computes it
  const hasLow = range?.low !== undefined;
  const hasHigh = range?.high !== undefined;
  const twoSided = hasLow && hasHigh;
  // Two-sided ranges are drawn by the kit. A one-sided limit goes in as a zero-height band so it
  // still counts toward the y-domain; its open-ended hatch is drawn here.
  const limit = range?.low ?? range?.high;
  const kitBand = range && limit !== undefined ? (twoSided ? { from: range.low!, to: range.high!, label: range.label } : { from: limit, to: limit, label: range.label }) : undefined;

  const ys = series.flatMap((s) => s.points.map((p) => p.y)).concat(kitBand ? [kitBand.from, kitBand.to] : []);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0 || 1) * yPadding;
  const ticks = niceTicks(y0 - pad, y1 + pad, 4);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const ih = height - MARGIN.t - MARGIN.b;
  const yOf = (v: number) => MARGIN.t + ((yMax - v) / (yMax - yMin || 1)) * ih;
  const inDomain = (v: number) => v >= yMin && v <= yMax;

  // ---- x scale, exactly as the kit computes it
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort();
  const times = xs.map((x) => new Date(x).getTime());
  const iw = Math.max(0, (geo?.width ?? 0) - MARGIN.l - MARGIN.r);
  const xOf = (t: number) => MARGIN.l + ((t - times[0]) / (times[times.length - 1] - times[0] || 1)) * iw;

  let openBand: { top: number; height: number } | null = null;
  if (range && !twoSided && limit !== undefined && inDomain(limit)) {
    openBand = hasHigh ? { top: yOf(limit), height: MARGIN.t + ih - yOf(limit) } : { top: MARGIN.t, height: yOf(limit) - MARGIN.t };
  }

  const placed = geo ? placeLabels(thresholds.filter((t) => inDomain(t.value)), series, { xOf, yOf, iw, ih }) : [];
  const multiYear = new Set(xs.map((x) => x.slice(0, 4))).size > 1;
  const dayFormat = tickFormatter(multiYear);
  const formatX = geo && multiYear && ticksCollide(xs, xOf, dayFormat) ? compactFormatter : dayFormat;

  return (
    <div ref={wrap} className={cn("relative isolate", className)}>
      {geo ? (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -z-10" style={{ top: geo.top, height }}>
            {openBand ? <div className="absolute rounded-[6px] bg-hatch" style={{ left: MARGIN.l, right: MARGIN.r, top: openBand.top, height: openBand.height }} /> : null}
            {placed.map(({ t, box }) => (
              <div key={`${t.value}-${t.label}`}>
                <div className="absolute border-t border-dashed border-ink-2/45" style={{ left: MARGIN.l, right: MARGIN.r, top: yOf(t.value) }} />
                {box ? (
                  <span className="absolute whitespace-nowrap rounded-md bg-surface/90 px-1.5 text-[11px] leading-4 text-ink-2" style={{ left: box.x0, top: box.y0 }}>
                    {t.label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <LineChart series={series} height={height} band={kitBand} formatY={formatY} formatX={formatX} ariaLabel={ariaLabel} hollowNote={hollowNote} yPadding={yPadding} />
      {geo ? (
        // One marker per reading on sparse series (the kit marks only the end and self-reported
        // points); under the kit's tooltip (z-10), never intercepting the pointer.
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[1]" style={{ top: geo.top, height }}>
          {series.map((s) =>
            s.points.length > MARKER_MAX
              ? null
              : s.points.slice(0, -1).map((p) =>
                  p.hollow ? null : (
                    <span
                      key={`${s.id}-${p.x}`}
                      className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                      style={{ left: xOf(new Date(p.x).getTime()), top: yOf(p.y), background: s.color }}
                    />
                  ),
                ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Linear interpolation of a polyline at x (null outside its extent). */
function yAt(pts: Pt[], x: number): number | null {
  if (!pts.length || x < pts[0].x || x > pts[pts.length - 1].x) return null;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1], b = pts[i];
      return a.y + ((x - a.x) / (b.x - a.x || 1)) * (b.y - a.y);
    }
  }
  return pts[pts.length - 1].y;
}

/** Vertical clearance (px) between a label box and every series line / other label. */
function clearance(box: Box, lines: Pt[][], others: Box[]): number {
  let best = Infinity;
  const gap = (y: number) => (y < box.y0 ? box.y0 - y : y > box.y1 ? y - box.y1 : 0);
  for (const pts of lines) {
    for (let i = 0; i <= 10; i++) {
      const y = yAt(pts, box.x0 + ((box.x1 - box.x0) * i) / 10);
      if (y !== null) best = Math.min(best, gap(y));
    }
    for (const p of pts) if (p.x >= box.x0 - 6 && p.x <= box.x1 + 6) best = Math.min(best, Math.max(0, gap(p.y) - 6));
  }
  for (const o of others) {
    const overlapX = box.x0 < o.x1 && box.x1 > o.x0;
    if (overlapX) best = Math.min(best, box.y1 <= o.y0 ? o.y0 - box.y1 : box.y0 >= o.y1 ? box.y0 - o.y1 : 0);
  }
  return best;
}

/** Choose above/below × left/right for each threshold label, preferring the first that clears. */
function placeLabels(
  thresholds: TrendThreshold[],
  series: LineSeries[],
  s: { xOf: (t: number) => number; yOf: (v: number) => number; iw: number; ih: number },
) {
  const lines = series.map((ser) => ser.points.map((p) => ({ x: s.xOf(new Date(p.x).getTime()), y: s.yOf(p.y) })));
  const out: { t: TrendThreshold; box: Box | null }[] = [];
  for (const t of thresholds) {
    const ty = s.yOf(t.value);
    const w = textWidth(t.label);
    const left = MARGIN.l + 4, right = MARGIN.l + s.iw - 4;
    const candidates: Box[] = [
      { x0: left, x1: left + w, y0: ty - 2 - LABEL_H, y1: ty - 2 },
      { x0: right - w, x1: right, y0: ty - 2 - LABEL_H, y1: ty - 2 },
      { x0: left, x1: left + w, y0: ty + 3, y1: ty + 3 + LABEL_H },
      { x0: right - w, x1: right, y0: ty + 3, y1: ty + 3 + LABEL_H },
    ].filter((b) => b.y0 >= MARGIN.t - 4 && b.y1 <= MARGIN.t + s.ih + 4);
    if (!candidates.length) continue;
    const others = out.flatMap((o) => (o.box ? [o.box] : []));
    const scored = candidates.map((b) => ({ b, c: clearance(b, lines, others) }));
    const best = scored.find((x) => x.c >= 8) ?? scored.reduce((m, x) => (x.c > m.c ? x : m));
    // No clear spot (narrow chart, data hugging the line): leave it to the key below the chart.
    out.push({ t, box: best.c >= 4 ? best.b : null });
  }
  return out;
}

/**
 * Annotation key: the hatched band, then every threshold that isn't simply a band edge — so each
 * dashed line stays identifiable even when its inline label had no room. Text tokens only.
 */
export function TrendKey({ range, thresholds = [], className }: { range?: TrendRange; thresholds?: TrendThreshold[]; className?: string }) {
  const edges = new Set([range?.low, range?.high].filter((v): v is number => v !== undefined));
  const extra = thresholds.filter((t) => !edges.has(t.value));
  if (!range && extra.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted", className)}>
      {range ? (
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[4px] bg-hatch shadow-[inset_0_0_0_1px_var(--color-line)]" aria-hidden="true" />
          {range.label}
          {edges.size && thresholds.some((t) => edges.has(t.value)) ? <span className="text-faint">(edge dashed)</span> : null}
        </li>
      ) : null}
      {extra.map((t) => (
        <li key={`${t.value}-${t.label}`} className="flex items-center gap-2">
          <span className="w-5 border-t border-dashed border-ink-2/60" aria-hidden="true" />
          {t.label}
        </li>
      ))}
    </ul>
  );
}
