"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  ArrowsClockwise,
  CalendarBlank,
  CalendarPlus,
  DotsThree,
  Eye,
  HourglassMedium,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { formatTime } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { staffById } from "@/data/staff";
import type { PortalAppt } from "./data";
import type { ApptChange } from "./store";
import { DisciplineTag } from "../ui";
import { dayLabel, dayOfMonth, monthShort, weekdayShort } from "../time";

export type ApptActions = {
  details: (a: PortalAppt) => void;
  reschedule: (a: PortalAppt) => void;
  cancel: (a: PortalAppt) => void;
  calendar: (a: PortalAppt) => void;
  withdrawChange: (a: PortalAppt) => void;
  withdrawRequest: (a: PortalAppt) => void;
  bookAgain: (a: PortalAppt) => void;
};

/** Plain-language status for a row, including requests the patient made in this session. */
export function statusOf(a: PortalAppt, change?: ApptChange): { tone: Tone; label: string } {
  if (a.status === "requested") return a.local ? { tone: "warning", label: "Requested · not sent (demo)" } : { tone: "info", label: "Requested · time to be confirmed" };
  if (a.status === "attended") return { tone: "success", label: "Attended" };
  if (a.status === "completed") return { tone: "success", label: "Completed" };
  if (a.status === "cancelled") return { tone: "neutral", label: "Cancelled" };
  if (change?.kind === "cancel") return { tone: "warning", label: "Cancellation requested" };
  if (change?.kind === "reschedule") return { tone: "warning", label: `New time requested · ${dayLabel(change.to)} ${formatTime(change.to)}` };
  return { tone: "neutral", label: "Booked" };
}

type View = "upcoming" | "past";

export type ApptFilter = { month?: string; monthLabel?: string; staffId?: string };

export function AppointmentList({
  upcoming: allUpcoming,
  waiting: allWaiting,
  past: allPast,
  changes,
  actions,
  filter,
  onClearFilter,
}: {
  upcoming: PortalAppt[];
  waiting: PortalAppt[];
  past: PortalAppt[];
  changes: Record<string, ApptChange>;
  actions: ApptActions;
  filter?: ApptFilter;
  onClearFilter?: () => void;
}) {
  const [chosen, setView] = useState<View>("upcoming");
  const match = (a: PortalAppt) => (!filter?.month || a.start.startsWith(filter.month)) && (!filter?.staffId || a.staffId === filter.staffId || !!a.alsoWith?.includes(filter.staffId));
  const upcoming = allUpcoming.filter(match);
  const waiting = allWaiting.filter(match);
  const past = allPast.filter(match);
  const upcomingCount = upcoming.length + waiting.length;
  // a filter can empty one side: show the side that has visits rather than an empty list
  const view: View = chosen === "upcoming" && !upcomingCount && past.length ? "past" : chosen === "past" && !past.length && upcomingCount ? "upcoming" : chosen;
  const filtered = !!(filter?.month || filter?.staffId);
  return (
    <Card className="flex flex-col gap-6 p-4 sm:p-6">
      <SectionTitle
        title="All appointments"
        description="Times are shown in IST. Visits you book here are requests until the clinic confirms them."
        actions={
          <Segmented<View>
            ariaLabel="Show appointments"
            value={view}
            onChange={setView}
            variant="tray"
            size="sm"
            items={[
              { value: "upcoming", label: "Upcoming", count: upcomingCount },
              { value: "past", label: "Past", count: past.length },
            ]}
          />
        }
      />
      {filtered ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-muted" aria-live="polite">
          <span>Showing</span>
          {filter?.monthLabel ? <span className="rounded-full bg-sunken px-3 py-1 text-ink">{filter.monthLabel}</span> : null}
          {filter?.staffId ? <span className="rounded-full bg-sunken px-3 py-1 text-ink">{staffById(filter.staffId)?.name}</span> : null}
          <span>· {upcomingCount + past.length} of {allUpcoming.length + allWaiting.length + allPast.length} visits</span>
          {onClearFilter ? (
            <button type="button" onClick={onClearFilter} className="ml-1 text-ink underline-offset-4 hover:underline">
              Clear filter
            </button>
          ) : null}
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={spring} className="flex flex-col gap-6">
          {view === "upcoming" ? (
            <>
              {waiting.length ? (
                <section aria-labelledby="waiting-title" className="flex flex-col gap-2">
                  <h3 id="waiting-title" className="flex items-center gap-2 text-sm text-ink">
                    <HourglassMedium size={18} className="text-muted" aria-hidden="true" />
                    Waiting for the clinic <span className="text-muted">· {waiting.length}</span>
                  </h3>
                  <Rows items={waiting} changes={changes} actions={actions} />
                </section>
              ) : null}
              <section aria-labelledby="booked-title" className="flex flex-col gap-2">
                <h3 id="booked-title" className="text-sm text-ink">
                  Booked <span className="text-muted">· {upcoming.length}</span>
                </h3>
                {upcoming.length ? (
                  <Rows items={upcoming} changes={changes} actions={actions} />
                ) : (
                  <EmptyState icon={<CalendarBlank />} title="Nothing booked yet" description="Book or request a visit and it will appear here once the clinic confirms." className="bg-sunken" />
                )}
              </section>
            </>
          ) : past.length ? (
            <Rows items={past} changes={changes} actions={actions} past />
          ) : (
            <EmptyState icon={<CalendarBlank />} title="No past visits yet" className="bg-sunken" />
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function Rows({ items, changes, actions, past }: { items: PortalAppt[]; changes: Record<string, ApptChange>; actions: ApptActions; past?: boolean }) {
  return (
    <ul className="flex flex-col gap-2 rounded-card bg-sunken p-2">
      <AnimatePresence initial={false}>
        {items.map((a) => (
          <motion.li key={a.id} layout transition={spring} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}>
            <Row appt={a} change={changes[a.id]} actions={actions} past={past} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  return (
    <span className={cn("hidden size-16 shrink-0 flex-col items-center justify-center rounded-[12px] bg-sunken text-center sm:flex", muted && "opacity-70")} aria-hidden="true">
      <span className="text-[11px] text-muted">{weekdayShort(iso)}</span>
      <span className="text-xl leading-none text-ink tabular">{dayOfMonth(iso)}</span>
      <span className="text-[11px] text-muted">{monthShort(iso)}</span>
    </span>
  );
}

function Row({ appt, change, actions, past }: { appt: PortalAppt; change?: ApptChange; actions: ApptActions; past?: boolean }) {
  const staff = staffById(appt.staffId);
  const status = statusOf(appt, change);
  const cancelled = appt.status === "cancelled";
  return (
    <div className="flex items-start gap-4 rounded-inner bg-surface p-4">
      <DateTile iso={appt.start} muted={cancelled} />
      {/* Status sits beside the time + title only; the detail lines below run the full row width
          instead of truncating next to an empty status column. */}
      <div className="grid min-w-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-ink tabular">
              {dayLabel(appt.start)} · {formatTime(appt.start)} <span className="text-muted">· {appt.durationMin} min</span>
            </p>
            <DisciplineTag discipline={appt.discipline} />
          </div>
          <button
            type="button"
            onClick={() => actions.details(appt)}
            className={cn("mt-1 block max-w-full text-left text-base text-ink underline-offset-4 hover:underline sm:truncate", cancelled && "text-muted line-through")}
          >
            {appt.service}
          </button>
        </div>
        <div className="hidden max-w-[280px] md:block">
          <RowStatus appt={appt} status={status} past={past} align="end" />
        </div>
        <div className="min-w-0 md:col-span-2">
          <p className="mt-1 text-xs text-muted">
            {staff?.name}
            {appt.alsoWith?.length ? ` with ${appt.alsoWith.map((id) => staffById(id)?.name.split(" ")[0]).join(" & ")}` : ""} · {appt.room} · {appt.cost}
          </p>
          {appt.pending && appt.status === "booked" && !change ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-ink-2">
              <HourglassMedium size={16} className="mt-px shrink-0 text-warning" aria-hidden="true" />
              <span>
                {appt.pending.label} · {appt.pending.reply}
              </span>
            </p>
          ) : null}
          {change ? <p className="mt-2 text-xs text-muted">Your current time stays booked until the clinic confirms — demo, nothing was sent.</p> : null}
          {appt.requestNote ? <p className="mt-2 text-xs text-muted">Your note: “{appt.requestNote}”</p> : null}
          <div className="mt-3 md:hidden">
            <RowStatus appt={appt} status={status} past={past} />
          </div>
        </div>
      </div>
      <RowMenu appt={appt} change={change} actions={actions} past={past} />
    </div>
  );
}

function RowStatus({ appt, status, past, align }: { appt: PortalAppt; status: { tone: Tone; label: string }; past?: boolean; align?: "end" }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", align === "end" && "flex-col items-end text-right")}>
      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      {past && appt.outcome ? (
        appt.outcome.href ? (
          <Link href={appt.outcome.href} className="inline-flex items-center gap-1 text-xs text-ink underline-offset-4 hover:underline">
            {appt.outcome.label}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-xs text-muted">{appt.outcome.label}</span>
        )
      ) : null}
    </div>
  );
}

function RowMenu({ appt, change, actions, past }: { appt: PortalAppt; change?: ApptChange; actions: ApptActions; past?: boolean }) {
  const isClass = appt.kind === "class";
  const coordinated = (appt.alsoWith?.length ?? 0) > 0;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton label={`Actions for ${appt.service}, ${dayLabel(appt.start)}`} variant="ghost" size="md" className="-mr-2 -mt-2">
          <DotsThree size={20} weight="bold" />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent className="w-[280px]">
        <DropdownItem icon={<Eye />} onSelect={() => actions.details(appt)}>
          View details
        </DropdownItem>
        {past ? (
          <DropdownItem icon={<ArrowsClockwise />} onSelect={() => actions.bookAgain(appt)}>
            Book this again
          </DropdownItem>
        ) : appt.status === "requested" ? (
          appt.local ? (
            <DropdownItem icon={<Trash />} tone="danger" onSelect={() => actions.withdrawRequest(appt)}>
              Withdraw request
            </DropdownItem>
          ) : (
            <DropdownItem disabled icon={<HourglassMedium />} description="The clinic will offer a time first">
              Waiting for the clinic
            </DropdownItem>
          )
        ) : change ? (
          <DropdownItem icon={<ArrowCounterClockwise />} onSelect={() => actions.withdrawChange(appt)}>
            Withdraw my request
          </DropdownItem>
        ) : (
          <>
            <DropdownItem icon={<CalendarPlus />} onSelect={() => actions.calendar(appt)}>
              Add to calendar
            </DropdownItem>
            <DropdownItem
              icon={<ArrowsClockwise />}
              disabled={isClass}
              description={isClass ? "Classes run Mon · Wed · Fri — cancel and ask for a 1:1 make-up" : coordinated ? "Your care coordinator arranges this one" : undefined}
              onSelect={() => actions.reschedule(appt)}
            >
              Move to another time
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<XCircle />} tone="danger" onSelect={() => actions.cancel(appt)}>
              Cancel visit
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
