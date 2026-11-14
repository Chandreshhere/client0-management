import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/data/types";
import { DEFAULT_PLAN, effectiveRole, isPlanId, planHas, type FeatureId, type PlanId } from "@/data/plans";
import { patientById } from "@/data/patients";
import { COOKIE_PLAN, COOKIE_ROLE } from "@/lib/cookies";
import { isRole } from "@/lib/roles";
import { canOpenSection, defaultSectionFor, isFrontOffice, sectionHref, type SectionId } from "./sections";

/**
 * Server-side view of the demo session for the profile routes (same cookies the workspace layout
 * reads, so server and client agree). Real access control is enforced by the server from a trusted
 * identity; here it decides which section a role may open and where the profile starts.
 */
export async function profileSession(): Promise<{ role: Role; plan: PlanId; has: (f: FeatureId) => boolean }> {
  const store = await cookies();
  const planCookie = store.get(COOKIE_PLAN)?.value;
  const plan = isPlanId(planCookie) ? planCookie : DEFAULT_PLAN;
  const roleCookie = store.get(COOKIE_ROLE)?.value;
  const role = effectiveRole(plan, isRole(roleCookie) ? roleCookie : "doctor");
  return { role, plan, has: (f) => planHas(plan, f) };
}

/** Where a role lands when it opens a patient (or a section it doesn't see). */
export function entryFor(patientId: string, role: Role, has: (f: FeatureId) => boolean) {
  if (role === "patient") return has("portal") ? "/portal/records" : "/dashboard";
  const start = defaultSectionFor(role, has);
  return start ? sectionHref(patientId, start) : "/patients";
}

/**
 * Resolve the patient and make sure the current role may open this section (and sub-view);
 * otherwise redirect to where the role starts. `clinical` sub-views (lab values, imaging, vital
 * signs, conditions) are never shown to Admin or Reception, who see file names and types only.
 */
export async function openSection(id: string, section: SectionId, opts: { clinical?: boolean; roles?: Role[] } = {}) {
  const patient = patientById(id);
  if (!patient) notFound();
  const session = await profileSession();
  const { role, has } = session;
  if (role === "patient" || !canOpenSection(role, has, section)) redirect(entryFor(id, role, has));
  if ((opts.clinical && isFrontOffice(role)) || (opts.roles && !opts.roles.includes(role))) redirect(sectionHref(id, section));
  return { patient, ...session };
}

/** Page title for a profile route: "Kabir Malhotra · Medical". */
export function profileTitle(id: string, label: string) {
  const p = patientById(id);
  return p ? `${p.name} · ${label}` : "Patient";
}

/** Keep the query string when forwarding an old URL (`/notes?new=1` → `/medical?new=1`). */
export function withQuery(path: string, searchParams: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else if (v !== undefined) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
