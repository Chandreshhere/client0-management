"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowUpRight, CalendarCheck, CheckCircle, Flag, PersonSimpleTaiChi, ShieldWarning } from "@phosphor-icons/react";
import { formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { ATTENDANCE_LABEL } from "@/data/programs";
// the same session list the Sessions screen uses (fixtures + the rest of this week), so the home
// and the roster always agree on what the instructor has to do
import { WEEK_CLASSES as CLASSES } from "@/features/classes/model";
import type { AttendanceState, YogaClass } from "@/data/types";
import { NOW_ISO, NOW_LABEL, NOW_MIN, TODAY_KEY, endIso, istDayKey, istMinutes, profileHref, untilLabel, whenLabel } from "./data";
import { flagsRaisedBy } from "./owners";
import { dashboardActions, useDashboardState, type Mark } from "./session";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalStat, InsetList, ItemCard, ListRow, Panel, PanelEmpty, Rail, Reveal } from "./ui";

/**
 * Yoga instructor home — "Who's in my sessions, and what must I know?"
 * My sessions today with their patients and precautions (never diagnoses — spec rule 3), the
 * precautions that changed since I last acknowledged them, and attendance to mark. Weekly
 * attendance charts and package balances live in reports and on the patient profile.
 */
const ME = DEMO_USER.yoga.personId;

const mine = CLASSES.filter((c) => c.instructorId === ME).sort((a, b) => a.start.localeCompare(b.start));
const today = mine.filter((c) => istDayKey(c.start) === TODAY_KEY);
const upcoming = mine.filter((c) => c.start > NOW_ISO);
/** Today's sessions, or the next one I teach when today is empty. */
const shown = today.length ? today : upcoming.slice(0, 1);
const roster = (c: YogaClass) => c.enrolled.filter((e) => e.attendance !== "cancelled");

type Phase = "ended" | "running" | "upcoming";
const phaseOf = (c: YogaClass): Phase => {
  if (istDayKey(c.start) !== TODAY_KEY) return c.start > NOW_ISO ? "upcoming" : "ended";
  const start = istMinutes(c.start);
  if (NOW_MIN >= start + c.durationMin) return "ended";
  return NOW_MIN >= start ? "running" : "upcoming";
};

/**
 * Precautions only: a leading condition label ("Post-MI: …", "Knee OA — …") is dropped so a class
 * list never shows a diagnosis. Measured limits ("SpO₂ floor 92% — …") are kept whole.
 */
function precautionOnly(text: string | undefined) {
  if (!text) return null;
  const m = text.match(/^([^:—\d]{2,24})\s*(?::|—)\s*(.+)$/);
  const rest = m ? m[2] : text;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The attributed version of a changed precaution, e.g. "SpO₂ floor 92%" · "Changed 13 Nov by Dr. Vikram Iyer, covering". */
function changedGuidance(patientId: string): { text: string; by: string | null } {
  let fallback: string | null = null;
  for (const e of CLASSES.flatMap((c) => c.enrolled)) {
    if (e.patientId !== patientId || e.clearance !== "changed" || !e.precaution) continue;
    const m = e.precaution.match(/^(.*?)\s*\((changed .+ by .+)\)$/i);
    if (m) return { text: m[1], by: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
    fallback ??= e.precaution.replace(/\s*—\s*needs instructor review$/i, "");
  }
  return { text: fallback ?? "Precaution changed", by: null };
}

/** Patients in my sessions from today on whose precautions changed — each once. */
const changedPatients = [...new Set(mine.filter((c) => istDayKey(c.start) >= TODAY_KEY).flatMap((c) => roster(c).filter((e) => e.clearance === "changed").map((e) => e.patientId)))];

const MARKS: { value: Mark; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];
const isMark = (a: AttendanceState): a is Mark => a === "present" || a === "late" || a === "absent";
const markTone: Record<Mark, Tone> = { present: "success", late: "warning", absent: "danger" };

export function YogaHome() {
  const { has } = useRole();
  const { toast } = useToast();
  const { acks, attendance } = useDashboardState();
  const toAck = changedPatients.filter((pid) => !acks[pid]);
  const acked = changedPatients.filter((pid) => acks[pid]);
  const waiting = flagsRaisedBy(ME);
  const started = today.filter((c) => phaseOf(c) !== "upcoming");
  const marksFor = (c: YogaClass): Record<string, AttendanceState> => ({ ...Object.fromEntries(roster(c).map((e) => [e.patientId, e.attendance])), ...(attendance[c.id]?.marks ?? {}) });
  const unmarked = started.filter((c) => Object.values(marksFor(c)).some((m) => m === "pending"));
  const patientsToday = new Set(today.flatMap((c) => roster(c).map((e) => e.patientId))).size;

  const acknowledge = (pid: string) => {
    dashboardActions.acknowledge(pid, NOW_LABEL);
    toast({
      tone: "success",
      title: `Precaution acknowledged · ${patientById(pid)?.name}`,
      description: "Recorded in this browser session. The change stays attributed to the doctor who made it.",
      action: { label: "Undo", onClick: () => dashboardActions.undoAcknowledge(pid) },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(today.length, "session")} today · ${pluralize(patientsToday, "patient")} · ${toAck.length ? `${pluralize(toAck.length, "precaution change")} to acknowledge` : "no precaution changes"} · ${unmarked.length ? `${pluralize(unmarked.length, "session")} to mark` : "attendance up to date"}`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/classes">
                <PersonSimpleTaiChi />
                My sessions
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/tasks?new=1">
                <Flag />
                Flag to doctor
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <SessionsCard acks={acks} marksFor={marksFor} capacity={has("group-classes")} />
        </Reveal>

        <Rail index={1} className="xl:row-span-2">
          <Panel icon={<ShieldWarning />} title="Precautions changed" subtitle={toAck.length ? `${pluralize(toAck.length, "change")} to acknowledge` : "Up to date"} href="/classes" actionLabel="Open sessions">
            {toAck.length === 0 && waiting.length === 0 ? (
              <PanelEmpty icon={<ShieldWarning />} title="You're up to date" description="When a doctor changes a precaution for someone in your sessions, it appears here until you acknowledge it." />
            ) : null}
            {toAck.map((pid) => {
              const p = patientById(pid);
              const g = changedGuidance(pid);
              return (
                <ItemCard
                  key={pid}
                  href={profileHref(pid, "yoga")}
                  avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                  name={p?.name}
                  lines={[g.text, g.by ?? "Changed by the doctor"]}
                  badge={<StatusBadge tone="warning">Changed</StatusBadge>}
                  actions={
                    <Button size="sm" variant="dark" onClick={() => acknowledge(pid)} aria-label={`Acknowledge the new precaution for ${p?.name}`}>
                      <CheckCircle />
                      Acknowledge
                    </Button>
                  }
                />
              );
            })}
            {acked.length ? (
              <InsetList label="Acknowledged">
                {acked.map((pid) => {
                  const p = patientById(pid);
                  return <ListRow key={pid} href={profileHref(pid, "yoga")} lead={<Avatar src={p?.avatar} name={p?.name ?? ""} size="sm" />} title={p?.name} meta={changedGuidance(pid).text} trailing={<StatusBadge tone="success">Acknowledged {acks[pid]}</StatusBadge>} />;
                })}
              </InsetList>
            ) : null}
            {waiting.length ? (
              <>
                <p className="px-2 pt-2 text-xs text-muted">Waiting on the doctor — flags you raised</p>
                {waiting.map((f) => {
                  const p = patientById(f.patientId);
                  const current = precautionOnly(mine.flatMap((c) => c.enrolled).find((e) => e.patientId === f.patientId && e.precaution)?.precaution);
                  return (
                    <ItemCard
                      key={f.id}
                      href={profileHref(f.patientId, "yoga")}
                      avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                      name={p?.name}
                      lines={[`${f.what} · flagged to ${staffById(f.doctorId)?.name}`, current ? `Until they respond: ${current.charAt(0).toLowerCase()}${current.slice(1)}` : "No response yet"]}
                      badge={<StatusBadge tone="neutral">Waiting</StatusBadge>}
                    />
                  );
                })}
              </>
            ) : null}
          </Panel>
        </Rail>

        <Reveal index={2} className="lg:col-span-2 xl:col-span-2">
          <AttendancePanel sessions={started} marksFor={marksFor} savedAt={(id) => attendance[id]?.at} />
        </Reveal>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: my sessions today with their patients and precautions
// ---------------------------------------------------------------------------------------------

function SessionsCard({ acks, marksFor, capacity }: { acks: Record<string, string>; marksFor: (c: YogaClass) => Record<string, AttendanceState>; capacity: boolean }) {
  const id = useId();
  const next = shown.find((c) => phaseOf(c) !== "ended") ?? null;
  const isToday = today.length > 0;
  const people = new Set(shown.flatMap((c) => roster(c).map((e) => e.patientId))).size;

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label={isToday ? "My sessions today" : "My next session"}
        title={isToday ? `${pluralize(today.length, "session")} · ${pluralize(people, "patient")}` : next ? next.title : "No sessions booked"}
        meta={next ? `Next: ${next.title} ${istDayKey(next.start) === TODAY_KEY ? `at ${formatTime(next.start)}` : whenLabel(next.start)}` : isToday ? "No more sessions today" : "Nothing on your list yet"}
        aside={next ? <FocalStat value={formatTime(next.start)} caption={untilLabel(next.start)} /> : <FocalStat value={<CheckCircle size={28} weight="fill" aria-label="Done" />} caption="all done today" />}
      />
      {shown.map((c) => {
        const phase = phaseOf(c);
        const list = roster(c);
        const marks = marksFor(c);
        const blocking = list.filter((e) => e.clearance === "changed" && !acks[e.patientId]);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <Link href={`/classes/${c.id}`} className="group flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-inner px-4 py-2 transition-colors hover:bg-white/10">
              <span className="min-w-0">
                <span className="block text-sm text-white">
                  {formatTime(c.start)}–{formatTime(endIso(c))} · {c.title}
                </span>
                <span className="block text-xs text-white/90">
                  {c.kind === "group" ? `${capacity ? `Group · ${list.length} of ${c.capacity} places` : `Group · ${pluralize(list.length, "patient")}`} · ` : c.title.includes("1:1") ? "" : "1:1 · "}
                  {c.room}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {blocking.length && phase === "upcoming" ? <StatusBadge tone="warning">Acknowledge {blocking.length === 1 ? "1 change" : `${blocking.length} changes`} first</StatusBadge> : null}
                <StatusBadge tone={phase === "ended" ? "success" : phase === "running" ? "dark" : "neutral"}>{phase === "ended" ? "Done" : phase === "running" ? "In progress" : `Starts ${formatTime(c.start)}`}</StatusBadge>
                <ArrowUpRight size={16} className="text-white transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
            <InsetList label={`Patients in ${c.title}`} className="md:grid md:grid-cols-2 md:gap-x-2">
              {list.map((e) => {
                const p = patientById(e.patientId);
                const mark = marks[e.patientId];
                const changed = e.clearance === "changed" && !acks[e.patientId];
                const precaution = e.clearance === "changed" ? changedGuidance(e.patientId).text : precautionOnly(e.precaution);
                return (
                  <ListRow
                    key={e.patientId}
                    href={profileHref(e.patientId, "yoga")}
                    lead={<Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />}
                    title={p?.name}
                    meta={precaution ?? "No precautions"}
                    trailing={
                      changed ? (
                        <StatusBadge tone="warning">Changed</StatusBadge>
                      ) : mark && isMark(mark as AttendanceState) ? (
                        <StatusBadge tone={markTone[mark as Mark]}>{ATTENDANCE_LABEL[mark as Mark]}</StatusBadge>
                      ) : undefined
                    }
                  />
                );
              })}
            </InsetList>
          </div>
        );
      })}
      {shown.length === 0 ? <p className="px-4 pb-4 text-sm text-white">Sessions you run will appear here with each patient&apos;s precautions.</p> : null}
    </FocalCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Attendance to mark — sessions that have started today
// ---------------------------------------------------------------------------------------------

function AttendancePanel({ sessions, marksFor, savedAt }: { sessions: YogaClass[]; marksFor: (c: YogaClass) => Record<string, AttendanceState>; savedAt: (classId: string) => string | undefined }) {
  const laterToday = today.filter((c) => phaseOf(c) === "upcoming");
  return (
    <Panel
      icon={<CalendarCheck />}
      title="Attendance to mark"
      subtitle={sessions.length ? `${pluralize(sessions.length, "session")} held today${laterToday.length ? ` · next opens at ${formatTime(laterToday[0].start)}` : ""}` : laterToday.length ? `Opens when ${laterToday[0].title} starts at ${formatTime(laterToday[0].start)}` : "No sessions today"}
      href="/classes"
      actionLabel="Open sessions"
      className="h-full"
    >
      {sessions.length === 0 ? <PanelEmpty icon={<CalendarCheck />} title="Nothing to mark yet" description="Attendance opens when a session starts." /> : null}
      {sessions.map((c) => (
        <SessionAttendance key={c.id} cls={c} marks={marksFor(c)} savedAt={savedAt(c.id)} />
      ))}
    </Panel>
  );
}

function SessionAttendance({ cls, marks, savedAt }: { cls: YogaClass; marks: Record<string, AttendanceState>; savedAt?: string }) {
  const { toast } = useToast();
  const pending = Object.values(marks).some((m) => m === "pending");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, Mark>>(() => Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, isMark(v) ? v : "present"])));
  const open = pending || editing;
  const count = (m: Mark) => Object.values(marks).filter((x) => x === m).length;

  const save = () => {
    dashboardActions.saveAttendance(cls.id, draft, NOW_LABEL);
    setEditing(false);
    toast({ tone: "success", title: `Attendance saved · ${cls.title}`, description: "Saved in this browser session only." });
  };

  return (
    <div className="rounded-inner bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/classes/${cls.id}`} className="block truncate text-sm text-ink underline-offset-4 hover:underline">
            {formatTime(cls.start)} · {cls.title}
          </Link>
          <p className="text-xs text-muted">{pending ? `${pluralize(Object.values(marks).filter((m) => m === "pending").length, "patient")} not marked` : `${count("present")} present · ${count("late")} late · ${count("absent")} absent${savedAt ? ` · saved ${savedAt}` : ""}`}</p>
        </div>
        {open ? null : (
          <span className="flex items-center gap-2">
            <StatusBadge tone="success">Marked</StatusBadge>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Change attendance for ${cls.title}`}>
              Change
            </Button>
          </span>
        )}
      </div>
      {open ? (
        <>
          <ul className="mt-3 flex flex-col gap-1">
            {roster(cls).map((e) => {
              const p = patientById(e.patientId);
              return (
                <li key={e.patientId} className="@container rounded-[12px] bg-canvas px-3 py-2">
                  <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="xs" />
                      <span className="truncate text-sm text-ink">{p?.name}</span>
                    </span>
                    <Segmented items={MARKS} value={draft[e.patientId]} onChange={(v) => setDraft((s) => ({ ...s, [e.patientId]: v }))} ariaLabel={`Attendance for ${p?.name}`} size="sm" variant="tray" className="self-start @md:self-auto" />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            {editing ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : null}
            <Button size="sm" variant="dark" onClick={save}>
              Save attendance
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
