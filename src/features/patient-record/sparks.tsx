"use client";

import type { ReactNode } from "react";
import { Bed, Bone, Brain, CalendarBlank, ClipboardText, Drop, Flask, Gauge, Heartbeat, Moon, PersonSimpleWalk, Pulse, Ruler, Scales, Thermometer, Wind } from "@phosphor-icons/react";
import { BarsSpark, DotsSpark, EcgSpark, WaveSpark } from "@/components/viz/condition";
import { cn } from "@/lib/cn";
import type { VitalMeasure } from "./measures";
import { measureValueText } from "./measures";

/** Icon that names the measure (never decorative colour; the label always carries the meaning). */
export function measureIcon(m: Pick<VitalMeasure, "label" | "lab">): ReactNode {
  const l = m.label.toLowerCase();
  if (/blood pressure|systolic/.test(l)) return <Gauge />;
  if (/heart rate|resting hr/.test(l)) return <Heartbeat />;
  if (/spo|oxygen/.test(l)) return <Drop />;
  if (/weight/.test(l)) return <Scales />;
  if (/waist/.test(l)) return <Ruler />;
  if (/peak flow|fev1/.test(l)) return <Wind />;
  if (/^ahi|ess/.test(l)) return <Bed />;
  if (/sleep/.test(l)) return <Moon />;
  if (/pain|stiffness/.test(l)) return <Bone />;
  if (/walking/.test(l)) return <PersonSimpleWalk />;
  if (/headache|gad/.test(l)) return <Brain />;
  if (/flush/.test(l)) return <Thermometer />;
  if (/cycle/.test(l)) return <CalendarBlank />;
  if (/symptom/.test(l)) return <ClipboardText />;
  return m.lab ? <Flask /> : <Pulse />;
}

/**
 * Blood pressure as one bar per reading spanning diastolic → systolic, with the 130/80 targets
 * dashed — the standard BP chart form, so both numbers stay visible. Latest reading in cobalt.
 */
export function RangeBarsSpark({ points, label, targets = [130, 80] }: { points: { v: number; v2?: number; self: boolean }[]; label: string; targets?: number[] }) {
  const W = 200, H = 60, pad = 5;
  const lows = points.map((p) => p.v2 ?? p.v), highs = points.map((p) => p.v);
  const min = Math.min(...lows, ...targets) - 4, max = Math.max(...highs, ...targets) + 4;
  const y = (v: number) => pad + ((max - v) / (max - min || 1)) * (H - pad * 2);
  const step = W / Math.max(1, points.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible" role="img" aria-label={label}>
      {targets.map((t) => (
        <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-faint)" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {points.map((p, i) => {
        const x = step * i + step / 2;
        const last = i === points.length - 1;
        return (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={y(p.v)}
            y2={y(p.v2 ?? p.v)}
            stroke={last ? "var(--color-primary)" : p.self ? "var(--color-faint)" : "var(--color-ink-2)"}
            strokeOpacity={last ? 1 : 0.55}
            strokeWidth={4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/**
 * Lab results as one dot per report (sparse series stay legible, unlike the dense dot-matrix),
 * joined by a faint guide, with the target zone shaded. Dots are HTML so they stay round at any
 * aspect ratio. Latest result in cobalt.
 */
export function ResultDotsSpark({ values, low, high, label }: { values: number[]; low?: number; high?: number; label: string }) {
  const W = 200, H = 60, pad = 7;
  const lo0 = Math.min(...values), hi0 = Math.max(...values);
  const span = hi0 - lo0 || Math.abs(hi0) * 0.1 || 1;
  const min = lo0 - span * 0.15, max = hi0 + span * 0.15;
  const x = (i: number) => (values.length === 1 ? W / 2 : pad + (i / (values.length - 1)) * (W - pad * 2));
  const y = (v: number) => pad + ((max - v) / (max - min)) * (H - pad * 2);
  const clampY = (v: number) => Math.max(0, Math.min(H, y(v)));
  const bandTop = high !== undefined ? clampY(high) : 0;
  const bandBottom = low !== undefined ? clampY(low) : H;
  const showBand = (low !== undefined || high !== undefined) && bandBottom - bandTop > 1;
  return (
    <div className="relative size-full" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        {showBand ? <rect x={0} width={W} y={bandTop} height={bandBottom - bandTop} fill="var(--color-sunken)" opacity={0.7} /> : null}
        <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", last ? "size-2.5 bg-primary" : "bg-ink-2/45")}
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * A single reading has no trend: show where it sits against its target instead. Linear scale
 * padded around the value and the target limits; the target zone is the kit's hatch, the value
 * a cobalt dot, the limits printed under the track. Without a target there is nothing to place
 * it against, so it says so.
 */
export function TargetGauge({ value, low, high, unit, decimals = 0, caption, className }: { value: number; low?: number; high?: number; unit: string; decimals?: number; caption: string; className?: string }) {
  const u = unit ? ` ${unit}` : "";
  if (low === undefined && high === undefined) {
    return (
      <span className={cn("flex h-full items-center gap-2 text-[11px] text-muted", className)} role="img" aria-label={`${caption}: ${value.toFixed(decimals)}${u}, no target set`}>
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        One reading · no target to compare with
      </span>
    );
  }
  const marks = [value, low, high].filter((v): v is number => v !== undefined);
  const lo0 = Math.min(...marks), hi0 = Math.max(...marks);
  const span = hi0 - lo0 || Math.abs(hi0) * 0.2 || 1;
  // open-ended targets extend to the edge of the scale; a zero floor where the measure can't go negative
  const min = Math.max(lo0 >= 0 ? 0 : -Infinity, lo0 - span * 0.35), max = hi0 + span * 0.35;
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
  const zoneFrom = low !== undefined ? pct(low) : 0;
  const zoneTo = high !== undefined ? pct(high) : 100;
  const inside = (low === undefined || value >= low) && (high === undefined || value <= high);
  const target = low !== undefined && high !== undefined ? `${low} – ${high}` : high !== undefined ? `< ${high}` : `≥ ${low}`;
  return (
    <span
      className={cn("flex h-full w-full flex-col justify-center gap-2", className)}
      role="img"
      aria-label={`${caption}: one reading, ${value.toFixed(decimals)}${u}, ${inside ? "inside" : "outside"} the target ${target}${u}. Hatched zone = target.`}
    >
      <span className="text-[11px] leading-none text-muted" aria-hidden="true">
        One reading · placed against the target
      </span>
      <span className="relative block h-2 rounded-full bg-sunken" aria-hidden="true">
        <span className="absolute inset-y-0 rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--color-line-strong)]" style={{ left: `${zoneFrom}%`, right: `${100 - zoneTo}%` }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface" style={{ left: `${pct(value)}%` }} />
      </span>
      <span className="relative block h-3 text-[11px] leading-none text-muted tabular" aria-hidden="true">
        {low !== undefined ? (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${zoneFrom}%` }}>
            {low}
          </span>
        ) : null}
        {high !== undefined ? (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${zoneTo}%` }}>
            {high}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Spark for a measure's history, chosen to fit what is measured; the aria-label says what it shows. */
export function MeasureSpark({ m }: { m: VitalMeasure }) {
  const pts = m.points;
  const latest = pts[pts.length - 1];
  if (!latest) return null;
  const values = pts.map((p) => p.v);
  const unit = m.unit ? ` ${m.unit}` : "";
  const n = pts.length;
  if (n < 2 && m.spark !== "ecg" && !m.twoValues) {
    return <TargetGauge value={latest.v} low={m.range?.low} high={m.range?.high} unit={m.unit} decimals={m.decimals} caption={m.label} />;
  }
  switch (m.spark) {
    case "range-bars":
      return <RangeBarsSpark points={pts} label={`${m.label}: ${n} readings drawn as bars from diastolic to systolic, oldest to newest; dashed lines mark the 130/80 targets. Latest ${measureValueText(m, latest)}${unit}.`} />;
    case "ecg": {
      const beats = Math.max(2, Math.min(7, Math.round(latest.v / 20)));
      return <EcgSpark beats={beats} label={`Illustrative trace drawn at the latest rate of ${latest.v} bpm (${beats} beats in the window) — not an ECG recording.`} />;
    }
    case "bars":
      return <BarsSpark values={values} label={`${m.label}: ${n} readings as bars from zero, oldest to newest; latest ${measureValueText(m, latest)}${unit}.`} />;
    case "dots":
      return n > 12 ? (
        <DotsSpark values={values} label={`${m.label}: ${n} readings as dots, oldest to newest; latest ${measureValueText(m, latest)}${unit}.`} />
      ) : (
        <ResultDotsSpark
          values={values}
          low={m.range?.low}
          high={m.range?.high}
          label={`${m.label}: ${n} ${m.lab ? "results, one dot per report" : "readings, one dot each"}, oldest to newest${m.range ? `; shaded zone = ${m.targetLabel.toLowerCase()}` : ""}; latest ${measureValueText(m, latest)}${unit}.`}
        />
      );
    default: {
      const lo = Math.min(...values), hi = Math.max(...values);
      const band: [number, number] | undefined =
        m.range && (m.range.low !== undefined || m.range.high !== undefined)
          ? [Math.max(lo, m.range.low ?? lo), Math.min(hi, m.range.high ?? hi)]
          : undefined;
      const usable = band && band[1] > band[0] ? band : undefined;
      return (
        <WaveSpark
          values={values}
          band={usable}
          label={`${m.label}: ${n} readings, oldest to newest${usable ? `; shaded band = ${m.targetLabel.toLowerCase()}` : ""}; latest ${measureValueText(m, latest)}${unit}.`}
        />
      );
    }
  }
}
