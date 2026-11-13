"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Bone, BowlFood, Brain, CaretRight, Drop, Flower, Gauge, Heartbeat, Pulse, Wind } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import type { OrganKind, SystemKey } from "@/data/anatomy";
import { AvatarStack } from "@/components/ui/avatar";
import { Tip } from "@/components/ui/tooltip";
import { Legend } from "@/components/charts/legend";
import { OrganImage, type Hotspot } from "@/components/viz/organ";
import { VitalTile } from "@/components/viz/condition";
import { OrganCanvas } from "@/features/patient/organ-canvas";

/**
 * Dashboard-only compositions of the visual kit. Each one draws data handed to it by the role
 * homes (see derive.ts) and states its meaning in text, legend or tooltip.
 */

// ---------------------------------------------------------------------------------------------
// Organs
// ---------------------------------------------------------------------------------------------

const SYSTEM_ICONS: Record<SystemKey, typeof Heartbeat> = {
  cardiovascular: Heartbeat,
  respiratory: Wind,
  neurological: Brain,
  renal: Drop,
  hepatic: Drop,
  haematology: Drop,
  endocrine: Gauge,
  metabolic: Gauge,
  musculoskeletal: Bone,
  reproductive: Flower,
  digestive: BowlFood,
};

/** Icon for a body system (falls back to a pulse line for unclassified systems). */
export function SystemIcon({ system, size = 18 }: { system?: SystemKey; size?: number }) {
  const Icon = system ? SYSTEM_ICONS[system] : Pulse;
  return <Icon size={size} aria-hidden="true" />;
}

/** Small static organ in a round chip. The render has generous padding, so it is scaled up to fill. */
export function OrganBadge({ kind, size = 40, label, className, tone = "surface" }: { kind: OrganKind; size?: number; label?: string; className?: string; tone?: "surface" | "sunken" | "glass" }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        tone === "surface" ? "bg-surface" : tone === "sunken" ? "bg-sunken" : "bg-white/90",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <OrganImage kind={kind} alt={label} className="absolute left-1/2 top-1/2 h-[164%] w-[164%] max-w-none -translate-x-1/2 -translate-y-1/2" />
    </span>
  );
}

/**
 * Live organ hero (ref 3): the patient's organ as the one live WebGL canvas of the view, inside
 * frosted rings, with hotspots for the conditions recorded on it. Changing `kind` morphs the model.
 */
export function OrganStage({ kind, hotspots = [], label, organLabel, children, className }: { kind: OrganKind; hotspots?: Hotspot[]; label: string; organLabel: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative aspect-square w-full", className)} role="group" aria-label={label}>
      <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-white/40 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.95),0_40px_80px_-40px_rgb(33_38_34/0.28)]" />
      <div aria-hidden="true" className="absolute inset-[18%] rounded-full bg-white/50 shadow-[inset_0_0_0_1px_rgb(255_255_255)]" />
      <OrganCanvas shape={kind} tone="light" label={organLabel} className="pointer-events-none absolute inset-[10%] translate-y-[3%]" />
      {hotspots.map((h) => (
        <Tip
          key={h.id}
          label={
            <span>
              <span className="block">{h.label}</span>
              {h.detail ? <span className="text-white/70">{h.detail}</span> : null}
            </span>
          }
        >
          <button
            type="button"
            onClick={h.onClick}
            aria-pressed={!!h.active}
            aria-label={h.detail ? `${h.label}: ${h.detail}` : h.label}
            className={cn("group absolute z-[1] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full", h.active && "z-[2]")}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            <span className="absolute inset-0 rounded-full bg-white/50 animate-pulse-ring" aria-hidden="true" />
            <span
              className={cn(
                "relative size-3.5 rounded-full shadow-[0_2px_8px_rgb(0_0_0/0.18)] ring-[3px] transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-125",
                h.active ? "bg-primary ring-white" : "bg-white ring-white/60",
              )}
            />
          </button>
        </Tip>
      ))}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Stage flow (queue stages, referral pipeline)
// ---------------------------------------------------------------------------------------------

export type FlowStage = {
  id: string;
  label: string;
  count: number;
  /** short line under the count, e.g. "longest 35 min" or "1 past due" */
  hint?: string;
  people?: { name: string; avatar?: string | null }[];
  /** emphasise the stage (people are waiting here / handoffs stopped here) */
  emphasis?: boolean;
  alert?: boolean;
  /** what a screen reader hears for the stage */
  description: string;
};

/**
 * Ordered stages with counts and the people sitting in each — the queue's Arrived → Done flow
 * and the referral pipeline. Arrows only connect consecutive stages of the same process.
 */
export function StageFlow({ stages, label, variant = "light", className }: { stages: FlowStage[]; label: string; variant?: "light" | "primary"; className?: string }) {
  const onPrimary = variant === "primary";
  return (
    <div className="@container">
    <ol aria-label={label} className={cn("grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:flex @2xl:items-stretch @2xl:gap-0", className)}>
      {stages.map((s, i) => (
        <li key={s.id} className="flex min-w-0 @2xl:flex-1 @2xl:items-stretch">
          {i > 0 ? (
            <span aria-hidden="true" className={cn("hidden w-6 shrink-0 items-center justify-center @2xl:flex", onPrimary ? "text-white/70" : "text-faint")}>
              <CaretRight size={14} />
            </span>
          ) : null}
          <motion.div
            layout
            transition={snappy}
            aria-label={s.description}
            className={cn(
              "flex min-w-0 flex-1 flex-col justify-between gap-2 rounded-inner p-3 transition-colors duration-300",
              onPrimary
                ? s.emphasis
                  ? "bg-surface text-ink"
                  : "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
                : s.emphasis
                  ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                  : "bg-surface/60 text-ink",
            )}
          >
            <span className={cn("block truncate text-xs", onPrimary && !s.emphasis ? "text-white/90" : "text-muted")} aria-hidden="true">
              {s.label}
            </span>
            <span className="flex items-end justify-between gap-2" aria-hidden="true">
              <motion.span key={s.count} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={snappy} className="text-[28px] font-light leading-none tracking-[-0.02em]">
                {s.count}
              </motion.span>
              {s.people && s.people.length ? <AvatarStack people={s.people.map((p) => ({ name: p.name, avatar: p.avatar ?? undefined }))} size="xs" max={3} /> : null}
            </span>
            {s.hint ? (
              <span aria-hidden="true" className={cn("block truncate text-[11px]", s.alert ? (onPrimary && !s.emphasis ? "text-white" : "text-danger") : onPrimary && !s.emphasis ? "text-white/80" : "text-muted")}>
                {s.hint}
              </span>
            ) : null}
          </motion.div>
        </li>
      ))}
    </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Day strip — one practitioner's day as blocks on a time axis
// ---------------------------------------------------------------------------------------------

export type StripItem = { id: string; startMin: number; durationMin: number; color: string; title: string; detail: string; href: string };

export function DayStrip({
  items,
  fromMin,
  toMin,
  nowMin,
  legend,
  label,
}: {
  items: StripItem[];
  fromMin: number;
  toMin: number;
  nowMin: number;
  legend: { label: string; color: string }[];
  label: string;
}) {
  const span = toMin - fromMin;
  const pct = (m: number) => `${((m - fromMin) / span) * 100}%`;
  const hours = Array.from({ length: Math.floor(span / 120) + 1 }, (_, i) => fromMin + i * 120);
  return (
    <figure className="flex flex-col gap-3" aria-label={label}>
      <div className="relative h-10 rounded-full bg-sunken">
        {items.map((it) => (
          <Tip key={it.id} label={<span><span className="block">{it.title}</span><span className="text-white/70">{it.detail}</span></span>}>
            <Link
              href={it.href}
              aria-label={`${it.title}, ${it.detail}`}
              className="absolute inset-y-1 rounded-full outline-none transition-transform duration-200 hover:scale-y-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              style={{ left: pct(it.startMin), width: `max(10px, calc(${(it.durationMin / span) * 100}% - 2px))`, background: it.color }}
            />
          </Tip>
        ))}
        <span aria-hidden="true" className="pointer-events-none absolute -inset-y-1.5 z-[1] w-1 -translate-x-1/2 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--color-charcoal)]" style={{ left: pct(nowMin) }} />
      </div>
      <div className="relative h-4 text-[11px] text-muted tabular" aria-hidden="true">
        {hours.map((m) => (
          <span key={m} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(m) }}>
            {String(Math.floor(m / 60)).padStart(2, "0")}:00
          </span>
        ))}
      </div>
      <Legend items={[...legend.map((l) => ({ ...l, shape: "dot" as const })), { label: "Now", color: "var(--color-charcoal)", shape: "line" as const }]} />
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------
// Range dots — readings placed on a dotted reference scale (ref 3 "blood count")
// ---------------------------------------------------------------------------------------------

/**
 * A dotted scale from `domain[0]` to `domain[1]`; dots inside the reference range are darker.
 * Each reading is a marker at its value: earlier ones hollow, the latest solid accent.
 */
export function RangeDots({ readings, range, domain, label }: { readings: number[]; range: [number, number]; domain: [number, number]; label: string }) {
  const W = 200, H = 60, N = 25;
  const x = (v: number) => 6 + ((Math.min(domain[1], Math.max(domain[0], v)) - domain[0]) / (domain[1] - domain[0])) * (W - 12);
  const step = (domain[1] - domain[0]) / (N - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="size-full overflow-visible" role="img" aria-label={label}>
      {Array.from({ length: N }, (_, i) => {
        const v = domain[0] + i * step;
        const inRange = v >= range[0] && v <= range[1];
        return <circle key={i} cx={x(v)} cy={H / 2} r={2.6} fill={inRange ? "var(--color-ink-2)" : "var(--color-faint)"} opacity={inRange ? 0.5 : 0.22} />;
      })}
      <line x1={x(range[0])} x2={x(range[1])} y1={H / 2 + 14} y2={H / 2 + 14} stroke="var(--color-line-strong)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {readings.map((v, i) => {
        const last = i === readings.length - 1;
        return last ? (
          <circle key={i} cx={x(v)} cy={H / 2} r={6} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ) : (
          <circle key={i} cx={x(v)} cy={H / 2} r={4.5} fill="var(--color-surface)" stroke="var(--color-ink-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Reading tile — the kit's VitalTile plus a footer saying when and where the value came from
// ---------------------------------------------------------------------------------------------

export function ReadingTile({ caption, className, ...tile }: Parameters<typeof VitalTile>[0] & { caption: ReactNode }) {
  return (
    <div className={cn("flex h-full flex-col rounded-card bg-sunken", className)}>
      <VitalTile {...tile} className="pb-0" />
      <div className="mt-auto px-4 pb-3 pt-2 text-[11px] leading-snug text-muted">{caption}</div>
    </div>
  );
}
