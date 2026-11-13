"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useLenis } from "lenis/react";
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  CheckCircle,
  ClipboardText,
  DotsThree,
  HourglassMedium,
  Megaphone,
  MonitorPlay,
  Receipt,
  SignIn,
  SpeakerHigh,
  Stethoscope,
  Timer,
  UserMinus,
  UserPlus,
  UsersThree,
  X,
  XCircle,
} from "@phosphor-icons/react";
import type { AppointmentStatus } from "@/data/types";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/input";
import { EmptyState, Kbd, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { NOW_ISO, NOW_MIN, PRACTITIONERS, TODAY_KEY } from "./data";
import { dateOf, hhmm, minOf, waitLabel, type Booking } from "./engine";
import { WALK_IN_MIN, availabilityNow } from "./insights";
import { StageFlow, type FlowChip, type FlowKey, type FlowStation } from "./stage-flow";
import { StaffOnly } from "./staff-only";
import { displayName, useSchedule } from "./store";
import { ApptStatus, DisciplineDot, IntakeBadge, TokenChip } from "./ui";
import { WalkInModal } from "./walk-in-modal";

const FLOW = ["arrived", "waiting", "in-session", "checkout", "completed"] as const;
type Stage = (typeof FLOW)[number];

const COLUMNS: { status: Stage; label: string; icon: typeof SignIn; empty: string }[] = [
  { status: "arrived", label: "Arrived", icon: SignIn, empty: "Checked-in patients appear here." },
  { status: "waiting", label: "Waiting", icon: HourglassMedium, empty: "Nobody is waiting." },
  { status: "in-session", label: "With practitioner", icon: Stethoscope, empty: "No one is being seen." },
  { status: "checkout", label: "Checkout", icon: Receipt, empty: "No one at checkout." },
  { status: "completed", label: "Done", icon: CheckCircle, empty: "Completed visits land here." },
];

const NEXT_LABEL: Record<Stage, string> = {
  arrived: "To waiting",
  waiting: "Send in",
  "in-session": "To checkout",
  checkout: "Done",
  completed: "",
};

const isStage = (s: AppointmentStatus): s is Stage => (FLOW as readonly string[]).includes(s);
const minutesSince = (iso?: string) => (iso ? Math.max(0, NOW_MIN - minOf(iso)) : 0);

/** Front-desk rule in this prototype: a wait is flagged at 30 minutes and escalated at 45. */
const WAIT_FLAG = 30;
const WAIT_ESCALATE = 45;
const waitTone = (min: number) => (min >= WAIT_ESCALATE ? "danger" : min >= WAIT_FLAG ? "warning" : undefined);

export function QueueView() {
  const { role } = useRole();
  if (role === "patient") return <StaffOnly title="Front-desk queue" />;
  return <QueueBoard />;
}

function QueueBoard() {
  const { bookings, events, patchBooking, restoreBooking, checkIn, person, queueDisplay, setQueueDisplay, callingId, setCallingId } = useSchedule();
  const lenis = useLenis();
  const { toast } = useToast();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInSession, setWalkInSession] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocus = useRef<string | null>(null);

  const today = useMemo(() => bookings.filter((b) => dateOf(b.start) === TODAY_KEY && b.kind !== "class"), [bookings]);
  const byStage = useMemo(() => {
    const out = Object.fromEntries(FLOW.map((s) => [s, [] as Booking[]])) as Record<Stage, Booking[]>;
    for (const b of today) if (isStage(b.status)) out[b.status].push(b);
    out.arrived.sort((a, b) => (a.arrivedAt ?? a.start).localeCompare(b.arrivedAt ?? b.start));
    out.waiting.sort((a, b) => (a.arrivedAt ?? a.start).localeCompare(b.arrivedAt ?? b.start));
    out["in-session"].sort((a, b) => (a.calledAt ?? a.start).localeCompare(b.calledAt ?? b.start));
    out.completed.sort((a, b) => (b.doneAt ?? b.start).localeCompare(a.doneAt ?? a.start));
    return out;
  }, [today]);
  const expected = useMemo(() => today.filter((b) => b.status === "booked").sort((a, b) => a.start.localeCompare(b.start)), [today]);
  const notSeen = useMemo(() => today.filter((b) => b.status === "no-show" || b.status === "cancelled"), [today]);

  const inClinic = [...byStage.arrived, ...byStage.waiting, ...byStage["in-session"], ...byStage.checkout];
  const queued = [...byStage.waiting, ...byStage.arrived];
  const longest = [...byStage.arrived, ...byStage.waiting].sort((a, b) => minutesSince(b.arrivedAt) - minutesSince(a.arrivedAt))[0];
  const missingIntake = [...inClinic, ...expected].filter((b) => b.formsComplete === false);
  const calling = callingId ? today.find((b) => b.id === callingId && (b.status === "arrived" || b.status === "waiting")) : undefined;

  const nameFor = (b: Booking) => (queueDisplay ? "Name hidden" : displayName(person(b.patientId)?.name ?? "Patient", false));
  const tokenOr = (b: Booking) => b.token ?? hhmm(minOf(b.start));

  // Average wait to be seen today: arrival → called in, for every visit that has been called.
  const seen = today.filter((b) => b.arrivedAt && b.calledAt);
  const avgWait = seen.length ? Math.round(seen.reduce((n, b) => n + Math.max(0, minOf(b.calledAt!) - minOf(b.arrivedAt!)), 0) / seen.length) : null;

  // Who could see a walk-in now: on shift at 09:40, not in a session, nothing booked in the next 20 minutes.
  const freeNow = useMemo(() => PRACTITIONERS.filter((s) => availabilityNow(s, events).free), [events]);

  // Visit flow stations, in the order a visit moves through the desk.
  const chipFor = (b: Booking, stage: Stage): FlowChip => {
    const token = tokenOr(b);
    const who = queueDisplay ? token : `${token}, ${nameFor(b)}`;
    if (stage === "arrived" || stage === "waiting") {
      const w = minutesSince(b.arrivedAt);
      const tone = waitTone(w);
      return { id: b.id, label: token, sub: w < 1 ? "just now" : `${waitLabel(b.arrivedAt)}`, tone, kind: "token", title: `${who}: waiting ${waitLabel(b.arrivedAt)} since arrival at ${hhmm(minOf(b.arrivedAt ?? b.start))}${tone ? ` — over ${tone === "danger" ? WAIT_ESCALATE : WAIT_FLAG} minutes` : ""}` };
    }
    if (stage === "in-session") return { id: b.id, label: token, sub: `in ${waitLabel(b.calledAt) ?? "—"}`, kind: "token", title: `${who}: with ${staffById(b.staffId)?.name} for ${waitLabel(b.calledAt) ?? "—"}` };
    if (stage === "checkout") return { id: b.id, label: token, sub: "at desk", kind: "token", title: `${who}: at checkout` };
    return { id: b.id, label: token, sub: b.doneAt ? `done ${hhmm(minOf(b.doneAt))}` : undefined, kind: "done", title: `${who}: visit completed${b.doneAt ? ` at ${hhmm(minOf(b.doneAt))}` : ""}` };
  };
  const stations: FlowStation[] = [
    {
      key: "expected",
      label: "Still to arrive",
      count: expected.length,
      note: expected[0] ? `Next ${hhmm(minOf(expected[0].start))}` : undefined,
      chips: expected.map((b) => ({
        id: b.id,
        label: hhmm(minOf(b.start)),
        sub: queueDisplay ? b.room : nameFor(b).split(" ")[0],
        kind: "time",
        title: `${hhmm(minOf(b.start))}: ${queueDisplay ? b.room : `${nameFor(b)} with ${staffById(b.staffId)?.name}`}`,
      })),
    },
    ...COLUMNS.map((c) => ({ key: c.status as FlowKey, label: c.label, count: byStage[c.status].length, chips: byStage[c.status].map((b) => chipFor(b, c.status)) })),
  ];
  const noShowCount = notSeen.filter((b) => b.status === "no-show").length;
  const cancelledCount = notSeen.filter((b) => b.status === "cancelled").length;

  const reveal = useCallback(
    (selector: string, focus?: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: -120 });
      else el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focus) window.setTimeout(() => document.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true }), 450);
    },
    [lenis],
  );

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-queue-card="${id}"]`)?.focus());
  }, [bookings]);

  const announce = (msg: string) => setAnnouncement(msg);

  const moveTo = (b: Booking, to: AppointmentStatus, opts: { focus?: boolean; quiet?: boolean } = {}) => {
    const patch: Partial<Booking> = { status: to };
    if (to === "in-session") patch.calledAt = NOW_ISO;
    if (to === "completed") patch.doneAt = NOW_ISO;
    if (to === "arrived" || to === "waiting") patch.calledAt = undefined;
    if (b.status === "completed" && to !== "completed") patch.doneAt = undefined;
    if (to === "no-show") patch.cancelReason = "Left without being seen";
    if (to === "cancelled") patch.cancelReason = "Cancelled at the front desk";
    const busyWith = to === "in-session" ? today.find((x) => x.id !== b.id && x.staffId === b.staffId && x.status === "in-session") : undefined;
    const prev = patchBooking(b.id, patch);
    if (callingId === b.id && to !== "arrived" && to !== "waiting") setCallingId(null);
    if (opts.focus) pendingFocus.current = b.id;
    const label = to === "completed" ? "Done" : COLUMNS.find((c) => c.status === to)?.label ?? APPOINTMENT_STATUS_LABEL[to];
    announce(`${tokenOr(b)} moved to ${label}.`);
    const undo = prev ? { label: "Undo", onClick: () => restoreBooking(prev) } : undefined;
    if (busyWith) {
      toast({ title: `${staffById(b.staffId)?.name} is still with ${tokenOr(busyWith)}`, description: `${tokenOr(b)} was sent in anyway — move ${tokenOr(busyWith)} on when they finish.`, tone: "warning", action: undo });
    } else if (to === "checkout") {
      toast({ title: `${tokenOr(b)} at checkout`, description: "No payment is taken or recorded in this prototype.", action: undo });
    } else if (to === "completed") {
      toast({ title: `${tokenOr(b)} done`, description: "Visit closed in this browser session. Book the follow-up before they leave.", tone: "success", action: undo });
    } else if (to === "no-show") {
      toast({ title: `${tokenOr(b)} left without being seen`, description: "Recorded locally — no follow-up was created.", tone: "warning", action: undo });
    } else if (to === "cancelled") {
      toast({ title: `${tokenOr(b)} cancelled at the desk`, description: "Recorded locally — no message was sent.", tone: "warning", action: undo });
    } else if (!opts.quiet && to === "in-session") {
      toast({ title: `${tokenOr(b)} sent in`, description: `To ${staffById(b.staffId)?.name} · ${b.room}. Status updated in this browser session.`, tone: "success", action: undo });
    }
  };

  const step = (b: Booking, dir: 1 | -1, focus = false) => {
    if (!isStage(b.status)) return;
    const j = FLOW.indexOf(b.status) + dir;
    if (j < 0 || j >= FLOW.length) return;
    moveTo(b, FLOW[j], { focus, quiet: focus });
  };

  const callNext = () => {
    const busy = new Set(today.filter((b) => b.status === "in-session").map((b) => b.staffId));
    const next = queued.find((b) => !busy.has(b.staffId));
    if (!next) {
      toast(
        queued.length
          ? { title: "Everyone waiting is booked with a practitioner who's still in session", description: "Move the current patient on, then call again.", tone: "warning" }
          : { title: "No one is waiting", description: "Check in an expected patient or register a walk-in." },
      );
      return;
    }
    setCallingId(next.id);
    announce(`Now calling ${tokenOr(next)}, ${next.room}.`);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-queue-card="${next.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const doCheckIn = (b: Booking) => {
    const prev = { ...b };
    const token = checkIn(b.id, true);
    announce(`${token} checked in.`);
    toast({
      title: `${displayName(person(b.patientId)?.name ?? "Patient", queueDisplay)} checked in · ${token}`,
      description: "Added to Arrived. Recorded in this browser session — no arrival alert was sent.",
      tone: "success",
      action: { label: "Undo", onClick: () => restoreBooking(prev) },
    });
  };

  const onCardKey = (e: KeyboardEvent<HTMLElement>, b: Booking) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(b, 1, true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(b, -1, true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Front desk · Friday 13 November · 09:40"
        title="Queue"
        description="Tokens are issued at check-in; wait times run from arrival."
        actions={
          <>
            <label className="inline-flex h-10 cursor-pointer items-center gap-3 rounded-full bg-surface pl-4 pr-2 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)]">
              <MonitorPlay size={18} className="text-ink-2" aria-hidden="true" />
              <span>Queue display</span>
              <Switch checked={queueDisplay} onCheckedChange={setQueueDisplay} aria-label="Queue display: show tokens only" />
            </label>
            <Button
              variant="dark"
              leading={<UserPlus />}
              onClick={() => {
                setWalkInSession((n) => n + 1);
                setWalkInOpen(true);
              }}
            >
              Walk-in
            </Button>
            <Button variant="primary" leading={<Megaphone />} onClick={callNext}>
              Call next
            </Button>
          </>
        }
      />

      <section aria-labelledby="flow-title" className="rounded-card bg-surface p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h2 id="flow-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Visit flow · today
            </h2>
            <p className="mt-1 text-xs text-muted">Each visit moves left to right as you act on it below · chips show the token (or booked time) and how long they&apos;ve been at that stage</p>
          </div>
          <p className="text-sm text-ink-2">
            <span className="text-ink">{inClinic.length}</span> in clinic · <span className="text-ink">{byStage.completed.length}</span> done · <span className="text-ink">{expected.length}</span> to come
          </p>
        </div>
        <StageFlow
          stations={stations}
          notSeen={{ count: notSeen.length, detail: [noShowCount ? `${noShowCount} no-show` : null, cancelledCount ? `${cancelledCount} cancelled` : null].filter(Boolean).join(" · ") }}
          onStation={(key) => (key === "expected" ? reveal("#queue-expected") : reveal(`[data-queue-col="${key}"]`))}
          onChip={(key, id) => (key === "expected" ? reveal(`[data-expected-row="${id}"]`, `[data-expected-row="${id}"] button`) : reveal(`[data-queue-card="${id}"]`, `[data-queue-card="${id}"]`))}
          onNotSeen={() => reveal("#queue-not-seen")}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Longest wait"
          value={longest ? waitLabel(longest.arrivedAt) ?? "—" : "—"}
          icon={<Timer />}
          context={
            longest ? (
              <span className="flex flex-col gap-2">
                <WaitMeter minutes={minutesSince(longest.arrivedAt)} />
                <span className={cn("inline-flex items-center gap-1", minutesSince(longest.arrivedAt) >= WAIT_FLAG && "text-warning")}>
                  {minutesSince(longest.arrivedAt) >= WAIT_FLAG ? <Timer size={12} aria-hidden="true" /> : null}
                  {tokenOr(longest)} · {queueDisplay ? `since ${hhmm(minOf(longest.arrivedAt ?? longest.start))}` : nameFor(longest)}
                  {minutesSince(longest.arrivedAt) >= WAIT_FLAG ? ` · over ${WAIT_FLAG} min` : ""}
                </span>
              </span>
            ) : (
              "Nobody waiting"
            )
          }
        />
        <Stat
          label="Average wait to be seen"
          value={avgWait === null ? "—" : `${avgWait} min`}
          icon={<HourglassMedium />}
          context={avgWait === null ? "Nobody has been called in yet today" : `From arrival to being called in · ${seen.length} ${seen.length === 1 ? "visit" : "visits"} today`}
        />
        <Stat
          label="Intake forms missing"
          value={missingIntake.length}
          icon={<ClipboardText />}
          context={missingIntake.length ? missingIntake.slice(0, 2).map((b) => (queueDisplay ? tokenOr(b) : nameFor(b))).join(", ") + (missingIntake.length > 2 ? ` +${missingIntake.length - 2}` : "") : "All complete"}
        />
        <Stat
          label={`Free for a walk-in now`}
          value={freeNow.length}
          icon={<UsersThree />}
          context={
            freeNow.length ? (
              <span className="flex items-center gap-2">
                <AvatarStack people={freeNow.map((s) => ({ name: s.name, avatar: s.avatar }))} max={3} size="xs" />
                <span className="min-w-0 truncate">{freeNow.map((s) => s.name).join(", ")}</span>
              </span>
            ) : (
              `Everyone on shift is busy for the next ${WALK_IN_MIN} min`
            )
          }
        />
      </div>

      <AnimatePresence initial={false}>
        {calling ? (
          <motion.section
            key="calling"
            aria-label="Now calling"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
            transition={spring}
            className="flex flex-wrap items-center gap-6 rounded-card bg-charcoal p-6 text-white"
          >
            <div className="flex items-center gap-4">
              <span className="relative flex size-3">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white" />
                <span className="relative size-3 rounded-full bg-white" />
              </span>
              <div>
                <p className="text-xs text-white/70">Now calling</p>
                <p className="font-mono text-[40px] font-light leading-none tabular">{tokenOr(calling)}</p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-light">{queueDisplay ? `Please go to ${calling.room}` : `${nameFor(calling)} → ${calling.room}`}</p>
              <p className="text-xs text-white/70">
                {staffById(calling.staffId)?.name} · No display screen or speaker is connected — announce it at the desk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="glass" leading={<SpeakerHigh />} onClick={() => toast({ title: `Recall ${tokenOr(calling)}`, description: "Nothing was played — announce the token again at the desk." })}>
                Recall
              </Button>
              <Button variant="secondary" className="bg-white" leading={<ArrowRight />} onClick={() => moveTo(calling, "in-session")}>
                Send in
              </Button>
              <IconButton label="Stop calling" variant="outline-light" onClick={() => setCallingId(null)}>
                <X />
              </IconButton>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {queueDisplay ? (
        <p className="-mt-2 flex items-center gap-2 text-xs text-muted">
          <MonitorPlay size={14} aria-hidden="true" />
          Queue display is on: tokens only — names and services are hidden for screens visitors can see.
        </p>
      ) : null}

      <LayoutGroup id="queue">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = byStage[col.status];
            const Icon = col.icon;
            return (
              <Group key={col.status} data-queue-col={col.status} className="flex min-h-[220px] scroll-mt-32 flex-col" aria-label={`${col.label}, ${items.length}`}>
                <div className="flex items-center gap-2 p-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{col.label}</h2>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface px-2 text-xs tabular text-ink-2">{items.length}</span>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {items.map((b) => (
                    <QueueCard
                      key={b.id}
                      b={b}
                      stage={col.status}
                      calling={calling?.id === b.id}
                      name={nameFor(b)}
                      hideDetails={queueDisplay}
                      onStep={(dir) => step(b, dir)}
                      onKey={(e) => onCardKey(e, b)}
                      onMove={(to) => moveTo(b, to)}
                      onCall={() => {
                        setCallingId(b.id);
                        announce(`Now calling ${tokenOr(b)}.`);
                      }}
                      onIntake={() => {
                        const prev = patchBooking(b.id, { formsComplete: true });
                        toast({ title: `Intake marked complete · ${tokenOr(b)}`, description: "Recorded as completed on paper at the desk — no form was uploaded.", tone: "success", action: prev ? { label: "Undo", onClick: () => restoreBooking(prev) } : undefined });
                      }}
                    />
                  ))}
                  {items.length === 0 ? <li className="flex flex-1 items-center justify-center rounded-inner border border-dashed border-line-strong px-4 py-8 text-center text-xs text-muted">{col.empty}</li> : null}
                </ul>
              </Group>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card id="queue-expected" className="scroll-mt-32">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Expected today</h2>
                <p className="mt-1 text-sm text-muted">Booked and not yet arrived · check in to issue the next token.</p>
              </div>
              <Button asChild size="sm" variant="ghost" trailing={<ArrowUpRight />}>
                <Link href="/schedule">Calendar</Link>
              </Button>
            </div>
            {expected.length ? (
              <ul className="mt-4 flex flex-col">
                {expected.map((b) => {
                  const staff = staffById(b.staffId);
                  return (
                    <motion.li
                      key={b.id}
                      layoutId={`q-${b.id}`}
                      transition={spring}
                      data-expected-row={b.id}
                      className="flex scroll-mt-32 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0"
                    >
                      <span className="w-12 shrink-0 font-mono text-[13px] text-ink tabular">{hhmm(minOf(b.start))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{queueDisplay ? "Name hidden" : nameFor(b)}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                          <DisciplineDot discipline={b.discipline} />
                          {queueDisplay ? b.room : `${b.service} · ${b.room}`}
                        </span>
                      </span>
                      <span className="hidden items-center gap-2 text-xs text-muted md:flex">
                        <Avatar src={staff?.avatar} name={staff?.name ?? ""} size="xs" />
                        {staff?.name}
                      </span>
                      <IntakeBadge complete={b.formsComplete} className="hidden sm:inline-flex" />
                      <Button size="sm" variant="secondary" leading={<SignIn />} onClick={() => doCheckIn(b)}>
                        Check in
                      </Button>
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<CheckCircle />} title="Everyone booked today has arrived" className="py-8" />
            )}
          </Card>

          <Card id="queue-not-seen" className="scroll-mt-32">
            <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Not seen today</h2>
            <p className="mt-1 text-sm text-muted">No-shows and cancellations — rebook before the day ends.</p>
            {notSeen.length ? (
              <ul className="mt-4 flex flex-col">
                {notSeen.map((b) => (
                  <motion.li key={b.id} layoutId={`q-${b.id}`} transition={spring} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="w-12 shrink-0 font-mono text-[13px] text-muted tabular">{hhmm(minOf(b.start))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{nameFor(b)}</span>
                      <span className="block truncate text-xs text-muted">{b.cancelReason ?? b.notes ?? staffById(b.staffId)?.name}</span>
                    </span>
                    <ApptStatus status={b.status} />
                    <IconButton asChild size="sm" variant="soft" label={`Rebook ${queueDisplay ? tokenOr(b) : nameFor(b)}`}>
                      <Link href={`/schedule?new=1&patient=${b.patientId}&staff=${b.staffId}`}>
                        <CalendarPlus />
                      </Link>
                    </IconButton>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CheckCircle />} title="No missed visits today" className="py-8" />
            )}
          </Card>
        </div>
      </LayoutGroup>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        Keyboard: focus a card, then <Kbd>←</Kbd> <Kbd>→</Kbd> to move it between columns. Everything here is recorded in this browser session only.
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <WalkInModal
        open={walkInOpen}
        session={walkInSession}
        onOpenChange={setWalkInOpen}
        onIssued={(b) => {
          setWalkInOpen(false);
          announce(`Token ${b.token} added to Arrived.`);
        }}
      />
    </div>
  );
}

function QueueCard({
  b,
  stage,
  calling,
  name,
  hideDetails,
  onStep,
  onKey,
  onMove,
  onCall,
  onIntake,
}: {
  b: Booking;
  stage: Stage;
  calling: boolean;
  name: string;
  hideDetails: boolean;
  onStep: (dir: 1 | -1) => void;
  onKey: (e: KeyboardEvent<HTMLElement>) => void;
  onMove: (to: AppointmentStatus) => void;
  onCall: () => void;
  onIntake: () => void;
}) {
  const staff = staffById(b.staffId);
  const token = b.token ?? hhmm(minOf(b.start));
  const waited = minutesSince(b.arrivedAt);
  const waitedLabel = waitLabel(b.arrivedAt);
  const inFor = waitLabel(b.calledAt);
  const timing =
    stage === "arrived" || stage === "waiting"
      ? { label: waitedLabel === "just now" ? "arrived just now" : `${waitedLabel ?? "—"} waiting`, tone: waited >= 45 ? "text-danger" : waited >= 30 ? "text-warning" : "text-muted" }
      : stage === "in-session"
        ? { label: inFor === "just now" ? "just sent in" : `in for ${inFor ?? "—"}`, tone: "text-muted" }
        : stage === "checkout"
          ? { label: "at checkout", tone: "text-muted" }
          : { label: b.calledAt && b.doneAt ? `${hhmm(minOf(b.calledAt))}–${hhmm(minOf(b.doneAt))}` : "done", tone: "text-muted" };
  const idx = FLOW.indexOf(stage);

  return (
    <motion.li
      layoutId={`q-${b.id}`}
      transition={spring}
      data-queue-card={b.id}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={`Token ${token}${hideDetails ? "" : `, ${name}`}, ${APPOINTMENT_STATUS_LABEL[b.status]}, ${timing.label}. Use left and right arrow keys to move.`}
      className={cn(
        "relative flex flex-col gap-3 rounded-inner bg-surface p-4 outline-none transition-shadow duration-300",
        "focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]",
        calling && "shadow-[inset_0_0_0_2px_var(--color-charcoal)]",
      )}
      style={{ borderRadius: 16 }}
    >
      <div className="flex items-start justify-between gap-2">
        <TokenChip token={token} size="lg" className={cn(!b.token && "bg-sunken text-ink-2")} />
        <span className={cn("inline-flex min-w-0 items-center gap-1 whitespace-nowrap pt-1.5 text-xs", timing.tone)}>
          <Timer size={14} aria-hidden="true" />
          {timing.label}
        </span>
      </div>
      {calling ? <StatusBadge tone="dark" pulse className="self-start">Calling now</StatusBadge> : null}
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", hideDetails ? "text-muted" : "text-ink")}>{name}</p>
        {!hideDetails ? <p className="truncate text-xs text-muted">{b.service}</p> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <Avatar src={staff?.avatar} name={staff?.name ?? ""} size="xs" />
        <span className="truncate">
          {staff?.name} · {b.room}
        </span>
      </div>
      {!hideDetails && stage !== "completed" ? <IntakeBadge complete={b.formsComplete} className="self-start" /> : null}
      <div className="flex items-center gap-2">
        {stage === "completed" ? (
          <Button asChild size="sm" variant="secondary" leading={<CalendarPlus />} className="flex-1">
            <Link href={`/schedule?new=1&patient=${b.patientId}&staff=${b.staffId}`}>Book follow-up</Link>
          </Button>
        ) : (
          <Button size="sm" variant={stage === "waiting" ? "dark" : "secondary"} trailing={<ArrowRight />} className="flex-1" onClick={() => onStep(1)}>
            {NEXT_LABEL[stage]}
          </Button>
        )}
        <Dropdown>
          <DropdownTrigger asChild>
            <IconButton label={`More actions for ${token}`} size="sm" variant="soft">
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent className="w-[240px]">
            {idx > 0 ? (
              <DropdownItem icon={<ArrowCounterClockwise />} onSelect={() => onStep(-1)}>
                Move back
              </DropdownItem>
            ) : null}
            {stage === "arrived" || stage === "waiting" ? (
              <DropdownItem icon={<Megaphone />} onSelect={onCall}>
                Call this token
              </DropdownItem>
            ) : null}
            {b.formsComplete === false ? (
              <DropdownItem icon={<ClipboardText />} onSelect={onIntake}>
                Mark intake complete
              </DropdownItem>
            ) : null}
            {!b.patientId.startsWith("local-") ? (
              <DropdownItem asChild icon={<ArrowUpRight />}>
                <Link href={`/patients/${b.patientId}`}>Open patient record</Link>
              </DropdownItem>
            ) : null}
            {stage === "arrived" || stage === "waiting" ? (
              <>
                <DropdownSeparator />
                <DropdownItem icon={<UserMinus />} tone="danger" onSelect={() => onMove("no-show")}>
                  Left without being seen
                </DropdownItem>
                <DropdownItem icon={<XCircle />} tone="danger" onSelect={() => onMove("cancelled")}>
                  Cancel visit
                </DropdownItem>
              </>
            ) : null}
          </DropdownContent>
        </Dropdown>
      </div>
    </motion.li>
  );
}

/** Wait on a 0–60 min scale with a tick at the 30-minute flag; the fill turns warning / danger past the thresholds. */
function WaitMeter({ minutes }: { minutes: number }) {
  const max = 60;
  const tone = minutes >= WAIT_ESCALATE ? "bg-danger" : minutes >= WAIT_FLAG ? "bg-warning" : "bg-charcoal";
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(minutes, max)}
      aria-label={`Waited ${minutes} minutes; flagged at ${WAIT_FLAG}`}
      className="relative block h-1.5 w-full rounded-full bg-sunken"
    >
      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]", tone)} style={{ width: `${Math.min(100, (minutes / max) * 100)}%` }} />
      <span aria-hidden="true" className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${(WAIT_FLAG / max) * 100}%` }} />
    </span>
  );
}
