import { BowlFood, FileText, Files, Pill, PersonSimpleTaiChi, Pulse, Scan, Stethoscope, TestTube, type Icon } from "@phosphor-icons/react";
import { ORGAN_LABEL, type OrganKind } from "@/data/anatomy";
import type { BodySystem, CareEvent, CareEventType, Condition } from "@/data/featured";
import { patientById } from "@/data/patients";
import { getRecord, type PatientRecord } from "@/data/record";
import { staffById } from "@/data/staff";
import type { Patient } from "@/data/types";

/**
 * Pure helpers for the public product proofs (hero care map, journey). Everything works on a
 * PatientRecord from @/data/record, so switching patient rebuilds the organ, body systems,
 * timeline and threads from that patient's own conditions and events.
 */

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const NOW = { year: 2026, month: 10, day: 13 };

/**
 * Patients the public proof can open, and the body system each one opens on. The system must
 * exist in the patient's record (checked below) — Sunita's record holds both a circulatory and
 * a renal system; the proof opens on renal so the four switch targets show four organs.
 */
const PROOF: { id: string; focus: string }[] = [
  { id: "p-kabir", focus: "circulatory" },
  { id: "p-rekha", focus: "respiratory" },
  { id: "p-rajesh", focus: "metabolic" },
  { id: "p-sunita", focus: "renal" },
];

export type ProofPatient = { patient: Patient; record: PatientRecord; focus: BodySystem; organ: OrganKind; organLabel: string; lead: Condition };

export const PROOF_PATIENTS: ProofPatient[] = PROOF.flatMap(({ id, focus }) => {
  const patient = patientById(id);
  const record = getRecord(id);
  if (!patient || !record || !record.systems.length) return [];
  const sys = record.systems.find((s) => s.id === focus) ?? record.systems[0];
  const lead = record.conditions.find((c) => c.id === sys.featuredConditionId) ?? record.conditions.find((c) => c.systemId === sys.id);
  if (!lead) return [];
  return [{ patient, record, focus: sys, organ: sys.organ, organLabel: ORGAN_LABEL[sys.organ], lead }];
});

export const proofPatient = (id: string) => PROOF_PATIENTS.find((p) => p.patient.id === id) ?? PROOF_PATIENTS[0];

export const EVENT_ICON: Record<CareEventType, Icon> = {
  note: FileText,
  document: Files,
  lab: TestTube,
  vitals: Pulse,
  medication: Pill,
  imaging: Scan,
  consult: Stethoscope,
  nutrition: BowlFood,
  movement: PersonSimpleTaiChi,
};

export function authorName(id: string) {
  if (id.startsWith("lab:")) return id.slice(4);
  return staffById(id)?.name ?? patientById(id)?.name ?? "Unknown";
}

export function authorAvatar(id: string) {
  if (id.startsWith("lab:")) return null;
  return staffById(id)?.avatar ?? patientById(id)?.avatar ?? null;
}

export const systemOf = (r: PatientRecord, id: string) => r.systems.find((s) => s.id === id) ?? r.systems[0];
export const conditionOf = (r: PatientRecord, id: string) => r.conditions.find((c) => c.id === id);
export const conditionsIn = (r: PatientRecord, systemId: string) => r.conditions.filter((c) => c.systemId === systemId);

export const eventsIn = (r: PatientRecord, year: number) => r.events.filter((e) => e.date.startsWith(String(year)));
export const monthOf = (e: CareEvent) => Number(e.date.slice(5, 7)) - 1;
export const dayOf = (e: CareEvent) => Number(e.date.slice(8, 10));

/** Latest recorded (non-scheduled) event matching `pred` in a year — used when the visitor picks a card. */
export function latestFor(r: PatientRecord, year: number, pred: (e: CareEvent) => boolean) {
  const all = eventsIn(r, year).filter(pred);
  const done = all.filter((e) => e.state !== "scheduled");
  return done[done.length - 1] ?? all[0];
}

/** Opening event: the newest record still awaiting review in that system, else its latest record. */
export function defaultEvent(r: PatientRecord, year: number, systemId: string) {
  const mine = eventsIn(r, year).filter((e) => e.systemId === systemId);
  const review = mine.filter((e) => e.state === "awaiting-review");
  return review[review.length - 1] ?? latestFor(r, year, (e) => e.systemId === systemId) ?? eventsIn(r, year)[0] ?? r.events[r.events.length - 1];
}

/** Bubble x positions inside a month track: natural day position, stacked with overlap when close. */
export function placeBubbles(events: CareEvent[], trackW: number, size: number) {
  const usable = Math.max(120, trackW - size - 8);
  let lastX = -Infinity;
  return events.map((e) => {
    const natural = ((dayOf(e) - 1) / 30) * usable * 0.82;
    const x = Math.min(Math.max(natural, lastX + size * 0.62), usable);
    lastX = x;
    return { e, x };
  });
}

export type ThreadLink = { id: string; from: string; to: string; tone: "active" | "muted"; group: string; eventId: string };

/**
 * One thread per condition × month (to that month's first event documented against it). Other
 * systems only thread their significant events. Lines mean "documented against this condition".
 */
export function threadLinks(r: PatientRecord, year: number, active: string): ThreadLink[] {
  const seen = new Set<string>();
  const out: ThreadLink[] = [];
  for (const e of eventsIn(r, year)) {
    const isActive = e.systemId === active;
    if (!isActive && e.weight < 2) continue;
    const key = `${e.conditionId}-${e.date.slice(0, 7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${e.conditionId}-${e.id}`, from: `cond:${e.conditionId}`, to: `evt:${e.id}`, tone: isActive ? "active" : "muted", group: e.conditionId, eventId: e.id });
  }
  return out;
}

const dayStamp = (iso: string) => {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
};

/** How the entry date relates to the event date, in words. */
export function entryGap(e: CareEvent) {
  const days = Math.round((dayStamp(e.enteredAt) - Date.parse(`${e.date}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "Entered the same day";
  if (days > 0) return `Entered ${days} ${days === 1 ? "day" : "days"} after it happened`;
  const ahead = -days;
  return `Booked ${ahead} ${ahead === 1 ? "day" : "days"} ahead`;
}
