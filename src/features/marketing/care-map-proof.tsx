"use client";

import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Files } from "@phosphor-icons/react";
import { BODY_SYSTEMS, CARE_EVENTS, CONDITIONS, EVENT_TYPE_LABEL, RECORD_STATE_LABEL, conditionById, systemById, type BodySystemId, type CareEvent } from "@/data/featured";
import { clinicNumber, patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import type { Role } from "@/data/types";
import { OrganCanvas } from "@/features/patient/organ-canvas";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { pop, snappy, spring } from "@/lib/motion";
import { DEFAULT_EVENT, EVENT_ICON, MONTHS, NOW, PROOF_YEARS, dayOf, eventsIn, latestFor, monthOf, placeBubbles, threadLinks, type ProofYear } from "./care-map-model";
import { EventDetail } from "./event-detail";
import { ThreadLayer, useAnchors } from "./thread-layer";

/**
 * Hero product proof — a scaled-down, working recreation of the patient care map:
 * body systems (focal cobalt card + recessed grey cards) → threads → a year of dated events.
 * Desktop (≥1280px): four tracks with threads. Below: a recomposed system switcher and a
 * chronological list (doc §6: the list is easier to scan on small screens).
 * All data is synthetic (Kabir Malhotra, 30). Threads mean "documented link", never causation.
 */

const PATIENT = patientById("p-kabir")!;
const TEAM: { id: string; role: Role; dot: string }[] = [
  { id: PATIENT.careTeam.doctor ?? "s-ananya", role: "doctor", dot: "bg-medical" },
  { id: PATIENT.careTeam.nutritionist ?? "s-meera", role: "nutritionist", dot: "bg-nutrition" },
  { id: PATIENT.careTeam.yoga ?? "s-kavya", role: "yoga", dot: "bg-movement" },
];
const ROW_H = 42;
const BUBBLE = 28;
const DEFAULT_TRACK = 372;

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
  const [active, setActive] = useState<BodySystemId>("circulatory");
  const [year, setYear] = useState<ProofYear>(2026);
  const [selected, setSelected] = useState<string>(DEFAULT_EVENT);
  const [hover, setHover] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, refFor } = useAnchors();

  const yearEvents = useMemo(() => eventsIn(year), [year]);
  const event = CARE_EVENTS.find((e) => e.id === selected) ?? yearEvents[yearEvents.length - 1];
  const links = useMemo(() => threadLinks(year, active), [year, active]);

  const focusSystem = (id: BodySystemId) => {
    if (id === active) return;
    setChanged(true);
    setActive(id);
    const latest = latestFor(year, (e) => e.systemId === id);
    if (latest) setSelected(latest.id);
  };
  const changeYear = (y: ProofYear) => {
    if (y === year) return;
    setChanged(true);
    setYear(y);
    const latest = latestFor(y, (e) => e.systemId === active);
    if (latest) setSelected(latest.id);
  };
  const pickCondition = (cid: string) => {
    const c = conditionById(cid);
    if (!c) return;
    if (c.systemId !== active) {
      setChanged(true);
      setActive(c.systemId);
    }
    const latest = latestFor(year, (e) => e.conditionId === cid);
    if (latest) setSelected(latest.id);
  };

  const shared = { active, year, selected, hover, setHover, setSelected, focusSystem, changeYear, pickCondition, changed, refFor };

  return (
    <div>
      {/* ≥1280px: the care map with threads */}
      <div ref={containerRef} className="relative hidden xl:grid xl:grid-cols-[232px_minmax(320px,360px)_minmax(40px,1fr)_minmax(440px,548px)] xl:gap-x-6">
        <SummaryColumn event={event} />
        <SystemsColumn {...shared} showOrgan={wide === true} />
        <div aria-hidden="true" />
        <TimelineCard {...shared} events={yearEvents} />
        <ThreadLayer containerRef={containerRef} anchors={map} threads={links} version={`${active}-${year}`} highlightGroup={hover} selectedEvent={selected} enabled={wide === true} />
      </div>

      {/* <1280px: system switcher + chronological list */}
      <CompactProof {...shared} events={yearEvents} event={event} showOrgan={wide === false} />
    </div>
  );
}

type Shared = {
  active: BodySystemId;
  year: ProofYear;
  selected: string;
  hover: string | null;
  setHover: (id: string | null) => void;
  setSelected: (id: string) => void;
  focusSystem: (id: BodySystemId) => void;
  changeYear: (y: ProofYear) => void;
  pickCondition: (cid: string) => void;
  changed: boolean;
  refFor: (key: string) => (el: HTMLElement | null) => void;
};

/* ------------------------------------------------------------------ summary column */

function SummaryColumn({ event }: { event: CareEvent }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-card bg-sunken p-2">
        <Avatar src={PATIENT.avatar} name={PATIENT.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{PATIENT.name}</p>
          <p className="truncate text-xs text-muted">{PATIENT.age} years old</p>
        </div>
        <Tip label="Open this record in the live demo">
          <Link
            href="/demo"
            aria-label="Open Kabir Malhotra's record in the live demo"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] duration-200 hover:bg-canvas active:scale-95"
          >
            <ArrowUpRight size={18} />
          </Link>
        </Tip>
      </div>

      <div className="rounded-card bg-surface p-4">
        <p className="flex items-center justify-between gap-2 text-xs text-muted">
          Care team
          <span className="font-mono text-ink-2">{clinicNumber(PATIENT.id)}</span>
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {TEAM.map((t) => {
            const person = staffById(t.id);
            return (
              <li key={t.id} className="flex items-center gap-3">
                <Avatar src={person?.avatar} name={person?.name ?? DEMO_USER[t.role].label} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{person?.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full", t.dot)} />
                    {DEMO_USER[t.role].label}
                  </span>
                </span>
              </li>
            );
          })}
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

function SystemsColumn({ active, hover, setHover, focusSystem, pickCondition, setSelected, year, refFor, showOrgan }: Shared & { showOrgan: boolean }) {
  const sys = systemById(active);
  const others = BODY_SYSTEMS.filter((b) => b.id !== active);
  const featured = conditionById(sys.featuredConditionId)!;
  const secondary = sys.conditionIds.filter((c) => c !== sys.featuredConditionId).map((id) => conditionById(id)!);
  const latest = latestFor(year, (e) => e.systemId === active);

  return (
    <div className="flex flex-col">
      <div className="relative h-[288px]">
        <div className="absolute left-0 top-0 h-[248px] w-[208px] overflow-hidden rounded-card bg-primary text-white">
          <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">
            {sys.conditionIds.length} instances
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={sys.id}
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
            <Tip label="Show the latest record">
              <button
                type="button"
                aria-label={`Show the latest ${sys.name} record`}
                onClick={() => latest && setSelected(latest.id)}
                className="flex size-10 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                <Files size={18} />
              </button>
            </Tip>
            <Tip label="Open in the live demo">
              <Link href="/demo" aria-label="Open this record in the live demo" className="flex size-10 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 hover:scale-105 active:scale-95">
                <ArrowUpRight size={18} />
              </Link>
            </Tip>
          </div>
        </div>

        {showOrgan ? <OrganCanvas shape={sys.organ} label={`Illustration: ${sys.organ}`} className="pointer-events-none absolute left-[40px] top-[80px] z-[2] size-[188px]" /> : null}

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
            aria-label={`${featured.name}, ${featured.status}. Show its latest event`}
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
                <ArrowUpRight size={16} />
              </span>
            </span>
            <span className="mt-2 text-lg leading-[1.15] tracking-[-0.01em]">{featured.name}</span>
            <span className="mt-1 text-xs text-white/60">{featured.markers} markers</span>
            <span className="mt-auto text-xs text-white/60">Since {formatDate(featured.since, { month: "short", year: "numeric" })}</span>
          </motion.button>
        </AnimatePresence>

        <div className="absolute left-[152px] top-[236px] z-[3] flex flex-col items-start gap-2">
          {secondary.map((c) => (
            <ConditionChip key={c.id} id={c.id} name={c.name} tone="white" {...{ hover, setHover, pickCondition, refFor }} />
          ))}
        </div>
      </div>

      <LayoutGroup id="proof-systems">
        <div className="mt-4 flex flex-col gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {others.map((b) => {
              const conditions = CONDITIONS.filter((c) => c.systemId === b.id);
              return (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={spring}
                  className="flex items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={() => focusSystem(b.id)}
                    aria-label={`Focus the ${b.name} system`}
                    className="relative h-[112px] w-[188px] shrink-0 rounded-card bg-sunken text-left transition-colors duration-200 hover:bg-sunken-2"
                  >
                    <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                      {conditions.length} instances
                    </span>
                    <span className="absolute bottom-4 left-4 text-[20px] leading-none tracking-[-0.015em] text-ink">{b.name}</span>
                  </button>
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    {conditions.map((c) => (
                      <ConditionChip key={c.id} id={c.id} name={c.name} tone="light" {...{ hover, setHover, pickCondition, refFor }} />
                    ))}
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
        "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-xs transition-[background-color,box-shadow,color] duration-200",
        tone === "white" ? "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-surface/60 text-ink-2",
        on ? "bg-charcoal text-white shadow-none" : "hover:bg-surface hover:text-ink",
      )}
    >
      {name}
    </button>
  );
}

/* ------------------------------------------------------------------ timeline */

function TimelineCard({ events, active, year, selected, setSelected, setHover, changeYear, changed, refFor }: Shared & { events: CareEvent[] }) {
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
    () =>
      Object.fromEntries(
        PROOF_YEARS.map((y) => [y, Array.from({ length: 12 }, (_, m) => eventsIn(y).filter((e) => e.systemId === active && monthOf(e) === m).length)]),
      ) as Record<ProofYear, number[]>,
    [active],
  );

  return (
    <div className="flex rounded-card bg-surface py-4 pl-4">
      <div className="flex min-h-0 flex-1">
        <ol className="flex min-w-0 flex-1 flex-col" aria-label={`Care events by month, ${year}. ${systemById(active).name} events are highlighted.`}>
          {MONTHS.map((label, m) => (
            <MonthRow
              key={`${year}-${m}`}
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
  active: BodySystemId;
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

function YearScrubber({ year, changeYear, counts }: { year: ProofYear; changeYear: (y: ProofYear) => void; counts: Record<ProofYear, number[]> }) {
  const dot = (n: number) => (n >= 3 ? 8 : n === 2 ? 6 : n === 1 ? 5 : 3);
  return (
    <LayoutGroup id="proof-years">
      <div role="radiogroup" aria-label="Timeline year" className="flex w-16 shrink-0 flex-col items-center gap-3 pr-4">
        {PROOF_YEARS.map((y) => {
          const on = y === year;
          const c = counts[y];
          return (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${y}, ${c.reduce((sum, n) => sum + n, 0)} events for this body system`}
              onClick={() => changeYear(y)}
              className={cn("relative flex w-12 flex-col items-center gap-2 rounded-full py-3 transition-colors duration-200", !on && "text-muted hover:text-ink")}
            >
              {on ? <motion.span layoutId="proof-year-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
              <span className={cn("relative z-[1] text-[11px] tabular", on && "text-white")}>{y}</span>
              <span aria-hidden="true" className="relative z-[1] flex flex-col items-center gap-1.5">
                {(on ? c : c.filter((_, i) => i % 2 === 0)).map((n, i) => (
                  <span key={i} className={cn("rounded-full", on ? "bg-white" : "bg-line-strong")} style={{ width: dot(n), height: dot(n), opacity: on && n === 0 ? 0.35 : 1 }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ compact (< 1280px) */

function CompactProof({ events, event, active, year, setSelected, focusSystem, changeYear, showOrgan }: Shared & { events: CareEvent[]; event: CareEvent; showOrgan: boolean }) {
  const sys = systemById(active);
  const featured = conditionById(sys.featuredConditionId)!;
  const list = events
    .filter((e) => e.systemId === active && e.state !== "scheduled")
    .sort((a, b) => b.date.localeCompare(a.date) || b.enteredAt.localeCompare(a.enteredAt))
    .slice(0, 6);
  const team = TEAM.map((t) => staffById(t.id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:hidden">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3 rounded-card bg-sunken p-2 pr-4">
          <Avatar src={PATIENT.avatar} name={PATIENT.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{PATIENT.name}</p>
            <p className="truncate text-xs text-muted">
              {PATIENT.age} years · <span className="font-mono">{clinicNumber(PATIENT.id)}</span>
            </p>
          </div>
          <span className="sr-only">Care team: {team.map((p) => p.name).join(", ")}</span>
          <AvatarStack people={team.map((p) => ({ name: p.name, avatar: p.avatar }))} size="sm" />
        </div>

        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none" data-lenis-prevent>
          <Segmented
            variant="tray"
            size="sm"
            ariaLabel="Body system"
            value={active}
            onChange={focusSystem}
            className="w-max"
            items={BODY_SYSTEMS.map((b) => ({ value: b.id, label: b.name.replace("Blood ", "") }))}
          />
        </div>

        <div className="relative h-[232px] overflow-hidden rounded-card bg-primary text-white">
          <span className="absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">
            {sys.conditionIds.length} instances
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p key={sys.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="absolute left-4 top-16 z-[2] max-w-[150px] text-[22px] leading-[1.1] tracking-[-0.015em]">
              {sys.name}
            </motion.p>
          </AnimatePresence>
          {showOrgan ? <OrganCanvas shape={sys.organ} label={`Illustration: ${sys.organ}`} className="pointer-events-none absolute -right-2 top-4 z-[1] size-[200px]" /> : null}
          <div className="absolute inset-x-4 bottom-4 z-[2] flex items-center justify-between gap-2 rounded-full bg-white/15 py-1 pl-4 pr-1 backdrop-blur-sm">
            <span className="min-w-0 truncate text-xs">
              {featured.name} · <span className="text-white/70">{featured.status}</span>
            </span>
            <Link href="/demo" aria-label="Open this record in the live demo" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-ink">
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-card bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink">Latest events</p>
          <Segmented size="sm" variant="tray" ariaLabel="Timeline year" value={String(year) as `${ProofYear}`} onChange={(v) => changeYear(Number(v) as ProofYear)} items={PROOF_YEARS.map((y) => ({ value: String(y) as `${ProofYear}`, label: String(y) }))} />
        </div>
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
                  <span className={cn("relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", e.state === "self-reported" ? "border-[1.5px] border-dashed border-primary bg-surface text-primary" : "bg-primary text-white")}>
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
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring}
                      className="overflow-hidden"
                    >
                      <EventDetail event={e} framed={false} className="mb-2 ml-[52px] mt-1 rounded-inner bg-canvas p-4" />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
