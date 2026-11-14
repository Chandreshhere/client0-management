"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowCounterClockwise, Check, WarningCircle } from "@phosphor-icons/react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { ASSIGNMENT_RETURN_HOURS, REFERRALS, assignmentState } from "@/data/care";
import { patientById } from "@/data/patients";
import { minPlanForRole } from "@/data/plans";
import { staffById } from "@/data/staff";
import type { Referral } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { spring } from "@/lib/motion";

/**
 * Assignment handoff (spec F5): the doctor assigns a patient to a nutritionist or a yoga
 * instructor with goals and precautions; the recipient opening it marks it seen. Two states,
 * assigned → seen. Unseen after ASSIGNMENT_RETURN_HOURS it goes back to the doctor's pending list.
 * Booking is not a step here — it happens in scheduling.
 * Three real fixtures, read through assignmentState(): one waiting inside the window, one returned
 * to the doctor, one seen. "Simulate" only changes this page's state, and says so.
 */

const SAMPLE_IDS = ["r3", "r8", "r2"] as const;
type SampleId = (typeof SAMPLE_IDS)[number];
const SAMPLES = SAMPLE_IDS.map((id) => REFERRALS.find((r) => r.id === id)).filter((r): r is Referral => !!r);
const HOUR = 3_600_000;

const person = (id: string) => staffById(id)?.name ?? "Unassigned";
/** The spec names the movement discipline "yoga". */
const discipline = (d: Referral["toDiscipline"]) => (d === "movement" ? "Yoga" : DISCIPLINE_LABEL[d]);
const firstName = (patientId: string) => patientById(patientId)?.name.split(" ")[0] ?? "Patient";
const shortDate = (iso: string) => `${formatDate(iso, { day: "numeric", month: "short" })} · ${formatTime(iso)}`;

/** When the recipient opened it: the first stored date past "requested" (the fixtures keep the old stages). */
export function seenAt(r: Referral): string | null {
  if (assignmentState(r) !== "seen") return null;
  const dates = Object.entries(r.stageDates)
    .filter(([stage, d]) => stage !== "requested" && !!d)
    .map(([, d]) => d as string)
    .sort();
  return dates[0] ?? null;
}

const hoursBetween = (from: string, to: string | Date) => Math.max(0, ((typeof to === "string" ? new Date(to) : to).getTime() - new Date(from).getTime()) / HOUR);
function durationLabel(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

export function AssignmentTrack() {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [sample, setSample] = useState<SampleId>(SAMPLE_IDS[0]);
  const [simulated, setSimulated] = useState<Partial<Record<SampleId, string>>>({});

  const r = SAMPLES.find((x) => x.id === sample) ?? SAMPLES[0];
  if (!r) return null;
  const from = person(r.fromId);
  const to = person(r.toId);
  const seen = simulated[sample] ?? seenAt(r);
  const isSimulated = !!simulated[sample];
  const waited = hoursBetween(r.requestedAt, seen ?? TODAY);
  const returned = !seen && waited >= ASSIGNMENT_RETURN_HOURS;
  const returnedAt = new Date(new Date(r.requestedAt).getTime() + ASSIGNMENT_RETURN_HOURS * HOUR).toISOString();
  const fillPct = Math.min(100, (waited / ASSIGNMENT_RETURN_HOURS) * 100);
  const coordinatorPlan = minPlanForRole("coordinator").name;
  const fill = reduce ? { duration: 0 } : spring;

  const markSeen = () => {
    if (seen) return;
    setSimulated((m) => ({ ...m, [sample]: TODAY.toISOString() }));
    toast({ title: "Seen — simulated on this page", description: `${to} opened the assignment. Nothing was sent; in the demo, assignments change only in your browser session.` });
  };
  const reset = () => setSimulated((m) => ({ ...m, [sample]: undefined }));

  const steps = [
    { key: "assigned", label: "Assigned", done: true, date: r.requestedAt, who: `by ${from}`, owner: from },
    { key: "seen", label: "Seen", done: !!seen, date: seen, who: `opened by ${to}`, owner: to },
  ];

  return (
    <div className="rounded-card bg-surface p-2">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <Segmented
            variant="tray"
            size="sm"
            ariaLabel="Example assignment"
            value={sample}
            onChange={setSample}
            className="w-max"
            items={SAMPLES.map((x) => ({
              value: x.id as SampleId,
              label: (
                <>
                  {firstName(x.patientId)}
                  <span className="hidden sm:inline"> → {discipline(x.toDiscipline)}</span>
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
          <Button variant="dark" size="sm" onClick={markSeen} disabled={!!seen}>
            {seen ? "Seen" : `Simulate: ${to.split(" ")[0]} opens it`}
          </Button>
        </div>
      </div>

      <div className="rounded-inner bg-canvas p-4 md:p-6">
        {/* assignment header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar src={patientById(r.patientId)?.avatar} name={patientById(r.patientId)?.name ?? "Patient"} size="md" loading="eager" />
            <div className="min-w-0">
              <p className="text-base text-ink">{patientById(r.patientId)?.name}</p>
              <p className="text-xs text-muted">
                {from} → {to} · {discipline(r.toDiscipline)}
              </p>
              <p className="mt-2 text-xs text-muted">Goals and precautions</p>
              <p className="mt-0.5 max-w-[60ch] text-sm text-ink-2">{r.reason}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {r.priority === "high" ? <StatusBadge tone="warning">High priority</StatusBadge> : <StatusBadge tone="neutral">Normal priority</StatusBadge>}
          </div>
        </div>

        {/* two-step track */}
        <ol className="relative mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4" aria-label="Assignment states">
          {steps.map((s, i) => {
            const stalled = !s.done;
            return (
              <li key={s.key} className="relative flex gap-4 md:flex-col md:gap-3" aria-current={(i === 0 && !seen) || (i === 1 && seen) ? "step" : undefined}>
                {i === 0 ? (
                  <>
                    <span aria-hidden="true" className="absolute left-10 top-5 hidden h-px w-[calc(100%-24px)] md:block">
                      <span className="absolute inset-0 border-t border-dashed border-line-strong" />
                      <motion.span className="absolute -top-px left-0 h-0.5 w-full origin-left bg-primary" initial={false} animate={{ scaleX: seen ? 1 : 0 }} transition={fill} />
                    </span>
                    <span aria-hidden="true" className="absolute left-5 top-10 h-[calc(100%-16px)] w-px md:hidden">
                      <span className="absolute inset-0 border-l border-dashed border-line-strong" />
                      <motion.span className="absolute -left-px top-0 h-full w-0.5 origin-top bg-primary" initial={false} animate={{ scaleY: seen ? 1 : 0 }} transition={fill} />
                    </span>
                  </>
                ) : null}
                <span className="relative flex size-10 shrink-0 items-center justify-center">
                  {stalled ? <span aria-hidden="true" className={cn("absolute inset-0 rounded-full animate-pulse-ring", returned ? "bg-danger/25" : "bg-warning/30")} /> : null}
                  <span
                    className={cn(
                      "relative flex size-10 items-center justify-center rounded-full ring-4 ring-canvas transition-colors duration-300",
                      s.done
                        ? "bg-primary text-white"
                        : returned
                          ? "bg-surface text-danger shadow-[inset_0_0_0_1.5px_var(--color-danger)]"
                          : "bg-surface text-warning shadow-[inset_0_0_0_1.5px_var(--color-warning)]",
                    )}
                  >
                    {s.done ? <Check size={18} weight="bold" aria-hidden="true" /> : <WarningCircle size={18} aria-hidden="true" />}
                  </span>
                </span>
                <div className="min-w-0 pt-2 md:pt-0">
                  <p className="text-sm text-ink">
                    {s.label}
                    <span className="sr-only">{s.done ? " — done" : " — waiting"}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {s.done && s.date ? (
                      <>
                        {shortDate(s.date)}
                        <span className="block truncate">{s.who}</span>
                      </>
                    ) : (
                      <>
                        Not yet
                        <span className="block truncate">Owner: {s.owner}</span>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* the 48-hour window */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-4 text-xs text-muted">
            <span>{seen ? `Opened ${durationLabel(waited)} after it was assigned` : `${durationLabel(waited)} since it was assigned`}</span>
            <span className="shrink-0 tabular">{ASSIGNMENT_RETURN_HOURS} h · back to the doctor</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken-2" aria-hidden="true">
            <motion.div
              className={cn("h-full rounded-full", seen ? "bg-primary" : returned ? "bg-danger" : "bg-warning")}
              initial={false}
              animate={{ width: `${fillPct}%` }}
              transition={fill}
            />
          </div>
        </div>

        {/* who has it now */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${sample}-${seen ? "seen" : "assigned"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={spring}
            className={cn("mt-6 flex flex-col gap-2 rounded-inner p-4 sm:flex-row sm:items-center sm:justify-between", seen ? "bg-success-soft" : returned ? "bg-danger-soft" : "bg-warning-soft")}
            role="status"
          >
            <p className={cn("text-sm", seen ? "text-success" : returned ? "text-danger" : "text-warning")}>
              {seen
                ? `Seen — ${to} opened it ${durationLabel(waited)} after it was assigned. Plan versions, sessions and flags now land on ${firstName(r.patientId)}'s timeline.`
                : returned
                  ? `Not seen within ${ASSIGNMENT_RETURN_HOURS} h — back on ${from}'s pending list since ${shortDate(returnedAt)}. On ${coordinatorPlan}, the care coordinator sees it too.`
                  : `Waiting on ${to} to open it. Unseen at ${ASSIGNMENT_RETURN_HOURS} h, it goes back to ${from}'s pending list — in ${durationLabel(ASSIGNMENT_RETURN_HOURS - waited)}.`}
            </p>
            {isSimulated ? <StatusBadge tone="draft">Simulated locally</StatusBadge> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
