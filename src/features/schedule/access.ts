import type { Role } from "@/data/types";

/**
 * Who does what in the front office (spec F10–F11, "Roles and access"). Each visit status has one
 * owner: Reception checks patients in, marks no-shows and runs checkout; the practitioner moves
 * their own patient from waiting to "with practitioner" and on to checkout. Booking, rescheduling
 * and cancelling sit with Reception and doctors (Admin covers the desk; a coordinator rebooks
 * missed visits in Pro). Reception and Admin see no clinical content — no reason for visit,
 * diagnoses or conditions — only demographics, times, rooms and services.
 */
export type ScheduleAccess = {
  /** sees clinical context (reason for visit) — practitioners only */
  clinical: boolean;
  /** book, reschedule, cancel */
  canBook: boolean;
  /** check in, mark no-show, checkout and record payment, close the visit */
  runsDesk: boolean;
};

const DESK: Role[] = ["frontdesk", "admin"];
const BOOKERS: Role[] = ["frontdesk", "admin", "doctor", "coordinator"];
const CLINICAL: Role[] = ["doctor", "nutritionist", "yoga"];

export function scheduleAccess(role: Role): ScheduleAccess {
  return { clinical: CLINICAL.includes(role), canBook: BOOKERS.includes(role), runsDesk: DESK.includes(role) };
}

/** A practitioner acts on their own patients' visits; the desk acts on everyone's. */
export const canMoveVisit = (a: ScheduleAccess, userId: string, staffId: string) => a.runsDesk || userId === staffId;

export type HistoryEntry = { at: string; by: string; action: string };

/**
 * A booking's service as a role may see it. Practitioners see it as booked; Reception and Admin
 * see the service without clinical detail added after a " · " ("Walk-in · palpitations" →
 * "Walk-in", "Nutrition review · bone health" → "Nutrition review"); "· 1:1" is kept.
 */
export function serviceText(service: string, clinical: boolean) {
  if (clinical) return service;
  if (/^walk-in\b/i.test(service)) return "Walk-in";
  const [head, ...rest] = service.split(" · ");
  return rest.length && rest.every((r) => /^(1:1|group)$/i.test(r.trim())) ? service : head;
}
