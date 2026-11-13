"use client";

import { useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tooltip";

/**
 * Static 3D organ renders (pre-rendered by scripts/render-organs.mjs from the organ shader) and
 * the compositions from references 3 & 6: organ hero with glass rings + hotspots, and the
 * "My Body Condition" carousel (grey clay = not selected, colour = selected).
 */
import { ORGAN_LABEL, type OrganKind } from "@/data/anatomy";
export { ORGAN_LABEL, type OrganKind };

export function OrganImage({ kind, variant = "color", className, alt }: { kind: OrganKind; variant?: "color" | "grey"; className?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small pre-rendered WebP with alpha
    <img src={`/organs/${kind}-${variant}.webp`} alt={alt ?? ""} aria-hidden={alt ? undefined : true} draggable={false} className={cn("pointer-events-none select-none object-contain", className)} />
  );
}

export type Hotspot = { id: string; x: number; y: number; label: string; detail?: string; active?: boolean; onClick?: () => void };

/**
 * Organ hero (ref 3): large organ inside translucent concentric rings, white hotspot dots with
 * tooltips, and a slot for a floating glass metric card. `x`/`y` are percentages of the box.
 */
export function OrganHero({
  kind,
  hotspots = [],
  children,
  className,
  label,
}: {
  kind: OrganKind;
  hotspots?: Hotspot[];
  children?: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("relative aspect-square w-full", className)} role="group" aria-label={label}>
      <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-white/35 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.9),0_40px_80px_-40px_rgb(33_38_34/0.25)]" />
      <div aria-hidden="true" className="absolute inset-[18%] rounded-full bg-white/45 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.95)]" />
      <div className="absolute inset-[4%] flex items-center justify-center [animation:organ-float_7s_ease-in-out_infinite]">
        <OrganImage kind={kind} variant="color" className="h-[92%] w-[92%] drop-shadow-[0_30px_40px_rgba(140,20,30,0.25)]" alt={label} />
      </div>
      {hotspots.map((h) => (
        <Tip key={h.id} label={<span><span className="block">{h.label}</span>{h.detail ? <span className="text-white/60">{h.detail}</span> : null}</span>}>
          <button
            type="button"
            onClick={h.onClick}
            aria-label={h.detail ? `${h.label}: ${h.detail}` : h.label}
            className={cn("group absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full", h.active && "z-[2]")}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            <span className="absolute inset-0 rounded-full bg-white/50 animate-pulse-ring" aria-hidden="true" />
            <span className={cn("relative size-3.5 rounded-full shadow-[0_2px_8px_rgb(0_0_0/0.18)] ring-[3px] transition-transform duration-200 group-hover:scale-125", h.active ? "bg-primary ring-white" : "bg-white ring-white/60")} />
          </button>
        </Tip>
      ))}
      {children}
    </div>
  );
}

/** Frosted floating card used on top of organ heroes (ref 3 "Heart Rate 120 bpm"). */
export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[20px] bg-white/90 p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.9),0_20px_40px_-20px_rgb(33_38_34/0.3)]", className)}>{children}</div>
  );
}

/** "My Body Condition" carousel (ref 3). */
export function OrganCarousel({
  items,
  selected,
  onSelect,
  title = "My Body Condition",
  className,
}: {
  items: { kind: OrganKind; label?: string; note?: string }[];
  selected: OrganKind;
  onSelect: (k: OrganKind) => void;
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  return (
    <section className={className} aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm text-ink">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {title}
        </h2>
        <div className="flex gap-1">
          <IconButton label="Scroll left" size="sm" variant="ghost" onClick={() => scroll(-1)}>
            <ArrowLeft />
          </IconButton>
          <IconButton label="Scroll right" size="sm" variant="ghost" onClick={() => scroll(1)}>
            <ArrowRight />
          </IconButton>
        </div>
      </div>
      <div ref={ref} className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {items.map((it) => {
          const active = it.kind === selected;
          return (
            <button
              key={it.kind}
              type="button"
              onClick={() => onSelect(it.kind)}
              aria-pressed={active}
              className={cn(
                "relative flex h-[168px] w-[148px] shrink-0 snap-start flex-col overflow-hidden rounded-card bg-surface p-3 text-left transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)]",
                active ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:-translate-y-0.5",
              )}
            >
              <OrganImage kind={it.kind} variant={active ? "color" : "grey"} className="mx-auto h-[104px] w-[104px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)]" />
              <span className="mt-auto flex items-end justify-between gap-2">
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs", active ? "text-ink" : "text-muted")}>{it.label ?? ORGAN_LABEL[it.kind]}</span>
                  {it.note ? <span className="block truncate text-[11px] text-faint">{it.note}</span> : null}
                </span>
                {active ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white" aria-hidden="true">
                    <ArrowUpRight size={14} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
