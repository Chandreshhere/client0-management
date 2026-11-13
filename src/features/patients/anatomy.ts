import type { OrganKind, SystemKey } from "@/data/anatomy";
import { ORGAN_LABEL, SYSTEM_INFO, organForSystem, patientSystems } from "@/data/anatomy";
import type { CareEvent } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { staffById } from "@/data/staff";
import type { Patient } from "@/data/types";
import { careTeamActivity } from "@/data/insights";
import { CARE_SLOTS } from "./data";

/**
 * Patients-area helpers over the shared anatomy / record / insights modules. Pure functions —
 * every organ, percentage, bar and count the registry draws comes from here, and each one keeps
 * the facts needed to say what it means in the UI.
 */

export interface PrimaryCondition {
  key: SystemKey;
  organ: OrganKind;
  organLabel: string;
  systemName: string;
  /** The condition the organ stands for (first non-resolved one in the lead body system). */
  condition: string;
  /** All recorded conditions beyond the one named. */
  others: number;
}

const resolved = (c: string) => /resolved/i.test(c);

/**
 * The patient's lead body system and the organ that represents it — the same rule as
 * `primaryOrgan()` (first recorded condition that maps to a body system), so the registry glyph,
 * the browse preview and the patient overview always show the same organ. Null when nothing
 * classifiable is recorded (new referrals, session registrations).
 */
export function primaryConditionOf(p: Pick<Patient, "conditions">): PrimaryCondition | null {
  const lead = patientSystems(p)[0];
  if (!lead) return null;
  const organ = organForSystem(lead.key, lead.conditions);
  const condition = lead.conditions.find((c) => !resolved(c)) ?? lead.conditions[0];
  return { key: lead.key, organ, organLabel: ORGAN_LABEL[organ], systemName: SYSTEM_INFO[lead.key].name, condition, others: p.conditions.length - 1 };
}

/** Plain sentence used in tooltips and screen-reader text for an organ glyph. */
export const organMeaning = (pc: PrimaryCondition) => `${pc.organLabel} · ${pc.systemName} system — shown because “${pc.condition}” is recorded`;

// ---------------------------------------------------------------- measurements

/**
 * One analyte's readings inside one body system, oldest → newest. Filtered by system because the
 * same label can be monitored for two conditions (e.g. weight for fatty liver and for
 * pre-diabetes) and mixing them would draw a line between unrelated series.
 */
export function systemHistory(record: PatientRecord, systemId: string, label: string) {
  return record.events
    .filter((e) => e.systemId === systemId)
    .flatMap((e) => (e.values ?? []).filter((v) => v.label === label).map((v) => ({ date: e.date, value: Number(v.value), state: e.state })))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- activity by month

const TODAY_ISO = "2026-11-13";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ActivityMonth {
  key: string;
  /** single letter for the axis */
  initial: string;
  /** "Nov 2025 (from 13 Nov)" */
  label: string;
  selected: number;
  other: number;
}

/**
 * Events per calendar month over exactly the window `systemShares()` counts (the 12 months up to
 * today, day-precise), so the bars add up to the "N events" printed on the share cards. The first
 * and last months are partial and say so in their labels.
 */
export function activityByMonth(record: PatientRecord, systemId: string, months = 12): { months: ActivityMonth[]; from: string; total: number } {
  const start = new Date(`${TODAY_ISO}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - months);
  const from = start.toISOString().slice(0, 10);
  const inWindow = record.events.filter((e) => e.date >= from && e.date <= TODAY_ISO);
  const out: ActivityMonth[] = [];
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const endKey = TODAY_ISO.slice(0, 7);
  for (;;) {
    const key = cursor.toISOString().slice(0, 7);
    const m = cursor.getUTCMonth();
    const y = cursor.getUTCFullYear();
    const here = inWindow.filter((e) => e.date.startsWith(key));
    const partial = key === from.slice(0, 7) ? ` (from ${Number(from.slice(8, 10))} ${MONTH_SHORT[m]})` : key === endKey ? ` (to today, ${Number(TODAY_ISO.slice(8, 10))} ${MONTH_SHORT[m]})` : "";
    out.push({
      key,
      initial: MONTH_SHORT[m][0],
      label: `${MONTH_SHORT[m]} ${y}${partial}`,
      selected: here.filter((e) => e.systemId === systemId).length,
      other: here.filter((e) => e.systemId !== systemId).length,
    });
    if (key === endKey) break;
    cursor.setUTCMonth(m + 1);
  }
  return { months: out, from, total: inWindow.length };
}

// ---------------------------------------------------------------- care team

export interface TeamMember {
  id: string;
  name: string;
  avatar: string | null;
  /** "Doctor · care team" for assigned members, otherwise their job title */
  role: string;
  /** records this person authored in the patient's record */
  count: number;
  assigned: boolean;
  latest: CareEvent | null;
}

/**
 * People behind a patient's record: everyone who authored entries (ranked by count, from
 * `careTeamActivity`) plus assigned care-team members who haven't authored anything yet (count 0).
 */
export function teamFor(record: PatientRecord | null, careTeam: Patient["careTeam"]): TeamMember[] {
  const slotOf = new Map<string, string>();
  for (const s of CARE_SLOTS) {
    const id = careTeam[s.key];
    if (id) slotOf.set(id, s.label);
  }
  const latestBy = (id: string) => (record ? [...record.events].reverse().find((e) => e.authorId === id && e.state !== "scheduled") ?? null : null);
  const authored = record ? careTeamActivity(record) : [];
  const out: TeamMember[] = authored.map(({ staff, count }) => ({
    id: staff.id,
    name: staff.name,
    avatar: staff.avatar,
    role: slotOf.has(staff.id) ? `${slotOf.get(staff.id)} · care team` : staff.title.split(" ·")[0],
    count,
    assigned: slotOf.has(staff.id),
    latest: latestBy(staff.id),
  }));
  for (const [id, slot] of slotOf) {
    if (out.some((m) => m.id === id)) continue;
    const s = staffById(id);
    if (s) out.push({ id, name: s.name, avatar: s.avatar, role: `${slot} · care team`, count: 0, assigned: true, latest: null });
  }
  return out;
}

// ---------------------------------------------------------------- organ hero hotspots

/** Anatomical anchor points (percent of the hero box) per organ render — one per condition. */
export const HOTSPOT_ANCHORS: Record<OrganKind, { x: number; y: number }[]> = {
  heart: [{ x: 58, y: 66 }, { x: 64, y: 24 }, { x: 34, y: 44 }],
  brain: [{ x: 40, y: 38 }, { x: 64, y: 62 }, { x: 52, y: 26 }],
  lungs: [{ x: 34, y: 56 }, { x: 66, y: 60 }, { x: 50, y: 22 }],
  kidney: [{ x: 56, y: 44 }, { x: 40, y: 66 }],
  liver: [{ x: 40, y: 48 }, { x: 52, y: 62 }],
  cells: [{ x: 40, y: 40 }, { x: 62, y: 60 }],
  thyroid: [{ x: 38, y: 48 }, { x: 62, y: 48 }],
  pancreas: [{ x: 34, y: 54 }, { x: 60, y: 46 }],
  spine: [{ x: 50, y: 64 }, { x: 50, y: 40 }],
  uterus: [{ x: 50, y: 46 }, { x: 28, y: 46 }, { x: 72, y: 46 }],
  gut: [{ x: 56, y: 46 }, { x: 44, y: 70 }],
  knee: [{ x: 50, y: 52 }, { x: 56, y: 44 }],
};
