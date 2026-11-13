import type { Patient } from "@/data/types";
import { CONDITIONS } from "@/data/featured";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { authorName } from "@/features/patient/event-meta";
import { CHANGES, LAST_VISIT, SEED_DRAFT, type RecordChange, type SectionKey } from "../data";
import type { AddedReading } from "../store";
import { latestVitalsSentence } from "../vitals-data";
import { measureValueText, vitalMeasures } from "../measures";
import { changesSince, derivedChanges, isFeaturedPatient, recordOf, todaysMedicalVisit } from "../record-model";

/**
 * Per-patient inputs for the Notes split view: the featured patient's hand-written context, or
 * the same pieces derived from any other patient's record (problems, changes since the last
 * visit, latest readings). Sentences inserted into a note keep their provenance in the text.
 */

const fmtShort = (d: string) => formatDate(d, { day: "numeric", month: "short" });

export type NoteChange = RecordChange;

export interface ProblemItem {
  id: string;
  name: string;
  status: string;
  since: string;
  systemId: string;
}

/** Active problems first, resolved ones counted. */
export function problemsFor(patientId: string): { active: ProblemItem[]; resolved: number } {
  const list = isFeaturedPatient(patientId) ? CONDITIONS : (recordOf(patientId)?.conditions ?? []);
  const active = list.filter((c) => c.status !== "Resolved").map((c) => ({ id: c.id, name: c.name, status: c.status, since: c.since, systemId: c.systemId }));
  return { active, resolved: list.length - active.length };
}

/** "Since the last visit" anchor: the hand-written one for the featured patient. */
export function sinceFor(patient: Patient) {
  return isFeaturedPatient(patient.id) ? LAST_VISIT : changesSince(patient);
}

export function changesFor(patientId: string): NoteChange[] {
  return isFeaturedPatient(patientId) ? CHANGES : derivedChanges(patientId);
}

export function changesSentence(patient: Patient): string | null {
  const list = changesFor(patient.id);
  if (!list.length) return null;
  const since = sinceFor(patient);
  return `Since the ${patient.lastVisit || isFeaturedPatient(patient.id) ? "last visit" : "registration"} (${fmtShort(since)}): ${list
    .slice(0, 6)
    .map((c) => `${c.title.toLowerCase()} (${fmtShort(c.date)}${c.selfReported ? ", self-reported" : ""})`)
    .join("; ")}${list.length > 6 ? `; and ${list.length - 6} more` : ""}.`;
}

export function problemsSentence(patientId: string): string | null {
  const { active } = problemsFor(patientId);
  if (!active.length) return null;
  return `Active problems: ${active.map((c) => `${c.name} — ${c.status.toLowerCase()}`).join("; ")}.`;
}

/** Latest clinic/home readings with provenance (lab results stay in Labs). */
export function readingsSentence(patientId: string, readings: AddedReading[]): string | null {
  if (isFeaturedPatient(patientId)) return latestVitalsSentence(readings);
  const parts = vitalMeasures(patientId, readings)
    .filter((m) => !m.lab)
    .map((m) => {
      const p = m.points[m.points.length - 1];
      if (!p) return null;
      return `${m.label} ${measureValueText(m, p)}${m.unit ? ` ${m.unit}` : ""} (${p.self ? "home, self-reported" : "clinic"}, ${fmtShort(p.d)})`;
    })
    .filter(Boolean);
  return parts.length ? `Latest recorded: ${parts.join("; ")}.` : null;
}

export interface DraftSeed {
  id: string;
  title: string;
  createdAt: string;
  appointment: { at: string; room: string; withId?: string } | null;
  sections: Record<SectionKey, string>;
}

const EMPTY_SECTIONS: Record<SectionKey, string> = { history: "", findings: "", assessment: "", advice: "", followUp: "" };

/** Today's consultation draft: the featured patient's seeded draft, or a blank note linked to today's visit. */
export function draftSeedFor(patientId: string, blankTitle: string): DraftSeed {
  if (isFeaturedPatient(patientId)) return { ...SEED_DRAFT, appointment: { ...SEED_DRAFT.appointment, withId: "s-ananya" }, sections: { ...SEED_DRAFT.sections } };
  const visit = todaysMedicalVisit(patientId);
  return {
    id: `draft-${patientId}-1113`,
    title: visit ? visit.service : blankTitle,
    createdAt: "2026-11-13T09:12:00+05:30",
    appointment: visit ? { at: visit.start, room: visit.room, withId: visit.staffId } : null,
    sections: { ...EMPTY_SECTIONS },
  };
}

/** "Today's 15:30 visit with Dr. Vikram Iyer · Consult 2" */
export function appointmentText(a: DraftSeed["appointment"], authorName_: string) {
  if (!a) return "Not linked to an appointment";
  const withName = a.withId ? staffById(a.withId)?.name : undefined;
  return `Today's ${formatTime(a.at)} visit${withName && withName !== authorName_ ? ` with ${withName}` : ""} · ${a.room}`;
}

export { authorName };
