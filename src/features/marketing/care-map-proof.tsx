"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Files } from "@phosphor-icons/react";
import { ORGAN_LABEL } from "@/data/anatomy";
import { EVENT_TYPE_LABEL, RECORD_STATE_LABEL, type CareEvent } from "@/data/featured";
import { careTeamActivity, systemShares } from "@/data/insights";
import { clinicNumber } from "@/data/patients";
import type { PatientRecord } from "@/data/record";
import type { Discipline } from "@/data/types";
import { OrganCanvas } from "@/features/patient/organ-canvas";
import { Avatar } from "@/components/ui/avatar";
import { DemoFlag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { pop, snappy, spring } from "@/lib/motion";
import {
  EVENT_ICON,
  MONTHS,
  NOW,
  PROOF_PATIENTS,
  conditionOf,
  conditionsIn,
  dayOf,
  defaultEvent,
  eventsIn,
  latestFor,
  monthOf,
  placeBubbles,
  proofPatient,
  systemOf,
  threadLinks,
  type ProofPatient,
} from "./care-map-model";
import { EagerAvatarStack } from "./eager-avatars";
import { EventDetail } from "./event-detail";
import { OpenRecordButton } from "./open-record";
import { PatientSwitcher } from "./patient-switcher";
import { ThreadLayer, useAnchors } from "./thread-layer";

/**
 * Hero product proof — a scaled-down, working recreation of the patient overview, for four
 * synthetic patients. Switching patient rebuilds everything from that patient's record
 * (@/data/record): the live organ (heart · lungs · pancreas · kidneys — from their conditions),
 * the body-system cards and their share of care activity, the year of dated events, and the
 * threads (condition → events documented against it; never cause and effect).
 * Desktop (≥1280px): four tracks with threads. Below: a recomposed switcher + chronological list.
 */

const ROW_H = 42;
const BUBBLE = 28;
const DEFAULT_TRACK = 372;
const DISCIPLINE_DOT: Record<Discipline, string> = { medical: "bg-medical", nutrition: "bg-nutrition", movement: "bg-movement", operations: "bg-ops" };

function useMedia(query: string) {
  const [match, setMatch] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return match;
}

export function CareMapProof() {
  const wide = useMedia("(min-width: 1280px)");
  const first = PROOF_PATIENTS[0];
  const [pid, setPid] = useState(first.patient.id);
  const pp = proofPatient(pid);
  const record = pp.record;
  const [active, setActive] = useState(first.focus.id);
  const [year, setYear] = useState(first.record.years[0]);
  const [selected, setSelected] = useState<string>(() => defaultEvent(first.record, first.record.years[0], first.focus.id)?.id ?? "");
  const [hover, setHover] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, refFor } = useAnchors();

  const yearEvents = useMemo(() => eventsIn(record, year), [record, year]);
  const event = record.events.find((e) => e.id === selected) ?? defaultEvent(record, year, active);
  const links = useMemo(() => threadLinks(record, year, active), [record, year, active]);
  const sys = systemOf(record, active);
  const featured = conditionOf(record, sys.featuredConditionId) ?? conditionsIn(record, sys.id)[0];

  const switchPatient = (id: string) => {
    if (id === pid) return;
    const next = proofPatient(id);
    const y = next.record.years[0];
    setChanged(true);
    setHover(null);
    setPid(next.patient.id);
    setActive(next.focus.id);
    setYear(y);
    setSelected(defaultEvent(next.record, y, next.focus.id)?.id ?? "");
  };
  const focusSystem = (id: string) => {
    if (id === active) return;
    setChanged(true);
    setActive(id);
    const latest = latestFor(record, year, (e) => e.systemId === id);
    if (latest) setSelected(latest.id);
  };
  const changeYear = (y: number) => {
    if (y === year) return;
    setChanged(true);
    setYear(y);
    const latest = latestFor(record, y, (e) => e.systemId === active);
    if (latest) setSelected(latest.id);
  };
  const pickCondition = (cid: string) => {
    const c = conditionOf(record, cid);
    if (!c) return;
    if (c.systemId !== active) {
      setChanged(true);
      setActive(c.systemId);
    }
    const latest = latestFor(record, year, (e) => e.conditionId === cid);
    if (latest) setSelected(latest.id);
  };

  const shared: Shared = { pp, record, active, year, selected, hover, setHover, setSelected, focusSystem, changeYear, pickCondition, changed, refFor };
  const firstName = pp.patient.name.split(" ")[0];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <PatientSwitcher value={pid} onChange={switchPatient} label="Open a synthetic patient's record" />
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <DemoFlag>Live product · synthetic patients</DemoFlag>
          <p className="max-w-[60ch] text-xs leading-relaxed text-muted xl:text-right" aria-live="polite">
            Showing {firstName}&apos;s <span className="text-ink-2">{sys.name}</span> system{featured ? <> — {featured.name}</> : null}, so the model is the{" "}
            <span className="text-ink-2">{ORGAN_LABEL[sys.organ].toLowerCase()}</span>. Switch patient or system and the organ, cards and timeline are rebuilt from that record.
          </p>
        </div>
      </div>

      {/* ≥1280px: the care map with threads */}
      <div ref={containerRef} className="relative hidden xl:grid xl:grid-cols-[232px_minmax(320px,360px)_minmax(40px,1fr)_minmax(440px,548px)] xl:gap-x-6">
        {event ? <SummaryColumn pp={pp} event={event} /> : <div />}
        <SystemsColumn {...shared} showOrgan={wide === true} />
        <div aria-hidden="true" />
        <TimelineCard {...shared} events={yearEvents} />
        <ThreadLayer
          containerRef={containerRef}
          anchors={map}
          threads={links}
          version={`${pid}-${active}-${year}`}
          highlightGroup={hover}
          selectedEvent={selected}
          enabled={wide === true}
        />
      </div>
      <Legend />

      {/* <1280px: system switcher + chronological list */}
      {event ? <CompactProof {...shared} events={yearEvents} event={event} showOrgan={wide === false} /> : null}
    </div>
  );
}

type Shared = {
  pp: ProofPatient;
  record: PatientRecord;
  active: string;
  year: number;
  selected: string;
  hover: string | null;
  setHover: (id: string | null) => void;
  setSelected: (id: string) => void;
  focusSystem: (id: string) => void;
  changeYear: (y: number) => void;
  pickCondition: (cid: string) => void;
  changed: boolean;
  refFor: (key: string) => (el: HTMLElement | null) => void;
};

/* ------------------------------------------------------------------ summary column */

function SummaryColumn({ pp, event }: { pp: ProofPatient; event: CareEvent }) {
  const { patient, record } = pp;
  const authors = useMemo(() => careTeamActivity(record).slice(0, 3), [record]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-card bg-sunken p-2">
        <Avatar src={patient.avatar} name={patient.name} size="md" loading="eager" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
          <p className="truncate text-xs text-muted">{patient.age} years old</p>
        </div>
        <OpenRecordButton patientId={patient.id} tone="surface" />
      </div>

      <div className="rounded-card bg-surface p-4">
        <p className="flex items-center justify-between gap-2 text-xs text-muted">
          Records authored
          <span>all years</span>
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {authors.map(({ staff, count }) => (
            <li key={staff.id} className="flex items-center gap-3">
              <Avatar src={staff.avatar} name={staff.name} size="sm" loading="eager" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{staff.name}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DISCIPLINE_DOT[staff.discipline])} />
                  <span className="truncate">{staff.title.split(" ·")[0]}</span>
                </span>
              </span>
              <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-sunken px-1.5 text-xs text-ink-2 tabular" aria-label={`${count} records`}>
                {count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={event.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={snappy}>
            <EventDetail event={event} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ body systems */

function SystemsColumn({ pp, record, active, hover, setHover, focusSystem, pickCondition, setSelected, year, refFor, showOrgan }: Shared & { showOrgan: boolean }) {
  const sys = systemOf(record, active);
  const conds = conditionsIn(record, sys.id);
  const featured = conditionOf(record, sys.featuredConditionId) ?? conds[0];
  const secondary = conds.filter((c) => c.id !== featured?.id);
  const latest = latestFor(record, year, (e) => e.systemId === active);
  const shares = useMemo(() => systemShares(record), [record]);
  const total = shares[0]?.total ?? 0;

  return (
    <div className="flex flex-col">
      <div className="relative h-[288px]">
        <div className="absolute left-0 top-0 h-[248px] w-[208px] overflow-hidden rounded-card bg-primary text-white">
          <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">
            {conds.length} {conds.length === 1 ? "condition" : "conditions"}
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={`${pp.patient.id}-${sys.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={spring}
              className="absolute left-4 top-16 z-[3] max-w-[150px] text-[22px] leading-[1.1] tracking-[-0.015em]"
            >
              {sys.name}
            </motion.p>
          </AnimatePresence>
          <div className="absolute bottom-4 left-4 z-[3] flex gap-2">
            <Tip label="Show the latest record in this system">
              <button
                type="button"
                aria-label={`Show the latest ${sys.name} record`}
                onClick={() => latest && setSelected(latest.id)}
                className="flex size-10 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                <Files size={18} />
              </button>
            </Tip>
            <OpenRecordButton patientId={pp.patient.id} />
          </div>
        </div>

        {showOrgan ? (
          <OrganCanvas
            shape={sys.organ}
            label={`3D illustration of the ${ORGAN_LABEL[sys.organ].toLowerCase()} — ${pp.patient.name}'s ${sys.name} system`}
            className="pointer-events-none absolute left-[40px] top-[80px] z-[2] size-[188px]"
          />
        ) : null}

        {featured ? (
          <AnimatePresence initial={false}>
            <motion.button
              key={featured.id}
              ref={refFor(`cond:${featured.id}`)}
              type="button"
              onClick={() => pickCondition(featured.id)}
              onPointerEnter={() => setHover(featured.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(featured.id)}
              onBlur={() => setHover(null)}
              aria-label={`${featured.name}, ${featured.status}, ${featured.markers} linked records. Show its latest event`}
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={spring}
              className={cn(
                "glass-dark absolute left-[136px] top-[20px] z-[4] flex h-[204px] w-[188px] flex-col rounded-card p-4 text-left text-white",
                hover === featured.id && "outline-2 outline-offset-2 outline-white/60",
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="pt-1 text-xs text-white/70">{featured.status}</span>
                <span aria-hidden="true" className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                  <Files size={16} />
                </span>
              </span>
              <span className="mt-2 line-clamp-3 text-lg leading-[1.15] tracking-[-0.01em]">{featured.name}</span>
              <span className="mt-1 text-xs text-white/60">{featured.markers} linked records</span>
              <span className="mt-auto text-xs text-white/60">Since {formatDate(featured.since, { month: "short", year: "numeric" })}</span>
            </motion.button>
          </AnimatePresence>
        ) : null}

        <div className="absolute left-[152px] top-[236px] z-[3] flex flex-col items-start gap-2">
          {secondary.map((c) => (
            <ConditionChip key={c.id} id={c.id} name={c.name} tone="white" {...{ hover, setHover, pickCondition, refFor }} />
          ))}
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs text-muted">
        Share of care activity · last 12 months · <span className="tabular">{total}</span> {total === 1 ? "event" : "events"}
      </p>
      <LayoutGroup id="proof-systems">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {shares.map((s) => {
              const on = s.id === active;
              const list = conditionsIn(record, s.id);
              return (
                <motion.div
                  key={`${pp.patient.id}-${s.id}`}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={spring}
                  className="flex items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={() => focusSystem(s.id)}
                    aria-pressed={on}
                    aria-label={`${s.name}: ${s.percent}% of care activity in the last 12 months (${s.events} of ${s.total} events)${on ? ", in focus" : ". Focus this system"}`}
                    className={cn(
                      "flex h-[96px] w-[188px] shrink-0 flex-col rounded-card p-4 text-left transition-colors duration-200",
                      on ? "bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-sunken hover:bg-sunken-2",
                    )}
                  >
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="truncate text-xs text-muted">{s.name}</span>
                      <span className="shrink-0 text-[11px] text-muted tabular">
                        {s.events}/{s.total}
                      </span>
                    </span>
                    <span className="mt-1 text-[24px] font-light leading-none tracking-[-0.02em] text-ink tabular">{s.percent}%</span>
                    <span aria-hidden="true" className="mt-auto block h-1 w-full overflow-hidden rounded-full bg-ink/10">
                      <span className={cn("block h-full rounded-full", on ? "bg-primary" : "bg-ink/45")} style={{ width: `${s.percent}%` }} />
                    </span>
                  </button>
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    {on ? (
                      <span className="inline-flex h-8 items-center gap-1.5 text-xs text-muted">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                        In focus above
                      </span>
                    ) : (
                      list.map((c) => <ConditionChip key={c.id} id={c.id} name={c.name} tone="light" {...{ hover, setHover, pickCondition, refFor }} />)
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  );
}

function ConditionChip({
  id,
  name,
  tone,
  hover,
  setHover,
  pickCondition,
  refFor,
}: {
  id: string;
  name: string;
  tone: "white" | "light";
  hover: string | null;
  setHover: (id: string | null) => void;
  pickCondition: (id: string) => void;
  refFor: (key: string) => (el: HTMLElement | null) => void;
}) {
  const on = hover === id;
  return (
    <button
      ref={refFor(`cond:${id}`)}
      type="button"
      onClick={() => pickCondition(id)}
      onPointerEnter={() => setHover(id)}
      onPointerLeave={() => setHover(null)}
      onFocus={() => setHover(id)}
      onBlur={() => setHover(null)}
      className={cn(
        "inline-flex h-8 max-w-[220px] items-center rounded-full px-3 text-xs transition-[background-color,box-shadow,color] duration-200",
        tone === "white" ? "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-surface/60 text-ink-2",
        on ? "bg-charcoal text-white shadow-none" : "hover:bg-surface hover:text-ink",
      )}
    >
      <span className="truncate">{name}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ timeline */

function TimelineCard({ pp, record, events, active, year, selected, setSelected, setHover, changeYear, changed, refFor }: Shared & { events: CareEvent[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(DEFAULT_TRACK);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTrackW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const counts = useMemo(
    () => record.years.map((y) => ({ year: y, months: Array.from({ length: 12 }, (_, m) => eventsIn(record, y).filter((e) => e.systemId === active && monthOf(e) === m).length) })),
    [record, active],
  );

  return (
    <div className="flex min-h-[648px] rounded-card bg-surface py-4 pl-4">
      <div className="flex min-h-0 flex-1">
        <ol className="flex min-w-0 flex-1 flex-col" aria-label={`${pp.patient.name}: care events by month, ${year}. ${systemOf(record, active).name} events are highlighted.`}>
          {MONTHS.map((label, m) => (
            <MonthRow
              key={`${pp.patient.id}-${year}-${m}`}
              label={label}
              month={m}
              year={year}
              events={events.filter((e) => monthOf(e) === m).sort((a, b) => a.date.localeCompare(b.date))}
              active={active}
              trackW={trackW}
              trackRef={m === 0 ? trackRef : undefined}
              selected={selected}
              setSelected={setSelected}
              setHover={setHover}
              changed={changed}
              refFor={refFor}
            />
          ))}
        </ol>
        <YearScrubber year={year} changeYear={changeYear} counts={counts} />
      </div>
    </div>
  );
}

function MonthRow({
  label,
  month,
  year,
  events,
  active,
  trackW,
  trackRef,
  selected,
  setSelected,
  setHover,
  changed,
  refFor,
}: {
  label: string;
  month: number;
  year: number;
  events: CareEvent[];
  active: string;
  trackW: number;
  trackRef?: React.RefObject<HTMLDivElement | null>;
  selected: string;
  setSelected: (id: string) => void;
  setHover: (id: string | null) => void;
  changed: boolean;
  refFor: (key: string) => (el: HTMLElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const isNow = year === NOW.year && month === NOW.month;
  const mine = events.filter((e) => e.systemId === active);
  const theirs = events.filter((e) => e.systemId !== active);
  const placed = placeBubbles(mine, trackW, BUBBLE);
  const usable = Math.max(120, trackW - BUBBLE - 8);

  return (
    <li className="relative flex flex-1 items-center" style={{ minHeight: ROW_H }}>
      <div ref={trackRef} className="relative h-full flex-1">
        {theirs.map((e) => {
          const d = e.weight === 3 ? 12 : e.weight === 2 ? 9 : 6;
          const x = ((dayOf(e) - 1) / 30) * usable * 0.95 + BUBBLE / 2;
          return (
            <span
              key={e.id}
              ref={refFor(`evt:${e.id}`)}
              aria-hidden="true"
              className="absolute top-1/2 z-[2] -translate-y-1/2 rounded-full bg-line-strong"
              style={{ left: x - d / 2, width: d, height: d }}
            />
          );
        })}
        {isNow ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 z-[1] w-px bg-ink/25" style={{ left: ((NOW.day - 1) / 30) * usable * 0.82 + BUBBLE / 2 }} />
        ) : null}
        {placed.map(({ e, x }, i) => {
          const Icon = EVENT_ICON[e.type];
          const sel = e.id === selected;
          const hollow = e.state === "scheduled" || e.state === "self-reported";
          return (
            <Tip
              key={e.id}
              label={
                <span>
                  <span className="block">{e.title}</span>
                  <span className="text-white/60">
                    {formatDate(e.date, { day: "numeric", month: "short" })} · {RECORD_STATE_LABEL[e.state]}
                  </span>
                </span>
              }
            >
              <motion.button
                ref={refFor(`evt:${e.id}`)}
                type="button"
                aria-label={`${EVENT_TYPE_LABEL[e.type]}: ${e.title}, ${formatDate(e.date)}, ${RECORD_STATE_LABEL[e.state]}`}
                aria-pressed={sel}
                onClick={() => setSelected(e.id)}
                onPointerEnter={() => setHover(e.conditionId)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(e.conditionId)}
                onBlur={() => setHover(null)}
                initial={changed && !reduce ? { scale: 0.3, opacity: 0 } : false}
                animate={{ scale: sel ? 1.14 : 1, opacity: 1 }}
                transition={{ ...pop, delay: changed ? Math.min(i, 6) * 0.03 : 0 }}
                whileHover={reduce ? undefined : { scale: sel ? 1.18 : 1.1 }}
                className={cn(
                  "absolute top-1/2 z-[2] -mt-[14px] flex size-7 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200",
                  sel ? "ring-[3px] ring-charcoal" : "ring-[3px] ring-surface",
                  e.state === "self-reported"
                    ? "border-[1.5px] border-dashed border-primary bg-surface text-primary"
                    : hollow
                      ? "bg-surface text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
                      : "bg-primary text-white hover:bg-primary-hover",
                )}
                style={{ left: x }}
              >
                <Icon size={13} aria-hidden="true" />
                {e.state === "awaiting-review" ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning ring-2 ring-surface" /> : null}
              </motion.button>
            </Tip>
          );
        })}
      </div>
      <span className={cn("w-[84px] shrink-0 pr-3 text-right text-xs", isNow ? "font-medium text-ink" : "text-muted")}>
        {label}
        {isNow ? <span className="block text-[11px] font-normal text-muted">Today · {NOW.day}</span> : null}
      </span>
    </li>
  );
}

function YearScrubber({ year, changeYear, counts }: { year: number; changeYear: (y: number) => void; counts: { year: number; months: number[] }[] }) {
  const dot = (n: number) => (n >= 3 ? 8 : n === 2 ? 6 : n === 1 ? 5 : 3);
  return (
    <LayoutGroup id="proof-years">
      <div role="radiogroup" aria-label="Timeline year" className="flex w-16 shrink-0 flex-col items-center gap-3 pr-4">
        {counts.map(({ year: y, months }) => {
          const on = y === year;
          return (
            <Tip key={y} label={`${months.reduce((s, n) => s + n, 0)} events in this system · dot size = events per month`} side="left">
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${y}, ${months.reduce((sum, n) => sum + n, 0)} events for this body system`}
                onClick={() => changeYear(y)}
                className={cn("relative flex w-12 flex-col items-center gap-2 rounded-full py-3 transition-colors duration-200", !on && "text-muted hover:text-ink")}
              >
                {on ? <motion.span layoutId="proof-year-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                <span className={cn("relative z-[1] text-[11px] tabular", on && "text-white")}>{y}</span>
                <span aria-hidden="true" className="relative z-[1] flex flex-col items-center gap-1.5">
                  {(on ? months : months.filter((_, i) => i % 2 === 0)).map((n, i) => (
                    <span key={i} className={cn("rounded-full", on ? "bg-white" : "bg-line-strong")} style={{ width: dot(n), height: dot(n), opacity: on && n === 0 ? 0.35 : 1 }} />
                  ))}
                </span>
              </button>
            </Tip>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** What each mark on the desktop care map means (doc §10: a legend wherever marks could be ambiguous). */
function Legend() {
  return (
    <ul aria-label="How to read the care map" className="mt-3 hidden flex-wrap items-center justify-end gap-x-4 gap-y-1.5 text-[11px] text-muted xl:flex">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
        Event in the system in focus
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-primary)]" />
        Scheduled
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full border border-dashed border-primary" />
        Self-reported
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
        Awaiting review
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-line-strong" />
        Other body systems
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-px w-4 bg-primary" />
        Line = event documented against that condition
      </li>
      <li>Position = day of the month</li>
    </ul>
  );
}

/* ------------------------------------------------------------------ compact (< 1280px) */

function CompactProof({ pp, record, events, event, active, year, setSelected, focusSystem, changeYear, showOrgan }: Shared & { events: CareEvent[]; event: CareEvent; showOrgan: boolean }) {
  const { patient } = pp;
  const sys = systemOf(record, active);
  const featured = conditionOf(record, sys.featuredConditionId) ?? conditionsIn(record, sys.id)[0];
  const share = systemShares(record).find((s) => s.id === sys.id);
  const list = events
    .filter((e) => e.systemId === active && e.state !== "scheduled")
    .sort((a, b) => b.date.localeCompare(a.date) || b.enteredAt.localeCompare(a.enteredAt))
    .slice(0, 6);
  const authors = careTeamActivity(record).slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:hidden">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3 rounded-card bg-sunken p-2 pr-2">
          <Avatar src={patient.avatar} name={patient.name} size="md" loading="eager" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
            <p className="truncate text-xs text-muted">
              {patient.age} years · <span className="font-mono">{clinicNumber(patient.id)}</span>
            </p>
          </div>
          <span className="sr-only">Records authored by: {authors.map((a) => `${a.staff.name} (${a.count})`).join(", ")}</span>
          <EagerAvatarStack people={authors.map((a) => ({ name: a.staff.name, avatar: a.staff.avatar }))} size="sm" />
          <OpenRecordButton patientId={patient.id} tone="surface" />
        </div>

        {record.systems.length > 1 ? (
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-none" data-lenis-prevent>
            <Segmented
              variant="tray"
              size="sm"
              ariaLabel="Body system"
              value={active}
              onChange={focusSystem}
              className="w-max"
              items={record.systems.map((b) => ({ value: b.id, label: b.name.replace("Blood ", "") }))}
            />
          </div>
        ) : null}

        <div className="relative h-[232px] overflow-hidden rounded-card bg-primary text-white">
          <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">
            {share ? `${share.percent}% of activity · 12 mo` : `${sys.conditionIds.length} conditions`}
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={`${patient.id}-${sys.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={spring}
              className="absolute left-4 top-16 z-[2] max-w-[150px] text-[22px] leading-[1.1] tracking-[-0.015em]"
            >
              {sys.name}
            </motion.p>
          </AnimatePresence>
          {showOrgan ? (
            <OrganCanvas
              shape={sys.organ}
              label={`3D illustration of the ${ORGAN_LABEL[sys.organ].toLowerCase()} — ${patient.name}'s ${sys.name} system`}
              className="pointer-events-none absolute -right-2 top-4 z-[1] size-[200px]"
            />
          ) : null}
          {featured ? (
            <div className="absolute inset-x-4 bottom-4 z-[2] flex items-center justify-between gap-2 rounded-full bg-white/15 py-1 pl-4 pr-1 backdrop-blur-sm">
              <span className="min-w-0 truncate text-xs">
                {featured.name} · <span className="text-white/70">{featured.status}</span>
              </span>
              <OpenRecordButton patientId={patient.id} size="sm" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 rounded-card bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink">Latest events</p>
          {record.years.length > 1 ? (
            <Segmented
              size="sm"
              variant="tray"
              ariaLabel="Timeline year"
              value={String(year)}
              onChange={(v) => changeYear(Number(v))}
              items={record.years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          ) : null}
        </div>
        {list.length === 0 ? (
          <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-muted">
            No {sys.name.toLowerCase()} events recorded in {year}. Pick another year or system.
          </p>
        ) : (
          <ol className="relative mt-4 flex flex-col gap-1">
            <span aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-px bg-line-strong" />
            {list.map((e) => {
              const Icon = EVENT_ICON[e.type];
              const open = e.id === event.id;
              return (
                <li key={e.id} className="relative">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setSelected(e.id)}
                    className={cn("flex w-full items-center gap-3 rounded-inner p-0 py-1 pr-2 text-left transition-colors", !open && "hover:bg-canvas")}
                  >
                    <span
                      className={cn(
                        "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
                        e.state === "self-reported" ? "border-[1.5px] border-dashed border-primary bg-surface text-primary" : "bg-primary text-white",
                      )}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{e.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatDate(e.date, { day: "numeric", month: "short" })} · entered {formatDate(e.enteredAt, { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <StatusBadge tone={recordTone(e.state)} className="hidden sm:inline-flex">
                      {RECORD_STATE_LABEL[e.state]}
                    </StatusBadge>
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                        <EventDetail event={e} framed={false} className="mb-2 ml-[52px] mt-1 rounded-inner bg-canvas p-4" />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
