import { TODAY, formatDate, formatTime } from "@/lib/format";

/**
 * Demo-clock helpers shared by the care-coordination pages. "Now" is the fixed demo clock
 * (Fri 13 Nov 2026, 09:40 IST) so server and client always agree; anything created during the
 * session is stamped with it too.
 */
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** IST calendar day as "YYYY-MM-DD". */
export const dayKey = (d: string | Date) => keyFmt.format(typeof d === "string" ? new Date(d) : d);

export const TODAY_KEY = dayKey(TODAY);

/** ISO timestamp for an IST day + "HH:MM". */
export const isoAt = (key: string, hhmm: string) => `${key}T${hhmm}:00+05:30`;

/** "Now" in the same +05:30 format as the fixtures (so stored values read consistently). */
export const NOW_ISO = isoAt(TODAY_KEY, formatTime(TODAY.toISOString()));

/** Chronological comparator for ISO strings — never compare mixed-offset strings as text. */
export const byTime = (a: string, b: string) => Date.parse(a) - Date.parse(b);

export function addDays(key: string, n: number) {
  const d = new Date(isoAt(key, "12:00"));
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

/** Whole IST calendar days from a to b (b later → positive). */
export function dayDiff(aKey: string, bKey: string) {
  return Math.round((new Date(isoAt(bKey, "12:00")).getTime() - new Date(isoAt(aKey, "12:00")).getTime()) / 86_400_000);
}

export const hoursSince = (iso: string) => (TODAY.getTime() - new Date(iso).getTime()) / 3_600_000;

/** "Sat 14 Nov" */
export const shortDay = (iso: string) => formatDate(iso, { weekday: "short", day: "numeric", month: "short" });

/** "Today" · "Yesterday" · "Tomorrow" · "Wed 11 Nov" (adds the year when it isn't 2026). */
export function dayName(iso: string) {
  const diff = dayDiff(TODAY_KEY, dayKey(iso));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return iso.startsWith("2026") ? shortDay(iso) : formatDate(iso);
}

/** dayName for mid-sentence use: "today" · "tomorrow" · "Wed 11 Nov". */
export function dayPhrase(iso: string) {
  const d = dayName(iso);
  return d === "Today" || d === "Tomorrow" || d === "Yesterday" ? d.toLowerCase() : d;
}

/** "Today, 09:40" · "Wed 11 Nov, 18:05" */
export const stamp = (iso: string) => `${dayName(iso)}, ${formatTime(iso)}`;

/** Next `count` clinic days (Mon–Sat) starting today. */
export function clinicDays(count: number) {
  const out: string[] = [];
  let key = TODAY_KEY;
  while (out.length < count) {
    if (new Date(isoAt(key, "12:00")).getUTCDay() !== 0) out.push(key);
    key = addDays(key, 1);
  }
  return out;
}

/** "HH:MM" slots between two times, inclusive of the start. */
export function timeSlots(from = "07:00", to = "20:00", stepMin = 30) {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += stepMin) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}
