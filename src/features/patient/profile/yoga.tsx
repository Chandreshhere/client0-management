"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowsLeftRight, CalendarBlank, CheckCircle, ClipboardText, NotePencil, PersonSimpleTaiChi, ShieldWarning, Target, Warning } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { PACKAGES } from "@/data/programs";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AttendanceState } from "@/data/types";
import { classActions, classesStore } from "@/features/classes/store";
import { ATT_LABEL } from "@/features/classes/model";
import { progressSummary } from "@/features/classes/progress-note-sheet";
import { createTask } from "@/features/tasks/store";
import { NOW_ISO } from "@/features/tasks/time";
import { FlagToDoctorModal } from "@/features/tasks/flag-modal";
import { ProfileFrame } from "./frame";
import { AssignDialog } from "./assign-dialog";
import { profileId, updateProfile, useProfileStore } from "./profile-store";
import { YOGA_GOALS, assignmentsOf, firstName, precautionsOf, sessionsOf } from "./derive";
import { useYogaProgress } from "./yoga-progress";

const fmtDay = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const fmtWhen = (iso: string) => `${formatDate(iso, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(iso)}`;

const ATT_TONE: Record<AttendanceState, Tone> = { present: "success", late: "info", absent: "danger", cancelled: "neutral", rescheduled: "neutral", pending: "draft" };

/**
 * Yoga section (spec F7): precautions and whether the instructor acknowledged the latest change,
 * goals, sessions, attendance rate and progress notes. Instructors see precautions, never
 * diagnoses; the doctor sets precautions here and the instructor acknowledges them.
 */
export function YogaSection({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const localPrecautions = useProfileStore((s) => s.precautions);
  const localAssignments = useProfileStore((s) => s.assignments);
  const progress = useYogaProgress(patientId);
  const [flagging, setFlagging] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const first = firstName(patient);

  const precautions = precautionsOf(patientId, localPrecautions);
  const assignment = useMemo(() => assignmentsOf(patientId, localAssignments).find((a) => a.discipline === "yoga"), [patientId, localAssignments]);
  const instructorId = patient.careTeam.yoga ?? assignment?.toId;
  const instructor = staffById(instructorId);
  const teaches = sessionsOf(patientId).some((s) => s.cls.instructorId === user.id);
  const isInstructor = role === "yoga" && (instructorId === user.id || teaches);
  const needsAck = (precautions.state === "changed" || precautions.state === "expired") && !progress.ack;
  const goals = YOGA_GOALS[patientId] ?? [];
  const pkg = has("packages") ? PACKAGES.find((p) => p.patientId === patientId) : undefined;

  const acknowledge = () => {
    classActions.acknowledge(patientId, { kind: "acknowledged", note: "Acknowledged from the patient profile", by: user.id, at: NOW_ISO });
    toast({ title: `Precautions acknowledged for ${first}`, description: "Recorded for every session with this patient. The doctor can see it on the profile. Saved in this browser session.", tone: "success" });
  };

  const primary =
    role === "doctor" ? (
      instructorId ? (
        <Button variant="primary" leading={<ShieldWarning />} onClick={() => setEditing(true)}>
          Update precautions
        </Button>
      ) : (
        <Button variant="primary" leading={<ArrowsLeftRight />} onClick={() => setAssigning(true)}>
          Assign to yoga
        </Button>
      )
    ) : isInstructor ? (
      needsAck ? (
        <Button variant="primary" leading={<CheckCircle />} onClick={acknowledge}>
          Acknowledge precautions
        </Button>
      ) : progress.next?.classId ? (
        <Button asChild variant="primary" leading={<CalendarBlank />}>
          <Link href={`/classes/${progress.next.classId}`}>Open next session</Link>
        </Button>
      ) : null
    ) : null;

  const actions = (
    <>
      {role === "yoga" && has("flags") ? (
        <Button variant="secondary" leading={<Warning />} onClick={() => setFlagging(true)}>
          Flag to doctor
        </Button>
      ) : null}
      {primary}
    </>
  );

  if (!instructorId && progress.sessions === 0) {
    return (
      <ProfileFrame patient={patient} title="Yoga" description="Precautions, goals, sessions, attendance and progress notes." actions={role === "doctor" ? actions : undefined}>
        <Card className="py-6">
          <EmptyState
            icon={<PersonSimpleTaiChi />}
            title={`${first} isn't assigned to yoga`}
            description={role === "doctor" ? "Assign an instructor with goals and precautions. The instructor acknowledges the precautions before the first session." : `The doctor assigns yoga from ${first}'s care team.`}
            action={
              role === "doctor" ? (
                <Button variant="dark" leading={<ArrowsLeftRight />} onClick={() => setAssigning(true)}>
                  Assign to yoga
                </Button>
              ) : undefined
            }
          />
        </Card>
        <AssignDialog open={assigning} onOpenChange={setAssigning} patient={patient} discipline="yoga" />
      </ProfileFrame>
    );
  }

  return (
    <ProfileFrame
      patient={patient}
      title="Yoga"
      description={
        role === "yoga"
          ? isInstructor
            ? `Read the precautions first — a changed precaution must be acknowledged before the next session.`
            : `${instructor ? `${instructor.name} is ${first}'s instructor` : `${first} has no instructor yet`}. Read-only for you.`
          : `${instructor ? `${instructor.name}'s` : "The"} sessions with ${first}: precautions, goals, attendance and progress notes.`
      }
      actions={actions}
    >
      <div className="grid grid-cols-1 items-start gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_minmax(320px,384px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Group>
            <GroupHeader
              icon={<ShieldWarning />}
              title="Precautions"
              subtitle={precautions.by && precautions.at ? `Set by ${staffById(precautions.by)?.name}${precautions.coveringFor ? ` (covering for ${staffById(precautions.coveringFor)?.name})` : ""} · ${fmtDay(precautions.at)}` : "From the doctor"}
            />
            {precautions.lines.length ? (
              <ul className="flex flex-col gap-2">
                {precautions.lines.map((l) => (
                  <li key={l} className="flex items-start gap-3 rounded-inner bg-surface p-4 text-sm text-ink">
                    <ShieldWarning size={18} className="mt-px shrink-0 text-warning" aria-hidden="true" />
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <Inset>
                <p className="text-sm text-muted">No precautions recorded. {role === "doctor" ? "Add them before the first session." : "Ask the doctor before the first session."}</p>
              </Inset>
            )}
            <AckStatus needsAck={needsAck} state={precautions.state} ack={progress.ack} previous={precautions.previous} reason={precautions.reason} validUntil={precautions.validUntil} />
          </Group>

          <Group>
            <GroupHeader icon={<CalendarBlank />} title="Sessions and attendance" subtitle={progress.rate !== null ? `${progress.rate}% attended · ${progress.attended} of ${progress.marked} marked sessions` : "No sessions marked yet"} />
            <div className={cn("grid grid-cols-1 gap-2", pkg ? "@[560px]:grid-cols-3" : "@[560px]:grid-cols-2")}>
              <Inset>
                <p className="text-xs text-muted">Attended</p>
                <p className="mt-1 text-2xl font-light tabular text-ink">{progress.attended}</p>
              </Inset>
              <Inset>
                <p className="text-xs text-muted">Missed</p>
                <p className={cn("mt-1 text-2xl font-light tabular", progress.missed ? "text-danger" : "text-ink")}>{progress.missed}</p>
              </Inset>
              {pkg ? (
                <Inset>
                  <p className="text-xs text-muted">Package</p>
                  <p className="mt-1 text-sm text-ink tabular">
                    {pkg.used} of {pkg.total} used
                  </p>
                  <ProgressBar value={pkg.used} max={pkg.total} className="mt-2" label="Package sessions used" />
                </Inset>
              ) : null}
            </div>
            {progress.rows.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {progress.rows.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inner bg-surface p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {fmtWhen(r.start)} · {r.kind === "individual" ? "1:1" : r.kind === "group" ? "Group" : "Earlier session"}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </span>
                    </span>
                    <StatusBadge tone={r.ended ? ATT_TONE[r.state] : "info"}>{r.ended ? ATT_LABEL[r.state] : "Upcoming"}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : null}
          </Group>

          <Group>
            <GroupHeader icon={<ClipboardText />} title="Progress notes" subtitle="Mobility, pain, breathing and home practice" />
            {progress.notes.length ? (
              <ol className="flex flex-col gap-2">
                {progress.notes.map((n) => (
                  <li key={n.id} className="rounded-inner bg-surface p-4">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm text-ink">{n.classTitle}</span>
                      <span className="text-xs text-muted">{fmtWhen(n.at)}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-2">{progressSummary(n)}</p>
                    {n.breathing ? <p className="mt-1 text-xs text-muted">Breathing: {n.breathing}</p> : null}
                    {n.note ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{n.note}</p> : null}
                    <p className="mt-2 text-xs text-muted">{staffById(n.by)?.name}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Inset>
                <p className="text-sm text-muted">{isInstructor ? "Write a progress note after the session — from the session's attendance list." : "The instructor writes a progress note after sessions."}</p>
              </Inset>
            )}
            {isInstructor && progress.next?.classId ? (
              <Link href={`/classes/${progress.next.classId}`} className="mt-2 flex items-center justify-end gap-1 px-2 pb-1 text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Write notes from the session <ArrowRight size={12} aria-hidden="true" />
              </Link>
            ) : null}
          </Group>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Group>
            <GroupHeader icon={<Target />} title="Goals" />
            {goals.length ? (
              <ul className="flex flex-col gap-2">
                {goals.map((g) => (
                  <li key={g} className="rounded-inner bg-surface p-4 text-sm text-ink">
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <Inset>
                <p className="text-sm text-muted">No goals set yet — agree them at the first session.</p>
              </Inset>
            )}
          </Group>
          <Card>
            <p className="flex items-center gap-2 text-sm text-ink">
              <CalendarBlank size={18} className="text-ink-2" aria-hidden="true" />
              Next session
            </p>
            {progress.next ? (
              <>
                <p className="mt-2 text-sm text-ink">{progress.next.title}</p>
                <p className="text-xs text-muted">{fmtWhen(progress.next.start)}</p>
                {needsAck ? <p className="mt-2 text-xs text-warning">Precautions must be acknowledged before this session starts.</p> : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing booked.</p>
            )}
          </Card>
          {assignment ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-ink">
                <ArrowsLeftRight size={18} className="text-ink-2" aria-hidden="true" />
                Assignment
              </p>
              {role === "doctor" ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{assignment.reason}</p> : null}
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                {staffById(assignment.fromId)?.name} → {staffById(assignment.toId)?.name} · {fmtDay(assignment.at)}
                <StatusBadge tone={assignment.state === "seen" ? "success" : assignment.overdue ? "danger" : "warning"}>{assignment.state === "seen" ? "Seen" : assignment.overdue ? "Not seen in 48 h" : "Assigned"}</StatusBadge>
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <FlagToDoctorModal open={flagging} onOpenChange={setFlagging} patients={[{ id: patient.id, hint: precautions.lines.join(" · ") || undefined }]} context="Yoga" />
      <PrecautionsDialog open={editing} onOpenChange={setEditing} patientId={patientId} current={precautions.lines} instructorId={instructorId} />
      <AssignDialog open={assigning} onOpenChange={setAssigning} patient={patient} discipline="yoga" />
    </ProfileFrame>
  );
}

function AckStatus({
  needsAck,
  state,
  ack,
  previous,
  reason,
  validUntil,
}: {
  needsAck: boolean;
  state: "current" | "changed" | "expired" | null;
  ack: { by: string; at: string } | null;
  previous: string | undefined;
  reason: string | undefined;
  validUntil: string | null;
}) {
  if (!state) return null;
  return (
    <div className={cn("mt-2 rounded-inner p-4", needsAck ? "bg-warning-soft" : "bg-surface")}>
      {needsAck ? (
        <p className="flex items-center gap-2 text-sm text-warning">
          <Warning size={16} aria-hidden="true" />
          {state === "expired" ? "Approval expired — not acknowledged yet" : "Changed — the instructor hasn't acknowledged it yet"}
        </p>
      ) : ack ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle size={16} aria-hidden="true" />
          Acknowledged by {staffById(ack.by)?.name} · {fmtWhen(ack.at)}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <CheckCircle size={16} className="text-success" aria-hidden="true" />
          Current — no change since the instructor last acknowledged
        </p>
      )}
      {previous ? <p className="mt-1 text-xs text-muted">Was: {previous}</p> : null}
      {reason ? <p className="mt-1 text-xs text-muted">{reason}</p> : null}
      {validUntil ? <p className="mt-1 text-xs text-muted">Valid until {formatDate(`${validUntil}T12:00:00+05:30`, { day: "numeric", month: "short", year: "numeric" })}</p> : null}
    </div>
  );
}

/** Doctor sets precautions (F5/F7). A change needs the instructor's acknowledgement before the next session. */
function PrecautionsDialog({ open, onOpenChange, patientId, current, instructorId }: { open: boolean; onOpenChange: (v: boolean) => void; patientId: string; current: string[]; instructorId: string | undefined }) {
  const { user } = useRole();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const patient = patientById(patientId)!;

  useEffect(() => {
    if (open) {
      setText(current.join("\n"));
      setReason("");
      setTried(false);
    }
  }, [open, current]);

  const error = text.trim().length < 4 ? "Write at least one precaution." : null;
  const save = () => {
    setTried(true);
    if (error) return;
    const at = TODAY.toISOString();
    updateProfile((s) => ({ ...s, precautions: [{ id: profileId("pre"), patientId, text: text.trim(), reason: reason.trim(), by: user.id, at }, ...s.precautions] }));
    // a new change needs a new acknowledgement
    classesStore.set((s) => {
      if (!s.acks[patientId]) return s;
      const acks = { ...s.acks };
      delete acks[patientId];
      return { ...s, acks };
    });
    if (instructorId) {
      createTask(
        { title: `Acknowledge changed precautions: ${patient.name}`, patientId, ownerId: instructorId, due: NOW_ISO, priority: "high", source: `Precautions changed by ${user.name}`, discipline: "movement", notes: text.trim() },
        user.id,
      );
    }
    onOpenChange(false);
    toast({ title: "Precautions updated", description: `${staffById(instructorId)?.name ?? "The instructor"} must acknowledge them before the next session. Saved in this browser session.`, tone: "success" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Update precautions"
        description={`For ${patient.name}'s yoga sessions. Write rules for the instructor, not diagnoses.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<NotePencil />} onClick={save}>
              Save and ask to acknowledge
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Precautions" hint="One per line, e.g. “HR ceiling 110 bpm”, “No inversions”." error={tried ? error : null}>
            {(p) => <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[120px]" {...p} />}
          </Field>
          <Field label="Why it changed" optional>
            {(p) => <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. After the 12 Nov spirometry" {...p} />}
          </Field>
        </div>
      </ModalContent>
    </Dialog>
  );
}
