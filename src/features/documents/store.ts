import { useMemo } from "react";
import type { ClinicalDocument, Role } from "@/data/types";
import { DOCUMENTS } from "@/data/records";
import { patientById } from "@/data/patients";
import { createSessionStore, localId, useSessionStore } from "@/features/tasks/session-store";
import { NOW_ISO } from "@/features/tasks/time";
import { SEEDED_REVIEWS, type DocReview } from "./data";

/** Documents = fixtures + uploads/routing/reviews made in this browser session (nothing uploaded). */
export type DocSource = ClinicalDocument["source"] | "Staff upload";

export interface CareDocument extends Omit<ClinicalDocument, "source"> {
  source: DocSource;
  review?: DocReview;
  fileName?: string;
  fileSize?: number;
  local?: boolean;
}

interface DocState {
  created: CareDocument[];
  patches: Record<string, Partial<CareDocument>>;
}

const SEED: DocState = { created: [], patches: {} };
export const documentStore = createSessionStore<DocState>("carelane.care.documents.v1", SEED);

const BASE: CareDocument[] = DOCUMENTS.map((d) => ({ ...d, review: SEEDED_REVIEWS[d.id] }));

export function useDocuments(): CareDocument[] {
  const s = useSessionStore(documentStore);
  return useMemo(() => [...s.created, ...BASE].map((d) => (s.patches[d.id] ? { ...d, ...s.patches[d.id] } : d)), [s]);
}

export function patchDocument(id: string, patch: Partial<CareDocument>) {
  documentStore.update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } } }));
}

export function addDocument(input: Omit<CareDocument, "id" | "uploadedAt" | "local">): CareDocument {
  const doc: CareDocument = { ...input, id: localId("doc"), uploadedAt: NOW_ISO, local: true };
  documentStore.update((s) => ({ ...s, created: [doc, ...s.created] }));
  return doc;
}

// ---------- access (demo rules; real enforcement belongs on the server) ----------
export type Access = "full" | "hidden" | "restricted";

/**
 * Who may read a document's clinical content. Front desk, coordinators and admins route documents
 * without reading them; restricted documents open only for their assigned clinician.
 */
export function contentAccess(doc: CareDocument, role: Role, userId: string): Access {
  if (role === "patient") return doc.patientId === userId ? "full" : "hidden";
  if (doc.sensitivity === "restricted") return doc.reviewerId === userId ? "full" : "restricted";
  if (role === "doctor") return "full";
  if (role === "nutritionist" || role === "yoga") {
    const team = patientById(doc.patientId)?.careTeam;
    return team && Object.values(team).includes(userId) ? "full" : "hidden";
  }
  return "hidden";
}

export const displayTitle = (doc: CareDocument, access: Access) => (access === "restricted" ? "Restricted document" : doc.title);

export const canReview = (doc: CareDocument, role: Role, userId: string) => (role === "doctor" || role === "nutritionist") && doc.reviewerId === userId;
