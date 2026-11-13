import { primaryOrgan, ORGAN_LABEL, type OrganKind } from "@/data/anatomy";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { REFERRALS, REFERRAL_STAGES } from "@/data/care";
import { CLASSES } from "@/data/programs";
import type { CareEvent } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import type { Appointment, AttendanceState, Referral, ReferralStage, YogaClass } from "@/data/types";
import { FOOD_LOGS, GUIDANCE, PLAN_SOURCE, SLOTS, type LogMatch, type SlotId } from "@/features/nutrition/data";
import { slotsFromTemplate, sumItems, totals } from "@/features/nutrition/model";
import { NOW_ISO, TODAY_KEY, istDayKey, minutesUntil } from "./data";

/**
 * Derivations behind the dashboard visuals. Every bar, dot, bubble, organ and count on the role
 * homes comes from one of these functions (or the shared `@/data/insights` helpers) applied to
 * the shared fixtures — nothing is typed into a visual by hand.
 */

// ---------------------------------------------------------------------------------------------
// Patient-facing visibility
// ---------------------------------------------------------------------------------------------

/** What a patient may see of their own record: released, reviewed, not a draft. */
export const visibleToPatient = (e: CareEvent) => e.released && e.state !== "awaiting-review" && e.state !== "draft";

/** Dates of lab reports the clinician has not released yet (values from those days stay hidden). */
export const unreleasedLabDates = (record: PatientRecord) =>
  new Set(record.events.filter((e) => e.type === "lab" && !visibleToPatient(e)).map((e) => e.date));

/** History of one analyte, split into what the patient can see and how many newer results are pending. */
export function releasedHistory(record: PatientRecord, label: string) {
  const rows = record.events
    .flatMap((e) => (e.values ?? []).filter((v) => v.label === label).map((v) => ({ date: e.date, value: Number(v.value), unit: v.unit, flag: v.flag, visible: visibleToPatient(e) })))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { points: rows.filter((r) => r.visible), pending: rows.filter((r) => !r.visible).length };
}

// ---------------------------------------------------------------------------------------------
// Organs
// ---------------------------------------------------------------------------------------------

/**
 * Hotspot anchors per organ model (percent of the square OrganStage box), placed on the live
 * canvas framing so each condition dot sits on the organ and clear of the glass reading card in
 * the lower-left. The organ itself always comes from the record.
 */
export const ORGAN_ANCHORS: Record<OrganKind, { x: number; y: number }[]> = {
  heart: [{ x: 60, y: 57 }, { x: 50, y: 43 }, { x: 63, y: 72 }],
  brain: [{ x: 61, y: 66 }, { x: 42, y: 44 }, { x: 67, y: 50 }],
  lungs: [{ x: 58, y: 42 }, { x: 68, y: 62 }, { x: 40, y: 38 }],
  kidney: [{ x: 56, y: 44 }, { x: 40, y: 64 }],
  liver: [{ x: 40, y: 48 }, { x: 54, y: 60 }],
  cells: [{ x: 40, y: 40 }, { x: 62, y: 60 }],
  thyroid: [{ x: 38, y: 48 }, { x: 62, y: 48 }],
  pancreas: [{ x: 34, y: 54 }, { x: 60, y: 46 }],
  spine: [{ x: 50, y: 64 }, { x: 50, y: 40 }],
  uterus: [{ x: 50, y: 46 }, { x: 28, y: 50 }, { x: 72, y: 50 }],
  gut: [{ x: 56, y: 46 }, { x: 44, y: 68 }],
  knee: [{ x: 50, y: 54 }, { x: 54, y: 40 }],
};

/** Organ that represents a patient's primary problem, with the condition that put it there. */
export function organFor(patientId: string): { kind: OrganKind; label: string; condition: string } | null {
  const p = patientById(patientId);
  if (!p) return null;
  const kind = primaryOrgan(p);
  if (!kind) return null;
  return { kind, label: ORGAN_LABEL[kind], condition: p.conditions[0] ?? "" };
}

export type CaseMixGroup = {
  key: OrganKind | "unrecorded";
  label: string;
  patients: { id: string; name: string; firstAppt: Appointment; count: number }[];
};

/**
 * Today's case-mix: every patient on today's diary grouped by the organ of their primary
 * recorded condition (patients with nothing recorded yet are kept in their own group).
 */
export function caseMix(appts: Appointment[] = TODAY_APPOINTMENTS): CaseMixGroup[] {
  const byPatient = new Map<string, Appointment[]>();
  for (const a of [...appts].sort((x, y) => x.start.localeCompare(y.start))) byPatient.set(a.patientId, [...(byPatient.get(a.patientId) ?? []), a]);
  const groups = new Map<CaseMixGroup["key"], CaseMixGroup>();
  for (const [pid, list] of byPatient) {
    const p = patientById(pid);
    const kind = p ? primaryOrgan(p) : null;
    const key = kind ?? "unrecorded";
    const g = groups.get(key) ?? { key, label: kind ? ORGAN_LABEL[kind] : "Not recorded yet", patients: [] };
    g.patients.push({ id: pid, name: p?.name ?? pid, firstAppt: list[0], count: list.length });
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => Number(a.key === "unrecorded") - Number(b.key === "unrecorded") || b.patients.length - a.patients.length || a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------------------------
// Referral pipeline
// ---------------------------------------------------------------------------------------------

const OPEN_STAGES = new Set<ReferralStage>(["requested", "accepted", "booked"]);

export const isOpenReferral = (r: Referral) => OPEN_STAGES.has(r.stage);
/** An open referral whose next step is past its due date. */
export const isStuckReferral = (r: Referral) => isOpenReferral(r) && minutesUntil(r.dueBy) < 0;

/** Referrals currently sitting at each stage, with how many are past due there. */
export function referralPipeline(referrals: Referral[] = REFERRALS) {
  return REFERRAL_STAGES.map((stage) => {
    const here = referrals.filter((r) => r.stage === stage);
    return { stage, referrals: here, stuck: here.filter(isStuckReferral) };
  });
}

// ---------------------------------------------------------------------------------------------
// Yoga attendance (week of Mon 9 – Sat 14 Nov)
// ---------------------------------------------------------------------------------------------

export type AttendanceBucket = "present" | "late" | "absent" | "pending";
const BUCKET_OF: Record<AttendanceState, AttendanceBucket | null> = { present: "present", late: "late", absent: "absent", pending: "pending", cancelled: null, rescheduled: null };

/** Attendance per session for a set of classes; `override` swaps in locally saved marks for one class. */
export function attendanceBySession(classes: YogaClass[], override?: { classId: string; marks: Record<string, "present" | "late" | "absent"> }) {
  return classes.map((c) => {
    const counts: Record<AttendanceBucket, number> = { present: 0, late: 0, absent: 0, pending: 0 };
    for (const e of c.enrolled) {
      const state = override && override.classId === c.id && override.marks[e.patientId] ? override.marks[e.patientId] : e.attendance;
      const b = BUCKET_OF[state];
      if (b) counts[b] += 1;
    }
    return { cls: c, counts };
  });
}

export const WEEK_CLASSES = (branch: string | undefined) =>
  CLASSES.filter((c) => c.start >= "2026-11-09" && c.start < "2026-11-15" && staffById(c.instructorId)?.branch === branch).sort((a, b) => a.start.localeCompare(b.start));

// ---------------------------------------------------------------------------------------------
// Nutrition: plan content vs the doctor's targets, and self-reported logs
// ---------------------------------------------------------------------------------------------

export type Nutrient = "kcal" | "protein" | "fibre";

/**
 * A plan's planned energy, protein and fibre — summed from the items its template seeded (the
 * same items the plan builder shows) — against the referring doctor's guidance targets.
 */
export function planNutrients(planId: string, patientId: string) {
  const src = PLAN_SOURCE[planId];
  const guidance = GUIDANCE[patientId];
  if (!src) return null;
  const slots = slotsFromTemplate(src.template, planId, src.notes);
  const items = SLOTS.flatMap((s) => slots[s.id].map((it) => ({ ...it, slot: s.id as SlotId, slotLabel: s.label })));
  return {
    items,
    total: totals(slots),
    perSlot: SLOTS.map((s) => ({ id: s.id, label: s.label, ...sumItems(slots[s.id]) })),
    targets: guidance?.targets ?? null,
    guidanceBy: guidance?.by ?? null,
    guidanceVersion: guidance?.version ?? null,
  };
}

export const MATCH_LEVEL: Record<LogMatch, number> = { "as-planned": 3, partly: 2, different: 1, skipped: 0 };

/** A patient's self-reported meal logs, oldest first. */
export const logsFor = (patientId: string) => FOOD_LOGS.filter((l) => l.patientId === patientId).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));

// ---------------------------------------------------------------------------------------------
// Time helpers for the strip charts
// ---------------------------------------------------------------------------------------------

export const isToday = (iso: string) => istDayKey(iso) === TODAY_KEY;
export const NOW = NOW_ISO;
