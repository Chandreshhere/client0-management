import { useMemo } from "react";
import type { AttendanceState, YogaClass } from "@/data/types";
import { useClasses } from "@/features/classes/store";
import { allClasses, phaseOf, savedMark } from "@/features/classes/model";
import { ATTENDANCE_HISTORY, type ProgressNote } from "@/features/classes/data";

export interface SessionRow {
  id: string;
  classId: string | null;
  title: string;
  start: string;
  kind: YogaClass["kind"] | "earlier";
  instructorId: string | null;
  state: AttendanceState;
  reason: string;
  ended: boolean;
}

/**
 * Yoga progress for one patient from the sessions workspace's live state (attendance marked,
 * progress notes written and precautions acknowledged in this browser session show up here).
 */
export function useYogaProgress(patientId: string) {
  const s = useClasses();
  return useMemo(() => {
    const classes = allClasses(s).filter((c) => c.enrolled.some((e) => e.patientId === patientId));
    const rows: SessionRow[] = classes.map((c) => {
      const e = c.enrolled.find((x) => x.patientId === patientId)!;
      const m = savedMark(s, c, e);
      return { id: c.id, classId: c.id, title: c.title, start: c.start, kind: c.kind, instructorId: c.instructorId, state: m.state, reason: m.reason, ended: phaseOf(s, c) === "ended" };
    });
    for (const [i, h] of (ATTENDANCE_HISTORY[patientId] ?? []).entries()) {
      if (!rows.some((r) => r.start === h.date)) rows.push({ id: `hist-${i}`, classId: null, title: h.title, start: h.date, kind: "earlier", instructorId: null, state: h.state, reason: h.reason ?? "", ended: true });
    }
    rows.sort((a, b) => b.start.localeCompare(a.start));
    let attended = 0;
    let missed = 0;
    let toMark = 0;
    for (const r of rows) {
      if (!r.ended) continue;
      if (r.state === "present" || r.state === "late") attended += 1;
      else if (r.state === "absent") missed += 1;
      else if (r.state === "pending") toMark += 1;
    }
    const marked = attended + missed;
    const notes: ProgressNote[] = s.notes.filter((n) => n.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at));
    const last = notes[0];
    const upcoming = rows.filter((r) => !r.ended).sort((a, b) => a.start.localeCompare(b.start));
    return {
      rows,
      sessions: rows.length,
      attended,
      missed,
      marked,
      toMark,
      rate: marked ? Math.round((attended / marked) * 100) : null,
      notes,
      lastNote: last ? { at: last.at, text: last.note || last.breathing } : null,
      next: upcoming[0] ?? null,
      ack: s.acks[patientId] ?? null,
    };
  }, [s, patientId]);
}
