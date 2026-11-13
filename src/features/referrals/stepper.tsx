"use client";

import { motion } from "motion/react";
import { Check } from "@phosphor-icons/react";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop, spring } from "@/lib/motion";
import type { CareReferral } from "./store";
import { referralState, waitText } from "./meta";
import { dayPhrase } from "@/features/tasks/time";

/**
 * Requested → Accepted → Booked → Completed → Acknowledged.
 * Reached stages are charcoal with their date; the stage where progress stopped pulses
 * (cobalt while on time, red once the due date has passed); later stages stay hollow.
 */
export function ReferralStepper({ referral, className, compact }: { referral: CareReferral; className?: string; compact?: boolean }) {
  const st = referralState(referral);
  const tone = st.overdue ? "danger" : st.stalled ? "warning" : "primary";
  const toneRing = { danger: "ring-danger", warning: "ring-warning", primary: "ring-primary" }[tone];
  const toneDot = { danger: "bg-danger", warning: "bg-warning", primary: "bg-primary" }[tone];
  const toneText = { danger: "text-danger", warning: "text-warning", primary: "text-primary-ink" }[tone];
  const toneDash = { danger: "var(--color-danger)", warning: "var(--color-warning)", primary: "var(--color-primary)" }[tone];

  return (
    <ol aria-label="Referral progress" className={cn("grid grid-cols-5", className)}>
      {REFERRAL_STAGES.map((stage, i) => {
        const reached = i <= st.idx;
        const pending = stage === st.pending;
        const date = referral.stageDates[stage];
        const nextReached = i + 1 <= st.idx;
        const nextPending = REFERRAL_STAGES[i + 1] === st.pending;
        return (
          <li key={stage} aria-current={pending ? "step" : undefined} className="relative flex min-w-0 flex-col items-center text-center">
            {/* track to the next stage */}
            {i < REFERRAL_STAGES.length - 1 ? (
              <span aria-hidden="true" className="absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-[11px] h-0.5 overflow-hidden rounded-full">
                {nextReached ? (
                  <motion.span
                    key={`solid-${referral.stage}`}
                    className="absolute inset-0 origin-left rounded-full bg-charcoal"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ ...spring, delay: 0.08 * i }}
                  />
                ) : nextPending ? (
                  <span className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${toneDash} 0 6px, transparent 6px 10px)` }} />
                ) : (
                  <span className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--color-line-strong) 0 2px, transparent 2px 6px)" }} />
                )}
              </span>
            ) : null}

            {/* node */}
            {reached ? (
              <motion.span
                key={`reached-${stage}-${st.idx}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...pop, delay: 0.06 * i }}
                className="relative z-[1] flex size-6 items-center justify-center rounded-full bg-charcoal text-white"
              >
                <Check size={12} weight="bold" aria-hidden="true" />
              </motion.span>
            ) : pending ? (
              <span className={cn("relative z-[1] flex size-6 items-center justify-center rounded-full bg-surface ring-2 ring-inset", toneRing)}>
                <span className={cn("absolute inset-0 rounded-full opacity-40 animate-pulse-ring", toneDot)} aria-hidden="true" />
                <span className={cn("relative size-2 rounded-full", toneDot)} aria-hidden="true" />
              </span>
            ) : (
              <span className="relative z-[1] size-6 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" />
            )}

            <span className={cn("mt-2 max-w-full truncate px-1 text-xs", reached || pending ? "text-ink" : "text-muted", compact && "max-sm:sr-only")}>{REFERRAL_STAGE_LABEL[stage]}</span>
            <span className={cn("max-w-full truncate px-1 text-[11px] tabular", pending ? toneText : "text-muted", compact && "max-sm:sr-only")}>
              {reached && date ? (
                formatDate(date, { day: "numeric", month: "short" })
              ) : pending ? (
                <>
                  <span className="sr-only">Stopped here — </span>
                  {st.overdue
                    ? "Past due"
                    : st.visitUpcoming && referral.bookedFor
                      ? `Visit ${dayPhrase(referral.bookedFor)}`
                      : `Waiting ${st.waitingDays < 1 ? "<1 day" : waitText(st.waitingDays)}`}
                </>
              ) : (
                <span aria-hidden="true">—</span>
              )}
              {!reached && !pending ? <span className="sr-only">Not reached</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
