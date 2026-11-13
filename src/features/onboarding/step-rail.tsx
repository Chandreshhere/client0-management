"use client";

import { LayoutGroup, motion } from "motion/react";
import type { Icon } from "@phosphor-icons/react";
import { Buildings, Check, ClipboardText, Clock, ListChecks, Package, UsersThree, Warning } from "@phosphor-icons/react";
import { ProgressBar } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { STEPS, type StepId } from "./model";

export type StepState = "complete" | "current" | "attention" | "upcoming" | "available";

const ICONS: Record<StepId, Icon> = { clinic: Buildings, plan: Package, services: ClipboardText, team: UsersThree, hours: Clock, review: ListChecks };

const STATE_TEXT: Record<StepState, string> = {
  complete: "Done",
  current: "Current step",
  attention: "Needs attention",
  upcoming: "Not started",
  available: "Ready",
};

/**
 * Step list (desktop): completed / current / upcoming at a glance, in the reference's
 * recessed-grey container. The white "current" inset slides between steps with a spring.
 */
export function StepRail({
  step,
  reached,
  states,
  summaries,
  onSelect,
  footer,
}: {
  step: number;
  reached: number;
  states: StepState[];
  summaries: string[];
  onSelect: (i: number) => void;
  footer?: React.ReactNode;
}) {
  const done = states.filter((s) => s === "complete").length;
  return (
    <nav aria-label="Setup steps" className="rounded-card bg-sunken p-2">
      <div className="px-2 pb-4 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-ink">Clinic setup</p>
          <p className="text-xs text-muted tabular">
            {done} of {STEPS.length - 1} done
          </p>
        </div>
        <ProgressBar value={done} max={STEPS.length - 1} tone="dark" label="Setup progress" className="mt-3 bg-sunken-2" />
      </div>
      <LayoutGroup id="onboarding-rail">
        <ol className="flex flex-col gap-1">
          {STEPS.map((s, i) => {
            const state = states[i];
            const Glyph = ICONS[s.id];
            const locked = i > reached;
            const current = i === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  disabled={locked || current}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}. ${STATE_TEXT[state]}${summaries[i] ? `. ${summaries[i]}` : ""}`}
                  data-testid={`rail-${s.id}`}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-inner p-2 text-left transition-colors duration-200",
                    !locked && !current && "hover:bg-surface/60",
                    locked && "cursor-not-allowed",
                    current && "cursor-default",
                  )}
                >
                  {current ? <motion.span layoutId="rail-current" transition={snappy} className="absolute inset-0 rounded-inner bg-surface" /> : null}
                  <span
                    className={cn(
                      "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]",
                      state === "current" && "bg-charcoal text-white",
                      state === "complete" && "bg-surface text-ink",
                      state === "attention" && "bg-warning-soft text-warning",
                      (state === "upcoming" || state === "available") && "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                    )}
                  >
                    {state === "complete" ? <Check weight="bold" /> : state === "attention" ? <Warning /> : <Glyph />}
                  </span>
                  <span className="relative z-[1] min-w-0 flex-1">
                    <span className={cn("block text-sm", locked ? "text-muted" : "text-ink")}>{s.label}</span>
                    <span className={cn("block truncate text-xs", state === "attention" ? "text-warning" : "text-muted")}>
                      {state === "attention" ? STATE_TEXT.attention : summaries[i]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </LayoutGroup>
      {footer ? <div className="px-2 pb-2 pt-4 text-xs text-muted">{footer}</div> : null}
    </nav>
  );
}

/** Compact progress for small screens: six segments (the page eyebrow names the step). */
export function MobileProgress({ step, states }: { step: number; states: StepState[] }) {
  return (
    <div className="lg:hidden">
      <div className="grid grid-cols-6 gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn("h-1 rounded-full transition-colors duration-300", states[i] === "attention" ? "bg-warning" : i <= step || states[i] === "complete" ? "bg-charcoal" : "bg-sunken-2")}
          />
        ))}
      </div>
    </div>
  );
}
