"use client";

import type { AttendanceState, YogaClass } from "@/data/types";
import { ATTENDANCE_LABEL } from "@/data/programs";
import { ORGAN_LABEL } from "@/data/anatomy";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BarChart } from "@/components/charts/bar-chart";
import { OrganImage } from "@/components/viz/organ";
import { Tip } from "@/components/ui/tooltip";
import { currentMark, savedMark, type ClassesState } from "./model";
import { ATT_SERIES, attendanceCounts, markedSessions, organMix, participantWeek, sessionLabel } from "./insight";

/* ------------------------------------------------------------------ seats */

/** One dot per place: grey = booked, hollow = open; once marked, the attendance colour. */
const SEAT: Record<AttendanceState, string> = {
  pending: "bg-faint",
  present: "bg-charcoal",
  late: "bg-[#eda100]",
  absent: "bg-danger",
  cancelled: "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-faint)] [background-image:linear-gradient(135deg,transparent_45%,var(--color-faint)_45%,var(--color-faint)_58%,transparent_58%)]",
  rescheduled: "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-faint)] [background-image:linear-gradient(135deg,transparent_45%,var(--color-faint)_45%,var(--color-faint)_58%,transparent_58%)]",
};

/**
 * Capacity at a glance: places taken, open places and the waitlist, with each booked place
 * coloured by the participant's attendance once it is marked. `draft` shows on-screen marks.
 */
export function SeatDots({ cls, s, draft = false, size = "sm", className }: { cls: YogaClass; s: ClassesState; draft?: boolean; size?: "sm" | "md"; className?: string }) {
  const marks = cls.enrolled.map((e) => ({ e, state: (draft ? currentMark : savedMark)(s, cls, e).state }));
  const open = Math.max(0, cls.capacity - cls.enrolled.length);
  const dot = size === "md" ? "size-3" : "size-2";
  const summary = `${cls.enrolled.length} of ${cls.capacity} places booked${open ? `, ${open} open` : ", full"}${cls.waitlist.length ? `, ${cls.waitlist.length} on the waitlist` : ""}`;
  return (
    <span role="img" aria-label={summary} className={cn("flex flex-wrap items-center", size === "md" ? "gap-1.5" : "gap-1", className)}>
      {marks.map(({ e, state }) => (
        <span key={e.patientId} className={cn("shrink-0 rounded-full", dot, SEAT[state])} />
      ))}
      {Array.from({ length: open }, (_, i) => (
        <span key={`open-${i}`} className={cn("shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]", dot)} />
      ))}
      {cls.waitlist.length ? <span className="ml-1 text-[11px] leading-none text-muted tabular">+{cls.waitlist.length}</span> : null}
    </span>
  );
}

export function SeatLegend({ className, marked = true }: { className?: string; marked?: boolean }) {
  const items: { label: string; cls: string }[] = [
    { label: "Booked", cls: SEAT.pending },
    { label: "Open place", cls: "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" },
    ...(marked
      ? [
          { label: "Present", cls: SEAT.present },
          { label: "Late", cls: SEAT.late },
          { label: "Absent", cls: SEAT.absent },
          { label: "Cancelled / rescheduled", cls: SEAT.cancelled },
        ]
      : []),
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2", className)} aria-label="Seat legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", it.cls)} aria-hidden="true" />
          {it.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-muted">+n waitlist</li>
    </ul>
  );
}

/* ------------------------------------------------------------------ attendance chart */

/**
 * Stacked attendance per session (kit BarChart: legend, per-bar tooltip, keyboard focus), plus a
 * table view. Only sessions with saved attendance appear — finished ones, or ones marked here.
 */
export function AttendanceChart({ s, classes, highlightId, height = 200, emptyText, className }: { s: ClassesState; classes: YogaClass[]; highlightId?: string; height?: number; emptyText: string; className?: string }) {
  const sessions = markedSessions(s, classes);
  if (!sessions.length) return <p className={cn("rounded-inner bg-canvas p-4 text-sm text-muted", className)}>{emptyText}</p>;
  const counts = sessions.map((c) => attendanceCounts(s, c));
  const values = ATT_SERIES.map((ser) => counts.map((n) => n[ser.id]));
  const hi = sessions.findIndex((c) => c.id === highlightId);
  return (
    <div className={className}>
      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <div style={{ minWidth: Math.max(0, sessions.length * 52) }}>
          <BarChart
            categories={sessions.map((c) => sessionLabel(c, true))}
            series={ATT_SERIES}
            values={values}
            height={height}
            highlight={hi >= 0 ? hi : sessions.length - 1}
            formatY={(v) => String(Math.round(v))}
            ariaLabel={`Attendance per session: ${sessions.map((c, i) => `${sessionLabel(c)} ${c.title} — ${counts[i].present} present, ${counts[i].late} late, ${counts[i].absent} absent, ${counts[i].released} cancelled or rescheduled`).join("; ")}`}
          />
        </div>
      </div>
      <details className="group mt-3 text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 pr-3 font-normal">Session</th>
                {ATT_SERIES.map((ser) => (
                  <th key={ser.id} scope="col" className="px-2 py-2 text-right font-normal">{ser.name}</th>
                ))}
                <th scope="col" className="py-2 pl-2 text-right font-normal">Booked</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((c, i) => (
                <tr key={c.id} className="border-t border-line">
                  <th scope="row" className="py-2 pr-3 font-normal text-ink">
                    {formatDate(c.start, { weekday: "short", day: "numeric", month: "short" })} {formatTime(c.start)} · {c.title}
                  </th>
                  {ATT_SERIES.map((ser) => (
                    <td key={ser.id} className="px-2 py-2 text-right text-ink-2 tabular">{counts[i][ser.id]}</td>
                  ))}
                  <td className="py-2 pl-2 text-right text-ink-2 tabular">{c.enrolled.length}/{c.capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ organs in the room */

/**
 * The organs behind the precautions in a session (or the participant's primary condition when
 * they have none) — overlapping static renders, the full list in the tooltip.
 */
export function OrganStack({ cls, max = 3, size = 28, className }: { cls: YogaClass; max?: number; size?: number; className?: string }) {
  const mix = organMix(cls);
  if (!mix.length) return null;
  const shown = mix.slice(0, max);
  const rest = mix.length - shown.length;
  const text = mix.map((m) => `${ORGAN_LABEL[m.organ]}: ${m.names.join(", ")}`).join(" · ");
  return (
    <Tip label={<span className="block max-w-[260px]">{text}</span>}>
      <span role="img" aria-label={`Conditions in this session — ${text}`} className={cn("flex items-center", className)}>
        {shown.map((m, i) => (
          <span key={m.organ} className="-ml-1.5 flex items-center justify-center rounded-full bg-canvas shadow-[0_0_0_2px_var(--color-surface)] first:ml-0" style={{ width: size, height: size, zIndex: max - i }}>
            <OrganImage kind={m.organ} className="size-[94%]" />
          </span>
        ))}
        {rest ? <span className="ml-1 text-[11px] text-muted tabular">+{rest}</span> : null}
      </span>
    </Tip>
  );
}

/* ------------------------------------------------------------------ participant week */

const WEEK_DOT: Record<AttendanceState, string> = {
  present: "bg-charcoal",
  late: "bg-[#eda100]",
  absent: "bg-danger",
  cancelled: "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-faint)]",
  rescheduled: "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-faint)]",
  pending: "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
};

/** A participant's sessions this week, one dot each (saved attendance); this session is ringed. */
export function WeekStrip({ s, patientId, currentId, className }: { s: ClassesState; patientId: string; currentId: string; className?: string }) {
  const items = participantWeek(s, patientId);
  if (items.length < 2) return null;
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs text-muted">This week</span>
      <span role="img" aria-label={`This week: ${items.map((i) => `${sessionLabel(i.cls)} ${i.cls.title}, ${ATTENDANCE_LABEL[i.state].toLowerCase()}`).join("; ")}`} className="flex items-center gap-1">
        {items.map((i) => (
          <Tip key={i.cls.id} label={<span>{sessionLabel(i.cls)} · {i.cls.title}<span className="block text-white/60">{ATTENDANCE_LABEL[i.state]}</span></span>}>
            <span className={cn("size-2.5 rounded-full", WEEK_DOT[i.state], i.cls.id === currentId && "outline outline-[1.5px] outline-offset-[1.5px] outline-charcoal")} />
          </Tip>
        ))}
      </span>
    </span>
  );
}
