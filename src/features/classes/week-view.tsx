"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUpRight, CalendarCheck, CaretRight, Hourglass, Plus, ShieldCheck, ShieldWarning, Warning } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { STAFF, staffById } from "@/data/staff";
import { formatDate, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { ChipGroup } from "@/components/viz/cards";
import { useRole } from "@/components/shell/role-context";
import { scrollToElement } from "@/lib/scroll";
import { CLEARANCES } from "./data";
import { TODAY_KEY, WEEK_DAYS, allClasses, attendanceRate, endOf, openIssues, phaseOf, precautionText, recurrence, repeatedAbsence, savedMark, type ClassesState } from "./model";
import { BOARD_FILTER_LABEL, matchesFilter, type BoardFilter } from "./insight";
import { AttendanceChart, SeatDots, SeatLegend } from "./viz";
import { useClasses } from "./store";
import { ClearanceReview } from "./clearance-review";
import { LogSessionModal } from "./log-session-modal";
import { usePrecautionDecision } from "./use-precaution-decision";

/**
 * /classes — Sessions (spec F7). Core: a simple list of this week's sessions, grouped by day.
 * Clinic+ (recurring group classes): the week schedule with capacity, recurrence and the waitlist.
 * Both start with the precautions the instructor must acknowledge before a session can start.
 * Instructors see precautions only — never diagnoses (rule 3).
 */
type Enrolment = YogaClass["enrolled"][number];
type Scope = "mine" | "all" | (string & {});

export function ClassesWeek() {
  const s = useClasses();
  const { role, user, has } = useRole();
  const scheduling = has("group-classes");
  const waitlistOn = has("waitlist");
  const isInstructor = role === "yoga";
  const [scope, setScope] = useState<Scope>(isInstructor ? "mine" : "all");
  const [logOpen, setLogOpen] = useState(false);
  const instructors = STAFF.filter((x) => x.role === "yoga");

  const classes = allClasses(s);
  const visible = useMemo(() => classes.filter((c) => (scope === "all" ? true : scope === "mine" ? c.instructorId === user.id : c.instructorId === scope)), [classes, scope, user.id]);
  const upcoming = visible.filter((c) => phaseOf(s, c) !== "ended");

  const scopeItems = isInstructor
    ? [
        { value: "mine", label: "My sessions", count: classes.filter((c) => c.instructorId === user.id).length },
        { value: "all", label: "All instructors", count: classes.length },
      ]
    : [
        { value: "all", label: "All instructors", count: classes.length },
        ...instructors.map((x) => ({ value: x.id, label: x.name.split(" ")[0], icon: <Avatar src={x.avatar} name={x.name} size="xs" className="-ml-2" />, count: classes.filter((c) => c.instructorId === x.id).length })),
      ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sessions"
        description={
          scheduling
            ? "Group classes and 1:1 sessions, Mon 9 – Sat 14 Nov. Acknowledge changed precautions, mark attendance and write progress notes."
            : "Your 1:1 and group sessions this week. Read changed precautions before you start, mark attendance and write a progress note."
        }
        actions={
          <>
            <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1">
              <Segmented<Scope> ariaLabel="Whose sessions" size="md" value={scope} onChange={setScope} items={scopeItems} />
            </div>
            {isInstructor ? (
              <Button variant="primary" leading={<Plus weight="bold" />} onClick={() => setLogOpen(true)}>
                Log a session
              </Button>
            ) : null}
          </>
        }
      />

      <AcknowledgeStrip s={s} upcoming={upcoming} canAct={isInstructor} />

      {scheduling ? <WeekSchedule s={s} visible={visible} upcoming={upcoming} waitlistOn={waitlistOn} /> : <SessionList s={s} visible={visible} mine={scope === "mine"} onLog={isInstructor ? () => setLogOpen(true) : undefined} />}

      <LogSessionModal open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ precautions to acknowledge */

/** One row per participant whose precaution changed (or whose approval expired) before an upcoming session. */
function AcknowledgeStrip({ s, upcoming, canAct }: { s: ClassesState; upcoming: YogaClass[]; canAct: boolean }) {
  const decide = usePrecautionDecision();
  const [review, setReview] = useState<{ cls: YogaClass; e: Enrolment } | null>(null);
  const items = useMemo(() => {
    const byPatient = new Map<string, { e: Enrolment; first: YogaClass; sessions: number }>();
    for (const c of upcoming) {
      for (const e of openIssues(s, c)) {
        const cur = byPatient.get(e.patientId);
        byPatient.set(e.patientId, cur ? { ...cur, sessions: cur.sessions + 1 } : { e, first: c, sessions: 1 });
      }
    }
    return [...byPatient.values()];
  }, [s, upcoming]);

  if (!items.length) {
    return upcoming.length ? (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ShieldCheck size={18} className="shrink-0 text-success" aria-hidden="true" />
        Every precaution for the sessions ahead is acknowledged.
      </p>
    ) : null;
  }

  return (
    <Group aria-labelledby="ack-title">
      <GroupHeader
        icon={<ShieldWarning className="text-warning" />}
        title={<h2 id="ack-title">Precautions to acknowledge</h2>}
        subtitle="The doctor changed these since you last read them. A session can't start until each one is acknowledged."
      />
      <ul className="flex flex-col gap-2">
        {items.map(({ e, first, sessions }) => {
          const p = patientById(e.patientId);
          const c = CLEARANCES[e.patientId];
          const by = staffById(c?.by);
          return (
            <li key={e.patientId} className="flex flex-col gap-3 rounded-inner bg-surface p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="md" />
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {p?.name} <span className="text-muted">· {e.clearance === "expired" ? "approval expired" : "changed"}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">{precautionText(e.precaution) ?? "No precaution text on record"}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {by ? `${e.clearance === "expired" ? "Approved" : "Changed"} by ${by.name}${c ? `, ${formatDate(c.at, { day: "numeric", month: "short" })}` : ""} · ` : ""}
                    before {first.title}, {formatDate(first.start, { weekday: "short" })} {formatTime(first.start)}
                    {sessions > 1 ? ` and ${pluralize(sessions - 1, "other session")}` : ""}
                  </p>
                </div>
              </div>
              {canAct ? (
                <Button variant="dark" size="sm" className="self-start sm:self-center" onClick={() => setReview({ cls: first, e })}>
                  {e.clearance === "expired" ? "Review" : "Read & acknowledge"}
                </Button>
              ) : (
                <span className="text-xs text-muted sm:max-w-[180px] sm:text-right">The instructor acknowledges this</span>
              )}
            </li>
          );
        })}
      </ul>
      {review ? (
        <ClearanceReview
          target={review.e}
          cls={review.cls}
          onClose={() => setReview(null)}
          onDecide={(e, d) => {
            const target = review;
            setReview(null);
            decide(target.cls, e, d, items.length - 1);
          }}
        />
      ) : null}
    </Group>
  );
}

/* ------------------------------------------------------------------ Core: simple session list */

const dayLabel = (day: string) => formatDate(`${day}T12:00:00+05:30`, { weekday: "long", day: "numeric", month: "short" });

function SessionList({ s, visible, mine, onLog }: { s: ClassesState; visible: YogaClass[]; mine: boolean; onLog?: () => void }) {
  const days = [...new Set(visible.map((c) => c.start.slice(0, 10)))];
  const today = days.filter((d) => d === TODAY_KEY);
  const ahead = days.filter((d) => d > TODAY_KEY).sort();
  const earlier = days.filter((d) => d < TODAY_KEY).sort().reverse();

  if (!visible.length) {
    return (
      <Group>
        <EmptyState
          icon={<CalendarCheck />}
          title={mine ? "No sessions logged for you this week" : "No sessions this week"}
          description="Log a 1:1 or group session to mark attendance and write progress notes."
          action={
            onLog ? (
              <Button variant="dark" leading={<Plus weight="bold" />} onClick={onLog}>
                Log a session
              </Button>
            ) : undefined
          }
          className="rounded-inner bg-surface"
        />
      </Group>
    );
  }

  const section = (title: string, list: string[], id: string) =>
    list.length ? (
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <h2 id={id} className="text-sm text-ink">
          {title}
        </h2>
        {list.map((day) => {
          const items = visible.filter((c) => c.start.startsWith(day));
          return (
            <Group key={day} aria-label={dayLabel(day)}>
              <div className="flex items-center justify-between gap-2 p-2">
                <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-sm", day === TODAY_KEY ? "bg-charcoal text-white" : "bg-surface text-ink")}>{dayLabel(day)}</span>
                <span className="text-xs text-muted">{pluralize(items.length, "session")}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {items.map((c) => (
                  <li key={c.id}>
                    <SessionRow cls={c} s={s} />
                  </li>
                ))}
              </ul>
            </Group>
          );
        })}
      </section>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      {section("Today", today, "list-today")}
      {section("Coming up", ahead, "list-ahead")}
      {section("Earlier this week", earlier, "list-earlier")}
    </div>
  );
}

function sessionStatus(s: ClassesState, c: YogaClass) {
  const phase = phaseOf(s, c);
  if (phase === "in-progress") return { text: `In progress since ${formatTime(s.sessions[c.id]?.startedAt ?? c.start)}`, tone: "text-success" };
  if (phase === "ended") {
    const marked = c.enrolled.filter((e) => savedMark(s, c, e).state !== "pending");
    const came = c.enrolled.filter((e) => ["present", "late"].includes(savedMark(s, c, e).state)).length;
    const counted = c.enrolled.filter((e) => ["present", "late", "absent"].includes(savedMark(s, c, e).state)).length;
    return marked.length < c.enrolled.length ? { text: "Attendance to mark", tone: "text-warning" } : { text: `${came} of ${counted} came`, tone: "text-muted" };
  }
  return { text: `Starts ${relativeTime(c.start)}`, tone: "text-ink-2" };
}

function SessionRow({ cls, s }: { cls: YogaClass; s: ClassesState }) {
  const issues = openIssues(s, cls);
  const precautions = cls.enrolled.filter((e) => e.precaution).length;
  const people = cls.enrolled.map((e) => patientById(e.patientId)).filter((p): p is NonNullable<typeof p> => !!p);
  const inst = staffById(cls.instructorId);
  const st = sessionStatus(s, cls);
  return (
    <Link
      href={`/classes/${cls.id}`}
      className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-inner bg-surface p-4 transition-shadow duration-200 hover:shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] md:grid-cols-[72px_minmax(0,1fr)_200px_auto]"
    >
      <span className="text-sm text-ink tabular">
        {formatTime(cls.start)}
        <span className="block text-xs text-muted">{cls.durationMin} min</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{cls.title}</span>
        <span className="block truncate text-xs text-muted">
          {cls.kind === "group" ? "Group" : "1:1"} · {cls.room} · {inst?.name.split(" ")[0]}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
          <RowBadges issues={issues.length} precautions={precautions} />
          <span className={cn("text-xs", st.tone)}>{st.text}</span>
        </span>
      </span>
      <span className="hidden min-w-0 flex-col gap-1.5 md:flex">
        <span className="flex items-center gap-2">
          <AvatarStack people={people.map((p) => ({ name: p.name, avatar: p.avatar }))} max={4} size="xs" />
          <span className="text-xs text-muted tabular">{pluralize(people.length, "patient")}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <RowBadges issues={issues.length} precautions={precautions} />
          <span className={cn("text-xs", st.tone)}>{st.text}</span>
        </span>
      </span>
      <CaretRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function RowBadges({ issues, precautions }: { issues: number; precautions: number }) {
  if (issues) return <StatusBadge tone="warning">{issues} to acknowledge</StatusBadge>;
  if (!precautions) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      <ShieldCheck size={14} aria-hidden="true" /> {pluralize(precautions, "precaution")}
    </span>
  );
}

/* ------------------------------------------------------------------ Clinic+: week schedule */

const FILTERS: BoardFilter[] = ["review", "precautions", "waitlist", "absence", "individual"];

function WeekSchedule({ s, visible, upcoming, waitlistOn }: { s: ClassesState; visible: YogaClass[]; upcoming: YogaClass[]; waitlistOn: boolean }) {
  const [filters, setFilters] = useState<BoardFilter[]>([]);
  const filterIds = FILTERS.filter((f) => f !== "waitlist" || waitlistOn);
  const shown = visible.filter((c) => filters.every((f) => matchesFilter(s, c, f)));
  const today = visible.filter((c) => c.start.startsWith(TODAY_KEY));
  const next = upcoming.find((c) => c.start.startsWith(TODAY_KEY)) ?? upcoming[0] ?? null;
  const rate = attendanceRate(s, visible);
  const toAck = new Set(upcoming.flatMap((c) => openIssues(s, c).map((e) => e.patientId)));
  const waitlisted = upcoming.reduce((n, c) => n + c.waitlist.length, 0);
  const days = WEEK_DAYS.map((d) => ({ day: d, classes: shown.filter((c) => c.start.startsWith(d)) }));
  const lastEnded = [...visible].reverse().find((c) => phaseOf(s, c) === "ended");

  return (
    <>
      <section aria-label="This week at a glance" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <UpNext cls={next} s={s} waitlistOn={waitlistOn} />
          <article aria-label="Attendance this week" className="flex min-w-0 flex-col rounded-card bg-surface p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-xs text-muted">Attendance this week · finished sessions</p>
                <p className="mt-2 text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{rate.pct === null ? "—" : `${rate.pct}%`}</p>
              </div>
              <p className="max-w-[44ch] text-xs text-muted">{rate.marked ? `${rate.came} of ${rate.marked} marked participants came (present or late). Cancelled and held places don't count.` : "No finished sessions in this view yet."}</p>
            </div>
            <AttendanceChart s={s} classes={visible} highlightId={lastEnded?.id} height={176} showCapacity className="mt-4" emptyText="Attendance appears here once a session in this view has finished." />
          </article>
        </div>
        <div className={cn("grid grid-cols-1 gap-4", waitlistOn ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Stat
            label="Sessions today"
            icon={<CalendarCheck />}
            value={today.length}
            context={today.length ? `${today.filter((c) => c.kind === "group").length} group · ${today.filter((c) => c.kind === "individual").length} one-to-one · ${today.filter((c) => phaseOf(s, c) === "ended").length} done` : "No sessions today"}
          />
          <Stat
            label="Precautions to acknowledge"
            icon={toAck.size ? <ShieldWarning className="text-warning" /> : <ShieldCheck />}
            value={toAck.size}
            context={toAck.size ? [...toAck].map((pid) => patientById(pid)?.name.split(" ")[0]).join(" · ") : "All acknowledged"}
          />
          {waitlistOn ? (
            <Stat label="Waiting for a place" icon={<Hourglass />} value={waitlisted} context={waitlisted ? upcoming.filter((c) => c.waitlist.length).map((c) => `${c.title} · ${formatDate(c.start, { weekday: "short" })}`).join(" · ") : "Nobody waiting"} />
          ) : null}
        </div>
      </section>

      <section aria-label="Week" className="@container">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-sm text-ink">Mon 9 – Sat 14 Nov</h2>
              <ChipGroup
                ariaLabel="Show only sessions with"
                variant="dark"
                value={filters}
                onChange={setFilters}
                options={filterIds.map((f) => ({ value: f, label: BOARD_FILTER_LABEL[f], count: visible.filter((c) => matchesFilter(s, c, f)).length }))}
              />
              {filters.length ? (
                <Button size="sm" variant="ghost" onClick={() => setFilters([])}>
                  Clear
                </Button>
              ) : null}
            </div>
            <a
              href={`#day-${TODAY_KEY}`}
              onClick={(e) => {
                const el = document.getElementById(`day-${TODAY_KEY}`);
                if (!el) return;
                e.preventDefault();
                const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 96;
                scrollToElement(el, margin);
                window.history.replaceState(null, "", `#day-${TODAY_KEY}`);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas @[1180px]:hidden"
            >
              Jump to today
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {filters.length ? `${pluralize(shown.length, "session")} with ${filters.map((f) => BOARD_FILTER_LABEL[f].toLowerCase()).join(" + ")}` : `${pluralize(visible.length, "session")} this week`}
            </p>
            <SeatLegend waitlist={waitlistOn} />
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-4 @[640px]:grid-cols-2 @[960px]:grid-cols-3 @[1180px]:grid-cols-6 @[1180px]:gap-2">
          {days.map(({ day, classes }) => (
            <DayColumn key={day} day={day} classes={classes} s={s} filtered={filters.length > 0} waitlistOn={waitlistOn} />
          ))}
        </div>
      </section>
    </>
  );
}

function UpNext({ cls, s, waitlistOn }: { cls: YogaClass | null; s: ClassesState; waitlistOn: boolean }) {
  if (!cls) {
    return (
      <div className="flex h-full min-h-[240px] flex-col justify-end rounded-card bg-primary p-6 text-white">
        <p className="text-sm text-white/75">Up next</p>
        <p className="mt-2 text-title font-light">No more sessions this week</p>
      </div>
    );
  }
  const inst = staffById(cls.instructorId);
  const issues = openIssues(s, cls);
  const people = cls.enrolled.map((e) => patientById(e.patientId)).filter((p): p is NonNullable<typeof p> => !!p);
  const phase = phaseOf(s, cls);
  const repeat = recurrence(s, cls);
  return (
    <article className="relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-card bg-primary p-6 text-white">
      <BreathRings />
      <div className="relative flex items-start justify-between gap-3">
        <Pill tone="instances-light">
          {phase === "in-progress" ? "In progress" : "Up next"} · {formatDate(cls.start, { weekday: "short" })} {formatTime(cls.start)}
        </Pill>
        <Link
          href={`/classes/${cls.id}`}
          aria-label={`Open ${cls.title}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-105 active:scale-95"
        >
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="relative mt-auto pt-8">
        <h2 className="text-title font-light">{cls.title}</h2>
        <p className="mt-2 text-sm text-white/75">
          {formatTime(cls.start)}–{formatTime(endOf(cls).toISOString())} · {cls.room} · {inst?.name}
          {repeat ? ` · ${repeat}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AvatarStack people={people.map((p) => ({ name: p.name, avatar: p.avatar }))} max={5} size="sm" />
          <span className="text-sm text-white/85 tabular">
            {cls.enrolled.length} of {cls.capacity} places{waitlistOn && cls.waitlist.length ? ` · ${cls.waitlist.length} waiting` : ""}
          </span>
        </div>
        {issues.length ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]">
            <Warning size={14} weight="fill" aria-hidden="true" />
            {pluralize(issues.length, "precaution")} to acknowledge before start
          </p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/80">
            <ShieldCheck size={14} aria-hidden="true" /> Precautions acknowledged — ready to start
          </p>
        )}
      </div>
    </article>
  );
}

/** Slow concentric "breath" rings — paced 4 s in / 6 s out, the cadence taught in class. */
function BreathRings() {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className="pointer-events-none absolute -right-[60px] top-[-8px] size-[280px] text-white">
      {[34, 58, 82].map((r, i) => (
        <motion.circle
          key={r}
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity={0.22 - i * 0.05}
          initial={{ scale: 0.94 }}
          animate={{ scale: [0.94, 1.06, 0.94] }}
          transition={{ duration: 10, times: [0, 0.4, 1], repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
        />
      ))}
    </svg>
  );
}

function DayColumn({ day, classes, s, filtered, waitlistOn }: { day: string; classes: YogaClass[]; s: ClassesState; filtered: boolean; waitlistOn: boolean }) {
  const isToday = day === TODAY_KEY;
  const label = formatDate(`${day}T12:00:00+05:30`, { weekday: "short" });
  const date = formatDate(`${day}T12:00:00+05:30`, { day: "numeric", month: "short" });
  return (
    <section id={`day-${day}`} aria-label={`${label} ${date}${isToday ? ", today" : ""}`} className="flex scroll-mt-28 flex-col rounded-card bg-sunken p-2">
      <header className="flex items-center justify-between gap-2 p-2">
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm", isToday ? "bg-charcoal text-white" : "bg-surface text-ink")}>
          {label} <span className={isToday ? "text-white/70" : "text-muted"}>{date.split(" ")[0]}</span>
        </span>
        <span className="text-xs text-muted">{isToday ? "Today" : classes.length ? pluralize(classes.length, "session") : ""}</span>
      </header>
      {classes.length ? (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {classes.map((c) => (
              <motion.li key={c.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
                <SessionCard cls={c} s={s} waitlistOn={waitlistOn} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-inner bg-surface/60 p-4 text-xs text-muted">{filtered ? "No sessions match these filters." : "No sessions."}</p>
      )}
    </section>
  );
}

function SessionCard({ cls, s, waitlistOn }: { cls: YogaClass; s: ClassesState; waitlistOn: boolean }) {
  const inst = staffById(cls.instructorId);
  const phase = phaseOf(s, cls);
  const issues = openIssues(s, cls);
  const precautions = cls.enrolled.filter((e) => e.precaution).length;
  const full = cls.enrolled.length >= cls.capacity;
  const repeat = recurrence(s, cls);
  const attended = cls.enrolled.filter((e) => ["present", "late"].includes(savedMark(s, cls, e).state)).length;
  const counted = cls.enrolled.filter((e) => ["present", "late", "absent"].includes(savedMark(s, cls, e).state)).length;
  const repeated = cls.enrolled.filter((e) => savedMark(s, cls, e).state === "absent" && repeatedAbsence(s, e.patientId, cls.start)).length;
  return (
    <Link
      href={`/classes/${cls.id}`}
      className={cn("group flex flex-col gap-3 rounded-inner bg-surface p-4 transition-[box-shadow,background-color] duration-200 hover:shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]", phase === "ended" && "bg-surface/70")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink tabular">
          {formatTime(cls.start)}
          <span className="text-muted">–{formatTime(endOf(cls).toISOString())}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">{cls.kind === "group" ? "Group" : "1:1"}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm leading-snug text-ink">{cls.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {cls.room}
          {repeat ? ` · ${repeat}` : ""}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <SeatDots cls={cls} s={s} waitlist={waitlistOn} />
        <p className="text-xs text-muted tabular">
          {full ? "Full" : `${cls.enrolled.length}/${cls.capacity} booked`}
          {waitlistOn && cls.waitlist.length ? ` · ${cls.waitlist.length} waiting` : ""}
        </p>
      </div>
      {issues.length ? (
        <StatusBadge tone="warning" className="self-start">
          {issues.length} to acknowledge
        </StatusBadge>
      ) : repeated ? (
        <StatusBadge tone="danger" className="self-start">
          Repeated absence
        </StatusBadge>
      ) : precautions ? (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} aria-hidden="true" /> {pluralize(precautions, "precaution")}
        </span>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
          <Avatar src={inst?.avatar} name={inst?.name ?? "Instructor"} size="xs" />
          <span className="truncate">{inst?.name.split(" ")[0]}</span>
        </span>
        <span className="shrink-0 text-xs text-muted tabular">{phase === "ended" ? `${attended}/${counted} came` : phase === "in-progress" ? "Now" : relativeTime(cls.start)}</span>
      </div>
    </Link>
  );
}

