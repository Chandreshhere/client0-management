"use client";

import { ArrowsClockwise, CalendarPlus, XCircle } from "@phosphor-icons/react";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { staffById } from "@/data/staff";
import type { PortalAppt } from "./data";
import { BRANCH_INFO, ROOM_INFO, checkInFrom, prepareFor } from "./data";
import type { ApptChange } from "./store";
import { statusOf, type ApptActions } from "./appointment-list";
import { DisciplineTag, MetaRow, StaffLine } from "../ui";
import { dayLabel, longDate, untilLabel } from "../time";

/** Full details for one visit, without leaving the list. */
export function DetailsSheet({
  appt,
  change,
  open,
  onOpenChange,
  actions,
}: {
  appt: PortalAppt | null;
  change?: ApptChange;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  actions: ApptActions;
}) {
  if (!appt) return null;
  const branch = BRANCH_INFO[appt.branch];
  const status = statusOf(appt, change);
  const upcoming = appt.status === "booked" && !change;
  const items = upcoming ? prepareFor(appt) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={appt.service}
        description={`${dayLabel(appt.start)} · ${formatTime(appt.start)} · ${appt.durationMin} min`}
        footer={
          upcoming ? (
            <>
              <Button variant="ghost" className="mr-auto" leading={<XCircle />} onClick={() => actions.cancel(appt)}>
                Cancel
              </Button>
              {appt.kind !== "class" && !appt.alsoWith?.length ? (
                <Button variant="secondary" leading={<ArrowsClockwise />} onClick={() => actions.reschedule(appt)}>
                  Move
                </Button>
              ) : null}
              <Button variant="dark" leading={<CalendarPlus />} onClick={() => actions.calendar(appt)}>
                Add to calendar
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <DisciplineTag discipline={appt.discipline} />
          </div>

          <div className="flex flex-col gap-3">
            <StaffLine staffId={appt.staffId} size="md" detail={staffById(appt.staffId)?.title} />
            {appt.alsoWith?.map((id) => <StaffLine key={id} staffId={id} size="md" detail={staffById(id)?.title} />)}
          </div>

          <dl className="divide-y divide-line rounded-inner bg-sunken px-4 py-2">
            <MetaRow label="Date">{longDate(appt.start)}</MetaRow>
            <MetaRow label="Time">
              {formatTime(appt.start)} <span className="text-muted">({untilLabel(appt.start)})</span>
            </MetaRow>
            <MetaRow label="Room">{appt.room}</MetaRow>
            <MetaRow label="Branch">{branch.name.split(" · ")[1]}</MetaRow>
            <MetaRow label="Cost">{appt.cost}</MetaRow>
            {appt.status === "booked" ? <MetaRow label="Check in from">{checkInFrom(appt)}</MetaRow> : null}
          </dl>

          {appt.note ? <p className="text-sm text-ink-2">{appt.note}</p> : null}
          {appt.pending ? (
            <p className="rounded-inner bg-warning-soft p-4 text-sm text-ink">
              {appt.pending.label} · {appt.pending.reply}
            </p>
          ) : null}

          {upcoming ? (
            <section aria-labelledby="sheet-where" className="flex flex-col gap-1">
              <h3 id="sheet-where" className="text-sm text-ink">
                Where to go
              </h3>
              <p className="text-sm text-ink-2">{ROOM_INFO[appt.room] ?? "Ask at reception"}</p>
              <p className="text-xs text-muted">{branch.address}</p>
              <p className="text-xs text-muted">
                {branch.travel} · {branch.parking}
              </p>
            </section>
          ) : null}

          {items.length ? (
            <section aria-labelledby="sheet-prep" className="flex flex-col gap-2">
              <h3 id="sheet-prep" className="text-sm text-ink">
                How to prepare
              </h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2 marker:text-faint">
                {items.map((i) => (
                  <li key={i.id}>
                    {i.label}
                    {i.detail ? <span className="text-muted"> — {i.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {appt.outcome ? <p className="text-sm text-ink-2">{appt.outcome.label}</p> : null}
          <p className="text-xs text-muted">Questions about this visit? Call the front desk on {branch.phone} or send a message — replies within 1 working day.</p>
        </div>
      </SheetContent>
    </Dialog>
  );
}
