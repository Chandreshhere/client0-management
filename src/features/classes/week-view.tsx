"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUpRight, CalendarCheck, Hourglass, ShieldCheck, ShieldWarning, Warning } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { ORGAN_LABEL } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import { STAFF, staffById } from "@/data/staff";
import { formatDate, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { ChipGroup } from "@/components/viz/cards";
import { OrganImage } from "@/components/viz/organ";
import { useRole } from "@/components/shell/role-context";
import { TODAY_KEY, WEEK_CLASSES, WEEK_DAYS, attendanceRate, endOf, openIssues, phaseOf, repeatedAbsence, savedMark, type ClassesState } from "./model";
import { BOARD_FILTER_LABEL, matchesFilter, organMix, type BoardFilter } from "./insight";
import { AttendanceChart, OrganStack, SeatDots, SeatLegend } from "./viz";
import { useClasses } from "./store";
import { scrollToElement } from "@/lib/scroll";

/** /classes — the instructor's week (doc §2D): who is attending, and what guidance is needed first. */

const FILTERS: BoardFilter[] = ["review", "precautions", "waitlist", "absence", "individual"];

export function ClassesWeek() {
  const s = useClasses();
  const { role, user } = useRole();
  const [instructor, setInstructor] = useState<string>("all");
  const [filters, setFilters] = useState<BoardFilter[]>([]);
  const instructors = STAFF.filter((x) => x.role === "yoga");

  const visible = useMemo(() => WEEK_CLASSES.filter((c) => instructor === "all" || c.instructorId === instructor), [instructor]);
  const shown = useMemo(() => visible.filter((c) => filters.every((f) => matchesFilter(s, c, f))), [visible, filters, s]);
  const today = visible.filter((c) => c.start.startsWith(TODAY_KEY));
  const upcoming = visible.filter((c) => phaseOf(s, c) !== "ended");
  const next = upcoming.find((c) => c.start.startsWith(TODAY_KEY)) ?? upcoming[0] ?? null;

  const rate = attendanceRate(s, visible);
  const issues = useMemo(() => {
    const byPatient = new Map<string, { clearance: string; sessions: number }>();
    for (const c of upcoming) {
      for (const e of openIssues(s, c)) {
        const cur = byPatient.get(e.patientId);
        byPatient.set(e.patientId, { clearance: e.clearance, sessions: (cur?.sessions ?? 0) + 1 });
      }
    }
    return [...byPatient.entries()];
  }, [s, upcoming]);
  const waitlisted = upcoming.reduce((n, c) => n + c.waitlist.length, 0);

  const days = WEEK_DAYS.map((d) => ({ day: d, classes: shown.filter((c) => c.start.startsWith(d)) }));
  const lastEnded = [...visible].reverse().find((c) => phaseOf(s, c) === "ended");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes this week"
        description="Group classes and one-to-one sessions, 9–14 Nov. The lesson plan is shared; attendance, precautions, observations and packages stay individual."
        actions={
          <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1">
            <Segmented
              ariaLabel="Instructor"
              size="md"
              value={instructor}
              onChange={setInstructor}
              items={[
                { value: "all", label: "All instructors", count: WEEK_CLASSES.length },
                ...instructors.map((x) => ({
                  value: x.id,
                  label: `${x.name.split(" ")[0]}${role === "yoga" && x.id === user.id ? " (you)" : ""}`,
                  icon: <Avatar src={x.avatar} name={x.name} size="xs" className="-ml-2" />,
                  count: WEEK_CLASSES.filter((c) => c.instructorId === x.id).length,
                })),
              ]}
            />
          </div>
        }
      />

      <section aria-label="This week at a glance" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <UpNext cls={next} s={s} />
          <article aria-label="Attendance this week" className="flex min-w-0 flex-col rounded-card bg-surface p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-xs text-muted">Attendance this week · per finished session</p>
                <p className="mt-2 text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{rate.pct === null ? "—" : `${rate.pct}%`}</p>
              </div>
              <p className="max-w-[44ch] text-xs text-muted">
                {rate.marked ? `${rate.came} of ${rate.marked} marked participants came (present or late). Cancelled and rescheduled places don't count.` : "No finished sessions in this view yet."}
              </p>
            </div>
            <AttendanceChart
              s={s}
              classes={visible}
              highlightId={lastEnded?.id}
              height={176}
              className="mt-4"
              emptyText="Attendance appears here once a session in this view has finished."
            />
          </article>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Sessions today"
            icon={<CalendarCheck />}
            value={today.length}
            context={today.length ? `${today.filter((c) => c.kind === "group").length} group · ${today.filter((c) => c.kind === "individual").length} one-to-one · ${today.filter((c) => phaseOf(s, c) === "ended").length} done` : "No sessions today"}
          />
          {/* People, sessions and per-session reviews are different counts — say all three so the
              "Clearance to review" chip (sessions) and each card's "N to review" reconcile. */}
          <Stat
            label="People to clear"
            icon={issues.length ? <ShieldWarning className="text-warning" /> : <ShieldCheck />}
            value={issues.length}
            context={
              issues.length
                ? `${pluralize(issues.reduce((n, [, v]) => n + v.sessions, 0), "review")} across ${pluralize(upcoming.filter((c) => openIssues(s, c).length > 0).length, "session")} · ${issues.map(([pid, v]) => `${patientById(pid)?.name.split(" ")[0]} (${v.clearance})`).join(" · ")}`
                : "All upcoming precautions acknowledged"
            }
          />
          <Stat label="Waitlisted" icon={<Hourglass />} value={waitlisted} context={waitlisted ? upcoming.filter((c) => c.waitlist.length).map((c) => `${c.title} · ${formatDate(c.start, { weekday: "short" })}`).join(" · ") : "Nobody waiting"} />
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
                options={FILTERS.map((f) => ({ value: f, label: BOARD_FILTER_LABEL[f], count: visible.filter((c) => matchesFilter(s, c, f)).length }))}
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
                // Glide to today's column, keeping it clear of the sticky header (its scroll-margin).
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
            <SeatLegend />
          </div>
        </div>
        {/* items-start: each day hugs its sessions instead of stretching to the busiest day as an empty grey block. */}
        <div className="grid grid-cols-1 items-start gap-4 @[640px]:grid-cols-2 @[960px]:grid-cols-3 @[1180px]:grid-cols-6 @[1180px]:gap-2">
          {days.map(({ day, classes }) => (
            <DayColumn key={day} day={day} classes={classes} s={s} filtered={filters.length > 0} />
          ))}
        </div>
      </section>
    </div>
  );
}

function UpNext({ cls, s }: { cls: YogaClass | null; s: ClassesState }) {
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
  const precautions = cls.enrolled.filter((e) => e.precaution).length;
  // The organ most of today's precautions are about (from each participant's own conditions).
  const lead = organMix(cls).find((m) => m.precautions > 0) ?? null;
  return (
    <article className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-card bg-primary p-6 text-white">
      <BreathRings />
      <div className="relative flex items-start justify-between gap-3">
        <Pill tone="instances-light">
          {phase === "in-progress" ? "In progress" : "Up next"} · {formatTime(cls.start)}
        </Pill>
        <Link
          href={`/classes/${cls.id}`}
          aria-label={`Open roster for ${cls.title}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-105 active:scale-95"
        >
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="relative mt-auto flex items-end gap-4 pt-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-light">{cls.title}</h2>
          <p className="mt-2 text-sm text-white/75">
            {formatDate(cls.start, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(cls.start)}–{formatTime(endOf(cls).toISOString())} · {cls.room} · {inst?.name}
          </p>
        </div>
        {lead ? (
          // The organ most of this session's precautions are about, from each participant's own conditions.
          <figure className="pointer-events-none flex w-[112px] shrink-0 flex-col items-center">
            <OrganImage kind={lead.organ} alt={`${ORGAN_LABEL[lead.organ]} — precautions for ${lead.withPrecaution.join(", ")}`} className="size-[96px] drop-shadow-[0_18px_24px_rgb(0_0_0/0.25)]" />
            <figcaption className="mt-1 text-center text-[11px] leading-tight text-white/80">
              {ORGAN_LABEL[lead.organ]} · {lead.precautions} of {precautions} precautions
            </figcaption>
          </figure>
        ) : null}
      </div>
      <div className="relative">
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AvatarStack people={people.map((p) => ({ name: p.name, avatar: p.avatar }))} max={5} size="sm" />
          <span className="text-sm text-white/85 tabular">
            {cls.enrolled.length} of {cls.capacity} enrolled{cls.waitlist.length ? ` · ${cls.waitlist.length} waitlisted` : ""}
          </span>
        </div>
        {issues.length ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]">
            <Warning size={14} weight="fill" aria-hidden="true" />
            {pluralize(issues.length, "clearance")} to review before start · {relativeTime(cls.start)}
          </p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/80">
            <ShieldCheck size={14} aria-hidden="true" /> Precautions reviewed — ready to start
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

function DayColumn({ day, classes, s, filtered }: { day: string; classes: YogaClass[]; s: ClassesState; filtered: boolean }) {
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
                <SessionCard cls={c} s={s} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-inner bg-surface/60 p-4 text-xs text-muted">{filtered ? "No sessions match these filters." : "No sessions for this instructor."}</p>
      )}
    </section>
  );
}

function SessionCard({ cls, s }: { cls: YogaClass; s: ClassesState }) {
  const inst = staffById(cls.instructorId);
  const phase = phaseOf(s, cls);
  const issues = openIssues(s, cls);
  const precautions = cls.enrolled.filter((e) => e.precaution).length;
  const full = cls.enrolled.length >= cls.capacity;
  const attended = cls.enrolled.filter((e) => ["present", "late"].includes(savedMark(s, cls, e).state)).length;
  const counted = cls.enrolled.filter((e) => !["cancelled", "rescheduled", "pending"].includes(savedMark(s, cls, e).state)).length;
  const repeat = cls.enrolled.filter((e) => savedMark(s, cls, e).state === "absent" && repeatedAbsence(s, e.patientId, cls.start)).length;
  return (
    <Link
      href={`/classes/${cls.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-inner bg-surface p-4 transition-[box-shadow,background-color] duration-200 hover:shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
        phase === "ended" && "bg-surface/70",
      )}
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
        <p className="mt-0.5 truncate text-xs text-muted">{cls.room}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <SeatDots cls={cls} s={s} />
        <p className="text-xs text-muted tabular">{full ? "Full" : `${cls.enrolled.length}/${cls.capacity} booked`}{cls.waitlist.length ? ` · ${cls.waitlist.length} waiting` : ""}</p>
      </div>
      {issues.length || repeat || precautions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {issues.length ? (
            <StatusBadge tone="warning">{issues.length} to review</StatusBadge>
          ) : repeat ? (
            <StatusBadge tone="danger">Repeated absence</StatusBadge>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={14} aria-hidden="true" /> {pluralize(precautions, "precaution")}
            </span>
          )}
          <OrganStack cls={cls} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
          <Avatar src={inst?.avatar} name={inst?.name ?? "Instructor"} size="xs" />
          <span className="truncate">{inst?.name.split(" ")[0]}</span>
        </span>
        <span className="shrink-0 text-xs text-muted tabular">
          {phase === "ended" ? `${attended}/${counted} came` : phase === "in-progress" ? "Now" : relativeTime(cls.start)}
        </span>
      </div>
    </Link>
  );
}
