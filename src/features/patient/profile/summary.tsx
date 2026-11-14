"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowsLeftRight,
  BowlFood,
  CalendarBlank,
  CalendarPlus,
  ChatCircleDots,
  ClipboardText,
  ClockCounterClockwise,
  FileText,
  Files,
  FirstAidKit,
  Heartbeat,
  IdentificationCard,
  NotePencil,
  PersonSimpleTaiChi,
  Pill,
  ShieldCheck,
  UploadSimple,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { clinicNumber, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { DOC_STATUS_LABEL } from "@/data/records";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useRole } from "@/components/shell/role-context";
import { AddOnBadge } from "@/components/shell/plan-switcher";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorName } from "@/features/patient/event-meta";
import { useRecord as useRecordStore } from "@/features/patient-record/store";
import { baseDocuments, isFeaturedPatient } from "@/features/patient-record/record-model";
import { DOC_STATUS_TONE, useEffectiveStatus } from "@/features/patient-record/document-preview";
import type { ChangeKind } from "@/features/patient-record/data";
import { useNutrition } from "@/features/nutrition/store";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { FlagToDoctorModal } from "@/features/tasks/flag-modal";
import { ProfileFrame } from "./frame";
import { AssignDialog } from "./assign-dialog";
import { useProfileStore } from "./profile-store";
import { isFrontOffice, sectionHref } from "./sections";
import {
  TEAM_LABEL,
  assignmentsOf,
  byDateIssued,
  careTeamOf,
  changesSinceLastVisit,
  conditionsOf,
  currentMedicines,
  demographicsOf,
  firstName,
  nextFollowUp,
  type AssignmentView,
  type TeamKey,
  type TeamMember,
} from "./derive";
import { useYogaProgress } from "./yoga-progress";

const fmtDay = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const fmtDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short", year: "numeric" });

/** Summary for every role that sees it: clinical (doctor, nutritionist), status (coordinator), demographics (Admin, Reception). */
export function SummarySection({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role } = useRole();
  if (isFrontOffice(role)) return <DemographicsProfile patient={patient} />;
  if (role === "coordinator") return <StatusSummary patient={patient} />;
  return <ClinicalSummary patient={patient} />;
}

/* ------------------------------------------------------------------ clinical */

function ClinicalSummary({ patient }: { patient: Patient }) {
  const { role, has } = useRole();
  const [assigning, setAssigning] = useState<null | "nutrition" | "yoga">(null);
  const [flagging, setFlagging] = useState(false);
  const doctor = role === "doctor";
  const first = firstName(patient);
  const changes = changesSinceLastVisit(patient, has);

  return (
    <ProfileFrame
      patient={patient}
      title="Summary"
      description={`Before you see ${first}: allergies, medicines, conditions, the care team and what changed since ${patient.lastVisit || isFeaturedPatient(patient.id) ? "the last visit" : "registration"}.`}
      actions={
        doctor ? (
          <>
            <Button asChild variant="secondary" leading={<Heartbeat />}>
              <Link href={sectionHref(patient.id, "summary", "body-map")}>Body map</Link>
            </Button>
            <Button asChild variant="primary" leading={<NotePencil />}>
              <Link href={`${sectionHref(patient.id, "medical")}?new=1`}>Start consultation note</Link>
            </Button>
          </>
        ) : has("flags") ? (
          <Button variant="secondary" leading={<Warning />} onClick={() => setFlagging(true)}>
            Flag to doctor
          </Button>
        ) : null
      }
    >
      <Group className="grid grid-cols-1 gap-2 @[880px]:grid-cols-3">
        <AllergiesInset patient={patient} />
        <MedicinesInset patient={patient} />
        <ConditionsInset patient={patient} />
      </Group>

      <div className="grid grid-cols-1 items-start gap-6 @[960px]:grid-cols-[minmax(0,1fr)_minmax(320px,384px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ChangesGroup since={changes.since} items={changes.items} lastVisit={!!patient.lastVisit || isFeaturedPatient(patient.id)} />
          <ReportsGroup patient={patient} />
          <DisciplinesGroup patient={patient} showYoga={doctor} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <FollowUpGroup patient={patient} />
          <CareTeamGroup patient={patient} onAssign={doctor ? (d) => setAssigning(d) : undefined} />
        </div>
      </div>

      <AssignDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} patient={patient} discipline={assigning ?? "nutrition"} />
      <FlagToDoctorModal open={flagging} onOpenChange={setFlagging} patients={[{ id: patient.id, hint: patient.program ?? undefined }]} context="Patient summary" />
    </ProfileFrame>
  );
}

function InsetHeading({ icon, title, count, href, linkLabel }: { icon: ReactNode; title: string; count?: number; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-2 [&_svg]:size-[18px]" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-sm text-ink">{title}</h2>
      {typeof count === "number" ? <span className="rounded-full bg-sunken px-1.5 text-[11px] text-muted tabular">{count}</span> : null}
      {href ? (
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          {linkLabel}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/** Allergies: a blank field is "not recorded" — never shown as "no known allergies". */
function AllergiesInset({ patient }: { patient: Patient }) {
  const a = patient.allergies;
  return (
    <Inset className={cn(a && a.length ? "bg-danger-soft" : a === null ? "bg-warning-soft" : undefined)}>
      <InsetHeading icon={<Warning />} title="Allergies" />
      {a === null ? (
        <p className="mt-3 text-sm text-warning">Not recorded — ask and record before prescribing.</p>
      ) : a.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">No known allergies (confirmed with the patient).</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {a.map((x) => (
            <li key={x} className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-sm text-danger">
              {x}
            </li>
          ))}
        </ul>
      )}
    </Inset>
  );
}

function MedicinesInset({ patient }: { patient: Patient }) {
  const meds = currentMedicines(patient.id);
  return (
    <Inset>
      <InsetHeading icon={<Pill />} title="Current medicines" count={meds.length} href={sectionHref(patient.id, "medical", "conditions")} linkLabel="History" />
      {meds.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No medicines recorded.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {meds.slice(0, 5).map((m) => (
            <li key={m.id} className="min-w-0">
              <p className="truncate text-sm text-ink" title={m.name}>
                {m.name}
              </p>
              <p className="line-clamp-2 text-xs text-muted">{m.detail}</p>
              {m.reported ? <p className="text-xs text-warning">Patient reports: {m.reported.toLowerCase()}</p> : null}
            </li>
          ))}
          {meds.length > 5 ? <li className="text-xs text-muted">+{meds.length - 5} more</li> : null}
        </ul>
      )}
    </Inset>
  );
}

function ConditionsInset({ patient }: { patient: Patient }) {
  const all = conditionsOf(patient.id);
  const active = all.filter((c) => c.status !== "Resolved");
  return (
    <Inset>
      <InsetHeading icon={<FirstAidKit />} title="Active conditions" count={active.length} href={sectionHref(patient.id, "medical", "conditions")} linkLabel="All" />
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{all.length ? "No active conditions." : "No conditions recorded yet — they're added at the first consultation."}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {active.slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{c.name}</span>
                <span className="block text-xs text-muted">Since {formatDate(c.since, { month: "short", year: "numeric" })}</span>
              </span>
              <StatusBadge tone={c.status === "Active" ? "warning" : "neutral"} className="shrink-0">
                {c.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
      {all.length > active.length ? <p className="mt-2 text-xs text-muted">{all.length - active.length} resolved</p> : null}
    </Inset>
  );
}

const CHANGE_ICON: Record<ChangeKind, ReactNode> = {
  report: <Files />,
  plan: <ClipboardText />,
  guidance: <ShieldCheck />,
  missed: <CalendarBlank />,
};

function ChangesGroup({ since, items, lastVisit }: { since: string; items: ReturnType<typeof changesSinceLastVisit>["items"]; lastVisit: boolean }) {
  return (
    <Group>
      <GroupHeader icon={<ClockCounterClockwise />} title={`What changed since ${lastVisit ? "the last visit" : "registration"}`} subtitle={`Since ${fmtDate(since)} · ${items.length ? `${items.length} ${items.length === 1 ? "item" : "items"}` : "nothing new"}`} />
      {items.length === 0 ? (
        <Inset>
          <p className="text-sm text-muted">Nothing new has reached the record since {fmtDate(since)}.</p>
        </Inset>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="group flex items-start gap-3 rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4" aria-hidden="true">
                  {CHANGE_ICON[c.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">{c.title}</span>
                    {c.selfReported ? <StatusBadge tone="neutral">Self-reported</StatusBadge> : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{c.detail}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {fmtDay(c.date)} · {authorName(c.by)}
                  </span>
                </span>
                <ArrowRight size={16} className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Group>
  );
}

function ReportsGroup({ patient }: { patient: Patient }) {
  const uploads = useRecordStore((s) => s.uploads);
  const statusOf = useEffectiveStatus();
  const docs = useMemo(() => [...uploads.filter((d) => d.patientId === patient.id), ...baseDocuments(patient.id)].sort(byDateIssued), [uploads, patient.id]);
  const waiting = docs.filter((d) => statusOf(d) === "awaiting-review").length;
  return (
    <Group>
      <GroupHeader
        icon={<Files />}
        title="Latest reports"
        subtitle={`By date issued${waiting ? ` · ${waiting} awaiting review` : ""}`}
        href={sectionHref(patient.id, "reports")}
        actionLabel="Open all reports"
      />
      {docs.length === 0 ? (
        <Inset>
          <p className="text-sm text-muted">No reports yet. Uploads appear here with the date they were issued.</p>
        </Inset>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.slice(0, 3).map((d) => {
            const status = statusOf(d);
            return (
              <li key={d.id}>
                <Link href={`${sectionHref(patient.id, "reports")}?doc=${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                    <FileText size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{d.title}</span>
                    <span className="block text-xs text-muted">
                      Issued {fmtDate(d.reportDate)} · uploaded {fmtDay(d.uploadedAt)}
                    </span>
                  </span>
                  <StatusBadge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Group>
  );
}

/** F3: the current nutrition plan and recent yoga progress, each opening its section. */
function DisciplinesGroup({ patient, showYoga }: { patient: Patient; showYoga: boolean }) {
  const { has } = useRole();
  const { plans } = useNutrition();
  const plan = Object.values(plans)
    .filter((p) => p.patientId === patient.id && p.status !== "superseded")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const yoga = useYogaProgress(patient.id);
  return (
    <Group>
      <GroupHeader icon={<UsersThree />} title="Nutrition and yoga" subtitle="Where the rest of the care team is" />
      <div className={cn("grid grid-cols-1 gap-2", showYoga && has("classes") && "@[640px]:grid-cols-2")}>
        <Link href={sectionHref(patient.id, "nutrition")} className="group rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
          <span className="flex items-center gap-2 text-sm text-ink">
            <BowlFood size={18} className="text-ink-2" aria-hidden="true" />
            Nutrition
            <ArrowRight size={14} className="ml-auto text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          {plan ? (
            <>
              <span className="mt-3 block text-sm text-ink">{plan.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <StatusBadge tone={plan.status === "published" ? "success" : plan.status === "draft" ? "draft" : "warning"}>
                  v{plan.version} · {PLAN_STATUS_LABEL[plan.status]}
                </StatusBadge>
                {fmtDay(plan.updatedAt)} · {staffById(plan.authorId)?.name}
              </span>
            </>
          ) : (
            <span className="mt-3 block text-sm text-muted">{patient.careTeam.nutritionist ? "No plan yet — the nutritionist starts with an assessment." : "No nutritionist on the care team."}</span>
          )}
        </Link>
        {showYoga && has("classes") ? (
          <Link href={sectionHref(patient.id, "yoga")} className="group rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
            <span className="flex items-center gap-2 text-sm text-ink">
              <PersonSimpleTaiChi size={18} className="text-ink-2" aria-hidden="true" />
              Yoga
              <ArrowRight size={14} className="ml-auto text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            {yoga.sessions ? (
              <>
                <span className="mt-3 block text-sm text-ink">
                  {yoga.attended} of {yoga.marked} sessions attended
                </span>
                <span className="mt-1 block line-clamp-2 text-xs text-muted">{yoga.lastNote ? `${fmtDay(yoga.lastNote.at)}: ${yoga.lastNote.text}` : "No progress notes yet."}</span>
              </>
            ) : (
              <span className="mt-3 block text-sm text-muted">{patient.careTeam.yoga ? "No sessions yet." : "No yoga instructor on the care team."}</span>
            )}
          </Link>
        ) : null}
      </div>
    </Group>
  );
}

function FollowUpGroup({ patient }: { patient: Patient }) {
  const f = nextFollowUp(patient);
  const today = f ? formatDate(f.at) === formatDate(TODAY.toISOString()) : false;
  return (
    <Group>
      <GroupHeader icon={<CalendarBlank />} title="Next follow-up" />
      <Inset>
        {f ? (
          <>
            <p className="text-lg font-light tracking-[-0.01em] text-ink">
              {today ? "Today" : formatDate(f.at, { weekday: "short", day: "numeric", month: "short" })}, {formatTime(f.at)}
            </p>
            <p className="mt-1 text-sm text-ink-2">{f.label}</p>
            <p className="mt-1 text-xs text-muted">
              {f.withId ? staffById(f.withId)?.name : "With the care team"}
              {f.room ? ` · ${f.room}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">No follow-up set. The doctor sets the next review date when signing the consultation note.</p>
        )}
      </Inset>
    </Group>
  );
}

function assignmentBadge(a: AssignmentView): { tone: Tone; text: string } {
  if (a.state === "seen") return { tone: "success", text: "Seen" };
  if (a.overdue) return { tone: "danger", text: "Not seen in 48 h" };
  return { tone: "warning", text: "Assigned · not seen yet" };
}

function CareTeamGroup({ patient, onAssign }: { patient: Patient; onAssign?: (d: "nutrition" | "yoga") => void }) {
  const { has } = useRole();
  const local = useProfileStore((s) => s.assignments);
  const assignments = useMemo(() => assignmentsOf(patient.id, local), [patient.id, local]);
  const team = careTeamOf(patient, assignments, has);
  return (
    <Group>
      <GroupHeader icon={<UsersThree />} title="Care team" subtitle={onAssign ? "Assign to nutrition or yoga: assigned → seen" : undefined} />
      <ul className="flex flex-col gap-2">
        {team.map((m) => (
          <TeamRow key={m.key} member={m} onAssign={onAssign} />
        ))}
      </ul>
      {onAssign ? (
        <div className="p-2 pt-4">
          <Button variant="secondary" className="w-full" leading={<ArrowsLeftRight />} onClick={() => onAssign(patient.careTeam.nutritionist ? "yoga" : "nutrition")}>
            Assign to nutrition or yoga
          </Button>
        </div>
      ) : null}
    </Group>
  );
}

function TeamRow({ member, onAssign }: { member: TeamMember; onAssign?: (d: "nutrition" | "yoga") => void }) {
  const { has } = useRole();
  const s = staffById(member.staffId);
  const badge = member.assignment ? assignmentBadge(member.assignment) : null;
  const assignable = member.key === "nutritionist" || member.key === "yoga";
  return (
    <li className="flex items-center gap-3 rounded-inner bg-surface p-3">
      {s ? <Avatar src={s.avatar} name={s.name} size="sm" /> : <span className="size-8 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", s ? "text-ink" : "text-muted")}>{s?.name ?? "Not assigned"}</span>
        <span className="block truncate text-xs text-muted">
          {TEAM_LABEL[member.key]}
          {s?.status === "on-leave" ? ` · ${s.workingHours}` : ""}
        </span>
        {badge ? (
          <StatusBadge tone={badge.tone} className="mt-1">
            {badge.text}
          </StatusBadge>
        ) : null}
      </span>
      {!s && assignable && onAssign ? (
        <Button size="sm" variant="ghost" onClick={() => onAssign(member.key === "nutritionist" ? "nutrition" : "yoga")}>
          Assign
        </Button>
      ) : null}
      {s && has("messages") ? (
        <Tip label={`Message ${s.name}`}>
          <Link href="/messages" aria-label={`Message ${s.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
            <ChatCircleDots size={16} />
          </Link>
        </Tip>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ coordinator */

/** Care coordinator (Pro): status of assignments, follow-ups and attendance — clinical detail only where granted. */
function StatusSummary({ patient }: { patient: Patient }) {
  const { has } = useRole();
  const local = useProfileStore((s) => s.assignments);
  const assignments = useMemo(() => assignmentsOf(patient.id, local), [patient.id, local]);
  const team = careTeamOf(patient, assignments, has);
  const yoga = useYogaProgress(patient.id);
  const f = nextFollowUp(patient);
  const unseen = assignments.filter((a) => a.state === "assigned");
  return (
    <ProfileFrame
      patient={patient}
      title="Summary"
      description="Status of assignments, follow-ups and attendance. Diagnoses, notes and results are shown to the care team only — a doctor can grant you access to this patient."
    >
      <Group className="grid grid-cols-1 gap-2 @[880px]:grid-cols-3">
        <Inset>
          <InsetHeading icon={<CalendarBlank />} title="Next follow-up" />
          <p className="mt-3 text-sm text-ink">{f ? `${formatDate(f.at) === formatDate(TODAY.toISOString()) ? "Today" : formatDate(f.at, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(f.at)}` : "None booked"}</p>
          <p className="text-xs text-muted">{f ? `${f.label}${f.withId ? ` · ${staffById(f.withId)?.name}` : ""}` : "Nothing scheduled after today."}</p>
        </Inset>
        <Inset>
          <InsetHeading icon={<ArrowsLeftRight />} title="Assignments" count={assignments.length} />
          <p className="mt-3 text-sm text-ink">{unseen.length ? `${unseen.length} not seen yet` : assignments.length ? "All seen" : "None"}</p>
          <p className="text-xs text-muted">{unseen.some((a) => a.overdue) ? "One is past 48 hours — back with the doctor." : "Assigned → seen when the recipient opens it."}</p>
        </Inset>
        <Inset>
          <InsetHeading icon={<PersonSimpleTaiChi />} title="Attendance" />
          <p className="mt-3 text-sm text-ink">{yoga.marked ? `${yoga.attended} of ${yoga.marked} sessions` : "No sessions marked"}</p>
          <p className="text-xs text-muted">{yoga.missed ? `${yoga.missed} missed` : "No missed sessions on record."}</p>
        </Inset>
      </Group>
      <div className="grid grid-cols-1 items-start gap-6 @[960px]:grid-cols-2">
        <Group>
          <GroupHeader icon={<UsersThree />} title="Care team" />
          <ul className="flex flex-col gap-2">
            {team.map((m) => (
              <TeamRow key={m.key} member={m} />
            ))}
          </ul>
        </Group>
        <Group>
          <GroupHeader icon={<ArrowsLeftRight />} title="Assignment history" subtitle="Assigned → seen" />
          {assignments.length === 0 ? (
            <Inset>
              <p className="text-sm text-muted">No assignments for this patient.</p>
            </Inset>
          ) : (
            <ul className="flex flex-col gap-2">
              {assignments.map((a) => {
                const b = assignmentBadge(a);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-inner bg-surface p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">
                        {a.discipline === "nutrition" ? "Nutrition" : "Yoga"} · {staffById(a.toId)?.name}
                      </span>
                      <span className="block text-xs text-muted">
                        From {staffById(a.fromId)?.name} · {fmtDay(a.at)}
                      </span>
                    </span>
                    <StatusBadge tone={b.tone}>{b.text}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Group>
      </div>
    </ProfileFrame>
  );
}

/* ------------------------------------------------------------------ front office */

/** Admin and Reception: demographics only (fix 2) — name, IDs, contact, emergency contact, consent, care team names. */
function DemographicsProfile({ patient }: { patient: Patient }) {
  const { role, has } = useRole();
  const d = demographicsOf(patient);
  const keys: TeamKey[] = ["doctor", "nutritionist", "yoga", ...(has("coordinator") ? (["coordinator"] as TeamKey[]) : [])];
  const team = keys.map((k) => ({ key: k, s: staffById(patient.careTeam[k]) }));
  return (
    <ProfileFrame
      patient={patient}
      title="Profile"
      description={`Demographics, consent and the care team. Clinical content isn't shown to ${role === "admin" ? "Admin" : "Reception"} — documents are listed by file name and type.`}
      actions={
        role === "frontdesk" && has("calendar") ? (
          <Button asChild variant="primary" leading={<CalendarPlus />}>
            <Link href="/schedule?new=1">Book appointment</Link>
          </Button>
        ) : (
          <Button asChild variant="primary" leading={<UploadSimple />}>
            <Link href={`${sectionHref(patient.id, "reports")}?upload=1`}>Upload document</Link>
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 @[880px]:grid-cols-2">
        <Group>
          <GroupHeader icon={<IdentificationCard />} title="Identity" />
          <dl className="grid grid-cols-1 gap-2 @[480px]:grid-cols-2">
            <Fact label="Name" value={patient.name} />
            <Fact label="Age · sex" value={`${patient.age} years · ${patient.sex}`} />
            <Fact label="Clinic ID" value={<span className="font-mono text-xs">{clinicNumber(patient.id)}</span>} />
            <Fact
              label="ABHA"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  {patient.abhaLinked ? "Recorded" : "Not given"}
                  <AddOnBadge addOn="abdm" />
                </span>
              }
              hint="Stored separately from the clinic ID. Sharing records through ABDM is an add-on."
            />
            <Fact label="Registered" value={fmtDate(patient.registeredAt)} />
            <Fact label="Branch" value={d.branch} />
          </dl>
        </Group>
        <Group>
          <GroupHeader icon={<ChatCircleDots />} title="Contact" />
          <dl className="grid grid-cols-1 gap-2 @[480px]:grid-cols-2">
            <Fact label="Phone" value={patient.phone} />
            <Fact label="Area" value={patient.area} />
            <Fact
              label="Emergency contact"
              className="@[480px]:col-span-2"
              value={d.emergency ? `${d.emergency.name} (${d.emergency.relation.toLowerCase()}) · ${d.emergency.phone}` : <span className="text-warning">Not recorded — add it at the next visit</span>}
            />
          </dl>
        </Group>
        <Group>
          <GroupHeader icon={<ShieldCheck />} title="Consent" />
          <Inset>
            <p className="text-sm text-ink">DPDP consent recorded {fmtDate(d.consent.at)}</p>
            <p className="mt-1 text-xs text-muted">Recorded by {staffById(d.consent.by)?.name} at registration · keeping this record for the patient&apos;s care</p>
            {d.consent.guardianPending ? <p className="mt-2 text-xs text-warning">Guardian consent still to be confirmed at the desk.</p> : null}
            {!patient.intakeComplete ? <p className="mt-2 text-xs text-warning">Intake form isn&apos;t complete.</p> : null}
          </Inset>
        </Group>
        <Group>
          <GroupHeader icon={<UsersThree />} title="Care team" />
          <ul className="flex flex-col gap-2">
            {team.map(({ key, s }) => (
              <li key={key} className="flex items-center gap-3 rounded-inner bg-surface p-3">
                {s ? <Avatar src={s.avatar} name={s.name} size="sm" /> : <span className="size-8 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", s ? "text-ink" : "text-muted")}>{s?.name ?? "Not assigned"}</span>
                  <span className="block text-xs text-muted">{TEAM_LABEL[key]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Group>
      </div>
    </ProfileFrame>
  );
}

function Fact({ label, value, hint, className }: { label: string; value: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-inner bg-surface p-4", className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
