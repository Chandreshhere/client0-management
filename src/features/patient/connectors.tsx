"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Connector threads between condition chips (centre column) and timeline events (right panel)
 * — the reference's signature. Lines represent documented associations (event → condition),
 * never causation (doc §6). Elements register as anchors; the layer recomputes geometry on
 * resize and follows layout springs frame-by-frame for a short window after each change.
 */

type Registry = {
  register: (key: string, el: HTMLElement) => void;
  /** Only removes the entry if it still points at `el` — an exiting element must not evict the
   *  new element that took over the same key (e.g. a condition promoted to the focal card). */
  unregister: (key: string, el: HTMLElement | null) => void;
  get: (key: string) => HTMLElement | undefined;
  subscribe: (fn: () => void) => () => void;
};
const AnchorCtx = createContext<Registry | null>(null);

export function AnchorProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, HTMLElement>());
  const listeners = useRef(new Set<() => void>());
  const value = useMemo<Registry>(() => {
    const notify = () => listeners.current.forEach((fn) => fn());
    return {
      register: (key, el) => {
        map.current.set(key, el);
        notify();
      },
      unregister: (key, el) => {
        if (el && map.current.get(key) !== el) return;
        map.current.delete(key);
        notify();
      },
      get: (key) => map.current.get(key),
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
    };
  }, []);
  return <AnchorCtx.Provider value={value}>{children}</AnchorCtx.Provider>;
}

export function useAnchor(key: string) {
  const ctx = useContext(AnchorCtx);
  const last = useRef<HTMLElement | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      if (!ctx) return;
      if (el) {
        last.current = el;
        ctx.register(key, el);
      } else {
        ctx.unregister(key, last.current);
        last.current = null;
      }
    },
    [ctx, key],
  );
}

export function useAnchorRegistry() {
  const ctx = useContext(AnchorCtx);
  if (!ctx) throw new Error("useAnchorRegistry outside AnchorProvider");
  return ctx;
}

export type Link = { id: string; from: string; to: string; tone: "active" | "muted"; group: string; eventId?: string; label?: string; detail?: string };

type Geo = { id: string; d: string; tone: Link["tone"]; group: string; eventId?: string; label?: string; detail?: string };

export function ConnectorLayer({
  containerRef,
  links,
  version,
  highlightGroup,
  enabled,
  onOpenEvent,
}: {
  onOpenEvent?: (eventId: string) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  links: Link[];
  version: string;
  highlightGroup: string | null;
  enabled: boolean;
}) {
  const reg = useAnchorRegistry();
  const [geo, setGeo] = useState<Geo[]>([]);
  const [tip, setTip] = useState<{ x: number; y: number; g: Geo } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduce = useReducedMotion();
  const linksRef = useRef(links);
  linksRef.current = links;

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const out: Geo[] = [];
    for (const l of linksRef.current) {
      const a = reg.get(l.from), b = reg.get(l.to);
      if (!a || !b) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (!ar.width || !br.width) continue;
      const sx = ar.right - cr.left - 2, sy = ar.top + ar.height / 2 - cr.top;
      const tx = br.left - cr.left + br.width * 0.3, ty = br.top + br.height / 2 - cr.top;
      const dx = Math.max(40, (tx - sx) * 0.52);
      out.push({ id: l.id, tone: l.tone, group: l.group, eventId: l.eventId, label: l.label, detail: l.detail, d: `M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx + dx).toFixed(1)},${sy.toFixed(1)} ${(tx - dx).toFixed(1)},${ty.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}` });
    }
    setGeo(out);
    setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
  }, [containerRef, reg]);

  // follow springs for a short window after any change
  useLayoutEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const until = performance.now() + (reduce ? 50 : 1100);
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
    let raf = 0;
    const unsub = reg.subscribe(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    });
    return () => {
      ro.disconnect();
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [enabled, containerRef, measure, reg]);

  if (!enabled) return null;

  const tipAt = (e: React.PointerEvent, g: Geo) => {
    const c = containerRef.current?.getBoundingClientRect();
    if (c) setTip({ x: e.clientX - c.left, y: e.clientY - c.top, g });
  };

  return (
    <>
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
      width={size.w}
      height={size.h}
    >
      <g key={version}>
        {geo.map((g, i) => {
          const hl = highlightGroup ? g.group === highlightGroup : false;
          const dim = highlightGroup ? !hl : false;
          const active = g.tone === "active";
          return (
            <g key={g.id}>
            <path
              d={g.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: "stroke", cursor: g.eventId ? "pointer" : "default" }}
              onPointerEnter={(e) => tipAt(e, g)}
              onPointerMove={(e) => tipAt(e, g)}
              onPointerLeave={() => setTip(null)}
              onClick={() => g.eventId && onOpenEvent?.(g.eventId)}
            />
            <path
              d={g.d}
              pathLength={1}
              fill="none"
              stroke={active || hl ? "var(--color-primary)" : "var(--color-line-strong)"}
              strokeWidth={hl ? 1.75 : active ? 1.25 : 1}
              strokeLinecap="round"
              className="connector-path"
              style={{
                opacity: dim ? 0.18 : active || hl ? 0.9 : 0.75,
                animationDelay: reduce ? "0ms" : `${Math.min(i, 24) * 28}ms`,
                transition: "opacity 200ms, stroke 200ms, stroke-width 200ms",
                pointerEvents: "none",
                ...(tip?.g.id === g.id ? { opacity: 1, strokeWidth: 2.25, stroke: "var(--color-primary)" } : {}),
              }}
            />
            </g>
          );
        })}
      </g>
    </svg>
    {tip ? (
      <div className="pointer-events-none absolute z-[30] max-w-[280px] rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop" style={{ left: tip.x + 14, top: tip.y + 14 }}>
        <p className="font-medium">{tip.g.label}</p>
        {tip.g.detail ? <p className="mt-0.5 text-white/65">{tip.g.detail}</p> : null}
        <p className="mt-1 text-white/45">Documented link · click to open the record</p>
      </div>
    ) : null}
    </>
  );
}
