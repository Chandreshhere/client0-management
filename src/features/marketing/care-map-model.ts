import { BowlFood, FileText, Files, Pill, PersonSimpleTaiChi, Pulse, Scan, Stethoscope, TestTube, type Icon } from "@phosphor-icons/react";
import { CARE_EVENTS, type BodySystemId, type CareEvent, type CareEventType } from "@/data/featured";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";

/**
 * Pure helpers for the hero care map (a scaled-down recreation of the patient overview).
 * Kept local to the marketing feature so it does not depend on the workspace's internals.
 */

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const PROOF_YEARS = [2026, 2025] as const;
export type ProofYear = (typeof PROOF_YEARS)[number];
export const DEFAULT_EVENT = "e26-24"; // lipid profile: reported 11 Nov, uploaded 12 Nov, awaiting review
export const NOW = { year: 2026, month: 10, day: 13 };

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

export const eventsIn = (year: number) => CARE_EVENTS.filter((e) => e.date.startsWith(String(year)));
export const monthOf = (e: CareEvent) => Number(e.date.slice(5, 7)) - 1;
export const dayOf = (e: CareEvent) => Number(e.date.slice(8, 10));

/** Latest event (by event date) for a system or condition — used when the visitor clicks a card. */
export function latestFor(year: number, pred: (e: CareEvent) => boolean) {
  const list = eventsIn(year).filter(pred).filter((e) => e.state !== "scheduled");
  return list[list.length - 1] ?? eventsIn(year).filter(pred)[0];
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
 * One thread per condition × month (to that month's first event) — the reference's clustered fan.
 * Other systems only thread their significant events. Lines mean "documented link", not causation.
 */
export function threadLinks(year: number, active: BodySystemId): ThreadLink[] {
  const seen = new Set<string>();
  const out: ThreadLink[] = [];
  for (const e of eventsIn(year)) {
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
