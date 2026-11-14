import { useMemo } from "react";
import type { ClinicalDocument, Role } from "@/data/types";
import { DOCUMENTS } from "@/data/records";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { planById, type PlanId } from "@/data/plans";
import { useRole } from "@/components/shell/role-context";
import { createSessionStore, localId, useSessionStore } from "@/features/tasks/session-store";
import { NOW_ISO } from "@/features/tasks/time";
import { logAudit } from "@/features/settings/audit";
import { SEEDED_REVIEWS, type DocReview } from "./data";

/**
 * Documents = fixtures + uploads/routing/reviews made in this browser session (nothing uploaded).
 * Every document carries its type, patient, date issued, date uploaded, uploader and review status.
 */
export type DocSource = ClinicalDocument["source"] | "Staff upload";

export interface CareDocument extends Omit<ClinicalDocument, "source"> {
  source: DocSource;
  review?: DocReview;
  fileName?: string;
  fileSize?: number;
  local?: boolean;
  /** documents are never deleted — archiving hides them from the queues and is logged */
  archived?: { by: string; at: string };
}

interface DocState {
  created: CareDocument[];
  patches: Record<string, Partial<CareDocument>>;
}

const SEED: DocState = { created: [], patches: {} };
export const documentStore = createSessionStore<DocState>("carelane.care.documents.v2", SEED);

const BASE: CareDocument[] = DOCUMENTS.map((d) => ({ ...d, review: SEEDED_REVIEWS[d.id] }));

/**
 * How a fixture document entered Carelane on this plan. Reports from partner labs arriving on
 * their own are the lab-integrations add-on and email import isn't a channel, so those reports are
 * shown as uploaded by hand. Patient uploads need the patient app (Pro); on Core and Clinic the
 * patient hands the report in and the desk scans it. Without Reception (Core) the admin scans.
 */
function asUploadedOnPlan(d: CareDocument, plan: PlanId): CareDocument {
  const p = planById(plan);
  const desk = staffById(p.roles.includes("frontdesk") ? "s-sneha" : "s-neha")?.name ?? "Front desk";
  if (d.local) return d;
  if (d.source === "Lab partner") return { ...d, source: "Front desk scan", uploadedBy: desk };
  if (d.source === "Email import") return { ...d, source: "Staff upload", uploadedBy: staffById(d.reviewerId ?? undefined)?.name ?? desk };
  if (d.source === "Patient upload" && !p.features.includes("portal")) return { ...d, source: "Front desk scan", uploadedBy: desk };
  if (d.source === "Front desk scan") return { ...d, uploadedBy: desk };
  return d;
}

export function useDocuments(): CareDocument[] {
  const s = useSessionStore(documentStore);
  const { plan } = useRole();
  return useMemo(() => [...s.created, ...BASE].map((d) => asUploadedOnPlan(s.patches[d.id] ? { ...d, ...s.patches[d.id] } : d, plan)), [s, plan]);
}

export function patchDocument(id: string, patch: Partial<CareDocument>) {
  documentStore.update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } } }));
}

export function addDocument(input: Omit<CareDocument, "id" | "uploadedAt" | "local">): CareDocument {
  const doc: CareDocument = { ...input, id: localId("doc"), uploadedAt: NOW_ISO, local: true };
  documentStore.update((s) => ({ ...s, created: [doc, ...s.created] }));
  return doc;
}

const auditLabel = (doc: CareDocument) => `${doc.type} · ${patientById(doc.patientId)?.name ?? "patient not matched"}`;

/** Archive (never delete). Recorded in the activity log with the file's type, not its contents. */
export function archiveDocument(doc: CareDocument, actorId: string) {
  patchDocument(doc.id, { archived: { by: actorId, at: NOW_ISO } });
  logAudit({ actorId, category: "document", action: "Archived a document", target: { kind: "document", id: doc.id, label: auditLabel(doc) }, scope: "metadata" });
}

export function restoreDocument(doc: CareDocument, actorId: string) {
  patchDocument(doc.id, { archived: undefined });
  logAudit({ actorId, category: "document", action: "Restored an archived document", target: { kind: "document", id: doc.id, label: auditLabel(doc) }, scope: "metadata" });
}

// ---------- queues ----------
/**
 * Intake (not matched to a patient, or matched but not yet confirmed — the admin's and Reception's
 * item) → awaiting review (the primary doctor's) → reviewed, or filed with no review needed.
 * Archived documents sit apart.
 */
export type DocQueue = "unmatched" | "review" | "done" | "archived";
export const DOC_QUEUES: DocQueue[] = ["unmatched", "review", "done", "archived"];
export const QUEUE_LABEL: Record<DocQueue, string> = { unmatched: "Intake", review: "Awaiting review", done: "Reviewed & filed", archived: "Archived" };

export const queueOf = (d: CareDocument): DocQueue => (d.archived ? "archived" : d.status === "unclassified" ? "unmatched" : d.status === "awaiting-review" ? "review" : "done");

/** One status phrase per document — never "reviewed" unless a doctor recorded a review. */
export function statusText(d: CareDocument): string {
  if (d.archived) return "Archived";
  if (d.status === "unclassified") return d.patientId ? "To confirm" : "Not matched";
  if (d.status === "awaiting-review") return "Awaiting review";
  return d.review ? "Reviewed" : "Filed · no review needed";
}

// ---------- roles (demo rules; real enforcement belongs on the server) ----------
/** Upload a report: doctor, nutritionist, admin, Reception — and the patient in the Pro app. Not yoga. */
export const UPLOAD_ROLES: Role[] = ["doctor", "nutritionist", "admin", "frontdesk", "patient"];
/** Match unmatched documents to a patient: the desk and the admin. */
export const MATCH_ROLES: Role[] = ["admin", "frontdesk"];
/** Archive: the people who file documents. */
export const ARCHIVE_ROLES: Role[] = ["doctor", "admin", "frontdesk"];

export type Access = "full" | "hidden" | "restricted";

/**
 * Who may read a document's clinical content. Admin and Reception see the file name and type only;
 * coordinators and yoga instructors don't read reports (instructors see precautions, not
 * diagnoses); nutritionists read reports for patients on their care team; restricted documents
 * open only for their assigned clinician.
 */
export function contentAccess(doc: CareDocument, role: Role, userId: string): Access {
  if (role === "patient") return doc.patientId === userId ? "full" : "hidden";
  if (doc.sensitivity === "restricted") return doc.reviewerId === userId ? "full" : "restricted";
  if (role === "doctor") return "full";
  if (role === "nutritionist") {
    const team = patientById(doc.patientId)?.careTeam;
    return team && Object.values(team).includes(userId) ? "full" : "hidden";
  }
  return "hidden";
}

export const displayTitle = (doc: CareDocument, access: Access) => (access === "restricted" ? "Restricted document" : doc.title);

/** Only the doctor the report is assigned to marks it reviewed. */
export const canReview = (doc: CareDocument, role: Role, userId: string) => role === "doctor" && doc.reviewerId === userId;

/** The reviewer for a new report: the patient's primary doctor. */
export const primaryDoctorOf = (patientId: string | null | undefined) => {
  const id = patientById(patientId)?.careTeam.doctor;
  return id ? staffById(id) : undefined;
};
