"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Connected-thread motif. Elements register as anchors by key; the layer measures them relative
 * to a container and draws cubic threads from each `from` anchor's right edge to each `to`
 * anchor's left side. Threads draw in with a critically damped spring and redraw whenever
 * `version` changes (new focal system, new year). Decorative: aria-hidden.
 */

export function useAnchors() {
  const map = useRef(new Map<string, HTMLElement>());
  const cache = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const refFor = useCallback((key: string) => {
    let fn = cache.current.get(key);
    if (!fn) {
      // Last mounted element wins. Detach (null) is ignored on purpose: an exiting element and its
      // replacement can share a key during a crossfade; detached elements are skipped at measure time.
      fn = (el: HTMLElement | null) => {
        if (el) map.current.set(key, el);
      };
      cache.current.set(key, fn);
    }
    return fn;
  }, []);
  return { map, refFor };
}

export type ThreadSpec = { id: string; from: string; to: string; tone: "active" | "muted"; group: string; eventId: string };
type Geo = ThreadSpec & { d: string };

const DRAW = { type: "spring", stiffness: 70, damping: 17, mass: 1 } as const;

export function ThreadLayer({
  containerRef,
  anchors,
  threads,
  version,
  highlightGroup,
  selectedEvent,
  enabled,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  anchors: RefObject<Map<string, HTMLElement>>;
  threads: ThreadSpec[];
  version: string;
  highlightGroup: string | null;
  selectedEvent: string | null;
  enabled: boolean;
}) {
  const reduce = useReducedMotion();
  const [geo, setGeo] = useState<Geo[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const out: Geo[] = [];
    for (const t of threadsRef.current) {
      const a = anchors.current.get(t.from);
      const b = anchors.current.get(t.to);
      if (!a || !b || !a.isConnected || !b.isConnected) continue;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      if (!ar.width || !br.width) continue;
      const sx = ar.right - cr.left - 2;
      const sy = ar.top + ar.height / 2 - cr.top;
      const tx = br.left - cr.left + Math.min(br.width / 2, 10);
      const ty = br.top + br.height / 2 - cr.top;
      const dx = Math.max(36, (tx - sx) * 0.5);
      out.push({ ...t, d: `M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx + dx).toFixed(1)},${sy.toFixed(1)} ${(tx - dx).toFixed(1)},${ty.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}` });
    }
    setGeo(out);
    setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
  }, [anchors, containerRef]);

  // Follow layout springs for a short window after each change.
  useLayoutEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const until = performance.now() + (reduce ? 60 : 1000);
    const loop = () => {
      measure();
      if (performance.now() < until) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [version, enabled, measure, reduce]);

  useEffect(() => {
    if (!enabled) return;
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    document.fonts?.ready.then(() => measure()).catch(() => undefined);
    return () => ro.disconnect();
  }, [enabled, containerRef, measure]);

  if (!enabled) return null;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-visible" width={size.w} height={size.h}>
      <g key={version}>
        {geo.map((g, i) => {
          const hot = (highlightGroup !== null && g.group === highlightGroup) || g.eventId === selectedEvent;
          const dim = highlightGroup !== null && g.group !== highlightGroup;
          const active = g.tone === "active";
          return (
            <motion.path
              key={g.id}
              d={g.d}
              fill="none"
              stroke={active || hot ? "var(--color-primary)" : "var(--color-line-strong)"}
              strokeWidth={g.eventId === selectedEvent ? 2 : hot ? 1.75 : active ? 1.25 : 1}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduce ? { duration: 0 } : { ...DRAW, delay: 0.15 + Math.min(i, 30) * 0.022 }}
              style={{ opacity: dim ? 0.16 : active || hot ? 0.9 : 0.8, transition: "opacity 200ms, stroke-width 200ms" }}
            />
          );
        })}
      </g>
    </svg>
  );
}
