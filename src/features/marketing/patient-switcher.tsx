"use client";

import { LayoutGroup, motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { OrganImage } from "@/components/viz/organ";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { PROOF_PATIENTS } from "./care-map-model";

/**
 * Patient picker for the public proofs: one pill per synthetic patient, showing the organ their
 * record opens on (from their conditions, never a fixed heart). Selected = sliding charcoal pill.
 * Radiogroup semantics with roving tabindex and arrow-key movement.
 */
export function PatientSwitcher({ value, onChange, className, label = "Synthetic patient" }: { value: string; onChange: (id: string) => void; className?: string; label?: string }) {
  const group = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in step) next = (i + step[e.key] + PROOF_PATIENTS.length) % PROOF_PATIENTS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = PROOF_PATIENTS.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(PROOF_PATIENTS[next].patient.id);
    refs.current[next]?.focus();
  };

  return (
    <LayoutGroup id={group}>
      <div className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0", className)} data-lenis-prevent>
        <div role="radiogroup" aria-label={label} className="flex w-max gap-1 rounded-full bg-sunken p-1">
          {PROOF_PATIENTS.map((p, i) => {
            const on = p.patient.id === value;
            return (
              <button
                key={p.patient.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onChange(p.patient.id)}
                onKeyDown={(e) => onKey(e, i)}
                aria-label={`${p.patient.name}, ${p.lead.name} — ${p.organLabel}`}
                className={cn("relative flex h-12 items-center gap-2 rounded-full pl-1 pr-2 text-left transition-colors duration-200", on ? "text-white" : "text-ink-2 hover:text-ink")}
              >
                {on ? <motion.span layoutId="proof-patient-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                <Avatar src={p.patient.avatar} name={p.patient.name} size="md" loading="eager" className="relative z-[1]" />
                <span className="relative z-[1] min-w-0">
                  <span className="block whitespace-nowrap text-sm leading-tight">{p.patient.name.split(" ")[0]}</span>
                  <span className={cn("block whitespace-nowrap text-[11px] leading-tight", on ? "text-white/70" : "text-muted")}>{p.lead.short.length <= 16 ? p.lead.short : p.lead.name.split(/[ (]/)[0]}</span>
                </span>
                <span aria-hidden="true" className={cn("relative z-[1] ml-1 flex size-10 items-center justify-center rounded-full", on ? "bg-white/90" : "bg-surface")}>
                  <OrganImage kind={p.organ} variant="color" className="size-8" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </LayoutGroup>
  );
}
