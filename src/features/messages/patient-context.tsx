"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, CalendarBlank, ChatsCircle, ListChecks, ShieldCheck, ArrowsLeftRight } from "@phosphor-icons/react";
import type { Patient, Role } from "@/data/types";
import { getRecord } from "@/data/record";
import { latestMeasurements, measureHistory } from "@/data/insights";
import { WEEK_APPOINTMENTS, DISCIPLINE_LABEL } from "@/data/appointments";
import { clinicNumber, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Sparkline } from "@/components/charts/bar-chart";
import { personById } from "@/features/tasks/people";
import { useTasks } from "@/features/tasks/store";
import { dueLabel } from "@/features/tasks/task-meta";
import { byTime, dayName } from "@/features/tasks/time";
import { useReferrals } from "@/features/referrals/store";
import { DISCIPLINE_WORD, assignmentInfo } from "@/features/referrals/meta";
import { useRole } from "@/components/shell/role-context";
import type { ThreadView } from "./store";

/**
 * Patient context beside a conversation, built from the patient's record (getRecord) and the
 * shared fixtures: their conditions (doctor and nutritionist only), the latest reading
 * for that system with its own trend, the next appointment, and what is open for them.
 * Mirrors the record's access model: front desk and admin see the logistics, not the clinical summary.
 */
const CLINICAL_ROLES: Role[] = ["doctor", "nutritionist"];

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
  const viewerId = useRole().user.id;
  const clinical = CLINICAL_ROLES.includes(role);
  const primary = record?.systems[0];
  const conditions = record?.conditions ?? [];
  const ordered = primary ? [...conditions.filter((c) => c.systemId === primary.id), ...conditions.filter((c) => c.systemId !== primary.id)] : conditions;
  const latest = record && primary ? latestMeasurements(record, primary.id)[0] : undefined;
  const history = record && latest ? measureHistory(record, latest.label) : [];
  const next = nextVisit(patient);
  // Task titles can carry clinical content: other roles see operational items and their own only.
  const openTasks = tasks.filter((t) => t.patientId === patient.id && t.status !== "done" && (clinical || t.discipline === "operations" || t.ownerId === viewerId || t.createdBy === viewerId)).sort((a, b) => byTime(a.due, b.due));
  const openRefs = referrals.filter((r) => r.patientId === patient.id && assignmentInfo(r).status !== "seen");
  const team = (["doctor", "nutritionist", "yoga", "coordinator"] as const).map((k) => patient.careTeam[k]).filter((id): id is string => !!id);

  return (
    <aside aria-label={`Context for ${patient.name}`} className={cn("scrollbar-thin flex min-h-0 flex-col gap-2 overflow-y-auto rounded-card bg-sunken p-2", className)}>
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
          {/* conditions on the record (doctor and nutritionist only — rule 3) */}
          <section aria-labelledby="ctx-conditions" className="rounded-inner bg-surface p-4">
            <h3 id="ctx-conditions" className="text-[11px] text-muted">
              Conditions on the record
            </h3>
            {ordered.length ? (
              <>
                <ul className="mt-2 flex flex-col gap-1.5" aria-label="Conditions">
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
              </>
            ) : (
              <p className="mt-2 text-xs text-muted">No conditions recorded yet.</p>
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
          <p className="text-xs leading-relaxed text-muted">
            {role === "yoga"
              ? "Instructors see precautions, not diagnoses — this patient's precautions are on their session and in the Yoga section of the record."
              : role === "coordinator"
                ? "Clinical detail shows only where the doctor has granted it. Status of assignments, follow-ups and attendance is below."
                : "Clinical summary hidden for your role — logistics only."}
          </p>
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
        {openTasks.length === 0 && openRefs.length === 0 ? <p className="mt-2 text-xs text-muted">No open tasks or assignments.</p> : null}
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
            const info = assignmentInfo(r);
            return (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <ArrowsLeftRight size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-ink-2">Assignment → {DISCIPLINE_WORD[r.toDiscipline]}</span>
                  <span className={cn("block text-[11px]", info.status === "back" ? "text-warning" : "text-muted")}>
                    {info.status === "back" ? `Not seen in 48 h — back with ${staffById(r.fromId)?.name ?? "the doctor"}` : `Not opened yet by ${staffById(r.toId)?.name ?? "the recipient"}`}
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
                Assignments
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <PeopleInset title="Care team" ids={team} />
    </aside>
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
