import type { Appointment, Patient, Role, Staff } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { WAITLIST, WEEK_APPOINTMENTS } from "@/data/appointments";
import { PATIENTS } from "@/data/patients";
import { DOCUMENTS } from "@/data/records";
import { ORGAN_LABEL, SYSTEM_INFO, organForSystem, patientSystems, type OrganKind } from "@/data/anatomy";
import type { Tone } from "@/components/ui/status";
import { NOW_MIN, TODAY_KEY, hhmm, istDayKey, istMinutes, toMinutes } from "@/features/settings/time";

/**
 * Team fixtures the shared data doesn't carry (usual weekly pattern, breaks, the leave record)
 * plus derived views of the shared diary. Load figures come from WEEK_APPOINTMENTS; the cover
 * arrangement matches the shared story: Dr. Vikram Iyer covers Dr. Sana Qureshi's patients
 * while she is on leave (he changed Rekha Iyengar's SpO₂ floor "covering", 13 Nov 08:44).
 */

export type StaffRole = Exclude<Role, "patient">;
export type Span = { start: number; end: number };

export const DAY_FROM = 7 * 60;
export const DAY_TO = 20 * 60;

export const LEAVE: Record<string, { from: string; until: string; reason: string; usualHours: string; coverId: string; coverSince: string }> = {
  "s-sana": { from: "2026-11-10", until: "2026-11-18", reason: "Annual leave", usualHours: "09:30 – 16:30", coverId: "s-vikram", coverSince: "2026-11-10" },
};

/** Parses "09:00 – 17:00" (en dash or hyphen). */
export function parseHours(text: string): Span | null {
  const m = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/.exec(text);
  if (!m) return null;
  const start = toMinutes(m[1]);
  const end = toMinutes(m[2]);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/** Usual working hours (for staff on leave, the pattern they return to). */
export const usualHours = (s: Staff): Span | null => parseHours(LEAVE[s.id]?.usualHours ?? s.workingHours);

/** Today's hours, or null when not working today (leave). */
export const hoursToday = (s: Staff): Span | null => (s.status === "on-leave" ? null : parseHours(s.workingHours));

export const spanText = (h: Span | null) => (h ? `${hhmm(h.start)}–${hhmm(h.end)}` : "Not working");

/** Breaks today. Lakshmi's matches her live "on break" status at 09:40; others take the clinic lunch hour. */
export function breaksToday(s: Staff): Span[] {
  const h = hoursToday(s);
  if (!h) return [];
  if (s.id === "s-lakshmi") return [{ start: 9 * 60 + 30, end: 10 * 60 }];
  const lunch = { start: 13 * 60, end: 14 * 60 };
  return h.start <= lunch.start && h.end >= lunch.end ? [lunch] : [];
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Usual week: Monday–Saturday on the staff member's hours, Sunday off (synthetic pattern). */
export function usualWeek(s: Staff): { day: (typeof WEEKDAYS)[number]; hours: Span | null }[] {
  const h = usualHours(s);
  return WEEKDAYS.map((day) => ({ day, hours: day === "Sun" ? null : h }));
}

// ---------------------------------------------------------------------------------------------
// "Now" — reconciles the live status with working hours at the demo clock (09:40 IST)
// ---------------------------------------------------------------------------------------------

export type NowKey = "deactivated" | "leave" | "before" | "after" | "in-session" | "on-break" | "available";
export type NowState = { key: NowKey; label: string; tone: Tone; working: boolean };

export function nowState(s: Staff, deactivated = false): NowState {
  if (deactivated) return { key: "deactivated", label: "Deactivated", tone: "draft", working: false };
  if (s.status === "on-leave") {
    const until = LEAVE[s.id]?.until;
    return { key: "leave", label: until ? `On leave · until ${Number(until.slice(8, 10))} Nov` : "On leave", tone: "danger", working: false };
  }
  const h = hoursToday(s);
  if (!h) return { key: "after", label: "Off today", tone: "neutral", working: false };
  if (NOW_MIN < h.start) return { key: "before", label: `Starts ${hhmm(h.start)}`, tone: "neutral", working: false };
  if (NOW_MIN >= h.end) return { key: "after", label: "Finished today", tone: "neutral", working: false };
  if (breaksToday(s).some((b) => NOW_MIN >= b.start && NOW_MIN < b.end) || s.status === "on-break") return { key: "on-break", label: "On break", tone: "warning", working: true };
  if (s.status === "in-session") return { key: "in-session", label: "In session", tone: "dark", working: true };
  return { key: "available", label: "Available", tone: "success", working: true };
}

// ---------------------------------------------------------------------------------------------
// Load from the shared diary
// ---------------------------------------------------------------------------------------------

/** Diary days this week (Mon 9 – Sat 14 Nov) in order. */
export const WEEK_KEYS = [...new Set(WEEK_APPOINTMENTS.map((a) => istDayKey(a.start)))].sort();

const SEEN = new Set<Appointment["status"]>(["completed", "in-session", "checkout", "arrived", "waiting"]);

export const isClinician = (s: Staff) => s.role === "doctor" || s.role === "nutritionist" || s.role === "yoga";
export const CLINICIANS = STAFF.filter(isClinician);

export function appointmentsOn(staffId: string, key: string) {
  return WEEK_APPOINTMENTS.filter((a) => a.staffId === staffId && istDayKey(a.start) === key).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** Today: everything not cancelled counts as load (a no-show still held the slot). */
export function todayLoad(staffId: string) {
  const all = appointmentsOn(staffId, TODAY_KEY);
  const held = all.filter((a) => a.status !== "cancelled");
  const minutes = held.reduce((s, a) => s + a.durationMin, 0);
  return {
    all,
    count: held.length,
    minutes,
    seen: held.filter((a) => SEEN.has(a.status)).length,
    ahead: held.filter((a) => a.status === "booked").length,
    noShow: held.filter((a) => a.status === "no-show").length,
    cancelled: all.length - held.length,
  };
}

/** Per diary day: attended (or in progress), booked ahead, no-show; cancellations reported apart. */
export function weekLoad(staffId: string) {
  return WEEK_KEYS.map((key) => {
    const day = appointmentsOn(staffId, key);
    return {
      key,
      attended: day.filter((a) => SEEN.has(a.status)).length,
      booked: day.filter((a) => a.status === "booked").length,
      noShow: day.filter((a) => a.status === "no-show").length,
      cancelled: day.filter((a) => a.status === "cancelled").length,
    };
  });
}

export const durationText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${String(min % 60).padStart(2, "0")}m` : ""}` : `${min}m`);

/** Track blocks for today's bookings (done = already happened, booked = still ahead). */
export function todayBlocks(staffId: string) {
  return todayLoad(staffId)
    .all.filter((a) => a.status !== "cancelled")
    .map((a) => {
      const start = istMinutes(a.start);
      return { start, end: start + a.durationMin, label: `${hhmm(start)} · ${a.service}`, tone: a.status === "booked" ? ("booked" as const) : ("done" as const) };
    });
}

export const careTeamOf = (staffId: string) => PATIENTS.filter((p) => Object.values(p.careTeam).includes(staffId));

// ---------------------------------------------------------------------------------------------
// Body-system caseload (organ per patient comes from their recorded conditions)
// ---------------------------------------------------------------------------------------------

export function patientOrgan(p: Patient): { organ: OrganKind; system: string } | null {
  const s = patientSystems(p)[0];
  if (!s) return null;
  return { organ: organForSystem(s.key, s.conditions), system: SYSTEM_INFO[s.key].name };
}

/** Patients grouped by the organ of their primary body system, largest group first. */
export function caseloadByOrgan(patients: Patient[]) {
  const groups = new Map<OrganKind, { organ: OrganKind; label: string; system: string; patients: Patient[] }>();
  for (const p of patients) {
    const o = patientOrgan(p);
    if (!o) continue;
    const g = groups.get(o.organ) ?? { organ: o.organ, label: ORGAN_LABEL[o.organ], system: o.system, patients: [] };
    g.patients.push(p);
    groups.set(o.organ, g);
  }
  return [...groups.values()].sort((a, b) => b.patients.length - a.patients.length);
}

// ---------------------------------------------------------------------------------------------
// Leave & reassignment (doc §2A temporary cover · §3C reassignment during leave)
// ---------------------------------------------------------------------------------------------

export const COVER_DOCTORS = STAFF.filter((s) => s.role === "doctor" && s.status !== "on-leave");

export type CoverChoice = string | "none" | "wait";

/** Seed cover: the documented arrangement — Dr. Vikram Iyer for every active patient. */
export function seedCover(staffId: string): Record<string, CoverChoice> {
  const leave = LEAVE[staffId];
  return Object.fromEntries(careTeamOf(staffId).map((p) => [p.id, p.status === "completed" ? "none" : leave?.coverId ?? "wait"]));
}

/** Reports still routed to the person on leave for review. */
export const reviewsWaitingFor = (staffId: string) => DOCUMENTS.filter((d) => d.reviewerId === staffId && (d.status === "awaiting-review" || d.status === "unclassified"));

/** Waitlist requests that name the person (by first name + surname). */
export function waitlistMentioning(staffId: string) {
  const s = staffById(staffId);
  if (!s) return [];
  const short = s.name.replace(/^Dr\.\s+/, "").split(" ")[0];
  return WAITLIST.filter((w) => w.want.includes(short));
}

/** Today's cancelled bookings for the person (moved because of leave). */
export const cancelledToday = (staffId: string) => appointmentsOn(staffId, TODAY_KEY).filter((a) => a.status === "cancelled");

export const ROLE_DISCIPLINE: Record<StaffRole, Staff["discipline"]> = {
  admin: "operations",
  doctor: "medical",
  nutritionist: "nutrition",
  yoga: "movement",
  frontdesk: "operations",
  coordinator: "operations",
};

/** Axis/tooltip format for count charts: whole numbers only (fractional grid ticks stay unlabelled). */
export const countTick = (v: number) => (Number.isInteger(v) ? String(v) : "");
