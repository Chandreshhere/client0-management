import type { Discipline, Role } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { PATIENTS, patientById } from "@/data/patients";

/** People lookups shared by tasks, referrals, messages and documents (staff and patients). */
export type Person = { id: string; name: string; avatar: string | null; title: string; kind: "staff" | "patient"; discipline?: Discipline };

export function personById(id: string | null | undefined): Person | undefined {
  if (!id) return undefined;
  const s = staffById(id);
  if (s) return { id: s.id, name: s.name, avatar: s.avatar, title: s.title, kind: "staff", discipline: s.discipline };
  const p = patientById(id);
  if (p) return { id: p.id, name: p.name, avatar: p.avatar, title: "Patient", kind: "patient" };
  return undefined;
}

/** Discipline marks: small categorical dots, always paired with a text label. */
export const DISCIPLINE_DOT: Record<Discipline, string> = {
  medical: "bg-medical",
  nutrition: "bg-nutrition",
  movement: "bg-movement",
  operations: "bg-ops",
};

export const CLINICAL_ROLES: Role[] = ["doctor", "nutritionist", "yoga"];
export const isClinician = (role: Role) => CLINICAL_ROLES.includes(role);

export const STAFF_SORTED = [...STAFF].sort((a, b) => a.name.replace(/^Dr\.\s/, "").localeCompare(b.name.replace(/^Dr\.\s/, "")));
export const PATIENTS_SORTED = [...PATIENTS].sort((a, b) => a.name.localeCompare(b.name));

export const staffOptions = (filter?: (s: (typeof STAFF)[number]) => boolean) =>
  STAFF_SORTED.filter((s) => (filter ? filter(s) : true)).map((s) => ({
    value: s.id,
    label: s.name,
    description: s.status === "on-leave" ? `${s.title} · ${s.workingHours}` : s.title,
  }));

export const patientOptions = () => PATIENTS_SORTED.map((p) => ({ value: p.id, label: p.name, description: `${p.age} · ${p.area}` }));
