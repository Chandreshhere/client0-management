import { INVOICES } from "@/data/records";
import { CARE_PLAN } from "@/data/featured";
import { PACKAGES } from "@/data/programs";
import { CLINIC } from "@/data/staff";
import { formatINR } from "@/lib/format";
import type { Invoice } from "@/data/types";
import { PAST, REQUESTED, UPCOMING, type PortalAppt } from "../appointments/data";
import { ME, PATIENT_ID } from "../record";
import { addDays, istIso, weekdayOf } from "../time";

/**
 * Billing for the patient, from the shared invoices and package balance. Package cells are
 * built from the patient's own appointments: attended sessions carry their package number,
 * booked ones use a session when they happen, and the rest are free to book.
 */

export const MY_INVOICES: Invoice[] = INVOICES.filter((i) => i.patientId === PATIENT_ID).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
export const PACKAGE = PACKAGES.find((p) => p.patientId === PATIENT_ID) ?? null;
export const BALANCE_DUE = ME.balanceDue;

const usesPackage = (a: PortalAppt) => /package session/i.test(a.cost);

/** Attended sessions whose package number is known ("Package session 17 of 24"). */
const knownUsed = PAST.filter((a) => a.status === "attended" && usesPackage(a))
  .map((a) => ({ n: Number(a.cost.match(/session (\d+) of/i)?.[1] ?? NaN), appt: a }))
  .filter((x) => Number.isFinite(x.n));

/** Booked sessions that will each use one credit, soonest first. */
export const BOOKED_SESSIONS = UPCOMING.filter((a) => a.status === "booked" && usesPackage(a)).sort((a, b) => a.start.localeCompare(b.start));

export type CellState = "used" | "booked" | "free";
export interface SessionCell {
  n: number;
  state: CellState;
  /** ISO start for known used/booked sessions, or the next class it could cover (free) */
  at?: string;
  label: string;
}

/** Weekdays the patient's group class runs (from their booked classes). */
const CLASS_DAYS = Array.from(new Set(UPCOMING.filter((a) => a.kind === "class").map((a) => weekdayOf(a.start.slice(0, 10))))).sort();
const CLASS_TIME = UPCOMING.find((a) => a.kind === "class")?.start.slice(11, 16) ?? "07:30";

function nextClassDates(afterDay: string, count: number) {
  const out: string[] = [];
  let d = afterDay;
  for (let guard = 0; out.length < count && guard < 90 && CLASS_DAYS.length; guard++) {
    d = addDays(d, 1);
    if (CLASS_DAYS.includes(weekdayOf(d))) out.push(istIso(d, CLASS_TIME));
  }
  return out;
}

export const CELLS: SessionCell[] = (() => {
  if (!PACKAGE) return [];
  const cells: SessionCell[] = [];
  for (let n = 1; n <= PACKAGE.used; n++) {
    const known = knownUsed.find((k) => k.n === n);
    cells.push({ n, state: "used", at: known?.appt.start, label: known ? `Session ${n} · used ${known.appt.service}` : `Session ${n} · used` });
  }
  BOOKED_SESSIONS.slice(0, PACKAGE.total - PACKAGE.used).forEach((a, i) => {
    cells.push({ n: PACKAGE.used + i + 1, state: "booked", at: a.start, label: `Session ${PACKAGE.used + i + 1} · booked: ${a.service}` });
  });
  const lastBooked = cells.filter((c) => c.state === "booked").at(-1)?.at?.slice(0, 10) ?? knownUsed.at(-1)?.appt.start.slice(0, 10);
  const free = PACKAGE.total - cells.length;
  const forecast = lastBooked ? nextClassDates(lastBooked, free) : [];
  for (let i = 0; i < free; i++) cells.push({ n: cells.length + 1, state: "free", at: forecast[i], label: `Session ${cells.length + 1} · free to book` });
  return cells;
})();

export const FREE = CELLS.filter((c) => c.state === "free");
/** If the free sessions are used at the class rhythm, the last class they'd cover. */
export const COVERS_UNTIL = FREE.at(-1)?.at ?? null;
export const CLASS_DAY_NAMES = CLASS_DAYS.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]);
export const PROGRAMME_REVIEW = CARE_PLAN.nextReview;

/** "₹800 · payable at checkout" → 800 */
const amountOf = (cost: string) => {
  const m = cost.match(/₹\s?([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

export interface UpcomingCharge {
  id: string;
  label: string;
  at: string;
  amount: number;
  when: string;
  confirmed: boolean;
}

/** Visits ahead that will be charged (from their cost line); requests only if confirmed later. */
export function upcomingCharges(localRequests: PortalAppt[]): UpcomingCharge[] {
  return [...UPCOMING, ...REQUESTED, ...localRequests]
    .flatMap((a) => {
      const amount = amountOf(a.cost);
      if (amount === null || /paid/i.test(a.cost)) return [];
      return [{ id: a.id, label: a.service, at: a.start, amount, when: /checkout/i.test(a.cost) ? "Billed at checkout after the visit" : "Billed after the visit", confirmed: a.status === "booked" }];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Plain-text receipt, generated in the browser. */
export function receiptText(inv: Invoice) {
  const lines = [
    CLINIC.legal,
    `Receipt for invoice ${inv.number}`,
    `Issued: ${new Date(inv.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`,
    `Patient: ${ME.name}`,
    "",
    ...inv.items.map((i) => `${i.label.padEnd(40, " ")} ${formatINR(i.amount)}`),
    "",
    `Total: ${formatINR(inv.total)}`,
    `Paid: ${formatINR(inv.paid)}${inv.method ? ` (${inv.method})` : ""}`,
    "",
    "Demo receipt — synthetic data, generated in your browser.",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Package burn-down: sessions left over time, from the same cells as the package grid
// ---------------------------------------------------------------------------------------------

export type BurnKind = "used" | "booked" | "free" | "expiry";
export interface BurnPoint {
  at: string;
  /** sessions left after this point */
  left: number;
  kind: BurnKind;
  /** package session number (absent for the expiry point) */
  n?: number;
  label: string;
}

export const EXPIRES_AT = PACKAGE ? istIso(PACKAGE.expires, "23:59") : null;

/**
 * Points in time order: used sessions whose date is listed in Appointments, then the booked
 * sessions, then the free ones placed on the next class days (only those before expiry), and a
 * final point at expiry carrying whatever would still be unused.
 */
export const BURN: BurnPoint[] = (() => {
  if (!PACKAGE || !EXPIRES_AT) return [];
  const pts: BurnPoint[] = CELLS.filter((c) => c.at && (c.state !== "free" || c.at <= EXPIRES_AT)).map((c) => ({
    at: c.at!,
    left: PACKAGE.total - c.n,
    kind: c.state,
    n: c.n,
    label: c.state === "used" ? `Session ${c.n} used` : c.state === "booked" ? `Session ${c.n} booked` : `Session ${c.n} free — next ${CLASS_DAY_NAMES.length ? "class day" : "slot"}`,
  }));
  const last = pts.at(-1);
  if (last && last.at < EXPIRES_AT) pts.push({ at: EXPIRES_AT, left: last.left, kind: "expiry", label: "Package expires" });
  return pts;
})();

/** Free sessions that would still be unused when the package expires (at the class rhythm). */
export const UNUSED_AT_EXPIRY = PACKAGE && EXPIRES_AT ? FREE.filter((c) => !c.at || c.at > EXPIRES_AT).length : 0;
/** When the last session would be used, if that happens before expiry. */
export const LAST_SESSION_AT = BURN.find((p) => p.n === PACKAGE?.total)?.at ?? null;
/** Used sessions without a date in the portal (between the first listed one and the next). */
export const UNDATED_USED = CELLS.filter((c) => c.state === "used" && !c.at).map((c) => c.n);

// ---------------------------------------------------------------------------------------------
// How the visits on the Appointments page are covered (read from each visit's cost line)
// ---------------------------------------------------------------------------------------------

export type Coverage = "programme" | "package" | "pay" | "none";
export const COVERAGE_ORDER: Coverage[] = ["programme", "package", "pay", "none"];
export const COVERAGE_LABEL: Record<Coverage, string> = {
  programme: "Included in your programme",
  package: "Package sessions",
  pay: "Paid at the visit",
  none: "No charge",
};

export function coverageOf(a: PortalAppt): Coverage {
  if (/included in your programme/i.test(a.cost)) return "programme";
  if (/package session/i.test(a.cost)) return "package";
  if (amountOf(a.cost) !== null) return "pay";
  return "none";
}

export type VisitPhase = "done" | "booked" | "requested" | "cancelled";
export const phaseOf = (a: PortalAppt): VisitPhase =>
  a.status === "cancelled" ? "cancelled" : a.status === "requested" ? "requested" : a.status === "booked" ? "booked" : "done";

export function coverageGroups(localRequests: PortalAppt[]) {
  const all = [...PAST, ...UPCOMING, ...REQUESTED, ...localRequests].sort((a, b) => a.start.localeCompare(b.start));
  return {
    total: all.length,
    groups: COVERAGE_ORDER.map((c) => {
      const visits = all.filter((a) => coverageOf(a) === c);
      const amount = visits.reduce((s, a) => s + (amountOf(a.cost) ?? 0), 0);
      return { id: c, label: COVERAGE_LABEL[c], visits, amount };
    }),
  };
}
