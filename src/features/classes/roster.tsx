"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUpRight, CheckCircle, Clock, FirstAid, Hourglass, ListChecks, NotePencil, Package, Play, ShieldCheck, ShieldWarning, Stop, UsersThree, Warning } from "@phosphor-icons/react";
import type { AttendanceState, YogaClass } from "@/data/types";
import { ATTENDANCE_LABEL, PACKAGES } from "@/data/programs";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { TASKS } from "@/data/care";
import { TODAY, formatDate, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop, spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader, ProgressBar } from "@/components/ui/misc";
import { OrganImage } from "@/components/viz/organ";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { CLEARANCES } from "./data";
import { NEEDS_REASON, WEEK_CLASSES, absenceOwner, currentMark, endOf, isFlagged, key, openIssues, phaseOf, planFor, repeatedAbsence, routeFor, savedMark, type ClassesState } from "./model";
import { attendanceCounts, markedSessions, participantOrgan, sessionLabel } from "./insight";
import { AttendanceChart, SeatDots, WeekStrip } from "./viz";
import { classActions, useClasses } from "./store";
import { ClearanceReview, type ClearanceDecision } from "./clearance-review";
import { ObservationSheet } from "./observation-sheet";
import { EscalateModal } from "./escalate-modal";
import { SessionPlanCard } from "./session-plan";

/**
 * /classes/[id] — the roster (doc §2D): individual attendance with reasons, approved precautions
 * with clearance state, start blocked until changed/expired clearances are reviewed, private
 * observations, escalation, package balances and repeated-absence routing.
 */
type Enrolment = YogaClass["enrolled"][number];

const MARKABLE: AttendanceState[] = ["present", "absent", "late", "cancelled", "rescheduled"];
const ATT_TONE: Record<AttendanceState, Tone> = { present: "success", late: "warning", absent: "danger", cancelled: "neutral", rescheduled: "info", pending: "draft" };

const nowIso = () => TODAY.toISOString(); // fixed demo clock (Fri 13 Nov 09:40 IST)
const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ClassRoster({ cls }: { cls: YogaClass }) {
  const s = useClasses();
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const canRun = role === "yoga";
  const hasCoordinator = has("coordinator");
  const hasPackages = has("packages");

  const [review, setReview] = useState<Enrolment | null>(null);
  const [observe, setObserve] = useState<string | null>(null);
  const [escalateFor, setEscalateFor] = useState<string | null | undefined>(undefined);
  const [missingReason, setMissingReason] = useState<string[]>([]);

  const inst = staffById(cls.instructorId);
  const phase = phaseOf(s, cls);
  const issues = openIssues(s, cls);
  const blocked = phase === "upcoming" && issues.length > 0;
  const draft = s.drafts[cls.id] ?? {};
  const dirty = Object.keys(draft).length > 0;
  const plan = planFor(s, cls);
  const end = endOf(cls);

  const marks = cls.enrolled.map((e) => currentMark(s, cls, e));
  const counts = MARKABLE.reduce<Record<string, number>>((acc, st) => ({ ...acc, [st]: marks.filter((m) => m.state === st).length }), {});
  const unmarked = marks.filter((m) => m.state === "pending").length;
  const spotOpen = cls.enrolled.some((e) => ["cancelled", "rescheduled"].includes(currentMark(s, cls, e).state));

  const escalations = s.escalations.filter((x) => x.classId === cls.id);
  const sharedTasks = useMemo(
    () => TASKS.filter((t) => t.patientId && cls.enrolled.some((e) => e.patientId === t.patientId) && t.status !== "done" && (staffById(t.createdBy)?.role === "yoga" || staffById(t.ownerId)?.role === "yoga")),
    [cls],
  );

  const saveAttendance = () => {
    const missing = classActions.save(cls.id, nowIso());
    setMissingReason(missing);
    if (missing.length) {
      toast({ title: `Add a reason for ${pluralize(missing.length, "participant")}`, description: "Absent, cancelled and rescheduled need a reason.", tone: "warning" });
      document.getElementById(`p-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    toast({ title: "Attendance saved", description: "Saved in this browser session — package balances aren't deducted in this demo.", tone: "success" });
    return true;
  };

  const decide = (e: Enrolment, d: ClearanceDecision) => {
    const patient = patientById(e.patientId);
    const decision = { kind: d.kind, note: d.note, by: user.id, at: nowIso() };
    if (d.kind === "acknowledged") classActions.acknowledge(e.patientId, decision);
    else classActions.hold(cls.id, e.patientId, decision);
    if (d.requestRenewal) {
      const route = routeFor(e.patientId, hasCoordinator);
      classActions.escalate({ id: newId("esc"), patientId: e.patientId, classId: cls.id, concern: `Clearance expired — please renew: “${e.precaution ?? "precautions"}”`, urgency: "today", ownerId: route.ownerId, routedVia: route.via, by: user.id, at: nowIso() });
    }
    setReview(null);
    const remaining = issues.filter((x) => x.patientId !== e.patientId).length;
    toast({
      title: d.kind === "acknowledged" ? `Acknowledged for ${patient?.name}` : `${patient?.name} held from this session`,
      description: `${d.requestRenewal ? "Renewal task created locally. " : ""}${remaining ? `${pluralize(remaining, "clearance")} still to review.` : "All clearances reviewed — the session can start."} Saved in this browser session.`,
      tone: remaining ? "neutral" : "success",
    });
  };

  const startButton =
    phase === "upcoming" ? (
      <Button
        variant="primary"
        leading={<Play weight="fill" />}
        disabled={blocked || !canRun}
        onClick={() => {
          classActions.start(cls.id, user.id, nowIso());
          toast({ title: "Session started", description: `Recorded at ${formatTime(nowIso())} in this browser session. Mark attendance as people arrive.`, tone: "success" });
        }}
      >
        Start session
      </Button>
    ) : phase === "in-progress" ? (
      <Button
        variant="dark"
        leading={<Stop weight="fill" />}
        disabled={!canRun}
        onClick={() => {
          if (unmarked) {
            toast({ title: `Mark attendance for ${pluralize(unmarked, "participant")} first`, description: "Every participant needs a state before the session can end.", tone: "warning" });
            return;
          }
          if (dirty && !saveAttendance()) return;
          classActions.end(cls.id, nowIso());
          toast({ title: "Session ended", description: "Attendance and timings saved in this browser session.", tone: "success" });
        }}
      >
        End session
      </Button>
    ) : (
      <StatusBadge tone="neutral">Ended {formatTime(s.sessions[cls.id]?.endedAt ?? end.toISOString())}</StatusBadge>
    );

  return (
    <div className="@container flex flex-col gap-6">
      <Link href="/classes" className="inline-flex items-center gap-2 self-start rounded-full text-sm text-muted transition-colors hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Classes this week
      </Link>

      <PageHeader
        eyebrow={`${cls.kind === "group" ? "Group class" : "One-to-one session"} · ${formatDate(cls.start, { weekday: "long", day: "numeric", month: "long" })}`}
        title={cls.title}
        description={`${formatTime(cls.start)}–${formatTime(end.toISOString())} · ${cls.room} · ${cls.focus}`}
        actions={
          <>
            {canRun ? (
              <Button variant="secondary" leading={<FirstAid />} onClick={() => setEscalateFor(null)}>
                Escalate to care team
              </Button>
            ) : null}
            {canRun ? (
              startButton
            ) : (
              <Tip label="Session controls are for instructors">
                <span tabIndex={0} className="rounded-full">{startButton}</span>
              </Tip>
            )}
          </>
        }
      />

      <Group aria-label="Session status" className="grid grid-cols-2 gap-2 @[880px]:grid-cols-4">
        <Inset className="flex flex-col justify-between gap-1">
          <span className="text-xs text-muted">Session</span>
          <span className="flex items-center gap-2 text-sm text-ink">
            {phase === "in-progress" ? <span className="relative flex size-2"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-success" /><span className="relative size-2 rounded-full bg-success" /></span> : <Clock size={16} className="text-muted" aria-hidden="true" />}
            {phase === "upcoming" ? `Starts ${relativeTime(cls.start)}` : phase === "in-progress" ? `In progress since ${formatTime(s.sessions[cls.id]?.startedAt ?? cls.start)}` : `Ended ${formatTime(s.sessions[cls.id]?.endedAt ?? end.toISOString())}`}
          </span>
        </Inset>
        <Inset className="flex flex-col justify-between gap-1">
          <span className="text-xs text-muted">Instructor</span>
          <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
            <Avatar src={inst?.avatar} name={inst?.name ?? "Instructor"} size="xs" />
            <span className="truncate">{inst?.name}{inst?.id === user.id ? " (you)" : ""}</span>
          </span>
        </Inset>
        <Inset className="flex flex-col justify-between gap-1">
          <span className="flex items-baseline justify-between text-xs text-muted">
            Places <span className="tabular">{cls.enrolled.length}/{cls.capacity}{cls.waitlist.length ? ` · +${cls.waitlist.length} waiting` : ""}</span>
          </span>
          <span className="flex flex-col gap-1">
            <SeatDots cls={cls} s={s} draft size="md" className="mt-2" />
            <span className="text-[11px] text-muted">One dot per place · colour once attendance is marked</span>
          </span>
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
        {blocked ? (
          <motion.div key="blocked" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-inner bg-warning-soft px-4 py-3 text-sm text-warning">
              <ShieldWarning size={18} weight="fill" className="shrink-0" aria-hidden="true" />
              <span className="text-ink">
                Start is blocked — {pluralize(issues.length, "participant")} {issues.length === 1 ? "has" : "have"} a changed or expired clearance. Review each one:
              </span>
              {issues.map((e) => (
                <button key={e.patientId} type="button" onClick={() => document.getElementById(`p-${e.patientId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="rounded-full bg-surface px-3 py-1 text-xs text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-canvas">
                  {patientById(e.patientId)?.name} · {e.clearance}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Group aria-label="Roster">
            <GroupHeader icon={<UsersThree />} title="Roster" subtitle={`${pluralize(cls.enrolled.length, "participant")} · attendance, precautions and notes are individual`} />
            <ul className="flex flex-col gap-2">
              {cls.enrolled.map((e) => (
                <ParticipantRow
                  key={e.patientId}
                  cls={cls}
                  e={e}
                  s={s}
                  canRun={canRun}
                  hasPackages={hasPackages}
                  hasCoordinator={hasCoordinator}
                  isCoordinator={role === "coordinator"}
                  missingReason={missingReason.includes(e.patientId)}
                  sharedTasks={sharedTasks.filter((t) => t.patientId === e.patientId)}
                  onReview={() => setReview(e)}
                  onObserve={() => setObserve(e.patientId)}
                  onMark={(state, reason) => {
                    classActions.setDraft(cls.id, e.patientId, { state, reason });
                    if (missingReason.includes(e.patientId) && reason.trim()) setMissingReason((xs) => xs.filter((x) => x !== e.patientId));
                  }}
                  onRoute={(list) => {
                    const ownerId = absenceOwner(hasCoordinator);
                    classActions.route(e.patientId, ownerId, user.id, nowIso());
                    toast({
                      title: `Routed to ${staffById(ownerId)?.name}`,
                      description: `${pluralize(list.length, "absence")} since ${formatDate(list[0].date, { day: "numeric", month: "short" })}. ${hasCoordinator ? "Created locally" : "No coordinator on the Team plan, so the front desk follows up. Created locally"} — nothing was sent.`,
                      tone: "success",
                    });
                  }}
                />
              ))}
            </ul>

            {cls.waitlist.length ? (
              <div className="mt-2 rounded-inner bg-surface p-4">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Hourglass size={14} aria-hidden="true" /> Waitlist
                </p>
                <ul className="mt-3 flex flex-col gap-3">
                  {cls.waitlist.map((pid) => {
                    const p = patientById(pid);
                    const offered = s.offers[key(cls.id, pid)];
                    return (
                      <li key={pid} className="flex flex-wrap items-center gap-3">
                        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{p?.name}</span>
                          <span className="block truncate text-xs text-muted">{p?.primaryConcern}</span>
                        </span>
                        {offered ? (
                          <StatusBadge tone="info">Spot offered · {formatTime(offered.at)}</StatusBadge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!spotOpen || !canRun}
                            onClick={() => {
                              classActions.offer(cls.id, pid, user.id, nowIso());
                              toast({ title: `Spot offer recorded for ${p?.name}`, description: "Nothing was sent — messaging isn't connected in this demo. Call or message them from Messages." });
                            }}
                          >
                            Offer spot
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!spotOpen ? <p className="mt-3 text-xs text-muted">Class is full — a spot opens when someone cancels, reschedules or is held.</p> : null}
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
                    Unsaved attendance · {MARKABLE.filter((st) => counts[st]).map((st) => `${counts[st]} ${ATTENDANCE_LABEL[st].toLowerCase()}`).join(" · ")}
                    {unmarked ? ` · ${unmarked} not marked` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="glass" onClick={() => { classActions.discard(cls.id); setMissingReason([]); }}>Discard</Button>
                    <Button size="sm" variant="secondary" onClick={saveAttendance}>Save attendance</Button>
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Group>
        </div>

        {/* Sticky rail with its own scroll, so a short roster doesn't end in a long blank run beside it (and vice versa). */}
        <aside
          aria-label="Session details"
          className="flex min-w-0 flex-col gap-4 @[1040px]:sticky @[1040px]:top-20 @[1040px]:max-h-[calc(100dvh-96px)] @[1040px]:self-start @[1040px]:overflow-y-auto scrollbar-thin"
        >
          <SessionPlanCard
            cls={cls}
            plan={plan}
            editable={canRun}
            onSave={(next) => {
              classActions.updatePlan(cls.id, next);
              toast({ title: "Session plan saved", description: "Saved in this browser session for this class." });
            }}
          />
          <SeriesAttendance cls={cls} s={s} />
          <Entitlements cls={cls} hasPackages={hasPackages} />
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Care-team escalations</h2>
                <p className="mt-1 text-xs text-muted">Tasks for clinical review from this class</p>
              </div>
              <FirstAid size={20} className="shrink-0 text-ink-2" aria-hidden="true" />
            </div>
            {escalations.length || sharedTasks.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {escalations.map((x) => (
                  <li key={x.id} className="rounded-inner bg-canvas p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">{patientById(x.patientId)?.name}</span>
                      <StatusBadge tone={x.urgency === "urgent" ? "danger" : x.urgency === "today" ? "warning" : "neutral"}>{x.urgency === "routine" ? "Routine" : x.urgency === "today" ? "Today" : "Urgent"}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{x.concern}</p>
                    <p className="mt-2 text-xs text-muted">→ {staffById(x.ownerId)?.name}{x.routedVia ? ` (${x.routedVia})` : ""} · created locally {formatTime(x.at)}</p>
                  </li>
                ))}
                {sharedTasks.map((t) => (
                  <li key={t.id} className="rounded-inner bg-canvas p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">{patientById(t.patientId)?.name}</span>
                      <StatusBadge tone={t.status === "blocked" ? "danger" : "warning"}>{t.status === "blocked" ? "Blocked" : "Open"}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{t.title}</p>
                    <p className="mt-2 text-xs text-muted">→ {staffById(t.ownerId)?.name} · due {formatDate(t.due, { day: "numeric", month: "short" })} {formatTime(t.due)} · {t.source}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">No escalations from this class.</p>
            )}
            {canRun ? (
              <Button className="mt-4" size="sm" variant="dark" leading={<FirstAid />} onClick={() => setEscalateFor(null)}>
                Escalate a concern
              </Button>
            ) : null}
          </Card>
        </aside>
      </div>

      <ClearanceReview target={review} cls={cls} onClose={() => setReview(null)} onDecide={decide} />
      <ObservationSheet
        patientId={observe}
        cls={cls}
        history={s.observations}
        canWrite={canRun}
        onClose={() => setObserve(null)}
        onSave={(o) => {
          if (!observe) return;
          const pid = observe;
          classActions.observe({ id: newId("ob"), patientId: pid, classTitle: cls.title, at: nowIso(), by: user.id, ...o });
          let extra = "";
          if (o.concern) {
            const route = routeFor(pid, hasCoordinator);
            classActions.escalate({ id: newId("esc"), patientId: pid, classId: cls.id, concern: o.text, urgency: "today", ownerId: route.ownerId, routedVia: route.via, by: user.id, at: nowIso() });
            extra = ` A review task went to ${staffById(route.ownerId)?.name}.`;
          }
          setObserve(null);
          toast({ title: "Observation saved", description: `Private to the care team, saved in this browser session.${extra}`, tone: "success" });
        }}
      />
      <EscalateModal
        open={escalateFor !== undefined}
        onOpenChange={(v) => !v && setEscalateFor(undefined)}
        cls={cls}
        defaultPatientId={escalateFor ?? null}
        hasCoordinator={hasCoordinator}
        onCreate={(input) => {
          classActions.escalate({ id: newId("esc"), patientId: input.patientId, classId: cls.id, concern: input.concern, urgency: input.urgency, ownerId: input.ownerId, routedVia: input.via, by: user.id, at: nowIso() });
          setEscalateFor(undefined);
          toast({ title: `Task created for ${staffById(input.ownerId)?.name}`, description: "Created locally in this browser session — nothing was sent, no one was paged.", tone: "success" });
        }}
      />
    </div>
  );
}

function ParticipantRow({
  cls,
  e,
  s,
  canRun,
  hasPackages,
  hasCoordinator,
  isCoordinator,
  missingReason,
  sharedTasks,
  onReview,
  onObserve,
  onMark,
  onRoute,
}: {
  cls: YogaClass;
  e: Enrolment;
  s: ClassesState;
  canRun: boolean;
  hasPackages: boolean;
  hasCoordinator: boolean;
  isCoordinator: boolean;
  missingReason: boolean;
  sharedTasks: typeof TASKS;
  onReview: () => void;
  onObserve: () => void;
  onMark: (state: AttendanceState, reason: string) => void;
  onRoute: (list: { date: string; title: string }[]) => void;
}) {
  const patient = patientById(e.patientId);
  const first = patient?.name.split(" ")[0] ?? "Participant";
  const mark = currentMark(s, cls, e);
  const saved = savedMark(s, cls, e);
  const changed = mark.state !== saved.state || mark.reason !== saved.reason;
  const clearance = CLEARANCES[e.patientId];
  const approver = clearance ? staffById(clearance.by) : undefined;
  const covered = clearance?.coveringFor ? staffById(clearance.coveringFor) : undefined;
  const approvedBy = approver ? `${approver.name}${covered ? `, covering for ${covered.name}` : ""}` : null;
  const organ = participantOrgan(e.patientId, e.precaution);
  const ack = s.acks[e.patientId];
  const hold = s.holds[key(cls.id, e.patientId)];
  const flagged = isFlagged(e);
  const unresolved = flagged && !ack && !hold;
  const needsReason = NEEDS_REASON.includes(mark.state);
  const showReason = needsReason || mark.state === "late";
  const repeat = mark.state === "absent" ? repeatedAbsence(s, e.patientId, cls.start) : null;
  const routed = s.routed[e.patientId];
  const pkg = PACKAGES.find((x) => x.patientId === e.patientId);
  const observations = s.observations.filter((o) => o.patientId === e.patientId).length;

  return (
    <li id={`p-${e.patientId}`} className="scroll-mt-32">
      <div className={cn("rounded-inner bg-surface p-4 transition-shadow duration-300", unresolved && "shadow-[inset_0_0_0_1.5px_var(--color-warning)]")}>
        <div className="flex items-center gap-3">
          <Avatar src={patient?.avatar} name={patient?.name ?? "Participant"} size="md" />
          <div className="min-w-0 flex-1">
            <Link href={`/patients/${e.patientId}`} className="block truncate text-sm text-ink hover:underline hover:underline-offset-4">{patient?.name}</Link>
            <p className="truncate text-xs text-muted">{patient?.age} · {patient?.conditions.join(", ") || patient?.primaryConcern}</p>
          </div>
          {hasPackages && pkg ? (
            <span className={cn("hidden shrink-0 items-center gap-1.5 text-xs tabular sm:flex", pkg.total - pkg.used <= 2 ? "text-warning" : "text-muted")}>
              <Package size={14} aria-hidden="true" /> {pkg.total - pkg.used} of {pkg.total} left
            </span>
          ) : null}
          <IconButton label={`Private observation for ${first}${observations ? ` (${observations} earlier)` : ""}`} tooltip="left" variant="soft" onClick={onObserve}>
            <NotePencil />
          </IconButton>
        </div>

        {!e.precaution && !flagged ? (
          // Cleared with nothing specific: one quiet line, so real precautions stand out.
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            {organ ? <OrganDot organ={organ} size={28} /> : <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />}
            <span className="min-w-0">
              Cleared · no specific precautions{approver ? ` · ${approver.name}` : ""}
              {clearance ? `, ${formatDate(clearance.at, { day: "numeric", month: "short" })}` : ""}
              {organ ? <span className="block truncate text-[11px] text-muted">{organ.label}</span> : null}
            </span>
            <ClearanceBadge state="current" className="ml-auto" />
          </div>
        ) : (
          <div className={cn("-mx-2 mt-3 flex flex-wrap items-start gap-3 rounded-[8px] p-3", unresolved ? "bg-warning-soft" : "bg-canvas")}>
            {organ ? (
              <OrganDot organ={organ} size={44} />
            ) : unresolved ? (
              <ShieldWarning size={18} weight="fill" className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            ) : (
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink-2" aria-hidden="true" />
            )}
            <div className="min-w-[180px] flex-1">
              <p className="text-sm text-ink">{e.precaution ?? "Clearance needs renewal — no precaution text on record"}</p>
              {organ ? <p className="mt-0.5 text-xs text-ink-2">{organ.label}{organ.fromPrecaution ? "" : " · primary condition"}</p> : null}
              <p className="mt-0.5 text-xs text-muted">
                {approvedBy ? `Approved by ${approvedBy}` : "Approval not on record"}
                {clearance ? ` · ${formatDate(clearance.at, { day: "numeric", month: "short" })}` : ""}
                {clearance?.validUntil ? ` · ${e.clearance === "expired" ? "expired" : "valid until"} ${formatDate(`${clearance.validUntil}T23:59:00+05:30`, { day: "numeric", month: "short" })}` : ""}
              </p>
              {ack ? <p className="mt-1 text-xs text-success">Acknowledged by {staffById(ack.by)?.name} · {formatTime(ack.at)}{ack.note ? ` · “${ack.note}”` : ""}</p> : null}
              {hold ? <p className="mt-1 text-xs text-primary-ink">Held from this session by {staffById(hold.by)?.name} · {formatTime(hold.at)}</p> : null}
            </div>
            <span className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
              <ClearanceBadge state={e.clearance} />
              {unresolved && canRun ? (
                <Button size="sm" variant="dark" onClick={onReview}>Review</Button>
              ) : null}
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full text-xs text-muted sm:w-auto sm:pr-1">Attendance</span>
            {canRun && !hold ? (
              <>
                <div className="hidden sm:block">
                  <Segmented<AttendanceState>
                    ariaLabel={`Attendance for ${patient?.name}`}
                    size="sm"
                    variant="tray"
                    value={mark.state}
                    onChange={(st) => onMark(st, NEEDS_REASON.includes(st) || st === "late" ? mark.reason : "")}
                    items={MARKABLE.map((st) => ({ value: st, label: ATTENDANCE_LABEL[st] }))}
                  />
                </div>
                <Select
                  className="w-full sm:hidden"
                  ariaLabel={`Attendance for ${patient?.name}`}
                  value={mark.state}
                  onValueChange={(v) => onMark(v as AttendanceState, mark.reason)}
                  options={(["pending", ...MARKABLE] as AttendanceState[]).map((st) => ({ value: st, label: ATTENDANCE_LABEL[st] }))}
                />
              </>
            ) : (
              <StatusBadge tone={ATT_TONE[mark.state]}>{ATTENDANCE_LABEL[mark.state]}</StatusBadge>
            )}
            {changed ? <span className="text-xs text-warning">Unsaved</span> : null}
            <WeekStrip s={s} patientId={e.patientId} currentId={cls.id} className="w-full sm:ml-auto sm:w-auto" />
          </div>
          <AnimatePresence initial={false}>
            {showReason && canRun && !hold ? (
              <motion.div key="reason" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                <label htmlFor={`reason-${cls.id}-${e.patientId}`} className="sr-only">Reason for {ATTENDANCE_LABEL[mark.state].toLowerCase()}</label>
                <Input
                  id={`reason-${cls.id}-${e.patientId}`}
                  value={mark.reason}
                  onChange={(ev) => onMark(mark.state, ev.target.value)}
                  placeholder={needsReason ? `Reason (required) — e.g. ${mark.state === "absent" ? "no call or message" : mark.state === "cancelled" ? "unwell, called 07:10" : "moved to Mon 16 Nov"}` : "How late? (optional)"}
                  aria-invalid={missingReason && !mark.reason.trim() ? true : undefined}
                  aria-describedby={missingReason && !mark.reason.trim() ? `reason-err-${e.patientId}` : undefined}
                  className="h-9"
                />
                {missingReason && !mark.reason.trim() ? <p id={`reason-err-${e.patientId}`} className="mt-1 text-xs text-danger">A reason is required for {ATTENDANCE_LABEL[mark.state].toLowerCase()}.</p> : null}
              </motion.div>
            ) : mark.reason && (!canRun || hold) ? (
              <p className="text-xs text-muted">Reason: {mark.reason}</p>
            ) : null}
          </AnimatePresence>
        </div>

        {repeat ? (
          <div className="-mx-2 mt-3 flex flex-wrap items-center gap-3 rounded-[8px] bg-danger-soft p-3">
            <Warning size={18} weight="fill" className="shrink-0 text-danger" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm text-ink">
              {ordinal(repeat.length)} missed session since {formatDate(repeat[0].date, { day: "numeric", month: "short" })}
              <span className="block text-xs text-muted">{repeat.map((r) => formatDate(r.date, { day: "numeric", month: "short" })).join(" · ")} · repeated absence</span>
            </p>
            {routed ? (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle size={14} weight="fill" aria-hidden="true" /> Routed to {staffById(routed.to)?.name} · {formatTime(routed.at)}
              </span>
            ) : canRun ? (
              <Button size="sm" variant="dark" trailing={<ArrowUpRight />} onClick={() => onRoute(repeat)}>
                {hasCoordinator ? "Route to coordinator" : "Route to front desk"}
              </Button>
            ) : isCoordinator ? (
              <Button asChild size="sm" variant="dark" trailing={<ArrowUpRight />}>
                <Link href="/tasks">Follow up in Tasks</Link>
              </Button>
            ) : (
              <span className="text-xs text-muted">The instructor routes this to the coordinator</span>
            )}
          </div>
        ) : null}

        {sharedTasks.length ? (
          <p className="mt-3 flex items-start gap-2 text-xs text-ink-2">
            <ListChecks size={14} className="mt-px shrink-0 text-muted" aria-hidden="true" />
            <span>
              Open task: {sharedTasks.map((t) => `${t.title} (${staffById(t.ownerId)?.name}, ${t.status === "blocked" ? "blocked" : `due ${formatTime(t.due)}`})`).join(" · ")}
            </span>
          </p>
        ) : null}

        {hasPackages && pkg ? (
          <p className={cn("mt-3 flex items-center gap-1.5 text-xs tabular sm:hidden", pkg.total - pkg.used <= 2 ? "text-warning" : "text-muted")}>
            <Package size={14} aria-hidden="true" /> {pkg.name} · {pkg.total - pkg.used} of {pkg.total} left
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Static organ render of the condition a precaution is about (from the participant's own record). */
function OrganDot({ organ, size }: { organ: NonNullable<ReturnType<typeof participantOrgan>>; size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]" style={{ width: size, height: size }}>
      <OrganImage kind={organ.organ} alt={organ.label} className="size-[88%]" />
    </span>
  );
}

/** Clearance state with its shield, so the badge never relies on colour alone. */
function ClearanceBadge({ state, className }: { state: Enrolment["clearance"]; className?: string }) {
  const tone: Tone = state === "current" ? "success" : state === "changed" ? "warning" : "danger";
  return (
    <StatusBadge tone={tone} dot={false} className={className}>
      {state === "current" ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldWarning size={14} weight="fill" aria-hidden="true" />}
      Clearance {state === "current" ? "current" : state === "changed" ? "changed" : "expired"}
    </StatusBadge>
  );
}

/** Saved attendance for every session of this class series this week (same title). */
function SeriesAttendance({ cls, s }: { cls: YogaClass; s: ClassesState }) {
  const series = WEEK_CLASSES.filter((c) => c.title === cls.title);
  const done = markedSessions(s, series);
  const only = done.length === 1 ? done[0] : null;
  const n = only ? attendanceCounts(s, only) : null;
  return (
    <Card>
      <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">This class this week</h2>
      <p className="mt-1 text-xs text-muted">
        {pluralize(series.length, "session")} of {cls.title} · {done.length} finished · saved attendance
      </p>
      {done.length >= 2 ? (
        <AttendanceChart s={s} classes={series} highlightId={cls.id} height={156} className="mt-4" emptyText="" />
      ) : only && n ? (
        <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          {sessionLabel(only)}: {n.present} present · {n.late} late · {n.absent} absent{n.released ? ` · ${n.released} cancelled or rescheduled` : ""}. A chart appears once two sessions have finished.
        </p>
      ) : (
        <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-muted">No session of this class has finished yet this week.</p>
      )}
    </Card>
  );
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

function Entitlements({ cls, hasPackages }: { cls: YogaClass; hasPackages: boolean }) {
  const rows = cls.enrolled.flatMap((e) => {
    const pkg = PACKAGES.find((x) => x.patientId === e.patientId);
    return pkg ? [{ e, pkg }] : [];
  });
  if (!hasPackages) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Session entitlements</h2>
          <LockBadge className="mt-1.5" />
        </div>
        <p className="mt-2 text-sm text-muted">Package balances are part of the Clinic plan. On this plan, check entitlements with the front desk before the session.</p>
        <Button asChild size="sm" variant="secondary" className="mt-4" trailing={<ArrowUpRight />}>
          <Link href="/pricing">Compare plans</Link>
        </Button>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Session entitlements</h2>
      <p className="mt-1 text-xs text-muted">Package balances you're permitted to see · not deducted in this demo</p>
      {rows.length ? (
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map(({ e, pkg }) => {
            const left = pkg.total - pkg.used;
            const p = patientById(e.patientId);
            return (
              <li key={e.patientId}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink">{p?.name}</span>
                  <span className={cn("shrink-0 text-xs tabular", left <= 2 ? "text-warning" : "text-muted")}>{left} of {pkg.total} left</span>
                </div>
                <ProgressBar className="mt-2" value={pkg.used} max={pkg.total} tone={left <= 2 ? "warning" : "dark"} label={`${p?.name}: ${pkg.used} of ${pkg.total} sessions used`} />
                <p className="mt-1 text-xs text-muted">{pkg.name} · expires {formatDate(`${pkg.expires}T12:00:00+05:30`, { day: "numeric", month: "short" })}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No participant in this class has a package on record.</p>
      )}
    </Card>
  );
}
