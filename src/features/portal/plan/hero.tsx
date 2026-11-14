"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { pluralize } from "@/lib/format";
import type { OrganKind } from "@/data/anatomy";
import type { Condition } from "@/data/featured";
import { Pill } from "@/components/ui/pill";
import { Tip } from "@/components/ui/tooltip";
import { GlassCard } from "@/components/viz/organ";
import { OrganCanvas } from "@/features/patient/organ-canvas";
import { CONDITION_STATUS_PLAIN, SYSTEMS, conditionRecords, explain, type PortalSystem } from "../record";
import { longDate } from "../time";

/** Hotspot anchors (percent of the hero box) per organ model; conditions take them in order. */
/** Kept out of the bottom-left quadrant, where the glass card sits. */
const ANCHORS: Partial<Record<OrganKind, { x: number; y: number }[]>> = {
  heart: [{ x: 65, y: 52 }, { x: 50, y: 31 }, { x: 37, y: 40 }],
  brain: [{ x: 66, y: 46 }, { x: 44, y: 32 }, { x: 58, y: 26 }],
  lungs: [{ x: 68, y: 50 }, { x: 36, y: 38 }, { x: 52, y: 24 }],
};
const FALLBACK = [{ x: 64, y: 44 }, { x: 46, y: 30 }, { x: 70, y: 62 }];

/** Being treated = info dot · watched = neutral · resolved = success (always paired with words). */
const statusTone = (s: Condition["status"]) => (s === "Active" ? "bg-primary" : s === "Resolved" ? "bg-success" : "bg-faint");

/**
 * Reference 3 hero: the organ for the selected body system (live, morphing between systems),
 * concentric glass rings, one hotspot per recorded condition and a glass card explaining the
 * selected condition in plain words. Organ and hotspots both come from the patient's record.
 */
export function PlanHero({ system, conditionId, onSelectCondition }: { system: PortalSystem; conditionId: string; onSelectCondition: (id: string) => void }) {
  const titleId = useId();
  const anchors = ANCHORS[system.organ] ?? FALLBACK;
  const cond = system.conditions.find((c) => c.id === conditionId) ?? system.conditions[0];
  const records = cond ? conditionRecords(cond.id) : [];
  const lastRecord = records.at(-1);
  const blurb = cond ? explain(cond) : null;

  return (
    <section aria-labelledby={titleId} className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            Body system {SYSTEMS.findIndex((s) => s.id === system.id) + 1} of {SYSTEMS.length} on your record
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={system.id}
              id={titleId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={spring}
              className="mt-1 text-[32px] font-light leading-[1.05] tracking-[-0.02em] text-ink md:text-[40px]"
            >
              {system.area}
            </motion.h2>
          </AnimatePresence>
        </div>
        <Pill tone="instances">{pluralize(system.conditions.length, "condition")}</Pill>
      </div>

      {/* flex-1 + centred: when the tiles column beside it is taller, the organ sits in the middle of the
          spare height and the condition chips line up with the bottom of the column, instead of a gap under them. */}
      <div className="flex flex-1 flex-col justify-center">
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="relative aspect-square w-full">
            <div aria-hidden="true" className="absolute inset-[3%] rounded-full bg-white/45 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.95),0_40px_80px_-40px_rgb(33_38_34/0.22)]" />
            <div aria-hidden="true" className="absolute inset-[17%] rounded-full bg-white/55 shadow-[inset_0_0_0_1px_rgb(255_255_255)]" />
            <OrganCanvas shape={system.organ} tone="light" label={`3D illustration of the ${system.organLabel.toLowerCase()} — your ${system.area.toLowerCase()} record`} className="absolute inset-[5%]" />

            {system.conditions.map((c, i) => {
              const a = anchors[i % anchors.length];
              const active = c.id === cond?.id;
              return (
                <Tip key={c.id} label={<span><span className="block">{c.name}</span><span className="text-white/70">{CONDITION_STATUS_PLAIN[c.status]}</span></span>}>
                  <button
                    type="button"
                    onClick={() => onSelectCondition(c.id)}
                    aria-pressed={active}
                    aria-label={`${c.name} — ${CONDITION_STATUS_PLAIN[c.status]}`}
                    className="group absolute z-[2] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                    style={{ left: `${a.x}%`, top: `${a.y}%` }}
                  >
                    <span className="absolute inset-0 rounded-full bg-white/50 animate-pulse-ring" aria-hidden="true" />
                    <span
                      className={cn(
                        "relative size-3.5 rounded-full shadow-[0_2px_8px_rgb(0_0_0/0.18)] ring-[3px] transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-125",
                        active ? "scale-110 bg-charcoal ring-white" : "bg-white ring-white/60",
                      )}
                    />
                  </button>
                </Tip>
              );
            })}

          </div>
          {cond ? (
            <GlassCard className="relative z-[3] -mt-12 w-full p-4 sm:absolute sm:bottom-[2%] sm:left-0 sm:mt-0 sm:w-[min(272px,78%)]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={cond.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={snappy}>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={cn("size-1.5 shrink-0 rounded-full", statusTone(cond.status))} aria-hidden="true" />
                    <span className="min-w-0">
                      {CONDITION_STATUS_PLAIN[cond.status]} · <span className="whitespace-nowrap">since {longDate(`${cond.since}T12:00:00+05:30`)}</span>
                    </span>
                  </p>
                  <p className="mt-1 text-base text-ink">{cond.name}</p>
                  {blurb ? <p className="mt-2 text-xs leading-relaxed text-ink-2">{blurb}</p> : null}
                  <p className="mt-2 text-[11px] text-muted">
                    {pluralize(records.length, "released record")}
                    {lastRecord ? ` · latest ${longDate(`${lastRecord.date}T12:00:00+05:30`)}` : ""}
                  </p>
                </motion.div>
              </AnimatePresence>
            </GlassCard>
          ) : null}
        </div>
        {/* The two most recent released records for this condition: uses the height the taller
            tiles column leaves beside the organ, instead of empty bands above and below it. */}
        {records.length ? (
          <div className="mx-auto mt-4 w-full max-w-[520px]">
            <p className="mb-1.5 text-xs text-muted">Latest in your record</p>
            <ul className="flex flex-col gap-1.5">
              {records
                .slice(-2)
                .reverse()
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-surface/70 px-3 py-2 text-xs shadow-[inset_0_0_0_1px_var(--color-line)]">
                    <span className="min-w-0 truncate text-ink">{r.title}</span>
                    <span className="shrink-0 whitespace-nowrap text-muted">{longDate(`${r.date}T12:00:00+05:30`)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div role="radiogroup" aria-label={`Conditions in ${system.area}`} className="flex flex-wrap gap-2">
        {system.conditions.map((c) => {
          const active = c.id === cond?.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelectCondition(c.id)}
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs transition-colors duration-200",
                active ? "text-white" : "bg-surface/70 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface",
              )}
            >
              {active ? <motion.span layoutId={`cond-pill-${system.id}`} transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
              <span className={cn("relative z-[1] size-1.5 rounded-full", statusTone(c.status))} aria-hidden="true" />
              <span className="relative z-[1]">{c.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
