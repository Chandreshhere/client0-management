"use client";

import type { ReactNode } from "react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Legend } from "@/components/charts/legend";
import { intTicks, tipLeft, useMarks, useWidth } from "./chart-utils";
import { DISCIPLINE_COLOR } from "./data";
import { CARE_DISCIPLINES, type LoadBin } from "./insights";

/**
 * Stacked column chart for diary load (per hour or per day), stacked by discipline in the fixed
 * categorical order (medical · nutrition · movement). Marks follow the chart rules: ≤24px columns,
 * 4px rounded data-end, square baseline, 2px surface gap between segments, hairline grid, integer
 * ticks (these are counts), a legend for the three series, one hover/focus tooltip listing every
 * series, a "now" marker and a table view. Columns can be picked (click / Enter).
 */

export type Unit = { one: string; many: string };
export const plural = (n: number, unit: Unit) => `${n} ${n === 1 ? unit.one : unit.many}`;

const TIP_W = 224;

export function LoadChart({
  bins,
  unit,
  ariaLabel,
  height = 176,
  now,
  fadePast = false,
  onPick,
  pickHint,
  detail,
  className,
}: {
  bins: LoadBin[];
  unit: Unit;
  ariaLabel: string;
  /** total height including the x-axis band */
  height?: number;
  /** position of "now" inside the bins (index + fraction of that bin) */
  now?: { index: number; fraction: number; label: string } | null;
  /** draw bins that are already over at reduced opacity */
  fadePast?: boolean;
  onPick?: (bin: LoadBin) => void;
  /** e.g. "Click to jump the diary to 10:00" */
  pickHint?: (bin: LoadBin) => string;
  /** extra tooltip lines: what's in the bin */
  detail?: (bin: LoadBin) => ReactNode;
  className?: string;
}) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const { active, markProps } = useMarks(bins.length, Math.max(0, bins.findIndex((b) => b.current)), onPick ? (i) => onPick(bins[i]) : undefined);

  const max = Math.max(0, ...bins.map((b) => b.total));
  const ticks = intTicks(max);
  const yMax = ticks[ticks.length - 1];
  const m = { t: 24, r: 4, b: 24, l: 28 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const band = bins.length ? iw / bins.length : 0;
  const bw = Math.min(24, band * 0.56);
  const sy = (v: number) => m.t + ih - (v / (yMax || 1)) * ih;
  const useShort = band < 48;
  const nowX = now && band ? m.l + band * (now.index + now.fraction) : null;
  const tip = active !== null ? bins[active] : null;

  return (
    <div ref={wrap} className={cn("relative w-full", className)} style={{ height }} role="group" aria-label={ariaLabel}>
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t} aria-hidden="true">
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                {t}
              </text>
            </g>
          ))}

          {bins.map((b, i) => {
            const cx = m.l + band * i + band / 2;
            let acc = 0;
            const segs = CARE_DISCIPLINES.map((d) => {
              const v = b.counts[d];
              const y0 = sy(acc);
              const y1 = sy(acc + v);
              acc += v;
              return { d, v, y0, y1 };
            }).filter((s) => s.v > 0);
            const faded = fadePast && b.past;
            const breakdown = b.total ? ` — ${CARE_DISCIPLINES.map((d) => `${DISCIPLINE_LABEL[d]} ${b.counts[d]}`).join(", ")}` : "";
            return (
              <g
                key={b.key}
                {...markProps(i)}
                role={onPick ? "button" : "img"}
                aria-label={`${b.title}: ${plural(b.total, unit)}${breakdown}${faded ? " (already started)" : ""}${onPick && pickHint ? `. ${pickHint(b)}` : ""}`}
                className={cn("outline-none", onPick && "cursor-pointer")}
                style={{ opacity: active !== null && active !== i ? 0.5 : 1, transition: "opacity 160ms var(--ease-out-quart)" }}
              >
                {/* hit target: the whole band, larger than the mark */}
                <rect x={m.l + band * i} y={m.t} width={band} height={ih} fill="transparent" />
                {active === i ? <rect x={cx - bw / 2 - 6} y={m.t - 4} width={bw + 12} height={ih + 4} rx={10} fill="var(--color-sunken)" /> : null}
                {segs.map((g, gi) => {
                  const top = gi === segs.length - 1;
                  const h = Math.max(0, g.y0 - g.y1 - (gi > 0 ? 2 : 0));
                  const y = g.y1;
                  const r = top ? Math.min(4, h) : 0;
                  const d = `M${cx - bw / 2},${y + h} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${y + h} Z`;
                  return <path key={g.d} d={d} fill={DISCIPLINE_COLOR[g.d]} fillOpacity={faded ? 0.38 : 1} />;
                })}
                <text x={cx} y={height - 6} textAnchor="middle" aria-hidden="true" className={cn("text-[11px] tabular", b.current ? "fill-ink font-medium" : "fill-muted")}>
                  {useShort ? b.short : b.label}
                </text>
              </g>
            );
          })}

          {nowX !== null && now ? (
            <g aria-hidden="true" className="pointer-events-none">
              <line x1={nowX} x2={nowX} y1={16} y2={m.t + ih} stroke="var(--color-charcoal)" strokeWidth={1.5} />
              <rect x={Math.min(Math.max(nowX - 22, 0), width - 44)} y={0} width={44} height={18} rx={9} fill="var(--color-charcoal)" />
              <text x={Math.min(Math.max(nowX, 22), width - 22)} y={9} dy="0.35em" textAnchor="middle" className="fill-white font-mono text-[11px]">
                {now.label}
              </text>
            </g>
          ) : null}

          {max === 0 ? (
            <text x={m.l + iw / 2} y={m.t + ih / 2} textAnchor="middle" className="fill-muted text-xs">
              Nothing booked
            </text>
          ) : null}
        </svg>
      ) : null}

      {tip && active !== null && width > 0 ? (
        <div className="pointer-events-none absolute top-0 z-10 rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop" style={{ left: tipLeft(m.l + band * active + band / 2, width, TIP_W), width: TIP_W }}>
          <p className="text-white/60">{tip.title}</p>
          <p className="mt-0.5 text-sm font-medium tabular">{plural(tip.total, unit)}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {CARE_DISCIPLINES.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: DISCIPLINE_COLOR[d] }} aria-hidden="true" />
                <span className="w-5 font-medium tabular">{tip.counts[d]}</span>
                <span className="text-white/60">{DISCIPLINE_LABEL[d]}</span>
              </li>
            ))}
          </ul>
          {detail && tip.events.length ? <div className="mt-2 border-t border-white/15 pt-2 text-white/80">{detail(tip)}</div> : null}
          {onPick && pickHint ? <p className="mt-2 text-white/60">{pickHint(tip)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Legend for the three disciplines (the chart's series), plus the faded-mark note when used. */
export function LoadLegend({ fadedNote, className }: { fadedNote?: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <Legend items={CARE_DISCIPLINES.map((d) => ({ label: DISCIPLINE_LABEL[d], color: DISCIPLINE_COLOR[d], shape: "rect" as const }))} />
      {fadedNote ? (
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="size-2.5 rounded-[3px] bg-ink/20" aria-hidden="true" />
          {fadedNote}
        </span>
      ) : null}
    </div>
  );
}

/** Table twin of a chart, so every value is reachable without hovering. */
export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return (
    <details className="group/table text-xs">
      <summary className="inline-flex cursor-pointer select-none items-center rounded-full text-muted outline-none hover:text-ink focus-visible:text-ink [&::-webkit-details-marker]:hidden">
        <span className="group-open/table:hidden">Show as table</span>
        <span className="hidden group-open/table:inline">Hide table</span>
      </summary>
      <div className="relative mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left tabular">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-muted">
              {head.map((h, i) => (
                <th key={h} scope="col" className={cn("py-1.5 font-normal", i === 0 ? "pr-3" : "px-3 text-right last:pr-0")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line text-ink-2">
                {r.cells.map((c, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="py-1.5 pr-3 font-normal text-ink">
                      {c}
                    </th>
                  ) : (
                    <td key={i} className="px-3 py-1.5 text-right last:pr-0">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
