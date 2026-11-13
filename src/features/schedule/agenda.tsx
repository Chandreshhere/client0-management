"use client";

import { Fragment, type ReactNode } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { DISCIPLINE_COLOR, NOW_MIN, TODAY_KEY } from "./data";
import { hhmm, rangeLabel, type DiaryEvent } from "./engine";
import { ApptStatus } from "./ui";

/** Mobile diary: the day as a chronological list, grouped by start time, with a "now" marker. */
export function Agenda({
  date,
  events,
  nameOf,
  subOf,
  onOpen,
  empty,
}: {
  date: string;
  events: DiaryEvent[];
  nameOf: (ev: DiaryEvent) => string;
  subOf: (ev: DiaryEvent) => string | undefined;
  onOpen: (id: string) => void;
  empty: ReactNode;
}) {
  if (events.length === 0) return <>{empty ?? <EmptyState icon={<CalendarBlank />} title="Nothing booked" />}</>;
  const groups: { time: number; items: DiaryEvent[] }[] = [];
  for (const ev of events) {
    const g = groups[groups.length - 1];
    if (g && g.time === ev.start) g.items.push(ev);
    else groups.push({ time: ev.start, items: [ev] });
  }
  const nowIndex = date === TODAY_KEY ? groups.findIndex((g) => g.time >= NOW_MIN) : -1;

  return (
    <ol className="flex flex-col gap-4" aria-label="Appointments by time">
      {groups.map((g, i) => (
        <Fragment key={g.time}>
          {i === nowIndex ? (
            <li aria-label={`Now, ${hhmm(NOW_MIN)}`} className="flex items-center gap-2">
              <span className="rounded-full bg-charcoal px-2 font-mono text-[11px] leading-5 text-white">{hhmm(NOW_MIN)}</span>
              <span className="h-0.5 flex-1 rounded-full bg-charcoal" />
            </li>
          ) : null}
          <li data-agenda-time={g.time} className="grid scroll-mt-24 grid-cols-[48px_minmax(0,1fr)] gap-3">
            <span className="pt-3 font-mono text-xs text-muted">{hhmm(g.time)}</span>
            <ul className="flex min-w-0 flex-col gap-2">
              {g.items.map((ev) => {
                const status = ev.booking?.status;
                const inactive = status === "cancelled" || status === "no-show";
                const staff = staffById(ev.staffId);
                const sub = subOf(ev);
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(ev.id)}
                      className={cn(
                        "relative flex w-full flex-col gap-2 rounded-inner py-3 pl-5 pr-4 text-left transition-colors",
                        inactive ? "bg-hatch bg-surface/60 text-muted" : "bg-surface text-ink active:bg-canvas",
                      )}
                    >
                      <span aria-hidden="true" className="absolute bottom-3 left-2 top-3 w-[3px] rounded-full" style={{ background: DISCIPLINE_COLOR[ev.discipline], opacity: inactive ? 0.35 : 1 }} />
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className={cn("block truncate text-sm font-medium", inactive && "line-through")}>{nameOf(ev)}</span>
                          {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
                        </span>
                        {status && status !== "booked" ? <ApptStatus status={status} className="shrink-0" /> : null}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Avatar src={staff?.avatar} name={staff?.name ?? ""} size="xs" />
                        <span className="truncate">
                          {staff?.name} · {ev.room}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[11px]">{rangeLabel(ev.start, ev.end)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
