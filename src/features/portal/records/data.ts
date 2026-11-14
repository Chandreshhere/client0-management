import { RECORD_STATE_LABEL, type CareEvent } from "@/data/featured";
import { DOCUMENTS, DOC_STATUS_LABEL } from "@/data/records";
import { staffById } from "@/data/staff";
import type { ClinicalDocument } from "@/data/types";
import { FILED_DOCUMENTS, ME, PATIENT_ID, PRIMARY_SYSTEM, SUMMARIES, WITHHELD, authorName, authorRole, type LabResult } from "../record";

/** One row in "Visit notes, letters & prescriptions": a released event or a filed document. */
export type RowKind = "visit" | "letter" | "prescription" | "plan";

export const ROW_KIND_LABEL: Record<RowKind, string> = {
  visit: "Visit notes",
  letter: "Letters & reports",
  prescription: "Prescriptions",
  plan: "Care plans",
};

export interface RecordRow {
  id: string;
  kind: RowKind;
  /** when it happened */
  date: string;
  /** when it was added to the record */
  enteredAt: string;
  title: string;
  summary: string;
  author: string;
  authorId?: string;
  role: string;
  state: string;
  source: string;
  systemId: string;
  event?: CareEvent;
  doc?: ClinicalDocument;
}

const kindOf = (e: CareEvent): RowKind => (e.type === "medication" ? "prescription" : e.type === "nutrition" ? "plan" : e.type === "document" ? "letter" : "visit");

/** Display row for any released event (summaries list, imaging cards, lab reports). */
export const rowFromEvent = (e: CareEvent): RecordRow => ({
  id: e.id,
  kind: kindOf(e),
  date: e.date,
  enteredAt: e.enteredAt,
  title: e.title,
  summary: e.summary,
  author: authorName(e),
  authorId: staffById(e.authorId) ? e.authorId : undefined,
  role: authorRole(e),
  state: RECORD_STATE_LABEL[e.state],
  source: e.source,
  systemId: e.systemId,
  event: e,
});

/** How a filed document reached the record, in the patient's words (lab feeds are an add-on, so never "sent by the lab"). */
const HOW_ADDED: Record<ClinicalDocument["source"], string> = {
  "Patient upload": "uploaded by you",
  "Front desk scan": "scanned at reception",
  "Lab partner": "outside lab report, added by the clinic",
  "Email import": "received by email",
};

export const ROWS: RecordRow[] = [
  ...SUMMARIES.map(rowFromEvent),
  ...FILED_DOCUMENTS.map(
    (d): RecordRow => ({
      id: d.id,
      kind: d.type === "Prescription" ? "prescription" : "letter",
      date: d.reportDate,
      enteredAt: d.uploadedAt,
      title: d.title,
      summary: `${d.type} · ${d.pages} ${d.pages === 1 ? "page" : "pages"} · ${HOW_ADDED[d.source]}`,
      author: staffById(d.reviewerId ?? undefined)?.name ?? d.uploadedBy,
      authorId: d.reviewerId ?? undefined,
      role: "Reviewed and filed",
      state: DOC_STATUS_LABEL[d.status],
      source: `Document ${d.id.toUpperCase()}`,
      systemId: PRIMARY_SYSTEM.id,
      doc: d,
    }),
  ),
].sort((a, b) => b.date.localeCompare(a.date) || b.enteredAt.localeCompare(a.enteredAt));

/** Who is reviewing a withheld report: the matching document's reviewer, else the patient's doctor. */
export function reviewerOf(e: CareEvent) {
  const doc = DOCUMENTS.find((d) => d.patientId === PATIENT_ID && d.reportDate === e.date && d.title.toLowerCase() === e.title.toLowerCase());
  return staffById(doc?.reviewerId ?? ME.careTeam.doctor);
}

export const PENDING = WITHHELD.map((e) => ({ event: e, reviewer: reviewerOf(e) }));

const num = (n: number) => (Math.abs(n) < 1 && n !== 0 ? n.toFixed(2) : String(n));

/** "< 70 (target)" → "Your target: below 70 mg/dL"; "13.5 – 17.5" → "Usual range 13.5–17.5 g/dL". */
export function plainRange(l: LabResult) {
  const u = l.unit ? ` ${l.unit}` : "";
  if (l.low !== undefined && l.high !== undefined) return `Usual range ${num(l.low)}–${num(l.high)}${u}`;
  if (l.high !== undefined) return `${/target/i.test(l.range) ? "Your target" : "Healthy"}: below ${num(l.high)}${u}`;
  if (l.low !== undefined) return `Healthy: ${num(l.low)}${u} or above`;
  return l.range;
}
