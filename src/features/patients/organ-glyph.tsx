"use client";

import { cn } from "@/lib/cn";
import type { Patient } from "@/data/types";
import { OrganImage } from "@/components/viz/organ";
import { Tip } from "@/components/ui/tooltip";
import { organMeaning, primaryConditionOf } from "./anatomy";

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 28px organ glyph for the registry: the organ of the patient's lead body system, taken from
 * their recorded conditions (never a default heart). The tooltip and screen-reader text say why
 * that organ is shown. Patients with nothing classifiable recorded get an empty dashed ring.
 */
export function OrganGlyph({ patient, className }: { patient: Pick<Patient, "conditions">; className?: string }) {
  const pc = primaryConditionOf(patient);
  if (!pc) {
    const why = patient.conditions.length ? "Recorded conditions aren't mapped to a body system yet" : "No condition recorded yet — no organ to show";
    return (
      <Tip label={why}>
        <span tabIndex={0} className={cn("inline-flex size-7 shrink-0 rounded-full border border-dashed border-line-strong", focusRing, className)}>
          <span className="sr-only">{why}</span>
        </span>
      </Tip>
    );
  }
  const meaning = organMeaning(pc);
  return (
    <Tip label={meaning}>
      <span tabIndex={0} className={cn("inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas", focusRing, className)}>
        <OrganImage kind={pc.organ} className="size-7 scale-[1.35]" />
        <span className="sr-only">{meaning}</span>
      </span>
    </Tip>
  );
}

/**
 * Primary-condition chip for the dark browse list (ref 2): organ glyph + the condition that
 * selected it, "+N" when more conditions are recorded. Text only — no tooltip — because the row
 * itself is the control.
 */
export function ConditionChip({ patient, tone = "dark", className }: { patient: Pick<Patient, "conditions">; tone?: "dark" | "light"; className?: string }) {
  const pc = primaryConditionOf(patient);
  const dark = tone === "dark";
  if (!pc) {
    return (
      <span
        className={cn(
          "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-dashed px-2.5 text-[11px]",
          dark ? "border-white/25 text-white/55" : "border-line-strong text-muted",
          className,
        )}
      >
        No condition recorded
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-full pl-0.5 pr-2.5 text-[11px]",
        dark ? "bg-white/10 text-white/85" : "bg-sunken text-ink-2",
        className,
      )}
    >
      <span className={cn("flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full", dark ? "bg-white/90" : "bg-surface")} aria-hidden="true">
        <OrganImage kind={pc.organ} className="size-5 scale-[1.35]" />
      </span>
      <span className="truncate">{pc.condition}</span>
      {pc.others > 0 ? <span className={cn("shrink-0 tabular", dark ? "text-white/50" : "text-muted")}>+{pc.others}</span> : null}
      <span className="sr-only"> · {pc.organLabel}, {pc.systemName} system</span>
    </span>
  );
}
