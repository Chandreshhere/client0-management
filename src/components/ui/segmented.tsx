"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";

/**
 * Pill tabs with the reference's charcoal selected pill. The indicator slides between options
 * with a spring (shared layoutId). Two flavours:
 * - <Segmented>: a radiogroup-like toggle for local view state.
 * - <PillNav>: links (route tabs) — used in the header and in-page sub-navigation.
 */
type Item<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; count?: number };

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
  variant = "loose",
}: {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
  /** loose: separate pills like the reference header; tray: pills inside a grey tray */
  variant?: "loose" | "tray";
}) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div role="radiogroup" aria-label={ariaLabel} className={cn("flex items-center gap-1", variant === "tray" && "rounded-full bg-sunken p-1", className)}>
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(it.value)}
              className={cn(
                "relative inline-flex items-center gap-2 whitespace-nowrap rounded-full font-normal transition-colors duration-200",
                size === "sm" ? "h-8 px-3 text-xs [&_svg]:size-4" : "h-10 px-4 text-sm [&_svg]:size-[18px]",
                active ? "text-white" : variant === "loose" ? "text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface hover:text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {active ? <motion.span layoutId="seg-indicator" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
              <span className="relative z-[1] inline-flex items-center gap-2">
                {it.icon}
                {it.label}
                {typeof it.count === "number" ? (
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular", active ? "bg-white/20" : "bg-sunken")}>{it.count}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function PillNav({
  items,
  activeHref,
  ariaLabel,
  className,
  layoutKey = "pillnav",
}: {
  items: { href: string; label: ReactNode; count?: number }[];
  activeHref: string | null;
  ariaLabel: string;
  className?: string;
  layoutKey?: string;
}) {
  return (
    <LayoutGroup id={layoutKey}>
      <nav aria-label={ariaLabel} className={cn("flex items-center gap-1", className)}>
        {items.map((it) => {
          const active = it.href === activeHref;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-200",
                active ? "text-white" : "bg-sunken/0 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface hover:text-ink",
              )}
            >
              {active ? <motion.span layoutId={`${layoutKey}-indicator`} transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
              <span className="relative z-[1]">{it.label}</span>
              {typeof it.count === "number" ? (
                <span className={cn("relative z-[1] rounded-full px-1.5 text-[11px] tabular", active ? "bg-white/20" : "bg-sunken")}>{it.count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
