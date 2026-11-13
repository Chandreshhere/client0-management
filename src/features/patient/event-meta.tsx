import { BowlFood, FileText, Pill, PersonSimpleTaiChi, Pulse, Scan, Stethoscope, TestTube, Files } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { CareEventType } from "@/data/featured";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";

export const EVENT_ICON: Record<CareEventType, Icon> = {
  note: FileText,
  document: Files,
  lab: TestTube,
  vitals: Pulse,
  medication: Pill,
  imaging: Scan,
  consult: Stethoscope,
  nutrition: BowlFood,
  movement: PersonSimpleTaiChi,
};

/** Resolve an event author id (staff id, patient id or "lab:<name>") to a display name. */
export function authorName(id: string) {
  if (id.startsWith("lab:")) return id.slice(4);
  return staffById(id)?.name ?? patientById(id)?.name ?? "Unknown";
}

export function authorAvatar(id: string) {
  if (id.startsWith("lab:")) return null;
  return staffById(id)?.avatar ?? patientById(id)?.avatar ?? null;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
