import type { Patient } from "@/data/types";
import { patientById } from "@/data/patients";
import { ORGAN_LABEL, primaryOrgan, type OrganKind } from "@/data/anatomy";
import { pluralize } from "@/lib/format";
import type { Tone } from "@/components/ui/status";
import { daysPhrase, daysUntil } from "@/features/settings/time";
import { enrolledIn, programmeForName, type PackageRow, type Programme } from "./data";
import type { MeterTone } from "./credit-meter";

/**
 * Package figures for /billing/packages, all derived from the shared PACKAGES (+ packages sold in
 * this browser session) and the programme catalogue in ./data.
 */

export type Health = { key: "expired" | "used-up" | "expiring" | "low" | "active"; label: string; tone: Tone; meter: MeterTone; note: string };

/** Most severe state first; each carries a text label so colour is never the only signal. */
export function healthOf(p: PackageRow): Health {
  const left = p.total - p.used;
  const days = daysUntil(p.expires);
  if (days < 0) return { key: "expired", label: "Expired", tone: "danger", meter: "danger", note: `${pluralize(left, "credit")} unused` };
  if (left <= 0) return { key: "used-up", label: "All used", tone: "neutral", meter: "muted", note: "Every credit has been used" };
  if (days <= 30) return { key: "expiring", label: "Expires soon", tone: "warning", meter: "warning", note: `${pluralize(left, "credit")} to use ${daysPhrase(p.expires)}` };
  if (isLow(p)) return { key: "low", label: "Running low", tone: "warning", meter: "warning", note: `Only ${left} left — offer a renewal` };
  return { key: "active", label: "Active", tone: "success", meter: "neutral", note: "" };
}

/** ≤ 20% (min 2) credits left on a live package. */
export const isLow = (p: PackageRow) => {
  const left = p.total - p.used;
  return left > 0 && left <= Math.max(2, Math.round(p.total * 0.2)) && daysUntil(p.expires) >= 0;
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

// ---------------------------------------------------------------------------------------------
// Catalogue organs: enrolled patients' primary body systems
// ---------------------------------------------------------------------------------------------

export function programmeOrgans(prog: Programme): { organ: OrganKind; label: string; patients: Patient[] }[] {
  const map = new Map<OrganKind, Patient[]>();
  for (const p of enrolledIn(prog)) {
    const o = primaryOrgan(p);
    if (!o) continue;
    map.set(o, [...(map.get(o) ?? []), p]);
  }
  return [...map.entries()].map(([organ, patients]) => ({ organ, label: ORGAN_LABEL[organ], patients })).sort((a, b) => b.patients.length - a.patients.length);
}
