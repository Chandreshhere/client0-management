import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { TODAY_KEY, addDays, daysAgo, istDayKey, newestFirst } from "@/features/settings/time";
import { OPEN_STATUSES, RECORDABLE_METHODS, STATUS_LABEL, type DisplayStatus, type PayMethod, type PaymentEvent } from "./data";
import type { InvoiceView } from "./store";

/**
 * Derived billing figures. Collections are the payments someone recorded at the desk (cash, UPI,
 * card) — the shared history plus anything recorded in this browser session. Package credits and
 * refunds are not collections. Nothing is "confirmed" by a gateway: that is the payment add-on.
 */

/** Monday of the demo week (Fri 13 Nov 2026 → Mon 9 Nov). */
const WEEKDAY = new Date(`${TODAY_KEY}T12:00:00Z`).getUTCDay(); // 5 = Friday
export const WEEK_START = addDays(TODAY_KEY, -((WEEKDAY + 6) % 7));
/** Week to date: Monday → today. */
export const WEEK_DAYS = Array.from({ length: daysAgo(WEEK_START) + 1 }, (_, i) => addDays(WEEK_START, i));

const SHORT_DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
export const dayLabel = (key: string) => `${SHORT_DAY.format(new Date(`${key}T12:00:00Z`))} ${Number(key.slice(8, 10))}`;

/** ₹ compact for axes and bubbles: ₹850 · ₹8.5k · ₹12k. */
export function rupeesShort(n: number) {
  const a = Math.abs(n);
  const s = a >= 1000 ? `₹${+(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `₹${a}`;
  return n < 0 ? `−${s}` : s;
}

/** A recorded payment with the invoice it settles (for per-practitioner totals). */
export type Collection = PaymentEvent & { practitionerId: string | null; patientId: string; number: string };

/** Every recorded payment (no refunds, no package credits), newest first. */
export function collections(invoices: InvoiceView[]): Collection[] {
  return invoices
    .flatMap((inv) => inv.events.filter((e) => e.kind === "payment" && e.amount > 0).map((e) => ({ ...e, practitionerId: inv.practitionerId, patientId: inv.patientId, number: inv.number })))
    .sort((a, b) => newestFirst(a.at, b.at));
}

const onDay = (c: Collection, key: string) => istDayKey(c.at) === key;

/** Collected per day this week (Mon → today). */
export function weeklyCollections(all: Collection[]) {
  return WEEK_DAYS.map((key) => {
    const mine = all.filter((c) => onDay(c, key));
    return { key, label: dayLabel(key), amount: mine.reduce((s, c) => s + c.amount, 0), count: mine.length };
  });
}

/** Collected per day over the last `n` days (oldest → newest), for the today tile spark. */
export function dailyCollections(all: Collection[], n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(TODAY_KEY, i - (n - 1));
    return { key, value: all.filter((c) => onDay(c, key)).reduce((s, c) => s + c.amount, 0) };
  });
}

/** One day's collections: total, by method (cash, UPI, card) and by practitioner. */
export function dayBreakdown(all: Collection[], key: string) {
  const mine = all.filter((c) => onDay(c, key));
  const byMethod = RECORDABLE_METHODS.map((method) => {
    const m = mine.filter((c) => c.method === method);
    return { method: method as PayMethod, amount: m.reduce((s, c) => s + c.amount, 0), count: m.length };
  });
  const ids = [...new Set(mine.map((c) => c.practitionerId ?? "none"))];
  const byPractitioner = ids
    .map((id) => {
      const m = mine.filter((c) => (c.practitionerId ?? "none") === id);
      const s = id === "none" ? undefined : staffById(id);
      return { id, name: s?.name ?? "No practitioner", avatar: s?.avatar ?? null, amount: m.reduce((t, c) => t + c.amount, 0), count: m.length };
    })
    .sort((a, b) => b.amount - a.amount);
  return { total: mine.reduce((s, c) => s + c.amount, 0), count: mine.length, payments: mine, byMethod, byPractitioner };
}

/** Outstanding balance split by status (bubble chart in the focal card). */
export type OpenBucket = { status: DisplayStatus; label: string; amount: number; count: number };

export function outstandingByStatus(invoices: InvoiceView[]): OpenBucket[] {
  const order: DisplayStatus[] = ["overdue", "due", "partially-paid"];
  return order
    .map((status) => {
      const mine = invoices.filter((i) => i.display === status && i.balance > 0);
      return { status, label: STATUS_LABEL[status], amount: mine.reduce((s, i) => s + i.balance, 0), count: mine.length };
    })
    .filter((b) => b.count > 0);
}

/** Invoice count per display status, in a fixed reading order (settled → owed → refunded). */
export const STATUS_ORDER: DisplayStatus[] = ["paid", "partially-paid", "due", "overdue", "refunded"];

/**
 * Segment colours for the status bar, in STATUS_ORDER. Semantic (these ARE states): settled =
 * green, owed = blue → amber → red, refunded = neutral grey. The legend always prints every name
 * and count, so colour is never the only signal.
 */
export const STATUS_FILL: Record<DisplayStatus, string> = {
  paid: "#17834a",
  "partially-paid": "#2a78d6",
  due: "#eda100",
  overdue: "#e34948",
  refunded: "#8d948e",
};

export function statusCounts(invoices: InvoiceView[]) {
  return STATUS_ORDER.map((s) => ({ status: s, label: STATUS_LABEL[s], value: invoices.filter((i) => i.display === s).length })).filter((p) => p.value > 0);
}

/** The open invoice that has waited longest (issued date → today). */
export function oldestOpen(invoices: InvoiceView[]) {
  const open = invoices.filter((i) => OPEN_STATUSES.includes(i.display) && i.balance > 0);
  const oldest = [...open].sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt))[0];
  if (!oldest) return null;
  return { invoice: oldest, days: daysAgo(oldest.issuedAt), patient: patientById(oldest.patientId) };
}
