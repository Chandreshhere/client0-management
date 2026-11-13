"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowCounterClockwise, Check, WarningCircle } from "@phosphor-icons/react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { REFERRALS, REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import type { Referral, ReferralStage } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { spring } from "@/lib/motion";

/**
 * Referral handoff: Requested → Accepted → Booked → Completed → Acknowledged (doc §5B).
 * Three real fixtures: one stuck at Requested, one stuck at Accepted, one closed loop.
 * "Simulate next step" only changes this page's state, and says so.
 */

const SAMPLE_IDS = ["r3", "r4", "r1"] as const;
type SampleId = (typeof SAMPLE_IDS)[number];
const SAMPLES = SAMPLE_IDS.map((id) => REFERRALS.find((r) => r.id === id)!);
const NOW_ISO = "2026-11-13T09:40:00+05:30";
const DAY = 86_400_000;

const person = (id: string) => staffById(id)?.name ?? "Unassigned";
const firstName = (patientId: string) => patientById(patientId)?.name.split(" ")[0] ?? "Patient";

/** Who moves the referral into each stage. */
function ownerOf(r: Referral, stage: ReferralStage) {
  switch (stage) {
    case "requested":
    case "acknowledged":
      return person(r.fromId);
    case "accepted":
    case "completed":
      return person(r.toId);
    case "booked":
      return DEMO_USER.frontdesk.label;
  }
}

const daysBetween = (fromIso: string, to: Date = TODAY) => Math.max(0, Math.round((to.getTime() - new Date(fromIso).getTime()) / DAY));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function ReferralStepper() {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [sample, setSample] = useState<SampleId>("r3");
  const [reached, setReached] = useState<Record<SampleId, number>>(() =>
    Object.fromEntries(SAMPLES.map((r) => [r.id, REFERRAL_STAGES.indexOf(r.stage)])) as Record<SampleId, number>,
  );
  const [simulated, setSimulated] = useState<Record<SampleId, Partial<Record<ReferralStage, string>>>>({ r3: {}, r4: {}, r1: {} });

  const r = SAMPLES.find((x) => x.id === sample)!;
  const idx = reached[sample];
  const dates = { ...r.stageDates, ...simulated[sample] };
  const done = idx === REFERRAL_STAGES.length - 1;
  const current = REFERRAL_STAGES[idx];
  const next = done ? null : REFERRAL_STAGES[idx + 1];
  const since = dates[current];
  const waited = since ? daysBetween(since) : 0;
  const overdue = !done && new Date(r.dueBy).getTime() < TODAY.getTime() ? daysBetween(r.dueBy) : 0;
  const isSimulated = Object.keys(simulated[sample]).length > 0;
  const fill = reduce ? { duration: 0 } : spring;
  const waitedFor = waited === 0 ? "since today" : `for ${plural(waited, "day")}`;

  const advance = () => {
    if (!next) return;
    setReached((m) => ({ ...m, [sample]: idx + 1 }));
    setSimulated((m) => ({ ...m, [sample]: { ...m[sample], [next]: NOW_ISO } }));
    toast({ title: `${REFERRAL_STAGE_LABEL[next]} — simulated on this page`, description: "Nothing was sent. In the demo, referrals change only in your browser session." });
  };
  const reset = () => {
    setReached((m) => ({ ...m, [sample]: REFERRAL_STAGES.indexOf(r.stage) }));
    setSimulated((m) => ({ ...m, [sample]: {} }));
  };

  return (
    <div className="rounded-card bg-surface p-2">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none" data-lenis-prevent>
          <Segmented
            variant="tray"
            size="sm"
            ariaLabel="Example referral"
            value={sample}
            onChange={setSample}
            className="w-max"
            items={SAMPLES.map((x) => ({
              value: x.id as SampleId,
              label: (
                <>
                  {firstName(x.patientId)}
                  <span className="hidden sm:inline"> → {DISCIPLINE_LABEL[x.toDiscipline]}</span>
                </>
              ),
            }))}
          />
        </div>
        <div className="flex items-center gap-2">
          {isSimulated ? (
            <Button variant="ghost" size="sm" leading={<ArrowCounterClockwise />} onClick={reset}>
              Reset
            </Button>
          ) : null}
          <Button variant="dark" size="sm" onClick={advance} disabled={done}>
            {done ? "Loop closed" : `Simulate: ${REFERRAL_STAGE_LABEL[next ?? "acknowledged"].toLowerCase()}`}
          </Button>
        </div>
      </div>

      <div className="rounded-inner bg-canvas p-4 md:p-6">
        {/* referral header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar src={patientById(r.patientId)?.avatar} name={patientById(r.patientId)?.name ?? "Patient"} size="md" loading="eager" />
            <div className="min-w-0">
              <p className="text-base text-ink">{patientById(r.patientId)?.name}</p>
              <p className="text-xs text-muted">
                {person(r.fromId)} → {person(r.toId)} · {DISCIPLINE_LABEL[r.toDiscipline]}
              </p>
              <p className="mt-2 max-w-[60ch] text-sm text-ink-2">{r.reason}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {r.priority === "high" ? <StatusBadge tone="warning">High priority</StatusBadge> : <StatusBadge tone="neutral">Normal priority</StatusBadge>}
            <span className="text-xs text-muted">Due {formatDate(r.dueBy, { day: "numeric", month: "short" })}</span>
          </div>
        </div>

        {/* stepper */}
        <div className="relative mt-8">
          <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-4" aria-label="Referral stages">
            {REFERRAL_STAGES.map((stage, i) => {
              const isDone = i <= idx;
              const isStalled = !done && i === idx + 1;
              const date = dates[stage];
              return (
                <li key={stage} className="relative flex gap-4 md:flex-col md:gap-3" aria-current={i === idx ? "step" : undefined}>
                  {i < REFERRAL_STAGES.length - 1 ? (
                    <>
                      {/* connector to the next stage: node edge → next node edge (desktop: right, mobile: down) */}
                      <span aria-hidden="true" className="absolute left-10 top-5 hidden h-px w-[calc(100%-24px)] md:block">
                        <span className="absolute inset-0 border-t border-dashed border-line-strong" />
                        <motion.span className="absolute -top-px left-0 h-0.5 w-full origin-left bg-primary" initial={false} animate={{ scaleX: i < idx ? 1 : 0 }} transition={fill} />
                      </span>
                      <span aria-hidden="true" className="absolute left-5 top-10 h-[calc(100%-16px)] w-px md:hidden">
                        <span className="absolute inset-0 border-l border-dashed border-line-strong" />
                        <motion.span className="absolute -left-px top-0 h-full w-0.5 origin-top bg-primary" initial={false} animate={{ scaleY: i < idx ? 1 : 0 }} transition={fill} />
                      </span>
                    </>
                  ) : null}
                  <span className="relative flex size-10 shrink-0 items-center justify-center">
                    {isStalled ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-warning/30 animate-pulse-ring" /> : null}
                    <motion.span
                      initial={false}
                      animate={{ scale: i === idx ? 1.08 : 1 }}
                      transition={spring}
                      className={cn(
                        "relative flex size-10 items-center justify-center rounded-full ring-4 ring-canvas transition-colors duration-300",
                        isDone ? "bg-primary text-white" : isStalled ? "bg-surface text-warning shadow-[inset_0_0_0_1.5px_var(--color-warning)]" : "bg-surface text-faint shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                      )}
                    >
                      {isDone ? <Check size={18} weight="bold" aria-hidden="true" /> : isStalled ? <WarningCircle size={18} aria-hidden="true" /> : <span className="text-xs tabular">{i + 1}</span>}
                    </motion.span>
                  </span>
                  <div className="min-w-0 pt-2 md:pt-0">
                    <p className={cn("text-sm", isDone || isStalled ? "text-ink" : "text-muted")}>
                      {REFERRAL_STAGE_LABEL[stage]}
                      <span className="sr-only">{isDone ? " — done" : isStalled ? " — waiting" : " — not started"}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {isDone && date ? (
                        <>
                          {formatDate(date, { day: "numeric", month: "short" })} · {formatTime(date)}
                          <span className="block truncate">{ownerOf(r, stage)}</span>
                        </>
                      ) : (
                        <>
                          Not yet
                          <span className="block truncate">Owner: {ownerOf(r, stage)}</span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* where it stopped */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${sample}-${idx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={spring}
            className={cn("mt-8 flex flex-col gap-2 rounded-inner p-4 sm:flex-row sm:items-center sm:justify-between", done ? "bg-success-soft" : "bg-warning-soft")}
            role="status"
          >
            <p className={cn("text-sm", done ? "text-success" : "text-warning")}>
              {done
                ? `Loop closed — ${person(r.fromId)} acknowledged the outcome on ${formatDate(dates.acknowledged ?? r.dueBy, { day: "numeric", month: "short" })}.`
                : `Stopped at ${REFERRAL_STAGE_LABEL[current]} ${waitedFor} — waiting on ${ownerOf(r, next!)} to mark it ${REFERRAL_STAGE_LABEL[next!].toLowerCase()}.`}
            </p>
            {!done && overdue > 0 ? <StatusBadge tone="danger">{plural(overdue, "day")} past due</StatusBadge> : null}
            {isSimulated ? <StatusBadge tone="draft">Simulated locally</StatusBadge> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
