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
import { useRole } from "@/components/shell/role-context";
import { canMoveVisit, scheduleAccess, serviceText } from "./access";
import { PaymentLine } from "./checkout-modal";
import { LEAVE, NOW_MIN, TODAY_KEY, roomBranch } from "./data";
import { durationLabel, hhmm, minOf, rangeLabel, shortDay, type Booking, type DiaryEvent } from "./engine";
import { displayName, useSchedule } from "./store";
import { ApptStatus, DisciplineDot, IntakeBadge, PersonAvatar, TokenChip } from "./ui";

/** `checkout` sends the patient to the desk; `pay` opens checkout (payment, next visit, close). */
export type EventAction = "check-in" | "start" | "checkout" | "pay" | "reschedule" | "cancel" | "no-show" | "rebook" | "follow-up";

/** Appointment / class details with the actions its state allows. Used in the popover and the mobile sheet. */
export function EventDetails({ ev, onAction, className }: { ev: DiaryEvent; onAction: (a: EventAction) => void; className?: string }) {
  const { person, doubleIds, privacy, classSeats } = useSchedule();
  const { role, user, has } = useRole();
  const access = scheduleAccess(role);
  const multiBranch = has("branches");
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
          {b ? serviceText(b.service, access.clinical) : null}
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
  facts.push({ label: "Room", value: multiBranch ? `${ev.room} · ${roomBranch(ev.room)}` : ev.room });
  if (b?.arrivedAt) facts.push({ label: "Arrived", value: <span className="font-mono text-[13px]">{hhmm(minOf(b.arrivedAt))}</span> });
  if (b?.reason && access.clinical && !privacy) facts.push({ label: "Reason", value: b.reason });
  if (b?.cancelReason) facts.push({ label: b.status === "no-show" ? "Outcome" : "Cancelled", value: `${b.cancelReason}${b.cancelNote ? ` — ${b.cancelNote}` : ""}` });
  if (b?.notes && !privacy) facts.push({ label: "Notes", value: b.notes });
  if (b && (b.payment || b.status === "checkout") && b.kind !== "class") facts.push({ label: "Payment", value: <PaymentLine booking={b} /> });

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

      {b?.history?.length ? (
        <div className="flex flex-col gap-1 border-t border-line pt-4">
          <p className="text-xs text-muted">History</p>
          <ol className="flex flex-col gap-1 text-xs text-ink-2">
            {b.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex gap-2">
                <span className="w-10 shrink-0 font-mono text-muted">{hhmm(minOf(h.at))}</span>
                <span className="min-w-0">
                  {h.action} <span className="text-muted">· {h.by}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {cls ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          {access.runsDesk ? (
            <p className="text-xs text-muted">The instructor keeps the class list, precautions and attendance in Classes.</p>
          ) : (
            <>
              <p className="text-xs text-muted">Class list, precautions and attendance are kept in Classes — each participant&apos;s record stays separate.</p>
              <Button asChild size="sm" variant="secondary" trailing={<ArrowUpRight />} className="self-start">
                <Link href={`/classes/${cls.id}`}>Open class list</Link>
              </Button>
            </>
          )}
        </div>
      ) : b ? (
        <VisitActions
          status={b.status}
          isToday={isToday}
          isFuture={isFuture}
          isPast={isPast}
          date={ev.date}
          startsLater={isToday && minOf(b.start) > NOW_MIN}
          startLabel={hhmm(minOf(b.start))}
          canBook={access.canBook}
          runsDesk={access.runsDesk}
          ownsVisit={canMoveVisit(access, user.id, b.staffId)}
          isPractitioner={user.id === b.staffId}
          confirmNoShow={confirmNoShow}
          setConfirmNoShow={setConfirmNoShow}
          onAction={onAction}
        />
      ) : null}
    </div>
  );
}

/** The actions a visit's state allows, limited to what this role owns (spec F10–F11). */
function VisitActions({
  status,
  isToday,
  isFuture,
  isPast,
  date,
  startsLater,
  startLabel,
  canBook,
  runsDesk,
  ownsVisit,
  isPractitioner,
  confirmNoShow,
  setConfirmNoShow,
  onAction,
}: {
  status: Booking["status"];
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  date: string;
  startsLater: boolean;
  startLabel: string;
  canBook: boolean;
  runsDesk: boolean;
  ownsVisit: boolean;
  isPractitioner: boolean;
  confirmNoShow: boolean;
  setConfirmNoShow: (v: boolean) => void;
  onAction: (a: EventAction) => void;
}) {
  const note = (text: string) => <p className="text-xs text-muted">{text}</p>;
  let body: ReactNode = null;
  if (status === "booked") {
    const any = runsDesk || canBook;
    body = any ? (
      <>
        <div className="flex flex-wrap gap-2">
          {runsDesk ? (
            <Button size="sm" variant="dark" leading={<SignIn />} disabled={!isToday} onClick={() => onAction("check-in")}>
              Check in
            </Button>
          ) : null}
          {canBook ? (
            <>
              <Button size="sm" variant={runsDesk ? "secondary" : "dark"} leading={<ClockCountdown />} onClick={() => onAction("reschedule")}>
                Reschedule
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" leading={<CalendarX />} onClick={() => onAction("cancel")}>
                Cancel…
              </Button>
            </>
          ) : null}
          {runsDesk && !isFuture ? (
            <Button size="sm" variant="ghost" className="text-danger" leading={<UserMinus />} onClick={() => (startsLater ? setConfirmNoShow(true) : onAction("no-show"))}>
              No-show
            </Button>
          ) : null}
        </div>
        {isFuture && runsDesk ? note(`Check-in and no-show open on ${shortDay(date)}.`) : null}
        {confirmNoShow ? (
          <div role="alert" className="flex flex-col gap-2 rounded-[12px] bg-warning-soft p-3 text-xs text-warning">
            <p>
              This starts at {startLabel} — it&apos;s {hhmm(NOW_MIN)} now. Marking a no-show before the start time is unusual. Mark it anyway?
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
        {isPast && runsDesk ? note("This day has passed — record the outcome or reschedule.") : null}
      </>
    ) : (
      note("Reception checks patients in and changes bookings.")
    );
  } else if (status === "arrived" || status === "waiting") {
    body =
      ownsVisit || runsDesk ? (
        <div className="flex flex-wrap gap-2">
          {ownsVisit ? (
            <Button size="sm" variant="dark" leading={<Play />} onClick={() => onAction("start")}>
              {isPractitioner ? "Start session" : "Send in"}
            </Button>
          ) : null}
          {runsDesk ? (
            <Button size="sm" variant="ghost" className="text-danger" leading={<UserMinus />} onClick={() => onAction("no-show")}>
              Left without being seen
            </Button>
          ) : null}
        </div>
      ) : (
        note("Checked in and waiting for their practitioner.")
      );
  } else if (status === "in-session") {
    body = ownsVisit ? (
      <Button size="sm" variant="dark" leading={<Receipt />} onClick={() => onAction("checkout")} className="self-start">
        Send to checkout
      </Button>
    ) : (
      note("With the practitioner.")
    );
  } else if (status === "checkout") {
    body = runsDesk ? (
      <Button size="sm" variant="dark" leading={<CheckCircle />} onClick={() => onAction("pay")} className="self-start">
        Checkout
      </Button>
    ) : (
      note("At the desk — Reception records the payment and books the next visit.")
    );
  } else if (status === "completed") {
    body = canBook ? (
      <Button size="sm" variant="secondary" leading={<CalendarPlus />} onClick={() => onAction("follow-up")} className="self-start">
        Book follow-up
      </Button>
    ) : null;
  } else {
    body = canBook ? (
      <Button size="sm" variant="secondary" leading={<ArrowCounterClockwise />} onClick={() => onAction("rebook")} className="self-start">
        Rebook
      </Button>
    ) : null;
  }
  if (!body) return null;
  return <div className="flex flex-col gap-2 border-t border-line pt-4">{body}</div>;
}
