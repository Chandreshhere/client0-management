import { TODAY, formatDate, formatTime } from "@/lib/format";

/**
 * IST time maths for the administration pages, from the fixed demo clock
 * (TODAY = Fri 13 Nov 2026 09:40 IST). Independent of the viewer's timezone, so the server render
 * and client hydration always agree.
 */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** The demo "now" as an IST-offset ISO string, matching the fixtures' format ("…T09:40:00+05:30"). */
export const NOW_ISO = `${new Date(TODAY.getTime() + 330 * 60_000).toISOString().slice(0, 19)}+05:30`;

/** Sort comparators by instant (never compare ISO strings with different offsets as text). */
export const newestFirst = (a: string, b: string) => Date.parse(b) - Date.parse(a);
export const oldestFirst = (a: string, b: string) => Date.parse(a) - Date.parse(b);

/** YYYY-MM-DD of an instant (or a date-only string) in IST. */
export const istDayKey = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10));

export const TODAY_KEY = istDayKey(NOW_ISO); // "2026-11-13"

/** Minutes after midnight in IST. */
export function istMinutes(iso: string) {
  const t = new Date(iso).getTime() + IST_OFFSET_MS;
  return Math.floor((((t % DAY_MS) + DAY_MS) % DAY_MS) / 60_000);
}

export const NOW_MIN = istMinutes(NOW_ISO); // 580 → 09:40

/** Whole calendar days from a date to today (positive = in the past). */
export const daysAgo = (iso: string) => Math.round((Date.parse(TODAY_KEY) - Date.parse(istDayKey(iso))) / DAY_MS);

/** Whole calendar days from today to a date (positive = in the future). */
export const daysUntil = (iso: string) => -daysAgo(iso);

/** "Today, 10:05" · "Yesterday, 16:30" · "6 Nov, 12:00" */
export function whenLabel(iso: string) {
  const d = daysAgo(iso);
  if (d === 0) return `Today, ${formatTime(iso)}`;
  if (d === 1) return `Yesterday, ${formatTime(iso)}`;
  return `${shortDate(iso)}, ${formatTime(iso)}`;
}

export const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

/** Mid-sentence form: "today 10:05" · "yesterday 16:30" · "6 Nov 12:00" */
export function whenInline(iso: string) {
  const d = daysAgo(iso);
  const day = d === 0 ? "today" : d === 1 ? "yesterday" : shortDate(iso);
  return `${day} ${formatTime(iso)}`;
}

/** Adds whole days to a YYYY-MM-DD key. */
export function addDays(key: string, days: number) {
  return new Date(Date.parse(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 580 → "09:40" */
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

/** "09:40" → 580 (NaN when malformed). */
export function toMinutes(s: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** "in 17 days" · "today" · "3 days ago" relative to the demo clock. */
export function daysPhrase(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
