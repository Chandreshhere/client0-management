"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { Coffee, Plus, Warning } from "@phosphor-icons/react";
import type { Staff } from "@/data/types";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DISCIPLINE_COLOR, LUNCH, NOW_MIN, TODAY_KEY } from "./data";
import { hhmm, hoursLabel, hoursOn, isSunday, layoutLanes, rangeLabel, type DiaryEvent } from "./engine";
import { ApptStatus, DisciplineDot } from "./ui";
import { scheduleAccess, serviceText } from "./access";
import { useRole } from "@/components/shell/role-context";

/** 30 minutes = 64px (8px grid); 15 minutes = 32px. */
export const ROW = 64;
const PX = ROW / 30;
/** Minimum practitioner column width. */
const COL = 136;

export type GridColumn = { staff: Staff; events: DiaryEvent[]; you: boolean; leave?: string; count: number };

type BlockShared = {
  privacy: boolean;
  nameOf: (ev: DiaryEvent) => string;
  onOpenChange: (id: string | null) => void;
  renderDetails: (ev: DiaryEvent) => ReactNode;
};

/**
 * Day view: one grey track per practitioner on a 30-minute grid, white appointment cards with a
 * discipline bar. Tracks are 16px-radius surfaces inside the 24px card with an 8px inset; cards
 * sit 4px in, so their radius is 12px (concentric).
 */
export function TimeGrid({
  date,
  columns,
  range,
  selectedId,
  recentIds,
  doubleIds,
  onSlot,
  scrollTo,
  ...shared
}: BlockShared & {
  date: string;
  columns: GridColumn[];
  range: { start: number; end: number };
  selectedId: string | null;
  recentIds: string[];
  doubleIds: Set<string>;
  /** omitted for roles that can't book: empty slots aren't clickable */
  onSlot?: (staffId: string, min: number) => void;
  /** scroll the diary so `min` sits `lead` minutes below the top (default 90) */
  scrollTo: { min: number; n: number; lead?: number } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const height = (range.end - range.start) * PX;
  const isToday = date === TODAY_KEY;
  const y = (min: number) => (min - range.start) * PX;
  const showNow = isToday && NOW_MIN >= range.start && NOW_MIN <= range.end;
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let m = Math.ceil(range.start / 60) * 60; m <= range.end; m += 60) out.push(m);
    return out;
  }, [range.start, range.end]);

  // Land on "now" for today, otherwise on the first booking of the day.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = Math.min(...columns.flatMap((c) => c.events.map((e) => e.start)), 9 * 60);
    const target = isToday ? NOW_MIN - 70 : first - 30;
    el.scrollTop = Math.max(0, (target - range.start) * PX);
    // only when the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollTo) return;
    el.scrollTo({ top: Math.max(0, (scrollTo.min - (scrollTo.lead ?? 90) - range.start) * PX), behavior: "smooth" });
  }, [scrollTo, range.start]);

  return (
    <motion.div
      ref={scrollRef}
      layoutScroll
      className="scrollbar-thin relative overflow-auto rounded-b-inner"
      style={{ height: "max(440px, calc(100dvh - 296px))" }}
    >
      {/* 136px tracks + 4px gaps: a full seven-person day fits 1366px with the sidebar open, so the
          last column is no longer cut at the scroller's edge mid-word */}
      <div className="relative" style={{ minWidth: 48 + columns.length * (COL + 4) }}>
        {/* header row */}
        <div className="sticky top-0 z-30 flex gap-1 bg-surface pb-1">
          <div className="sticky left-0 z-10 flex w-12 shrink-0 items-end justify-center bg-surface pb-2">
            <span className="font-mono text-[11px] text-muted">IST</span>
          </div>
          {columns.map((c) => (
            <div
              key={c.staff.id}
              title={`${c.staff.name} · ${c.staff.title} · ${c.count} booked${hoursOn(c.staff.id, date) ? ` · works ${hoursLabel(hoursOn(c.staff.id, date)!)}` : ""}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2"
              style={{ minWidth: COL }}
            >
              <Avatar src={c.staff.avatar} name={c.staff.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-5 text-ink">{c.staff.name}</p>
                <p className={cn("flex items-center gap-1.5 text-xs", c.leave ? "text-warning" : "text-muted")}>
                  {c.leave ? (
                    <span className="truncate">{c.leave}</span>
                  ) : (
                    <>
                      <DisciplineDot discipline={c.staff.discipline} />
                      <span className="truncate">
                        {c.you ? <span className="text-ink">You · </span> : null}
                        {c.staff.room}
                      </span>
                      <span className="sr-only">, {c.count} booked</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* body */}
        <div className="relative flex gap-1" style={{ height }}>
          <div className="sticky left-0 z-20 w-12 shrink-0 bg-surface">
            {hours.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-muted" style={{ top: y(m) }}>
                {hhmm(m)}
              </span>
            ))}
            {showNow ? (
              <span className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-charcoal px-1.5 font-mono text-[11px] leading-5 text-white" style={{ top: y(NOW_MIN) }}>
                {hhmm(NOW_MIN)}
              </span>
            ) : null}
          </div>

          <div className="relative flex flex-1 gap-1">
            {columns.map((c) => (
              <Track key={c.staff.id} col={c} date={date} range={range} isToday={isToday} selectedId={selectedId} recentIds={recentIds} doubleIds={doubleIds} onSlot={onSlot} {...shared} />
            ))}
            {showNow ? (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20" style={{ top: y(NOW_MIN) }}>
                <div className="h-0.5 -translate-y-1/2 bg-charcoal" />
                <span className="absolute -left-1 top-0 size-2 -translate-y-1/2 rounded-full bg-charcoal" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const Track = memo(function Track({
  col,
  date,
  range,
  isToday,
  selectedId,
  recentIds,
  doubleIds,
  onSlot,
  ...shared
}: BlockShared & {
  col: GridColumn;
  date: string;
  range: { start: number; end: number };
  isToday: boolean;
  selectedId: string | null;
  recentIds: string[];
  doubleIds: Set<string>;
  /** omitted for roles that can't book: empty slots aren't clickable */
  onSlot?: (staffId: string, min: number) => void;
}) {
  const [ghost, setGhost] = useState<number | null>(null);
  const lanes = useMemo(() => layoutLanes(col.events), [col.events]);
  const y = (min: number) => (min - range.start) * PX;
  const height = (range.end - range.start) * PX;
  const firstHour = ((60 - (range.start % 60)) % 60) * PX;

  const snap = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const raw = range.start + Math.floor((e.clientY - r.top) / PX / 15) * 15;
    return Math.max(range.start, Math.min(range.end - 30, raw));
  };
  const canBook = (min: number) => !!onSlot && !col.leave && date >= TODAY_KEY && !isSunday(date) && !(isToday && min < NOW_MIN);

  // Off-duty time from the staff profile hours, inside the visible range (leave hatches the whole column).
  const hours = col.leave ? null : hoursOn(col.staff.id, date);
  // The label pill sits at the edge next to working time, unless a booking covers that spot.
  const free = (a: number, b: number) => !col.events.some((e) => e.start < b && a < e.end);
  const place = (from: number, to: number, prefer: "start" | "end") => {
    if (to - from < 45) return null;
    const fits = (at: "start" | "end") => (at === "start" ? free(from, from + 20) : free(to - 20, to));
    const other = prefer === "start" ? "end" : "start";
    return fits(prefer) ? prefer : fits(other) ? other : null;
  };
  const offBlocks = hours
    ? [
        { key: "before", from: range.start, to: Math.min(hours.start, range.end), label: `Off duty until ${hhmm(hours.start)}`, prefer: "end" as const },
        { key: "after", from: Math.max(hours.end, range.start), to: range.end, label: `Off duty from ${hhmm(hours.end)}`, prefer: "start" as const },
      ]
        .filter((b) => b.to - b.from >= 15)
        .map((b) => ({ ...b, at: place(b.from, b.to, b.prefer) }))
    : [];
  const lunchInHours = !hours || (hours.start < LUNCH.end && LUNCH.start < hours.end);

  return (
    <div
      className={cn("relative min-w-0 flex-1 rounded-inner bg-sunken", ghost !== null && "cursor-pointer")}
      style={{
        minWidth: COL,
        height,
        backgroundImage: "linear-gradient(to bottom, var(--color-line-strong) 0 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.6) 0 1px, transparent 1px)",
        backgroundSize: `100% ${ROW * 2}px, 100% ${ROW}px`,
        backgroundPosition: `0 ${firstHour}px, 0 0`,
      }}
      onMouseMove={(e) => {
        if (e.target !== e.currentTarget) {
          if (ghost !== null) setGhost(null);
          return;
        }
        const m = snap(e);
        const next = canBook(m) ? m : null;
        if (next !== ghost) setGhost(next);
      }}
      onMouseLeave={() => setGhost(null)}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const m = snap(e);
        if (canBook(m)) onSlot?.(col.staff.id, m);
      }}
    >
      {isToday ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 rounded-t-inner bg-surface/45" style={{ height: Math.max(0, y(NOW_MIN)) }} /> : null}

      {offBlocks.map((b) => (
        <div
          key={b.key}
          aria-hidden="true"
          className={cn("bg-hatch pointer-events-none absolute inset-x-0 flex justify-center px-1", b.at === "end" ? "items-end pb-2" : "items-start pt-2", b.key === "before" ? "rounded-t-inner" : "rounded-b-inner")}
          style={{ top: y(b.from), height: (b.to - b.from) * PX }}
        >
          {b.at ? <span className="truncate rounded-full bg-sunken px-2 text-[11px] leading-5 text-muted">{b.label}</span> : null}
        </div>
      ))}

      {lunchInHours && LUNCH.start >= range.start && LUNCH.end <= range.end ? (
        <div aria-hidden="true" className="bg-hatch pointer-events-none absolute inset-x-0 flex items-center justify-center" style={{ top: y(LUNCH.start), height: (LUNCH.end - LUNCH.start) * PX }}>
          <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 text-[11px] leading-5 text-muted">
            <Coffee size={12} />
            Lunch
          </span>
        </div>
      ) : null}

      {col.leave ? (
        <div className="bg-hatch absolute inset-0 z-[1] rounded-inner" title={`${col.staff.name} · ${col.leave}`}>
          <span className="sr-only">
            {col.staff.name} is {col.leave.replace(/^On/, "on")} — no bookings can be made.
          </span>
        </div>
      ) : null}

      {ghost !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-[2] flex items-start gap-1 rounded-[12px] border border-dashed border-ink/30 bg-surface/70 px-2 py-1.5 text-xs text-ink-2"
          style={{ top: y(ghost) + 2, height: ROW - 4 }}
        >
          <Plus size={14} className="mt-px" />
          <span className="font-mono">{hhmm(ghost)}</span>
        </div>
      ) : null}

      {col.events.map((ev) => {
        const l = lanes.get(ev.id) ?? { lane: 0, lanes: 1 };
        return (
          <Block
            key={ev.id}
            ev={ev}
            top={y(ev.start) + 2}
            height={Math.max(28, (ev.end - ev.start) * PX - 4)}
            lane={l.lane}
            lanes={l.lanes}
            selected={selectedId === ev.id}
            recent={recentIds.includes(ev.id)}
            double={doubleIds.has(ev.id)}
            {...shared}
          />
        );
      })}
    </div>
  );
});

const Block = memo(function Block({
  ev,
  top,
  height,
  lane,
  lanes,
  selected,
  recent,
  double,
  privacy,
  nameOf,
  onOpenChange,
  renderDetails,
}: BlockShared & { ev: DiaryEvent; top: number; height: number; lane: number; lanes: number; selected: boolean; recent: boolean; double: boolean }) {
  const b = ev.booking;
  const clinical = scheduleAccess(useRole().role).clinical;
  const status = b?.status;
  const inactive = status === "cancelled" || status === "no-show";
  const done = status === "completed";
  const cls = ev.cls;
  const title = nameOf(ev);
  const enrolled = cls ? cls.enrolled.filter((e) => e.attendance !== "cancelled").length : 0;
  const sub = cls ? `${enrolled} of ${cls.capacity} enrolled` : privacy ? DISCIPLINE_LABEL[ev.discipline] : b ? serviceText(b.service, clinical) : undefined;
  // Card tiers by height (px): < 44 one line; < 60 title + time row; < 72 all three rows packed
  // (60px = 8 padding + 16 + 16 + 20, no gaps); taller cards get the roomier layout. Every row is
  // shrink-0 so a short card never squeezes a line below its 16px leading (that clipped descenders).
  const tiny = height < 44;
  const showSub = !!sub && height >= 60;
  const tight = height < 72;
  const label = [title, privacy && !cls ? null : sub, rangeLabel(ev.start, ev.end), ev.room, status ? APPOINTMENT_STATUS_LABEL[status] : "Class", double ? "overlaps another booking" : null]
    .filter(Boolean)
    .join(", ");

  return (
    <motion.div
      layout="position"
      layoutId={`day-${ev.id}`}
      initial={recent ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={pop}
      className={cn("absolute", selected ? "z-[12]" : "z-[3]")}
      style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)` }}
    >
      <Popover open={selected} onOpenChange={(o) => onOpenChange(o ? ev.id : null)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "relative flex size-full min-w-0 flex-col overflow-hidden rounded-[12px] pl-3 pr-2 text-left outline-none",
              !tiny && tight ? "py-1" : "py-1.5",
              "transition-[transform,box-shadow,background-color] duration-300 [transition-timing-function:var(--ease-spring)]",
              "hover:-translate-y-0.5 hover:shadow-lift focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]",
              inactive ? "bg-hatch bg-surface/60 text-muted" : done ? "bg-surface/75 text-ink-2" : "bg-surface text-ink",
              selected && "-translate-y-0.5 shadow-[inset_0_0_0_1.5px_var(--color-charcoal),var(--shadow-lift)] hover:shadow-[inset_0_0_0_1.5px_var(--color-charcoal),var(--shadow-lift)]",
              recent && "shadow-[inset_0_0_0_2px_var(--color-primary)]",
            )}
          >
            <span aria-hidden="true" className="absolute bottom-1.5 left-1 top-1.5 w-[3px] rounded-full" style={{ background: DISCIPLINE_COLOR[ev.discipline], opacity: inactive ? 0.35 : done ? 0.6 : 1 }} />
            {tiny ? (
              <span className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs leading-4">
                <span className="shrink-0 font-mono text-[11px] text-muted">{hhmm(ev.start)}</span>
                <span className={cn("min-w-0 truncate font-medium", inactive && "line-through")}>{title}</span>
                {status && status !== "booked" ? <StatusDot status={status} /> : null}
              </span>
            ) : (
              <>
                <span className={cn("block min-w-0 shrink-0 truncate text-[13px] font-medium leading-4", inactive && "line-through decoration-1")}>{title}</span>
                {showSub ? <span className={cn("block min-w-0 shrink-0 truncate text-xs leading-4 text-muted", !tight && "mt-0.5")}>{sub}</span> : null}
                <span className={cn("mt-auto flex min-w-0 shrink-0 items-center gap-1.5", !tight && "pt-0.5")}>
                  <span className="shrink-0 font-mono text-[11px] leading-4 text-muted">{hhmm(ev.start)}</span>
                  {double ? <Warning size={12} className="shrink-0 text-warning" aria-hidden="true" /> : null}
                  {status && status !== "booked" ? <ApptStatus status={status} className="ml-auto h-5 min-w-0 shrink px-2 text-[11px]" /> : null}
                </span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-[360px] max-w-[calc(100vw-32px)]">
          {selected ? renderDetails(ev) : null}
        </PopoverContent>
      </Popover>
    </motion.div>
  );
});

const DOT_TONE: Partial<Record<NonNullable<DiaryEvent["booking"]>["status"], string>> = {
  arrived: "bg-primary",
  waiting: "bg-warning",
  "in-session": "bg-charcoal",
  checkout: "bg-primary",
  completed: "bg-success",
  "no-show": "bg-danger",
  cancelled: "bg-faint",
};

function StatusDot({ status }: { status: NonNullable<DiaryEvent["booking"]>["status"] }) {
  return (
    <span className="ml-auto flex shrink-0 items-center" title={APPOINTMENT_STATUS_LABEL[status]}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", DOT_TONE[status])} />
    </span>
  );
}
