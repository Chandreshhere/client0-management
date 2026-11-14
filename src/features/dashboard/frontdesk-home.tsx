"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useId, useMemo, useState } from "react";
import { ArrowUpRight, CalendarBlank, CalendarPlus, CaretDown, ClipboardText, HourglassMedium, Queue, Receipt, SignIn, UserPlus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { formatINR, formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { AddOnNotice } from "@/components/shell/plan-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, appointmentTone, invoiceTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { BRANCHES, DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL, TODAY_APPOINTMENTS, WAITLIST } from "@/data/appointments";
import { TASKS } from "@/data/care";
import { INVOICES, INVOICE_STATUS_LABEL, collected } from "@/data/records";
import type { Appointment, AppointmentStatus } from "@/data/types";
import { NOW_ISO, NOW_LABEL, NOW_MIN, endIso, istMinutes, minutesUntil, profileHref, spanLabel } from "./data";
import { dashboardActions, useDashboardState, type PayMethod } from "./session";
import { DashGrid, DashboardHeader, DisciplineDot, FocalCard, FocalHead, FocalLabel, FocalStat, ItemCard, NowMarker, Panel, PanelEmpty, Rail, Reveal } from "./ui";

/**
 * Reception home (Clinic+) — "Who's here, and who's next?"
 * Who is here now (check-in → waiting → with practitioner → checkout), today's appointments with
 * their status, walk-ins and payments due at checkout. No clinical content: practitioner, room and
 * discipline instead of service names. Payments count only once recorded at the desk — online
 * payments and confirmed UPI are the payment-gateway add-on. Waitlist and invoices have their own screens.
 */
const ME = DEMO_USER.frontdesk.personId;
const BRANCH = BRANCHES.find((b) => b.id === staffById(ME)?.branch)!;

const branchAppointments = TODAY_APPOINTMENTS.filter((a) => BRANCH.rooms.includes(a.room)).sort((a, b) => a.start.localeCompare(b.start));
const otherBranchCount = TODAY_APPOINTMENTS.length - branchAppointments.length;
const apptById = (id: string) => TODAY_APPOINTMENTS.find((a) => a.id === id)!;
const practitioner = (a: Appointment) => staffById(a.staffId)?.name ?? "";

type QueueStatus = Extract<AppointmentStatus, "arrived" | "waiting" | "in-session" | "checkout" | "completed">;
type QueueEntry = { apptId: string; token: string; status: QueueStatus; arrivedAt: string; sentInAt?: string };

const QUEUE_STATES = new Set<AppointmentStatus>(["arrived", "waiting", "in-session", "checkout"]);
const INITIAL_QUEUE: QueueEntry[] = branchAppointments
  .filter((a) => QUEUE_STATES.has(a.status) && a.token)
  .map((a) => ({ apptId: a.id, token: a.token!, status: a.status as QueueStatus, arrivedAt: a.arrivedAt ?? a.start }));
const lastToken = Math.max(...TODAY_APPOINTMENTS.map((a) => Number(a.token?.split("-")[1] ?? 0)));
const QUEUE_ORDER: Record<QueueStatus, number> = { waiting: 0, arrived: 0, "in-session": 1, checkout: 2, completed: 3 };

const missingForms = branchAppointments.filter((a) => a.formsComplete === false && a.status !== "cancelled" && a.status !== "no-show");
const walkIns = branchAppointments.filter((a) => a.kind === "walk-in");

const OPEN = new Set(["due", "overdue", "partially-paid"]);
const checkoutTasks = TASKS.filter((t) => t.ownerId === ME && /before checkout/i.test(t.title) && t.status !== "done" && t.patientId);

export function FrontdeskHome() {
  const { toast } = useToast();
  const { has } = useRole();
  const { payments } = useDashboardState();
  const [queue, setQueue] = useState<QueueEntry[]>(INITIAL_QUEUE);
  const [nextToken, setNextToken] = useState(lastToken + 1);
  const [forms, setForms] = useState<Record<string, boolean>>({});

  const statusOf = useMemo(() => {
    const m = new Map<string, AppointmentStatus>();
    for (const q of queue) m.set(q.apptId, q.status);
    return (a: Appointment) => m.get(a.id) ?? a.status;
  }, [queue]);

  const here = queue.filter((q) => q.status !== "completed").sort((a, b) => QUEUE_ORDER[a.status] - QUEUE_ORDER[b.status] || Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt));
  const waiting = here.filter((q) => q.status === "arrived" || q.status === "waiting");
  const inQueue = new Set(queue.map((q) => q.apptId));
  const seen = new Set<string>();
  const expected = branchAppointments
    .filter((a) => a.status === "booked" && !inQueue.has(a.id) && minutesUntil(a.start) > 0 && minutesUntil(a.start) <= 180)
    .filter((a) => (seen.has(a.patientId) ? false : (seen.add(a.patientId), true)))
    .slice(0, 3);

  // Payments due at checkout: open invoices of patients who are here or still expected today.
  const todayPatients = new Set(branchAppointments.filter((a) => !["cancelled", "no-show", "completed"].includes(statusOf(a))).map((a) => a.patientId));
  const dueInvoices = INVOICES.filter((i) => OPEN.has(i.status) && todayPatients.has(i.patientId));
  const toCollect = dueInvoices.filter((i) => !payments[i.id]).length;

  const setStatus = (apptId: string, status: QueueStatus) => setQueue((qs) => qs.map((q) => (q.apptId === apptId ? { ...q, status, ...(status === "in-session" ? { sentInAt: NOW_ISO } : {}) } : q)));

  const advance = (q: QueueEntry) => {
    const a = apptById(q.apptId);
    const name = patientById(a.patientId)?.name;
    if (q.status === "arrived" || q.status === "waiting") {
      setStatus(q.apptId, "in-session");
      toast({ title: `${name} sent to ${a.room}`, description: "Status updated in this browser session." });
    } else if (q.status === "in-session") {
      setStatus(q.apptId, "checkout");
      toast({ title: `${name} moved to checkout`, description: "Record the payment and book the next visit before they leave." });
    } else if (q.status === "checkout") {
      setStatus(q.apptId, "completed");
      toast({ tone: "success", title: `${name} checked out`, description: "Recorded locally." });
    }
  };

  const checkIn = (a: Appointment) => {
    const token = `A-${String(nextToken).padStart(2, "0")}`;
    setQueue((qs) => [...qs, { apptId: a.id, token, status: "arrived", arrivedAt: NOW_ISO }]);
    setNextToken((n) => n + 1);
    toast({ tone: "success", title: `${patientById(a.patientId)?.name} checked in · token ${token}`, description: `For ${formatTime(a.start)} with ${practitioner(a)}. Saved in this browser session.` });
  };

  const formReceived = (a: Appointment) => {
    setForms((s) => ({ ...s, [a.id]: true }));
    toast({ tone: "success", title: `Paper form received · ${patientById(a.patientId)?.name}`, description: "Marked in this browser session. Scan it into Documents to keep a copy." });
  };

  const next = expected[0];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(here.length, "patient")} here · ${waiting.length} waiting${next ? ` · next ${patientById(next.patientId)?.name} at ${formatTime(next.start)}` : ""} · ${pluralize(toCollect, "payment")} due at checkout`}
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
          <HereNowCard here={here} waitingCount={waiting.length} expected={expected} nextToken={nextToken} onAdvance={advance} onCheckIn={checkIn} />
        </Reveal>

        <Reveal index={2}>
          <Panel icon={<SignIn />} title="Walk-ins" subtitle={walkIns.length ? `${pluralize(walkIns.length, "walk-in")} today` : "None yet today"} href="/schedule/queue" actionLabel="Open check-in" className="h-full">
            {walkIns.length === 0 ? (
              <PanelEmpty icon={<SignIn />} title="No walk-ins yet" description="Register or find the patient, then add them to today's list." />
            ) : (
              walkIns.map((a) => {
                const p = patientById(a.patientId);
                const s = statusOf(a);
                const q = queue.find((x) => x.apptId === a.id);
                const formMissing = a.formsComplete === false && !forms[a.id];
                const waitingNow = s === "arrived" || s === "waiting";
                return (
                  <ItemCard
                    key={a.id}
                    href={profileHref(a.patientId)}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[
                      <>
                        {q ? (
                          <>
                            Token <span className="font-mono">{q.token}</span> ·{" "}
                          </>
                        ) : null}
                        {practitioner(a)} · {a.room}
                      </>,
                      q ? `Arrived ${formatTime(q.arrivedAt)}${waitingNow ? ` · waiting ${spanLabel(NOW_MIN - istMinutes(q.arrivedAt))}` : ""}` : null,
                      p?.tags.includes("Possible duplicate") ? "Same phone as an existing patient — admin is checking" : null,
                    ]}
                    badge={<StatusBadge tone={appointmentTone(s)}>{APPOINTMENT_STATUS_LABEL[s]}</StatusBadge>}
                    footer={
                      formMissing ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-warning-soft px-3 py-2">
                          <span className="flex items-center gap-1.5 text-xs text-warning">
                            <ClipboardText size={14} aria-hidden="true" />
                            Intake form missing
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => formReceived(a)} aria-label={`Mark paper intake form received for ${p?.name}`}>
                            Paper form received
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                );
              })
            )}
          </Panel>
        </Reveal>

        <Reveal index={3}>
          <PaymentsPanel invoices={dueInvoices} statusOf={statusOf} />
        </Reveal>

        {/* Column 3 at xl; last in reading order on phones so who's here, walk-ins and payments come first. */}
        <Rail index={1} className="lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1">
          <DiaryPanel statusOf={statusOf} forms={forms} otherBranch={has("branches") ? otherBranchCount : 0} portal={has("portal")} />
        </Rail>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: who's here now, and who's next
// ---------------------------------------------------------------------------------------------

function HereNowCard({
  here,
  waitingCount,
  expected,
  nextToken,
  onAdvance,
  onCheckIn,
}: {
  here: QueueEntry[];
  waitingCount: number;
  expected: Appointment[];
  nextToken: number;
  onAdvance: (q: QueueEntry) => void;
  onCheckIn: (a: Appointment) => void;
}) {
  const id = useId();
  const longest = here.filter((q) => q.status === "arrived" || q.status === "waiting").sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt))[0];
  const longestAppt = longest ? apptById(longest.apptId) : null;

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label={`Here now · ${BRANCH.name}`}
        title={`${pluralize(here.length, "patient")} here · ${waitingCount} waiting`}
        meta={
          longest && longestAppt ? (
            <>
              Longest wait {spanLabel(NOW_MIN - istMinutes(longest.arrivedAt))} — {patientById(longestAppt.patientId)?.name}, token <span className="font-mono">{longest.token}</span>
            </>
          ) : (
            "Nobody is waiting right now"
          )
        }
        aside={<FocalStat value={NOW_LABEL} caption={<>Next token <span className="font-mono">A-{String(nextToken).padStart(2, "0")}</span></>} />}
      />

      <ul className="flex flex-col gap-2" aria-label="Patients here now">
        <AnimatePresence initial={false} mode="popLayout">
          {here.length === 0 ? (
            <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-inner bg-surface p-4 text-sm text-muted">
              Nobody is checked in.
            </motion.li>
          ) : (
            here.map((q) => <QueueRow key={q.apptId} entry={q} onAdvance={onAdvance} />)
          )}
        </AnimatePresence>
      </ul>

      <FocalLabel>Next to arrive · the next 3 hours</FocalLabel>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" aria-label="Next to arrive">
        {expected.length === 0 ? <li className="px-4 pb-2 text-xs text-white">No one due in the next 3 hours</li> : null}
        {expected.map((a) => {
          const p = patientById(a.patientId);
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-inner bg-white/15 p-2 pr-2 text-white sm:flex-1">
              <Avatar src={p?.avatar} name={p?.name ?? ""} size="sm" className="bg-white" />
              <span className="min-w-0 flex-1">
                <Link href={profileHref(a.patientId)} className="block truncate text-sm text-white underline-offset-4 hover:underline">
                  {p?.name}
                </Link>
                <span className="block truncate text-xs text-white/90">
                  {formatTime(a.start)} · {practitioner(a)}
                </span>
              </span>
              <Button size="sm" variant="secondary" className="shadow-none" onClick={() => onCheckIn(a)} aria-label={`Check in ${p?.name} for ${formatTime(a.start)}`}>
                Check in
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto" />
    </FocalCard>
  );
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
            <Link href={profileHref(a.patientId)} className="block truncate text-sm text-ink underline-offset-4 hover:underline">
              {p?.name}
            </Link>
            <p className="truncate text-xs text-muted">
              {a.kind === "walk-in" ? "Walk-in · " : `${formatTime(a.start)} · `}
              {practitioner(a)} · {a.room}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 @lg:justify-end">
          <span className={cn("flex items-center gap-1.5 text-xs tabular", long ? "text-warning" : "text-muted")}>
            {long ? <HourglassMedium size={14} aria-hidden="true" /> : null}
            {waitingNow ? `${spanLabel(waitMin)} wait` : q.status === "in-session" ? `Since ${formatTime(q.sentInAt ?? a.start)}` : "Payment & next visit"}
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
// Today's appointments with status
// ---------------------------------------------------------------------------------------------

function DiaryPanel({ statusOf, forms, otherBranch, portal }: { statusOf: (a: Appointment) => AppointmentStatus; forms: Record<string, boolean>; otherBranch: number; portal: boolean }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const firstHourShown = Math.floor(NOW_MIN / 60) * 60; // the current hour stays visible
  const earlier = branchAppointments.filter((a) => istMinutes(a.start) < firstHourShown);
  const shown = showEarlier ? branchAppointments : branchAppointments.filter((a) => istMinutes(a.start) >= firstHourShown);
  const nextAfterNow = shown.find((a) => istMinutes(a.start) > NOW_MIN)?.id;
  const stillMissing = missingForms.filter((a) => !forms[a.id] && a.kind !== "walk-in");

  return (
    <Panel
      icon={<CalendarBlank />}
      title="Today's appointments"
      subtitle={`${pluralize(branchAppointments.length, "appointment")}${otherBranch ? ` · +${otherBranch} at the other branch` : ""}`}
      href="/schedule"
      actionLabel="Open the calendar"
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
      <ul className="flex flex-col gap-2" aria-label="Today's appointments">
        {shown.map((a) => {
          const p = patientById(a.patientId);
          const s = statusOf(a);
          const struck = s === "cancelled" || s === "no-show";
          const formMissing = a.formsComplete === false && !forms[a.id] && !struck;
          return (
            <Fragment key={a.id}>
              {a.id === nextAfterNow ? <NowMarker /> : null}
              <li>
              <Link
                href={profileHref(a.patientId)}
                className="flex items-start gap-3 rounded-inner bg-surface px-4 py-2 transition-colors duration-200 hover:bg-canvas"
                aria-label={`${formatTime(a.start)} ${p?.name} with ${practitioner(a)}, ${APPOINTMENT_STATUS_LABEL[s]}${formMissing ? ", intake form missing" : ""}`}
              >
                <span className={cn("w-10 shrink-0 pt-0.5 text-xs tabular", struck ? "text-muted" : "text-ink")}>{formatTime(a.start)}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", struck ? "text-muted line-through" : "text-ink")}>{p?.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <DisciplineDot discipline={a.discipline} />
                    <span className="min-w-0 truncate">
                      {DISCIPLINE_LABEL[a.discipline]} · {practitioner(a).replace(/^Dr\. /, "Dr ")} · {a.room}
                    </span>
                  </span>
                  {formMissing ? <span className="mt-1 block text-xs text-warning">Intake form missing</span> : null}
                </span>
                <StatusBadge tone={appointmentTone(s)} className="mt-0.5 shrink-0">
                  {APPOINTMENT_STATUS_LABEL[s]}
                </StatusBadge>
              </Link>
              </li>
            </Fragment>
          );
        })}
      </ul>
      {stillMissing.length ? (
        <AddOnNotice addOn="messaging" className="bg-surface">
          {stillMissing.map((a) => patientById(a.patientId)?.name.split(" ")[0]).join(" and ")} {stillMissing.length === 1 ? "has" : "have"} no intake form yet.{" "}
          {portal ? "They can fill it in the patient app; " : "Hand over a paper form at check-in; "}sending a form link by WhatsApp or SMS needs this add-on.
        </AddOnNotice>
      ) : null}
      <Link href="/schedule/waitlist" className="flex h-10 items-center justify-between rounded-inner bg-surface px-4 text-xs text-ink transition-colors hover:bg-canvas">
        <span className="flex items-center gap-2">
          <Queue size={16} aria-hidden="true" />
          Waitlist · {pluralize(WAITLIST.length, "patient")} waiting for a slot
        </span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Payments due at checkout — recorded by hand; the gateway is an add-on
// ---------------------------------------------------------------------------------------------

function PaymentsPanel({ invoices, statusOf }: { invoices: typeof INVOICES; statusOf: (a: Appointment) => AppointmentStatus }) {
  const { payments } = useDashboardState();
  const recordedToday = Object.values(payments).reduce((s, p) => s + p.amount, 0);
  const whenFor = (patientId: string) => {
    const a = branchAppointments.find((x) => x.patientId === patientId && !["cancelled", "no-show", "completed"].includes(statusOf(x)));
    if (!a) return "Here today";
    const s = statusOf(a);
    if (s === "checkout") return "At checkout now";
    if (s === "in-session") return `With ${practitioner(a)} · checkout next`;
    if (s === "arrived" || s === "waiting") return "Here now · checkout after the visit";
    return `Checkout after the ${formatTime(a.start)} visit (ends ${formatTime(endIso(a))})`;
  };

  return (
    <Panel
      icon={<Receipt />}
      title="Payments due at checkout"
      subtitle={`${formatINR(collected() + recordedToday)} recorded today · ${pluralize(invoices.filter((i) => !payments[i.id]).length, "to collect", "to collect")}`}
      href="/billing"
      actionLabel="Open invoices"
      className="h-full"
    >
      {invoices.length === 0 && checkoutTasks.length === 0 ? <PanelEmpty icon={<Receipt />} title="Nothing to collect today" /> : null}
      {invoices.map((i) => {
        const p = patientById(i.patientId);
        const balance = i.total - i.paid;
        const rec = payments[i.id];
        return (
          <ItemCard
            key={i.id}
            href={profileHref(i.patientId)}
            avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
            name={p?.name}
            lines={[
              <>
                <span className="font-mono">{i.number}</span> · {formatINR(balance)} {i.status === "partially-paid" ? "balance" : "due"}
              </>,
              rec ? `${rec.method} ${formatINR(rec.amount)} recorded at ${rec.at} by you` : whenFor(i.patientId),
            ]}
            badge={rec ? <StatusBadge tone="success">Paid · {rec.method}</StatusBadge> : <StatusBadge tone={invoiceTone(i.status)}>{INVOICE_STATUS_LABEL[i.status]}</StatusBadge>}
            actions={
              rec ? (
                <Button size="sm" variant="ghost" onClick={() => dashboardActions.undoPayment(i.id)} aria-label={`Undo the payment recorded for ${i.number}`}>
                  Undo
                </Button>
              ) : (
                <RecordPayment invoiceId={i.id} number={i.number} amount={balance} patient={p?.name ?? "Patient"} />
              )
            }
          />
        );
      })}
      {checkoutTasks.map((t) => {
        const p = patientById(t.patientId);
        return (
          <ItemCard
            key={t.id}
            href={profileHref(t.patientId!)}
            avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
            name={p?.name}
            lines={["Nothing to pay", `${t.title.replace(/ before checkout$/i, "")} · asked by ${staffById(t.createdBy)?.name}`]}
            badge={<StatusBadge tone="neutral">Next visit</StatusBadge>}
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/schedule?new=1">
                  <CalendarPlus />
                  Book
                </Link>
              </Button>
            }
          />
        );
      })}
      <AddOnNotice addOn="payments" className="bg-surface">
        Online payments and confirmed UPI. Without it, a payment counts once you record it here.
      </AddOnNotice>
    </Panel>
  );
}

const METHODS: { value: PayMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "Card", label: "Card" },
];

function RecordPayment({ invoiceId, number, amount, patient }: { invoiceId: string; number: string; amount: number; patient: string }) {
  const { toast } = useToast();
  const [method, setMethod] = useState<PayMethod>("Cash");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="dark" aria-label={`Record a payment for ${number}`}>
          Record payment
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-32px))] p-4">
        <p className="text-sm text-ink">
          {formatINR(amount)} from {patient}
        </p>
        <p className="mt-1 text-xs text-muted">
          <span className="font-mono">{number}</span> · record what you received at the desk
        </p>
        <Segmented items={METHODS} value={method} onChange={setMethod} ariaLabel="Payment method" size="sm" variant="tray" className="mt-4 self-start" />
        <div className="mt-4 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              size="sm"
              variant="dark"
              onClick={() => {
                dashboardActions.recordPayment(invoiceId, method, amount, NOW_LABEL);
                toast({ tone: "success", title: `${method} payment recorded · ${formatINR(amount)}`, description: `${number} is marked paid. Saved in this browser session.` });
              }}
            >
              Record {formatINR(amount)}
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
