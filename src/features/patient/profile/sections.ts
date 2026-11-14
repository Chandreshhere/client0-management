import type { Role } from "@/data/types";
import type { FeatureId } from "@/data/plans";

/**
 * The patient profile (spec "Patient profile", F1, rule 3): five sections in a fixed order plus
 * the Timeline. Each role sees only the sections it acts on, and the profile opens on the
 * section for the role. Pure — used by server pages (redirects), the header tabs and the views.
 */
export type SectionId = "summary" | "medical" | "reports" | "nutrition" | "yoga" | "timeline";

export const SECTION_ORDER: SectionId[] = ["summary", "medical", "reports", "nutrition", "yoga", "timeline"];

const LABEL: Record<SectionId, string> = {
  summary: "Summary",
  medical: "Medical",
  reports: "Reports",
  nutrition: "Nutrition",
  yoga: "Yoga",
  timeline: "Timeline",
};

/** Plan feature each section needs (all are Core today; kept so a plan can never show more). */
const FEATURE: Record<SectionId, FeatureId> = {
  summary: "overview",
  medical: "notes",
  reports: "documents",
  nutrition: "nutrition",
  yoga: "classes",
  timeline: "overview",
};

/**
 * Sections per role (spec "Roles and access"):
 * - Doctor: the whole record.
 * - Nutritionist: full nutrition; read-only notes, conditions, allergies, medicines, reports.
 * - Yoga instructor: precautions, goals, sessions, progress — no diagnoses.
 * - Care coordinator: status of assignments, follow-ups and attendance.
 * - Admin, Reception: demographics and documents by file name and type only.
 */
const ACCESS: Record<Role, SectionId[]> = {
  doctor: ["summary", "medical", "reports", "nutrition", "yoga", "timeline"],
  nutritionist: ["summary", "medical", "reports", "nutrition", "timeline"],
  yoga: ["yoga", "timeline"],
  coordinator: ["summary", "timeline"],
  admin: ["summary", "reports"],
  frontdesk: ["summary", "reports"],
  patient: [],
};

/** Roles that see demographics only (no clinical content). */
export const isFrontOffice = (role: Role) => role === "admin" || role === "frontdesk";

export function sectionLabel(role: Role | undefined, id: SectionId) {
  if (role && isFrontOffice(role)) {
    if (id === "summary") return "Profile";
    if (id === "reports") return "Documents";
  }
  return LABEL[id];
}

export function sectionsFor(role: Role | undefined, has: (f: FeatureId) => boolean): SectionId[] {
  const allowed = role ? ACCESS[role] : SECTION_ORDER;
  return SECTION_ORDER.filter((s) => allowed.includes(s) && has(FEATURE[s]));
}

export const canOpenSection = (role: Role, has: (f: FeatureId) => boolean, id: SectionId) => sectionsFor(role, has).includes(id);

/** F1: the profile opens on the section for your role. */
export function defaultSectionFor(role: Role, has: (f: FeatureId) => boolean): SectionId | null {
  const allowed = sectionsFor(role, has);
  const preferred: SectionId = role === "nutritionist" ? "nutrition" : role === "yoga" ? "yoga" : "summary";
  return allowed.includes(preferred) ? preferred : (allowed[0] ?? null);
}

export const sectionHref = (patientId: string, id: SectionId, sub?: string) => `/patients/${patientId}/${id}${sub ? `/${sub}` : ""}`;

/** Sub-views inside a section (Medical and Reports keep their existing pages as sub-views). */
export const SUB_VIEWS: Partial<Record<SectionId, { sub?: string; label: string }[]>> = {
  medical: [
    { label: "Notes" },
    { sub: "conditions", label: "Conditions & medicines" },
    { sub: "vitals", label: "Vital signs" },
  ],
  reports: [
    { label: "All reports" },
    { sub: "labs", label: "Lab results" },
    { sub: "imaging", label: "Imaging" },
  ],
};

/** Earlier URLs (before the five-section profile) → the section that now holds them. */
export const LEGACY_SECTION: Record<string, SectionId> = {
  overview: "summary",
  journey: "timeline",
  notes: "medical",
  vitals: "medical",
  documents: "reports",
  labs: "reports",
  imaging: "reports",
};

/** Which section a profile pathname belongs to (`/patients/p-kabir/medical/vitals` → medical). */
export function sectionOfPath(pathname: string): SectionId | null {
  const seg = pathname.split("/")[3];
  if (!seg) return null;
  if ((SECTION_ORDER as string[]).includes(seg)) return seg as SectionId;
  return LEGACY_SECTION[seg] ?? null;
}
