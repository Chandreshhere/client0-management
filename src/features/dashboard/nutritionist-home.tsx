"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import {
  ArrowUpRight,
  ArrowsLeftRight,
  BowlFood,
  CalendarBlank,
  CalendarPlus,
  Check,
  ClipboardText,
  ForkKnife,
  ListChecks,
  NotePencil,
  PhoneCall,
  Plus,
  UserCircle,
  Warning,
} from "@phosphor-icons/react";
import { snappy } from "@/lib/motion";
import { formatTime, pluralize } from "@/lib/format";
import { usePlan } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { REFERRALS, TASKS } from "@/data/care";
import { NUTRITION_PLANS, PLAN_STATUS_LABEL } from "@/data/programs";
import type { Appointment, NutritionPlanSummary, PlanStatus } from "@/data/types";
import { NOW_LABEL, NOW_MIN, TODAY_KEY, appointmentsFor, daysSince, istDayKey, istMinutes, minutesUntil, nowIndex, shortDate, spanLabel, untilLabel, whenLabel } from "./data";
import { AppointmentRow, DashGrid, DashboardHeader, FocalCard, FocalFact, FocalHead, NowMarker, Panel, PanelEmpty, Reveal, RowLink, StageTrack, Rail} from "./ui";
import { cn } from "@/lib/cn";
import { LogDots, PlanTargets } from "./nutrition-visuals";
import { organFor } from "./derive";
import { OrganBadge } from "./viz";

/**
 * Nutritionist home (doc §2C): next consultation, plans to publish or review, self-reported food
 * logs, referrals waiting for acceptance and patients who have not rebooked.
 */
const ME = DEMO_USER.nutritionist.personId;
const ACTIVE = new Set<Appointment["status"]>(["arrived", "waiting", "booked", "checkout", "in-session"]);

const schedule = appointmentsFor(ME);
const NOW_AT = nowIndex(schedule);
const nextAppt = schedule.find((a) => ACTIVE.has(a.status) && istMinutes(a.start) + a.durationMin > NOW_MIN) ?? null;

const incoming = REFERRALS.filter((r) => r.toId === ME && r.stage === "requested").sort((a, b) => a.dueBy.localeCompare(b.dueBy));

const myPlans = NUTRITION_PLANS.filter((p) => p.authorId === ME);
const PLAN_ORDER: Record<PlanStatus, number> = { "in-review": 0, draft: 1, published: 2, superseded: 3 };
const plansToAct = myPlans
  .filter((p) => p.status === "draft" || p.status === "in-review" || (p.status === "published" && istDayKey(p.nextReview) === TODAY_KEY))
  .sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status] || a.nextReview.localeCompare(b.nextReview));
// Food logs: patients following one of my live plans whose adherence notes come from their own logs.
const foodLogs = myPlans.filter((p) => (p.status === "published" || p.status === "in-review") && !/awaiting|assessment/i.test(p.adherenceNote));

// Not rebooked: missed today with no next visit booked.
const notRebooked = schedule
  .filter((a) => a.status === "no-show")
  .map((a) => ({ appt: a, patient: patientById(a.patientId)! }))
  .filter(({ patient }) => !patient.nextAppointment);

/** The plan to compare first: the next patient on today's list who has a live plan of mine. */
const NEXT_PLAN_ID = schedule
  .filter((a) => istMinutes(a.start) + a.durationMin > NOW_MIN && ACTIVE.has(a.status))
  .map((a) => myPlans.find((p) => p.patientId === a.patientId && p.status !== "superseded")?.id)
  .find(Boolean);

const planTone = (s: PlanStatus) => ({ draft: "draft", "in-review": "warning", published: "success", superseded: "neutral" } as const)[s];

export function NutritionistHome() {
  const { toast } = useToast();
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const toAccept = incoming.filter((r) => !accepted[r.id]).length;

  const accept = (id: string) => {
    const r = REFERRALS.find((x) => x.id === id)!;
    setAccepted((s) => ({ ...s, [id]: NOW_LABEL }));
    toast({
      tone: "success",
      title: `Referral accepted · ${patientById(r.patientId)?.name}`,
      description: `Saved in this browser session — ${staffById(r.fromId)?.name} is not notified in the demo.`,
      action: { label: "Undo", onClick: () => setAccepted((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id))) },
    });
  };

  const markReviewed = (plan: NutritionPlanSummary) => {
    setReviewed((s) => ({ ...s, [plan.id]: true }));
    toast({
      title: `Food log reviewed · ${patientById(plan.patientId)?.name}`,
      description: "Marked in this browser session. Entries stay labelled self-reported.",
      action: { label: "Undo", onClick: () => setReviewed((s) => ({ ...s, [plan.id]: false })) },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(schedule.length, "consultation")} today · ${pluralize(toAccept, "referral")} to accept · ${pluralize(plansToAct.length, "plan")} to publish or review`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/nutrition/builder">
                <NotePencil />
                Open plan builder
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/nutrition/logs">
                <ForkKnife />
                Food logs
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          {nextAppt ? <NextConsultationCard appt={nextAppt} /> : null}
        </Reveal>

        <Reveal index={1}>
          <Panel icon={<CalendarBlank />} title="Today's consultations" subtitle={`${pluralize(schedule.length, "appointment")} · ${staffById(ME)?.room}`} href="/schedule" actionLabel="Open schedule">
            {schedule.map((a, i) => (
              <div key={a.id} className="contents">
                {i === NOW_AT ? <NowMarker /> : null}
                <AppointmentRow appt={a} detail={a.formsComplete === false ? `${a.service} · intake incomplete` : undefined} />
              </div>
            ))}
            {NOW_AT === schedule.length ? <NowMarker /> : null}
          </Panel>
        </Reveal>

        <Reveal index={2} className="lg:col-span-2">
          <PlanTargets authorId={ME} defaultPlanId={NEXT_PLAN_ID} />
        </Reveal>

        <Rail index={3} className="lg:row-span-2" innerClassName="flex flex-col gap-4">
          <Panel
            icon={<ArrowsLeftRight />}
            title="Referrals to accept"
            subtitle={toAccept ? `${pluralize(toAccept, "referral")} waiting for you` : "All referrals accepted"}
            href="/referrals"
            actionLabel="Open referrals"
          >
            {incoming.length === 0 ? (
              <PanelEmpty icon={<ArrowsLeftRight />} title="No referrals waiting" />
            ) : (
              incoming.map((r) => {
                const p = patientById(r.patientId);
                const at = accepted[r.id];
                const overdue = !at && minutesUntil(r.dueBy) < 0;
                return (
                  <motion.div key={r.id} layout transition={snappy} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{p?.name}</p>
                        <p className="text-xs text-muted">
                          From {staffById(r.fromId)?.name} · {shortDate(r.requestedAt)}
                        </p>
                      </div>
                      {at ? (
                        <StatusBadge tone="success">Accepted {at}</StatusBadge>
                      ) : overdue ? (
                        <StatusBadge tone="danger">Overdue</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Due {whenLabel(r.dueBy).replace("Today ", "")}</StatusBadge>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-ink-2">{r.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <StageTrack stage={at ? "accepted" : r.stage} stalled />
                        {at ? "Accepted · not booked yet" : `Waiting ${pluralize(daysSince(r.requestedAt), "day")}`}
                      </span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {at ? (
                          <motion.span key="book" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={snappy}>
                            <Button asChild size="sm" variant="secondary">
                              <Link href="/schedule?new=1">
                                <CalendarPlus />
                                Book first visit
                              </Link>
                            </Button>
                          </motion.span>
                        ) : (
                          <motion.span key="accept" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={snappy}>
                            <Button size="sm" variant="dark" onClick={() => accept(r.id)} aria-label={`Accept referral for ${p?.name}`}>
                              <Check />
                              Accept
                            </Button>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </Panel>

          <NotRebookedPanel />
        </Rail>

        <Rail index={4}>
          <Panel icon={<ClipboardText />} title="Plans to publish or review" subtitle={`${pluralize(plansToAct.length, "plan")} need you`} href="/nutrition" actionLabel="Open nutrition plans">
            {plansToAct.map((plan) => {
              const p = patientById(plan.patientId);
              const reviewToday = plan.status === "published";
              return (
                <RowLink key={plan.id} href={plan.status === "published" ? "/nutrition" : "/nutrition/builder"} className="flex flex-col gap-2">
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{p?.name}</span>
                        <span className="block truncate text-xs text-muted">
                          v{plan.version} · {plan.title}
                        </span>
                      </span>
                    </span>
                    <StatusBadge tone={planTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</StatusBadge>
                  </span>
                  <span className="text-xs text-muted">
                    {reviewToday ? `Review at today's ${formatTime(plan.nextReview)} follow-up` : `Updated ${whenLabel(plan.updatedAt)} · ${plan.adherenceNote}`}
                  </span>
                </RowLink>
              );
            })}
          </Panel>
        </Rail>

        <Reveal index={5}>
          <Panel
            icon={<BowlFood />}
            title="Food logs to review"
            subtitle={`${foodLogs.filter((f) => !reviewed[f.id]).length} of ${foodLogs.length} not reviewed · self-reported`}
            href="/nutrition/logs"
            actionLabel="Open food logs"
          >
            {foodLogs.map((plan) => {
              const p = patientById(plan.patientId);
              const done = !!reviewed[plan.id];
              return (
                <div key={plan.id} className="rounded-inner bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{p?.name}</p>
                      <p className="text-xs text-muted">
                        Plan v{plan.version} · {plan.preference}
                      </p>
                    </div>
                    <StatusBadge tone={done ? "success" : "neutral"}>{done ? "Reviewed" : "Self-reported"}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">“{plan.adherenceNote.replace(/\s*\(self-reported\)/i, "")}”</p>
                  <LogDots patientId={plan.patientId} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link href="/nutrition/logs" className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
                      Open log
                    </Link>
                    <Button size="sm" variant={done ? "ghost" : "secondary"} onClick={() => (done ? setReviewed((s) => ({ ...s, [plan.id]: false })) : markReviewed(plan))} aria-label={done ? `Mark ${p?.name}'s food log as not reviewed` : `Mark ${p?.name}'s food log reviewed`}>
                      {done ? "Undo" : (
                        <>
                          <Check />
                          Mark reviewed
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </Panel>
        </Reveal>
      </DashGrid>
    </div>
  );
}

function NotRebookedPanel() {
  const { has } = usePlan();
  return (
    <Panel icon={<PhoneCall />} title="Not rebooked" subtitle={notRebooked.length ? `${pluralize(notRebooked.length, "patient")} missed a visit today` : "Everyone has a next visit"} href="/tasks" actionLabel="Open tasks">
      {notRebooked.length === 0 ? (
        <PanelEmpty icon={<PhoneCall />} title="Nobody to chase" />
      ) : (
        notRebooked.map(({ appt, patient }) => {
          const task = TASKS.find((t) => t.patientId === patient.id && /rebook/i.test(t.title) && t.status !== "done");
          return (
            <div key={appt.id} className="rounded-inner bg-surface p-4">
              <div className="flex items-start gap-3">
                <Avatar src={patient.avatar} name={patient.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{patient.name}</p>
                  <p className="text-xs text-muted">
                    {APPOINTMENT_STATUS_LABEL[appt.status]} at {formatTime(appt.start)} · {appt.service} · no next visit
                  </p>
                </div>
                <StatusBadge tone={appointmentTone(appt.status)}>{APPOINTMENT_STATUS_LABEL[appt.status]}</StatusBadge>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {task && has("coordinator") ? (
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <Avatar src={staffById(task.ownerId)?.avatar} name={staffById(task.ownerId)?.name ?? ""} size="xs" />
                    {staffById(task.ownerId)?.name} is calling · due {formatTime(task.due)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <LockBadge />
                    No coordinator on your plan — follow up yourself
                  </span>
                )}
                <Button asChild size="sm" variant="secondary">
                  <Link href="/tasks?new=1">
                    <Plus />
                    Follow-up task
                  </Link>
                </Button>
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: next consultation
// ---------------------------------------------------------------------------------------------

function NextConsultationCard({ appt }: { appt: Appointment }) {
  const id = useId();
  const p = patientById(appt.patientId)!;
  const doctor = staffById(p.careTeam.doctor);
  const plan = NUTRITION_PLANS.find((n) => n.patientId === p.id && n.status !== "superseded");
  const arrivedAt = appt.arrivedAt;
  const checkoutTask = TASKS.find((t) => t.patientId === p.id && t.status !== "done" && t.ownerId !== ME);
  const later = schedule.filter((a) => a.id !== appt.id && ACTIVE.has(a.status) && istMinutes(a.start) > istMinutes(appt.start));
  const doctorAway = doctor?.status === "on-leave";
  const organ = organFor(p.id);

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Next consultation"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={p.avatar} name={p.name} size="lg" className="bg-white" />
            <span className="min-w-0">{p.name}</span>
          </span>
        }
        meta={
          <>
            {p.age} · {p.sex} · {appt.service} · {appt.room}
          </>
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{formatTime(appt.start)}</p>
            <p className="text-xs text-white/90">
              {APPOINTMENT_STATUS_LABEL[appt.status]}
              {appt.token ? (
                <>
                  {" "}
                  · token <span className="font-mono">{appt.token}</span>
                </>
              ) : null}
              {arrivedAt ? ` · waiting ${spanLabel(NOW_MIN - istMinutes(arrivedAt))}` : ` · ${untilLabel(appt.start)}`}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-4 pb-2 sm:grid-cols-3">
        <FocalFact label="Clinical context">
          <div className="flex items-start gap-3">
            {organ ? <OrganBadge kind={organ.kind} size={48} tone="glass" label={`${organ.label}, from ${organ.condition}`} /> : null}
            <div className="min-w-0">
              <ul className="flex flex-col gap-1">
                {p.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {organ ? <p className="mt-1 text-xs text-white/90">{organ.label} · primary body system</p> : null}
            </div>
          </div>
        </FocalFact>
        <FocalFact label="Allergies & intolerances">
          {p.allergies === null ? (
            <span className="inline-flex items-start gap-1.5">
              <Warning size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Not recorded — ask first
            </span>
          ) : p.allergies.length === 0 ? (
            "None known (confirmed)"
          ) : (
            p.allergies.join(", ")
          )}
          {p.program ? <p className="mt-2 text-xs text-white/90">Programme · {p.program}</p> : null}
        </FocalFact>
        <FocalFact label="Doctor guidance">
          {doctor ? doctor.name : "No doctor on the care team"}
          {doctorAway ? <p className="mt-1 text-xs text-white/90">{doctor?.workingHours} — check guidance before changing the plan</p> : null}
        </FocalFact>
      </div>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <li className="flex flex-col rounded-inner bg-surface p-4">
          <span className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <ClipboardText size={16} />
            </span>
            <StatusBadge tone={p.intakeComplete ? "success" : "warning"}>{p.intakeComplete ? "Complete" : "Missing"}</StatusBadge>
          </span>
          <span className="mt-4 text-sm text-ink">Intake &amp; preferences</span>
          <span className="mt-1 text-xs text-muted">{p.tags.includes("Caregiver access") ? "Caregiver access on file" : "Patient-completed form"} · last visit {p.lastVisit ? shortDate(p.lastVisit) : "—"}</span>
        </li>
        <li className="flex flex-col rounded-inner bg-surface p-4">
          <span className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <BowlFood size={16} />
            </span>
            {plan ? <StatusBadge tone={planTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</StatusBadge> : <StatusBadge tone="draft">No plan yet</StatusBadge>}
          </span>
          <span className="mt-4 text-sm text-ink">{plan ? `Plan v${plan.version}` : "Nutrition plan"}</span>
          <span className="mt-1 text-xs text-muted">{plan ? plan.title : "Nothing published in Carelane — start one during the visit"}</span>
        </li>
        <li className="flex flex-col rounded-inner bg-surface p-4">
          <span className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <ListChecks size={16} />
            </span>
            {checkoutTask ? <StatusBadge tone="neutral">Front desk</StatusBadge> : null}
          </span>
          <span className="mt-4 text-sm text-ink">{checkoutTask ? checkoutTask.title : "No open actions"}</span>
          <span className="mt-1 text-xs text-muted">{checkoutTask ? `${staffById(checkoutTask.ownerId)?.name} · by ${formatTime(checkoutTask.due)}` : "Nothing waiting on others"}</span>
        </li>
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 p-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" className="shadow-none">
            <Link href="/nutrition/builder">
              <Plus />
              {plan ? "Update plan" : "Start plan"}
            </Link>
          </Button>
          <Button asChild variant="glass">
            <Link href={`/patients/${p.id}`}>
              Open record
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        {later.length ? (
          <p className="flex items-center gap-2 text-xs text-white/90">
            <UserCircle size={16} aria-hidden="true" />
            Later: {later.map((a) => `${formatTime(a.start)} ${patientById(a.patientId)?.name.split(" ")[0]}`).join(" · ")}
          </p>
        ) : null}
      </div>
    </FocalCard>
  );
}

