"use client";

import { memo, type ReactNode } from "react";
import { motion } from "motion/react";
import { Plus, Warning } from "@phosphor-icons/react";
import type { AppointmentStatus, Staff } from "@/data/types";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DISCIPLINE_COLOR, TODAY_KEY } from "./data";
import { dayLabel, hhmm, isPastDay, rangeLabel, shortDay, type DiaryEvent } from "./engine";
import { DisciplineDot } from "./ui";

export type WeekRow = { staff: Staff; you: boolean; leaveUntil?: string; byDay: Record<string, DiaryEvent[]> };

const DOT: Partial<Record<AppointmentStatus, string>> = {
  arrived: "bg-primary",
  waiting: "bg-warning",
  "in-session": "bg-charcoal",
  checkout: "bg-primary",
  "no-show": "bg-danger",
  cancelled: "bg-faint",
};

/**
 * Week view: practitioners as rows, Mon–Sat as columns. Each grey cell lists that day's bookings
 * in time order, so a whole clinic week stays legible without squeezing overlapping blocks.
 */
export function WeekBoard({
  days,
  rows,
  selectedId,
  recentIds,
  doubleIds,
  onCell,
  onOpenChange,
  renderDetails,
  nameOf,
}: {
  days: string[];
  rows: WeekRow[];
  selectedId: string | null;
  recentIds: string[];
  doubleIds: Set<string>;
  onCell: (staffId: string, date: string) => void;
  onOpenChange: (id: string | null) => void;
  renderDetails: (ev: DiaryEvent) => ReactNode;
  nameOf: (ev: DiaryEvent) => string;
}) {
  return (
    <div data-lenis-prevent className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-1">
        <caption className="sr-only">Bookings by practitioner for the week</caption>
        <colgroup>
          <col className="w-[200px]" />
          {days.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="px-2 pb-2 text-left align-bottom text-xs font-normal text-muted">
              Practitioner
            </th>
            {days.map((d) => {
              const today = d === TODAY_KEY;
              const n = rows.reduce((s, r) => s + (r.byDay[d]?.filter((e) => !e.booking || (e.booking.status !== "cancelled" && e.booking.status !== "no-show")).length ?? 0), 0);
              return (
                <th key={d} scope="col" className="px-2 pb-2 text-left align-bottom font-normal">
                  <span className="flex items-end justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className={cn("text-xs", today ? "text-ink" : "text-muted")}>{dayLabel(d, { weekday: "short" })}</span>
                      <span
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xl font-light tabular",
                          today ? "bg-charcoal text-white" : isPastDay(d) ? "text-muted" : "text-ink",
                        )}
                      >
                        {dayLabel(d, { day: "numeric" })}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap pb-1 text-xs text-muted" aria-hidden="true">{n} booked</span>
                  </span>
                  <span className="sr-only">{today ? "Today, " : ""}{shortDay(d)}, {n} bookings</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.staff.id}>
              <th scope="row" className="rounded-inner px-2 py-2 text-left align-top font-normal">
                <span className="flex items-center gap-2">
                  <Avatar src={r.staff.avatar} name={r.staff.name} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <span className="truncate">{r.staff.name}</span>
                      {r.you ? <span className="shrink-0 rounded-full bg-sunken px-1.5 text-[11px] font-normal leading-4 text-ink-2">You</span> : null}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                      <DisciplineDot discipline={r.staff.discipline} />
                      {r.staff.room}
                    </span>
                  </span>
                </span>
              </th>
              {days.map((d) => (
                <Cell
                  key={d}
                  staff={r.staff}
                  date={d}
                  events={r.byDay[d] ?? []}
                  leave={r.leaveUntil && d < r.leaveUntil ? "On leave" : undefined}
                  selectedId={selectedId}
                  recentIds={recentIds}
                  doubleIds={doubleIds}
                  onCell={onCell}
                  onOpenChange={onOpenChange}
                  renderDetails={renderDetails}
                  nameOf={nameOf}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Cell = memo(function Cell({
  staff,
  date,
  events,
  leave,
  selectedId,
  recentIds,
  doubleIds,
  onCell,
  onOpenChange,
  renderDetails,
  nameOf,
}: {
  staff: Staff;
  date: string;
  events: DiaryEvent[];
  leave?: string;
  selectedId: string | null;
  recentIds: string[];
  doubleIds: Set<string>;
  onCell: (staffId: string, date: string) => void;
  onOpenChange: (id: string | null) => void;
  renderDetails: (ev: DiaryEvent) => ReactNode;
  nameOf: (ev: DiaryEvent) => string;
}) {
  const past = isPastDay(date);
  const bookable = !past && !leave;
  return (
    <td
      className={cn("group/cell rounded-inner p-1 align-top", leave ? "bg-hatch bg-sunken" : "bg-sunken", bookable && "cursor-pointer")}
      onClick={(e) => {
        if (bookable && e.target === e.currentTarget) onCell(staff.id, date);
      }}
    >
      <ul className="flex min-h-[88px] flex-col gap-1" onClick={(e) => bookable && e.target === e.currentTarget && onCell(staff.id, date)}>
        {leave && events.length === 0 ? <li className="px-2 py-1.5 text-xs text-warning">{leave}</li> : null}
        {events.map((ev) => (
          <li key={ev.id}>
            <Chip ev={ev} selected={selectedId === ev.id} recent={recentIds.includes(ev.id)} double={doubleIds.has(ev.id)} onOpenChange={onOpenChange} renderDetails={renderDetails} title={nameOf(ev)} />
          </li>
        ))}
        {bookable ? (
          <li className="mt-auto">
            <button
              type="button"
              onClick={() => onCell(staff.id, date)}
              aria-label={`Book ${staff.name} on ${shortDay(date)}`}
              className="flex h-8 w-full items-center gap-1.5 rounded-[12px] px-2 text-xs text-muted opacity-0 transition-opacity duration-200 hover:bg-surface/70 hover:text-ink focus-visible:opacity-100 group-hover/cell:opacity-100"
            >
              <Plus size={14} aria-hidden="true" />
              Book
            </button>
          </li>
        ) : null}
      </ul>
    </td>
  );
});

function Chip({
  ev,
  selected,
  recent,
  double,
  title,
  onOpenChange,
  renderDetails,
}: {
  ev: DiaryEvent;
  selected: boolean;
  recent: boolean;
  double: boolean;
  title: string;
  onOpenChange: (id: string | null) => void;
  renderDetails: (ev: DiaryEvent) => ReactNode;
}) {
  const status = ev.booking?.status;
  const inactive = status === "cancelled" || status === "no-show";
  const done = status === "completed";
  const dot = status ? DOT[status] : undefined;
  return (
    <Popover open={selected} onOpenChange={(o) => onOpenChange(o ? ev.id : null)}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          initial={recent ? { opacity: 0, scale: 0.9 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={pop}
          aria-label={`${title}, ${rangeLabel(ev.start, ev.end)}, ${ev.room}${status ? `, ${APPOINTMENT_STATUS_LABEL[status]}` : ", class"}`}
          className={cn(
            "relative flex h-8 w-full items-center gap-2 rounded-[12px] pl-3 pr-2 text-left outline-none transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)]",
            "hover:-translate-y-px hover:shadow-lift focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]",
            inactive ? "bg-hatch bg-surface/60 text-muted" : done ? "bg-surface/70 text-ink-2" : "bg-surface text-ink",
            selected && "shadow-[inset_0_0_0_1.5px_var(--color-charcoal),var(--shadow-lift)] hover:shadow-[inset_0_0_0_1.5px_var(--color-charcoal),var(--shadow-lift)]",
            recent && "shadow-[inset_0_0_0_2px_var(--color-primary)]",
          )}
        >
          <span aria-hidden="true" className="absolute bottom-1.5 left-1 top-1.5 w-[3px] rounded-full" style={{ background: DISCIPLINE_COLOR[ev.discipline], opacity: inactive ? 0.35 : done ? 0.6 : 1 }} />
          <span className="shrink-0 font-mono text-[11px] text-muted tabular">{hhmm(ev.start)}</span>
          <span className={cn("min-w-0 flex-1 truncate text-xs", inactive && "line-through")}>{title}</span>
          {double ? <Warning size={12} className="shrink-0 text-warning" aria-hidden="true" /> : null}
          {dot ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dot)} /> : null}
        </motion.button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-[360px] max-w-[calc(100vw-32px)]">
        {selected ? renderDetails(ev) : null}
      </PopoverContent>
    </Popover>
  );
}
