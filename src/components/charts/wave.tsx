"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo } from "react";
import { cn } from "@/lib/cn";
import { monotonePath } from "./geometry";

/**
 * The reference's vital-sign wave: a 2px cobalt trend line over a hatched reference band.
 * It is a stat-tile trend (single series, value printed beside it), so it carries no legend
 * or hover layer; the full interactive chart lives on the Vital Signs tab.
 */
export function VitalWave({
  samples,
  band,
  className,
  tone = "primary",
  label,
}: {
  samples: number[]; // 0..1 (1 = top)
  band: [number, number]; // 0..1 lower/upper edge of the reference range
  className?: string;
  tone?: "primary" | "white";
  label: string;
}) {
  const W = 240, H = 64;
  const d = useMemo(() => monotonePath(samples.map((v, i) => ({ x: (i / (samples.length - 1)) * W, y: (1 - v) * (H - 8) + 4 }))), [samples]);
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className={cn("relative h-16 w-full", className)} role="img" aria-label={label}>
      <div
        aria-hidden="true"
        className={cn("absolute inset-x-0 rounded-[6px]", tone === "white" ? "bg-hatch-light" : "bg-hatch")}
        style={{ top: `${(1 - band[1]) * 100}%`, bottom: `${band[0] * 100}%` }}
      />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("absolute inset-0 size-full overflow-visible", tone === "white" ? "text-white" : "text-primary")} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-fade`} x1="0" x2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="0.2" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <motion.path
          d={d}
          fill="none"
          stroke={`url(#${id}-fade)`}
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </svg>
    </div>
  );
}
