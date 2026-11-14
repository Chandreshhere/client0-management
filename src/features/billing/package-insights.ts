import type { Patient } from "@/data/types";
import { patientById } from "@/data/patients";
import { pluralize } from "@/lib/format";
import type { Tone } from "@/components/ui/status";
import { daysPhrase, daysUntil } from "@/features/settings/time";
import { programmeForName, type PackageRow, type Programme } from "./data";
import type { MeterTone } from "./credit-meter";

/**
 * Package figures for /billing/packages, all derived from the shared PACKAGES (+ packages sold in
 * this browser session) and the package catalogue in ./data. Alerts follow the spec (F12): when
 * 2 credits are left, and 14 days before expiry — to Reception and the patient's instructor.
 */

/** Alert thresholds (spec F12). */
export const LOW_CREDITS = 2;
export const EXPIRY_ALERT_DAYS = 14;

export type Health = { key: "expired" | "used-up" | "expiring" | "low" | "active"; label: string; tone: Tone; meter: MeterTone; note: string };

/** Most severe state first; each carries a text label so colour is never the only signal. */
export function healthOf(p: PackageRow): Health {
  const left = p.total - p.used;
  const days = daysUntil(p.expires);
  if (days < 0) return { key: "expired", label: "Expired", tone: "danger", meter: "danger", note: `${pluralize(left, "credit")} unused` };
  if (left <= 0) return { key: "used-up", label: "All used", tone: "neutral", meter: "muted", note: "Every credit has been used" };
  if (days <= EXPIRY_ALERT_DAYS) return { key: "expiring", label: "Expires soon", tone: "warning", meter: "warning", note: `${pluralize(left, "credit")} to use — expires ${daysPhrase(p.expires)}` };
  if (isLow(p)) return { key: "low", label: "Running low", tone: "warning", meter: "warning", note: `${pluralize(left, "credit")} left — offer a renewal` };
  return { key: "active", label: "Active", tone: "success", meter: "neutral", note: "" };
}

/** 2 or fewer credits left on a live package. */
export const isLow = (p: PackageRow) => {
  const left = p.total - p.used;
  return left > 0 && left <= LOW_CREDITS && daysUntil(p.expires) >= 0;
};

/** Who the package alert goes to: Reception and the patient's yoga instructor (in-app, not sent). */
export const alertRecipients = (p: PackageRow) => {
  const instructor = patientById(p.patientId)?.careTeam.yoga;
  return instructor ? ["Reception", instructor] : ["Reception"];
};

export const isLive = (h: Health) => h.key !== "expired" && h.key !== "used-up";

// ---------------------------------------------------------------------------------------------
// Runway: days to expiry vs the pace needed to use the remaining credits
// ---------------------------------------------------------------------------------------------

/** Sessions per week the programme schedules (fixed length, else spread over its validity). */
export function plannedPace(prog: Programme | undefined): number | null {
  if (!prog) return null;
  const weeks = prog.weeks ?? prog.validityDays / 7;
  return weeks > 0 ? prog.credits / weeks : null;
}

export interface Runway {
  row: PackageRow;
  patient: Patient | undefined;
  health: Health;
  left: number;
  days: number;
  /** credits left ÷ weeks left */
  needed: number | null;
  planned: number | null;
  /** needs a faster pace than the programme schedules → credits likely to lapse */
  atRisk: boolean;
}

export function runways(rows: PackageRow[]): Runway[] {
  return rows
    .map((row) => {
      const health = healthOf(row);
      const left = Math.max(0, row.total - row.used);
      const days = daysUntil(row.expires);
      const weeks = days / 7;
      const needed = left > 0 && days > 0 ? left / weeks : null;
      const planned = plannedPace(programmeForName(row.name));
      return { row, patient: patientById(row.patientId), health, left, days, needed, planned, atRisk: needed !== null && planned !== null && needed > planned + 0.05 };
    })
    .filter((r) => isLive(r.health))
    .sort((a, b) => a.days - b.days);
}

export const pace = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}/wk`;
