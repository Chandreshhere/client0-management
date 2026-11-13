import type { Role } from "@/data/types";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { PLANS } from "@/data/plans";

/** Demo password used when a demo account pre-fills the form. Nothing checks it. */
export const DEMO_PASSWORD = "carelane-demo";

export interface DemoIdentity {
  role: Role;
  label: string;
  name: string;
  title: string;
  avatar: string;
  email: string;
  /** Plans whose workspace includes this role (e.g. Admin → Clinic only). */
  plans: string[];
}

/** Resolve the synthetic person behind each demo workspace (shared DEMO_USER fixture). */
export function demoIdentity(role: Role): DemoIdentity {
  const demo = DEMO_USER[role];
  const plans = PLANS.filter((p) => p.roles.includes(role)).map((p) => p.name);
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
  };
}
