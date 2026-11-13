"use client";

import { useId } from "react";
import { ArrowCounterClockwise, ArrowsClockwise, CalendarPlus, Car, Clock, Copy, Door, MapPin, Train, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { staffById } from "@/data/staff";
import type { PortalAppt } from "./data";
import { BRANCH_INFO, ROOM_INFO, buildIcs, checkInFrom, prepareFor } from "./data";
import type { ApptChange } from "./store";
import { clearChange, togglePrep } from "./store";
import { FocalCard, FocalHead, copyText, downloadFile } from "../ui";
import { dayLabel, untilLabel } from "../time";

/** The one cobalt card on the page: the next visit, how to prepare and where to go. */
export function NextAppointmentCard({
  appt,
  change,
  prepare,
  later = [],
  onReschedule,
  onCancel,
  onDetails,
}: {
  appt: PortalAppt;
  change?: ApptChange;
  prepare: Record<string, boolean>;
  /** other visits later the same day */
  later?: PortalAppt[];
  onReschedule: () => void;
  onCancel: () => void;
  onDetails: (a: PortalAppt) => void;
}) {
  const id = useId();
  const { toast } = useToast();
  const staff = staffById(appt.staffId);
  const items = prepareFor(appt);
  const ready = items.filter((i) => i.done || prepare[`${appt.id}:${i.id}`]).length;
  const branch = BRANCH_INFO[appt.branch];
  const fullAddress = `${appt.room}, ${branch.name}, ${branch.address}`;

  const addToCalendar = () => {
    const ok = downloadFile(`${appt.service.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`, buildIcs(appt), "text/calendar");
    toast(
      ok
        ? { title: "Calendar file created", description: "Open it to add the visit to your calendar. It was made in your browser — nothing was sent." }
        : { tone: "warning", title: "Couldn't create the calendar file", description: "Your browser blocked the download. Note the time instead: " + formatTime(appt.start) },
    );
  };

  const copyAddress = async () => {
    const ok = await copyText(fullAddress);
    toast(ok ? { title: "Address copied", description: branch.address } : { tone: "warning", title: "Couldn't copy the address", description: "Your browser blocked clipboard access." });
  };

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Your next appointment"
        title={appt.service}
        meta={
          <span className="flex items-center gap-2">
            <Avatar src={staff?.avatar} name={staff?.name ?? ""} size="xs" className="bg-white" />
            <span className="min-w-0">
              {staff?.name} · {staff?.title.split(" · ")[0]} · {appt.room}
            </span>
          </span>
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{formatTime(appt.start)}</p>
            <p className="text-xs text-white">
              {dayLabel(appt.start)} · {untilLabel(appt.start)}
            </p>
          </div>
        }
      />

      {change ? (
        <div className="flex flex-wrap items-center gap-3 rounded-inner bg-white/15 p-4 text-sm text-white" role="status">
          <span className="min-w-0 flex-1">
            {change.kind === "cancel"
              ? "You asked to cancel this visit."
              : `You asked to move this to ${dayLabel(change.to)} at ${formatTime(change.to)}.`}{" "}
            It stays booked until the clinic confirms — demo, nothing was sent.
          </span>
          <Button size="sm" variant="glass" onClick={() => clearChange(appt.id)} leading={<ArrowCounterClockwise />}>
            Withdraw request
          </Button>
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="rounded-inner bg-surface p-4 text-ink">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm text-ink">How to prepare</h3>
            <span className="text-xs text-muted tabular" aria-live="polite">
              {ready} of {items.length} ready
            </span>
          </div>
          <ul className="mt-2 flex flex-col">
            {items.map((item) => {
              const key = `${appt.id}:${item.id}`;
              const checked = !!item.done || !!prepare[key];
              return (
                <li key={item.id}>
                  <label className={cn("flex items-start gap-3 rounded-[12px] p-2 transition-colors", item.done ? "cursor-default" : "cursor-pointer hover:bg-canvas")}>
                    <Checkbox
                      checked={checked}
                      disabled={!!item.done}
                      onCheckedChange={(v) => togglePrep(key, v === true)}
                      aria-label={item.label}
                      className="mt-0.5 disabled:opacity-100"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm transition-colors duration-200", checked && !item.done ? "text-muted line-through" : "text-ink")}>{item.label}</span>
                      {item.detail ? <span className="block text-xs text-muted">{item.detail}</span> : null}
                    </span>
                    {item.done ? <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">{item.done}</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-4 rounded-inner bg-surface p-4 text-ink">
          <h3 className="text-sm text-ink">Where to go</h3>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <Door size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <span>
                <span className="block text-ink">{appt.room}</span>
                <span className="block text-xs text-muted">{ROOM_INFO[appt.room] ?? "Ask at reception"}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <span>
                <span className="block text-ink">{branch.name.split(" · ")[1]} branch</span>
                <span className="block text-xs text-muted">{branch.address}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Train size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-xs text-muted">{branch.travel}</span>
            </li>
            <li className="flex items-start gap-3">
              <Car size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-xs text-muted">{branch.parking}</span>
            </li>
          </ul>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant="soft" onClick={copyAddress} leading={<Copy />}>
              Copy address
            </Button>
            <Button size="sm" variant="soft" onClick={addToCalendar} leading={<CalendarPlus />}>
              Add to calendar
            </Button>
          </div>
        </div>
      </div>

      {later.map((l) => {
        const who = staffById(l.staffId);
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-inner bg-surface p-4 text-ink">
            <Avatar src={who?.avatar} name={who?.name ?? ""} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">
                Then at {formatTime(l.start)} · {untilLabel(l.start)}
              </span>
              <span className="block truncate text-sm text-ink">{l.service}</span>
              <span className="block truncate text-xs text-muted">
                {who?.name} · {l.room} · {l.cost}
              </span>
            </span>
            <Button size="sm" variant="soft" onClick={() => onDetails(l)}>
              Details
            </Button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 p-4 pt-2">
        <Button variant="glass" onClick={onReschedule} disabled={!!change} leading={<ArrowsClockwise />}>
          Move to another time
        </Button>
        <Button variant="glass" onClick={onCancel} disabled={!!change} leading={<XCircle />}>
          Cancel
        </Button>
        <p className="flex items-center gap-2 text-xs text-white sm:ml-auto">
          <Clock size={16} aria-hidden="true" />
          Check in at reception from {checkInFrom(appt)} · {appt.cost}
        </p>
      </div>
    </FocalCard>
  );
}
