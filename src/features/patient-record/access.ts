import type { Role } from "@/data/types";
import { DEMO_USER } from "@/data/staff";

/**
 * Demo access model for clinical content (doc §2A, §3A): doctors author; the rest of the care
 * team reads; front desk and admin route records without reading clinical contents. A real
 * deployment enforces this on the server — this only shapes what the prototype shows.
 */
export type ClinicalAccess = "full" | "read" | "none";

export function clinicalAccess(role: Role, patientId: string): ClinicalAccess {
  if (role === "doctor") return "full";
  if (role === "nutritionist" || role === "yoga" || role === "coordinator") return "read";
  if (role === "patient") return DEMO_USER.patient.personId === patientId ? "read" : "none";
  return "none";
}

export const roleLabel = (role: Role) => DEMO_USER[role].label;
