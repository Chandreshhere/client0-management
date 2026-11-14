import type { BranchId, Discipline } from "@/data/types";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { CARE_PLAN } from "@/data/featured";
import { CLINIC, staffById } from "@/data/staff";
import { PACKAGES } from "@/data/programs";
import { formatTime } from "@/lib/format";
import { NOW_MS, TODAY_KEY, addDays, istIso, istMinutes, weekdayOf } from "../time";

/**
 * Kabir's appointments as the patient sees them. Today's two visits come straight from the clinic
 * diary (TODAY_APPOINTMENTS); the rest is a curated, coherent programme schedule that only uses
 * released information (unreleased bookings such as the external stress test are not shown).
 */

export const PATIENT_ID = "p-kabir";

export type PortalApptStatus = "booked" | "requested" | "attended" | "completed" | "cancelled";
export type PortalApptKind = "review" | "follow-up" | "class" | "session" | "consultation";

export interface PortalAppt {
  id: string;
  start: string;
  durationMin: number;
  service: string;
  discipline: Discipline;
  kind: PortalApptKind;
  staffId: string;
  alsoWith?: string[];
  room: string;
  branch: BranchId;
  status: PortalApptStatus;
  /** what it costs the patient, in plain words */
  cost: string;
  note?: string;
  /** a request the patient already made that the clinic hasn't answered */
  pending?: { label: string; at: string; reply: string };
  /** past visits: what came out of it */
  outcome?: { label: string; href?: string };
  formsComplete?: boolean;
  /** created in this browser session (booking requests) */
  local?: boolean;
  requestNote?: string;
}

const pkg = PACKAGES.find((p) => p.patientId === PATIENT_ID)!;
export const SESSIONS_LEFT = pkg.total - pkg.used;

function fromDiary(id: string, cost: string): PortalAppt {
  const a = TODAY_APPOINTMENTS.find((x) => x.id === id)!;
  return {
    id: a.id,
    start: a.start,
    durationMin: a.durationMin,
    service: a.service,
    discipline: a.discipline,
    kind: a.kind === "walk-in" ? "consultation" : a.kind,
    staffId: a.staffId,
    room: a.room,
    branch: "indiranagar",
    status: "booked",
    cost,
    formsComplete: a.formsComplete,
  };
}

const sunriseClass = (day: string, n?: number): PortalAppt => ({
  id: `pa-class-${day.slice(8)}`,
  start: istIso(day, "07:30"),
  durationMin: 60,
  service: "Sunrise Cardiac Rehab Flow",
  discipline: "movement",
  kind: "class",
  staffId: "s-kavya",
  room: "Yoga Hall",
  branch: "indiranagar",
  status: "booked",
  cost: n ? `Package session ${n} of ${pkg.total}` : "Uses 1 package session",
});

export const UPCOMING: PortalAppt[] = [
  fromDiary("a-1100", "Included in your programme"),
  fromDiary("a-1130", "Included in your programme"),
  {
    id: "pa-yoga-14",
    start: istIso("2026-11-14", "08:00"),
    durationMin: 45,
    service: "Yoga therapy · 1:1 (make-up)",
    discipline: "movement",
    kind: "session",
    staffId: "s-kavya",
    room: "Yoga Hall",
    branch: "indiranagar",
    status: "booked",
    cost: "Uses 1 package session",
    note: "Make-up for the class you cancelled on 4 Nov",
    pending: { label: "You asked to swap this to Sunday", at: "2026-11-13T07:55:00+05:30", reply: "Kavya Nair replies within 1 working day" },
  },
  sunriseClass("2026-11-16"),
  sunriseClass("2026-11-18"),
  sunriseClass("2026-11-20"),
  {
    id: "pa-review-04dec",
    start: CARE_PLAN.nextReview.at,
    durationMin: 45,
    service: CARE_PLAN.nextReview.label,
    discipline: "medical",
    kind: "review",
    staffId: CARE_PLAN.nextReview.with,
    alsoWith: ["s-meera", "s-kavya"],
    room: "Consult 1",
    branch: "indiranagar",
    status: "booked",
    cost: "Included in your programme",
    note: "Week 12 — your doctor, nutritionist and yoga instructor review the plan with you",
  },
];

/** Requests already with the clinic (released on the record, time not yet confirmed). */
export const REQUESTED: PortalAppt[] = [
  {
    id: "pa-asthma-15dec",
    start: istIso("2026-12-15", "10:30"),
    durationMin: 30,
    service: "Asthma review",
    discipline: "medical",
    kind: "review",
    staffId: "s-sana",
    room: "Consult A",
    branch: "hsr",
    status: "requested",
    cost: "₹900 · payable at checkout",
    note: "Winter action plan. Requested by Dr. Sana Qureshi's team — the time is a preference until the clinic confirms.",
  },
];

export const PAST: PortalAppt[] = [
  { ...sunriseClass("2026-11-13", 17), id: "pa-class-13-done", status: "attended", outcome: { label: "Marked present by Kavya Nair" } },
  { ...sunriseClass("2026-11-11", 16), id: "pa-class-11-done", status: "attended", outcome: { label: "Marked present by Kavya Nair" } },
  { ...sunriseClass("2026-11-09", 15), id: "pa-class-09-done", status: "attended", outcome: { label: "Marked present by Kavya Nair" } },
  {
    id: "pa-review-06nov",
    start: "2026-11-06T10:30:00+05:30",
    durationMin: 30,
    service: "Heart Health review · week 8",
    discipline: "medical",
    kind: "review",
    staffId: "s-ananya",
    room: "Consult 1",
    branch: "indiranagar",
    status: "completed",
    cost: "Included in your programme",
    outcome: { label: "Visit summary released", href: "/portal/records" },
  },
  { ...sunriseClass("2026-11-04"), id: "pa-class-04-cancelled", status: "cancelled", cost: "No charge · cancelled with notice", outcome: { label: "Cancelled by you · make-up booked for Sat 14 Nov" } },
  {
    id: "pa-nutrition-30oct",
    start: "2026-10-30T11:00:00+05:30",
    durationMin: 30,
    service: "Nutrition review",
    discipline: "nutrition",
    kind: "follow-up",
    staffId: "s-meera",
    room: "Nutrition Studio",
    branch: "indiranagar",
    status: "completed",
    cost: "Included in your programme",
    outcome: { label: "Led to meal plan v4 (12 Nov)", href: "/portal/plan" },
  },
  // Programme start, as documented in the released record and the referrals (intake 8 Sep,
  // nutrition referral completed 12 Sep, movement referral completed 15 Sep).
  {
    ...sunriseClass("2026-09-15", 1),
    id: "pa-class-15sep",
    status: "attended",
    outcome: { label: "First class · movement referral completed" },
  },
  {
    id: "pa-nutrition-12sep",
    start: "2026-09-12T11:00:00+05:30",
    durationMin: 45,
    service: "Nutrition assessment",
    discipline: "nutrition",
    kind: "consultation",
    staffId: "s-meera",
    room: "Nutrition Studio",
    branch: "indiranagar",
    status: "completed",
    cost: "Included in your programme",
    outcome: { label: "Led to meal plan v1 (12 Sep)", href: "/portal/plan" },
  },
  {
    id: "pa-intake-08sep",
    start: "2026-09-08T09:30:00+05:30",
    durationMin: 45,
    service: "Heart Health · programme intake",
    discipline: "medical",
    kind: "review",
    staffId: "s-ananya",
    room: "Consult 1",
    branch: "indiranagar",
    status: "completed",
    cost: "Included in your programme",
    outcome: { label: "Baseline vitals released · referred to nutrition and yoga", href: "/portal/records" },
  },
];

// ---------------------------------------------------------------------------------------------
// Getting there
// ---------------------------------------------------------------------------------------------

export const BRANCH_INFO: Record<BranchId, { name: string; address: string; travel: string; parking: string; phone: string }> = {
  indiranagar: {
    name: `${CLINIC.name} · Indiranagar`,
    address: "2nd floor, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
    travel: "Indiranagar metro (Purple line) · about 8 minutes on foot",
    parking: "Basement parking, free for 2 hours",
    phone: "+91 80 •••• 2210",
  },
  hsr: {
    name: `${CLINIC.name} · HSR Layout`,
    address: "27th Main Road, Sector 2, HSR Layout, Bengaluru 560102",
    travel: "Bus stop at Agara Lake · about 5 minutes on foot",
    parking: "Street parking only",
    phone: "+91 80 •••• 4471",
  },
};

export const ROOM_INFO: Record<string, string> = {
  "Consult 1": "Ground floor · first door on the left after reception",
  "Consult 3": "Ground floor · end of the corridor",
  "Consult A": "Ground floor · opposite the waiting area",
  "Nutrition Studio": "First floor · lift and stairs beside reception",
  "Yoga Hall": "Second floor · mats and blocks provided, bring water",
};

/** Check-in opens 15 minutes before the start time. */
export const checkInFrom = (a: PortalAppt) => formatTime(new Date(Date.parse(a.start) - 15 * 60_000).toISOString());

// ---------------------------------------------------------------------------------------------
// How to prepare
// ---------------------------------------------------------------------------------------------

export type PrepItem = { id: string; label: string; detail?: string; done?: string };

export function prepareFor(a: PortalAppt): PrepItem[] {
  if (a.id === "a-1100") {
    return [
      { id: "form", label: "Pre-visit form", detail: "Filled in here in the app on 12 Nov — nothing more to do", done: "Done" },
      { id: "bp", label: "Bring your home BP readings", detail: "The last 7 days — they stay labelled self-reported" },
      { id: "meds", label: "Bring the medicines you take now", detail: "Aspirin, atorvastatin, metoprolol and your inhaler" },
      { id: "symptoms", label: "Note any palpitations or chest discomfort since 6 Nov" },
      { id: "questions", label: "Write down your questions", detail: "Your 11 Nov cholesterol test will be discussed" },
    ];
  }
  if (a.discipline === "nutrition") {
    return [
      { id: "logs", label: "Your food logs are already shared", detail: "2 entries this week · still awaiting review", done: "Shared" },
      { id: "office", label: "Note how dinner by 19:30 went on office days" },
      { id: "swaps", label: "List any foods you'd like to swap" },
    ];
  }
  if (a.discipline === "movement") {
    return [
      { id: "clothes", label: "Wear comfortable clothes", detail: "Mats and blocks are provided" },
      { id: "water", label: "Bring water and your inhaler" },
      { id: "pulse", label: "Check your resting pulse before you leave", detail: "Tell Kavya if it's above 100" },
    ];
  }
  return [
    { id: "meds", label: "Bring the medicines you take now" },
    { id: "questions", label: "Write down your questions" },
  ];
}

// ---------------------------------------------------------------------------------------------
// Booking: services, practitioners and open slots (deterministic for the demo)
// ---------------------------------------------------------------------------------------------

export interface BookService {
  id: string;
  name: string;
  discipline: Discipline;
  durationMin: number;
  staff: string[];
  cost: string;
  description: string;
}

export const BOOK_SERVICES: BookService[] = [
  { id: "heart-review", name: "Heart Health review", discipline: "medical", durationMin: 30, staff: ["s-ananya"], cost: "Included in your programme", description: "Check in with your cardiologist about symptoms, medicines and results." },
  { id: "consult", name: "General consultation", discipline: "medical", durationMin: 20, staff: ["s-vikram", "s-sana"], cost: "₹900", description: "For a new concern that isn't part of your heart programme." },
  { id: "nutrition", name: "Nutrition follow-up", discipline: "nutrition", durationMin: 30, staff: ["s-meera", "s-rohan"], cost: "₹800", description: "Go through your meal plan, food logs and swaps." },
  { id: "yoga", name: "Yoga therapy · 1:1", discipline: "movement", durationMin: 45, staff: ["s-kavya", "s-arjun"], cost: `Uses 1 package session · ${SESSIONS_LEFT} left`, description: "A one-to-one session within your approved precautions." },
];

export const serviceById = (id: string) => BOOK_SERVICES.find((s) => s.id === id);

/** Next six open days after today (the clinic is closed on Sundays). */
export const BOOKING_DAYS: string[] = (() => {
  const out: string[] = [];
  let d = TODAY_KEY;
  while (out.length < 6) {
    d = addDays(d, 1);
    if (weekdayOf(d) !== 0) out.push(d);
  }
  return out;
})();

function parseHours(h: string): [number, number] | null {
  const m = h.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** FNV-1a — stable pseudo-availability so the same slots show on every render. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The patient's own bookings block overlapping slots (they can't be in two places). */
const BUSY = UPCOMING.map((a) => ({ day: a.start.slice(0, 10), from: istMinutes(a.start), to: istMinutes(a.start) + a.durationMin }));

export function slotsFor(staffId: string, day: string, durationMin: number): string[] {
  const s = staffById(staffId);
  if (!s || s.status === "on-leave") return [];
  const hours = parseHours(s.workingHours);
  if (!hours) return [];
  const [open, rawClose] = hours;
  const close = weekdayOf(day) === 6 ? Math.min(rawClose, 13 * 60) : rawClose; // Saturdays: mornings only
  const step = durationMin >= 45 ? 60 : 30;
  const out: string[] = [];
  for (let t = open; t + durationMin <= close; t += step) {
    if (t < 14 * 60 && t + durationMin > 13 * 60) continue; // lunch 13:00–14:00
    if (BUSY.some((b) => b.day === day && t < b.to && t + durationMin > b.from)) continue;
    if (hash(`${staffId}|${day}|${t}`) % 100 < 45) out.push(hhmm(t));
  }
  return out;
}

export function nextFreeSlot(staffId: string, durationMin: number): string | null {
  for (const d of BOOKING_DAYS) {
    const s = slotsFor(staffId, d, durationMin);
    if (s.length) return istIso(d, s[0]);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Policy + calendar export
// ---------------------------------------------------------------------------------------------

export const POLICY = {
  free: "Free to cancel or move up to 24 hours before.",
  late: "Within 24 hours, a consultation may be charged ₹300 and a programme session counts as used. If you're unwell, tell us and we'll waive it.",
};

export const isWithin24h = (a: PortalAppt) => Date.parse(a.start) - NOW_MS < 24 * 3_600_000;

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 calendar file for one appointment (generated in the browser — nothing is sent). */
export function buildIcs(a: PortalAppt) {
  const staff = staffById(a.staffId);
  const branch = BRANCH_INFO[a.branch];
  const end = new Date(Date.parse(a.start) + a.durationMin * 60_000).toISOString();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carelane demo//Patient portal//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${a.id}@carelane.example`,
    `DTSTAMP:${icsStamp(new Date(NOW_MS).toISOString())}`,
    `DTSTART:${icsStamp(a.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`${a.service} · ${staff?.name ?? "Prana clinic"}`)}`,
    `LOCATION:${icsText(`${a.room}, ${branch.name}, ${branch.address}`)}`,
    `DESCRIPTION:${icsText(`Check in at reception from ${checkInFrom(a)}. ${ROOM_INFO[a.room] ?? ""}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
