import { TODAY, formatDate, formatTime } from "@/lib/format";

/**
 * Demo-clock helpers for the patient portal. "Now" is the fixed demo time (Fri 13 Nov 2026,
 * 09:40 IST), so every label renders identically on the server and in the browser.
 */

export const NOW_MS = TODAY.getTime();
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Calendar day ("YYYY-MM-DD") in IST for an ISO timestamp. */
export const istDay = (iso: string) => new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);
export const TODAY_KEY = istDay(TODAY.toISOString());

/** IST timestamp for a day + "HH:MM". */
export const istIso = (day: string, hhmm: string) => `${day}T${hhmm}:00+05:30`;

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD" day. */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** Minutes after midnight (IST) for an ISO timestamp. */
export function istMinutes(iso: string) {
  const d = new Date(Date.parse(iso) + IST_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** en-IN abbreviates September as "Sept"; every other month is three letters, so use "Sep". */
export const threeLetterMonths = (s: string) => s.replace(/\bSept\b/g, "Sep");

export const shortDate = (iso: string) => threeLetterMonths(formatDate(iso, { day: "numeric", month: "short" }));
export const longDate = (iso: string) => threeLetterMonths(formatDate(iso, { day: "numeric", month: "short", year: "numeric" }));
export const weekdayShort = (iso: string) => formatDate(iso, { weekday: "short" });
export const monthShort = (iso: string) => threeLetterMonths(formatDate(iso, { month: "short" }));
/** "Sep" for a "YYYY-MM" month key. */
export const monthKeyShort = (key: string) => monthShort(`${key}-15T12:00:00+05:30`);
export const dayOfMonth = (iso: string) => formatDate(iso, { day: "numeric" });

export const hoursUntil = (iso: string) => (Date.parse(iso) - NOW_MS) / 3_600_000;

/** "Today" · "Tomorrow" · "Yesterday" · "Mon 16 Nov". */
export function dayLabel(iso: string) {
  const diff = Math.round((Date.parse(`${istDay(iso)}T00:00:00Z`) - Date.parse(`${TODAY_KEY}T00:00:00Z`)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${weekdayShort(iso)} ${shortDate(iso)}`;
}

/** "Today · 11:00" style label used across appointment rows. */
export const whenLabel = (iso: string) => `${dayLabel(iso)} · ${formatTime(iso)}`;

/** Plain-language countdown: "in 1 h 20 min", "tomorrow", "in 3 weeks", "2 days ago". */
export function untilLabel(iso: string) {
  const mins = Math.round((Date.parse(iso) - NOW_MS) / 60_000);
  const abs = Math.abs(mins);
  const past = mins < 0;
  const wrap = (s: string) => (past ? `${s} ago` : `in ${s}`);
  if (abs < 1) return "now";
  if (abs < 60) return wrap(`${abs} min`);
  if (abs < 24 * 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return wrap(m ? `${h} h ${m} min` : `${h} h`);
  }
  const days = Math.round((Date.parse(`${istDay(iso)}T00:00:00Z`) - Date.parse(`${TODAY_KEY}T00:00:00Z`)) / DAY_MS);
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const n = Math.abs(days);
  if (n < 14) return wrap(`${n} days`);
  return wrap(`${Math.round(n / 7)} weeks`);
}

/** Days from the demo "today" to a date (negative = past). */
export const daysFromToday = (iso: string) => Math.round((Date.parse(`${istDay(iso)}T00:00:00Z`) - Date.parse(`${TODAY_KEY}T00:00:00Z`)) / DAY_MS);

/** Current demo time as "HH:MM" and a fresh ISO timestamp for records created "now". */
export const NOW_LABEL = formatTime(TODAY.toISOString());
export const nowIso = () => TODAY.toISOString();
