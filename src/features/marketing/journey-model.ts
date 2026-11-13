import { LINK_LABEL, type CareEvent, type LinkKind } from "@/data/featured";
import type { PatientRecord } from "@/data/record";

/**
 * Pure helpers for the public journey proof (ref 5 "metro map"). Only documented links are
 * used: an edge exists because the record says one event ordered / was reviewed in / led to /
 * referred to / revised / followed up another — never because two events sit next to each other.
 */

export type Lane = "medical" | "diagnostics" | "nutrition" | "movement" | "patient";
export const LANES: { key: Lane; label: string; hint: string }[] = [
  { key: "medical", label: "Medical", hint: "consults, notes, medication" },
  { key: "diagnostics", label: "Diagnostics", hint: "labs, imaging, measurements" },
  { key: "nutrition", label: "Nutrition", hint: "plans and reviews" },
  { key: "movement", label: "Movement", hint: "yoga and mobility" },
  { key: "patient", label: "Patient-reported", hint: "self-reported logs" },
];

export const laneOf = (e: CareEvent): Lane => {
  if (e.state === "self-reported" || e.authorRole === "Patient") return "patient";
  if (e.type === "nutrition") return "nutrition";
  if (e.type === "movement") return "movement";
  if (e.type === "lab" || e.type === "imaging" || e.type === "vitals") return "diagnostics";
  return "medical";
};

export const LINK_KINDS: LinkKind[] = ["ordered", "reviewed-in", "led-to", "referred", "revised", "follow-up"];
export const KIND_CHIP: Record<LinkKind, string> = {
  ordered: "Ordered",
  "reviewed-in": "Reviewed in",
  "led-to": "Led to",
  referred: "Referred",
  revised: "Revised",
  "follow-up": "Follow-up",
};

export type DocLink = { id: string; from: CareEvent; to: CareEvent; kind: LinkKind };

/** Every link whose two ends both exist in the record, oldest target first. */
export function documentedLinks(r: PatientRecord): DocLink[] {
  const byId = new Map(r.events.map((e) => [e.id, e]));
  const out: DocLink[] = [];
  for (const from of r.events)
    for (const l of from.links ?? []) {
      const to = byId.get(l.to);
      if (to) out.push({ id: `${from.id}>${to.id}`, from, to, kind: l.kind });
    }
  return out.sort((a, b) => a.to.date.localeCompare(b.to.date) || a.from.date.localeCompare(b.from.date));
}

/** The link as a sentence, in the direction the record documents it. */
export function linkSentence(l: DocLink) {
  if (l.kind === "follow-up") return `${l.to.title} — follow-up to ${l.from.title}`;
  return `${l.from.title} ${LINK_LABEL[l.kind]} ${l.to.title}`;
}

export const monthKey = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (key: number, withYear: boolean) => `${MON[key % 12]}${withYear ? ` ’${String(Math.floor(key / 12)).slice(2)}` : ""}`;
