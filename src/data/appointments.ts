import type { Appointment, AppointmentStatus, Discipline } from "./types";
import { PATIENTS } from "./patients";

const PATIENT_VISITS: Record<string, { last: string | null; next: string | null }> = Object.fromEntries(
  PATIENTS.map((p) => [p.id, { last: p.lastVisit?.slice(0, 10) ?? null, next: p.nextAppointment?.slice(0, 10) ?? null }]),
);

/**
 * Synthetic diary. "Today" is Friday 13 Nov 2026, 09:40 IST (see lib/format TODAY).
 * Today's list is hand-written so every state in the queue is represented; the rest of the
 * week is generated from a seeded RNG so it is stable between renders and server/client.
 */

const D = (day: number, hhmm: string) => `2026-11-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const TODAY_APPOINTMENTS: Appointment[] = [
  { id: "a-0730", patientId: "p-vivek", staffId: "s-kavya", service: "Sunrise Cardiac Rehab Flow", discipline: "movement", start: D(13, "07:30"), durationMin: 60, room: "Yoga Hall", status: "completed", arrivedAt: D(13, "07:24"), kind: "class" },
  { id: "a-0800", patientId: "p-ishita", staffId: "s-lakshmi", service: "Prenatal yoga · 1:1", discipline: "movement", start: D(13, "08:00"), durationMin: 45, room: "Therapy Room", status: "completed", arrivedAt: D(13, "08:02"), kind: "session", token: "A-01" },
  { id: "a-0900a", patientId: "p-rajesh", staffId: "s-meera", service: "Nutrition review", discipline: "nutrition", start: D(13, "09:00"), durationMin: 30, room: "Nutrition Studio", status: "no-show", kind: "review" },
  { id: "a-0900b", patientId: "p-zoya", staffId: "s-sana", service: "Neurology follow-up", discipline: "medical", start: D(13, "09:00"), durationMin: 30, room: "Consult 3", status: "cancelled", kind: "follow-up", notes: "Doctor on leave — moved to 1 Dec" },
  { id: "a-0930", patientId: "p-vivek", staffId: "s-ananya", service: "Hypertension follow-up", discipline: "medical", start: D(13, "09:30"), durationMin: 30, room: "Consult 1", status: "in-session", arrivedAt: D(13, "09:18"), kind: "follow-up", token: "A-04", formsComplete: true },
  { id: "a-1000", patientId: "p-lakshmi-n", staffId: "s-meera", service: "Nutrition review · bone health", discipline: "nutrition", start: D(13, "10:00"), durationMin: 30, room: "Nutrition Studio", status: "arrived", arrivedAt: D(13, "09:35"), kind: "review", token: "A-05", formsComplete: true },
  { id: "a-1015", patientId: "p-kunal", staffId: "s-ananya", service: "Walk-in · palpitations", discipline: "medical", start: D(13, "10:15"), durationMin: 20, room: "Consult 1", status: "waiting", arrivedAt: D(13, "09:05"), kind: "walk-in", token: "A-07", formsComplete: false },
  { id: "a-1100", patientId: "p-kabir", staffId: "s-ananya", service: "Heart Health review · week 9", discipline: "medical", start: D(13, "11:00"), durationMin: 30, room: "Consult 1", status: "booked", kind: "review", formsComplete: true },
  { id: "a-1130", patientId: "p-kabir", staffId: "s-meera", service: "Nutrition follow-up", discipline: "nutrition", start: D(13, "11:30"), durationMin: 30, room: "Nutrition Studio", status: "booked", kind: "follow-up", formsComplete: true },
  { id: "a-1200", patientId: "p-aditi", staffId: "s-lakshmi", service: "Breath & Balance", discipline: "movement", start: D(13, "12:00"), durationMin: 45, room: "Yoga Hall", status: "booked", kind: "class" },
  { id: "a-1230", patientId: "p-aditi", staffId: "s-vikram", service: "PCOS review", discipline: "medical", start: D(13, "12:30"), durationMin: 30, room: "Consult 2", status: "booked", kind: "review", formsComplete: true },
  { id: "a-1400", patientId: "p-priya", staffId: "s-vikram", service: "New consultation", discipline: "medical", start: D(13, "14:00"), durationMin: 45, room: "Consult 2", status: "booked", kind: "consultation", formsComplete: false },
  { id: "a-1500", patientId: "p-arun", staffId: "s-ananya", service: "Cardiac rehab review", discipline: "medical", start: D(13, "15:00"), durationMin: 30, room: "Consult 1", status: "booked", kind: "review", formsComplete: true },
  { id: "a-1530", patientId: "p-sunita", staffId: "s-vikram", service: "BP & renal follow-up", discipline: "medical", start: D(13, "15:30"), durationMin: 30, room: "Consult 2", status: "booked", kind: "follow-up", formsComplete: true },
  { id: "a-1630", patientId: "p-tanvi", staffId: "s-meera", service: "Nutrition assessment", discipline: "nutrition", start: D(13, "16:30"), durationMin: 45, room: "Nutrition Studio", status: "booked", kind: "consultation", formsComplete: false, notes: "Guardian consent required (age 19 — confirm)" },
  { id: "a-1700", patientId: "p-rekha", staffId: "s-lakshmi", service: "Breathwork · 1:1", discipline: "movement", start: D(13, "17:00"), durationMin: 45, room: "Therapy Room", status: "booked", kind: "session", formsComplete: true, notes: "Precautions changed — review before session" },
  { id: "a-1730", patientId: "p-fatima", staffId: "s-arjun", service: "Evening Back Care", discipline: "movement", start: D(13, "17:30"), durationMin: 60, room: "Yoga Deck", status: "booked", kind: "class" },
];

// ---------- seeded generator for the rest of the week ----------
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRACTITIONERS: { id: string; discipline: Discipline; room: string; services: string[]; patients: string[] }[] = [
  { id: "s-ananya", discipline: "medical", room: "Consult 1", services: ["Cardiology follow-up", "Heart Health review", "ECG review", "New consultation"], patients: ["p-kabir", "p-vivek", "p-arun", "p-harish", "p-karthik", "p-sunita"] },
  { id: "s-vikram", discipline: "medical", room: "Consult 2", services: ["Diabetes review", "Thyroid follow-up", "PCOS review", "New consultation"], patients: ["p-aditi", "p-rajesh", "p-sameer", "p-ananya-s", "p-nikhil", "p-gaurav", "p-priya"] },
  { id: "s-meera", discipline: "nutrition", room: "Nutrition Studio", services: ["Nutrition review", "Meal-plan check-in", "Nutrition assessment"], patients: ["p-kabir", "p-aditi", "p-arun", "p-ishita", "p-lakshmi-n", "p-ananya-s", "p-meenakshi"] },
  { id: "s-kavya", discipline: "movement", room: "Yoga Hall", services: ["Cardiac rehab yoga · 1:1", "Yoga therapy · 1:1"], patients: ["p-kabir", "p-vivek", "p-arun", "p-karthik", "p-gaurav"] },
  { id: "s-lakshmi", discipline: "movement", room: "Therapy Room", services: ["Breathwork · 1:1", "Prenatal yoga · 1:1"], patients: ["p-ishita", "p-rekha", "p-mohit", "p-neelam", "p-zoya"] },
];

const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
// 45-min movement sessions get hourly slots so a practitioner is never double-booked
const MOVEMENT_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

/** A patient may appear on a past day only up to their last recorded visit, and on a future day only
 *  if they actually have an upcoming appointment (no "not rebooked" patient gets a phantom booking). */
function eligible(patientId: string, day: number) {
  const p = PATIENT_VISITS[patientId];
  if (!p) return false;
  const iso = `2026-11-${String(day).padStart(2, "0")}`;
  if (day < 13) return !!p.last && p.last >= iso;
  return !!p.next && p.next >= iso;
}

function generateWeek(): Appointment[] {
  const rand = mulberry32(20261109);
  const out: Appointment[] = [];
  const days = [9, 10, 11, 12, 14]; // Mon–Thu + Sat (Fri is hand-written above)
  for (const day of days) {
    for (const pr of PRACTITIONERS) {
      const count = 3 + Math.floor(rand() * 4);
      const used = new Set<string>();
      const slots = pr.discipline === "movement" ? MOVEMENT_SLOTS : SLOTS;
      const pool = pr.patients.filter((pid) => eligible(pid, day));
      if (!pool.length) continue;
      for (let i = 0; i < count; i++) {
        let slot = slots[Math.floor(rand() * slots.length)];
        let guard = 0;
        while (used.has(slot) && guard++ < 20) slot = slots[Math.floor(rand() * slots.length)];
        if (used.has(slot)) continue;
        used.add(slot);
        const past = day < 13;
        const r = rand();
        const status: AppointmentStatus = past ? (r < 0.88 ? "completed" : r < 0.94 ? "no-show" : "cancelled") : "booked";
        const service = pr.services[Math.floor(rand() * pr.services.length)];
        out.push({
          id: `a-${day}-${pr.id}-${slot.replace(":", "")}`,
          patientId: pool[Math.floor(rand() * pool.length)],
          staffId: pr.id,
          service,
          discipline: pr.discipline,
          start: D(day, slot),
          durationMin: pr.discipline === "movement" ? 45 : 30,
          room: pr.room,
          status,
          kind: service.includes("New") || service.includes("assessment") ? "consultation" : pr.discipline === "movement" ? "session" : "follow-up",
          formsComplete: true,
        });
      }
    }
  }
  return out;
}

export const WEEK_APPOINTMENTS: Appointment[] = [...generateWeek(), ...TODAY_APPOINTMENTS].sort((a, b) => a.start.localeCompare(b.start));

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Booked",
  arrived: "Arrived",
  waiting: "Waiting",
  "in-session": "In session",
  checkout: "Checkout",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  medical: "Medical",
  nutrition: "Nutrition",
  movement: "Movement",
  operations: "Operations",
};

/** Waitlist entries for the front desk. */
export const WAITLIST = [
  { id: "w1", patientId: "p-neelam", want: "Earlier slot with Dr. Sana Qureshi", preferred: "Mornings, Mon–Wed", addedAt: "2026-11-10T12:00:00+05:30", discipline: "medical" as Discipline, priority: "normal" as const },
  { id: "w2", patientId: "p-nikhil", want: "Breath & Balance (class full)", preferred: "Fri 12:00", addedAt: "2026-11-11T09:20:00+05:30", discipline: "movement" as Discipline, priority: "normal" as const },
  { id: "w3", patientId: "p-harish", want: "Cardiology review — overdue", preferred: "Any weekday after 16:00", addedAt: "2026-11-06T17:45:00+05:30", discipline: "medical" as Discipline, priority: "high" as const },
  { id: "w4", patientId: "p-mohit", want: "Earlier asthma review (Dr. Sana on leave)", preferred: "Weekday evenings", addedAt: "2026-11-12T19:05:00+05:30", discipline: "medical" as Discipline, priority: "low" as const },
  { id: "w5", patientId: "p-zoya", want: "Rebook cancelled neurology follow-up", preferred: "Before 1 Dec if possible", addedAt: "2026-11-13T08:10:00+05:30", discipline: "medical" as Discipline, priority: "high" as const },
];
