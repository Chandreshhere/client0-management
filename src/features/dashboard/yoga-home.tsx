"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  ClipboardText,
  Flag,
  Package,
  PersonSimpleTaiChi,
  Siren,
  UserMinus,
  Warning,
  WarningCircle,
  CalendarCheck,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { usePlan } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Inset } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/misc";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { BarChart } from "@/components/charts/bar-chart";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { TASKS } from "@/data/care";
import { THREADS } from "@/data/records";
import { ATTENDANCE_LABEL, CLASSES, PACKAGES } from "@/data/programs";
import type { AttendanceState, YogaClass } from "@/data/types";
import { NOW_LABEL, NOW_MIN, TODAY_KEY, daysSince, istDayKey, istMinutes, shortDate, untilLabel } from "./data";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, LockedTile, NowMarker, Panel, PanelEmpty, Reveal, RowLink, Rail} from "./ui";
import { WEEK_CLASSES, attendanceBySession, organFor, type AttendanceBucket } from "./derive";
import { OrganBadge } from "./viz";

/**
 * Yoga instructor home (doc §2D): which sessions are running, who is attending, and what guidance
 * is needed before starting. Classes share one studio, so the day view covers every session in the
 * branch's studio rooms with the instructor's own sessions marked "You".
 */
const ME = DEMO_USER.yoga.personId;
const BRANCH = staffById(ME)?.branch;

const todayClasses = CLASSES.filter((c) => istDayKey(c.start) === TODAY_KEY && staffById(c.instructorId)?.branch === BRANCH).sort((a, b) => a.start.localeCompare(b.start));
const nextClass = todayClasses.find((c) => istMinutes(c.start) > NOW_MIN) ?? null;
const myClassToday = todayClasses.find((c) => c.instructorId === ME && istMinutes(c.start) + c.durationMin <= NOW_MIN) ?? null;
const myClasses = CLASSES.filter((c) => c.instructorId === ME);

const escalations = TASKS.filter((t) => t.createdBy === ME && /escalated/i.test(t.source) && t.status !== "done");
const packages = [...PACKAGES].sort((a, b) => a.total - a.used - (b.total - b.used));

type Mark = "present" | "late" | "absent";
const MARKS: { value: Mark; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];
const isMark = (a: AttendanceState): a is Mark => a === "present" || a === "late" || a === "absent";

const activeEnrolled = (c: YogaClass) => c.enrolled.filter((e) => e.attendance !== "cancelled");

export function YogaHome() {
  const { toast } = useToast();
  const initial = useMemo(() => Object.fromEntries((myClassToday?.enrolled ?? []).map((e) => [e.patientId, isMark(e.attendance) ? e.attendance : "present"])) as Record<string, Mark>, []);
  const [saved, setSaved] = useState<Record<string, Mark>>(initial);
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({});
  const [seatedOut, setSeatedOut] = useState<Record<string, string>>({});
  const dirty = Object.keys(marks).some((k) => marks[k] !== saved[k]);

  // Repeated missed sessions: absences in my classes, with today's roster read from the local marks.
  const missed = useMemo(() => {
    const byPatient = new Map<string, string[]>();
    for (const c of myClasses) {
      for (const e of c.enrolled) {
        const state = c.id === myClassToday?.id ? marks[e.patientId] : e.attendance;
        if (state === "absent") byPatient.set(e.patientId, [...(byPatient.get(e.patientId) ?? []), c.start]);
      }
    }
    return [...byPatient.entries()].filter(([, dates]) => dates.length >= 2).map(([patientId, dates]) => ({ patientId, dates: dates.sort() }));
  }, [marks]);

  const issuesFor = (c: YogaClass) =>
    activeEnrolled(c).filter((e) => e.clearance !== "current" && !(e.clearance === "changed" && acknowledged[e.patientId]) && !seatedOut[`${c.id}:${e.patientId}`]);

  const saveAttendance = () => {
    setSaved(marks);
    toast({ tone: "success", title: "Attendance saved", description: `${myClassToday?.title} · saved in this browser session only.` });
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`Studio today: ${pluralize(todayClasses.length, "session")} · ${pluralize(todayClasses.reduce((n, c) => n + issuesFor(c).length, 0), "clearance alert")} · ${pluralize(escalations.length, "escalation")} open`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href={myClassToday ? `/classes/${myClassToday.id}` : "/classes"}>
                <ClipboardText />
                Today&apos;s roster
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/tasks?new=1">
                <Flag />
                Escalate a concern
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          {nextClass ? (
            <NextSessionCard
              cls={nextClass}
              issues={issuesFor(nextClass)}
              acknowledged={acknowledged}
              seatedOut={seatedOut}
              onAcknowledge={(pid) => {
                setAcknowledged((s) => ({ ...s, [pid]: NOW_LABEL }));
                toast({ tone: "success", title: `Precautions reviewed · ${patientById(pid)?.name}`, description: "Acknowledged in this browser session. The clinician's change stays attributed to them." });
              }}
              onSeatOut={(pid) => {
                setSeatedOut((s) => ({ ...s, [`${nextClass.id}:${pid}`]: NOW_LABEL }));
                toast({ title: `${patientById(pid)?.name} sits out ${nextClass.title}`, description: "Clearance renewal request recorded locally — nothing was sent." });
              }}
            />
          ) : (
            <Inset className="flex h-full items-center justify-center text-sm text-muted">No more sessions in the studio today.</Inset>
          )}
        </Reveal>

        <Reveal index={1}>
          <Panel icon={<PersonSimpleTaiChi />} title="Classes & 1:1s today" subtitle={`${pluralize(todayClasses.length, "session")} · ${staffById(ME)?.room} & Therapy Room`} href="/classes" actionLabel="Open classes">
            {todayClasses.map((c) => {
              const enrolled = activeEnrolled(c).length;
              const issues = issuesFor(c).length;
              const mine = c.instructorId === ME;
              const done = istMinutes(c.start) + c.durationMin <= NOW_MIN;
              const showMarker = c.id === nextClass?.id;
              return (
                <div key={c.id} className="contents">
                  {showMarker ? <NowMarker /> : null}
                  <RowLink href={`/classes/${c.id}`} className="flex flex-col gap-3">
                    <span className="flex items-start gap-3">
                      <span className="w-12 shrink-0">
                        <span className={cn("block text-sm tabular", done ? "text-muted" : "text-ink")}>{formatTime(c.start)}</span>
                        <span className="block text-xs text-muted">{c.durationMin} min</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", done ? "text-ink-2" : "text-ink")}>{c.title}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <Avatar src={staffById(c.instructorId)?.avatar} name={staffById(c.instructorId)?.name ?? ""} size="xs" />
                          <span className="min-w-0 truncate">{mine ? "You" : staffById(c.instructorId)?.name} · {c.kind === "group" ? "Group" : "1:1"}</span>
                        </span>
                      </span>
                      {issues ? (
                        <StatusBadge tone="warning">{pluralize(issues, "alert")}</StatusBadge>
                      ) : done ? (
                        <StatusBadge tone="success">Done</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Ready</StatusBadge>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <ProgressBar value={enrolled} max={c.capacity} tone="dark" label={`${c.title}: ${enrolled} of ${c.capacity} places`} className="flex-1" />
                      <span className="shrink-0 text-xs text-muted tabular">
                        {enrolled}/{c.capacity}
                        {c.waitlist.length ? ` · ${c.waitlist.length} waiting` : ""}
                      </span>
                    </span>
                  </RowLink>
                </div>
              );
            })}
          </Panel>
        </Reveal>

        <Reveal index={2} className="flex flex-col gap-4 lg:col-span-2">
          <WeekAttendancePanel saved={saved} />
          {myClassToday ? (
            <Panel
              icon={<CalendarCheck />}
              title={`Attendance · ${myClassToday.title}`}
              subtitle={`${formatTime(myClassToday.start)} · ${myClassToday.room} · ${summarise(marks)}`}
              href={`/classes/${myClassToday.id}`}
              actionLabel="Open class roster"
            >
              {myClassToday.enrolled.map((e) => {
                const p = patientById(e.patientId);
                return (
                  <div key={e.patientId} className="@container rounded-inner bg-surface p-4">
                    <div className="flex flex-col gap-3 @md:flex-row @md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{p?.name}</p>
                          <p className="truncate text-xs text-muted">{e.precaution ?? "No session precautions"}</p>
                        </div>
                      </div>
                      <Segmented
                        items={MARKS}
                        value={marks[e.patientId]}
                        onChange={(v) => setMarks((s) => ({ ...s, [e.patientId]: v }))}
                        ariaLabel={`Attendance for ${p?.name}`}
                        size="sm"
                        variant="tray"
                        className="self-start @md:self-auto"
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-2">
                <p className="text-xs text-muted" aria-live="polite">
                  {dirty ? "Unsaved changes" : `Saved · ${ATTENDANCE_LABEL.present} ${count(saved, "present")}, ${ATTENDANCE_LABEL.late.toLowerCase()} ${count(saved, "late")}, ${ATTENDANCE_LABEL.absent.toLowerCase()} ${count(saved, "absent")}`}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setMarks(saved)}>
                    Reset
                  </Button>
                  <Button size="sm" variant="dark" disabled={!dirty} onClick={saveAttendance}>
                    Save attendance
                  </Button>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel icon={<CalendarCheck />} title="Attendance" subtitle="Nothing to mark yet">
              <PanelEmpty icon={<CalendarCheck />} title="No finished class to mark" description="Attendance opens when your first session of the day starts." />
            </Panel>
          )}
        </Reveal>

        <Rail index={3} innerClassName="flex flex-col gap-4">
          <Panel icon={<Siren />} title="Escalations" subtitle={`${pluralize(escalations.length, "concern")} with the care team`} href="/tasks" actionLabel="Open tasks">
            {escalations.length === 0 ? (
              <PanelEmpty icon={<Siren />} title="Nothing escalated" description="Raise a concern and the care team gets a task — you never need to interpret it as a diagnosis." />
            ) : (
              escalations.map((t) => {
                const p = patientById(t.patientId);
                const owner = staffById(t.ownerId);
                const thread = THREADS.find((m) => m.patientId === t.patientId && m.channel === "care-team");
                return (
                  <div key={t.id} className="rounded-inner bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{p?.name}</p>
                        <p className="text-xs text-muted">{sentence(t.title.replace(/^Clinical review:\s*/i, ""))}</p>
                      </div>
                      <StatusBadge tone="danger">Urgent</StatusBadge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                      <Avatar src={owner?.avatar} name={owner?.name ?? ""} size="xs" />
                      With {owner?.name} · not started · due {formatTime(t.due)}
                    </div>
                    {thread ? (
                      <Link href="/messages" className="mt-3 flex items-start gap-2 rounded-[12px] bg-sunken p-3 text-xs text-ink-2 transition-colors hover:bg-sunken-2">
                        <span className="min-w-0 flex-1">
                          “{thread.lastMessage}”<span className="mt-1 block text-muted">{thread.unread} unread · {thread.expectedResponse}</span>
                        </span>
                        <ArrowUpRight size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                );
              })
            )}
          </Panel>
          <MissedSessionsPanel missed={missed} />
        </Rail>

        <Reveal index={4} className="lg:col-span-2 xl:col-span-3">
          <PackagesPanel />
        </Reveal>
      </DashGrid>
    </div>
  );
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const count = (m: Record<string, Mark>, v: Mark) => Object.values(m).filter((x) => x === v).length;
const summarise = (m: Record<string, Mark>) => `${count(m, "present")} present · ${count(m, "late")} late · ${count(m, "absent")} absent`;

const BUCKETS: { id: AttendanceBucket; name: string; color: string }[] = [
  { id: "present", name: "Present", color: "var(--color-charcoal)" },
  { id: "late", name: "Late", color: "var(--color-warning)" },
  { id: "absent", name: "Absent", color: "var(--color-danger)" },
  { id: "pending", name: "Booked, not held yet", color: "var(--color-line-strong)" },
];

/** This week's studio sessions (Mon 9 – Sat 14), attendance stacked per session; today's class uses the saved marks. */
function WeekAttendancePanel({ saved }: { saved: Record<string, Mark> }) {
  const rows = attendanceBySession(WEEK_CLASSES(BRANCH), myClassToday ? { classId: myClassToday.id, marks: saved } : undefined);
  const categories = rows.map((r) => `${formatDate(r.cls.start, { weekday: "short" })} ${formatTime(r.cls.start)}`);
  const values = BUCKETS.map((b) => rows.map((r) => r.counts[b.id]));
  const held = rows.filter((r) => istMinutes(r.cls.start) + r.cls.durationMin <= NOW_MIN || istDayKey(r.cls.start) < TODAY_KEY);
  const sum = (b: AttendanceBucket, list = rows) => list.reduce((n, r) => n + r.counts[b], 0);
  const nextIdx = rows.findIndex((r) => !held.includes(r));
  return (
    <Panel icon={<ChartBar />} title="Attendance this week" subtitle={`Studio · ${pluralize(rows.length, "session")} Mon–Sat`} href="/classes" actionLabel="Open classes">
      <div className="flex flex-col gap-3 rounded-inner bg-surface p-4">
        <BarChart
          categories={categories}
          series={BUCKETS}
          values={values}
          height={200}
          highlight={nextIdx >= 0 ? nextIdx : undefined}
          formatY={(v) => String(v)}
          ariaLabel={`Attendance per studio session this week: ${rows.map((r, i) => `${categories[i]} ${r.cls.title}: ${BUCKETS.map((b) => `${r.counts[b.id]} ${b.name.toLowerCase()}`).join(", ")}`).join("; ")}`}
        />
        <p className="text-xs text-muted">
          {pluralize(held.length, "session")} held: {sum("present", held)} present, {sum("late", held)} late, {sum("absent", held)} absent · {rows.length - held.length} still to come with {sum("pending")} places booked{nextIdx >= 0 ? ` · next ${categories[nextIdx]}` : ""}
        </p>
        <details className="group">
          <summary className="flex h-8 w-fit cursor-pointer list-none items-center rounded-full bg-sunken px-3 text-xs text-ink transition-colors hover:bg-sunken-2 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show as table</span>
            <span className="hidden group-open:inline">Hide table</span>
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <caption className="sr-only">Attendance per studio session this week</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-1 pr-2 font-normal">Session</th>
                  {BUCKETS.map((b) => (
                    <th key={b.id} scope="col" className="px-1 py-1 text-right font-normal">
                      {b.id === "pending" ? "Booked" : b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular text-ink">
                {rows.map((r, i) => (
                  <tr key={r.cls.id} className="border-t border-line">
                    <th scope="row" className="py-1 pr-2 font-normal">
                      {categories[i]} · {r.cls.title}
                    </th>
                    {BUCKETS.map((b) => (
                      <td key={b.id} className="px-1 py-1 text-right">
                        {r.counts[b.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Panel>
  );
}

function MissedSessionsPanel({ missed }: { missed: { patientId: string; dates: string[] }[] }) {
  const { has } = usePlan();
  const { toast } = useToast();
  const [routed, setRouted] = useState<Record<string, string>>({});
  const coordinator = staffById(DEMO_USER.coordinator.personId);
  return (
    <Panel icon={<UserMinus />} title="Repeated missed sessions" subtitle={missed.length ? `${pluralize(missed.length, "patient")} absent twice or more` : "No repeated absences"} href="/classes" actionLabel="Open classes">
      <AnimatePresence initial={false} mode="popLayout">
        {missed.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PanelEmpty icon={<UserMinus />} title="Everyone is turning up" description="Two or more absences in your classes are flagged here." />
          </motion.div>
        ) : (
          missed.map(({ patientId, dates }) => {
            const p = patientById(patientId);
            const pkg = PACKAGES.find((x) => x.patientId === patientId);
            return (
              <motion.div key={patientId} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={snappy} className="rounded-inner bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{p?.name}</p>
                    <p className="text-xs text-muted">
                      Absent {dates.map((d) => shortDate(d)).join(" and ")}
                      {pkg ? ` · ${pkg.total - pkg.used} sessions left` : ""}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{pluralize(dates.length, "miss", "misses")}</StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {routed[patientId] ? (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle size={16} weight="fill" aria-hidden="true" />
                      Routed to {coordinator?.name} at {routed[patientId]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Last session {shortDate(dates[dates.length - 1])} · {daysSince(dates[dates.length - 1]) === 0 ? "today" : `${daysSince(dates[dates.length - 1])} days ago`}</span>
                  )}
                  {has("coordinator") ? (
                    !routed[patientId] ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRouted((s) => ({ ...s, [patientId]: NOW_LABEL }));
                          toast({ title: `Flagged to ${coordinator?.name}`, description: "Recorded in this browser session — nothing was sent." });
                        }}
                      >
                        Route to coordinator
                      </Button>
                    ) : null
                  ) : (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/tasks?new=1">Create follow-up task</Link>
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </Panel>
  );
}

function PackagesPanel() {
  const { has } = usePlan();
  if (!has("packages")) {
    return <LockedTile feature="packages" icon={<Package />} title="Package balances" description="See each patient's remaining sessions and expiry before you add them to a class." />;
  }
  return (
    <Panel icon={<Package />} title="Package balances" subtitle={`${PACKAGES.length} active packages · lowest first`} href="/billing/packages" actionLabel="Open packages">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => {
          const p = patientById(pkg.patientId);
          const left = pkg.total - pkg.used;
          const expiresIn = -daysSince(pkg.expires);
          const low = left <= 2 || expiresIn <= 21;
          return (
            <div key={pkg.patientId} className="rounded-inner bg-surface p-4">
              <div className="flex items-start gap-3">
                <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p?.name}</p>
                  <p className="truncate text-xs text-muted">{pkg.name}</p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-sm text-ink tabular">{left} left</span>
                  <span className="block text-xs text-muted tabular">
                    {pkg.used}/{pkg.total} used
                  </span>
                </span>
              </div>
              <ProgressBar value={pkg.used} max={pkg.total} tone={left <= 2 ? "warning" : "dark"} className="mt-3" label={`${p?.name}: ${pkg.used} of ${pkg.total} sessions used`} />
              <p className={cn("mt-2 flex items-center gap-1.5 text-xs", low ? "text-warning" : "text-muted")}>
                {low ? <Warning size={14} aria-hidden="true" /> : null}
                Expires {formatDate(pkg.expires, { day: "numeric", month: "short" })} · in {pluralize(expiresIn, "day")}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: next session, roster preview and clearance alerts that block the start
// ---------------------------------------------------------------------------------------------

function NextSessionCard({
  cls,
  issues,
  acknowledged,
  seatedOut,
  onAcknowledge,
  onSeatOut,
}: {
  cls: YogaClass;
  issues: YogaClass["enrolled"];
  acknowledged: Record<string, string>;
  seatedOut: Record<string, string>;
  onAcknowledge: (patientId: string) => void;
  onSeatOut: (patientId: string) => void;
}) {
  const id = useId();
  const instructor = staffById(cls.instructorId);
  const enrolled = activeEnrolled(cls);
  const flagged = enrolled.filter((e) => e.clearance !== "current");
  const blocked = issues.length > 0;
  const attending = enrolled.filter((e) => !seatedOut[`${cls.id}:${e.patientId}`]);

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label={`Next session · ${cls.room}`}
        title={cls.title}
        meta={
          <>
            {formatTime(cls.start)}–{formatTime(new Date(new Date(cls.start).getTime() + cls.durationMin * 60_000).toISOString())} · {cls.instructorId === ME ? "You" : instructor?.name} · {cls.kind === "group" ? "Group class" : "1:1"} ·{" "}
            {attending.length} of {cls.capacity} places{cls.waitlist.length ? ` · ${cls.waitlist.length} on waitlist` : ""}
          </>
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{formatTime(cls.start)}</p>
            <p className="text-xs text-white/90">{untilLabel(cls.start)}</p>
          </div>
        }
      />

      {/* Roster: each participant's primary condition (organ) beside the precaution it drives */}
      <div className="px-4 pb-2">
        <p className="text-xs text-white/90">Roster · {cls.focus} · organ = each person&apos;s primary recorded condition</p>
      </div>
      <ul className="grid grid-cols-1 gap-x-2 gap-y-1 rounded-inner bg-surface p-2 text-ink md:grid-cols-2" aria-label={`Roster for ${cls.title}`}>
        {enrolled.map((e) => {
          const p = patientById(e.patientId);
          const organ = organFor(e.patientId);
          const out = !!seatedOut[`${cls.id}:${e.patientId}`];
          const alert = e.clearance !== "current" && !(e.clearance === "changed" && acknowledged[e.patientId]) && !out;
          return (
            <li key={e.patientId} className={cn("flex items-center gap-3 rounded-[12px] p-2", alert && "bg-warning-soft/60")}>
              {organ ? (
                <Tip label={`${organ.label} · ${organ.condition}`}>
                  <span tabIndex={0} className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-primary">
                    <OrganBadge kind={organ.kind} size={40} tone="sunken" label={`${organ.label}, from ${organ.condition}`} />
                  </span>
                </Tip>
              ) : (
                <Avatar src={p?.avatar} name={p?.name ?? ""} size="md" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-1.5 text-sm text-ink", out && "text-muted line-through")}>
                  <span className="truncate">{p?.name}</span>
                  {alert ? <WarningCircle size={14} weight="fill" className="shrink-0 text-warning" aria-label="Clearance alert" /> : null}
                </span>
                <span className="block truncate text-xs text-muted">
                  {out ? "Sitting out today" : e.precaution ? e.precaution : `No session precautions${organ ? ` · ${organ.condition}` : ""}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Clearance alerts — each blocks the start until handled */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {flagged.map((e) => {
          const p = patientById(e.patientId)!;
          const out = seatedOut[`${cls.id}:${e.patientId}`];
          const ack = e.clearance === "changed" ? acknowledged[e.patientId] : undefined;
          const resolved = !!out || !!ack;
          return (
            <li key={e.patientId} className="flex flex-col rounded-inner bg-surface p-4 text-ink">
              <div className="flex items-start gap-3">
                <Avatar src={p.avatar} name={p.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{e.precaution}</p>
                </div>
                {resolved ? (
                  <StatusBadge tone="success">{ack ? "Reviewed" : "Sitting out"}</StatusBadge>
                ) : (
                  <StatusBadge tone={e.clearance === "expired" ? "danger" : "warning"}>{e.clearance === "expired" ? "Clearance expired" : "Clearance changed"}</StatusBadge>
                )}
              </div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                <span className="text-xs text-muted">{resolved ? `Handled at ${ack ?? out}` : "Blocks the session start"}</span>
                {!resolved ? (
                  e.clearance === "changed" ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="dark" aria-label={`Review new precautions for ${p.name}`}>
                          Review change
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(340px,calc(100vw-32px))] p-4">
                        <p className="text-sm text-ink">New guidance for {p.name}</p>
                        <p className="mt-2 text-sm text-ink-2">{changedGuidance(p.id)?.text ?? e.precaution}</p>
                        <p className="mt-2 text-xs text-muted">{changedGuidance(p.id)?.by ?? "Clinician-approved precaution"} · applies to every session today</p>
                        <div className="mt-4 flex justify-end gap-2">
                          <PopoverClose asChild>
                            <Button size="sm" variant="ghost">
                              Not now
                            </Button>
                          </PopoverClose>
                          <PopoverClose asChild>
                            <Button size="sm" variant="dark" onClick={() => onAcknowledge(p.id)}>
                              I&apos;ve reviewed this
                            </Button>
                          </PopoverClose>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="dark" aria-label={`Handle expired clearance for ${p.name}`}>
                          Handle
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(340px,calc(100vw-32px))] p-4">
                        <p className="text-sm text-ink">{p.name}&apos;s clearance has expired</p>
                        <p className="mt-2 text-sm text-ink-2">Only a clinician can renew it. Until then {p.name.split(" ")[0]} can&apos;t join this session.</p>
                        <div className="mt-4 flex justify-end gap-2">
                          <PopoverClose asChild>
                            <Button size="sm" variant="ghost">
                              Cancel
                            </Button>
                          </PopoverClose>
                          <PopoverClose asChild>
                            <Button size="sm" variant="dark" onClick={() => onSeatOut(p.id)}>
                              Sit out &amp; request renewal
                            </Button>
                          </PopoverClose>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 p-4 pt-2">
        {blocked ? (
          <Tip label={`Resolve ${pluralize(issues.length, "clearance alert")} first`}>
            <span tabIndex={0} className="inline-flex rounded-full">
              <Button variant="secondary" className="shadow-none" disabled aria-describedby={`${id}-blocked`}>
                Start session
              </Button>
            </span>
          </Tip>
        ) : (
          <Button asChild variant="secondary" className="shadow-none">
            <Link href={`/classes/${cls.id}`}>Start session</Link>
          </Button>
        )}
        <Button asChild variant="glass">
          <Link href={`/classes/${cls.id}`}>
            Open roster
            <ArrowUpRight />
          </Link>
        </Button>
        <p id={`${id}-blocked`} className="flex items-center gap-1.5 text-xs text-white" aria-live="polite">
          {blocked ? (
            <>
              <WarningCircle size={16} weight="fill" aria-hidden="true" />
              Start blocked — {issues.map((e) => patientById(e.patientId)?.name.split(" ")[0]).join(" and ")} {issues.length === 1 ? "needs" : "need"} attention
            </>
          ) : (
            <>
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              Clearances handled — ready to start
            </>
          )}
        </p>
      </div>
    </FocalCard>
  );
}

/** The attributed version of a changed precaution, e.g. "SpO₂ floor 92% (changed 13 Nov by Dr. Sana Qureshi)". */
function changedGuidance(patientId: string): { text: string; by: string } | null {
  for (const e of CLASSES.flatMap((c) => c.enrolled)) {
    if (e.patientId !== patientId || e.clearance !== "changed" || !e.precaution) continue;
    const m = e.precaution.match(/^(.*?)\s*\((changed .+ by .+)\)$/i);
    if (m) return { text: m[1], by: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
  }
  return null;
}
