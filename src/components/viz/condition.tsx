"use client";

import { useId, useMemo, type ReactNode } from "react";
import { FileText } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { monotonePath } from "@/components/charts/geometry";

/**
 * Condition & vital tiles from references 2 and 3.
 * - BodyConditionCard: "Respiratory 13%" card with mini progress and count badge.
 * - VitalTile: grey tile (icon · label · value) holding a white chart well.
 * - Spark charts for the wells: BarsSpark (blood status), EcgSpark (heart rate), DotsSpark
 *   (blood count), WaveSpark (glucose); ValuePill (the tall cobalt "120 bpm" pill).
 * All are trend sparklines inside stat tiles: values are printed beside them, so they carry
 * aria-labels instead of hover layers (dataviz "figures" rule).
 */

export function BodyConditionCard({
  icon,
  label,
  percent,
  progress,
  count,
  active,
  onClick,
  children,
  className,
}: {
  icon: ReactNode;
  label: string;
  percent: number;
  progress?: { value: number; max: number };
  count?: number;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!active } : {})}
      className={cn(
        // flex column, top-aligned: a <button> otherwise centres its content vertically, so cards
        // of one row (stretched to equal height) drifted out of line with each other.
        "flex w-full flex-col justify-start rounded-card bg-surface p-4 text-left transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)]",
        active ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : onClick ? "hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "",
        className,
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-[18px]" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted">{label}</span>
          <span className="block text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">{percent}%</span>
        </span>
        {typeof count === "number" ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-xs text-ink-2 tabular" aria-label={`${count} open items`}>
            {count}
          </span>
        ) : null}
      </span>
      {progress ? (
        <span className="mt-3 flex items-center gap-2">
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, (progress.value / progress.max) * 100)}%` }} />
          </span>
          <span className="text-[11px] text-muted tabular">
            {progress.value}/{progress.max}
          </span>
          <FileText size={14} className="text-faint" aria-hidden="true" />
        </span>
      ) : null}
      {children ? <span className="mt-3 block">{children}</span> : null}
    </Comp>
  );
}

export function VitalTile({
  icon,
  label,
  value,
  unit,
  chart,
  aside,
  accent,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  chart: ReactNode;
  aside?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card bg-sunken p-2", className)}>
      <div className="flex items-center gap-3 p-2">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]", accent ? "bg-primary text-white" : "bg-surface text-ink-2")} aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{label}</p>
          <p className="truncate text-sm text-ink">
            {value}
            {unit ? <span className="ml-1 text-xs text-muted">{unit}</span> : null}
          </p>
        </div>
      </div>
      <div className="relative flex h-[96px] items-center gap-3 overflow-hidden rounded-inner bg-surface px-3">
        <div className="h-full min-w-0 flex-1 py-3">{chart}</div>
        {aside}
      </div>
    </div>
  );
}

/** Tall cobalt pill holding the current value (ref 3 heart-rate tile). */
export function ValuePill({ value, unit, className }: { value: ReactNode; unit?: string; className?: string }) {
  return (
    <span className={cn("flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-[16px] bg-primary text-white", className)}>
      <span className="text-lg font-light leading-none tabular">{value}</span>
      {unit ? <span className="mt-1 text-[10px] text-white/75">{unit}</span> : null}
    </span>
  );
}

/** Printed value beside a spark, ref 3 style ("116 /70"). */
export function SparkValue({ value, sub }: { value: ReactNode; sub?: ReactNode }) {
  return (
    <span className="flex shrink-0 items-baseline gap-0.5 self-end pb-3 text-ink">
      <span className="text-lg font-light leading-none tabular">{value}</span>
      {sub ? <span className="text-[11px] text-muted">{sub}</span> : null}
    </span>
  );
}

export function BarsSpark({ values, highlightLast = true, label }: { values: number[]; highlightLast?: boolean; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-full items-end gap-[3px]" role="img" aria-label={label}>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-[2px] rounded-full", highlightLast && i === values.length - 1 ? "bg-primary" : "bg-line-strong")}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** ECG trace built from a P-QRS-T beat template repeated at the given rate. */
export function EcgSpark({ beats = 4, label, tone = "primary" }: { beats?: number; label: string; tone?: "primary" | "ink" }) {
  const W = 200, H = 60;
  const d = useMemo(() => {
    const tpl: [number, number][] = [
      [0, 0], [0.12, 0], [0.16, -0.12], [0.2, 0], [0.3, 0], [0.33, 0.12], [0.37, -0.95], [0.41, 0.38], [0.45, 0], [0.58, 0], [0.66, -0.22], [0.74, 0], [1, 0],
    ];
    const pts: string[] = [];
    for (let b = 0; b < beats; b++) {
      for (const [x, y] of tpl) {
        const px = ((b + x) / beats) * W;
        const py = H / 2 + y * (H / 2 - 4);
        pts.push(`${pts.length ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }
    return pts.join("");
  }, [beats]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={tone === "primary" ? "var(--color-primary)" : "var(--color-ink)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Dot-matrix line (ref 3 "blood count"): dots along a smooth curve, fading in from the left. */
export function DotsSpark({ values, label }: { values: number[]; label: string }) {
  const W = 200, H = 60;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: H - 6 - ((v - min) / (max - min || 1)) * (H - 12) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" role="img" aria-label={label}>
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.2 : 1.8} fill={i === pts.length - 1 ? "var(--color-primary)" : "var(--color-faint)"} opacity={i === pts.length - 1 ? 1 : 0.25 + (i / pts.length) * 0.75} />
      ))}
    </svg>
  );
}

export function WaveSpark({ values, label, band }: { values: number[]; label: string; band?: [number, number] }) {
  const W = 200, H = 60;
  const id = useId();
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: H - 6 - ((v - min) / (max - min || 1)) * (H - 12) }));
  const d = monotonePath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {band ? <rect x={0} width={W} y={H - 6 - ((band[1] - min) / (max - min || 1)) * (H - 12)} height={Math.abs(((band[1] - band[0]) / (max - min || 1)) * (H - 12))} fill="var(--color-sunken)" /> : null}
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${id}-a)`} />
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
