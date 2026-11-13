"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { ArrowSquareOut, CheckCircle, DownloadSimple, LockSimple } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { DOC_STATUS_LABEL } from "@/data/records";
import { clinicNumber } from "@/data/patients";
import { staffById } from "@/data/staff";
import { useRole } from "@/components/shell/role-context";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { DemoFlag } from "@/components/ui/misc";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime, relativeTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { recordHref, type RecordDocument } from "./data";
import { eventForDoc } from "./record-model";
import { clinicalAccess, roleLabel } from "./access";
import { REVIEW_OUTCOME_LABEL, updateRecord, useRecord, type ReviewOutcome } from "./store";

export const DOC_STATUS_TONE: Record<RecordDocument["status"], Tone> = {
  unclassified: "warning",
  "awaiting-review": "warning",
  reviewed: "success",
  filed: "neutral",
};

const OUTCOMES: { id: ReviewOutcome; hint: string }[] = [
  { id: "no-action", hint: "Values acknowledged; nothing further today." },
  { id: "discuss", hint: "Adds it to the agenda for the next consultation." },
  { id: "action", hint: "Records a follow-up task for you." },
  { id: "repeat", hint: "Flags the test to be repeated." },
];

const MS_DAY = 86_400_000;
const dateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

/** Effective status: a review recorded in this session overrides the seeded status. */
export function useEffectiveStatus() {
  const reviews = useRecord((s) => s.reviews);
  return useCallback((doc: RecordDocument): RecordDocument["status"] => (reviews[doc.id] ? "reviewed" : doc.status), [reviews]);
}

/** Due-by wording for documents waiting on review (overdue in the danger tone, with text). */
export function dueText(doc: RecordDocument, status: RecordDocument["status"]) {
  if (status !== "awaiting-review" || !doc.dueBy) return null;
  const due = new Date(doc.dueBy).getTime();
  const overdue = due < TODAY.getTime();
  const sameDay = formatDate(doc.dueBy) === formatDate(TODAY.toISOString());
  return { overdue, text: overdue ? `Overdue · was due ${formatDate(doc.dueBy, { day: "numeric", month: "short" })}` : sameDay ? `Due today, ${formatTime(doc.dueBy)}` : `Due ${formatDate(doc.dueBy, { weekday: "short", day: "numeric", month: "short" })}` };
}

/**
 * Document preview sheet. `beside` (used from the Notes split view) makes it non-modal: no
 * overlay, the note stays editable next to it, and clicking into the note doesn't close it.
 */
export function DocumentPreview({
  doc,
  patient,
  onOpenChange,
  side = "right",
  beside = false,
}: {
  doc: RecordDocument | null;
  patient: Patient;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  beside?: boolean;
}) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange} modal={!beside}>
      {doc ? <PreviewBody key={doc.id} doc={doc} patient={patient} side={side} beside={beside} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function PreviewBody({ doc, patient, side, beside, onClose }: { doc: RecordDocument; patient: Patient; side: "left" | "right"; beside: boolean; onClose: () => void }) {
  const { role, user } = useRole();
  const { toast } = useToast();
  const access = clinicalAccess(role, patient.id);
  const review = useRecord((s) => s.reviews[doc.id]);
  const status = review ? "reviewed" : doc.status;
  const due = dueText(doc, status);
  const event = eventForDoc(patient.id, doc);
  const reviewer = staffById(doc.reviewerId ?? undefined);
  const gapDays = Math.round((new Date(doc.uploadedAt).getTime() - new Date(doc.reportDate).getTime()) / MS_DAY);

  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [comment, setComment] = useState("");

  const record = () => {
    if (!outcome) return;
    updateRecord((s) => ({ ...s, reviews: { ...s.reviews, [doc.id]: { outcome, comment: comment.trim(), by: user.name, at: TODAY.toISOString() } } }));
    toast({
      title: "Review outcome recorded in this session",
      description: `${REVIEW_OUTCOME_LABEL[outcome]}.${outcome === "action" ? " The follow-up task is noted locally — nothing was assigned." : ""} Nothing was sent.`,
      tone: "success",
    });
  };

  const canReview = role === "doctor" && status === "awaiting-review";
  const labLink = doc.type === "Lab report" && !!event?.values?.length && access !== "none";

  return (
    <SheetContent
      side={side}
      className={cn("w-[min(640px,calc(100vw-16px))]", beside && "w-[min(480px,calc(100vw-16px))]")}
      onInteractOutside={beside ? (e) => e.preventDefault() : undefined}
      onOpenAutoFocus={beside ? (e) => e.preventDefault() : undefined}
      title={doc.title}
      description={`${doc.type} · ${doc.pages} ${doc.pages === 1 ? "page" : "pages"}${doc.local ? " · added in this session" : ""}`}
      footer={
        <>
          <Tip label="Original files aren't stored in this prototype">
            <span tabIndex={0} className="inline-flex rounded-full">
              <Button variant="ghost" leading={<DownloadSimple />} disabled>
                Download original
              </Button>
            </span>
          </Tip>
          {labLink ? (
            <Button asChild variant="secondary">
              <Link href={recordHref(patient.id, "labs")}>
                Open in Labs
                <ArrowSquareOut />
              </Link>
            </Button>
          ) : null}
          <Button variant="dark" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</StatusBadge>
          {due ? <span className={cn("text-xs", due.overdue ? "text-danger" : "text-muted")}>{due.text}</span> : null}
          {doc.sensitivity === "restricted" ? <StatusBadge tone="dark" dot={false}>Restricted</StatusBadge> : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-inner bg-canvas p-4 text-sm">
          <Meta label="Report date" value={formatDate(doc.reportDate)} hint="When the test or event happened" />
          <Meta label="Uploaded" value={dateTime(doc.uploadedAt)} hint={relativeTime(doc.uploadedAt)} />
          <Meta label="Source" value={doc.source} />
          <Meta label="Uploaded by" value={doc.uploadedBy} />
          <Meta
            label="Reviewer"
            value={
              reviewer ? (
                <span className="flex items-center gap-2">
                  <Avatar src={reviewer.avatar} name={reviewer.name} size="xs" />
                  {reviewer.name}
                </span>
              ) : (
                "Unassigned"
              )
            }
          />
          <Meta label="File" value={doc.fileName ?? `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`} mono />
        </dl>
        {gapDays > 30 ? (
          <p className="-mt-3 text-xs text-muted">
            Reported {formatDate(doc.reportDate, { month: "short", year: "numeric" })}, uploaded {formatDate(doc.uploadedAt, { day: "numeric", month: "short", year: "numeric" })} — filed by its report date, so it doesn&apos;t read as a new result.
          </p>
        ) : null}

        <section aria-label="Document preview">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm text-ink">Preview</h3>
            <DemoFlag>Synthetic preview — not the original</DemoFlag>
          </div>
          {access === "none" ? (
            <div className="flex flex-col items-center gap-3 rounded-inner bg-sunken px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink-2">
                <LockSimple size={22} aria-hidden="true" />
              </span>
              <p className="text-sm text-ink">Clinical contents are hidden for the {roleLabel(role)} role</p>
              <p className="max-w-[44ch] text-xs text-muted">You can still classify this document, check its dates and route it to the right reviewer.</p>
            </div>
          ) : (
            <div data-lenis-prevent className="flex flex-col gap-4 rounded-inner bg-sunken p-4">
              {Array.from({ length: Math.min(doc.pages, 3) }, (_, i) => (
                <FauxPage key={i} doc={doc} patient={patient} page={i + 1} values={i === 0 ? event?.values : undefined} summary={i === 0 ? event?.summary ?? doc.summary : undefined} sourceRef={event?.source} />
              ))}
              {doc.pages > 3 ? <p className="text-center text-xs text-muted">+ {doc.pages - 3} more pages in the original</p> : null}
            </div>
          )}
        </section>

        {review ? (
          <section className="rounded-inner bg-success-soft p-4">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
              Reviewed in this session — {REVIEW_OUTCOME_LABEL[review.outcome]}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              {review.by} · {dateTime(review.at)}
              {review.comment ? ` · “${review.comment}”` : ""}
            </p>
          </section>
        ) : canReview ? (
          <section aria-labelledby="review-heading" className="flex flex-col gap-3">
            <div>
              <h3 id="review-heading" className="text-sm text-ink">
                Review outcome
              </h3>
              <p className="mt-0.5 text-xs text-muted">Recorded in this browser session. Releasing results to the patient is a separate step.</p>
            </div>
            <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <legend className="sr-only">Review outcome</legend>
              {OUTCOMES.map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-inner p-3 transition-[background-color,box-shadow] duration-200",
                    outcome === o.id ? "bg-canvas shadow-[inset_0_0_0_1.5px_var(--color-charcoal)]" : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                  )}
                >
                  <input type="radio" name={`outcome-${doc.id}`} value={o.id} checked={outcome === o.id} onChange={() => setOutcome(o.id)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-charcoal)]" />
                  <span>
                    <span className="block text-sm text-ink">{REVIEW_OUTCOME_LABEL[o.id]}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment for the record (optional)" aria-label="Review comment" className="min-h-20" />
            <div className="flex items-center justify-end gap-3">
              {!outcome ? <span className="text-xs text-muted">Choose an outcome to record the review</span> : null}
              <Button variant="primary" disabled={!outcome} onClick={record} leading={<CheckCircle />}>
                Record outcome
              </Button>
            </div>
          </section>
        ) : status === "awaiting-review" ? (
          <p className="rounded-inner bg-canvas p-4 text-xs text-muted">
            Review is assigned to {reviewer?.name ?? "a doctor (unassigned)"}{due ? ` · ${due.text.toLowerCase()}` : ""}. Only the reviewing clinician records the outcome.
          </p>
        ) : null}
      </div>
    </SheetContent>
  );
}

function Meta({ label, value, hint, mono }: { label: string; value: ReactNode; hint?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-ink", mono && "font-mono text-xs leading-5")}>{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

/** A page of the synthetic document: built from divs, watermarked, never mistaken for the original. */
function FauxPage({
  doc,
  patient,
  page,
  values,
  summary,
  sourceRef,
}: {
  doc: RecordDocument;
  patient: Patient;
  page: number;
  values?: { label: string; value: string; unit?: string; flag?: "high" | "low" }[];
  summary?: string;
  sourceRef?: string;
}) {
  const issuer = doc.uploadedBy.startsWith("Lab partner · ") ? doc.uploadedBy.replace("Lab partner · ", "") : doc.source === "Clinic upload" ? "Prana Integrative Clinic" : doc.source;
  const bars = page === 1 ? [92, 84, 88, 60] : [96, 90, 94, 72, 88, 92, 64, 80, 86, 58];
  return (
    <article aria-label={`Page ${page} of ${doc.pages}`} className="relative mx-auto flex aspect-[1/1.3] w-full max-w-[520px] flex-col overflow-hidden rounded-[4px] bg-surface p-6 shadow-[0_1px_2px_rgb(33_38_34/0.08)]">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-[64px] font-light tracking-[0.2em] text-ink/[0.04] [transform:rotate(-24deg)]">
        PREVIEW
      </span>
      <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-md bg-charcoal" aria-hidden="true" />
          <span className="text-[11px] leading-tight text-ink">{issuer}</span>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {page} / {doc.pages}
        </span>
      </header>
      {page === 1 ? (
        <>
          <p className="mt-4 text-[13px] text-ink">{doc.title}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <dt className="text-muted">Patient</dt>
            <dd className="text-ink">{patient.name} · {patient.age} y · {patient.sex}</dd>
            <dt className="text-muted">Clinic no.</dt>
            <dd className="font-mono text-ink">{clinicNumber(patient.id)}</dd>
            <dt className="text-muted">Report date</dt>
            <dd className="text-ink">{formatDate(doc.reportDate)}</dd>
            {sourceRef ? (
              <>
                <dt className="text-muted">Reference</dt>
                <dd className="truncate font-mono text-ink">{sourceRef}</dd>
              </>
            ) : null}
          </dl>
          {values?.length ? (
            <table className="mt-4 w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="pb-1 font-normal">Test</th>
                  <th scope="col" className="pb-1 text-right font-normal">Result</th>
                  <th scope="col" className="pb-1 pl-3 font-normal">Unit</th>
                  <th scope="col" className="pb-1 pl-3 font-normal">Flag</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v) => (
                  <tr key={v.label} className="border-t border-line">
                    <td className="py-1 text-ink">{v.label}</td>
                    <td className="py-1 text-right text-ink tabular">{v.value}</td>
                    <td className="py-1 pl-3 text-muted">{v.unit ?? "—"}</td>
                    <td className={cn("py-1 pl-3", v.flag === "high" ? "text-danger" : v.flag === "low" ? "text-warning" : "text-muted")}>{v.flag === "high" ? "High" : v.flag === "low" ? "Low" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {summary ? <p className="mt-4 text-[11px] leading-relaxed text-ink-2">{summary}</p> : null}
        </>
      ) : null}
      <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
        {bars.map((w, i) => (
          <span key={i} className="h-2 rounded-full bg-sunken" style={{ width: `${w}%` }} />
        ))}
      </div>
      <footer className="mt-auto flex items-end justify-between gap-3 pt-4">
        <span className="text-[11px] text-muted">Synthetic preview — not the original document</span>
        <span className="h-5 w-24 border-b border-line-strong" aria-hidden="true" />
      </footer>
    </article>
  );
}
