import { createPortalStore, localId } from "../store";
import { nowIso } from "../time";

/** Reports the patient adds and requests they make. Kept in this browser tab only (nothing is uploaded or sent). */
export type UploadType = "Lab report" | "Imaging" | "Discharge summary" | "Prescription" | "Other";

export interface Upload {
  id: string;
  title: string;
  type: UploadType;
  /** when the test happened (required, never the upload date) */
  reportDate: string;
  uploadedAt: string;
  fileName: string;
  fileSize: number;
  where?: string;
  systemId?: string;
  note?: string;
}

export type RequestKind = "copy" | "correction" | "access-log";

export interface AccessRequest {
  id: string;
  kind: RequestKind;
  recordId?: string;
  recordTitle?: string;
  detail?: string;
  delivery?: string;
  at: string;
}

export interface RecordsState {
  uploads: Upload[];
  requests: AccessRequest[];
}

export const recordsStore = createPortalStore<RecordsState>("carelane.portal.records.v1", { uploads: [], requests: [] });

export function addUpload(u: Omit<Upload, "id" | "uploadedAt">): Upload {
  const upload: Upload = { ...u, id: localId("upload"), uploadedAt: nowIso() };
  recordsStore.update((s) => ({ ...s, uploads: [upload, ...s.uploads] }));
  return upload;
}
export const removeUpload = (id: string) => recordsStore.update((s) => ({ ...s, uploads: s.uploads.filter((u) => u.id !== id) }));

export function addRequest(r: Omit<AccessRequest, "id" | "at">): AccessRequest {
  const req: AccessRequest = { ...r, id: localId("request"), at: nowIso() };
  recordsStore.update((s) => ({ ...s, requests: [req, ...s.requests] }));
  return req;
}
export const withdrawRequest = (id: string) => recordsStore.update((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== id) }));
