"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUpRight, CheckCircle, Clock, Flag, Hourglass, NotePencil, Package, Play, ShieldCheck, ShieldWarning, Stop, UsersThree, Warning } from "@phosphor-icons/react";
import type { AttendanceState, YogaClass } from "@/data/types";
import { PACKAGES } from "@/data/programs";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop, spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { FlagToDoctorModal } from "@/features/tasks/flag-modal";
import { isFlagTask } from "@/features/tasks/flags";
import { createTask, useTasks, type CareTask } from "@/features/tasks/store";
import { NOW_ISO, TODAY_KEY as TASKS_TODAY, isoAt } from "@/features/tasks/time";
import { CLEARANCES } from "./data";
import {
  ATT_LABEL,
  MARKABLE,
  absenceOwner,
  allClasses,
  approvalFor,
  currentMark,
  endOf,
  isFlagged,
  isReleased,
  key,
  openIssues,
  phaseOf,
  planFor,
  precautionText,
  recurrence,
  repeatedAbsence,
  savedMark,
  type ClassesState,
} from "./model";
import { attendanceCounts, markedSessions, sessionLabel } from "./insight";
import { AttendanceChart, SeatDots, WeekStrip } from "./viz";
import { classActions, useClasses } from "./store";
import { ClearanceReview } from "./clearance-review";
import { ProgressNoteSheet, progressSummary } from "./progress-note-sheet";
import { SessionPlanCard } from "./session-plan";
import { sessionContext, usePrecautionDecision } from "./use-precaution-decision";

/**
 * /classes/[id] — one session (spec F7): read and acknowledge changed precautions (start stays
 * locked until then), mark attendance present / late / absent, write progress notes and flag a
 * concern to the doctor (F8). Precautions only, never diagnoses (rule 3). Capacity, the waitlist
 * and package credits appear only on plans that include them (rule 7).
 */
type Enrolment = YogaClass["enrolled"][number];

const ATT_TONE: Record<AttendanceState, Tone> = { present: "success", late: "warning", absent: "danger", cancelled: "neutral", rescheduled: "info", pending: "draft" };
const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const shortDay = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

export function ClassRoster({ cls }: { cls: YogaClass }) {
  const s = useClasses();
  const { role, user, has, plan: planId } = useRole();
  const { toast } = useToast();
  const decide = usePrecautionDecision();
  const tasks = useTasks();
  const canRun = role === "yoga";
  /** precautions and progress notes are for the care team (instructor, doctor) — not front office or coordination */
  const clinical = role === "yoga" || role === "doctor";
  const scheduling = has("group-classes");
  const waitlistOn = has("waitlist");
  const packagesOn = has("packages");
  const follower = absenceOwner(planId);

  const [review, setReview] = useState<Enrolment | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [flagFor, setFlagFor] = useState<string | null | undefined>(undefined);

  const inst = staffById(cls.instructorId);
  const phase = phaseOf(s, cls);
  const issues = openIssues(s, cls);
  const blocked = phase === "upcoming" && issues.length > 0;
  const draft = s.drafts[cls.id] ?? {};
  const dirty = Object.keys(draft).length > 0;
  const plan = planFor(s, cls);
  const end = endOf(cls);
  const repeat = scheduling ? recurrence(s, cls) : null;
  const context = sessionContext(cls);
  const canMark = canRun && phase !== "upcoming";

  const marks = cls.enrolled.map((e) => currentMark(s, cls, e));
  const counts = MARKABLE.reduce<Record<string, number>>((acc, st) => ({ ...acc, [st]: marks.filter((m) => m.state === st).length }), {});
  const unmarked = marks.filter((m) => m.state === "pending").length;
  const spotOpen = cls.enrolled.length < cls.capacity || marks.some((m) => isReleased(m.state));

  const ids = useMemo(() => new Set(cls.enrolled.map((e) => e.patientId)), [cls]);
  const flags = useMemo(() => tasks.filter((t) => isFlagTask(t) && t.patientId && ids.has(t.patientId) && (role === "yoga" ? t.createdBy === user.id : true)), [tasks, ids, role, user.id]);

  const saveAttendance = () => {
    classActions.save(cls.id, NOW_ISO);
    toast({ title: "Attendance saved", description: `Saved in this browser session.${packagesOn ? " Package credits aren't deducted in this demo." : ""}`, tone: "success" });
  };

  const startButton =
    phase === "upcoming" ? (
      <Button
        variant="primary"
        leading={<Play weight="fill" />}
        disabled={blocked}
        onClick={() => {
          classActions.start(cls.id, user.id, NOW_ISO);
          toast({ title: "Session started", description: `Recorded at ${formatTime(NOW_ISO)} in this browser session. Mark attendance as people arrive.`, tone: "success" });
        }}
      >
        Start session
      </Button>
    ) : phase === "in-progress" ? (
      <Button
        variant="dark"
        leading={<Stop weight="fill" />}
        onClick={() => {
          if (unmarked) {
            toast({ title: `Mark attendance for ${pluralize(unmarked, "participant")} first`, description: "Everyone needs present, late or absent before the session can end.", tone: "warning" });
            return;
          }
          if (dirty) classActions.save(cls.id, NOW_ISO);
          classActions.end(cls.id, NOW_ISO);
          toast({ title: "Session ended", description: "Attendance saved in this browser session. Add progress notes where you agreed them.", tone: "success" });
        }}
      >
        End session
      </Button>
    ) : (
      <StatusBadge tone="neutral">Ended {formatTime(s.sessions[cls.id]?.endedAt ?? end.toISOString())}</StatusBadge>
    );

  const routeAbsence = (e: Enrolment, list: { date: string }[]) => {
    if (!follower) return;
    const p = patientById(e.patientId);
    classActions.route(e.patientId, follower.id, user.id, NOW_ISO);
    createTask(
      {
        title: `Repeated absence: ${p?.name ?? "patient"} — ${list.length} missed sessions`,
        patientId: e.patientId,
        ownerId: follower.id,
        due: isoAt(TASKS_TODAY, "17:00"),
        priority: "high",
        source: `Repeated absence · from ${user.name}`,
        discipline: "operations",
      },
      user.id,
    );
    toast({
      title: `Sent to ${staffById(follower.id)?.name}`,
      description: `${pluralize(list.length, "absence")} since ${shortDay(list[0].date)} — it's in their pending list to call ${p?.name.split(" ")[0]}. Saved in this browser session; nothing was sent to the patient.`,
      tone: "success",
    });
  };

  return (
    <div className="@container flex flex-col gap-6">
      <Link href="/classes" className="inline-flex items-center gap-2 self-start rounded-full text-sm text-muted transition-colors hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Sessions
      </Link>

      <PageHeader
        eyebrow={`${cls.kind === "group" ? "Group session" : "1:1 session"} · ${formatDate(cls.start, { weekday: "long", day: "numeric", month: "long" })}${repeat ? ` · ${repeat}` : ""}`}
        title={cls.title}
        description={`${formatTime(cls.start)}–${formatTime(end.toISOString())} · ${cls.room}${cls.focus ? ` · ${cls.focus}` : ""}`}
        actions={
          canRun ? (
            <>
              <Button variant="secondary" leading={<Flag />} onClick={() => setFlagFor(null)}>
                Flag to doctor
              </Button>
              {blocked ? (
                <Tip label={`Acknowledge ${pluralize(issues.length, "changed precaution")} first`}>
                  <span tabIndex={0} className="rounded-full">
                    {startButton}
                  </span>
                </Tip>
              ) : (
                startButton
              )}
            </>
          ) : phase === "ended" ? (
            startButton
          ) : (
            <StatusBadge tone={phase === "in-progress" ? "success" : "neutral"}>{phase === "in-progress" ? "In progress" : `Starts ${relativeTime(cls.start)}`}</StatusBadge>
          )
        }
      />

      <Group aria-label="Session status" className="grid grid-cols-2 gap-2 @[880px]:grid-cols-4">
        <Inset className="flex flex-col justify-between gap-1">
          <span className="text-xs text-muted">Session</span>
          <span className="flex items-center gap-2 text-sm text-ink">
            {phase === "in-progress" ? (
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-success" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
            ) : (
              <Clock size={16} className="shrink-0 text-muted" aria-hidden="true" />
            )}
            {phase === "upcoming" ? `Starts ${relativeTime(cls.start)}` : phase === "in-progress" ? `In progress since ${formatTime(s.sessions[cls.id]?.startedAt ?? cls.start)}` : `Ended ${formatTime(s.sessions[cls.id]?.endedAt ?? end.toISOString())}`}
          </span>
        </Inset>
        <Inset className="flex flex-col justify-between gap-1">
          <span className="text-xs text-muted">Instructor</span>
          <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
            <Avatar src={inst?.avatar} name={inst?.name ?? "Instructor"} size="xs" />
            <span className="truncate">
              {inst?.name}
              {inst?.id === user.id ? " (you)" : ""}
            </span>
          </span>
        </Inset>
        <Inset className="flex flex-col justify-between gap-1">
          {scheduling && cls.kind === "group" ? (
            <>
              <span className="flex items-baseline justify-between gap-2 text-xs text-muted">
                Places
                <span className="tabular">
                  {cls.enrolled.length}/{cls.capacity}
                  {waitlistOn && cls.waitlist.length ? ` · +${cls.waitlist.length} waiting` : ""}
                </span>
              </span>
              <SeatDots cls={cls} s={s} draft waitlist={waitlistOn} size="md" className="mt-2" />
            </>
          ) : (
            <>
              <span className="text-xs text-muted">Patients</span>
              <span className="text-sm text-ink tabular">{cls.enrolled.length}</span>
            </>
          )}
        </Inset>
        <Inset className="flex flex-col justify-between gap-1">
          <span className="text-xs text-muted">Attendance</span>
          <span className="text-sm text-ink tabular">
            {cls.enrolled.length - unmarked} of {cls.enrolled.length} marked
            {dirty ? <span className="text-warning"> · unsaved</span> : s.savedAt[cls.id] ? <span className="text-muted"> · saved</span> : null}
          </span>
        </Inset>
      </Group>

      <AnimatePresence initial={false}>
        {blocked && clinical ? (
          <motion.div key="blocked" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
            <div role="status" className="flex flex-col gap-3 rounded-inner bg-warning-soft p-4 sm:flex-row sm:items-center">
              <ShieldWarning size={20} weight="fill" className="shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  Start is locked until {issues.length === 1 ? "this precaution is" : `these ${issues.length} precautions are`} acknowledged
                </p>
                <p className="mt-0.5 text-xs text-ink-2">The doctor changed {issues.length === 1 ? "it" : "them"} since you last read {issues.length === 1 ? "it" : "them"}. Read each one and acknowledge it — then you can start.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {issues.map((e) => (
                  <Button key={e.patientId} size="sm" variant={canRun ? "dark" : "secondary"} disabled={!canRun} onClick={() => setReview(e)}>
                    {patientById(e.patientId)?.name.split(" ")[0]} · {e.clearance === "expired" ? "review" : "acknowledge"}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Group aria-label="Patients">
            <GroupHeader
              icon={<UsersThree />}
              title="Patients"
              subtitle={phase === "upcoming" && canRun ? "Mark attendance once the session starts" : `${pluralize(cls.enrolled.length, "patient")} · present, late or absent`}
            />
            <ul className="flex flex-col gap-2">
              {cls.enrolled.map((e) => (
                <ParticipantRow
                  key={e.patientId}
                  cls={cls}
                  e={e}
                  s={s}
                  canRun={canRun}
                  canMark={canMark}
                  clinical={clinical}
                  packagesOn={packagesOn}
                  follower={follower}
                  isCoordinator={role === "coordinator"}
                  onReview={() => setReview(e)}
                  onNote={() => setNoteFor(e.patientId)}
                  onFlag={() => setFlagFor(e.patientId)}
                  onMark={(state, reason) => classActions.setDraft(cls.id, e.patientId, { state, reason })}
                  onRoute={(list) => routeAbsence(e, list)}
                />
              ))}
            </ul>

            {waitlistOn && cls.waitlist.length ? (
              <div className="mt-2 rounded-inner bg-surface p-4">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Hourglass size={14} aria-hidden="true" /> Waiting for a place
                </p>
                <ul className="mt-3 flex flex-col gap-3">
                  {cls.waitlist.map((pid) => {
                    const p = patientById(pid);
                    const offered = s.offers[key(cls.id, pid)];
                    return (
                      <li key={pid} className="flex flex-wrap items-center gap-3">
                        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{p?.name}</span>
                        {offered ? (
                          <StatusBadge tone="info">Place offered · {formatTime(offered.at)}</StatusBadge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!spotOpen || !canRun}
                            onClick={() => {
                              classActions.offer(cls.id, pid, user.id, NOW_ISO);
                              toast({ title: `Place offer recorded for ${p?.name}`, description: "Call them to confirm — nothing is sent from here. Saved in this browser session." });
                            }}
                          >
                            Offer place
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted">{spotOpen ? "A place is free. Call them to offer it — nothing is sent from here." : "Full — a place opens when someone cancels or is held from this session."}</p>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {dirty && canRun ? (
                <motion.div
                  key="savebar"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
                  transition={pop}
                  className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-charcoal py-3 pl-4 pr-3 text-sm text-white"
                >
                  <span>
                    Unsaved · {MARKABLE.filter((st) => counts[st]).map((st) => `${counts[st]} ${ATT_LABEL[st].toLowerCase()}`).join(" · ")}
                    {unmarked ? ` · ${unmarked} not marked` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="glass" onClick={() => classActions.discard(cls.id)}>
                      Discard
                    </Button>
                    <Button size="sm" variant="secondary" onClick={saveAttendance}>
                      Save attendance
                    </Button>
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Group>
        </div>

        <aside aria-label="Session details" className="scrollbar-thin flex min-w-0 flex-col gap-4 @[1040px]:sticky @[1040px]:top-20 @[1040px]:max-h-[calc(100dvh-96px)] @[1040px]:self-start @[1040px]:overflow-y-auto">
          {clinical ? <FlagsCard flags={flags} canRaise={canRun} onRaise={() => setFlagFor(null)} mine={role === "yoga"} /> : null}
          <SessionPlanCard
            cls={cls}
            plan={plan}
            editable={canRun}
            onSave={(next) => {
              classActions.updatePlan(cls.id, next);
              toast({ title: "Session plan saved", description: "Saved in this browser session for this session." });
            }}
          />
          <SeriesAttendance cls={cls} s={s} showCapacity={scheduling} />
          {packagesOn ? <PackageCredits cls={cls} /> : null}
        </aside>
      </div>

      <ClearanceReview target={review} cls={cls} onClose={() => setReview(null)} onDecide={(e, d) => {
        setReview(null);
        decide(cls, e, d, issues.filter((x) => x.patientId !== e.patientId).length);
      }} />
      <ProgressNoteSheet
        patientId={noteFor}
        cls={cls}
        history={s.notes}
        canWrite={canRun}
        onClose={() => setNoteFor(null)}
        onSave={(input) => {
          if (!noteFor) return;
          classActions.addNote({ id: newId("pn"), patientId: noteFor, classTitle: cls.title, at: NOW_ISO, by: user.id, ...input });
          const name = patientById(noteFor)?.name;
          setNoteFor(null);
          toast({ title: `Progress note saved for ${name}`, description: "On their timeline for the care team. Saved in this browser session.", tone: "success" });
        }}
      />
      <FlagToDoctorModal
        open={flagFor !== undefined}
        onOpenChange={(v) => !v && setFlagFor(undefined)}
        patients={cls.enrolled.map((e) => ({ id: e.patientId, hint: precautionText(e.precaution) ? `Precaution: ${precautionText(e.precaution)}` : "No session precautions" }))}
        defaultPatientId={flagFor ?? (cls.enrolled.length === 1 ? cls.enrolled[0].patientId : null)}
        context={context}
      />
    </div>
  );
}

function ParticipantRow({
  cls,
  e,
  s,
  canRun,
  canMark,
  clinical,
  packagesOn,
  follower,
  isCoordinator,
  onReview,
  onNote,
  onFlag,
  onMark,
  onRoute,
}: {
  cls: YogaClass;
  e: Enrolment;
  s: ClassesState;
  canRun: boolean;
  canMark: boolean;
  clinical: boolean;
  packagesOn: boolean;
  follower: { id: string; label: string } | null;
  isCoordinator: boolean;
  onReview: () => void;
  onNote: () => void;
  onFlag: () => void;
  onMark: (state: AttendanceState, reason: string) => void;
  onRoute: (list: { date: string; title: string }[]) => void;
}) {
  const patient = patientById(e.patientId);
  const first = patient?.name.split(" ")[0] ?? "Patient";
  const mark = currentMark(s, cls, e);
  const saved = savedMark(s, cls, e);
  const changed = mark.state !== saved.state || mark.reason !== saved.reason;
  const approval = approvalFor(e);
  const approver = staffById(approval?.by);
  const covered = staffById(approval?.coveringFor);
  const expiredOn = e.clearance === "expired" ? CLEARANCES[e.patientId]?.validUntil : null;
  const ack = s.acks[e.patientId];
  const hold = s.holds[key(cls.id, e.patientId)];
  const flagged = isFlagged(e);
  const unresolved = flagged && !ack && !hold;
  const released = isReleased(mark.state);
  const repeat = mark.state === "absent" ? repeatedAbsence(s, e.patientId, cls.start) : null;
  const routed = s.routed[e.patientId];
  const pkg = PACKAGES.find((x) => x.patientId === e.patientId);
  const rule = precautionText(e.precaution);
  const notes = s.notes.filter((o) => o.patientId === e.patientId);
  const lastNote = notes[0];

  return (
    <li id={`p-${e.patientId}`} className="scroll-mt-32">
      <div className={cn("rounded-inner bg-surface p-4 transition-shadow duration-300", unresolved && clinical && "shadow-[inset_0_0_0_1.5px_var(--color-warning)]")}>
        <div className="flex items-center gap-3">
          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
          <div className="min-w-0 flex-1">
            <Link href={`/patients/${e.patientId}`} className="block truncate text-sm text-ink hover:underline hover:underline-offset-4">
              {patient?.name}
            </Link>
            {packagesOn && pkg ? (
              <p className={cn("flex items-center gap-1.5 text-xs tabular", pkg.total - pkg.used <= 2 ? "text-warning" : "text-muted")}>
                <Package size={12} aria-hidden="true" /> {pkg.total - pkg.used} of {pkg.total} sessions left
              </p>
            ) : clinical && lastNote ? (
              <p className="truncate text-xs text-muted">
                Last note {shortDay(lastNote.at)} · {progressSummary(lastNote)}
              </p>
            ) : null}
          </div>
          {clinical ? (
            <IconButton label={`Progress note for ${first}${notes.length ? ` (${notes.length} earlier)` : ""}`} tooltip="left" variant="soft" onClick={onNote}>
              <NotePencil />
            </IconButton>
          ) : null}
        </div>

        {clinical ? (
          !rule && !flagged ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
              No session precautions{approver ? ` · cleared by ${approver.name}, ${shortDay(approval!.at)}` : ""}
            </p>
          ) : (
            <div className={cn("-mx-2 mt-3 flex flex-col gap-3 rounded-[8px] p-3 sm:flex-row sm:items-start", unresolved ? "bg-warning-soft" : "bg-canvas")}>
              {unresolved ? <ShieldWarning size={18} weight="fill" className="mt-0.5 hidden shrink-0 text-warning sm:block" aria-hidden="true" /> : <ShieldCheck size={18} className="mt-0.5 hidden shrink-0 text-ink-2 sm:block" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                {unresolved ? <p className="text-xs text-ink-2">{e.clearance === "expired" ? "Precaution approval expired — review before the session" : "Precaution changed — read and acknowledge"}</p> : null}
                <p className="text-sm text-ink">{rule ?? "No precaution text on record"}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {approver ? `${unresolved && e.clearance === "changed" ? "Changed" : "Approved"} by ${approver.name}${covered ? `, covering for ${covered.name}` : ""} · ${shortDay(approval!.at)}` : "Approval not on record"}
                  {expiredOn ? ` · expired ${shortDay(`${expiredOn}T23:59:00+05:30`)}` : ""}
                </p>
                {ack ? (
                  <p className="mt-1 text-xs text-success">
                    Acknowledged by {staffById(ack.by)?.name} · {shortDay(ack.at)} {formatTime(ack.at)}
                    {ack.note ? ` · “${ack.note}”` : ""}
                  </p>
                ) : null}
                {hold ? <p className="mt-1 text-xs text-ink-2">Held from this session by {staffById(hold.by)?.name} · {formatTime(hold.at)}</p> : null}
              </div>
              {unresolved && canRun ? (
                <Button size="sm" variant="dark" className="self-start" onClick={onReview}>
                  {e.clearance === "expired" ? "Review" : "Acknowledge"}
                </Button>
              ) : null}
            </div>
          )
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full text-xs text-muted sm:w-auto sm:pr-1">Attendance</span>
            {canMark && !released ? (
              <>
                <div className="hidden sm:block">
                  <Segmented<AttendanceState>
                    ariaLabel={`Attendance for ${patient?.name}`}
                    size="sm"
                    variant="tray"
                    value={mark.state}
                    onChange={(st) => onMark(st, st === "present" ? "" : mark.reason)}
                    items={MARKABLE.map((st) => ({ value: st, label: ATT_LABEL[st] }))}
                  />
                </div>
                <Select
                  className="w-full sm:hidden"
                  ariaLabel={`Attendance for ${patient?.name}`}
                  value={mark.state}
                  onValueChange={(v) => onMark(v as AttendanceState, v === "present" ? "" : mark.reason)}
                  options={(["pending", ...MARKABLE] as AttendanceState[]).map((st) => ({ value: st, label: ATT_LABEL[st] }))}
                />
              </>
            ) : (
              <StatusBadge tone={ATT_TONE[mark.state]}>{ATT_LABEL[mark.state]}</StatusBadge>
            )}
            {changed ? <span className="text-xs text-warning">Unsaved</span> : null}
            <WeekStrip s={s} patientId={e.patientId} currentId={cls.id} className="w-full sm:ml-auto sm:w-auto" />
          </div>
          <AnimatePresence initial={false}>
            {canMark && !released && (mark.state === "late" || mark.state === "absent") ? (
              <motion.div key="reason" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                <label htmlFor={`reason-${cls.id}-${e.patientId}`} className="sr-only">
                  Note for {ATT_LABEL[mark.state].toLowerCase()}
                </label>
                <Input
                  id={`reason-${cls.id}-${e.patientId}`}
                  value={mark.reason}
                  onChange={(ev) => onMark(mark.state, ev.target.value)}
                  placeholder={mark.state === "absent" ? "Note (optional) — e.g. no call or message" : "Note (optional) — e.g. arrived 07:45"}
                  className="h-9"
                />
              </motion.div>
            ) : mark.reason ? (
              <p className="text-xs text-muted">Note: {mark.reason}</p>
            ) : null}
          </AnimatePresence>
        </div>

        {repeat ? (
          <div className="-mx-2 mt-3 flex flex-col gap-3 rounded-[8px] bg-danger-soft p-3 sm:flex-row sm:items-center">
            <Warning size={18} weight="fill" className="hidden shrink-0 text-danger sm:block" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm text-ink">
              {repeat.length} missed sessions since {shortDay(repeat[0].date)}
              <span className="block text-xs text-muted">{repeat.map((r) => shortDay(r.date)).join(" · ")} · repeated absence</span>
            </p>
            {routed ? (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle size={14} weight="fill" aria-hidden="true" /> With {staffById(routed.to)?.name} · {formatTime(routed.at)}
              </span>
            ) : canRun && follower ? (
              <Button size="sm" variant="dark" className="self-start" trailing={<ArrowUpRight />} onClick={() => onRoute(repeat)}>
                Send to {follower.label}
              </Button>
            ) : canRun ? (
              <Button size="sm" variant="dark" className="self-start" leading={<Flag />} onClick={onFlag}>
                Flag to doctor
              </Button>
            ) : isCoordinator ? (
              <Button asChild size="sm" variant="dark" className="self-start" trailing={<ArrowUpRight />}>
                <Link href="/tasks">Follow up in Tasks</Link>
              </Button>
            ) : (
              <span className="text-xs text-muted">The instructor follows this up</span>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Flags raised to the doctor about patients in this session (F8) — one owner each, with the reply. */
function FlagsCard({ flags, canRaise, onRaise, mine }: { flags: CareTask[]; canRaise: boolean; onRaise: () => void; mine: boolean }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Flags to doctor</h2>
          <p className="mt-1 text-xs text-muted">{mine ? "Raised by you about these patients" : "Raised about these patients"}</p>
        </div>
        <Flag size={20} className="shrink-0 text-ink-2" aria-hidden="true" />
      </div>
      {flags.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {flags.map((t) => {
            const owner = staffById(t.ownerId);
            const reply = t.flag?.response;
            const sameDay = t.flag ? t.flag.urgency === "same-day" : t.priority === "urgent" || t.priority === "high";
            return (
              <li key={t.id} className="rounded-inner bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink">{patientById(t.patientId)?.name}</span>
                  <StatusBadge tone={sameDay ? "warning" : "neutral"}>{sameDay ? "Same day" : "Routine"}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-ink-2">{t.notes ?? t.title}</p>
                {reply ? (
                  <p className="mt-2 rounded-inner bg-surface p-3 text-sm text-ink">
                    <span className="block text-xs text-muted">
                      {staffById(reply.by)?.name} replied · {shortDay(reply.at)} {formatTime(reply.at)}
                    </span>
                    {reply.text}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {t.status === "done" ? `Closed by ${owner?.name ?? "the doctor"}` : `Waiting for ${owner?.name ?? "the doctor"}${t.flag?.via ? ` (${t.flag.via})` : ""} · due ${shortDay(t.due)} ${formatTime(t.due)}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No flags yet.</p>
      )}
      {canRaise ? (
        <Button className="mt-4" size="sm" variant="secondary" leading={<Flag />} onClick={onRaise}>
          Flag to doctor
        </Button>
      ) : null}
    </Card>
  );
}

/** Saved attendance for every session of this series this week (same title and instructor). */
function SeriesAttendance({ cls, s, showCapacity }: { cls: YogaClass; s: ClassesState; showCapacity: boolean }) {
  const series = allClasses(s).filter((c) => c.title === cls.title && c.instructorId === cls.instructorId);
  const done = markedSessions(s, series);
  const only = done.length === 1 ? done[0] : null;
  const n = only ? attendanceCounts(s, only) : null;
  return (
    <Card>
      <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">{series.length > 1 ? "This session this week" : "Attendance"}</h2>
      <p className="mt-1 text-xs text-muted">
        {pluralize(series.length, "session")} of {cls.title} · {done.length} finished
      </p>
      {done.length >= 2 ? (
        <AttendanceChart s={s} classes={series} highlightId={cls.id} height={156} showCapacity={showCapacity} className="mt-4" emptyText="" />
      ) : only && n ? (
        <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          {sessionLabel(only)}: {n.present} present · {n.late} late · {n.absent} absent{n.released ? ` · ${n.released} cancelled or held` : ""}.
        </p>
      ) : (
        <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-muted">Nothing marked yet.</p>
      )}
    </Card>
  );
}

/** Clinic+ (F12): package credits for patients in this session. Package names stay with the front office. */
function PackageCredits({ cls }: { cls: YogaClass }) {
  const rows = cls.enrolled.flatMap((e) => {
    const pkg = PACKAGES.find((x) => x.patientId === e.patientId);
    return pkg ? [{ e, pkg }] : [];
  });
  return (
    <Card>
      <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Package credits</h2>
      <p className="mt-1 text-xs text-muted">One credit is used when attendance is marked · not deducted in this demo</p>
      {rows.length ? (
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map(({ e, pkg }) => {
            const left = pkg.total - pkg.used;
            const p = patientById(e.patientId);
            return (
              <li key={e.patientId}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink">{p?.name}</span>
                  <span className={cn("shrink-0 text-xs tabular", left <= 2 ? "text-warning" : "text-muted")}>
                    {left} of {pkg.total} left
                  </span>
                </div>
                <ProgressBar className="mt-2" value={pkg.used} max={pkg.total} tone={left <= 2 ? "warning" : "dark"} label={`${p?.name}: ${pkg.used} of ${pkg.total} sessions used`} />
                <p className="mt-1 text-xs text-muted">Expires {formatDate(`${pkg.expires}T12:00:00+05:30`, { day: "numeric", month: "short" })}{left <= 2 ? " · low balance — reception is alerted" : ""}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No patient in this session has a package.</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ logged sessions (this browser) */

const noop = () => () => {};

/** /classes/c-local-… — a session logged in this browser session; the server can't know it, so look it up here. */
export function LoggedClassRoster({ id }: { id: string }) {
  const s = useClasses();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const cls = s.created.find((c) => c.id === id);
  if (cls) return <ClassRoster cls={cls} />;
  if (!hydrated) return <div className="h-[60vh] animate-pulse rounded-card bg-sunken" aria-hidden="true" />;
  return (
    <Group>
      <EmptyState
        className="rounded-inner bg-surface"
        icon={<UsersThree />}
        title="Session not found"
        description="Logged sessions are kept in this browser session only — it may have been logged in another tab or browser."
        action={
          <Button asChild variant="dark">
            <Link href="/classes">Back to sessions</Link>
          </Button>
        }
      />
    </Group>
  );
}
