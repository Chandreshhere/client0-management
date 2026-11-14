"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowsLeftRight,
  BowlFood,
  CalendarBlank,
  CalendarPlus,
  Check,
  Files,
  FileText,
  FirstAid,
  ListChecks,
  LockSimple,
  Path,
  Plus,
  Receipt,
  Warning,
} from "@phosphor-icons/react";
import type { ClinicalDocument, Discipline, Invoice, NutritionPlanSummary, Patient, Referral, Task, YogaClass } from "@/data/types";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL } from "@/data/appointments";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { ATTENDANCE_LABEL, PLAN_STATUS_LABEL } from "@/data/programs";
import { DOC_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/data/records";
import { staffById } from "@/data/staff";
import { minPlanFor, type FeatureId } from "@/data/plans";
import { TODAY, formatDate, formatINR, formatTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pill";
import { StatusBadge, appointmentTone, invoiceTone, priorityTone, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { LockBadge } from "@/components/shell/plan-switcher";
import { dayWord, isLive, type Visit } from "./data";

/** Section cards for the summary of a patient with nothing recorded yet — grey groups holding white insets. */

const NOW = TODAY.getTime();
const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const DISCIPLINE_COLOR: Record<Discipline, string> = {
  medical: "var(--color-medical)",
  nutrition: "var(--color-nutrition)",
  movement: "var(--color-movement)",
  operations: "var(--color-ops)",
};

function DisciplineDot({ discipline }: { discipline: Discipline | null }) {
  if (!discipline) return <span className="size-1.5 shrink-0 rounded-full bg-faint" aria-hidden="true" />;
  return <span className="size-1.5 shrink-0 rounded-full" style={{ background: DISCIPLINE_COLOR[discipline] }} aria-hidden="true" />;
}

/** Inset explaining that a section isn't part of the current plan. */
export function LockedInset({ feature, children }: { feature: FeatureId; children: ReactNode }) {
  return (
    <Inset className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
        <LockSimple size={16} aria-hidden="true" />
      </span>
      <p className="text-xs text-muted">
        {children} Available on the {minPlanFor(feature).name} plan.
      </p>
    </Inset>
  );
}

function EmptyInset({ children }: { children: ReactNode }) {
  return <Inset className="text-sm text-muted">{children}</Inset>;
}

// ---------------------------------------------------------------- focal (cobalt) card

export type Focal =
  | { kind: "visit"; visit: Visit }
  | { kind: "task"; task: Task }
  | { kind: "referral"; referral: Referral }
  | { kind: "none" };

/** Decorative clock face showing the appointment time (aria-hidden; the time is in the text). */
function Dial({ iso }: { iso?: string }) {
  const [h, m] = iso ? formatTime(iso).split(":").map(Number) : [0, 0];
  const minA = (m / 60) * 2 * Math.PI;
  const hrA = (((h % 12) + m / 60) / 12) * 2 * Math.PI;
  // Rounded so server (Node) and client (browser) trig produce identical attributes — no hydration mismatch.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const px = (a: number, r: number) => r2(80 + r * Math.sin(a));
  const py = (a: number, r: number) => r2(80 - r * Math.cos(a));
  const hand = (a: number, r: number) => ({ x2: px(a, r), y2: py(a, r) });
  return (
    <svg viewBox="0 0 160 160" className="pointer-events-none absolute -bottom-10 -right-10 size-[200px] text-white" aria-hidden="true">
      <circle cx="80" cy="80" r="72" fill="none" stroke="currentColor" strokeOpacity="0.14" />
      <circle cx="80" cy="80" r="52" fill="none" stroke="currentColor" strokeOpacity="0.1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI;
        return <line key={i} x1={px(a, 64)} y1={py(a, 64)} x2={px(a, 70)} y2={py(a, 70)} stroke="currentColor" strokeOpacity="0.35" strokeLinecap="round" />;
      })}
      {iso ? (
        <>
          <line x1="80" y1="80" {...hand(hrA, 34)} stroke="currentColor" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
          <line x1="80" y1="80" {...hand(minA, 50)} stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="80" r="3.5" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

const glassChip = "inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]";
const whiteCircle = "flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95";

/** The one cobalt card per view: the next appointment, or the most urgent open item. */
export function FocalCard({ focal, patient }: { focal: Focal; patient: Patient }) {
  const bookHref = `/schedule?new=1&patient=${patient.id}`;

  if (focal.kind === "visit") {
    const v = focal.visit;
    const staff = staffById(v.staffId ?? undefined);
    const live = isLive(v);
    return (
      <section aria-labelledby="focal-title" className="relative flex min-h-[288px] flex-col overflow-hidden rounded-card bg-primary p-6 text-white">
        <Dial iso={v.start} />
        <div className="relative flex items-start justify-between gap-3">
          <span className={glassChip}>{live ? "In the clinic now" : "Next appointment"}</span>
          <Tip label="Open in schedule">
            <Link href="/schedule" aria-label="Open in schedule" className={whiteCircle}>
              <ArrowUpRight size={18} />
            </Link>
          </Tip>
        </div>
        <h2 id="focal-title" className="relative mt-6 text-title font-normal">
          {dayWord(v.start)}, {formatTime(v.start)}
        </h2>
        <p className="relative mt-1 text-sm text-white/80">
          {v.service ?? "Booked visit"}
          {v.durationMin ? ` · ${v.durationMin} min` : ""}
          {v.room ? ` · ${v.room}` : ""}
        </p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {live ? <span className={glassChip}>{APPOINTMENT_STATUS_LABEL[v.status]}</span> : null}
          {v.formsComplete === false ? <span className={glassChip}>Intake form pending</span> : null}
          {v.source === "session" ? <span className={glassChip}>Held in this session</span> : null}
          {v.notes ? <span className={cn(glassChip, "h-auto min-h-8 py-1")}>{v.notes}</span> : null}
        </div>
        <div className="relative mt-auto flex items-end justify-between gap-3 pt-6">
          {staff ? (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={staff.avatar} name={staff.name} size="md" className="ring-2 ring-white/30" />
              <div className="min-w-0">
                <p className="truncate text-sm">{staff.name}</p>
                <p className="truncate text-xs text-white/70">{staff.title}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/70">Details are in the schedule</p>
          )}
          <Tip label="Book another appointment">
            <Link href={bookHref} aria-label="Book another appointment" className={whiteCircle}>
              <Plus size={18} />
            </Link>
          </Tip>
        </div>
      </section>
    );
  }

  const title = focal.kind === "task" ? focal.task.title : focal.kind === "referral" ? `Referral to ${staffById(focal.referral.toId)?.name ?? DISCIPLINE_LABEL[focal.referral.toDiscipline]} has stalled` : "No upcoming appointment";
  const detail =
    focal.kind === "task"
      ? `${staffById(focal.task.ownerId)?.name ?? "Unassigned"} · due ${relativeTime(focal.task.due)} · ${focal.task.source}`
      : focal.kind === "referral"
        ? `Stopped at ${REFERRAL_STAGE_LABEL[focal.referral.stage]} · was due ${shortDate(focal.referral.dueBy)}`
        : patient.status === "completed"
          ? "Programme complete. Book a follow-up if the care team recommends one."
          : "Nothing is booked. Book the next visit before it slips.";
  const href = focal.kind === "task" ? "/tasks" : focal.kind === "referral" ? "/referrals" : bookHref;

  return (
    <section aria-labelledby="focal-title" className="relative flex min-h-[288px] flex-col overflow-hidden rounded-card bg-primary p-6 text-white">
      <Dial />
      <div className="relative flex items-start justify-between gap-3">
        <span className={glassChip}>{focal.kind === "none" ? "Next step" : "Most urgent"}</span>
        <Tip label={focal.kind === "task" ? "Open tasks" : focal.kind === "referral" ? "Open referrals" : "Book appointment"}>
          <Link href={href} aria-label={focal.kind === "task" ? "Open tasks" : focal.kind === "referral" ? "Open referrals" : "Book appointment"} className={whiteCircle}>
            <ArrowUpRight size={18} />
          </Link>
        </Tip>
      </div>
      {focal.kind === "task" ? (
        <span className="relative mt-6 inline-flex w-fit items-center gap-1.5 text-xs text-white/80">
          <Warning size={14} aria-hidden="true" /> {focal.task.priority === "urgent" ? "Urgent" : "High priority"}
        </span>
      ) : null}
      <h2 id="focal-title" className={cn("relative max-w-[18ch] text-title font-normal", focal.kind === "task" ? "mt-2" : "mt-6")}>
        {title}
      </h2>
      <p className="relative mt-2 max-w-[36ch] text-sm text-white/80">{detail}</p>
      <div className="relative mt-auto pt-6">
        <Button asChild variant="glass">
          <Link href={bookHref}>
            <CalendarPlus aria-hidden="true" />
            Book appointment
          </Link>
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- appointments

function VisitRow({ v }: { v: Visit }) {
  const staff = staffById(v.staffId ?? undefined);
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="w-[76px] shrink-0">
        <p className="truncate text-sm text-ink">{dayWord(v.start)}</p>
        <p className="font-mono text-xs text-muted">{formatTime(v.start)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm text-ink">
          <DisciplineDot discipline={v.discipline} />
          <span className="truncate">{v.service ?? "Clinic visit"}</span>
        </p>
        <p className="truncate text-xs text-muted">
          {v.source === "record" ? "From the patient record" : [staff?.name, v.room].filter(Boolean).join(" · ")}
          {v.discipline ? <span className="sr-only"> · {DISCIPLINE_LABEL[v.discipline]}</span> : null}
        </p>
      </div>
      <StatusBadge tone={appointmentTone(v.status)} className="shrink-0">
        {APPOINTMENT_STATUS_LABEL[v.status]}
      </StatusBadge>
    </li>
  );
}

export function AppointmentsGroup({ later, recent, afterFocal }: { later: Visit[]; recent: Visit[]; afterFocal: boolean }) {
  const shownRecent = recent.slice(0, 4);
  const upcomingLabel = later.length ? `${later.length} ${afterFocal ? "more " : ""}upcoming` : afterFocal ? "Nothing else upcoming" : "Nothing upcoming";
  return (
    <Group>
      <GroupHeader icon={<CalendarBlank />} title="Appointments" subtitle={`${upcomingLabel} · ${recent.length} recent`} href="/schedule" actionLabel="Open schedule" />
      <div className="flex flex-col gap-2">
        <Inset className="py-2">
          <h3 className="pt-2 text-xs text-muted">{afterFocal ? "Also upcoming" : "Upcoming"}</h3>
          {later.length ? (
            <ul className="divide-y divide-line">{later.map((v) => <VisitRow key={v.id} v={v} />)}</ul>
          ) : (
            <p className="py-2 text-sm text-muted">{afterFocal ? "Nothing else booked." : "Nothing booked."}</p>
          )}
        </Inset>
        <Inset className="py-2">
          <h3 className="pt-2 text-xs text-muted">Recent</h3>
          {shownRecent.length ? (
            <ul className="divide-y divide-line">{shownRecent.map((v) => <VisitRow key={v.id} v={v} />)}</ul>
          ) : (
            <p className="py-2 text-sm text-muted">No visits yet.</p>
          )}
          {recent.length > shownRecent.length ? <p className="pb-2 text-xs text-muted">+{recent.length - shownRecent.length} earlier in the schedule</p> : null}
        </Inset>
      </div>
    </Group>
  );
}

// ---------------------------------------------------------------- safety

export function SafetyGroup({ patient }: { patient: Patient }) {
  return (
    <Group>
      <GroupHeader icon={<FirstAid />} title="Clinical safety" subtitle="Allergies, conditions and concern" />
      <div className="flex flex-col gap-2">
        <Inset>
          <h3 className="text-xs text-muted">Allergies</h3>
          {patient.allergies === null ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-warning">
              <Warning size={18} className="mt-px shrink-0" aria-hidden="true" />
              Not recorded — ask before prescribing
            </p>
          ) : patient.allergies.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">No known allergies (confirmed)</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {patient.allergies.map((a) => (
                <li key={a} className="inline-flex h-8 items-center rounded-full bg-danger-soft px-3 text-xs text-danger">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </Inset>
        <Inset>
          <h3 className="text-xs text-muted">Active conditions</h3>
          {patient.conditions.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {patient.conditions.map((c) => (
                <li key={c}>
                  <Pill tone="condition">{c}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">None recorded yet.</p>
          )}
        </Inset>
        <Inset>
          <h3 className="text-xs text-muted">Primary concern</h3>
          <p className="mt-2 text-sm text-ink">{patient.primaryConcern}</p>
        </Inset>
      </div>
    </Group>
  );
}

// ---------------------------------------------------------------- programme, classes, packages

const CLEARANCE: Record<YogaClass["enrolled"][number]["clearance"], { tone: Tone; label: string } | null> = {
  current: null,
  changed: { tone: "warning", label: "Precautions changed — review" },
  expired: { tone: "danger", label: "Clearance expired" },
};

export function ProgrammeGroup({
  patient,
  classes,
  pkg,
  has,
}: {
  patient: Patient;
  classes: YogaClass[];
  pkg: { name: string; used: number; total: number; expires: string } | undefined;
  has: (f: FeatureId) => boolean;
}) {
  if (!patient.program && !classes.length && !pkg) return null;
  return (
    <Group>
      <GroupHeader icon={<Path />} title="Programme" subtitle={patient.program ?? "Not enrolled in a programme"} href={has("classes") && classes.length ? "/classes" : undefined} actionLabel="Open classes" />
      <div className="flex flex-col gap-2">
        {pkg ? (
          has("packages") ? (
            <Inset>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="truncate text-sm text-ink">{pkg.name}</h3>
                <span className="shrink-0 text-xs text-muted tabular">
                  {pkg.used}/{pkg.total}
                </span>
              </div>
              <ProgressBar value={pkg.used} max={pkg.total} tone="dark" className="mt-3" label={`${pkg.used} of ${pkg.total} sessions used`} />
              <p className="mt-2 text-xs text-muted">
                {pkg.total - pkg.used} sessions left · expires {formatDate(`${pkg.expires}T00:00:00+05:30`)}
              </p>
            </Inset>
          ) : null
        ) : null}
        {!classes.length && !pkg ? <EmptyInset>No classes or session package on file for this programme.</EmptyInset> : null}
        {classes.length ? (
          has("classes") ? (
            <Inset className="py-2">
              <h3 className="pt-2 text-xs text-muted">Classes & sessions</h3>
              <ul className="divide-y divide-line">
                {classes.map((c) => {
                  const e = c.enrolled.find((x) => x.patientId === patient.id);
                  const clearance = e ? CLEARANCE[e.clearance] : null;
                  return (
                    <li key={c.id} className="py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm text-ink">
                          <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: DISCIPLINE_COLOR.movement }} aria-hidden="true" />
                          {c.title}
                        </p>
                        <span className="shrink-0 text-xs text-muted">{e ? ATTENDANCE_LABEL[e.attendance] : ""}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {dayWord(c.start)} <span className="font-mono">{formatTime(c.start)}</span> · {staffById(c.instructorId)?.name} · {c.room}
                      </p>
                      {e?.precaution ? <p className="mt-1 text-xs text-ink-2">Precaution: {e.precaution}</p> : null}
                      {clearance ? (
                        <StatusBadge tone={clearance.tone} className="mt-1.5">
                          {clearance.label}
                        </StatusBadge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Inset>
          ) : (
            <LockedInset feature="classes">Yoga classes and attendance aren't in this plan.</LockedInset>
          )
        ) : null}
      </div>
    </Group>
  );
}

// ---------------------------------------------------------------- nutrition plan

const PLAN_TONE: Record<NutritionPlanSummary["status"], Tone> = { draft: "draft", "in-review": "warning", published: "success", superseded: "neutral" };

export function NutritionGroup({ plan, has }: { plan: NutritionPlanSummary | undefined; has: (f: FeatureId) => boolean }) {
  if (!plan) return null;
  const author = staffById(plan.authorId);
  const selfReported = /self-reported/i.test(plan.adherenceNote);
  return (
    <Group>
      <GroupHeader icon={<BowlFood />} title="Nutrition plan" subtitle={`Version ${plan.version} · ${PLAN_STATUS_LABEL[plan.status]}`} href={has("nutrition") ? "/nutrition" : undefined} actionLabel="Open nutrition plans" />
      {has("nutrition") ? (
        <Inset>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm text-ink">{plan.title}</h3>
            <StatusBadge tone={PLAN_TONE[plan.status]} className="shrink-0">
              {PLAN_STATUS_LABEL[plan.status]}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {plan.preference} · <span className="tabular">{plan.calories.toLocaleString("en-IN")}</span> kcal · next review {shortDate(plan.nextReview)}
          </p>
          <div className="mt-3 rounded-[12px] bg-canvas p-3">
            <p className="flex items-center gap-2 text-xs text-muted">
              Adherence
              {selfReported ? <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]">Self-reported</span> : null}
            </p>
            <p className="mt-1 text-sm text-ink-2">{plan.adherenceNote.replace(/\s*\(self-reported\)/i, "")}</p>
          </div>
          {author ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Avatar src={author.avatar} name={author.name} size="xs" />
              {author.name} · updated {shortDate(plan.updatedAt)}
            </p>
          ) : null}
        </Inset>
      ) : (
        <LockedInset feature="nutrition">Structured nutrition plans aren't in this plan.</LockedInset>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------- tasks

const PRIORITY_LABEL: Record<Task["priority"], string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export function TasksGroup({ tasks, doneCount, userId, firstName }: { tasks: Task[]; doneCount: number; userId: string; firstName: string }) {
  return (
    <Group>
      <GroupHeader icon={<ListChecks />} title="Open tasks" subtitle={`${tasks.length} open${doneCount ? ` · ${doneCount} done` : ""}`} href="/tasks" actionLabel="Open tasks" />
      {tasks.length ? (
        <Inset className="py-2">
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const owner = staffById(t.ownerId);
              const overdue = Date.parse(t.due) < NOW;
              return (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  {owner ? <Avatar src={owner.avatar} name={owner.name} size="sm" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.ownerId === userId ? "You" : owner?.name ?? "Unassigned"} ·{" "}
                      <span className={overdue ? "text-danger" : undefined}>{overdue ? `overdue, was due ${shortDate(t.due)}` : `due ${relativeTime(t.due)}`}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge tone={priorityTone(t.priority)}>{PRIORITY_LABEL[t.priority]}</StatusBadge>
                    {t.status === "blocked" ? <span className="text-xs text-danger">Blocked</span> : t.status === "in-progress" ? <span className="text-xs text-muted">In progress</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Inset>
      ) : (
        <EmptyInset>No open tasks for {firstName}.</EmptyInset>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------- referrals

export const referralStalled = (r: Referral) => REFERRAL_STAGES.indexOf(r.stage) < REFERRAL_STAGES.indexOf("completed") && Date.parse(r.dueBy) < NOW;

function ReferralStepper({ referral }: { referral: Referral }) {
  const idx = REFERRAL_STAGES.indexOf(referral.stage);
  const stalled = referralStalled(referral);
  return (
    <ol className="mt-3 flex flex-col" aria-label="Referral progress">
      {REFERRAL_STAGES.map((st, i) => {
        const date = referral.stageDates[st];
        const done = i <= idx;
        const current = i === idx;
        const next = i === idx + 1;
        return (
          <li key={st} className="relative flex gap-3 pb-2 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < REFERRAL_STAGES.length - 1 ? (
              <span aria-hidden="true" className={cn("absolute left-[5px] top-[14px] h-[calc(100%-10px)] w-0.5 rounded-full", i < idx ? "bg-charcoal" : "bg-line-strong")} />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-[3px] size-3 shrink-0 rounded-full",
                done ? "bg-charcoal" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
                current && "ring-4 ring-sunken",
              )}
            />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className={cn("text-xs", done ? "text-ink" : "text-muted")}>
                {REFERRAL_STAGE_LABEL[st]}
                <span className="sr-only">{done ? " — done" : " — not yet"}</span>
              </span>
              <span className={cn("text-xs tabular", next && stalled ? "text-danger" : "text-muted")}>
                {date ? shortDate(date) : next ? (stalled ? `overdue since ${shortDate(referral.dueBy)}` : `due ${shortDate(referral.dueBy)}`) : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ReferralsGroup({ referrals, has }: { referrals: Referral[]; has: (f: FeatureId) => boolean }) {
  return (
    <Group>
      <GroupHeader icon={<ArrowsLeftRight />} title="Referrals" subtitle={referrals.length ? `${referrals.length} · requested → acknowledged` : "Handoffs between disciplines"} href={has("referrals") ? "/referrals" : undefined} actionLabel="Open referrals" />
      {!has("referrals") ? (
        <LockedInset feature="referrals">Tracked referrals between disciplines aren't in this plan.</LockedInset>
      ) : referrals.length ? (
        <div className="flex flex-col gap-2">
          {referrals.map((r) => {
            const from = staffById(r.fromId);
            const to = staffById(r.toId);
            const stalled = referralStalled(r);
            return (
              <Inset key={r.id}>
                <div className="flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {from ? <Avatar src={from.avatar} name={from.name} size="sm" ring /> : null}
                    {to ? <Avatar src={to.avatar} name={to.name} size="sm" ring /> : null}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs text-muted">
                    {from?.name} → {to?.name}
                  </p>
                  <StatusBadge tone={stalled ? "danger" : r.stage === "acknowledged" || r.stage === "completed" ? "success" : "info"} className="shrink-0">
                    {stalled ? `Stalled · ${REFERRAL_STAGE_LABEL[r.stage]}` : REFERRAL_STAGE_LABEL[r.stage]}
                  </StatusBadge>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink">
                  <DisciplineDot discipline={r.toDiscipline} />
                  {DISCIPLINE_LABEL[r.toDiscipline]} referral
                </p>
                <p className="mt-0.5 text-xs text-ink-2">{r.reason}</p>
                <ReferralStepper referral={r} />
              </Inset>
            );
          })}
        </div>
      ) : (
        <EmptyInset>No referrals yet.</EmptyInset>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------- documents

const DOC_TONE: Record<ClinicalDocument["status"], Tone> = { unclassified: "draft", "awaiting-review": "warning", reviewed: "success", filed: "neutral" };

export function DocumentsGroup({ docs, canSeeRestricted }: { docs: ClinicalDocument[]; canSeeRestricted: boolean }) {
  return (
    <Group>
      <GroupHeader icon={<Files />} title="Documents" subtitle="Report date shown apart from upload date" href="/documents" actionLabel="Open documents" />
      {docs.length ? (
        <Inset className="py-2">
          <ul className="divide-y divide-line">
            {docs.map((d) => {
              const hidden = d.sensitivity === "restricted" && !canSeeRestricted;
              const gapDays = (Date.parse(d.uploadedAt) - Date.parse(`${d.reportDate}T00:00:00+05:30`)) / 86_400_000;
              return (
                <li key={d.id} className="flex items-start gap-3 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
                    {hidden ? <LockSimple size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{hidden ? "Restricted document" : d.title}</p>
                    <p className="text-xs text-muted">
                      {hidden ? "Visible to the treating doctor only" : `${d.type} · ${d.source}`}
                    </p>
                    {!hidden && d.sensitivity === "restricted" ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-2">
                        <LockSimple size={12} aria-hidden="true" /> Restricted — treating doctor only
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-2">
                      Reported {formatDate(`${d.reportDate}T00:00:00+05:30`)} · uploaded {shortDate(d.uploadedAt)}
                    </p>
                    {gapDays > 60 ? <p className="mt-0.5 text-xs text-muted">Older report uploaded recently — not a new result.</p> : null}
                  </div>
                  <StatusBadge tone={DOC_TONE[d.status]} className="shrink-0">
                    {DOC_STATUS_LABEL[d.status]}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        </Inset>
      ) : (
        <EmptyInset>No documents on file. Reports uploaded by the patient or a lab appear here.</EmptyInset>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------- billing

export function BillingGroup({ invoices, balance, allowed }: { invoices: Invoice[]; balance: number; allowed: boolean }) {
  return (
    <Group>
      <GroupHeader icon={<Receipt />} title="Billing" subtitle={allowed ? (balance > 0 ? `${formatINR(balance)} outstanding` : "No balance due") : "Permission required"} href={allowed ? "/billing" : undefined} actionLabel="Open billing" />
      {!allowed ? (
        <Inset className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
            <LockSimple size={16} aria-hidden="true" />
          </span>
          <p className="text-xs text-muted">Invoices and balances are visible to the front desk, admins and the billing doctor. Your role doesn&apos;t include billing.</p>
        </Inset>
      ) : (
        <Inset className="py-2">
          <div className="flex items-end justify-between gap-3 pb-2 pt-2">
            <div>
              <p className="text-xs text-muted">Outstanding</p>
              <p className="mt-1 text-[28px] font-light leading-none tracking-[-0.02em] text-ink tabular">{formatINR(balance)}</p>
            </div>
            <p className="text-xs text-muted">{invoices.length ? `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}` : "No invoices"}</p>
          </div>
          {invoices.length ? (
            <ul className="divide-y divide-line">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate whitespace-nowrap font-mono text-xs text-ink">{i.number}</p>
                    <p className="truncate text-xs text-muted">
                      {shortDate(i.issuedAt)} · {i.items.map((x) => x.label).join(", ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-ink tabular">{formatINR(i.total)}</span>
                  <StatusBadge tone={invoiceTone(i.status)} className="shrink-0">
                    {INVOICE_STATUS_LABEL[i.status]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
          {invoices.some((i) => i.status === "failed") ? (
            <p className="pb-2 pt-1 text-xs text-danger">A payment callback didn&apos;t arrive — it is not marked paid until the gateway confirms.</p>
          ) : null}
        </Inset>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------- record set-up (patients with nothing recorded yet)

export type SetupStep = {
  id: string;
  label: string;
  state: "done" | "in-progress" | "todo";
  detail: ReactNode;
  optional?: boolean;
  action?: ReactNode;
};

const STEP_STATE_LABEL: Record<SetupStep["state"], string> = { done: "done", "in-progress": "in progress", todo: "not done yet" };

function StepMark({ state }: { state: SetupStep["state"] }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-charcoal text-white" aria-hidden="true">
        <Check size={12} weight="bold" />
      </span>
    );
  }
  if (state === "in-progress") {
    // half-filled: started, not finished
    return <span className="mt-0.5 size-5 shrink-0 rounded-full bg-[linear-gradient(90deg,var(--color-ink-2)_50%,transparent_50%)] shadow-[inset_0_0_0_1.5px_var(--color-ink-2)]" aria-hidden="true" />;
  }
  return <span className="mt-0.5 size-5 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden="true" />;
}

/**
 * Stands in for the body-system overview while a patient has nothing recorded: why no organ,
 * percentages or journey are drawn, what is on file and what is still missing. Every step is
 * read from the patient's registration, booking and care-team data; the ring counts the
 * required steps that are done.
 */
export function RecordSetupGroup({ steps, firstName, className }: { steps: SetupStep[]; firstName: string; className?: string }) {
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.state === "done").length;
  return (
    <Group className={className}>
      <section aria-labelledby="record-setup-title">
        <div className="flex items-center gap-4 p-2">
          <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong bg-surface/60" aria-hidden="true">
            <span className="size-6 rounded-full bg-sunken" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="record-setup-title" className="text-sm font-medium text-ink">
              Record set-up · body-system overview not started
            </h2>
            <p className="mt-0.5 max-w-[88ch] text-xs text-muted">
              The organ, body-system shares, timeline and journey are computed from recorded conditions and dated events. Nothing is recorded for {firstName} yet, so nothing is drawn — no placeholder organ, no zero-percent charts.
            </p>
          </div>
          <ProgressRing value={done} max={required.length} size={48} className="shrink-0 text-ink" track="var(--color-surface)">
            <span className="sr-only">{`${done} of ${required.length} required set-up steps done`}</span>
            <span aria-hidden="true" className="text-xs">
              {done}/{required.length}
            </span>
          </ProgressRing>
        </div>
        <ol aria-label="Set-up steps" className="mt-2 grid grid-cols-1 gap-2 @[640px]:grid-cols-2 @[1080px]:grid-cols-4">
          {steps.map((s) => (
            <li key={s.id}>
              <Inset className="flex h-full items-start gap-3">
                <StepMark state={s.state} />
                <div className="flex min-w-0 flex-1 flex-col self-stretch">
                  <p className="text-sm text-ink">
                    {s.label}
                    {s.optional ? <span className="text-muted"> · optional</span> : null}
                    <span className="sr-only"> — {STEP_STATE_LABEL[s.state]}</span>
                  </p>
                  <div className="mt-0.5 text-xs text-muted">{s.detail}</div>
                  {s.action ? <div className="mt-auto pt-3">{s.action}</div> : null}
                </div>
              </Inset>
            </li>
          ))}
        </ol>
        <Link href="/help#reading-the-visuals" className="group mt-1 flex w-fit items-center gap-2 rounded-full px-2 py-2 text-xs text-ink-2 transition-colors hover:text-ink">
          How the overview is built from the record
          <ArrowUpRight size={14} aria-hidden="true" className="transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </Link>
      </section>
    </Group>
  );
}
