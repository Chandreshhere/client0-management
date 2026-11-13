"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CalendarBlank,
  CalendarPlus,
  CalendarX,
  CaretDown,
  CheckCircle,
  ClipboardText,
  CreditCard,
  HourglassMedium,
  PaperPlaneTilt,
  Queue,
  Receipt,
  SignIn,
  UserPlus,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { formatINR, formatTime, pluralize } from "@/lib/format";
import { usePlan } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge, appointmentTone, invoiceTone, priorityTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { BRANCHES, DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL, TODAY_APPOINTMENTS, WAITLIST } from "@/data/appointments";
import { TASKS } from "@/data/care";
import { INVOICES, INVOICE_STATUS_LABEL, collected } from "@/data/records";
import { BubbleChart } from "@/components/viz/bubble-chart";
import type { Appointment, AppointmentStatus } from "@/data/types";
import { NOW_ISO, NOW_LABEL, NOW_MIN, istMinutes, minutesUntil, shortDate, spanLabel, whenLabel } from "./data";
import { DashGrid, DashboardHeader, DisciplineDot, FocalCard, FocalHead, NowMarker, Panel, PanelEmpty, Reveal } from "./ui";
import { StageFlow, type FlowStage } from "./viz";

/**
 * Front-desk home (doc §3A): today's diary, arrivals, waiting patients, cancellations, missing
 * forms and checkout actions. The focal card is the live token queue; queue actions update the
 * diary in the same session. Payments are never shown as received without a confirmation.
 */
const ME = DEMO_USER.frontdesk.personId;
const BRANCH = BRANCHES.find((b) => b.id === staffById(ME)?.branch)!;

const branchAppointments = TODAY_APPOINTMENTS.filter((a) => BRANCH.rooms.includes(a.room)).sort((a, b) => a.start.localeCompare(b.start));
const otherBranchCount = TODAY_APPOINTMENTS.length - branchAppointments.length;

type QueueStatus = Extract<AppointmentStatus, "arrived" | "waiting" | "in-session" | "checkout" | "completed">;
/** `sentInAt` = when the patient went in to the practitioner (sent in from this screen, or the slot start for sessions already running). */
type QueueEntry = { apptId: string; token: string; status: QueueStatus; arrivedAt: string; sentInAt?: string };

const QUEUE_STATES = new Set<AppointmentStatus>(["arrived", "waiting", "in-session", "checkout"]);
const INITIAL_QUEUE: QueueEntry[] = branchAppointments
  .filter((a) => QUEUE_STATES.has(a.status) && a.token)
  .map((a) => ({ apptId: a.id, token: a.token!, status: a.status as QueueStatus, arrivedAt: a.arrivedAt ?? a.start }));
const lastToken = Math.max(...TODAY_APPOINTMENTS.map((a) => Number(a.token?.split("-")[1] ?? 0)));

const apptById = (id: string) => TODAY_APPOINTMENTS.find((a) => a.id === id)!;
const QUEUE_ORDER: Record<QueueStatus, number> = { waiting: 0, arrived: 0, "in-session": 1, checkout: 2, completed: 3 };

const missingForms = branchAppointments.filter((a) => a.formsComplete === false && a.status !== "cancelled" && a.status !== "no-show");
const missed = branchAppointments.filter((a) => a.status === "cancelled" || a.status === "no-show");
const OPEN_INVOICE = new Set(["due", "overdue", "partially-paid", "failed"]);
const openInvoices = INVOICES.filter((i) => OPEN_INVOICE.has(i.status));
const outstanding = openInvoices.reduce((s, i) => s + (i.total - i.paid), 0);
const failedInvoice = INVOICES.find((i) => i.status === "failed") ?? null;
/** Visits already finished today that came through the desk (they have a check-in time). */
const DONE_BEFORE_NOW = branchAppointments.filter((a) => a.status === "completed" && a.arrivedAt);

const KIND_LABEL: Record<Appointment["kind"], string> = {
  review: "Reviews",
  "follow-up": "Follow-ups",
  class: "Classes",
  session: "1:1 sessions",
  consultation: "New consults",
  "walk-in": "Walk-ins",
};
/** Today's diary at this branch by visit type (every booking, including the cancelled one). */
const VISIT_MIX = (Object.keys(KIND_LABEL) as Appointment["kind"][])
  .map((k) => ({ id: k, label: KIND_LABEL[k], value: branchAppointments.filter((a) => a.kind === k).length }))
  .filter((x) => x.value > 0);

/** Only confirmed payments count as collected; the failed UPI callback is listed as not collected. */
const COLLECTED_TODAY = collected();
const CONFIRMED_TODAY = INVOICES.flatMap((i) => (i.payments ?? []).filter((p) => p.confirmed && p.at.startsWith("2026-11-13")).map((p) => ({ ...p, invoice: i })));
const UNCONFIRMED = INVOICES.flatMap((i) => (i.payments ?? []).filter((p) => !p.confirmed).map((p) => ({ ...p, invoice: i })));

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const waitlist = [...WAITLIST].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.addedAt.localeCompare(b.addedAt));

export function FrontdeskHome() {
  const { toast } = useToast();
  const { details } = usePlan();
  const [queue, setQueue] = useState<QueueEntry[]>(INITIAL_QUEUE);
  const [nextToken, setNextToken] = useState(lastToken + 1);

  // Live status per appointment (diary reads the queue so both stay in step).
  const statusOf = useMemo(() => {
    const m = new Map<string, AppointmentStatus>();
    for (const q of queue) m.set(q.apptId, q.status);
    return (a: Appointment) => m.get(a.id) ?? a.status;
  }, [queue]);

  const active = queue.filter((q) => q.status !== "completed").sort((a, b) => QUEUE_ORDER[a.status] - QUEUE_ORDER[b.status] || Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt));
  const inQueue = new Set(queue.map((q) => q.apptId));
  const seen = new Set<string>();
  const expected = branchAppointments
    .filter((a) => a.status === "booked" && !inQueue.has(a.id) && minutesUntil(a.start) > 0 && minutesUntil(a.start) <= 180)
    .filter((a) => (seen.has(a.patientId) ? false : (seen.add(a.patientId), true)))
    .slice(0, 2);

  const setStatus = (apptId: string, status: QueueStatus) =>
    setQueue((qs) => qs.map((q) => (q.apptId === apptId ? { ...q, status, ...(status === "in-session" ? { sentInAt: NOW_ISO } : {}) } : q)));

  const advance = (q: QueueEntry) => {
    const a = apptById(q.apptId);
    const name = patientById(a.patientId)?.name;
    if (q.status === "arrived" || q.status === "waiting") {
      setStatus(q.apptId, "in-session");
      toast({ title: `${name} sent to ${a.room}`, description: "Status updated in this browser session." });
    } else if (q.status === "in-session") {
      setStatus(q.apptId, "checkout");
      toast({ title: `${name} moved to checkout`, description: "Collect payment and book the follow-up before they leave." });
    } else if (q.status === "checkout") {
      setStatus(q.apptId, "completed");
      toast({ tone: "success", title: `${name} checked out`, description: "Recorded locally. No payment is marked received from here." });
    }
  };

  const markArrived = (a: Appointment) => {
    const token = `A-${String(nextToken).padStart(2, "0")}`;
    setQueue((qs) => [...qs, { apptId: a.id, token, status: "arrived", arrivedAt: NOW_ISO }]);
    setNextToken((n) => n + 1);
    toast({ tone: "success", title: `${patientById(a.patientId)?.name} checked in · token ${token}`, description: `For ${formatTime(a.start)} with ${staffById(a.staffId)?.name}. Saved in this browser session.` });
  };

  const waiting = active.filter((q) => q.status === "arrived" || q.status === "waiting");
  const longest = waiting.reduce<QueueEntry | null>((m, q) => (!m || Date.parse(q.arrivedAt) < Date.parse(m.arrivedAt) ? q : m), null);

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        summary={`${pluralize(branchAppointments.length, "appointment")} today · ${waiting.length} waiting · ${pluralize(missingForms.length, "intake form")} missing · ${formatINR(outstanding)} outstanding`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/patients?new=1">
                <UserPlus />
                Register walk-in
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/schedule?new=1">
                <CalendarPlus />
                New appointment
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <QueueCard queue={queue} active={active} waitingCount={waiting.length} longest={longest} expected={expected} onAdvance={advance} onArrive={markArrived} nextToken={nextToken} />
        </Reveal>

        <Reveal index={1} className="xl:col-start-3 xl:row-span-4 xl:row-start-1 xl:self-start">
          <DiaryPanel statusOf={statusOf} />
        </Reveal>

        <Reveal index={2}>
          <IntakePanel />
        </Reveal>

        <Reveal index={3}>
          <FailedPaymentPanel />
        </Reveal>

        <Reveal index={4}>
          <Panel
            icon={<CalendarX />}
            title="Cancellations & no-shows"
            subtitle={`${missed.filter((a) => a.status === "cancelled").length} cancelled · ${missed.filter((a) => a.status === "no-show").length} no-show today`}
            href="/schedule"
            actionLabel="Open schedule"
          >
            {missed.length === 0 ? (
              <PanelEmpty icon={<CalendarX />} title="No cancellations today" />
            ) : (
              missed.map((a) => {
                const p = patientById(a.patientId);
                const wait = WAITLIST.find((w) => w.patientId === a.patientId);
                // Only name a follow-up owner whose role exists on this plan (no coordinator on Team).
                const task = TASKS.find((t) => t.patientId === a.patientId && /rebook/i.test(t.title) && t.status !== "done" && details.roles.includes(staffById(t.ownerId)?.role ?? "patient"));
                return (
                  <div key={a.id} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{p?.name}</p>
                        <p className="text-xs text-muted">
                          {formatTime(a.start)} · {a.service} · {staffById(a.staffId)?.name}
                        </p>
                      </div>
                      <StatusBadge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status]}</StatusBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted">
                        {a.notes ?? (task ? `${staffById(task.ownerId)?.name} is following up · ${formatTime(task.due)}` : "Not rebooked yet")}
                        {wait ? " · waitlisted for an earlier slot" : ""}
                      </span>
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/schedule?new=1">
                          <CalendarPlus />
                          Rebook
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </Reveal>

        <Reveal index={5}>
          <CheckoutPanel statusOf={statusOf} />
        </Reveal>

        <Reveal index={6} className="lg:col-span-2">
          <WaitlistPanel />
        </Reveal>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: live queue
// ---------------------------------------------------------------------------------------------

function QueueCard({
  queue,
  active,
  waitingCount,
  longest,
  expected,
  onAdvance,
  onArrive,
  nextToken,
}: {
  queue: QueueEntry[];
  active: QueueEntry[];
  waitingCount: number;
  longest: QueueEntry | null;
  expected: Appointment[];
  onAdvance: (q: QueueEntry) => void;
  onArrive: (a: Appointment) => void;
  nextToken: number;
}) {
  const id = useId();
  const inSession = active.filter((q) => q.status === "in-session").length;
  const atCheckout = active.filter((q) => q.status === "checkout").length;
  const longestAppt = longest ? apptById(longest.apptId) : null;

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Live queue · Reception"
        title={`${pluralize(waitingCount, "patient")} waiting · ${inSession} in session${atCheckout ? ` · ${atCheckout} at checkout` : ""}`}
        meta={
          longest && longestAppt ? (
            <>
              Longest wait {spanLabel(NOW_MIN - istMinutes(longest.arrivedAt))} — {patientById(longestAppt.patientId)?.name}
              {longestAppt.kind === "walk-in" ? " (walk-in)" : ""}, token <span className="font-mono">{longest.token}</span>
            </>
          ) : (
            "Nobody is waiting right now"
          )
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{NOW_LABEL}</p>
            <p className="text-xs text-white/90">
              Next token <span className="font-mono">A-{String(nextToken).padStart(2, "0")}</span>
            </p>
          </div>
        }
      />

      <div className="px-2 pb-2">
        <StageFlow variant="primary" label="Today's check-ins by stage" stages={queueStages(queue)} />
      </div>

      <ul className="flex flex-col gap-2" aria-label="Patients in the queue">
        <AnimatePresence initial={false} mode="popLayout">
          {active.length === 0 ? (
            <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-inner bg-surface p-4 text-sm text-muted">
              The queue is empty.
            </motion.li>
          ) : (
            active.map((q) => <QueueRow key={q.apptId} entry={q} onAdvance={onAdvance} />)
          )}
        </AnimatePresence>
      </ul>

      <figure className="grid grid-cols-1 items-center gap-4 rounded-inner p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)] md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <BubbleChart title={`Today's ${branchAppointments.length} appointments by visit type`} items={VISIT_MIX} height={230} className="mx-auto max-w-[320px]" />
        <div className="min-w-0">
          <figcaption className="text-sm text-white">
            Today&apos;s {branchAppointments.length} appointments at {BRANCH.name}, by visit type
          </figcaption>
          <p className="mt-1 text-xs text-white/90">
            Bubble area = number of appointments · includes {missed.filter((a) => a.status === "cancelled").length} cancelled and {missed.filter((a) => a.status === "no-show").length} no-show
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-white/90">
            {VISIT_MIX.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 border-b border-white/20 pb-2">
                <span className="truncate">{v.label}</span>
                <span className="tabular text-white">{v.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </figure>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 p-4 pt-2">
        <p className="text-xs text-white/90">Expected next</p>
        {expected.length === 0 ? <p className="text-xs text-white">No one due in the next 3 hours</p> : null}
        {expected.map((a) => {
          const p = patientById(a.patientId);
          return (
            <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-1 text-xs text-white">
              <Avatar src={p?.avatar} name={p?.name ?? ""} size="xs" className="bg-white" />
              <span>
                {formatTime(a.start)} {p?.name}
              </span>
              <Button size="sm" variant="secondary" className="h-6 px-2.5 shadow-none" onClick={() => onArrive(a)} aria-label={`Check in ${p?.name} for ${formatTime(a.start)}`}>
                <SignIn />
                Check in
              </Button>
            </span>
          );
        })}
      </div>
    </FocalCard>
  );
}

/** Arrived → Waiting → With practitioner → Checkout → Done, from the live queue (check-in times from the diary). */
function queueStages(queue: QueueEntry[]): FlowStage[] {
  const at = (st: QueueStatus) => queue.filter((q) => q.status === st);
  const person = (apptId: string) => {
    const p = patientById(apptById(apptId).patientId);
    return { name: p?.name ?? "Patient", avatar: p?.avatar };
  };
  const waitHint = (list: QueueEntry[]) => (list.length ? `longest ${spanLabel(Math.max(...list.map((q) => NOW_MIN - istMinutes(q.arrivedAt))))}` : "nobody");
  const done = [...DONE_BEFORE_NOW.map((a) => ({ apptId: a.id, arrivedAt: a.arrivedAt! })), ...at("completed")];
  const describe = (label: string, list: { apptId: string }[], extra = "") =>
    `${label}: ${list.length}${list.length ? ` — ${list.map((q) => person(q.apptId).name).join(", ")}` : ""}${extra ? `, ${extra}` : ""}`;
  const arrived = at("arrived");
  const waiting = at("waiting");
  const inSession = at("in-session");
  const checkout = at("checkout");
  return [
    { id: "arrived", label: "Arrived", count: arrived.length, people: arrived.map((q) => person(q.apptId)), hint: waitHint(arrived), emphasis: arrived.length > 0, description: describe("Arrived", arrived, arrived.length ? waitHint(arrived) : "") },
    { id: "waiting", label: "Waiting", count: waiting.length, people: waiting.map((q) => person(q.apptId)), hint: waitHint(waiting), emphasis: waiting.length > 0, alert: waiting.some((q) => NOW_MIN - istMinutes(q.arrivedAt) > 30), description: describe("Waiting", waiting, waiting.length ? waitHint(waiting) : "") },
    { id: "in-session", label: "With practitioner", count: inSession.length, people: inSession.map((q) => person(q.apptId)), hint: inSession.length ? inSession.map((q) => apptById(q.apptId).room).join(", ") : "rooms free", description: describe("With practitioner", inSession) },
    { id: "checkout", label: "Checkout", count: checkout.length, people: checkout.map((q) => person(q.apptId)), hint: checkout.length ? "collect & book" : "nobody", emphasis: checkout.length > 0, description: describe("At checkout", checkout) },
    { id: "done", label: "Done", count: done.length, people: done.map((q) => person(q.apptId)), hint: done.length ? `first in ${formatTime(done.map((d) => d.arrivedAt).sort()[0])}` : "none yet", description: describe("Done today", done) },
  ];
}

function QueueRow({ entry: q, onAdvance }: { entry: QueueEntry; onAdvance: (q: QueueEntry) => void }) {
  const a = apptById(q.apptId);
  const p = patientById(a.patientId);
  const waitMin = NOW_MIN - istMinutes(q.arrivedAt);
  const waitingNow = q.status === "arrived" || q.status === "waiting";
  const long = waitingNow && waitMin > 30;
  const action = waitingNow ? "Send in" : q.status === "in-session" ? "Checkout" : "Done";
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }} transition={spring} className="@container rounded-inner bg-surface p-4 text-ink">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-10 min-w-14 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-charcoal px-3 font-mono text-sm text-white" aria-label={`Token ${q.token}`}>
            {q.token}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{p?.name}</p>
            <p className="truncate text-xs text-muted">
              {a.kind === "walk-in" ? "Walk-in · " : `${formatTime(a.start)} · `}
              {staffById(a.staffId)?.name} · {a.room}
              {a.formsComplete === false ? " · intake incomplete" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 @lg:justify-end">
          <span className={cn("flex items-center gap-1.5 text-xs tabular", long ? "text-warning" : "text-muted")}>
            {long ? <HourglassMedium size={14} aria-hidden="true" /> : null}
            {waitingNow ? `${spanLabel(waitMin)} wait` : q.status === "in-session" ? `Since ${formatTime(q.sentInAt ?? a.start)}` : "Collect & book"}
          </span>
          <StatusBadge tone={appointmentTone(q.status)}>{APPOINTMENT_STATUS_LABEL[q.status]}</StatusBadge>
          <Button size="sm" variant={waitingNow ? "dark" : "secondary"} onClick={() => onAdvance(q)} aria-label={`${action}: ${p?.name}`}>
            {action}
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------------------------
// Diary by hour
// ---------------------------------------------------------------------------------------------

function DiaryPanel({ statusOf }: { statusOf: (a: Appointment) => AppointmentStatus }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const firstHourShown = Math.floor(NOW_MIN / 60) * 60; // the current hour stays visible
  const earlier = branchAppointments.filter((a) => istMinutes(a.start) < firstHourShown);
  const shown = showEarlier ? branchAppointments : branchAppointments.filter((a) => istMinutes(a.start) >= firstHourShown);

  const hours = new Map<number, Appointment[]>();
  for (const a of shown) {
    const h = Math.floor(istMinutes(a.start) / 60);
    hours.set(h, [...(hours.get(h) ?? []), a]);
  }
  const nextAfterNow = shown.find((a) => istMinutes(a.start) > NOW_MIN)?.id;

  return (
    <Panel
      icon={<CalendarBlank />}
      title="Today's diary"
      subtitle={`${pluralize(branchAppointments.length, "appointment")} · ${BRANCH.name}${otherBranchCount ? ` (+${otherBranchCount} at HSR Layout)` : ""}`}
      href="/schedule"
      actionLabel="Open the full calendar"
    >
      {earlier.length ? (
        <button
          type="button"
          onClick={() => setShowEarlier((v) => !v)}
          aria-expanded={showEarlier}
          className="flex h-10 items-center justify-between rounded-inner px-4 text-xs text-ink-2 transition-colors hover:bg-sunken-2"
        >
          {showEarlier ? "Hide earlier appointments" : `Show ${pluralize(earlier.length, "earlier appointment")} (before ${String(firstHourShown / 60).padStart(2, "0")}:00)`}
          <CaretDown size={14} className={cn("transition-transform duration-300 [transition-timing-function:var(--ease-spring)]", showEarlier && "rotate-180")} aria-hidden="true" />
        </button>
      ) : null}
      <ol className="flex flex-col gap-2">
        {[...hours.entries()].map(([h, items]) => (
          <li key={h} className="flex flex-col gap-2">
            {items[0].id === nextAfterNow ? <NowMarker className="mt-2" /> : null}
            <p className="px-2 pt-2 text-xs text-muted tabular" aria-hidden="true">
              {String(h).padStart(2, "0")}:00
            </p>
            <ul className="flex flex-col gap-2">
              {items.map((a, i) => {
                const p = patientById(a.patientId);
                const s = statusOf(a);
                const struck = s === "cancelled" || s === "no-show";
                return (
                  <li key={a.id} className="flex flex-col gap-2">
                    {a.id === nextAfterNow && i > 0 ? <NowMarker /> : null}
                    <Link
                      href={`/patients/${a.patientId}`}
                      className="flex items-start gap-3 rounded-inner bg-surface px-4 py-2 transition-colors duration-200 hover:bg-canvas"
                      aria-label={`${formatTime(a.start)} ${p?.name}, ${a.service} with ${staffById(a.staffId)?.name}, ${APPOINTMENT_STATUS_LABEL[s]}`}
                    >
                      <span className={cn("w-10 shrink-0 pt-0.5 text-xs tabular", struck ? "text-muted" : "text-ink")}>{formatTime(a.start)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", struck ? "text-muted line-through" : "text-ink")}>{p?.name}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <DisciplineDot discipline={a.discipline} />
                          <span className="min-w-0 truncate">
                            {DISCIPLINE_LABEL[a.discipline]} · {staffById(a.staffId)?.name.replace(/^Dr\. /, "Dr ")} · {a.room}
                          </span>
                        </span>
                      </span>
                      <StatusBadge tone={appointmentTone(s)} className="mt-0.5 shrink-0">
                        {APPOINTMENT_STATUS_LABEL[s]}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Side panels
// ---------------------------------------------------------------------------------------------

function IntakePanel() {
  const { has } = usePlan();
  const { toast } = useToast();
  const [state, setState] = useState<Record<string, "sent" | "received">>({});
  const open = missingForms.filter((a) => state[a.id] !== "received").length;
  return (
    <Panel icon={<ClipboardText />} title="Missing intake forms" subtitle={open ? `${pluralize(open, "form")} still missing for today` : "All intake forms in"} href="/schedule/queue" actionLabel="Open the queue">
      {missingForms.map((a) => {
        const p = patientById(a.patientId);
        const s = state[a.id];
        return (
          <div key={a.id} className="rounded-inner bg-surface p-4">
            <div className="flex items-start gap-3">
              <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{p?.name}</p>
                <p className="text-xs text-muted">
                  {a.kind === "walk-in" ? "Walk-in, at the desk" : `${formatTime(a.start)} · ${staffById(a.staffId)?.name}`}
                  {a.notes ? ` · ${a.notes}` : ""}
                </p>
              </div>
              {s === "received" ? <StatusBadge tone="success">Received</StatusBadge> : s === "sent" ? <StatusBadge tone="info">Link prepared</StatusBadge> : <StatusBadge tone="warning">Missing</StatusBadge>}
            </div>
            {s !== "received" ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {a.kind !== "walk-in" ? (
                  has("portal") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={s === "sent"}
                      onClick={() => {
                        setState((x) => ({ ...x, [a.id]: "sent" }));
                        toast({ title: `Form link prepared for ${p?.name}`, description: "Recorded locally — nothing was sent (no messaging integration in this demo)." });
                      }}
                    >
                      <PaperPlaneTilt />
                      {s === "sent" ? "Link prepared" : "Send form link"}
                    </Button>
                  ) : (
                    <Tip label="Digital forms need the patient portal (Clinic plan). Hand over a paper form instead.">
                      <span tabIndex={0} className="inline-flex rounded-full">
                        <Button size="sm" variant="ghost" disabled>
                          <LockBadge />
                          Send form link
                        </Button>
                      </span>
                    </Tip>
                  )
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setState((x) => ({ ...x, [a.id]: "received" }));
                    toast({ tone: "success", title: `Paper form received · ${p?.name}`, description: "Marked in this browser session. Scan it into Documents to keep a copy." });
                  }}
                  aria-label={`Mark paper intake form received for ${p?.name}`}
                >
                  Paper form received
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </Panel>
  );
}

function FailedPaymentPanel() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  if (!failedInvoice) return null;
  const p = patientById(failedInvoice.patientId);
  const task = TASKS.find((t) => t.title.includes(failedInvoice.number));

  const recheck = () => {
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      setLastChecked(NOW_LABEL);
      toast({ tone: "warning", title: "Still not confirmed", description: `${failedInvoice.number} stays unpaid — the gateway has not confirmed a completed payment.` });
    }, 1100);
  };

  return (
    <Panel icon={<CreditCard />} title="Payments today" subtitle={`${formatINR(COLLECTED_TODAY)} collected · ${UNCONFIRMED.length} not confirmed`} href="/billing" actionLabel="Open billing">
      <div className="rounded-inner bg-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Collected today · confirmed only</p>
            <p className="mt-1 text-[28px] font-light leading-none tracking-[-0.02em] text-ink">{formatINR(COLLECTED_TODAY)}</p>
          </div>
          <p className="text-right text-xs text-muted">
            {CONFIRMED_TODAY.map((c) => `${c.method} ${formatTime(c.at)} · ${patientById(c.invoice.patientId)?.name.split(" ")[0]}`).join(" · ") || "No confirmed payments yet"}
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-xs">
          {UNCONFIRMED.map((u) => (
            <li key={u.invoice.id} className="flex items-start justify-between gap-3 text-danger">
              <span>
                Not collected: {u.method} attempt {shortDate(u.at)} for <span className="whitespace-nowrap font-mono">{u.invoice.number}</span>
              </span>
              <span className="shrink-0 tabular">{formatINR(u.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-1 flex-col rounded-inner bg-surface p-4">
        <div className="flex items-start gap-3">
          <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{p?.name}</p>
            <p className="text-xs text-muted">Issued {whenLabel(failedInvoice.issuedAt)} · {failedInvoice.items.map((i) => i.label).join(", ")}</p>
          </div>
          <p className="shrink-0 text-sm text-ink">{formatINR(failedInvoice.total)}</p>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-[12px] bg-danger-soft p-3 text-xs text-danger">
          <WarningCircle size={16} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
          <p>
            The UPI callback never arrived, so this invoice is <strong className="font-medium">not marked paid</strong>. It stays outstanding until the gateway confirms or you record a verified payment.
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <span className="text-xs text-muted" aria-live="polite">
            {checking ? "Checking with the gateway…" : lastChecked ? `Last checked ${lastChecked} · no confirmation` : `Status: ${INVOICE_STATUS_LABEL.failed}`}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={recheck} loading={checking} aria-label={`Check payment status again for ${failedInvoice.number}`}>
              {checking ? null : <ArrowClockwise />}
              Check again
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/billing">Record payment</Link>
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CheckoutPanel({ statusOf }: { statusOf: (a: Appointment) => AppointmentStatus }) {
  // Visits finishing soon (in session / at checkout) and today's visitors with an open balance.
  const finishing = branchAppointments.filter((a) => ["in-session", "checkout"].includes(statusOf(a)));
  const followUps = TASKS.filter((t) => t.ownerId === ME && /before checkout/i.test(t.title) && t.status !== "done");
  const todayPatients = new Set(branchAppointments.filter((a) => !["cancelled", "no-show", "completed"].includes(statusOf(a))).map((a) => a.patientId));
  const invoices = [...openInvoices].filter((i) => i.status !== "failed").sort((a, b) => Number(todayPatients.has(b.patientId)) - Number(todayPatients.has(a.patientId)) || b.total - b.paid - (a.total - a.paid));

  return (
    <Panel icon={<Receipt />} title="Checkout & invoices due" subtitle={`${formatINR(outstanding)} outstanding · ${pluralize(openInvoices.length, "invoice")}`} href="/billing" actionLabel="Open billing">
      {finishing.map((a) => {
        const p = patientById(a.patientId);
        const inv = openInvoices.find((i) => i.patientId === a.patientId);
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-inner bg-surface p-4">
            <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{p?.name}</p>
              <p className="text-xs text-muted">
                {statusOf(a) === "checkout" ? "At checkout now" : `Finishes ${formatTime(new Date(Date.parse(a.start) + a.durationMin * 60_000).toISOString())}`} · {inv ? `collect ${formatINR(inv.total - inv.paid)}` : "no balance"} · book follow-up
              </p>
            </div>
            <StatusBadge tone={appointmentTone(statusOf(a))}>{APPOINTMENT_STATUS_LABEL[statusOf(a)]}</StatusBadge>
          </div>
        );
      })}
      {followUps.map((t) => {
        const p = patientById(t.patientId);
        return (
          <div key={t.id} className="flex items-start gap-3 rounded-inner bg-surface p-4">
            <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{p?.name}</p>
              <p className="text-xs text-muted">
                {t.title} · {t.source.toLowerCase()} from {staffById(t.createdBy)?.name}
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/schedule?new=1">
                <CalendarPlus />
                Book
              </Link>
            </Button>
          </div>
        );
      })}
      <div className="rounded-inner bg-surface p-2">
        <ul className="flex flex-col">
          {invoices.slice(0, 4).map((i) => {
            const p = patientById(i.patientId);
            const here = todayPatients.has(i.patientId);
            return (
              <li key={i.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{p?.name}</span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono">{i.number}</span> · {here ? "here today — collect at checkout" : `issued ${shortDate(i.issuedAt)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm text-ink tabular">{formatINR(i.total - i.paid)}</span>
                  <StatusBadge tone={invoiceTone(i.status)} dot={false} className="h-5 px-2 text-[11px]">
                    {INVOICE_STATUS_LABEL[i.status]}
                  </StatusBadge>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function WaitlistPanel() {
  const { toast } = useToast();
  const [offered, setOffered] = useState<Record<string, string>>({});
  return (
    <Panel icon={<Queue />} title="Waitlist offers" subtitle={`${pluralize(waitlist.length, "patient")} waiting for a slot · ${Object.keys(offered).length} offer${Object.keys(offered).length === 1 ? "" : "s"} drafted`} href="/schedule/waitlist" actionLabel="Open waitlist">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {waitlist.map((w) => {
          const p = patientById(w.patientId);
          const at = offered[w.id];
          return (
            <div key={w.id} className="flex flex-col rounded-inner bg-surface p-4">
              <div className="flex items-start gap-3">
                <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p?.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <DisciplineDot discipline={w.discipline} />
                    <span className="min-w-0 truncate">{w.want}</span>
                  </p>
                </div>
                <StatusBadge tone={priorityTone(w.priority)}>{w.priority === "high" ? "High" : w.priority === "low" ? "Low" : "Normal"}</StatusBadge>
              </div>
              <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                <span className="text-xs text-muted">
                  {w.preferred} · waiting since {shortDate(w.addedAt)}
                </span>
                <AnimatePresence mode="popLayout" initial={false}>
                  {at ? (
                    <motion.span key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={snappy} className="flex shrink-0 items-center gap-1 text-xs text-success">
                      <CheckCircle size={16} weight="fill" aria-hidden="true" />
                      Offer drafted {at}
                    </motion.span>
                  ) : (
                    <motion.span key="offer" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={snappy} className="shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setOffered((s) => ({ ...s, [w.id]: NOW_LABEL }));
                          toast({ title: `Slot offer drafted for ${p?.name}`, description: "Recorded locally — nothing was sent to the patient." });
                        }}
                        aria-label={`Offer a slot to ${p?.name}`}
                      >
                        Offer slot
                      </Button>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
