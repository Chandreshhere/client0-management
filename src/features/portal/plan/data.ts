import { CARE_PLAN } from "@/data/featured";
import { CLASSES, NUTRITION_PLANS, PACKAGES } from "@/data/programs";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { TASKS } from "@/data/care";
import { staffById } from "@/data/staff";
import { formatTime } from "@/lib/format";
// Kabir's plan content is authored in the nutrition builder; the portal reads the same fixtures so
// the patient sees exactly the plan Meera published (one adapter, read-only).
import { FOOD_LOGS, GUIDANCE, LOG_MATCH_LABEL, PLAN_HISTORY, PLAN_SOURCE, ROUTINES, SLOTS, SWAPS, foodById, templateById, type FoodLog, type SlotId } from "@/features/nutrition/data";
import { MEDICINES, METRICS, PATIENT_ID, ME } from "../record";
import { TODAY_KEY, istMinutes, weekdayOf } from "../time";

// ---------------------------------------------------------------------------------------------
// Nutrition plan (published version) as plain-language meal slots
// ---------------------------------------------------------------------------------------------

export const NUTRITION = NUTRITION_PLANS.find((p) => p.patientId === PATIENT_ID && p.status === "published") ?? null;
const source = NUTRITION ? PLAN_SOURCE[NUTRITION.id] : undefined;
const template = source ? templateById(source.template) : undefined;
export const PLAN_VERSIONS = NUTRITION ? (PLAN_HISTORY[NUTRITION.id] ?? []) : [];
export const CURRENT_VERSION = PLAN_VERSIONS.find((v) => v.version === NUTRITION?.version) ?? null;
export const NUTRITION_GUIDANCE = GUIDANCE[PATIENT_ID] ?? null;
export const ROUTINE = ROUTINES[PATIENT_ID] ?? null;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Mon · Wed · Thu" → [1, 3, 4] */
export const OFFICE_DAYS: number[] = (ROUTINE?.officeDays ?? "")
  .split("·")
  .map((d) => DAY_NAMES.indexOf(d.trim().slice(0, 3)))
  .filter((i) => i >= 0);
export const isOfficeDay = (day: string) => OFFICE_DAYS.includes(weekdayOf(day));
export const TODAY_IS_OFFICE = isOfficeDay(TODAY_KEY);
export const OFFICE_DAY_NAMES = OFFICE_DAYS.map((d) => DAY_NAMES[d]);

/** The published version may move a meal on office days ("Office days: dinner by 19:30 …"). */
const officeDinner = PLAN_VERSIONS.flatMap((v) => v.changes)
  .map((c) => c.match(/office days:\s*dinner by (\d{2}:\d{2})/i)?.[1])
  .filter((x): x is string => !!x)
  .at(-1);

export interface MealItem {
  id: string;
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  fibre: number;
  note?: string;
  swaps: { name: string; note: string }[];
}

export interface MealSlot {
  id: SlotId;
  label: string;
  home: string;
  office: string;
  items: MealItem[];
  kcal: number;
  protein: number;
  fibre: number;
}

export const MEAL_SLOTS: MealSlot[] = template
  ? SLOTS.map((s) => {
      const items: MealItem[] = template.slots[s.id].flatMap((foodId, i) => {
        const f = foodById(foodId);
        if (!f) return [];
        return [
          {
            id: `${s.id}-${i}`,
            name: f.name,
            portion: f.portion,
            kcal: f.kcal,
            protein: f.protein,
            fibre: f.fibre,
            note: source?.notes?.[foodId],
            swaps: (SWAPS[foodId] ?? []).flatMap((sw) => {
              const alt = foodById(sw.foodId);
              return alt ? [{ name: alt.name, note: sw.note }] : [];
            }),
          },
        ];
      });
      const sum = (k: "kcal" | "protein" | "fibre") => Math.round(items.reduce((a, it) => a + it[k], 0) * 10) / 10;
      return {
        id: s.id,
        label: s.label,
        home: s.home,
        office: s.id === "dinner" && officeDinner ? officeDinner : s.office,
        items,
        kcal: sum("kcal"),
        protein: sum("protein"),
        fibre: sum("fibre"),
      };
    })
  : [];

export const PLAN_TOTALS = {
  kcal: Math.round(MEAL_SLOTS.reduce((a, s) => a + s.kcal, 0)),
  protein: Math.round(MEAL_SLOTS.reduce((a, s) => a + s.protein, 0)),
  fibre: Math.round(MEAL_SLOTS.reduce((a, s) => a + s.fibre, 0)),
};

/** "Oil 3 tsp/day; salt under 5 g/day." → { oil: "3 tsp", salt: "under 5 g" } */
const guidanceText = NUTRITION_GUIDANCE?.lines.join(" ") ?? "";
export const OIL_PER_DAY = guidanceText.match(/oil\s+(\d+\s*tsp)/i)?.[1] ?? null;
export const SALT_PER_DAY = guidanceText.match(/salt\s+(under\s+\d+\s*g)/i)?.[1] ?? null;

/** The patient's own food logs (self-reported) — newest first. */
export const MY_FOOD_LOGS: FoodLog[] = FOOD_LOGS.filter((l) => l.patientId === PATIENT_ID).sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
export { LOG_MATCH_LABEL };

// ---------------------------------------------------------------------------------------------
// Movement plan + precautions
// ---------------------------------------------------------------------------------------------

export const PACKAGE = PACKAGES.find((p) => p.patientId === PATIENT_ID) ?? null;
const myClasses = CLASSES.filter((c) => c.enrolled.some((e) => e.patientId === PATIENT_ID)).sort((a, b) => b.start.localeCompare(a.start));
const enrolment = myClasses.flatMap((c) => c.enrolled.filter((e) => e.patientId === PATIENT_ID && e.precaution).map((e) => ({ ...e, cls: c })))[0] ?? null;

/** "HR ceiling 110 bpm" (class precaution) / "below 110 bpm" (doctor's guidance). */
export const HR_CEILING = Number((enrolment?.precaution ?? CARE_PLAN.medical.text).match(/(\d{2,3})\s*bpm/)?.[1] ?? NaN);

export const MOVEMENT = {
  text: CARE_PLAN.movement.text.replace(/\s*\([^)]*\)/, ""),
  by: CARE_PLAN.movement.by,
  updated: CARE_PLAN.movement.updated,
  classTitle: myClasses[0]?.title ?? null,
  classFocus: myClasses[0]?.focus ?? null,
  instructor: staffById(myClasses[0]?.instructorId)?.name ?? null,
  clearance: enrolment?.clearance ?? null,
};

/** Precautions, each traced to where it was written. */
export const PRECAUTIONS: { id: string; text: string; source: string }[] = [
  ...(Number.isFinite(HR_CEILING) ? [{ id: "hr", text: `Keep your heart rate below ${HR_CEILING} bpm while exercising`, source: `Class precaution · ${MOVEMENT.instructor ?? "your instructor"}` }] : []),
  ...(/breath retention/i.test(`${enrolment?.precaution ?? ""} ${CARE_PLAN.medical.text}`) ? [{ id: "breath", text: "No breath-holding (breath retention) practices", source: `Doctor's guidance · ${staffById(CARE_PLAN.medical.by)?.name}` }] : []),
  ...(/no inversions/i.test(MOVEMENT.classFocus ?? "") ? [{ id: "inversions", text: "No upside-down poses (inversions)", source: `${MOVEMENT.classTitle} · class focus` }] : []),
  ...(ME.conditions.some((c) => /asthma/i.test(c)) ? [{ id: "inhaler", text: "Keep your inhaler within reach in class", source: "Because you have asthma" }] : []),
];

/** Latest resting heart rate the patient can see (released or self-reported). */
export const LATEST_RESTING_HR = METRICS.hr.points.at(-1) ?? null;

// ---------------------------------------------------------------------------------------------
// Today: the day plan as one checklist (meals at home-day or office-day times, medicines,
// practice, logging, plus today's visits as context rows)
// ---------------------------------------------------------------------------------------------

export type TodayKind = "meal" | "medicine" | "practice" | "log" | "class" | "visit";

export interface TodayItem {
  id: string;
  /** minutes after midnight, for ordering + the "now" line */
  at: number;
  time: string;
  kind: TodayKind;
  label: string;
  detail?: string;
  /** done by someone else / elsewhere (clinic attendance, the patient's food log) */
  doneBy?: string;
  /** meal slot, for logging the meal against the plan */
  slotId?: string;
  tickable: boolean;
  href?: string;
}

const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const slotTime = (s: MealSlot) => (TODAY_IS_OFFICE ? s.office : s.home);
const plainList = (items: MealItem[]) => items.map((i) => i.name.replace(/\s*\([^)]*\)/g, "").toLowerCase()).join(", ");

const todaysLogs = MY_FOOD_LOGS.filter((l) => l.eatenAt.slice(0, 10) === TODAY_KEY);
const breakfast = MEAL_SLOTS.find((s) => s.id === "breakfast");
const morningMeds = MEDICINES.filter((m) => /aspirin|metoprolol/i.test(m.name));
const nightMeds = MEDICINES.filter((m) => /atorvastatin/i.test(m.name));
const inhalerMed = MEDICINES.find((m) => /inhaler/i.test(m.name));
const bpTask = CARE_PLAN.actions.find((a) => a.owner === PATIENT_ID && /bp/i.test(a.label));
const homePractice = TASKS.find((t) => t.patientId === PATIENT_ID && /home-practice/i.test(t.title) && t.status === "done");

export const TODAY_ITEMS: TodayItem[] = [
  ...MEAL_SLOTS.map((s): TodayItem => {
    const log = todaysLogs.find((l) => l.slot === s.id);
    return {
      id: `meal-${s.id}`,
      slotId: s.id,
      at: hm(slotTime(s)),
      time: slotTime(s),
      kind: "meal",
      label: s.label,
      detail: plainList(s.items).replace(/^./, (c) => c.toUpperCase()),
      doneBy: log ? `You logged it at ${formatTime(log.eatenAt)} · ${LOG_MATCH_LABEL[log.match].toLowerCase()}` : undefined,
      tickable: true,
    };
  }),
  ...myClasses
    .filter((c) => c.start.slice(0, 10) === TODAY_KEY)
    .map((c): TodayItem => {
      const en = c.enrolled.find((e) => e.patientId === PATIENT_ID)!;
      const marked = en.attendance === "present" || en.attendance === "late";
      return {
        id: `class-${c.id}`,
        at: istMinutes(c.start),
        time: formatTime(c.start),
        kind: "class",
        label: c.title,
        detail: c.focus,
        doneBy: marked ? `Marked ${en.attendance} by ${staffById(c.instructorId)?.name}` : undefined,
        tickable: true,
      };
    }),
  ...(morningMeds.length && breakfast
    ? [
        {
          id: "meds-morning",
          at: hm(slotTime(breakfast)) + 1,
          time: slotTime(breakfast),
          kind: "medicine" as const,
          label: "Morning medicines",
          detail: `${morningMeds.map((m) => `${m.name} ${m.dose}`).join(" + ")}${inhalerMed ? " · inhaler" : ""}`,
          tickable: true,
        },
      ]
    : []),
  ...TODAY_APPOINTMENTS.filter((a) => a.patientId === PATIENT_ID && a.status !== "cancelled").map(
    (a): TodayItem => ({
      id: `visit-${a.id}`,
      at: istMinutes(a.start),
      time: formatTime(a.start),
      kind: "visit",
      label: a.service,
      detail: `${staffById(a.staffId)?.name} · ${a.room}`,
      tickable: false,
      href: "/portal/appointments",
    }),
  ),
  {
    id: "practice-breathing",
    at: 18 * 60,
    time: "Evening",
    kind: "practice" as const,
    label: "Paced breathing 4-6 · 10 min",
    detail: homePractice ? `From the home-practice sheet ${staffById(homePractice.ownerId)?.name.split(" ")[0]} released` : "From your movement plan",
    tickable: true,
  },
  ...(bpTask
    ? [
        {
          id: "log-bp",
          at: 21 * 60,
          time: "Evening",
          kind: "log" as const,
          label: "Log today's blood pressure",
          detail: `Part of your 7-day home log · due ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${bpTask.due}T12:00:00+05:30`))}`,
          tickable: false,
        },
      ]
    : []),
  ...(nightMeds.length
    ? [
        {
          id: "meds-night",
          at: 22 * 60,
          time: "Bedtime",
          kind: "medicine" as const,
          label: "Night medicine",
          detail: `${nightMeds.map((m) => `${m.name} ${m.dose}`).join(" + ")}${inhalerMed ? " · inhaler" : ""}`,
          tickable: true,
        },
      ]
    : []),
].sort((a, b) => a.at - b.at);
