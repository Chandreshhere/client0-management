"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListBullets, Minus, Plus, Graph } from "@phosphor-icons/react";
import type { BodySystemId, CareEvent } from "@/data/featured";
import { EVENT_TYPE_LABEL, RECORD_STATE_LABEL } from "@/data/featured";
import { useRecord } from "./record-context";
import { cn } from "@/lib/cn";
import { pop, snappy } from "@/lib/motion";
import { formatDate } from "@/lib/format";
import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tooltip";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/input";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { useAnchor } from "./connectors";
import { EVENT_ICON, MONTHS, authorAvatar, authorName } from "./event-meta";

export type Zoom = 0 | 1 | 2;
const ROW_H: Record<Zoom, number> = { 0: 44, 1: 56, 2: 104 };
const BUBBLE: Record<Zoom, number> = { 0: 32, 1: 40, 2: 44 };
const TODAY = { year: 2026, month: 10, day: 13 };

export function TimelinePanel({
  events: allEvents,
  year,
  onYear,
  activeSystem,
  zoom,
  onZoom,
  view,
  onView,
  half,
  onHalf,
  onOpenEvent,
  onHoverCondition,
  className,
  compact = false,
}: {
  compact?: boolean;
  events: CareEvent[];
  year: number;
  onYear: (y: number) => void;
  activeSystem: BodySystemId;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  view: "map" | "list";
  onView: (v: "map" | "list") => void;
  half: 0 | 1;
  onHalf: (h: 0 | 1) => void;
  onOpenEvent: (id: string) => void;
  onHoverCondition: (conditionId: string | null) => void;
  className?: string;
}) {
  const { record } = useRecord();
  const TIMELINE_YEARS = record.years;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(320);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTrackW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const yearEvents = useMemo(() => allEvents.filter((e) => e.date.startsWith(String(year))), [allEvents, year]);
  const months = zoom === 2 ? (half === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]) : Array.from({ length: 12 }, (_, i) => i);

  const yearCounts = useMemo(
    () =>
      Object.fromEntries(
        TIMELINE_YEARS.map((y) => [
          y,
          Array.from({ length: 12 }, (_, m) => allEvents.filter((e) => e.systemId === activeSystem && e.date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)).length),
        ]),
      ) as Record<number, number[]>,
    [activeSystem, allEvents],
  );

  return (
    <section aria-labelledby="timeline-heading" className={cn("relative rounded-card bg-surface", className)}>
      <h2 id="timeline-heading" className="sr-only">
        Care timeline {year}
      </h2>
      {compact ? (
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <Segmented
            size="sm"
            variant="tray"
            ariaLabel="Timeline year"
            value={String(year)}
            onChange={(v) => onYear(Number(v))}
            items={TIMELINE_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <IconButton label={view === "map" ? "Show as chronological list" : "Show as care map"} size="sm" onClick={() => onView(view === "map" ? "list" : "map")}>
            {view === "map" ? <ListBullets /> : <Graph />}
          </IconButton>
        </div>
      ) : null}
      <div className="flex">
        <div className={cn("min-w-0 flex-1 py-4 pl-4", compact && "pr-1")}>
          {view === "map" ? (
            <>
              {zoom === 2 ? (
                <div className="mb-2 flex items-center justify-between pr-2">
                  <Segmented
                    size="sm"
                    variant="tray"
                    ariaLabel="Half year"
                    value={String(half) as "0" | "1"}
                    onChange={(v) => onHalf(Number(v) as 0 | 1)}
                    items={[
                      { value: "0", label: "Jan – Jun" },
                      { value: "1", label: "Jul – Dec" },
                    ]}
                  />
                  <span className="text-xs text-muted">Detailed view</span>
                </div>
              ) : null}
              <ol className="relative" aria-label={`Events by month, ${year}`}>
                {months.map((m) => (
                  <MonthRow
                    key={`${year}-${m}-${zoom}`}
                    year={year}
                    month={m}
                    events={yearEvents.filter((e) => Number(e.date.slice(5, 7)) === m + 1)}
                    activeSystem={activeSystem}
                    zoom={zoom}
                    trackW={trackW}
                    trackRef={m === months[0] ? trackRef : undefined}
                    onOpenEvent={onOpenEvent}
                    onHoverCondition={onHoverCondition}
                  />
                ))}
              </ol>
              <TimelineLegend activeSystem={activeSystem} />
            </>
          ) : (
            <TimelineList year={year} events={yearEvents} activeSystem={activeSystem} onOpenEvent={onOpenEvent} />
          )}
        </div>
        {compact ? null : <YearScrubber years={TIMELINE_YEARS} year={year} onYear={onYear} counts={yearCounts} zoom={zoom} onZoom={onZoom} view={view} onView={onView} />}
      </div>
    </section>
  );
}

function MonthRow({
  year,
  month,
  events,
  activeSystem,
  zoom,
  trackW,
  trackRef,
  onOpenEvent,
  onHoverCondition,
}: {
  year: number;
  month: number;
  events: CareEvent[];
  activeSystem: BodySystemId;
  zoom: Zoom;
  trackW: number;
  trackRef?: React.RefObject<HTMLDivElement | null>;
  onOpenEvent: (id: string) => void;
  onHoverCondition: (id: string | null) => void;
}) {
  const size = BUBBLE[zoom];
  const isNow = year === TODAY.year && month === TODAY.month;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const active = sorted.filter((e) => e.systemId === activeSystem);
  const muted = sorted.filter((e) => e.systemId !== activeSystem);

  // place active bubbles: natural day position, stacked with ~62% overlap when close (reference)
  const usable = Math.max(120, trackW - size - 8);
  let lastX = -Infinity;
  const placed = active.map((e) => {
    const day = Number(e.date.slice(8, 10));
    const natural = ((day - 1) / 30) * usable * 0.82;
    const x = Math.max(natural, lastX + size * 0.62);
    lastX = x;
    return { e, x: Math.min(x, usable) };
  });

  return (
    <li className="relative flex items-center" style={{ height: ROW_H[zoom] }}>
      <div ref={trackRef} className="relative h-full flex-1">
        {/* grey dots: events from the other body systems */}
        {muted.map((e) => {
          const day = Number(e.date.slice(8, 10));
          const x = ((day - 1) / 30) * usable * 0.95 + size / 2;
          return <MutedDot key={e.id} e={e} x={x} onOpen={onOpenEvent} onHover={onHoverCondition} />;
        })}
        {isNow ? (
          <div className="pointer-events-none absolute inset-y-1 z-[1] w-px bg-ink/25" style={{ left: ((TODAY.day - 1) / 30) * usable * 0.82 + size / 2 }} aria-hidden="true" />
        ) : null}
        {placed.map(({ e, x }, i) => (
          <Bubble key={e.id} e={e} x={x} size={size} index={i} zoom={zoom} onOpen={onOpenEvent} onHover={onHoverCondition} />
        ))}
        {zoom === 2 && active.length ? (
          <div className="absolute inset-x-0 bottom-2 flex gap-3 overflow-hidden pr-2 text-xs text-muted">
            {active.slice(0, 2).map((e) => (
              <button key={e.id} type="button" onClick={() => onOpenEvent(e.id)} className="truncate hover:text-ink">
                <span className="tabular text-ink-2">{Number(e.date.slice(8, 10))}</span> {e.title}
              </button>
            ))}
            {active.length > 2 ? <span className="shrink-0">+{active.length - 2}</span> : null}
          </div>
        ) : null}
      </div>
      <span className={cn("w-[84px] shrink-0 pr-2 text-right text-xs", isNow ? "font-medium text-ink" : "text-muted")}>
        {MONTHS[month]}
        {isNow ? <span className="block text-[10px] font-normal text-muted">Today · 13</span> : null}
      </span>
    </li>
  );
}

function Bubble({ e, x, size, index, zoom, onOpen, onHover }: { e: CareEvent; x: number; size: number; index: number; zoom: Zoom; onOpen: (id: string) => void; onHover: (id: string | null) => void }) {
  const ref = useAnchor(`evt:${e.id}`);
  const Icon = EVENT_ICON[e.type];
  const scheduled = e.state === "scheduled";
  const draft = e.state === "draft";
  const review = e.state === "awaiting-review";
  const label = `${EVENT_TYPE_LABEL[e.type]}: ${e.title}, ${formatDate(e.date)}, ${RECORD_STATE_LABEL[e.state]}`;
  return (
    <Tip label={<span><span className="block">{e.title}</span><span className="text-white/60">{formatDate(e.date, { day: "numeric", month: "short" })} · {RECORD_STATE_LABEL[e.state]}</span></span>}>
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={() => onOpen(e.id)}
        onPointerEnter={() => onHover(e.conditionId)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(e.conditionId)}
        onBlur={() => onHover(null)}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...pop, delay: Math.min(index, 6) * 0.03 }}
        whileHover={{ scale: 1.08, zIndex: 4 }}
        className={cn(
          "absolute top-1/2 z-[2] flex items-center justify-center rounded-full ring-[3px] ring-surface transition-colors",
          draft
            ? "border-2 border-dashed border-primary bg-surface text-primary"
            : scheduled
              ? "bg-surface text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
              : "bg-primary text-white hover:bg-primary-hover",
        )}
        style={{ left: x, width: size, height: size, marginTop: zoom === 2 ? -size / 2 - 14 : -size / 2 }}
      >
        <Icon size={size * 0.45} aria-hidden="true" />
        {review ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-warning ring-2 ring-surface" aria-hidden="true" /> : null}
      </motion.button>
    </Tip>
  );
}

function MutedDot({ e, x, onOpen, onHover }: { e: CareEvent; x: number; onOpen: (id: string) => void; onHover: (id: string | null) => void }) {
  const ref = useAnchor(`evt:${e.id}`);
  const { conditionById } = useRecord();
  const d = e.weight === 3 ? 12 : e.weight === 2 ? 9 : 6;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(e.id)}
      onPointerEnter={() => onHover(e.conditionId)}
      onPointerLeave={() => onHover(null)}
      aria-label={`${EVENT_TYPE_LABEL[e.type]}: ${e.title}, ${formatDate(e.date)} (${conditionById(e.conditionId)?.name})`}
      className="group absolute top-1/2 z-[2] -translate-y-1/2 rounded-full p-2"
      style={{ left: x - d / 2 - 8 }}
    >
      <span className="block rounded-full bg-line-strong transition-[background-color,transform] duration-200 group-hover:scale-125 group-hover:bg-faint" style={{ width: d, height: d }} />
    </button>
  );
}

/** Says what every mark on the care map means (dates are the event dates within each month). */
function TimelineLegend({ activeSystem }: { activeSystem: string }) {
  const { systemById } = useRecord();
  const name = systemById(activeSystem)?.name ?? "Focused";
  return (
    <div className="mr-2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-muted" aria-label="Legend">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />{name} event</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-primary)]" aria-hidden="true" />Scheduled</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-primary" aria-hidden="true" />Draft</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" aria-hidden="true" />Awaiting review</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-line-strong" aria-hidden="true" />Other body systems</span>
      <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-primary" aria-hidden="true" />Line = event documented against that condition</span>
      <span>Position = day of the month</span>
    </div>
  );
}

function YearScrubber({
  years: TIMELINE_YEARS,
  year,
  onYear,
  counts,
  zoom,
  onZoom,
  view,
  onView,
}: {
  years: number[];
  year: number;
  onYear: (y: number) => void;
  counts: Record<number, number[]>;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  view: "map" | "list";
  onView: (v: "map" | "list") => void;
}) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-3 py-4 pr-3">
      <LayoutGroup id="year-scrubber">
        <div role="radiogroup" aria-label="Timeline year" className="flex flex-col items-center gap-3">
          {TIMELINE_YEARS.map((y) => {
            const active = y === year;
            const c = counts[y] ?? [];
            return (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${y}, ${c.reduce((s, n) => s + n, 0)} events for this body system`}
                onClick={() => onYear(y)}
                className={cn("relative flex w-12 flex-col items-center gap-2 rounded-full py-3 transition-colors", !active && "text-muted hover:text-ink")}
              >
                {active ? <motion.span layoutId="year-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                <span className={cn("relative z-[1] text-[11px] tabular", active && "text-white")}>{y}</span>
                {active ? <span className="relative z-[1] h-px w-4 bg-white/40" aria-hidden="true" /> : null}
                <span className="relative z-[1] flex flex-col items-center gap-1.5" aria-hidden="true">
                  {(active ? c : c.filter((_, i) => i % 2 === 0)).map((n, i) => (
                    <span
                      key={i}
                      className={cn("rounded-full transition-all duration-300", active ? "bg-white" : "bg-line-strong")}
                      style={{ width: n >= 3 ? 8 : n === 2 ? 6 : n === 1 ? 5 : 3, height: n >= 3 ? 8 : n === 2 ? 6 : n === 1 ? 5 : 3, opacity: active && n === 0 ? 0.35 : 1 }}
                    />
                  ))}
                </span>
                {active ? <span className="relative z-[1] h-px w-4 bg-white/40" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <div className="mt-auto flex flex-col items-center gap-2 pt-4">
        <IconButton label={view === "map" ? "Show as chronological list" : "Show as care map"} tooltip="left" size="md" variant="white" onClick={() => onView(view === "map" ? "list" : "map")}>
          {view === "map" ? <ListBullets /> : <Graph />}
        </IconButton>
        <IconButton label="Zoom in" tooltip="left" disabled={view === "list" || zoom === 2} onClick={() => onZoom((zoom + 1) as Zoom)}>
          <Plus />
        </IconButton>
        <IconButton label="Zoom out" tooltip="left" disabled={view === "list" || zoom === 0} onClick={() => onZoom((zoom - 1) as Zoom)}>
          <Minus />
        </IconButton>
      </div>
    </div>
  );
}

/** Chronological list (mobile default; doc §6 "easier to scan precisely"). */
export function TimelineList({ year, events, activeSystem, onOpenEvent }: { year: number; events: CareEvent[]; activeSystem: BodySystemId; onOpenEvent: (id: string) => void }) {
  const { record, conditionById } = useRecord();
  const [system, setSystem] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const list = events
    .filter((e) => (system === "all" ? true : e.systemId === system))
    .filter((e) => (type === "all" ? true : e.type === type))
    .sort((a, b) => b.date.localeCompare(a.date));
  const grouped = MONTHS.map((m, i) => ({ m, i, items: list.filter((e) => Number(e.date.slice(5, 7)) === i + 1) })).filter((g) => g.items.length).reverse();

  return (
    <div className="pr-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1" data-lenis-prevent>
        <Segmented
          size="sm"
          variant="tray"
          ariaLabel="Body system"
          value={system}
          onChange={setSystem}
          items={[{ value: "all", label: "All" }, ...record.systems.map((s) => ({ value: s.id, label: s.name.replace("Blood ", "") }))]}
        />
        </div>
        <Select
          size="sm"
          ariaLabel="Event type"
          value={type}
          onValueChange={setType}
          className="w-[150px]"
          options={[{ value: "all", label: "All event types" }, ...Object.entries(EVENT_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
        />
      </div>
      {grouped.length === 0 ? (
        <EmptyState title={`No events match in ${year}`} description="Try another body system or event type." />
      ) : (
        <div data-lenis-prevent className="scrollbar-thin max-h-[620px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {grouped.map((g) => (
              <div key={g.m} className="mb-4">
                <h3 className="sticky top-0 z-[1] bg-surface py-1 text-xs text-muted">{g.m} {year}</h3>
                <ul className="flex flex-col gap-1">
                  {g.items.map((e) => {
                    const Icon = EVENT_ICON[e.type];
                    const mine = e.systemId === activeSystem;
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={() => onOpenEvent(e.id)} className="flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-colors hover:bg-canvas">
                          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", mine ? "bg-primary text-white" : "bg-sunken text-ink-2")}>
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{e.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {formatDate(e.date, { day: "numeric", month: "short" })} · {conditionById(e.conditionId)?.name}
                            </span>
                          </span>
                          <StatusBadge tone={recordTone(e.state)} className="hidden sm:inline-flex">{RECORD_STATE_LABEL[e.state]}</StatusBadge>
                          <Avatar src={authorAvatar(e.authorId)} name={authorName(e.authorId)} size="xs" className="hidden sm:inline-flex" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
