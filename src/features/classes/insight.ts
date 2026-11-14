import type { AttendanceState, YogaClass } from "@/data/types";
import { formatDate, formatTime } from "@/lib/format";
import { allClasses, currentMark, openIssues, phaseOf, repeatedAbsence, savedMark, type ClassesState } from "./model";

/**
 * Derived figures for the sessions visuals — attendance and capacity from the saved roster state.
 * No diagnoses or condition-derived figures: instructors see precautions only (spec rule 3).
 */


/* ------------------------------------------------------------------ attendance */

export type AttKey = "present" | "late" | "absent" | "released";

/**
 * Attendance series — validated as a set (dataviz validator, all pairs: CVD ΔE ≥ 18, normal ≥ 19):
 * charcoal · amber · red · pale grey. Always shown with a legend, tooltips and a table view.
 */
export const ATT_SERIES: { id: AttKey; name: string; color: string }[] = [
  { id: "present", name: "Present", color: "var(--color-charcoal)" },
  { id: "late", name: "Late", color: "#eda100" },
  { id: "absent", name: "Absent", color: "var(--color-danger)" },
  { id: "released", name: "Cancelled / held", color: "var(--color-line-strong)" },
];

export const stateKey = (st: AttendanceState): AttKey | "pending" => (st === "cancelled" || st === "rescheduled" ? "released" : st);

/** Saved (or, with `draft`, on-screen) attendance counts for one session. */
export function attendanceCounts(s: ClassesState, c: YogaClass, draft = false) {
  const out: Record<AttKey | "pending", number> = { present: 0, late: 0, absent: 0, released: 0, pending: 0 };
  for (const e of c.enrolled) out[stateKey((draft ? currentMark : savedMark)(s, c, e).state)] += 1;
  return out;
}

/** "Mon 7:30" for text; `short` gives "Mo 7:30" so 12 labels fit under bars without colliding. */
export const sessionLabel = (c: YogaClass, short = false) => {
  const day = formatDate(c.start, { weekday: "short" });
  return `${short ? day.slice(0, 2) : day} ${formatTime(c.start).replace(/^0/, "")}`;
};

/** Started or finished sessions with saved attendance, in time order (upcoming ones are left out). */
export function markedSessions(s: ClassesState, classes: YogaClass[]) {
  return classes.filter((c) => {
    if (phaseOf(s, c) === "upcoming") return false;
    const n = attendanceCounts(s, c);
    return n.present + n.late + n.absent + n.released > 0;
  });
}

/** A participant's sessions this week with their saved state (for the per-row week strip). */
export function participantWeek(s: ClassesState, patientId: string) {
  return allClasses(s).flatMap((c) => {
    const e = c.enrolled.find((x) => x.patientId === patientId);
    return e ? [{ cls: c, state: savedMark(s, c, e).state }] : [];
  });
}

/* ------------------------------------------------------------------ board filters */

export type BoardFilter = "review" | "precautions" | "waitlist" | "absence" | "individual";

export const BOARD_FILTER_LABEL: Record<BoardFilter, string> = {
  review: "Precaution to acknowledge",
  precautions: "Precautions",
  waitlist: "Waitlist",
  absence: "Repeated absence",
  individual: "1:1 sessions",
};

export function matchesFilter(s: ClassesState, c: YogaClass, f: BoardFilter) {
  if (f === "review") return openIssues(s, c).length > 0;
  if (f === "precautions") return c.enrolled.some((e) => e.precaution);
  if (f === "waitlist") return c.waitlist.length > 0;
  if (f === "absence") return c.enrolled.some((e) => savedMark(s, c, e).state === "absent" && !!repeatedAbsence(s, e.patientId, c.start));
  return c.kind === "individual";
}
