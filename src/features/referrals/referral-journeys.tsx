"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Icon } from "@phosphor-icons/react";
import { CalendarCheck, Check, Clock, Handshake, Hourglass, PaperPlaneTilt, SealCheck, WarningOctagon } from "@phosphor-icons/react";
import type { ReferralStage } from "@/data/types";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Tip } from "@/components/ui/tooltip";
import { FlowMap, type FlowEdge, type FlowNode } from "@/components/viz/flow-map";
import { dayPhrase, stamp } from "@/features/tasks/time";
import { buildJourneys, type Mark, type Stop } from "./journey-layout";
import { STAGE_WAITING, waitText, type ReferralState } from "./meta";
import type { CareReferral } from "./store";

export const STAGE_ICON: Record<ReferralStage, Icon> = {
  requested: PaperPlaneTilt,
  accepted: Handshake,
  booked: CalendarCheck,
  completed: Check,
  acknowledged: SealCheck,
};

type Tone = "danger" | "warning" | "primary";
const toneOf = (st: ReferralState): Tone => (st.overdue ? "danger" : st.stalled ? "warning" : "primary");
const RING: Record<Tone, string> = { danger: "bg-danger-soft ring-danger", warning: "bg-warning-soft ring-warning", primary: "bg-primary-soft ring-primary" };
const TEXT: Record<Tone, string> = { danger: "text-danger", warning: "text-warning", primary: "text-primary-ink" };
/** Inside a ring the icon says how the wait is going (the end label names the stage it waits for). */
const WAIT_ICON: Record<Tone, Icon> = { danger: WarningOctagon, warning: Hourglass, primary: Clock };

const NOT_DONE: Record<ReferralStage, string> = {
  requested: "not requested",
  accepted: "not accepted",
  booked: "not booked",
  completed: "not completed",
  acknowledged: "not acknowledged",
};

const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const days = (n: number) => (n < 1 ? "<1 d" : `${n} d`);

/** Second line of the patient label at the end of each line: where it stopped, in words. */
function endStatus(r: CareReferral, st: ReferralState) {
  if (!st.pending) return `Loop closed${r.stageDates.acknowledged ? ` · ${shortDate(r.stageDates.acknowledged)}` : ""}`;
  if (st.pending === "completed" && st.visitUpcoming && r.bookedFor) return `Visit ${dayPhrase(r.bookedFor)} ${formatTime(r.bookedFor)}`;
  const what = `${NOT_DONE[st.pending]} ${days(st.waitingDays)}`;
  return st.overdue ? `Past due · ${what}` : st.stalled ? `Stalled · ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
}

function markLine(r: CareReferral, st: ReferralState, m: Mark) {
  if (m.kind === "pending") {
    if (st.visitUpcoming && r.bookedFor) return `Next: ${REFERRAL_STAGE_LABEL[m.stage]} after the visit ${dayPhrase(r.bookedFor)} ${formatTime(r.bookedFor)}`;
    return `Stopped here: ${STAGE_WAITING[m.stage].toLowerCase()} · ${waitText(st.waitingDays)}${st.overdue ? " · past due" : st.stalled ? " · stalled" : ""}`;
  }
  const who = staffById(m.actorId)?.name;
  return `${REFERRAL_STAGE_LABEL[m.stage]} · ${m.at ? stamp(m.at) : "date not recorded"}${who ? ` · ${who}` : ""}`;
}

const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => true);

/**
 * "Referral journeys" (ref 5 metro map): each referral is a line through the lanes of the
 * disciplines that held it, with its stages at their real dates and the stop where it waits now.
 */
export function ReferralJourneys({ referrals, onOpen }: { referrals: CareReferral[]; onOpen: (id: string) => void }) {
  const layout = useMemo(() => buildJourneys(referrals), [referrals]);
  const [hot, setHot] = useState<string | null>(null);
  const wide = useWide();
  // The flow map measures its own width after mount; hand it the focus point once it has, so
  // "today" lands where intended instead of being placed against a default width.
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMeasured(true), 80);
    return () => window.clearTimeout(id);
  }, []);
  const byId = useMemo(() => new Map(referrals.map((r) => [r.id, r])), [referrals]);
  const open = referrals.filter((r) => layout.states[r.id]?.pending).length;

  const nodes: FlowNode[] = layout.stops.map((stop) => {
    const r = byId.get(stop.referralId)!;
    return {
      id: stop.id,
      x: stop.x,
      y: stop.y,
      width: stop.w,
      className: cn("transition-opacity duration-200", hot && hot !== stop.referralId && "opacity-25", hot === stop.referralId && "z-[2]"),
      content: <StopNode stop={stop} referral={r} st={layout.states[r.id]} onOpen={onOpen} onHot={setHot} />,
    };
  });
  const edges: FlowEdge[] = layout.edges.map((e) => ({
    from: e.from,
    to: e.to,
    tone: hot ? (e.referralId === hot ? "primary" : "muted") : e.kind === "waiting" ? "primary" : "muted",
    label: e.label,
    detail: e.detail,
  }));

  return (
    <section aria-labelledby="journeys-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="journeys-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Referral journeys
          </h2>
          <p className="mt-1 max-w-[72ch] text-sm text-muted">
            Each line is one referral, drawn through the discipline that held it at every stage — on the date that stage happened. Lines join a referral&apos;s own stages only; the ring is where it waits now.
          </p>
        </div>
        <p className="text-xs text-muted tabular" aria-live="polite">
          {referrals.length} {referrals.length === 1 ? "referral" : "referrals"} · {open} waiting now · 1 column = 1 week (IST)
        </p>
      </div>

      <div className={cn("transition-opacity duration-300", measured ? "opacity-100" : "opacity-0")}>
      <FlowMap
        key={referrals.map((r) => r.id).join(",")}
        label={`Referral journeys: ${referrals.length} referrals across the nutrition, medical and movement lanes`}
        nodes={nodes}
        edges={edges}
        width={layout.width}
        height={layout.height}
        viewportHeight={Math.min(layout.height, wide ? 880 : 480)}
        rows={layout.lanes.map((l) => ({ y: l.y, label: `${l.label} · ${l.waiting} waiting here`, hint: l.hint }))}
        columns={layout.columns}
        initialFocusX={measured ? layout.todayX + (wide ? 0 : 150) : undefined}
        className="bg-sunken/40"
      />
      </div>

      <JourneyLegend />
    </section>
  );
}

function StopNode({ stop, referral, st, onOpen, onHot }: { stop: Stop; referral: CareReferral; st: ReferralState; onOpen: (id: string) => void; onHot: (id: string | null) => void }) {
  const patient = patientById(referral.patientId);
  const title = `${patient?.name ?? "Patient"} → ${DISCIPLINE_LABEL[referral.toDiscipline]}`;
  const tone = toneOf(st);
  const WaitIcon = WAIT_ICON[tone];
  const lines = stop.kind === "visit" ? [`Visit held ${stamp(stop.visitAt!)}${referral.room ? ` · ${referral.room}` : ""}`, "Completion not recorded since"] : stop.marks.map((m) => markLine(referral, st, m));
  const hover = {
    onPointerEnter: () => onHot(referral.id),
    onPointerLeave: () => onHot(null),
    onFocus: () => onHot(referral.id),
    onBlur: () => onHot(null),
  };

  return (
    <div className="relative" style={{ width: stop.w, height: stop.h }}>
      <Tip
        label={
          <span className="flex max-w-[280px] flex-col gap-0.5">
            <span className="text-white">{title}</span>
            {lines.map((l) => (
              <span key={l} className="text-white/70">
                {l}
              </span>
            ))}
          </span>
        }
      >
        <button type="button" onClick={() => onOpen(referral.id)} aria-label={`${title}. ${lines.join(". ")}. Open referral.`} className="group flex h-full items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" {...hover}>
          {stop.kind === "visit" ? (
            <span className="block size-4 rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--color-faint)]" aria-hidden="true" />
          ) : (
            stop.marks.map((m, i) => {
              const MarkIcon = STAGE_ICON[m.stage];
              return m.kind === "reached" ? (
                <span
                  key={m.stage}
                  aria-hidden="true"
                  className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-white ring-2 ring-canvas transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-105", i > 0 && "-ml-3")}
                  style={{ zIndex: i + 1 }}
                >
                  <MarkIcon size={15} weight="bold" />
                </span>
              ) : (
                <span key={`p-${m.stage}`} aria-hidden="true" className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ring-inset", RING[tone], i > 0 && "-ml-3")} style={{ zIndex: i + 1 }}>
                  <WaitIcon size={15} weight="bold" className={TEXT[tone]} />
                </span>
              );
            })
          )}
        </button>
      </Tip>
      {stop.caption ? (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-full mb-1 whitespace-nowrap text-[11px] leading-none text-muted tabular" style={{ left: stop.kind === "visit" ? 12 : 24 }}>
          {stop.caption}
        </span>
      ) : null}
      {stop.last ? <EndLabel referral={referral} st={st} onOpen={onOpen} hover={hover} /> : null}
    </div>
  );
}

function EndLabel({
  referral,
  st,
  onOpen,
  hover,
}: {
  referral: CareReferral;
  st: ReferralState;
  onOpen: (id: string) => void;
  hover: { onPointerEnter: () => void; onPointerLeave: () => void; onFocus: () => void; onBlur: () => void };
}) {
  const patient = patientById(referral.patientId);
  const tone = toneOf(st);
  const status = endStatus(referral, st);
  return (
    <button
      type="button"
      onClick={() => onOpen(referral.id)}
      aria-label={`Open referral: ${patient?.name ?? "Patient"} to ${DISCIPLINE_LABEL[referral.toDiscipline]} — ${status}`}
      className="absolute left-full top-1/2 ml-3 flex h-10 w-max max-w-[236px] -translate-y-1/2 items-center gap-2 rounded-full bg-surface pl-1 pr-3 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,translate] duration-200 hover:-translate-y-[calc(50%+2px)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus-visible:outline-2 focus-visible:outline-primary"
      {...hover}
    >
      <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-xs text-ink">
          {patient?.name ?? "Patient"} <span className="text-muted">→ {DISCIPLINE_LABEL[referral.toDiscipline]}</span>
        </span>
        <span className={cn("block truncate text-[11px]", !st.pending ? "text-success" : TEXT[tone])}>{status}</span>
      </span>
    </button>
  );
}

function JourneyLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:p-6">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2" aria-label="Stage marks">
        {REFERRAL_STAGES.map((s) => {
          const I = STAGE_ICON[s];
          return (
            <li key={s} className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-charcoal text-white" aria-hidden="true">
                <I size={12} weight="bold" />
              </span>
              {REFERRAL_STAGE_LABEL[s]}
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-muted">Overlapping marks = stages within ~1.5 days of each other</li>
      </ul>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2" aria-label="Lines and rings">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-primary" aria-hidden="true" />
          Waiting for the next stage — length = time waiting
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-line-strong" aria-hidden="true" />
          Handoff already made
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-danger-soft ring-2 ring-inset ring-danger" aria-hidden="true">
            <WarningOctagon size={12} weight="bold" className="text-danger" />
          </span>
          Stopped · past due date
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-warning-soft ring-2 ring-inset ring-warning" aria-hidden="true">
            <Hourglass size={12} weight="bold" className="text-warning" />
          </span>
          Stopped · no change for over 2 days
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft ring-2 ring-inset ring-primary" aria-hidden="true">
            <Clock size={12} weight="bold" className="text-primary-ink" />
          </span>
          Waiting · on time
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--color-faint)]" aria-hidden="true" />
          Visit held, outcome not recorded
        </li>
      </ul>
      <p className="text-xs text-muted">
        Lanes show who holds the referral: the referring clinician requests and acknowledges; the receiving discipline accepts, books and completes. Hover a mark to see exact times and who acted; hover a line for how long that handoff took.
      </p>
    </div>
  );
}
