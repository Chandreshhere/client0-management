import type { AttendanceState, YogaClass } from "@/data/types";

/**
 * Classes workspace fixtures (synthetic). The shared CLASSES list covers Mon 9 and Fri 13 – Sat 14;
 * these earlier sessions fill Mon–Thu so the week view and the attendance rate are complete.
 */

const D = (day: number, hhmm: string) => `2026-11-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

type E = YogaClass["enrolled"][number];
const p = (patientId: string, attendance: AttendanceState, clearance: E["clearance"] = "current", precaution?: string): E => ({ patientId, attendance, clearance, ...(precaution ? { precaution } : {}) });

export const EARLIER_SESSIONS: YogaClass[] = [
  {
    id: "c-breath-09", title: "Breath & Balance", kind: "group", instructorId: "s-lakshmi", room: "Yoga Hall", start: D(9, "12:00"), durationMin: 45, capacity: 8,
    focus: "Diaphragmatic breathing, balance and gentle mobility",
    enrolled: [p("p-aditi", "present"), p("p-neelam", "present"), p("p-zoya", "late", "current", "Stop if aura symptoms begin"), p("p-rekha", "present", "current", "SpO₂ floor 90% during practice"), p("p-mohit", "absent", "current", "Inhaler within reach"), p("p-sunita", "present"), p("p-meenakshi", "present", "current", "Wrist-friendly variations"), p("p-ananya-s", "cancelled")],
    waitlist: [],
  },
  {
    id: "c-back-09", title: "Evening Back Care", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(9, "17:30"), durationMin: 60, capacity: 12,
    focus: "Core stability, hip mobility, neutral spine",
    enrolled: [p("p-fatima", "present", "current", "Avoid loaded flexion"), p("p-lakshmi-n", "late", "current", "Knee OA — chair-supported standing poses"), p("p-meenakshi", "present", "current", "Wrist-friendly variations")],
    waitlist: [],
  },
  {
    id: "c-pcos-10", title: "PCOS Strength & Flow", kind: "group", instructorId: "s-lakshmi", room: "Yoga Hall", start: D(10, "09:00"), durationMin: 60, capacity: 10,
    focus: "Strength-biased flow, 2× weekly programme",
    enrolled: [p("p-aditi", "present"), p("p-neelam", "absent")],
    waitlist: [],
  },
  {
    id: "c-mobility-10", title: "Gentle Mobility 60+", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(10, "10:00"), durationMin: 45, capacity: 10,
    focus: "Fall prevention, chair-supported balance",
    enrolled: [p("p-lakshmi-n", "present", "current", "Knee OA — chair-supported standing poses"), p("p-rekha", "present", "current", "SpO₂ floor 90% during practice"), p("p-sunita", "present")],
    waitlist: [],
  },
  {
    id: "c-rekha-10", title: "Breathwork · 1:1", kind: "individual", instructorId: "s-lakshmi", room: "Therapy Room", start: D(10, "17:00"), durationMin: 45, capacity: 1,
    focus: "Pursed-lip breathing, paced walking prep",
    enrolled: [p("p-rekha", "present", "current", "SpO₂ floor 90% during practice")],
    waitlist: [],
  },
  {
    id: "c-sunrise-11", title: "Sunrise Cardiac Rehab Flow", kind: "group", instructorId: "s-kavya", room: "Yoga Hall", start: D(11, "07:30"), durationMin: 60, capacity: 8,
    focus: "Low-intensity flow · keep HR below 110 bpm · no inversions",
    enrolled: [p("p-kabir", "present", "current", "HR ceiling 110 bpm; avoid breath retention"), p("p-vivek", "present"), p("p-arun", "present", "current", "Post-MI: seated variations only until review"), p("p-karthik", "present"), p("p-gaurav", "absent", "current", "OSA — avoid supine breath-holds")],
    waitlist: [],
  },
  {
    id: "c-breath-11", title: "Breath & Balance", kind: "group", instructorId: "s-lakshmi", room: "Yoga Hall", start: D(11, "12:00"), durationMin: 45, capacity: 8,
    focus: "Diaphragmatic breathing, balance and gentle mobility",
    enrolled: [p("p-aditi", "present"), p("p-neelam", "present"), p("p-zoya", "present"), p("p-rekha", "present", "current", "SpO₂ floor 90% during practice"), p("p-mohit", "present", "current", "Inhaler within reach"), p("p-sunita", "absent"), p("p-meenakshi", "present"), p("p-ananya-s", "present")],
    waitlist: [],
  },
  {
    id: "c-mobility-12", title: "Gentle Mobility 60+", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(12, "10:00"), durationMin: 45, capacity: 10,
    focus: "Fall prevention, chair-supported balance",
    enrolled: [p("p-lakshmi-n", "present"), p("p-sunita", "present"), p("p-rekha", "present", "current", "SpO₂ floor 90% during practice")],
    waitlist: [],
  },
  {
    id: "c-back-12", title: "Evening Back Care", kind: "group", instructorId: "s-arjun", room: "Yoga Deck", start: D(12, "17:30"), durationMin: 60, capacity: 12,
    focus: "Core stability, hip mobility, neutral spine",
    enrolled: [p("p-fatima", "present", "current", "Avoid loaded flexion"), p("p-meenakshi", "absent"), p("p-lakshmi-n", "present")],
    waitlist: [],
  },
];

/** Reasons recorded with the synthetic attendance (keyed classId:patientId). */
export const BASE_REASONS: Record<string, string> = {
  "c-sunrise-13:p-arun": "No call or message",
  "c-sunrise-13:p-karthik": "Arrived 07:45 — traffic",
  "c-sunrise-09:p-arun": "Unwell — told front desk next day",
  "c-back-13:p-deepak": "Programme completed — cancelled remaining class",
  "c-breath-09:p-mohit": "Asthma flare — messaged at 11:10",
  "c-breath-09:p-zoya": "10 minutes late",
  "c-breath-09:p-ananya-s": "Travelling — cancelled 8 Nov",
  "c-back-09:p-lakshmi-n": "Caregiver delayed",
  "c-pcos-10:p-neelam": "Unwell — called in",
  "c-sunrise-11:p-gaurav": "Night shift — messaged",
  "c-breath-11:p-sunita": "Family function",
  "c-back-12:p-meenakshi": "Morning-stiffness flare",
};

/** Attendance before this week (for repeated-absence detection). */
export const ATTENDANCE_HISTORY: Record<string, { date: string; title: string; state: AttendanceState; reason?: string }[]> = {
  "p-arun": [
    { date: D(4, "07:30"), title: "Sunrise Cardiac Rehab Flow", state: "absent", reason: "No call or message" },
    { date: D(6, "07:30"), title: "Sunrise Cardiac Rehab Flow", state: "present" },
  ],
};

export interface SessionStep {
  id: string;
  name: string;
  minutes: number;
}

export interface SessionPlan {
  objectives: string[];
  steps: SessionStep[];
  modifications: string[];
  props: string[];
}

const steps = (prefix: string, list: [string, number][]): SessionStep[] => list.map(([name, minutes], i) => ({ id: `${prefix}-${i}`, name, minutes }));

/** Shared lesson plan per class series (doc §2D: one shared plan; everything personal stays individual). */
export const SESSION_PLANS: Record<string, SessionPlan> = {
  "Sunrise Cardiac Rehab Flow": {
    objectives: ["Gentle aerobic flow under the HR ceiling", "Paced breathing 4-6", "Standing balance with support"],
    steps: steps("sun", [["Arrival, HR & symptom check", 5], ["Seated paced breathing 4-6 (no retention)", 8], ["Seated joint mobility", 10], ["Chair-supported standing flow", 20], ["Balance at the wall", 7], ["Supported relaxation, head raised", 10]]),
    modifications: ["No inversions, no breath retention (class rule)", "Rise slowly from seated — 3 breaths before standing"],
    props: ["Chairs", "Wall space", "Bolsters", "HR monitors"],
  },
  "Breath & Balance": {
    objectives: ["Diaphragmatic breathing", "Static and dynamic balance", "Gentle mobility"],
    steps: steps("bb", [["Check-in; SpO₂ for flagged participants", 5], ["Diaphragmatic breathing, seated", 8], ["Gentle mobility", 10], ["Balance sequence at the wall", 12], ["Guided relaxation", 10]]),
    modifications: ["Seated option for every standing pose", "Pulse oximeter on anyone with an SpO₂ floor"],
    props: ["Pulse oximeter", "Chairs", "Blocks", "Blankets"],
  },
  "Breathwork · 1:1": {
    objectives: ["Pursed-lip breathing under exertion", "Paced walking preparation"],
    steps: steps("bw", [["Check-in and resting SpO₂", 5], ["Pursed-lip breathing", 10], ["Paced walking prep", 15], ["Recovery breathing", 10], ["Home-practice review", 5]]),
    modifications: ["Stop and rest if SpO₂ falls below the floor"],
    props: ["Pulse oximeter", "Chair", "Timer"],
  },
  "Evening Back Care": {
    objectives: ["Core stability", "Hip mobility", "Neutral spine in daily movement"],
    steps: steps("bc", [["Check-in and pain scale", 5], ["Supine core activation", 12], ["Hip mobility", 13], ["Neutral-spine standing work", 15], ["Supported relaxation", 15]]),
    modifications: ["No loaded spinal flexion", "Chair support for standing work"],
    props: ["Mats", "Bolsters", "Chairs", "Straps"],
  },
  "Prenatal yoga · 1:1": {
    objectives: ["Pelvic-floor awareness", "Comfortable side-lying rest"],
    steps: steps("pn", [["Check-in", 5], ["Pelvic-floor awareness", 10], ["Side-lying mobility", 15], ["Breath and relaxation, side-lying", 15]]),
    modifications: ["No supine poses after 20 weeks"],
    props: ["Bolsters", "Blocks", "Wedge cushion"],
  },
  "PCOS Strength & Flow": {
    objectives: ["Strength-biased flow", "Consistency: 2× weekly"],
    steps: steps("pc", [["Warm-up", 8], ["Strength flow", 25], ["Core", 12], ["Cool-down", 10], ["Relaxation", 5]]),
    modifications: ["Hydration break mid-class"],
    props: ["Mats", "Blocks", "Light dumbbells"],
  },
  "Gentle Mobility 60+": {
    objectives: ["Fall prevention", "Chair-supported balance"],
    steps: steps("gm", [["Seated warm-up", 8], ["Chair-supported balance", 15], ["Mobility", 12], ["Relaxation", 10]]),
    modifications: ["Chair within reach for every standing pose"],
    props: ["Chairs", "Wall space", "Blankets"],
  },
};

export const PROP_OPTIONS = ["Chairs", "Wall space", "Bolsters", "Blocks", "Blankets", "Straps", "Mats", "Pulse oximeter", "HR monitors", "Timer", "Light dumbbells", "Wedge cushion"];

/** Who approved each participant's precaution, when, and what it replaced. */
export interface Clearance {
  by: string;
  at: string;
  validUntil: string | null;
  /** set when `by` signed on behalf of the patient's own doctor (e.g. covering leave) */
  coveringFor?: string;
  previous?: { text: string; at: string; by: string };
  reason?: string;
}

/**
 * Who covers a doctor's patients while they are away. Source: the care-team thread of 13 Nov
 * ("Covering for Dr. Sana: raised floor to 92% after spirometry") — Dr. Sana Qureshi is on leave
 * until 18 Nov and Dr. Vikram Iyer signs for her patients.
 */
export const COVERING: Record<string, string> = { "s-sana": "s-vikram" };

export const CLEARANCES: Record<string, Clearance> = {
  "p-kabir": { by: "s-ananya", at: "2026-11-06T11:05:00+05:30", validUntil: "2026-12-04" },
  "p-vivek": { by: "s-ananya", at: "2026-11-04T09:45:00+05:30", validUntil: "2027-02-04" },
  "p-arun": { by: "s-ananya", at: "2026-10-30T12:20:00+05:30", validUntil: "2026-11-27" },
  "p-karthik": { by: "s-ananya", at: "2026-11-02T08:30:00+05:30", validUntil: "2027-02-02" },
  "p-gaurav": { by: "s-vikram", at: "2026-11-11T07:00:00+05:30", validUntil: "2027-02-11" },
  "p-aditi": { by: "s-vikram", at: "2026-11-03T09:00:00+05:30", validUntil: "2027-02-03" },
  "p-neelam": { by: "s-sana", at: "2026-10-28T11:20:00+05:30", validUntil: "2027-01-28" },
  "p-zoya": { by: "s-sana", at: "2026-11-03T15:30:00+05:30", validUntil: "2027-02-03" },
  "p-rekha": {
    by: "s-vikram", coveringFor: "s-sana", at: "2026-11-13T08:45:00+05:30", validUntil: "2026-12-13",
    previous: { text: "SpO₂ floor 90% during practice", at: "2026-10-20T10:00:00+05:30", by: "s-sana" },
    reason: "Raised after the 12 Nov spirometry and a desaturation to 89% during paced-walking prep on 10 Nov.",
  },
  "p-mohit": { by: "s-sana", at: "2026-08-14T17:30:00+05:30", validUntil: "2026-11-12" },
  "p-sunita": { by: "s-ananya", at: "2026-11-06T11:40:00+05:30", validUntil: "2027-02-06" },
  "p-meenakshi": { by: "s-sana", at: "2026-10-31T09:50:00+05:30", validUntil: "2027-01-31" },
  "p-ananya-s": { by: "s-vikram", at: "2026-11-05T12:20:00+05:30", validUntil: "2027-02-05" },
  "p-fatima": { by: "s-sana", at: "2026-10-06T10:15:00+05:30", validUntil: "2027-01-06" },
  "p-lakshmi-n": { by: "s-sana", at: "2026-11-07T09:20:00+05:30", validUntil: "2027-02-07" },
  "p-deepak": { by: "s-sana", at: "2026-07-21T10:00:00+05:30", validUntil: "2026-12-21" },
  "p-ishita": { by: "s-sana", at: "2026-11-09T10:40:00+05:30", validUntil: "2026-12-07" },
  "p-tanvi": { by: "s-vikram", at: "2026-11-12T10:00:00+05:30", validUntil: "2027-02-12" },
};

export type Participation = "full" | "modified" | "observed" | "absent";
export const PARTICIPATION_LABEL: Record<Participation, string> = { full: "Full", modified: "Modified", observed: "Observed only", absent: "Did not attend" };
export const TOLERANCE_OPTIONS = ["Comfortable", "Mild fatigue", "Mild discomfort", "Breathless — paused", "Light-headed — stopped", "Pain — stopped"];

export interface Observation {
  id: string;
  patientId: string;
  classTitle: string;
  at: string;
  by: string;
  participation: Participation;
  tolerance: string;
  text: string;
  goal: string;
  concern: boolean;
}

export const OBSERVATIONS: Observation[] = [
  { id: "ob-kabir-11", patientId: "p-kabir", classTitle: "Sunrise Cardiac Rehab Flow", at: D(11, "08:35"), by: "s-kavya", participation: "full", tolerance: "Comfortable", text: "HR peaked at 104 bpm in the standing flow and recovered within 2 minutes. Asked to swap Saturday's class.", goal: "Tree pose at the wall, 30 s each side", concern: false },
  { id: "ob-arun-11", patientId: "p-arun", classTitle: "Sunrise Cardiac Rehab Flow", at: D(11, "08:40"), by: "s-kavya", participation: "modified", tolerance: "Light-headed — stopped", text: "Light-headed standing up from a seated forward fold. Rested 5 minutes seated and it settled. Escalated for clinical review.", goal: "", concern: true },
  { id: "ob-rekha-10", patientId: "p-rekha", classTitle: "Breathwork · 1:1", at: D(10, "17:50"), by: "s-lakshmi", participation: "modified", tolerance: "Breathless — paused", text: "SpO₂ dipped to 89% in paced-walking prep; back to 94% within 90 s of pursed-lip breathing. Reported to Dr. Sana Qureshi.", goal: "Pursed-lip breathing on every stair climb", concern: true },
  { id: "ob-mohit-11", patientId: "p-mohit", classTitle: "Breath & Balance", at: D(11, "12:50"), by: "s-lakshmi", participation: "full", tolerance: "Comfortable", text: "Used his inhaler before class as advised; no wheeze.", goal: "", concern: false },
  { id: "ob-fatima-12", patientId: "p-fatima", classTitle: "Evening Back Care", at: D(12, "18:35"), by: "s-arjun", participation: "modified", tolerance: "Mild discomfort", text: "Mild low-back discomfort in bridge; reduced the range and it settled.", goal: "Bridge with block, 3 × 8", concern: false },
];
