"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Tip } from "@/components/ui/tooltip";

/**
 * Packed bubble chart for a cobalt focal card (ref 6). Area ∝ value. The largest bubble is
 * solid white with the headline number; the rest are translucent with value + label.
 * Every value is also exposed in the accessible label and on hover/focus.
 */
type Item = { id: string; label: string; value: number; display?: string };

function pack(items: Item[], W: number, H: number, pad = 6) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const scale = Math.sqrt((W * H * 0.42) / (Math.PI * total));
  const sorted = [...items].sort((a, b) => b.value - a.value).map((it) => ({ ...it, r: Math.max(14, Math.sqrt(it.value) * scale) }));
  const placed: { it: (typeof sorted)[number]; x: number; y: number }[] = [];
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
    placed.push({ it, x: best?.x ?? W / 2, y: best?.y ?? H / 2 });
  }
  // round so server (Node) and browser trig results produce identical markup
  return placed.map((p) => ({ ...p, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, it: { ...p.it, r: Math.round(p.it.r * 10) / 10 } }));
}

export function BubbleChart({ items, title, unit, className, height = 220 }: { items: Item[]; title: string; unit?: string; className?: string; height?: number }) {
  const W = 320, H = height;
  const placed = useMemo(() => pack(items, W, H), [items, H]);
  const top = placed[0]?.it.id;
  return (
    <div className={cn("relative w-full", className)} role="img" aria-label={`${title}: ${items.map((i) => `${i.label} ${i.display ?? i.value}${unit ? ` ${unit}` : ""}`).join(", ")}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
        {placed.map(({ it, x, y }, i) => {
          const big = it.id === top;
          return (
            <Tip key={it.id} label={`${it.label}: ${it.display ?? it.value}${unit ? ` ${unit}` : ""}`}>
              <motion.g
                tabIndex={0}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...pop, delay: i * 0.05 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
                className="cursor-default outline-none [&:focus-visible>circle]:stroke-white [&:focus-visible>circle]:stroke-2"
              >
                <circle cx={x} cy={y} r={it.r} fill={big ? "#ffffff" : "rgb(255 255 255 / 0.16)"} stroke="rgb(255 255 255 / 0.28)" strokeWidth={big ? 0 : 1} />
                {it.r > 22 ? (
                  <>
                    <text x={x} y={y - (big ? 4 : 2)} textAnchor="middle" className={cn("tabular font-light", big ? "fill-ink" : "fill-white")} style={{ fontSize: big ? Math.min(30, it.r * 0.55) : Math.min(18, it.r * 0.45) }}>
                      {it.display ?? it.value}
                    </text>
                    <text x={x} y={y + (big ? 16 : 12)} textAnchor="middle" className={big ? "fill-muted" : "fill-white/70"} style={{ fontSize: Math.min(12, Math.max(10, it.r * 0.22)) }}>
                      {it.label}
                    </text>
                  </>
                ) : (
                  <text x={x} y={y} dy="0.35em" textAnchor="middle" className="fill-white tabular" style={{ fontSize: 10 }}>
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
