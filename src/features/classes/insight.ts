import type { AttendanceState, YogaClass } from "@/data/types";
import { ORGAN_LABEL, classifyCondition, organForSystem, patientSystems, primaryOrgan, type OrganKind, type SystemKey } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import { formatDate, formatTime } from "@/lib/format";
import { WEEK_CLASSES, currentMark, openIssues, phaseOf, repeatedAbsence, savedMark, type ClassesState } from "./model";

/**
 * Derived figures for the classes visuals — organs from each participant's own conditions,
 * attendance and capacity from the saved roster state. Nothing here is decorative.
 */

/** Words used in precautions that point at a body system without naming the condition. */
const PRECAUTION_HINTS: [RegExp, SystemKey][] = [
  [/\bOSA\b|SpO|inhaler|breath-hold|wheez/i, "respiratory"],
  [/\bHR\b|\bBP\b|post-MI|cardiac/i, "cardiovascular"],
  [/aura|migraine|headache/i, "neurological"],
  [/\bweeks\b|prenatal|pelvic/i, "reproductive"],
  [/wrist|knee|joint|flexion|spine|\bback\b/i, "musculoskeletal"],
  [/light-headed|anaemi/i, "haematology"],
];

export interface OrganNote {
  organ: OrganKind;
  /** e.g. "Lungs · COPD (moderate)" */
  label: string;
  condition: string | null;
  /** true when derived from the precaution text, false when it is the participant's primary condition */
  fromPrecaution: boolean;
}

const activeFirst = (conditions: string[]) => conditions.find((c) => !/resolved/i.test(c)) ?? conditions[0];

/**
 * The organ a participant's precaution is about (OSA → lungs, "Knee OA" → knee, "HR ceiling" → heart),
 * matched to the participant's own recorded condition in that system. Without a precaution: the organ
 * of their primary recorded condition. Null when nothing is recorded.
 */
export function participantOrgan(patientId: string, precaution?: string): OrganNote | null {
  const p = patientById(patientId);
  if (!p) return null;
  const systems = patientSystems(p);
  if (precaution) {
    const key = classifyCondition(precaution) ?? PRECAUTION_HINTS.find(([re]) => re.test(precaution))?.[1] ?? null;
    if (key) {
      const own = systems.find((s) => s.key === key);
      const organ = organForSystem(key, own?.conditions ?? [precaution]);
      const condition = own ? activeFirst(own.conditions) : null;
      return { organ, label: condition ? `${ORGAN_LABEL[organ]} · ${condition}` : ORGAN_LABEL[organ], condition, fromPrecaution: true };
    }
  }
  const organ = primaryOrgan(p);
  if (!organ || !systems[0]) return null;
  const condition = activeFirst(systems[0].conditions);
  return { organ, label: `${ORGAN_LABEL[organ]} · ${condition}`, condition, fromPrecaution: false };
}

/** Organs in a session's room: each participant's precaution organ (or primary organ), grouped. */
export function organMix(c: YogaClass) {
  const groups = new Map<OrganKind, { organ: OrganKind; names: string[]; precautions: number; withPrecaution: string[] }>();
  for (const e of c.enrolled) {
    const o = participantOrgan(e.patientId, e.precaution);
    if (!o) continue;
    const g = groups.get(o.organ) ?? { organ: o.organ, names: [], precautions: 0, withPrecaution: [] };
    const first = patientById(e.patientId)?.name.split(" ")[0] ?? e.patientId;
    g.names.push(first);
    if (e.precaution) {
      g.precautions += 1;
      g.withPrecaution.push(first);
    }
    groups.set(o.organ, g);
  }
  return [...groups.values()].sort((a, b) => b.precautions - a.precautions || b.names.length - a.names.length);
}

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
  { id: "released", name: "Cancelled / rescheduled", color: "var(--color-line-strong)" },
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
  return WEEK_CLASSES.flatMap((c) => {
    const e = c.enrolled.find((x) => x.patientId === patientId);
    return e ? [{ cls: c, state: savedMark(s, c, e).state }] : [];
  });
}

/* ------------------------------------------------------------------ board filters */

export type BoardFilter = "review" | "precautions" | "waitlist" | "absence" | "individual";

export const BOARD_FILTER_LABEL: Record<BoardFilter, string> = {
  review: "Clearance to review",
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
