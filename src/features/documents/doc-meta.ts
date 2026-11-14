import type { Icon } from "@phosphor-icons/react";
import { EnvelopeSimple, FileText, Flask, Pill, Printer, Scan, Signature, UploadSimple, User } from "@phosphor-icons/react";
import type { ClinicalDocument, DocStatus } from "@/data/types";
import type { Tone } from "@/components/ui/status";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { TODAY_KEY, dayDiff, dayKey, shortDay } from "@/features/tasks/time";
import type { CareDocument, DocSource } from "./store";

/** Labels, icons and date wording for the document intake & review inbox. */
export const docStatusTone = (s: DocStatus): Tone => ({ unclassified: "warning", "awaiting-review": "info", reviewed: "success", filed: "neutral" } as const)[s];

export const DOC_TYPES: ClinicalDocument["type"][] = ["Lab report", "Imaging", "Discharge summary", "Prescription", "Referral letter", "Consent form"];

export const TYPE_ICON: Record<ClinicalDocument["type"], Icon> = {
  "Lab report": Flask,
  Imaging: Scan,
  "Discharge summary": FileText,
  Prescription: Pill,
  "Referral letter": EnvelopeSimple,
  "Consent form": Signature,
};

/** Short channel names. "Lab partner" and "Email import" never show — see `asUploadedOnPlan`. */
export const SOURCE_SHORT: Record<DocSource, string> = {
  "Patient upload": "Patient app",
  "Front desk scan": "Scanned",
  "Lab partner": "Scanned",
  "Email import": "Staff",
  "Staff upload": "Staff",
};

export const SOURCE_ICON: Record<DocSource, Icon> = {
  "Patient upload": User,
  "Front desk scan": Printer,
  "Lab partner": Flask,
  "Email import": EnvelopeSimple,
  "Staff upload": UploadSimple,
};

/** Date issued vs upload date: flag old reports so they never read as new results. */
export function reportLag(doc: Pick<CareDocument, "reportDate" | "uploadedAt">): { days: number; label: string } | null {
  const days = dayDiff(doc.reportDate, dayKey(doc.uploadedAt));
  if (days < 30) return null;
  const years = Math.floor(days / 365);
  const months = Math.floor(days / 30);
  return { days, label: years >= 1 ? `${years} ${years === 1 ? "year" : "years"} before upload` : `${months} ${months === 1 ? "month" : "months"} before upload` };
}

export function docDue(doc: Pick<CareDocument, "dueBy" | "status">): { text: string; tone: "danger" | "ink" | "muted" } {
  if (!doc.dueBy || doc.status === "reviewed" || doc.status === "filed") return { text: "—", tone: "muted" };
  const diff = dayDiff(TODAY_KEY, dayKey(doc.dueBy));
  if (new Date(doc.dueBy).getTime() < TODAY.getTime()) return { text: diff === 0 ? `Overdue · since ${formatTime(doc.dueBy)}` : `Overdue · ${-diff} ${diff === -1 ? "day" : "days"}`, tone: "danger" };
  if (diff === 0) return { text: `Today · ${formatTime(doc.dueBy)}`, tone: "ink" };
  if (diff === 1) return { text: `Tomorrow · ${formatTime(doc.dueBy)}`, tone: "ink" };
  return { text: shortDay(doc.dueBy), tone: "muted" };
}

export const reportDateText = (key: string) => formatDate(`${key}T12:00:00+05:30`);
export const uploadedText = (iso: string) => `${formatDate(iso, { day: "numeric", month: "short" })}${iso.startsWith("2026") ? "" : ` ${formatDate(iso, { year: "numeric" })}`}, ${formatTime(iso)}`;
