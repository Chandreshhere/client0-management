"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  CalendarPlus,
  CalendarX,
  CheckCircle,
  ClockCountdown,
  PersonSimpleTaiChi,
  Play,
  Receipt,
  SignIn,
  UserMinus,
  Warning,
} from "@phosphor-icons/react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { usePlan } from "@/components/shell/role-context";
import { LEAVE, NOW_MIN, TODAY_KEY, roomBranch } from "./data";
import { durationLabel, hhmm, minOf, rangeLabel, shortDay, type DiaryEvent } from "./engine";
import { displayName, useSchedule } from "./store";
import { ApptStatus, DisciplineDot, IntakeBadge, PersonAvatar, TokenChip } from "./ui";

export type EventAction = "check-in" | "start" | "checkout" | "complete" | "reschedule" | "cancel" | "no-show" | "rebook" | "follow-up";

/** Appointment / class details with the actions its state allows. Used in the popover and the mobile sheet. */
export function EventDetails({ ev, onAction, className }: { ev: DiaryEvent; onAction: (a: EventAction) => void; className?: string }) {
  const { person, doubleIds, privacy, classSeats } = useSchedule();
  const { has } = usePlan();
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const staff = staffById(ev.staffId);
  const b = ev.booking;
  const cls = ev.cls;
  const who = b ? person(b.patientId) : undefined;
  const isToday = ev.date === TODAY_KEY;
  const isFuture = ev.date > TODAY_KEY;
  const isPast = ev.date < TODAY_KEY;

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: "When",
      value: (
        <>
          {shortDay(ev.date)} · <span className="font-mono text-[13px]">{rangeLabel(ev.start, ev.end)}</span> <span className="text-muted">({durationLabel(ev.end - ev.start)})</span>
        </>
      ),
    },
  ];
  if (!cls) {
    facts.push({
      label: "Service",
      value: privacy ? (
        <span className="text-muted">Hidden in privacy mode</span>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-x-2">
          {b?.service}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <DisciplineDot discipline={ev.discipline} />
            {DISCIPLINE_LABEL[ev.discipline]}
          </span>
        </span>
      ),
    });
  }
  facts.push({
    label: cls ? "Instructor" : "With",
    value: (
      <span className="inline-flex items-center gap-2">
        <Avatar src={staff?.avatar} name={staff?.name ?? "Practitioner"} size="xs" />
        {staff?.name}
      </span>
    ),
  });
  facts.push({ label: "Room", value: `${ev.room} · ${roomBranch(ev.room)}` });
  if (b?.arrivedAt) facts.push({ label: "Arrived", value: <span className="font-mono text-[13px]">{hhmm(minOf(b.arrivedAt))}</span> });
  if (b?.cancelReason) facts.push({ label: "Reason", value: `${b.cancelReason}${b.cancelNote ? ` — ${b.cancelNote}` : ""}` });
  if (b?.notes && !privacy) facts.push({ label: "Notes", value: b.notes });

  const status = b?.status;
  const title = cls ? cls.title : displayName(who?.name ?? "Unknown patient", privacy);
  const enrolled = cls ? cls.enrolled.filter((e) => e.attendance !== "cancelled").length + (classSeats[cls.id] ?? 0) : 0;
  const meta = cls
    ? `${cls.kind === "group" ? "Group class" : "1:1 session"} · ${enrolled} of ${cls.capacity} enrolled`
    : privacy
      ? "Patient details hidden"
      : [who?.clinicNo, who?.age ? `${who.age} y` : null, who?.sex].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex flex-col gap-4 p-4", className)}>
      <div className="flex items-start gap-3">
        {cls ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
            <PersonSimpleTaiChi size={18} aria-hidden="true" />
          </span>
        ) : (
          <PersonAvatar name={who?.name ?? "Patient"} avatar={who?.avatar ?? null} privacy={privacy} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-6 text-ink">{title}</p>
          <p className="truncate text-xs text-muted">{meta}</p>
        </div>
        {!cls && who && !who.local && !privacy ? (
          <Link
            href={`/patients/${who.id}`}
            aria-label={`Open ${who.name}'s record`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink transition-colors hover:bg-sunken-2"
          >
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {status ? <ApptStatus status={status} /> : <StatusBadge tone="info">Scheduled class</StatusBadge>}
        {b && !cls && b.kind !== "walk-in" ? <IntakeBadge complete={b.formsComplete} /> : null}
        {b?.token ? <TokenChip token={b.token} /> : null}
        {b?.local ? <StatusBadge tone="draft">Added this session</StatusBadge> : null}
        {doubleIds.has(ev.id) ? (
          <StatusBadge tone="warning" dot={false} className="gap-1">
            <Warning size={12} aria-hidden="true" />
            Overlaps another booking
          </StatusBadge>
        ) : null}
      </div>

      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted">{f.label}</dt>
            <dd className="min-w-0 text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      {LEAVE[ev.staffId] && ev.date < LEAVE[ev.staffId].until ? (
        <p className="flex items-center gap-2 text-xs text-warning">
          <Warning size={14} aria-hidden="true" />
          {staff?.name} is {LEAVE[ev.staffId].label.replace(/^On/, "on")}.
        </p>
      ) : null}

      {cls ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-xs text-muted">Rosters, attendance and precautions are recorded in Classes — each participant&apos;s record stays separate.</p>
          {has("classes") ? (
            <Button asChild size="sm" variant="secondary" trailing={<ArrowUpRight />}>
              <Link href={`/classes/${cls.id}`}>Open roster</Link>
            </Button>
          ) : (
            <p className="text-xs text-muted">Classes &amp; attendance are part of the Team plan.</p>
          )}
        </div>
      ) : b ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          {status === "booked" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="dark" leading={<SignIn />} disabled={!isToday} onClick={() => onAction("check-in")}>
                  Check in
                </Button>
                <Button size="sm" variant="secondary" leading={<ClockCountdown />} onClick={() => onAction("reschedule")}>
                  Reschedule
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" leading={<CalendarX />} onClick={() => onAction("cancel")}>
                  Cancel…
                </Button>
                {!isFuture ? (
                  <Button size="sm" variant="ghost" className="text-danger" leading={<UserMinus />} onClick={() => (isToday && minOf(b.start) > NOW_MIN ? setConfirmNoShow(true) : onAction("no-show"))}>
                    No-show
                  </Button>
                ) : null}
              </div>
              {isFuture ? <p className="text-xs text-muted">Check-in and no-show open on {shortDay(ev.date)}.</p> : null}
              {confirmNoShow ? (
                <div role="alert" className="flex flex-col gap-2 rounded-[12px] bg-warning-soft p-3 text-xs text-warning">
                  <p>
                    This starts at {hhmm(minOf(b.start))} — it&apos;s {hhmm(NOW_MIN)} now. Marking a no-show before the start time is unusual. Mark it anyway?
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => onAction("no-show")}>
                      Mark no-show
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmNoShow(false)}>
                      Keep booked
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : status === "arrived" || status === "waiting" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="dark" leading={<Play />} onClick={() => onAction("start")}>
                Start session
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" leading={<UserMinus />} onClick={() => onAction("no-show")}>
                Left without being seen
              </Button>
            </div>
          ) : status === "in-session" ? (
            <Button size="sm" variant="dark" leading={<Receipt />} onClick={() => onAction("checkout")} className="self-start">
              Send to checkout
            </Button>
          ) : status === "checkout" ? (
            <Button size="sm" variant="dark" leading={<CheckCircle />} onClick={() => onAction("complete")} className="self-start">
              Complete visit
            </Button>
          ) : status === "completed" ? (
            <Button size="sm" variant="secondary" leading={<CalendarPlus />} onClick={() => onAction("follow-up")} className="self-start">
              Book follow-up
            </Button>
          ) : (
            <Button size="sm" variant="secondary" leading={<ArrowCounterClockwise />} onClick={() => onAction("rebook")} className="self-start">
              Rebook
            </Button>
          )}
          {isPast && status === "booked" ? <p className="text-xs text-muted">This day has passed — record the outcome or reschedule.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
