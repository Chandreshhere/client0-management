"use client";

import { ArrowRight, Path } from "@phosphor-icons/react";
import type { ReferralStage } from "@/data/types";
import { REFERRAL_STAGE_LABEL } from "@/data/care";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { GroupHeader } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { CountChip } from "@/features/tasks/ui";
import { referralState, waitText, type Health } from "./meta";
import type { CareReferral } from "./store";

/** The four handoffs a referral passes through, named by what has to happen next. */
const HANDOFFS: { stage: ReferralStage; from: ReferralStage; label: string; who: string; typicalLabel: string }[] = [
  { stage: "accepted", from: "requested", label: "Acceptance", who: "Receiving practitioner accepts", typicalLabel: "Typical time to accept" },
  { stage: "booked", from: "accepted", label: "Booking", who: "Receiver, front desk or coordinator", typicalLabel: "Typical time to book" },
  { stage: "completed", from: "booked", label: "Visit & completion", who: "Receiver records the visit", typicalLabel: "Booked → completed, incl. wait for visit" },
  { stage: "acknowledged", from: "completed", label: "Acknowledgement", who: "Referrer closes the loop", typicalLabel: "Typical time to acknowledge" },
];

type Wait = "overdue" | "stalled" | "on-time";
const WAIT_LABEL: Record<Wait, string> = { overdue: "Past due date", stalled: "No change for over 2 days", "on-time": "Waiting · on time" };
const WAIT_RING: Record<Wait, string> = { overdue: "ring-danger", stalled: "ring-warning", "on-time": "ring-primary" };
const waitOf = (h: Health): Wait => (h === "overdue" ? "overdue" : h === "stalled" ? "stalled" : "on-time");

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const spanText = (h: number) => (h < 1 ? "under 1 h" : h < 24 ? `${Math.round(h)} h` : `${(h / 24).toFixed(h < 240 ? 1 : 0)} d`);

/** Per handoff: who is waiting there now (and how late), and how long that handoff usually takes. */
export function handoffStats(referrals: CareReferral[]) {
  const states = referrals.map((r) => ({ r, st: referralState(r) }));
  return HANDOFFS.map((h) => {
    const waiting = states
      .filter((x) => x.st.pending === h.stage)
      .map((x) => ({ r: x.r, st: x.st, wait: waitOf(x.st.health) }))
      .sort((a, b) => ["overdue", "stalled", "on-time"].indexOf(a.wait) - ["overdue", "stalled", "on-time"].indexOf(b.wait) || b.st.waitingDays - a.st.waitingDays);
    const durations = referrals
      .map((r) => {
        const a = r.stageDates[h.from], b = r.stageDates[h.stage];
        return a && b ? (Date.parse(b) - Date.parse(a)) / 3_600_000 : null;
      })
      .filter((x): x is number => x !== null && x >= 0);
    return { ...h, waiting, typical: median(durations), done: durations.length };
  });
}

/**
 * "Where open referrals wait" (doc §5B): one tile per handoff with the patients waiting there as
 * rings coloured by lateness, and the median time that handoff took when it did happen.
 * Picking a tile filters the list to referrals stopped before that handoff.
 */
export function HandoffStrip({ referrals, stage, onStage, className }: { referrals: CareReferral[]; stage: ReferralStage | "all"; onStage: (s: ReferralStage | "all") => void; className?: string }) {
  const stats = handoffStats(referrals);
  const open = stats.reduce((s, x) => s + x.waiting.length, 0);
  const maxTypical = Math.max(1, ...stats.map((s) => s.typical ?? 0));

  return (
    <section aria-labelledby="handoff-title" className={cn("rounded-card bg-sunken p-2", className)}>
      <GroupHeader
        icon={<Path />}
        title={<h2 id="handoff-title">Where open referrals wait</h2>}
        subtitle="By the next handoff · typical time = median of handoffs already made · pick one to filter"
        action={<CountChip>{open} open</CountChip>}
      />
      <ol data-lenis-prevent className="scrollbar-none -mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {stats.map((s, i) => {
          const pressed = stage === s.from;
          const late = s.waiting.filter((w) => w.wait !== "on-time").length;
          const oldest = [...s.waiting].sort((a, b) => b.st.waitingDays - a.st.waitingDays)[0];
          const summary = `${s.label}: ${s.waiting.length} waiting${late ? `, ${late} late` : ""}. Typical handoff ${s.typical !== null ? spanText(s.typical) : "not measured yet"}${s.done ? ` from ${s.done} referrals` : ""}.`;
          return (
            <li key={s.stage} className="relative w-[272px] min-w-0 shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                aria-pressed={pressed}
                aria-label={`${summary} ${pressed ? "Showing only these — press to show all stages." : "Show only these referrals."}`}
                onClick={() => onStage(pressed ? "all" : s.from)}
                className={cn(
                  "flex h-full w-full flex-col gap-4 rounded-inner bg-surface p-4 text-left transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 active:scale-[0.99]",
                  pressed ? "shadow-[inset_0_0_0_2px_var(--color-charcoal)]" : "hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="block truncate text-[11px] text-muted">
                    Step {i + 1} · {REFERRAL_STAGE_LABEL[s.from]} → {REFERRAL_STAGE_LABEL[s.stage]}
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-ink">{s.label}</span>
                    <span className="flex shrink-0 items-baseline gap-1 text-ink">
                      <span className="text-[28px] font-light leading-none tracking-[-0.02em] tabular">{s.waiting.length}</span>
                      <span className="text-xs text-muted">waiting</span>
                    </span>
                  </span>
                </span>

                {/* unit chart: one ring per waiting referral, coloured by how late it is */}
                <span className="flex min-h-8 flex-wrap items-center gap-1.5" aria-hidden="true">
                  {s.waiting.length ? (
                    s.waiting.map((w) => {
                      const p = patientById(w.r.patientId);
                      return (
                        <Tip key={w.r.id} label={`${p?.name ?? "Patient"} · ${WAIT_LABEL[w.wait].toLowerCase()} · waiting ${waitText(w.st.waitingDays)}`}>
                          <span className={cn("rounded-full ring-2 ring-offset-2 ring-offset-surface", WAIT_RING[w.wait])}>
                            <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="xs" loading="eager" />
                          </span>
                        </Tip>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted">Nobody waiting here</span>
                  )}
                </span>

                <span className="mt-auto flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-muted">{s.typicalLabel}</span>
                    <span className="shrink-0 text-ink-2 tabular">{s.typical !== null ? spanText(s.typical) : "—"}</span>
                  </span>
                  <span className="block h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-ink-2 transition-[width] duration-500 [transition-timing-function:var(--ease-spring)]"
                      style={{ width: s.typical !== null ? `${Math.max(4, (s.typical / maxTypical) * 100)}%` : "0%" }}
                    />
                  </span>
                  <span className="text-[11px] text-muted tabular">{s.done ? `Median of ${s.done} ${s.done === 1 ? "handoff" : "handoffs"} made` : "No handoffs made yet"}</span>
                  <span className="truncate text-[11px] text-muted">
                    {oldest ? `Longest: ${patientById(oldest.r.patientId)?.name.split(" ")[0] ?? "Patient"} · ${waitText(oldest.st.waitingDays)}` : s.who}
                  </span>
                </span>
              </button>
              {i < stats.length - 1 ? (
                <span aria-hidden="true" className="absolute -right-[13px] top-1/2 z-[1] hidden size-6 -translate-y-1/2 items-center justify-center rounded-full bg-sunken text-muted xl:flex">
                  <ArrowRight size={12} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2 pb-1 pt-3 text-[11px] text-ink-2" aria-label="Ring colours">
        {(["overdue", "stalled", "on-time"] as Wait[]).map((w) => (
          <li key={w} className="flex items-center gap-2">
            <span className={cn("size-3 rounded-full bg-surface ring-2", WAIT_RING[w])} aria-hidden="true" />
            {WAIT_LABEL[w]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-ink-2" aria-hidden="true" />
          Typical time · one scale across all four steps
        </li>
      </ul>
    </section>
  );
}
