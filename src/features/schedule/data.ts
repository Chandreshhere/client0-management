import type { Appointment, AppointmentStatus, Discipline, Priority } from "@/data/types";
import { WEEK_APPOINTMENTS } from "@/data/appointments";
import { BRANCHES, STAFF } from "@/data/staff";

/**
 * Scheduling fixtures and constants (synthetic). Shared entities — patients, staff, the week's
 * appointments (including today's arrival times), classes and the waitlist — are imported from
 * `@/data/*`; this file only adds what the diary needs on top: a service catalogue, working hours
 * parsed from staff profiles and waitlist matching hints.
 *
 * Clock: the demo is frozen at Fri 13 Nov 2026, 09:40 IST (see `TODAY` in `@/lib/format`).
 * All times are handled as IST wall-clock strings so rendering never depends on the viewer's
 * timezone.
 */

export const TODAY_KEY = "2026-11-13";
export const NOW_MIN = 9 * 60 + 40;
export const NOW_ISO = "2026-11-13T09:40:00+05:30";

/** The synthetic diary only contains bookings for this range. */
export const DIARY_FROM = "2026-11-09";
export const DIARY_TO = "2026-11-14";

/** Clinic day shown on the calendar (extends automatically if a booking falls outside). */
export const DAY_START = 8 * 60;
export const DAY_END = 19 * 60;
export const LUNCH = { start: 13 * 60, end: 14 * 60 } as const;

/** Everyone who holds a diary (front desk, coordinator and admin don't). */
export const PRACTITIONERS = STAFF.filter((s) => s.discipline !== "operations");

export const LEAVE: Record<string, { until: string; label: string }> = {
  "s-sana": { until: "2026-11-18", label: "On leave until 18 Nov" },
};

export type Hours = { start: number; end: number };

/** "09:00 – 17:00" → minutes from midnight. Profiles without a time range ("On leave…") give null. */
function parseHours(text: string): Hours | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return end > start ? { start, end } : null;
}

/**
 * Working hours from each practitioner's staff profile (the same every clinic day — profiles have
 * no per-weekday rota). Null when the profile carries no range; the diary then assumes clinic hours.
 */
export const PROFILE_HOURS: Record<string, Hours | null> = Object.fromEntries(PRACTITIONERS.map((s) => [s.id, parseHours(s.workingHours)]));

export type Service = {
  id: string;
  label: string;
  discipline: Exclude<Discipline, "operations">;
  durationMin: number;
  staffIds: string[];
  kind: Appointment["kind"];
};

/** Service catalogue (doc §2A: consultation types, durations, eligible practitioners). */
export const SERVICES: Service[] = [
  { id: "new-consult", label: "New consultation", discipline: "medical", durationMin: 45, staffIds: ["s-ananya", "s-vikram", "s-sana"], kind: "consultation" },
  { id: "cardio-fu", label: "Cardiology follow-up", discipline: "medical", durationMin: 30, staffIds: ["s-ananya"], kind: "follow-up" },
  { id: "heart-review", label: "Heart Health review", discipline: "medical", durationMin: 30, staffIds: ["s-ananya"], kind: "review" },
  { id: "ecg-review", label: "ECG review", discipline: "medical", durationMin: 30, staffIds: ["s-ananya"], kind: "review" },
  { id: "diabetes-review", label: "Diabetes review", discipline: "medical", durationMin: 30, staffIds: ["s-vikram"], kind: "review" },
  { id: "thyroid-fu", label: "Thyroid follow-up", discipline: "medical", durationMin: 30, staffIds: ["s-vikram"], kind: "follow-up" },
  { id: "pcos-review", label: "PCOS review", discipline: "medical", durationMin: 30, staffIds: ["s-vikram"], kind: "review" },
  { id: "gp-fu", label: "General follow-up", discipline: "medical", durationMin: 30, staffIds: ["s-sana", "s-ananya", "s-vikram"], kind: "follow-up" },
  { id: "nutri-assess", label: "Nutrition assessment", discipline: "nutrition", durationMin: 45, staffIds: ["s-meera", "s-rohan"], kind: "consultation" },
  { id: "nutri-review", label: "Nutrition review", discipline: "nutrition", durationMin: 30, staffIds: ["s-meera", "s-rohan"], kind: "review" },
  { id: "meal-checkin", label: "Meal-plan check-in", discipline: "nutrition", durationMin: 30, staffIds: ["s-meera", "s-rohan"], kind: "follow-up" },
  { id: "cardiac-yoga", label: "Cardiac rehab yoga · 1:1", discipline: "movement", durationMin: 45, staffIds: ["s-kavya"], kind: "session" },
  { id: "yoga-therapy", label: "Yoga therapy · 1:1", discipline: "movement", durationMin: 45, staffIds: ["s-kavya", "s-arjun"], kind: "session" },
  { id: "back-care", label: "Back care · 1:1", discipline: "movement", durationMin: 45, staffIds: ["s-arjun"], kind: "session" },
  { id: "breathwork", label: "Breathwork · 1:1", discipline: "movement", durationMin: 45, staffIds: ["s-lakshmi"], kind: "session" },
  { id: "prenatal", label: "Prenatal yoga · 1:1", discipline: "movement", durationMin: 45, staffIds: ["s-lakshmi"], kind: "session" },
];

export const serviceById = (id: string | undefined) => SERVICES.find((s) => s.id === id);
export const servicesFor = (staffId: string) => SERVICES.filter((s) => s.staffIds.includes(staffId));
/** The practitioner's shortest service — what "book their next free slot" offers. */
export const quickService = (staffId: string): Service | undefined => [...servicesFor(staffId)].sort((a, b) => a.durationMin - b.durationMin)[0];
/** Best-effort match from a booking's free-text service to the catalogue (for rescheduling). */
export const serviceForLabel = (label: string) => SERVICES.find((s) => label.toLowerCase().startsWith(s.label.toLowerCase().split(" · ")[0]));

export const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

export const ROOMS = BRANCHES.flatMap((b) => b.rooms.map((room) => ({ room, branch: b.id, branchName: b.name })));
export const roomBranch = (room: string) => ROOMS.find((r) => r.room === room)?.branchName ?? "Indiranagar";

export const CANCEL_REASONS = [
  "Patient request",
  "Patient unwell",
  "Practitioner unavailable",
  "Clinic schedule change",
  "Booked in error",
  "Other",
] as const;

const INACTIVE_SEED: AppointmentStatus[] = ["cancelled", "no-show"];

/**
 * The diary's starting bookings. The shared week generator can book one patient several times on
 * the same day with the same practitioner (e.g. six reviews in a row), which no front desk would
 * believe, so the schedule keeps the first booking per patient · practitioner · day — plus the
 * first active rebooking when that first one was cancelled or missed. Today's hand-written list
 * has no such repeats; once the generator draws distinct patients this keeps everything.
 */
export const SEED_APPOINTMENTS: Appointment[] = (() => {
  const kept = new Map<string, Appointment[]>();
  for (const a of WEEK_APPOINTMENTS) {
    const key = `${a.start.slice(0, 10)}|${a.staffId}|${a.patientId}`;
    const prior = kept.get(key);
    if (!prior) kept.set(key, [a]);
    else if (prior.length === 1 && INACTIVE_SEED.includes(prior[0].status) && !INACTIVE_SEED.includes(a.status)) prior.push(a);
  }
  const keep = new Set([...kept.values()].flat().map((a) => a.id));
  return WEEK_APPOINTMENTS.filter((a) => keep.has(a.id));
})();

export type TimePreference = {
  /** 0 = Sunday … 6 = Saturday */
  days?: number[];
  /** earliest start, minutes from midnight */
  after?: number;
  /** latest start, minutes from midnight */
  before?: number;
  /** last acceptable date (YYYY-MM-DD) */
  byDate?: string;
};

/** How each synthetic waitlist entry maps onto the diary, so "Offer slot" can find matches. */
export const WAITLIST_MATCH: Record<string, { staffIds: string[]; serviceId: string; classId?: string; prefer?: TimePreference }> = {
  w1: { staffIds: ["s-sana"], serviceId: "gp-fu", prefer: { days: [1, 2, 3], before: 12 * 60 } },
  w2: { staffIds: ["s-lakshmi"], serviceId: "breathwork", classId: "c-breath-13" },
  w3: { staffIds: ["s-ananya"], serviceId: "cardio-fu", prefer: { days: [1, 2, 3, 4, 5], after: 16 * 60 } },
  // Dr. Sana is on leave; Dr. Vikram Iyer is covering her patients (see the class precaution notes).
  w4: { staffIds: ["s-vikram"], serviceId: "gp-fu", prefer: { days: [1, 2, 3, 4, 5], after: 16 * 60 } },
  w5: { staffIds: ["s-sana"], serviceId: "gp-fu", prefer: { byDate: "2026-11-30" } },
};

export const PREFERENCE_CHIPS: { id: string; label: string; prefer: TimePreference }[] = [
  { id: "wk-morning", label: "Weekday mornings", prefer: { days: [1, 2, 3, 4, 5], before: 12 * 60 } },
  { id: "wk-afternoon", label: "Weekday afternoons", prefer: { days: [1, 2, 3, 4, 5], after: 12 * 60, before: 16 * 60 } },
  { id: "wk-evening", label: "Weekday evenings", prefer: { days: [1, 2, 3, 4, 5], after: 16 * 60 } },
  { id: "saturday", label: "Saturdays", prefer: { days: [6] } },
];

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const DISCIPLINE_COLOR: Record<Discipline, string> = {
  medical: "var(--color-medical)",
  nutrition: "var(--color-nutrition)",
  movement: "var(--color-movement)",
  operations: "var(--color-ops)",
};
