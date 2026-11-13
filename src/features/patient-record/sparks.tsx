"use client";

import type { ReactNode } from "react";
import { Bed, Bone, Brain, CalendarBlank, ClipboardText, Drop, Gauge, Heartbeat, Moon, PersonSimpleWalk, Pulse, Ruler, Scales, TestTube, Thermometer, Wind } from "@phosphor-icons/react";
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
  return m.lab ? <TestTube /> : <Pulse />;
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

/** Spark for a measure's history, chosen to fit what is measured; the aria-label says what it shows. */
export function MeasureSpark({ m }: { m: VitalMeasure }) {
  const pts = m.points;
  const latest = pts[pts.length - 1];
  if (!latest) return null;
  const values = pts.map((p) => p.v);
  const unit = m.unit ? ` ${m.unit}` : "";
  const n = pts.length;
  if (n < 2 && m.spark !== "ecg") {
    return (
      <span className="flex h-full items-center gap-2 text-[11px] text-muted" role="img" aria-label={`${m.label}: a single reading so far, ${measureValueText(m, latest)}${unit}`}>
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        One reading — no trend yet
      </span>
    );
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
