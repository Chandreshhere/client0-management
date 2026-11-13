"use client";

import { Check, Circle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { Strength } from "./validation";

const SEGMENT_TONE: Record<number, string> = {
  1: "bg-danger",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

/**
 * Four-segment meter + a spoken label. Colour is never the only signal: the label names the
 * score and the checklist names what is missing.
 */
export function PasswordStrength({ strength, id, className }: { strength: Strength; id: string; className?: string }) {
  const { score, label, advice, checks } = strength;
  return (
    <div id={id} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1 overflow-hidden rounded-full bg-sunken">
              <span
                className={cn(
                  "block h-full origin-left rounded-full transition-transform duration-500 [transition-timing-function:var(--ease-spring)]",
                  SEGMENT_TONE[score] ?? "bg-sunken",
                  i <= score ? "scale-x-100" : "scale-x-0",
                )}
              />
            </span>
          ))}
        </div>
        <span className="w-[72px] shrink-0 text-right text-xs text-ink-2">{label}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        Password strength: {label}. {advice}
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {checks.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-1.5 text-xs", c.met ? "text-ink-2" : "text-muted")}>
            {c.met ? <Check size={12} weight="bold" className="text-success" aria-hidden="true" /> : <Circle size={12} className="text-faint" aria-hidden="true" />}
            <span>
              {c.label}
              <span className="sr-only">{c.met ? " — done" : " — not yet"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
