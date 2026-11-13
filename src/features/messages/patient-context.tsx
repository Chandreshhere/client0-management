"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, CalendarBlank, ChatsCircle, ListChecks, ShieldCheck, ArrowsLeftRight } from "@phosphor-icons/react";
import type { Patient, Role } from "@/data/types";
import { ORGAN_LABEL } from "@/data/anatomy";
import { getRecord, type PatientRecord } from "@/data/record";
import { latestMeasurements, measureHistory, systemShares } from "@/data/insights";
import { WEEK_APPOINTMENTS, DISCIPLINE_LABEL } from "@/data/appointments";
import { clinicNumber, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { REFERRAL_STAGE_LABEL } from "@/data/care";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Sparkline } from "@/components/charts/bar-chart";
import { OrganImage } from "@/components/viz/organ";
import { personById } from "@/features/tasks/people";
import { useTasks } from "@/features/tasks/store";
import { dueLabel } from "@/features/tasks/task-meta";
import { byTime, dayName } from "@/features/tasks/time";
import { useReferrals } from "@/features/referrals/store";
import { referralState, waitText } from "@/features/referrals/meta";
import type { ThreadView } from "./store";

/**
 * Patient context beside a conversation, built from the patient's record (getRecord) and the
 * shared fixtures: the organ of their primary body system, their conditions, the latest reading
 * for that system with its own trend, the next appointment, and what is open for them.
 * Mirrors the record's access model: front desk and admin see the logistics, not the clinical summary.
 */
const CLINICAL_ROLES: Role[] = ["doctor", "nutritionist", "yoga", "coordinator"];

const STATUS_TONE: Record<string, string> = {
  Active: "bg-danger-soft text-danger",
  Monitoring: "bg-primary-soft text-primary-ink",
  "Remission period": "bg-success-soft text-success",
  Resolved: "bg-sunken text-muted",
};

function nextVisit(p: Patient) {
  const now = TODAY.getTime();
  const appt = WEEK_APPOINTMENTS.filter((a) => a.patientId === p.id && Date.parse(a.start) > now && a.status !== "cancelled" && a.status !== "no-show").sort((a, b) => byTime(a.start, b.start))[0];
  if (appt) return { at: appt.start, what: appt.service, withId: appt.staffId, room: appt.room, discipline: appt.discipline };
  if (p.nextAppointment && Date.parse(p.nextAppointment) > now) return { at: p.nextAppointment, what: null, withId: null, room: null, discipline: null };
  const review = getRecord(p.id)?.carePlan?.nextReview;
  if (review && Date.parse(review.at) > now) return { at: review.at, what: review.label, withId: review.with, room: null, discipline: null };
  return null;
}

export function PatientContext({ thread, role, className }: { thread: ThreadView; role: Role; className?: string }) {
  const patient = patientById(thread.patientId);
  if (!patient) {
    return (
      <aside aria-label="Conversation context" className={cn("flex min-h-0 flex-col rounded-card bg-sunken p-2", className)}>
        <div className="flex flex-col items-center gap-2 rounded-inner bg-surface px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-muted" aria-hidden="true">
            <ChatsCircle size={18} />
          </span>
          <p className="text-sm text-ink">Not about one patient</p>
          <p className="text-xs text-muted">This care-team thread isn&apos;t linked to a patient record, so there&apos;s no clinical context to show.</p>
        </div>
        <PeopleInset title="In this conversation" ids={thread.participants} />
      </aside>
    );
  }
  return <ContextBody patient={patient} role={role} className={className} />;
}

function ContextBody({ patient, role, className }: { patient: Patient; role: Role; className?: string }) {
  const record = useMemo(() => getRecord(patient.id), [patient.id]);
  const tasks = useTasks();
  const referrals = useReferrals();
  const clinical = CLINICAL_ROLES.includes(role);
  const primary = record?.systems[0];
  const conditions = record?.conditions ?? [];
  const ordered = primary ? [...conditions.filter((c) => c.systemId === primary.id), ...conditions.filter((c) => c.systemId !== primary.id)] : conditions;
  const latest = record && primary ? latestMeasurements(record, primary.id)[0] : undefined;
  const history = record && latest ? measureHistory(record, latest.label) : [];
  const next = nextVisit(patient);
  const openTasks = tasks.filter((t) => t.patientId === patient.id && t.status !== "done").sort((a, b) => byTime(a.due, b.due));
  const openRefs = referrals.filter((r) => r.patientId === patient.id && referralState(r).pending);
  const team = (["doctor", "nutritionist", "yoga", "coordinator"] as const).map((k) => patient.careTeam[k]).filter((id): id is string => !!id);

  return (
    <aside aria-label={`Context for ${patient.name}`} data-lenis-prevent className={cn("scrollbar-thin flex min-h-0 flex-col gap-2 overflow-y-auto rounded-card bg-sunken p-2", className)}>
      {/* identity */}
      <div className="flex items-center gap-3 rounded-inner bg-surface p-3">
        <Avatar src={patient.avatar} name={patient.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{patient.name}</p>
          <p className="truncate text-xs text-muted">
            {patient.age} · {patient.sex} · <span className="font-mono text-[11px]">{clinicNumber(patient.id)}</span>
          </p>
        </div>
        <Link
          href={`/patients/${patient.id}`}
          aria-label={`Open ${patient.name}'s record`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink transition-[background-color,transform] duration-200 hover:bg-sunken active:scale-95"
        >
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {clinical ? (
        <>
          {/* primary body system: organ derived from recorded conditions */}
          <section aria-labelledby="ctx-system" className="rounded-inner bg-surface p-4">
            <h3 id="ctx-system" className="text-[11px] text-muted">
              Primary body system · from recorded conditions
            </h3>
            {primary ? (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <span className="relative flex size-[88px] shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_45%,var(--color-surface)_0%,var(--color-canvas)_70%)] shadow-[inset_0_0_0_1px_var(--color-line)]">
                    <OrganImage kind={primary.organ} alt={`${ORGAN_LABEL[primary.organ]} — ${primary.name} system`} className="size-[112%] max-w-none [animation:organ-float_7s_ease-in-out_infinite]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-light leading-tight tracking-[-0.01em] text-ink">{primary.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {ORGAN_LABEL[primary.organ]} · {conditions.filter((c) => c.systemId === primary.id).length} of {conditions.length} {conditions.length === 1 ? "condition" : "conditions"}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5" aria-label="Conditions">
                  {ordered.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-ink-2" title={c.name}>
                        {c.name}
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", STATUS_TONE[c.status] ?? "bg-sunken text-muted")}>{c.status}</span>
                    </li>
                  ))}
                </ul>
                {ordered.length > 4 ? <p className="mt-1.5 text-[11px] text-muted">+{ordered.length - 4} more on the record</p> : null}
                {record ? <SystemShares record={record} /> : null}
              </>
            ) : (
              <p className="mt-2 text-xs text-muted">No conditions recorded yet — nothing to summarise.</p>
            )}
          </section>

          {/* latest reading for the primary system, with its own history */}
          {latest ? (
            <section aria-labelledby="ctx-reading" className="rounded-inner bg-surface p-4">
              <h3 id="ctx-reading" className="text-[11px] text-muted">
                Latest reading · {primary?.name}
              </h3>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink-2">{latest.label}</p>
                  <p className="flex items-baseline gap-1 text-ink">
                    <span className="text-[22px] font-light leading-tight tabular">{latest.value}</span>
                    {latest.unit ? <span className="text-xs text-muted">{latest.unit}</span> : null}
                  </p>
                </div>
                {history.length > 1 ? (
                  <span role="img" aria-label={`${latest.label} trend: ${history.map((h) => h.value).join(", ")} (${history.length} readings since ${formatDate(history[0].date, { month: "short", year: "numeric" })})`}>
                    <Sparkline values={history.map((h) => h.value)} className="h-8 w-[104px]" />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {formatDate(latest.event.date, { day: "numeric", month: "short" })} · {latest.event.state === "self-reported" ? "self-reported" : latest.event.authorRole}
                {latest.event.state === "awaiting-review" ? <span className="text-primary-ink"> · awaiting review</span> : null}
                {latest.flag ? <span className="text-warning"> · {latest.flag === "high" ? "above" : "below"} target</span> : null}
                {history.length > 1 ? ` · ${history.length} readings` : " · first reading"}
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-inner bg-surface p-4">
          <ShieldCheck size={18} className="mt-px shrink-0 text-success" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted">Clinical summary hidden for your role — logistics only. The care team sees conditions and readings here.</p>
        </div>
      )}

      {/* next appointment */}
      <section aria-labelledby="ctx-next" className="rounded-inner bg-surface p-4">
        <h3 id="ctx-next" className="text-[11px] text-muted">
          Next appointment
        </h3>
        {next ? (
          <div className="mt-2 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <CalendarBlank size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {dayName(next.at)}, {formatTime(next.at)}
              </p>
              <p className="truncate text-xs text-muted">
                {[next.what, staffById(next.withId ?? undefined)?.name, next.room].filter(Boolean).join(" · ") || "Details not on this week's diary"}
              </p>
              {next.discipline ? <p className="mt-0.5 text-[11px] text-muted">{DISCIPLINE_LABEL[next.discipline]}</p> : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Nothing booked.</p>
        )}
      </section>

      {/* open work for this patient */}
      <section aria-labelledby="ctx-open" className="rounded-inner bg-surface p-4">
        <h3 id="ctx-open" className="text-[11px] text-muted">
          Open for this patient
        </h3>
        {openTasks.length === 0 && openRefs.length === 0 ? <p className="mt-2 text-xs text-muted">No open tasks or referrals.</p> : null}
        <ul className="mt-2 flex flex-col gap-2">
          {openTasks.slice(0, 3).map((t) => {
            const due = dueLabel(t);
            return (
              <li key={t.id} className="flex items-start gap-2 text-xs">
                <ListChecks size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-ink-2">{t.title}</span>
                  <span className={cn("block text-[11px]", due.tone === "danger" ? "text-danger" : "text-muted")}>
                    {due.text} · {personById(t.ownerId)?.name ?? "Unassigned"}
                  </span>
                </span>
              </li>
            );
          })}
          {openRefs.map((r) => {
            const st = referralState(r);
            return (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <ArrowsLeftRight size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-ink-2">Referral → {DISCIPLINE_LABEL[r.toDiscipline]}</span>
                  <span className={cn("block text-[11px]", st.overdue ? "text-danger" : st.stalled ? "text-warning" : "text-muted")}>
                    Waiting to be {st.pending ? REFERRAL_STAGE_LABEL[st.pending].toLowerCase() : "moved on"}
                    {staffById(st.waitingOn ?? undefined) ? ` by ${staffById(st.waitingOn ?? undefined)!.name}` : ""} · {waitText(st.waitingDays)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {openTasks.length > 3 ? <p className="mt-2 text-[11px] text-muted">+{openTasks.length - 3} more tasks</p> : null}
        {openTasks.length || openRefs.length ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {openTasks.length ? (
              <Link href="/tasks" className="text-primary-ink underline-offset-2 hover:underline">
                Tasks
              </Link>
            ) : null}
            {openRefs.length ? (
              <Link href="/referrals" className="text-primary-ink underline-offset-2 hover:underline">
                Referrals
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <PeopleInset title="Care team" ids={team} />
    </aside>
  );
}

/**
 * Where this patient's care activity went over the last 12 months, per body system on the record
 * (ref 2's body-condition % cards, condensed). Only shown when there is more than one system.
 */
function SystemShares({ record }: { record: PatientRecord }) {
  const shares = systemShares(record);
  const total = shares[0]?.total ?? 0;
  if (shares.length < 2 || total === 0) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-[11px] text-muted">
        Share of care activity · last 12 months · {total} {total === 1 ? "event" : "events"}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {shares.map((s) => (
          <li key={s.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <OrganImage kind={s.organ} alt={ORGAN_LABEL[s.organ]} className="size-6" />
            <span className="min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-ink-2">{s.name}</span>
                <span className="shrink-0 text-[11px] text-muted tabular">
                  {s.events} of {total}
                </span>
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <span className="block h-full rounded-full bg-ink-2" style={{ width: `${s.percent}%` }} />
              </span>
            </span>
            <span className="w-9 text-right text-ink tabular">{s.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeopleInset({ title, ids }: { title: string; ids: string[] }) {
  if (!ids.length) return null;
  return (
    <section className="rounded-inner bg-surface p-4">
      <h3 className="text-[11px] text-muted">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {ids.map((id) => {
          const p = personById(id);
          const s = staffById(id);
          if (!p) return null;
          return (
            <li key={id} className="flex items-center gap-2">
              <Avatar src={p.avatar} name={p.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-xs text-ink">{p.name}</span>
                <span className={cn("block truncate text-[11px]", s?.status === "on-leave" ? "text-warning" : "text-muted")}>{s ? (s.status === "on-leave" ? s.workingHours : s.title.split(" · ")[0]) : "Patient"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
