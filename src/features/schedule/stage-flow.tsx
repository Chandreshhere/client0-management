"use client";

import type { ComponentType } from "react";
import { motion } from "motion/react";
import { CalendarBlank, CheckCircle, HourglassMedium, Receipt, SignIn, Stethoscope, Timer, type IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/**
 * Visit flow (ref 5 metro line): today's visits as stations in the order a visit moves through the
 * front desk. Lines join stations only because that is the documented order of a visit; each
 * station shows its count and the token (or booked time) of every visit in it, with how long they
 * have been there. Picking a chip focuses that visit on the board below.
 */

export type FlowKey = "expected" | "arrived" | "waiting" | "in-session" | "checkout" | "completed";

export type FlowChip = {
  id: string;
  /** token ("A-05") or booked time ("11:00") */
  label: string;
  /** "35 min", "in 10 min" … */
  sub?: string;
  /** visible words for the tone, never colour alone */
  tone?: "warning" | "danger";
  kind: "token" | "time" | "done";
  /** accessible description */
  title: string;
};

export type FlowStation = { key: FlowKey; label: string; count: number; chips: FlowChip[]; note?: string };

const ICONS: Record<FlowKey, ComponentType<IconProps>> = {
  expected: CalendarBlank,
  arrived: SignIn,
  waiting: HourglassMedium,
  "in-session": Stethoscope,
  checkout: Receipt,
  completed: CheckCircle,
};

const MAX_CHIPS = 4;

export function StageFlow({
  stations,
  notSeen,
  onStation,
  onChip,
  onNotSeen,
  className,
}: {
  stations: FlowStation[];
  notSeen: { count: number; detail: string };
  onStation: (key: FlowKey) => void;
  onChip: (key: FlowKey, id: string) => void;
  onNotSeen: () => void;
  className?: string;
}) {
  return (
    <ol className={cn("relative grid grid-cols-1 gap-0 md:grid-cols-6 md:gap-2", className)} aria-label="Visit flow">
      {stations.map((st, i) => {
        const Icon = ICONS[st.key];
        const filled = st.count > 0;
        const last = i === stations.length - 1;
        const shown = st.chips.slice(0, MAX_CHIPS);
        const more = st.chips.length - shown.length;
        return (
          <li key={st.key} className="relative flex gap-4 pb-6 md:flex-col md:gap-3 md:pb-0">
            {/* rail: vertical on phones, horizontal from md */}
            {!last ? (
              <span aria-hidden="true" className="absolute left-5 top-10 h-[calc(100%-40px)] w-0.5 -translate-x-1/2 rounded-full bg-line-strong md:left-10 md:right-[-8px] md:top-5 md:h-0.5 md:w-auto md:translate-x-0 md:-translate-y-1/2" />
            ) : null}
            <button
              type="button"
              onClick={() => onStation(st.key)}
              aria-label={`${st.label}: ${st.count}. Show on the board`}
              className={cn(
                "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-[transform,background-color] duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-105 focus-visible:shadow-[0_0_0_3px_var(--color-primary)]",
                filled ? "bg-charcoal text-white" : "bg-surface text-muted shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
              )}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="flex items-baseline gap-2">
                <motion.span key={st.count} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className={cn("text-[28px] font-light leading-none tracking-[-0.02em]", filled ? "text-ink" : "text-faint")}>
                  {st.count}
                </motion.span>
                <span className="truncate text-sm text-ink-2">{st.label}</span>
              </p>
              {st.note ? <p className="-mt-1 truncate text-xs text-muted">{st.note}</p> : null}
              {shown.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {shown.map((c) => (
                    <li key={c.id} className="max-w-full">
                      <button
                        type="button"
                        title={c.title}
                        aria-label={`${c.title}. Show on the board`}
                        onClick={() => onChip(st.key, c.id)}
                        className={cn(
                          "inline-flex h-7 max-w-full items-center gap-2 rounded-full pl-1 pr-3 text-xs outline-none transition-[box-shadow,transform] duration-200 hover:-translate-y-px focus-visible:shadow-[0_0_0_2px_var(--color-primary)]",
                          c.kind === "done" ? "bg-sunken text-muted" : "bg-sunken text-ink-2 hover:bg-sunken-2",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-5 shrink-0 items-center rounded-full px-2 font-mono text-[11px] tabular",
                            c.kind === "token" ? "bg-charcoal text-white" : c.kind === "done" ? "bg-surface text-muted" : "bg-surface text-ink",
                          )}
                        >
                          {c.label}
                        </span>
                        {c.sub ? (
                          <span className={cn("inline-flex min-w-0 items-center gap-1 truncate", c.tone === "danger" ? "text-danger" : c.tone === "warning" ? "text-warning" : "")}>
                            {c.tone ? <Timer size={12} aria-hidden="true" className="shrink-0" /> : null}
                            {c.sub}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {more > 0 ? (
                    <li>
                      <button type="button" onClick={() => onStation(st.key)} className="inline-flex h-7 items-center rounded-full px-2 text-xs text-muted outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--color-primary)]">
                        +{more} more
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-xs text-faint">{st.key === "expected" ? "Everyone has arrived" : "None"}</p>
              )}
              {st.key === "expected" && notSeen.count > 0 ? (
                <button
                  type="button"
                  onClick={onNotSeen}
                  className="group/ns mt-1 flex items-start gap-2 self-start rounded-[12px] text-left text-xs outline-none focus-visible:shadow-[0_0_0_2px_var(--color-primary)]"
                >
                  <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-bl-[8px] border-b-2 border-l-2 border-line-strong" />
                  <span>
                    <span className="text-ink-2 group-hover/ns:text-ink">{notSeen.count} not seen</span>
                    <span className="block text-muted">{notSeen.detail}</span>
                  </span>
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
