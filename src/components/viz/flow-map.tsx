"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowsIn, Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Tip } from "@/components/ui/tooltip";

/**
 * Journey flow map (refs 2 & 5): event nodes placed on a canvas, joined by rounded orthogonal
 * connectors ("metro map"). Drag the background to pan, ± to zoom, ⤢ to fit, arrow keys pan
 * when focused. A minimap shows the whole journey with a draggable viewport window.
 * Connectors represent documented associations, not causation (doc §6).
 */
export type FlowNode = { id: string; x: number; y: number; width?: number; content: ReactNode; className?: string };
export type FlowEdge = { from: string; to: string; tone?: "primary" | "muted"; label?: string; detail?: string };

type Rect = { x: number; y: number; w: number; h: number };

function hPath(sx: number, sy: number, tx: number, ty: number, r = 18) {
  if (Math.abs(ty - sy) < 1) return `M${sx},${sy}H${tx}`;
  const mx = sx + Math.max(20, (tx - sx) / 2);
  const rr = Math.max(0, Math.min(r, Math.abs(ty - sy) / 2, mx - sx, tx - mx));
  const d = ty > sy ? 1 : -1;
  return `M${sx},${sy}H${mx - rr}Q${mx},${sy} ${mx},${sy + d * rr}V${ty - d * rr}Q${mx},${ty} ${mx + rr},${ty}H${tx}`;
}

function vPath(sx: number, sy: number, tx: number, ty: number, r = 18) {
  if (Math.abs(tx - sx) < 1) return `M${sx},${sy}V${ty}`;
  const my = (sy + ty) / 2;
  const dy = ty > sy ? 1 : -1;
  const dx = tx > sx ? 1 : -1;
  const rr = Math.max(0, Math.min(r, Math.abs(tx - sx) / 2, Math.abs(my - sy)));
  return `M${sx},${sy}V${my - dy * rr}Q${sx},${my} ${sx + dx * rr},${my}H${tx - dx * rr}Q${tx},${my} ${tx},${my + dy * rr}V${ty}`;
}

export function FlowMap({
  nodes,
  edges,
  width,
  height,
  axis,
  rows,
  columns,
  viewportHeight = 560,
  minimap = true,
  className,
  label,
  toolbar,
  initialFocusX,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
  /** labels pinned to the right edge of the world, e.g. months (ref 5) */
  axis?: { y: number; label: string; strong?: boolean }[];
  /** lane labels pinned to the left edge (stay visible while panning horizontally) */
  rows?: { y: number; label: string; hint?: string }[];
  /** column labels pinned to the top edge (e.g. months) with faint guide lines */
  columns?: { x: number; label: string; strong?: boolean }[];
  viewportHeight?: number;
  minimap?: boolean;
  className?: string;
  label: string;
  toolbar?: ReactNode;
  /** world x to bring into view on first render (e.g. the latest event) */
  initialFocusX?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [vw, setVw] = useState(800);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; detail?: string; id: string } | null>(null);

  // measure the viewport and every node (sizes drive connector anchors)
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVw(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || initialFocusX === undefined || vw <= 0) return;
    focused.current = true;
    setPan({ x: Math.min(0, Math.max(vw - width - 40, -(initialFocusX - vw * 0.55))), y: 0 });
  }, [initialFocusX, vw, width]);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      const next: Record<string, { w: number; h: number }> = {};
      nodeEls.current.forEach((el, id) => (next[id] = { w: el.offsetWidth, h: el.offsetHeight }));
      setSizes(next);
    });
    nodeEls.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [nodes]);

  const rects = useMemo(() => {
    const out: Record<string, Rect> = {};
    for (const n of nodes) out[n.id] = { x: n.x, y: n.y, w: sizes[n.id]?.w ?? n.width ?? 160, h: sizes[n.id]?.h ?? 56 };
    return out;
  }, [nodes, sizes]);

  const paths = useMemo(
    () =>
      edges
        .map((e, i) => {
          const a = rects[e.from], b = rects[e.to];
          if (!a || !b) return null;
          const forward = b.x >= a.x + a.w + 24;
          const up = b.y + b.h <= a.y;
          // forward: right side → left side; otherwise vertical between the facing edges
          const start = forward ? { x: a.x + a.w, y: a.y + a.h / 2 } : { x: a.x + a.w / 2, y: up ? a.y : a.y + a.h };
          const end = forward ? { x: b.x, y: b.y + b.h / 2 } : { x: b.x + b.w / 2, y: up ? b.y + b.h : b.y };
          const d = forward ? hPath(start.x, start.y, end.x, end.y) : vPath(start.x, start.y, end.x, end.y);
          return { id: `${e.from}-${e.to}-${i}`, d, tone: e.tone ?? "primary", start, end, label: e.label, detail: e.detail };
        })
        .filter(Boolean) as { id: string; d: string; tone: "primary" | "muted"; start: { x: number; y: number }; end: { x: number; y: number }; label?: string; detail?: string }[],
    [edges, rects],
  );

  const clampPan = useCallback(
    (p: { x: number; y: number }, z = zoom) => ({
      x: Math.min(40, Math.max(Math.min(0, vw - width * z - 40), p.x)),
      y: Math.min(40, Math.max(Math.min(0, viewportHeight - height * z - 40), p.y)),
    }),
    [vw, width, height, viewportHeight, zoom],
  );

  const setZoomAround = (z: number) => {
    const nz = Math.max(0.5, Math.min(1.5, z));
    const cx = vw / 2, cy = viewportHeight / 2;
    const wx = (cx - pan.x) / zoom, wy = (cy - pan.y) / zoom;
    setZoom(nz);
    setPan(clampPan({ x: cx - wx * nz, y: cy - wy * nz }, nz));
  };
  const fit = () => {
    const nz = Math.max(0.5, Math.min(1, (vw - 32) / width, (viewportHeight - 32) / height));
    setZoom(nz);
    setPan({ x: 16, y: 16 });
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-flow-node],[data-flow-ui]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPan(clampPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
  };
  const onUp = () => (drag.current = null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 60;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (map[e.key] && e.target === e.currentTarget) {
      e.preventDefault();
      setPan((p) => clampPan({ x: p.x + map[e.key][0], y: p.y + map[e.key][1] }));
    }
    if (e.key === "+" || e.key === "=") setZoomAround(zoom + 0.1);
    if (e.key === "-") setZoomAround(zoom - 0.1);
  };

  // minimap geometry
  const MW = 200;
  const ms = MW / width;
  const MH = Math.round(height * ms);
  const view = { x: -pan.x / zoom, y: -pan.y / zoom, w: vw / zoom, h: viewportHeight / zoom };
  const mDrag = useRef(false);
  const moveTo = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - r.left) / ms, wy = (e.clientY - r.top) / ms;
    setPan(clampPan({ x: -(wx - view.w / 2) * zoom, y: -(wy - view.h / 2) * zoom }));
  };

  return (
    <div
      ref={outer}
      tabIndex={0}
      role="group"
      aria-label={`${label}. Drag to pan; use arrow keys to move and plus or minus to zoom.`}
      onKeyDown={onKey}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      data-lenis-prevent-wheel
      className={cn(
        "relative cursor-grab touch-none select-none overflow-hidden rounded-card bg-canvas outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-primary",
        "bg-[radial-gradient(circle,rgb(33_38_34/0.07)_1px,transparent_1.2px)] [background-size:24px_24px]",
        className,
      )}
      style={{ height: viewportHeight }}
    >
      <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width, height, transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}>
        {columns?.map((c) => (
          <span key={`g-${c.x}`} aria-hidden="true" className="absolute top-0 h-full w-px bg-ink/[0.06]" style={{ left: c.x }} />
        ))}
        <svg width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {paths.map((p) => (
            <g key={p.id}>
              {p.label ? (
                <path
                  d={p.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ pointerEvents: "stroke" }}
                  onPointerEnter={(ev) => {
                    const r = outer.current!.getBoundingClientRect();
                    setTip({ x: ev.clientX - r.left, y: ev.clientY - r.top, label: p.label!, detail: p.detail, id: p.id });
                  }}
                  onPointerMove={(ev) => {
                    const r = outer.current!.getBoundingClientRect();
                    setTip({ x: ev.clientX - r.left, y: ev.clientY - r.top, label: p.label!, detail: p.detail, id: p.id });
                  }}
                  onPointerLeave={() => setTip(null)}
                />
              ) : null}
              <path d={p.d} pathLength={1} fill="none" stroke={p.tone === "primary" ? "var(--color-primary)" : "var(--color-line-strong)"} strokeWidth={tip?.id === p.id ? 2.5 : p.tone === "primary" ? 1.5 : 1.25} strokeLinecap="round" className="connector-path" />
              <circle cx={p.start.x} cy={p.start.y} r={3.5} fill={p.tone === "primary" ? "var(--color-primary)" : "var(--color-line-strong)"} stroke="var(--color-canvas)" strokeWidth={2} />
              <circle cx={p.end.x} cy={p.end.y} r={3.5} fill={p.tone === "primary" ? "var(--color-primary)" : "var(--color-line-strong)"} stroke="var(--color-canvas)" strokeWidth={2} />
            </g>
          ))}
        </svg>
        {axis?.map((a) => (
          <span key={a.label + a.y} className={cn("absolute right-4 text-xs", a.strong ? "text-ink" : "text-muted")} style={{ top: a.y }}>
            {a.label}
          </span>
        ))}
        {nodes.map((n) => (
          <div
            key={n.id}
            data-flow-node
            ref={(el) => {
              if (el) nodeEls.current.set(n.id, el);
              else nodeEls.current.delete(n.id);
            }}
            className={cn("absolute cursor-default", n.className)}
            style={{ left: n.x, top: n.y, width: n.width }}
          >
            {n.content}
          </div>
        ))}
      </div>

      {rows?.map((r) => (
        <div key={r.label} data-flow-ui title={r.hint} className="pointer-events-none absolute left-3 z-[3] -translate-y-1/2 rounded-full bg-canvas/95 px-3 py-1 text-[11px] text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] backdrop-blur" style={{ top: r.y * zoom + pan.y }}>
          {r.label}
        </div>
      ))}
      {columns ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-9 bg-gradient-to-b from-canvas via-canvas/90 to-transparent">
          {columns.map((c) => (
            <span key={c.label + c.x} className={cn("absolute top-2.5 text-[11px]", c.strong ? "font-medium text-ink" : "text-muted")} style={{ left: c.x * zoom + pan.x + 6 }}>
              {c.label}
            </span>
          ))}
        </div>
      ) : null}
      {tip ? (
        <div className="pointer-events-none absolute z-[5] max-w-[300px] rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop" style={{ left: Math.min(tip.x + 14, vw - 300), top: tip.y + 14 }}>
          <p className="font-medium">{tip.label}</p>
          {tip.detail ? <p className="mt-0.5 text-white/65">{tip.detail}</p> : null}
        </div>
      ) : null}

      <div data-flow-ui className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        {toolbar}
        <Tip label="Zoom in" side="left">
          <button type="button" aria-label="Zoom in" onClick={() => setZoomAround(zoom + 0.15)} className="flex size-10 items-center justify-center rounded-full bg-charcoal text-white active:scale-95">
            <Plus size={16} />
          </button>
        </Tip>
        <Tip label="Zoom out" side="left">
          <button type="button" aria-label="Zoom out" onClick={() => setZoomAround(zoom - 0.15)} className="flex size-10 items-center justify-center rounded-full bg-charcoal text-white active:scale-95">
            <Minus size={16} />
          </button>
        </Tip>
        <Tip label="Fit to view" side="left">
          <button type="button" aria-label="Fit to view" onClick={fit} className="flex size-10 items-center justify-center rounded-full bg-primary text-white active:scale-95">
            <ArrowsIn size={16} />
          </button>
        </Tip>
      </div>

      {minimap ? (
        <div data-flow-ui className="absolute bottom-3 left-3 hidden rounded-[18px] bg-[rgb(120_126_122/0.55)] p-2 shadow-pop backdrop-blur-md sm:block">
          <div
            className="relative cursor-pointer overflow-hidden rounded-[12px]"
            style={{ width: MW, height: MH }}
            onPointerDown={(e) => {
              mDrag.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              moveTo(e);
            }}
            onPointerMove={(e) => mDrag.current && moveTo(e)}
            onPointerUp={() => (mDrag.current = false)}
            aria-hidden="true"
          >
            {nodes.map((n) => {
              const r = rects[n.id];
              return <span key={n.id} className="absolute rounded-full bg-white/60" style={{ left: r.x * ms, top: r.y * ms, width: Math.max(4, r.w * ms), height: Math.max(3, r.h * ms * 0.7) }} />;
            })}
            <span className="absolute rounded-[6px] bg-white/25 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.9)]" style={{ left: view.x * ms, top: view.y * ms, width: Math.min(MW, view.w * ms), height: Math.min(MH, view.h * ms) }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Node chrome for flow maps: pill (ref 5 small events) and card (ref 2 visit cards). */
export function FlowPill({ icon, title, meta, time, tone = "white", onClick }: { icon: ReactNode; title: string; meta?: string; time?: string; tone?: "white" | "sunken"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-2.5 rounded-full pl-1.5 pr-4 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5",
        tone === "white" ? "bg-surface shadow-[0_1px_2px_rgb(33_38_34/0.06)]" : "bg-sunken",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-ink">{title}</span>
        {meta ? <span className="block truncate text-[11px] text-muted">{meta}</span> : null}
      </span>
      {time ? <span className="shrink-0 text-[11px] text-muted tabular">{time}</span> : null}
    </button>
  );
}
