import { CLASSES } from "@/data/programs";
import { staffById } from "@/data/staff";
import { DIARY_TO, LEAVE, NOW_MIN, PRACTITIONERS, TODAY_KEY, serviceById, type TimePreference } from "./data";
import { addDays, dateOf, freeSlots, isSunday, matchesPreference, minOf, onLeave, type Occupant } from "./engine";
import type { WaitEntry } from "./store";

/** Days the synthetic diary can offer from "now" (today → end of the demo diary). */
export function offerDays() {
  const out: string[] = [];
  for (let d = TODAY_KEY; d <= DIARY_TO; d = addDays(d, 1)) if (!isSunday(d)) out.push(d);
  return out;
}

/** A request's acceptable time windows (one preference from the fixtures, or several chosen when added). */
export const prefersOf = (e: WaitEntry): TimePreference[] => (e.prefer ? [e.prefer] : e.prefers ?? []);

/**
 * What the diary can offer each waitlist request before the end of the demo diary — computed the
 * same way the "Offer a slot" dialog lists them (requested practitioner, their working hours,
 * practitioner and room both free, preferred times matched), so the numbers always agree.
 */
export type WaitMatch =
  | { kind: "slots"; count: number; next: { date: string; start: number; staffId: string } | null }
  | { kind: "leave"; names: string; until: string; anyCount: number }
  | { kind: "class"; title: string; free: number; capacity: number; others: number }
  | { kind: "closed" };

const groupClassesAhead = () =>
  CLASSES.filter((c) => c.kind === "group" && dateOf(c.start) >= TODAY_KEY && dateOf(c.start) <= DIARY_TO && !(dateOf(c.start) === TODAY_KEY && minOf(c.start) < NOW_MIN));

export function waitMatch(entry: WaitEntry, occupants: Occupant[], classSeats: Record<string, number>): WaitMatch {
  if (entry.status === "booked") return { kind: "closed" };

  if (entry.classId) {
    const taken = (id: string) => {
      const c = CLASSES.find((x) => x.id === id);
      return c ? c.enrolled.filter((e) => e.attendance !== "cancelled").length + (classSeats[id] ?? 0) : 0;
    };
    const cls = CLASSES.find((c) => c.id === entry.classId);
    const others = groupClassesAhead().filter((c) => c.id !== entry.classId && taken(c.id) < c.capacity).length;
    return { kind: "class", title: cls?.title ?? "Class", free: cls ? Math.max(0, cls.capacity - taken(cls.id)) : 0, capacity: cls?.capacity ?? 0, others };
  }

  const svc = serviceById(entry.serviceId);
  const duration = svc?.durationMin ?? 30;
  const prefers = prefersOf(entry);
  const days = offerDays();
  const count = (staffIds: string[]) => {
    let n = 0;
    let next: { date: string; start: number; staffId: string } | null = null;
    for (const d of days) {
      for (const id of staffIds) {
        const s = staffById(id);
        if (!s || onLeave(id, d)) continue;
        const slots = freeSlots({ staffId: id, room: s.room ?? "Consult 1", date: d, duration }, occupants, 30).filter((t) => !prefers.length || prefers.some((p) => matchesPreference(d, t, p)));
        n += slots.length;
        if (slots.length && (!next || d < next.date || (d === next.date && slots[0] < next.start))) next = { date: d, start: slots[0], staffId: id };
      }
    }
    return { n, next };
  };

  const requested = entry.staffIds.filter((id) => staffById(id));
  const away = requested.length > 0 && requested.every((id) => days.every((d) => onLeave(id, d)));
  if (away) {
    const any = PRACTITIONERS.filter((p) => p.discipline === entry.discipline && (!svc || svc.staffIds.includes(p.id) || p.discipline === svc.discipline)).map((p) => p.id);
    const names = requested.map((id) => staffById(id)?.name ?? "").join(", ");
    const until = requested.map((id) => LEAVE[id]?.label.replace(/^On leave until /, "") ?? "").filter(Boolean)[0] ?? "";
    return { kind: "leave", names, until, anyCount: count(any).n };
  }
  const { n, next } = count(requested.length ? requested : PRACTITIONERS.filter((p) => p.discipline === entry.discipline).map((p) => p.id));
  return { kind: "slots", count: n, next };
}

export const offerable = (m: WaitMatch) => (m.kind === "slots" && m.count > 0) || (m.kind === "class" && m.free > 0);

/**
 * The request as a role may read it: practitioners see the desk's free text; Reception and Admin
 * see the service it maps to (or the class), never a condition typed into the request.
 */
export const wantText = (w: WaitEntry, clinical: boolean) => {
  if (clinical) return w.want;
  const cls = w.classId ? CLASSES.find((c) => c.id === w.classId) : undefined;
  if (cls) return `${cls.title} (class full)`;
  return serviceById(w.serviceId)?.label ?? w.want;
};
