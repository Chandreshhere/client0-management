"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarBlank,
  CalendarX,
  ChartBar,
  ClipboardText,
  ClockCounterClockwise,
  Coins,
  CopySimple,
  CreditCard,
  Files,
  IdentificationCard,
  Info,
  SignIn,
  UploadSimple,
  UserPlus,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDate, formatINR, formatTime, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { BarChart, SegmentedBar } from "@/components/charts/bar-chart";
import { BRANCHES, DEMO_USER, STAFF, staffById } from "@/data/staff";
import { PATIENTS, clinicNumber, patientById } from "@/data/patients";
import { DISCIPLINE_LABEL, TODAY_APPOINTMENTS } from "@/data/appointments";
import { TASKS } from "@/data/care";
import { DOCUMENTS, INVOICES, collected } from "@/data/records";
import type { AppointmentStatus, Discipline, Patient, Staff } from "@/data/types";
import { ACTIVITY, NOW_LABEL, NOW_MIN, istMinutes, minutesUntil, shortDate, spanLabel, whenLabel } from "./data";
import { CaseMixPanel } from "./case-mix";
import { DashboardHeader, FocalCard, FocalHead, Panel, Reveal } from "./ui";

/**
 * Admin home (doc §2A) — "What needs attention in the clinic today?" KPIs are computed from the
 * shared diary and invoices; queues come from the registry, document inbox and tasks. Admins see
 * routing metadata, not clinical contents.
 */
const ME = DEMO_USER.admin.personId;

// ---------- KPIs ----------
const appts = TODAY_APPOINTMENTS;
const CHECKED_IN = new Set<AppointmentStatus>(["arrived", "waiting", "in-session", "checkout", "completed"]);
const arrived = appts.filter((a) => CHECKED_IN.has(a.status));
const waitingNow = appts.filter((a) => a.status === "arrived" || a.status === "waiting");
const longestWait = Math.max(0, ...waitingNow.map((a) => (a.arrivedAt ? NOW_MIN - istMinutes(a.arrivedAt) : 0)));
const noShows = appts.filter((a) => a.status === "no-show");
const cancelled = appts.filter((a) => a.status === "cancelled");
const toCome = appts.filter((a) => a.status === "booked" && istMinutes(a.start) > NOW_MIN);
const OPEN = new Set(["due", "overdue", "partially-paid", "failed"]);
const openInvoices = INVOICES.filter((i) => OPEN.has(i.status));
const outstanding = openInvoices.reduce((s, i) => s + (i.total - i.paid), 0);
// Only confirmed money counts (shared `collected()`); a payment attempt whose callback never arrived is not money.
const unconfirmedPayments = INVOICES.flatMap((i) => i.payments ?? []).filter((p) => !p.confirmed);
const unconfirmed = unconfirmedPayments.reduce((s, p) => s + p.amount, 0);
const collectedToday = collected();
const branchCount = new Set(appts.map((a) => BRANCHES.find((b) => b.rooms.includes(a.room))?.id)).size;

// ---------- chart: appointments by hour × discipline ----------
const SERIES: { id: Exclude<Discipline, "operations">; name: string; color: string }[] = [
  { id: "medical", name: DISCIPLINE_LABEL.medical, color: "var(--color-medical)" },
  { id: "nutrition", name: DISCIPLINE_LABEL.nutrition, color: "var(--color-nutrition)" },
  { id: "movement", name: DISCIPLINE_LABEL.movement, color: "var(--color-movement)" },
];
const firstHour = Math.min(...appts.map((a) => Math.floor(istMinutes(a.start) / 60)));
const lastHour = Math.max(...appts.map((a) => Math.floor(istMinutes(a.start) / 60)));
const HOURS = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
const CATEGORIES = HOURS.map((h) => String(h).padStart(2, "0"));
const VALUES = SERIES.map((s) => HOURS.map((h) => appts.filter((a) => a.discipline === s.id && Math.floor(istMinutes(a.start) / 60) === h).length));
const NOW_HOUR_INDEX = HOURS.indexOf(Math.floor(NOW_MIN / 60));
const TOTALS = HOURS.map((_, i) => VALUES.reduce((s, row) => s + row[i], 0));
const PEAK_TOTAL = Math.max(...TOTALS);
const PEAK = TOTALS.indexOf(PEAK_TOTAL);

// ---------- statuses (≤ 6 parts: arrived + waiting fold into one) ----------
const STATUS_PARTS = [
  { label: "Completed", value: appts.filter((a) => a.status === "completed").length, color: "var(--color-success)" },
  { label: "In session", value: appts.filter((a) => a.status === "in-session" || a.status === "checkout").length, color: "var(--color-charcoal)" },
  { label: "Arrived or waiting", value: waitingNow.length, color: "var(--color-primary)" },
  { label: "Booked", value: appts.filter((a) => a.status === "booked").length, color: "var(--color-ops)" },
  { label: "Cancelled", value: cancelled.length, color: "var(--color-line-strong)" },
  { label: "No-show", value: noShows.length, color: "var(--color-danger)" },
];

// ---------- queues ----------
const duplicate = (() => {
  const candidate = PATIENTS.find((p) => p.tags.includes("Possible duplicate"));
  if (!candidate) return null;
  const match = PATIENTS.find((p) => p.id !== candidate.id && p.phone === candidate.phone);
  return match ? { candidate, match } : null;
})();
const unidentified = DOCUMENTS.filter((d) => d.status === "unclassified");
const awaitingReview = DOCUMENTS.filter((d) => d.status === "awaiting-review");
const overdueReview = awaitingReview.filter((d) => d.dueBy && minutesUntil(d.dueBy) < 0);
const intakeMissing = PATIENTS.filter((p) => !p.intakeComplete);
const intakeToday = intakeMissing.filter((p) => appts.some((a) => a.patientId === p.id && a.status !== "cancelled"));
const accessTask = TASKS.find((t) => /^access review/i.test(t.title) && t.status !== "done");
const onLeave = STAFF.filter((s) => s.status === "on-leave");
const failed = INVOICES.find((i) => i.status === "failed");

export function AdminHome() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        summary="What needs attention in the clinic today?"
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/patients?new=1">
                <UserPlus />
                Register patient
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/documents?upload=1">
                <UploadSimple />
                Upload document
              </Link>
            </Button>
          </>
        }
      />

      <Reveal index={0}>
        <section aria-label="Today in numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Appointments today" value={appts.length} icon={<CalendarBlank />} context={`${toCome.length} still to come · ${pluralize(branchCount, "branch", "branches")}`} />
          <Stat label="Arrived so far" value={arrived.length} icon={<SignIn />} context={`${waitingNow.length} waiting now${longestWait ? ` · longest ${spanLabel(longestWait)}` : ""}`} />
          <Stat label="No-shows" value={noShows.length} icon={<CalendarX />} context={`${pluralize(cancelled.length, "cancellation")} · ${onLeave.length ? `${onLeave[0].name} on leave` : "all staff in"}`} />
          <Stat
            label="Collected today"
            value={formatINR(collectedToday)}
            icon={<Coins />}
            context={unconfirmed ? `${formatINR(unconfirmed)} ${unconfirmedPayments[0].method} unconfirmed · not counted` : `${formatINR(outstanding)} outstanding`}
          />
        </section>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal index={1} className="lg:col-span-2">
          <AttentionCard />
        </Reveal>

        <Reveal index={2}>
          <Panel icon={<ChartBar />} title="Appointments by hour" subtitle={`${appts.length} today, by discipline · now ${NOW_LABEL}`} href="/schedule" actionLabel="Open schedule" className="h-full">
            <div className="flex flex-1 flex-col gap-6 rounded-inner bg-surface p-4">
              <BarChart
                categories={CATEGORIES}
                series={SERIES}
                values={VALUES}
                height={336}
                highlight={NOW_HOUR_INDEX}
                ariaLabel={`Appointments by hour today, stacked by discipline. ${CATEGORIES.map((c, i) => `${c}:00 ${VALUES.reduce((s, row) => s + row[i], 0)}`).join(", ")}.`}
                formatY={(v) => String(v)}
              />
              <p className="-mt-2 text-xs text-muted">
                Busiest hour {CATEGORIES[PEAK]}:00 with {PEAK_TOTAL} appointments · {VALUES[0].reduce((a, b) => a + b, 0)} medical, {VALUES[1].reduce((a, b) => a + b, 0)} nutrition, {VALUES[2].reduce((a, b) => a + b, 0)} movement
              </p>
              <div>
                <p className="mb-3 text-xs text-muted">Status of today&apos;s {appts.length} appointments</p>
                <SegmentedBar parts={STATUS_PARTS} label="Today's appointment statuses" />
              </div>
              <details className="group mt-auto">
                <summary className="flex h-8 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full bg-sunken px-3 text-xs text-ink transition-colors hover:bg-sunken-2 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show as table</span>
                  <span className="hidden group-open:inline">Hide table</span>
                </summary>
                <div className="mt-3 overflow-x-auto" data-lenis-prevent>
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Appointments by hour and discipline, today</caption>
                    <thead className="text-muted">
                      <tr>
                        <th scope="col" className="py-1 pr-2 font-normal">
                          Hour
                        </th>
                        {SERIES.map((s) => (
                          <th key={s.id} scope="col" className="px-2 py-1 text-right font-normal">
                            {s.name}
                          </th>
                        ))}
                        <th scope="col" className="py-1 pl-2 text-right font-normal">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular text-ink">
                      {CATEGORIES.map((c, i) => (
                        <tr key={c} className={cn("border-t border-line", i === NOW_HOUR_INDEX && "font-medium")}>
                          <th scope="row" className="py-1 pr-2 font-normal">
                            {c}:00
                          </th>
                          {SERIES.map((s, si) => (
                            <td key={s.id} className="px-2 py-1 text-right">
                              {VALUES[si][i]}
                            </td>
                          ))}
                          <td className="py-1 pl-2 text-right">{VALUES.reduce((sum, row) => sum + row[i], 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </Panel>
        </Reveal>

        <Reveal index={3} className="lg:col-span-2">
          <CaseMixPanel className="h-full" />
        </Reveal>

        <Reveal index={4}>
          <StaffTodayPanel />
        </Reveal>

        <Reveal index={5} className="lg:col-span-2 xl:col-span-3">
          <Panel icon={<ClockCounterClockwise />} title="Activity history" subtitle="Attributed account, record and export actions" href="/settings/audit" actionLabel="Open the audit log">
            <ul className="flex flex-col rounded-inner bg-surface p-2">
              {ACTIVITY.slice(0, 7).map((e) => {
                const actor = e.actorId ? staffById(e.actorId) : null;
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-[12px] px-2 py-2">
                    {actor ? <Avatar src={actor.avatar} name={actor.name} size="sm" /> : <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted" aria-hidden="true"><ClockCounterClockwise size={16} /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{e.action}</span>
                      <span className="block text-xs text-muted">
                        {actor ? `${actor.name} · ${actor.title}` : e.actorLabel} · {whenLabel(e.at)}
                      </span>
                    </span>
                    <StatusBadge tone="neutral" dot={false} className="hidden sm:inline-flex">
                      {KIND_LABEL[e.kind]}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

const KIND_LABEL = {
  registration: "Registration",
  document: "Document",
  guidance: "Guidance",
  schedule: "Schedule",
  payment: "Payment",
  account: "Account",
  export: "Export",
  plan: "Care plan",
} as const;

// ---------------------------------------------------------------------------------------------
// Focal: operational queues
// ---------------------------------------------------------------------------------------------

type Decision = { kind: "separate" | "merge-review"; at: string };

function AttentionCard() {
  const id = useId();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const open = 5 + (failed ? 1 : 0) - (decision ? 1 : 0);
  const sana = onLeave[0];
  const sanaPatients = sana ? PATIENTS.filter((p) => p.careTeam.doctor === sana.id) : [];
  const reassignTask = TASKS.find((t) => /reassign/i.test(t.title) && t.status !== "done");

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Needs attention today"
        title={`${pluralize(open, "queue")} waiting on the clinic team`}
        meta="Routing and access only — clinical contents stay with the treating clinicians."
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{NOW_LABEL}</p>
            <p className="text-xs text-white/90">Fri 13 Nov</p>
          </div>
        }
      />
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {duplicate ? (
          <QueueItem
            icon={<CopySimple />}
            title="Possible duplicate patient"
            badge={decision ? <StatusBadge tone="success">{decision.kind === "separate" ? "Kept separate" : "Merge review requested"}</StatusBadge> : <StatusBadge tone="warning">Review</StatusBadge>}
            detail={`${duplicate.candidate.name} shares a phone number with ${duplicate.match.name}. Shared phone numbers never merge automatically.`}
            action={
              decision ? (
                <span className="text-xs text-success">Decided {decision.at}</span>
              ) : (
                <Button size="sm" variant="dark" onClick={() => setDupOpen(true)}>
                  Review match
                </Button>
              )
            }
          />
        ) : null}
        <QueueItem
          icon={<Files />}
          title="Document intake queue"
          badge={overdueReview.length ? <StatusBadge tone="danger">{overdueReview.length} overdue</StatusBadge> : null}
          detail={`${pluralize(unidentified.length, "upload")} need a patient match or classification · ${awaitingReview.length} awaiting clinician review`}
          action={<QueueLink href="/documents">Open queue</QueueLink>}
        />
        <QueueItem
          icon={<ClipboardText />}
          title="Incomplete intake"
          badge={<StatusBadge tone="warning">{intakeMissing.length} patients</StatusBadge>}
          detail={`${intakeToday.length} have a visit today (${intakeToday.map((p) => p.name.split(" ")[0]).join(", ")}) · front desk is collecting forms`}
          action={<QueueLink href="/schedule/queue">Open queue</QueueLink>}
        />
        {accessTask ? (
          <QueueItem
            icon={<IdentificationCard />}
            title="Access review"
            badge={<StatusBadge tone="neutral">Due {shortDate(accessTask.due)}</StatusBadge>}
            detail={`${accessTask.title.replace(/^Access review:\s*/i, "")} — confirm which patients and sections he can still open.`}
            action={<QueueLink href="/settings/access">Review access</QueueLink>}
          />
        ) : null}
        {sana ? (
          <QueueItem
            icon={<UserSwitch />}
            title={`${sana.name} on leave`}
            badge={<StatusBadge tone="info">{reassignTask?.status === "in-progress" ? "Reassigning" : "Not started"}</StatusBadge>}
            detail={`${sana.workingHours} · ${pluralize(sanaPatients.length, "patient")} on her list${reassignTask ? ` · your reassignment task is due ${shortDate(reassignTask.due)}` : ""}`}
            action={<QueueLink href="/team">Reassign</QueueLink>}
          />
        ) : null}
        {failed ? (
          <QueueItem
            icon={<CreditCard />}
            title="Payment not confirmed"
            badge={<StatusBadge tone="danger">Not marked paid</StatusBadge>}
            detail={`${failed.number} · ${patientById(failed.patientId)?.name} · ${formatINR(failed.total)} — the UPI callback never arrived`}
            action={<QueueLink href="/billing">Open billing</QueueLink>}
          />
        ) : null}
      </ul>

      {duplicate ? (
        <DuplicateDialog
          open={dupOpen}
          onOpenChange={setDupOpen}
          candidate={duplicate.candidate}
          match={duplicate.match}
          onDecide={(kind) => {
            setDecision({ kind, at: NOW_LABEL });
            setDupOpen(false);
          }}
        />
      ) : null}
    </FocalCard>
  );
}

function QueueItem({ icon, title, badge, detail, action }: { icon: ReactNode; title: string; badge?: ReactNode; detail: string; action: ReactNode }) {
  return (
    <li className="flex flex-col rounded-inner bg-surface p-4 text-ink">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        {badge}
      </div>
      <p className="mt-4 text-sm text-ink">{title}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      <div className="mt-auto flex justify-end pt-4">{action}</div>
    </li>
  );
}

function QueueLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild size="sm" variant="secondary">
      <Link href={href}>
        {children}
        <ArrowUpRight />
      </Link>
    </Button>
  );
}

function DuplicateDialog({
  open,
  onOpenChange,
  candidate,
  match,
  onDecide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: Patient;
  match: Patient;
  onDecide: (kind: Decision["kind"]) => void;
}) {
  const { toast } = useToast();
  const rows: { label: string; a: string; b: string }[] = [
    { label: "Name", a: match.name, b: candidate.name },
    { label: "Age · sex", a: `${match.age} · ${match.sex}`, b: `${candidate.age} · ${candidate.sex}` },
    { label: "Phone", a: match.phone, b: candidate.phone },
    { label: "Area", a: match.area, b: candidate.area },
    { label: "Clinic number", a: clinicNumber(match.id), b: clinicNumber(candidate.id) },
    { label: "Registered", a: formatDate(match.registeredAt), b: `${formatDate(candidate.registeredAt)}, ${formatTime(candidate.registeredAt)}` },
    { label: "Care team", a: match.careTeam.doctor ? `${staffById(match.careTeam.doctor)?.name} + ${Object.keys(match.careTeam).length - 1}` : "None", b: candidate.careTeam.doctor ? staffById(candidate.careTeam.doctor)?.name ?? "—" : "None yet" },
  ];
  const same = rows.filter((r) => r.a === r.b).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Possible duplicate patient"
        description={`${same} of ${rows.length} identity fields match. Shared phone numbers never merge two patients automatically — an authorised person decides.`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Decide later</Button>
            </DialogClose>
            <Button
              variant="secondary"
              onClick={() => {
                onDecide("merge-review");
                toast({ title: "Merge review requested", description: "A second authorised reviewer must approve a merge. Recorded in this browser session — no records were changed." });
              }}
            >
              Request merge review
            </Button>
            <Button
              variant="dark"
              onClick={() => {
                onDecide("separate");
                toast({ tone: "success", title: "Kept as separate patients", description: `${candidate.name} and ${match.name} stay separate. Decision recorded in this browser session.` });
              }}
            >
              Keep separate
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[440px] text-left text-sm">
            <caption className="sr-only">Identity fields compared</caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-2 pr-3 font-normal">
                  Field
                </th>
                <th scope="col" className="px-3 py-2 font-normal">
                  <span className="flex items-center gap-2">
                    <Avatar src={match.avatar} name={match.name} size="xs" />
                    Existing record
                  </span>
                </th>
                <th scope="col" className="px-3 py-2 font-normal">
                  <span className="flex items-center gap-2">
                    <Avatar src={candidate.avatar} name={candidate.name} size="xs" />
                    New registration
                  </span>
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-normal">
                  Match
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSame = r.a === r.b;
                return (
                  <tr key={r.label} className="border-t border-line">
                    <th scope="row" className="py-2 pr-3 text-xs font-normal text-muted">
                      {r.label}
                    </th>
                    <td className={cn("px-3 py-2", r.label === "Phone" || r.label === "Clinic number" ? "font-mono" : "", "text-ink")}>{r.a}</td>
                    <td className={cn("px-3 py-2", r.label === "Phone" || r.label === "Clinic number" ? "font-mono" : "", "text-ink")}>{r.b}</td>
                    <td className="py-2 pl-3 text-right">
                      {isSame ? (
                        <StatusBadge tone="warning" dot={false}>
                          Same
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" dot={false}>
                          Different
                        </StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-sunken p-3 text-xs text-ink-2">
          <Info size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
          Different names and registration histories usually mean two people sharing a family phone. Merging needs a second authorised reviewer and keeps both originals in the audit log.
        </p>
      </ModalContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Staff today
// ---------------------------------------------------------------------------------------------

const STAFF_STATUS: Record<Staff["status"], { label: string; tone: "success" | "dark" | "warning" | "danger" | "neutral" }> = {
  available: { label: "Available", tone: "success" },
  "in-session": { label: "In session", tone: "dark" },
  "on-break": { label: "On break", tone: "warning" },
  "on-leave": { label: "On leave", tone: "danger" },
  off: { label: "Off", tone: "neutral" },
};

const STATUS_ORDER: Record<Staff["status"], number> = { "on-leave": 0, "on-break": 1, "in-session": 2, available: 3, off: 4 };

function StaffTodayPanel() {
  const [all, setAll] = useState(false);
  const ordered = [...STAFF].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.branch.localeCompare(b.branch) || a.name.localeCompare(b.name));
  const shown = all ? ordered : ordered.slice(0, 8);
  const counts = STAFF.reduce<Record<string, number>>((m, s) => ({ ...m, [s.status]: (m[s.status] ?? 0) + 1 }), {});
  return (
    <Panel icon={<UsersThree />} title="Staff today" subtitle={`${STAFF.length - (counts["on-leave"] ?? 0)} working · ${counts["in-session"] ?? 0} in session · ${counts["on-leave"] ?? 0} on leave`} href="/team" actionLabel="Open team">
      <ul className="flex flex-col rounded-inner bg-surface p-2">
        {shown.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2">
            <Avatar src={s.avatar} name={s.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{s.id === ME ? `${s.name} (you)` : s.name}</span>
              <span className="block truncate text-xs text-muted">
                {BRANCHES.find((b) => b.id === s.branch)?.name} · {s.status === "on-leave" ? s.workingHours : s.workingHours.replace(" – ", "–")}
              </span>
            </span>
            <StatusBadge tone={STAFF_STATUS[s.status].tone}>{STAFF_STATUS[s.status].label}</StatusBadge>
          </li>
        ))}
        {ordered.length > 8 ? (
          <li className="px-2 pb-1 pt-2">
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="h-8 rounded-full bg-sunken px-3 text-xs text-ink transition-colors hover:bg-sunken-2">
              {all ? "Show fewer" : `Show all ${ordered.length} staff`}
            </button>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

