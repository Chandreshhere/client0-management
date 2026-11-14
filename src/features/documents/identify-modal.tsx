"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, ShieldCheck } from "@phosphor-icons/react";
import type { ClinicalDocument, DocStatus } from "@/data/types";
import { PATIENTS, clinicNumber, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Select, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { staffOptions } from "@/features/tasks/people";
import { RedactedLines } from "@/features/tasks/ui";
import { TODAY_KEY, addDays, isoAt, shortDay } from "@/features/tasks/time";
import { DOC_CONTENT, INTAKE_HINTS } from "./data";
import { DOC_TYPES, SOURCE_ICON, SOURCE_SHORT, TYPE_ICON, uploadedText } from "./doc-meta";
import { contentAccess, patchDocument, type CareDocument } from "./store";

/**
 * Match an unmatched document to a patient (admin / Reception): confirm the type and date issued;
 * reports then go to the patient's primary doctor for review. Done without reading the content.
 */
export function IdentifyModal({ doc, onClose, onRouted }: { doc: CareDocument | null; onClose: () => void; onRouted: (d: CareDocument, status: DocStatus) => void }) {
  const [shown, setShown] = useState<CareDocument | null>(doc);
  if (doc && doc !== shown) setShown(doc);
  const d = doc ?? shown;
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      {d ? <IdentifyBody key={d.id} doc={d} onClose={onClose} onRouted={onRouted} /> : null}
    </Dialog>
  );
}

function IdentifyBody({ doc, onClose, onRouted }: { doc: CareDocument; onClose: () => void; onRouted: (d: CareDocument, status: DocStatus) => void }) {
  const { role, user } = useRole();
  const { toast } = useToast();
  const hint = INTAKE_HINTS[doc.id];
  const access = contentAccess(doc, role, user.id);
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState<string | null>(doc.patientId);
  const [type, setType] = useState<ClinicalDocument["type"]>(doc.type);
  const [reportDate, setReportDate] = useState(doc.reportDate);
  const [needsReview, setNeedsReview] = useState(doc.type !== "Consent form");
  const [reviewerId, setReviewerId] = useState<string>("");
  const [due, setDue] = useState(addDays(TODAY_KEY, 1));
  const [errors, setErrors] = useState<{ patient?: string; date?: string; reviewer?: string }>({});

  // The reviewer is the matched patient's primary doctor.
  useEffect(() => {
    setReviewerId(patientById(patientId)?.careTeam.doctor ?? "");
  }, [patientId]);

  const q = query.trim().toLowerCase();
  const candidates = useMemo(() => {
    const digits = q.replace(/\D/g, "");
    const list = q
      ? PATIENTS.filter((p) => `${p.name} ${p.area} ${clinicNumber(p.id)}`.toLowerCase().includes(q) || (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits)))
      : PATIENTS.filter((p) => p.id === hint?.suggest || p.id === patientId);
    const suggested = hint?.suggest ? PATIENTS.find((p) => p.id === hint.suggest) : undefined;
    const ordered = suggested && list.includes(suggested) ? [suggested, ...list.filter((p) => p !== suggested)] : list;
    return ordered.slice(0, 5);
  }, [q, hint?.suggest, patientId]);

  const submit = () => {
    const next: typeof errors = {};
    if (!patientId) next.patient = "Match the document to a patient first.";
    if (!reportDate) next.date = "Enter the date printed on the report.";
    else if (reportDate > TODAY_KEY) next.date = "The date issued can't be in the future.";
    if (needsReview && !reviewerId) next.reviewer = "Choose who reviews it.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const status: DocStatus = needsReview ? "awaiting-review" : "filed";
    patchDocument(doc.id, {
      patientId,
      type,
      reportDate,
      reviewerId: needsReview ? reviewerId : doc.reviewerId,
      dueBy: needsReview ? isoAt(due, "18:00") : null,
      status,
      title: doc.patientId === null ? `${type} (scanned)` : doc.title,
    });
    const reviewer = staffById(reviewerId);
    const patient = patientById(patientId);
    onRouted(doc, status);
    toast({
      title: needsReview ? `Matched · sent to ${reviewer?.name} for review` : `Matched · filed to ${patient?.name}'s record`,
      description: `Saved in this browser session${needsReview ? ` — ${reviewer?.name} wasn't notified` : ""}.`,
      tone: "success",
    });
  };

  const TypeIcon = TYPE_ICON[doc.type];
  const SourceIcon = SOURCE_ICON[doc.source];

  return (
    <ModalContent
      title={doc.patientId ? "Confirm & file" : "Match to a patient"}
      description="Find the patient, confirm the type and the date issued. Reports then go to the patient's primary doctor for review."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" onClick={submit}>
            {needsReview ? `Match & send to ${staffById(reviewerId)?.name ?? "doctor"}` : "Match & file"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 rounded-inner bg-canvas p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-2">
              <TypeIcon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-ink">{doc.pages} {doc.pages === 1 ? "page" : "pages"}</p>
              <p className="truncate text-xs text-muted">{doc.type}</p>
            </div>
          </div>
          <dl className="flex flex-col gap-2 text-xs">
            <div>
              <dt className="text-muted">Uploaded</dt>
              <dd className="text-ink tabular">{uploadedText(doc.uploadedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Source</dt>
              <dd className="inline-flex items-center gap-1.5 text-ink">
                <SourceIcon size={14} aria-hidden="true" />
                {SOURCE_SHORT[doc.source]} · {doc.uploadedBy}
              </dd>
            </div>
          </dl>
          {hint ? <p className="rounded-inner bg-surface p-3 text-xs leading-relaxed text-ink-2">{hint.note}</p> : null}
          <div className="rounded-inner bg-surface p-3">
            {access === "full" ? (
              <>
                <p className="text-[11px] text-muted">Preview</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{DOC_CONTENT[doc.id]?.summary ?? "No preview available."}</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-xs text-ink">
                  <ShieldCheck size={14} className="text-success" aria-hidden="true" />
                  Content hidden
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">You see the file name and type only. Clinical content opens for the patient&apos;s care team.</p>
                <RedactedLines lines={5} className="mt-3" />
              </>
            )}
          </div>
        </aside>

        <form
          noValidate
          className="flex min-w-0 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <section>
            <h3 className="text-sm text-ink">1 · Match the patient</h3>
            <SearchInput
              className="mt-3"
              placeholder="Name, phone digits or clinic number"
              aria-label="Search patients"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-invalid={errors.patient ? true : undefined}
            />
            <ul role="radiogroup" aria-label="Matching patients" className="mt-2 flex flex-col gap-1">
              {candidates.map((p) => {
                const active = p.id === patientId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setPatientId(p.id);
                        setErrors((x) => ({ ...x, patient: undefined }));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-inner p-3 text-left transition-[background-color,box-shadow] duration-200",
                        active ? "bg-surface shadow-[inset_0_0_0_2px_var(--color-charcoal)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                      )}
                    >
                      <Avatar src={p.avatar} name={p.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{p.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.age} · {p.sex} · {p.area} · <span className="font-mono">{clinicNumber(p.id)}</span>
                        </span>
                      </span>
                      {p.id === hint?.suggest && !active ? <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">Matches cover sheet</span> : null}
                      {active ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
                          <Check size={12} weight="bold" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {candidates.length === 0 ? <li className="px-3 py-4 text-sm text-muted">{q ? "No patient matches — check the spelling or search by phone digits." : "Search to find the patient."}</li> : null}
            </ul>
            {errors.patient ? <p className="mt-2 text-xs text-danger">{errors.patient}</p> : null}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
              Confirm with a second identifier — a shared phone number is never enough to match.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h3 className="text-sm text-ink sm:col-span-2">2 · Classify</h3>
            <Field label="Document type">
              {(p) => <Select {...p} value={type} onValueChange={(v) => { setType(v as ClinicalDocument["type"]); if (v === "Consent form") setNeedsReview(false); }} options={DOC_TYPES.map((t) => ({ value: t, label: t }))} />}
            </Field>
            <Field label="Date issued" error={errors.date} hint="Printed on the report — not the upload date.">
              {(p) => <Input {...p} type="date" max={TODAY_KEY} value={reportDate} onChange={(e) => { setReportDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} />}
            </Field>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <h3 className="text-sm text-ink">3 · Review</h3>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                Needs a doctor&apos;s review
                <Switch checked={needsReview} onCheckedChange={setNeedsReview} aria-label="Needs clinical review" />
              </label>
            </div>
            {needsReview ? (
              <>
                <Field label="Reviewer" error={errors.reviewer} hint={patientById(patientId)?.careTeam.doctor === reviewerId && reviewerId ? "Primary doctor" : "No primary doctor on record — choose one"}>
                  {(p) => <Select {...p} value={reviewerId} onValueChange={setReviewerId} placeholder="Choose a doctor" options={staffOptions((s) => s.role === "doctor")} />}
                </Field>
                <Field label="Review by" hint={`Due ${shortDay(isoAt(due, "18:00"))}, 18:00`}>
                  {(p) => <Input {...p} type="date" min={TODAY_KEY} value={due} onChange={(e) => setDue(e.target.value)} />}
                </Field>
              </>
            ) : (
              <p className="rounded-inner bg-canvas p-3 text-xs text-ink-2 sm:col-span-2">It will be filed straight to {patientById(patientId)?.name ?? "the patient"}&apos;s record with no review task.</p>
            )}
          </section>
          <button type="submit" className="sr-only">
            Route
          </button>
        </form>
      </div>
    </ModalContent>
  );
}
