import type { NutritionPlanSummary, YogaClass } from "./types";

/** Synthetic yoga classes/sessions and nutrition plan summaries. */

const D = (day: number, hhmm: string) => `2026-11-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const CLASSES: YogaClass[] = [
  {
    id: "c-sunrise-13", title: "Sunrise Cardiac Rehab Flow", kind: "group", instructorId: "s-kavya", room: "Yoga Hall", start: D(13, "07:30"), durationMin: 60, capacity: 8,
    focus: "Low-intensity flow · keep HR below 110 bpm · no inversions",
    enrolled: [
      { patientId: "p-kabir", attendance: "present", precaution: "HR ceiling 110 bpm; avoid breath retention", clearance: "current" },
      { patientId: "p-vivek", attendance: "present", precaution: "BP check before class if headache", clearance: "current" },
      { patientId: "p-arun", attendance: "absent", precaution: "Seated variations only until review", clearance: "current" },
      { patientId: "p-karthik", attendance: "late", clearance: "current" },
      { patientId: "p-gaurav", attendance: "present", precaution: "No supine breath-holds", clearance: "current" },
    ],
    waitlist: [],
  },
  {
    id: "c-breath-13", title: "Breath & Balance", kind: "group", instructorId: "s-lakshmi", room: "Yoga Hall", start: D(13, "12:00"), durationMin: 45, capacity: 8,
    focus: "Diaphragmatic breathing, balance and gentle mobility",
    enrolled: [
      { patientId: "p-aditi", attendance: "pending", clearance: "current" },
      { patientId: "p-neelam", attendance: "pending", clearance: "current" },
      { patientId: "p-zoya", attendance: "pending", precaution: "Stop if aura symptoms begin", clearance: "current" },
      { patientId: "p-rekha", attendance: "pending", precaution: "SpO₂ floor changed to 92% — needs instructor review", clearance: "changed" },
      { patientId: "p-mohit", attendance: "pending", precaution: "Inhaler within reach", clearance: "expired" },
      { patientId: "p-sunita", attendance: "pending", clearance: "current" },
      { patientId: "p-meenakshi", attendance: "pending", precaution: "Wrist-friendly variations", clearance: "current" },
      { patientId: "p-ananya-s", attendance: "pending", clearance: "current" },
    ],
    waitlist: ["p-nikhil"],
  },
  {
    id: "c-rekha-13", title: "Breathwork · 1:1", kind: "individual", instructorId: "s-lakshmi", room: "Therapy Room", start: D(13, "17:00"), durationMin: 45, capacity: 1,
    focus: "Pursed-lip breathing, paced walking prep",
    enrolled: [{ patientId: "p-rekha", attendance: "pending", precaution: "SpO₂ floor 92% (changed 13 Nov by Dr. Vikram Iyer, covering)", clearance: "changed" }],
    waitlist: [],
  },
  {
    id: "c-back-13", title: "Evening Back Care", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(13, "17:30"), durationMin: 60, capacity: 12,
    focus: "Core stability, hip mobility, neutral spine",
    enrolled: [
      { patientId: "p-fatima", attendance: "pending", precaution: "Avoid loaded flexion", clearance: "current" },
      { patientId: "p-meenakshi", attendance: "pending", precaution: "Wrist-friendly variations", clearance: "current" },
      { patientId: "p-lakshmi-n", attendance: "pending", precaution: "Chair-supported standing poses", clearance: "current" },
      { patientId: "p-deepak", attendance: "cancelled", clearance: "current" },
    ],
    waitlist: [],
  },
  {
    id: "c-prenatal-13", title: "Prenatal yoga · 1:1", kind: "individual", instructorId: "s-lakshmi", room: "Therapy Room", start: D(13, "08:00"), durationMin: 45, capacity: 1,
    focus: "Pelvic-floor awareness, side-lying relaxation",
    enrolled: [{ patientId: "p-ishita", attendance: "present", precaution: "No supine poses after 20 weeks", clearance: "current" }],
    waitlist: [],
  },
  {
    id: "c-pcos-14", title: "Strength & Flow", kind: "group", instructorId: "s-lakshmi", room: "Yoga Hall", start: D(14, "09:00"), durationMin: 60, capacity: 10,
    focus: "Strength-biased flow, 2× weekly programme",
    enrolled: [
      { patientId: "p-aditi", attendance: "pending", clearance: "current" },
      { patientId: "p-neelam", attendance: "pending", clearance: "current" },
      { patientId: "p-tanvi", attendance: "pending", precaution: "Hydrate; stop if light-headed", clearance: "current" },
    ],
    waitlist: [],
  },
  {
    id: "c-mobility-14", title: "Gentle Mobility 60+", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(14, "10:00"), durationMin: 45, capacity: 10,
    focus: "Fall prevention, chair-supported balance",
    enrolled: [
      { patientId: "p-lakshmi-n", attendance: "pending", precaution: "Chair-supported standing poses", clearance: "current" },
      { patientId: "p-rekha", attendance: "pending", precaution: "SpO₂ floor 92%", clearance: "changed" },
      { patientId: "p-sunita", attendance: "pending", clearance: "current" },
    ],
    waitlist: [],
  },
  {
    id: "c-sunrise-09", title: "Sunrise Cardiac Rehab Flow", kind: "group", instructorId: "s-kavya", room: "Yoga Hall", start: D(9, "07:30"), durationMin: 60, capacity: 8,
    focus: "Low-intensity flow · keep HR below 110 bpm · no inversions",
    enrolled: [
      { patientId: "p-kabir", attendance: "present", clearance: "current" },
      { patientId: "p-vivek", attendance: "present", clearance: "current" },
      { patientId: "p-arun", attendance: "absent", clearance: "current" },
      { patientId: "p-gaurav", attendance: "present", clearance: "current" },
    ],
    waitlist: [],
  },
];

export const ATTENDANCE_LABEL = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  pending: "Not marked",
} as const;

/** Session package balances (visible to permitted roles only). */
export const PACKAGES = [
  { patientId: "p-kabir", name: "Heart Health · 24 yoga sessions", used: 17, total: 24, expires: "2026-12-20" },
  { patientId: "p-aditi", name: "PCOS Care · 32 sessions", used: 9, total: 32, expires: "2027-02-28" },
  { patientId: "p-arun", name: "Heart Health · 24 yoga sessions", used: 6, total: 24, expires: "2026-12-31" },
  { patientId: "p-fatima", name: "Back Care · 16 sessions", used: 11, total: 16, expires: "2026-12-05" },
  { patientId: "p-rekha", name: "Breath & Balance · 12 sessions", used: 10, total: 12, expires: "2026-11-30" },
];

export const NUTRITION_PLANS: NutritionPlanSummary[] = [
  { id: "np-kabir", patientId: "p-kabir", title: "Heart-healthy vegetarian · South Indian", version: 4, status: "published", authorId: "s-meera", updatedAt: "2026-11-12T17:05:00+05:30", preference: "Vegetarian", calories: 2100, adherenceNote: "Dinner timing slipping on work-from-office days", nextReview: "2026-11-13T11:30:00+05:30" },
  { id: "np-aditi", patientId: "p-aditi", title: "PCOS · low-GI, high-protein", version: 3, status: "in-review", authorId: "s-meera", updatedAt: "2026-11-12T12:40:00+05:30", preference: "Eggetarian", calories: 1700, adherenceNote: "Breakfast skipped 3/7 days (self-reported)", nextReview: "2026-11-20T12:00:00+05:30" },
  { id: "np-arun", patientId: "p-arun", title: "Post-MI · DASH-style, low sodium", version: 1, status: "draft", authorId: "s-meera", updatedAt: "2026-11-12T16:00:00+05:30", preference: "Non-vegetarian", calories: 1900, adherenceNote: "Awaiting referral acceptance", nextReview: "2026-11-18T12:00:00+05:30" },
  { id: "np-rajesh", patientId: "p-rajesh", title: "Diabetes reset · Kerala meals", version: 2, status: "published", authorId: "s-rohan", updatedAt: "2026-10-22T10:00:00+05:30", preference: "Non-vegetarian", calories: 1800, adherenceNote: "No food logs for 3 weeks", nextReview: "2026-11-13T09:00:00+05:30" },
  { id: "np-sameer", patientId: "p-sameer", title: "NAFLD · Mediterranean-Indian", version: 2, status: "published", authorId: "s-rohan", updatedAt: "2026-11-01T19:20:00+05:30", preference: "Vegetarian", calories: 1900, adherenceNote: "Good adherence; weekend snacking", nextReview: "2026-11-26T19:00:00+05:30" },
  { id: "np-tanvi", patientId: "p-tanvi", title: "Iron-rich vegetarian (Jain)", version: 1, status: "draft", authorId: "s-meera", updatedAt: "2026-11-12T11:30:00+05:30", preference: "Jain", calories: 1800, adherenceNote: "Assessment today 16:30", nextReview: "2026-11-13T16:30:00+05:30" },
  { id: "np-ishita", patientId: "p-ishita", title: "Prenatal · 2nd trimester, iron focus", version: 2, status: "published", authorId: "s-meera", updatedAt: "2026-11-09T11:00:00+05:30", preference: "Vegetarian", calories: 2200, adherenceNote: "Nausea improved; iron tablets taken 6/7", nextReview: "2026-11-23T10:00:00+05:30" },
  { id: "np-nikhil", patientId: "p-nikhil", title: "Low-FODMAP trial · phase 2", version: 3, status: "superseded", authorId: "s-rohan", updatedAt: "2026-10-18T13:00:00+05:30", preference: "Vegetarian", calories: 2000, adherenceNote: "Reintroduction phase started", nextReview: "2026-11-22T13:00:00+05:30" },
];

export const PLAN_STATUS_LABEL = {
  draft: "Draft",
  "in-review": "In review",
  published: "Published",
  superseded: "Superseded",
} as const;
