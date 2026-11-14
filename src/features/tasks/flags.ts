import { patientById } from "@/data/patients";
import { STAFF, staffById } from "@/data/staff";
import { createTask, updateTask, type CareTask } from "./store";
import { NOW_ISO, TODAY_KEY, addDays, isoAt } from "./time";

/**
 * F8 — Flag a concern (nutritionist or instructor → doctor). The flag becomes one pending item
 * owned by the patient's primary doctor (rule 2: one owner per item); the person who raised it
 * follows it under "Raised by me". Everything stays in this browser session.
 */
export type FlagUrgency = "routine" | "same-day";
export const FLAG_URGENCY_LABEL: Record<FlagUrgency, string> = { routine: "Routine", "same-day": "Same day" };

/** Who signs for a doctor's patients while they are away (Dr. Sana Qureshi is on leave until 18 Nov). */
export const COVERING_DOCTOR: Record<string, string> = { "s-sana": "s-vikram" };

/** The doctor a flag goes to: the patient's primary doctor, or whoever covers while they're on leave. */
export function flagRoute(patientId: string): { ownerId: string; via: string | null } {
  const doctor = staffById(patientById(patientId)?.careTeam.doctor);
  if (doctor && doctor.status !== "on-leave") return { ownerId: doctor.id, via: null };
  const cover = staffById(doctor ? COVERING_DOCTOR[doctor.id] : undefined) ?? STAFF.find((s) => s.role === "doctor" && s.status !== "on-leave");
  if (!cover) return { ownerId: doctor?.id ?? "s-ananya", via: null };
  if (!doctor) return { ownerId: cover.id, via: "No primary doctor on record" };
  const leave = /^on leave/i.test(doctor.workingHours) ? doctor.workingHours.charAt(0).toLowerCase() + doctor.workingHours.slice(1) : "on leave";
  return { ownerId: cover.id, via: `${doctor.name} is ${leave} — ${cover.name} is covering` };
}

const short = (text: string, max = 64) => {
  const first = text.trim().split(/(?<=[.!?])\s/)[0];
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first.replace(/[.!?]$/, "");
};

export interface RaiseFlagInput {
  patientId: string;
  text: string;
  urgency: FlagUrgency;
  byId: string;
  /** where it was raised, e.g. "Breath & Balance · 13 Nov" or "Nutrition plan v3" */
  context?: string;
}

/** Creates the flag as a pending item for the doctor. Same day → due today 17:00; routine → in 2 days. */
export function raiseFlag(input: RaiseFlagInput): { task: CareTask; ownerId: string; via: string | null } {
  const route = flagRoute(input.patientId);
  const by = staffById(input.byId);
  const task = createTask(
    {
      title: `Flag: ${short(input.text)}`,
      patientId: input.patientId,
      ownerId: route.ownerId,
      due: input.urgency === "same-day" ? isoAt(TODAY_KEY, "17:00") : isoAt(addDays(TODAY_KEY, 2), "18:00"),
      priority: input.urgency === "same-day" ? "high" : "normal",
      source: `Flag from ${by?.name ?? "the care team"}${input.context ? ` · ${input.context}` : ""}`,
      discipline: "medical",
      notes: input.text.trim(),
      flag: { urgency: input.urgency, raisedBy: input.byId, context: input.context, via: route.via },
    },
    input.byId,
  );
  return { task, ownerId: route.ownerId, via: route.via };
}

/** The doctor's reply closes the flag; the person who raised it sees the reply under "Raised by me". */
export function respondToFlag(task: CareTask, text: string, byId: string) {
  const flag = task.flag ?? { urgency: (task.priority === "urgent" || task.priority === "high" ? "same-day" : "routine") as FlagUrgency, raisedBy: task.createdBy };
  updateTask(task.id, { status: "done", flag: { ...flag, response: { text: text.trim(), at: NOW_ISO, by: byId } } }, { actorId: byId, kind: "comment", text: `Responded — “${text.trim()}”` });
}

export const isFlagTask = (t: Pick<CareTask, "source" | "flag">) => !!t.flag || /^flag from|escalat/i.test(t.source);
