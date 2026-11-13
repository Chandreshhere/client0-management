import { INVOICES, collected } from "@/data/records";
import { patientById } from "@/data/patients";
import { TODAY_KEY, addDays, daysAgo, istDayKey, newestFirst } from "@/features/settings/time";
import { OPEN_STATUSES, RECORDABLE_METHODS, STATUS_LABEL, type DisplayStatus, type PayMethod, type PaymentEvent } from "./data";
import type { InvoiceView } from "./store";

/**
 * Derived billing figures. Confirmed money always comes from the shared `collected()` (gateway,
 * bank or desk confirmations only — the failed UPI callback never counts). Payments recorded by
 * hand in this browser session are kept apart and labelled "recorded manually", never added to
 * the confirmed totals.
 */

const dayStart = (key: string) => `${key}T00:00:00+05:30`;
const dayEnd = (key: string) => `${key}T23:59:59+05:30`;

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

type SharedPayment = NonNullable<(typeof INVOICES)[number]["payments"]>[number] & { invoiceId: string; number: string; patientId: string };

const SHARED: SharedPayment[] = INVOICES.flatMap((inv) => (inv.payments ?? []).map((p) => ({ ...p, invoiceId: inv.id, number: inv.number, patientId: inv.patientId })));

const inDay = (iso: string, key: string) => istDayKey(iso) === key;

/** Confirmed collections per day this week (shared data) + manual entries made in this session. */
export function weeklyCollections(session: PaymentEvent[]) {
  const manual = session.filter((p) => p.kind === "payment" && p.local);
  return WEEK_DAYS.map((key) => {
    const confirmed = collected(dayStart(key), dayEnd(key));
    const manualSum = manual.filter((p) => inDay(p.at, key)).reduce((s, p) => s + p.amount, 0);
    const unconfirmed = SHARED.filter((p) => !p.confirmed && inDay(p.at, key));
    return { key, label: dayLabel(key), confirmed, manual: manualSum, unconfirmed };
  });
}

/** Confirmed collections per day over the last `n` days (oldest → newest), for the today tile spark. */
export function dailyCollections(n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(TODAY_KEY, i - (n - 1));
    return { key, value: collected(dayStart(key), dayEnd(key)) };
  });
}

/** Confirmed payments today (for the tile context: count, method and time of the latest). */
export function confirmedOn(key: string) {
  return SHARED.filter((p) => p.confirmed && p.amount > 0 && inDay(p.at, key)).sort((a, b) => newestFirst(a.at, b.at));
}

/** Confirmed money by method, week to date; manual entries reported separately. */
export function methodsThisWeek(session: PaymentEvent[]) {
  const from = dayStart(WEEK_START);
  const to = dayEnd(TODAY_KEY);
  const confirmed = SHARED.filter((p) => p.confirmed && p.amount > 0 && p.at >= from && p.at <= to);
  const manual = session.filter((p) => p.kind === "payment" && p.local && istDayKey(p.at) >= WEEK_START);
  return RECORDABLE_METHODS.map((method) => {
    const mine = confirmed.filter((p) => p.method === method);
    const man = manual.filter((p) => p.method === method);
    return { method, amount: mine.reduce((s, p) => s + p.amount, 0), count: mine.length, manual: man.reduce((s, p) => s + p.amount, 0), manualCount: man.length };
  }).sort((a, b) => b.amount - a.amount || b.manual - a.manual);
}

/** Outstanding balance split by status (bubble chart in the focal card). */
export type OpenBucket = { status: DisplayStatus; label: string; amount: number; count: number };

export function outstandingByStatus(invoices: InvoiceView[]): OpenBucket[] {
  const order: DisplayStatus[] = ["overdue", "failed", "due", "partially-paid"];
  return order
    .map((status) => {
      const mine = invoices.filter((i) => i.display === status && i.balance > 0);
      return { status, label: STATUS_LABEL[status], amount: mine.reduce((s, i) => s + i.balance, 0), count: mine.length };
    })
    .filter((b) => b.count > 0);
}

/** Invoice count per display status, in a fixed reading order (settled → owed → refunded). */
export const STATUS_ORDER: DisplayStatus[] = ["paid", "recorded", "partially-paid", "due", "overdue", "failed", "refunded"];

/**
 * Segment colours for the status bar, in STATUS_ORDER. Semantic (these ARE states): settled =
 * greens, owed = blue → amber → red, unconfirmed = deep red, refunded = neutral grey.
 * Validated with dataviz validate_palette.js (light, adjacent): lightness band, CVD ΔE ≥ 15,
 * normal-vision ΔE ≥ 16.7 — only the deliberate neutral grey sits below the chroma floor.
 * Two steps are under 3:1 on white, so the legend always prints every name and count.
 */
export const STATUS_FILL: Record<DisplayStatus, string> = {
  paid: "#17834a",
  recorded: "#62bd8c",
  "partially-paid": "#2a78d6",
  due: "#eda100",
  overdue: "#e34948",
  failed: "#9e2219",
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

export const methodLabel = (m: PayMethod) => m;
