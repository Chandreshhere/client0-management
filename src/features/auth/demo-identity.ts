import type { Role } from "@/data/types";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { PLANS, minPlanForRole } from "@/data/plans";

/** Demo password used when a demo account pre-fills the form. Nothing checks it. */
export const DEMO_PASSWORD = "carelane-demo";

export interface DemoIdentity {
  role: Role;
  label: string;
  name: string;
  title: string;
  avatar: string;
  email: string;
  /** Plans that include this role, cheapest first (e.g. Reception → Clinic, Pro). */
  plans: string[];
  /** "in every plan" · "in Clinic and Pro" · "in Pro only" */
  availability: string;
}

/** Resolve the synthetic person behind each demo login (shared DEMO_USER fixture) and the plans that include the role. */
export function demoIdentity(role: Role): DemoIdentity {
  const demo = DEMO_USER[role];
  const plans = PLANS.filter((p) => p.roles.includes(role)).map((p) => p.name);
  const availability = plans.length === PLANS.length ? "in every plan" : plans.length === 1 ? `in ${minPlanForRole(role).name} only` : `in ${plans.join(" and ")}`;
  if (role === "patient") {
    const p = patientById(demo.personId);
    return {
      role,
      label: demo.label,
      name: p?.name ?? "Demo patient",
      title: p?.program ? `Patient · ${p.program}` : "Patient",
      avatar: p?.avatar ?? "",
      // Patients have no email in the registry; this address is fictional and only fills the form.
      email: "kabir.malhotra@patient.example",
      plans,
      availability,
    };
  }
  const s = staffById(demo.personId);
  return {
    role,
    label: demo.label,
    name: s?.name ?? demo.label,
    title: s?.title ?? demo.description,
    avatar: s?.avatar ?? "",
    email: s?.email ?? "demo@prana.example",
    plans,
    availability,
  };
}
