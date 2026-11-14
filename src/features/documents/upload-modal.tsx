"use client";

import { useEffect, useId, useState, type DragEvent } from "react";
import { CloudArrowUp, FilePdf, FileImage, X } from "@phosphor-icons/react";
import type { ClinicalDocument } from "@/data/types";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { AddOnNotice } from "@/components/shell/plan-switcher";
import { patientOptions, staffOptions } from "@/features/tasks/people";
import { TODAY_KEY, addDays, isoAt } from "@/features/tasks/time";
import { DOC_TYPES } from "./doc-meta";
import { addDocument, primaryDoctorOf, type CareDocument, type DocSource } from "./store";

const MAX_MB = 20;
const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];
type Picked = { name: string; size: number; type: string };

const formatSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Upload a report (F4, ?upload=1): file + type + date issued; the upload date is recorded
 * automatically. It goes to the patient's primary doctor for review (consent forms are filed with
 * no review). Nothing leaves the browser: the file's name and size are kept, never its bytes.
 */
export function UploadModal({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: (d: CareDocument) => void }) {
  const { role, user } = useRole();
  const { toast } = useToast();
  const isPatient = role === "patient";
  const inputId = useId();
  const [file, setFile] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ClinicalDocument["type"] | "">("");
  const [reportDate, setReportDate] = useState("");
  const [patientId, setPatientId] = useState(isPatient ? user.id : "");
  const [fallbackReviewer, setFallbackReviewer] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [errors, setErrors] = useState<{ file?: string; type?: string; date?: string; patient?: string; reviewer?: string }>({});
  const primary = primaryDoctorOf(patientId);
  const reviewerId = primary?.id ?? fallbackReviewer;
  const needsReview = type !== "Consent form";

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle("");
    setType("");
    setReportDate("");
    setPatientId(isPatient ? user.id : "");
    setFallbackReviewer("");
    setRestricted(false);
    setErrors({});
  }, [open, isPatient, user.id]);

  const take = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      setErrors((x) => ({ ...x, file: "Only PDF, JPG or PNG files can be added." }));
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrors((x) => ({ ...x, file: `That file is over ${MAX_MB} MB.` }));
      return;
    }
    setFile({ name: f.name, size: f.size, type: f.type });
    setErrors((x) => ({ ...x, file: undefined }));
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files?.[0]);
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!file) next.file = "Add the file — drop it here, choose one, or use the sample.";
    if (!type) next.type = "Choose what kind of document this is.";
    if (!reportDate) next.date = "Enter the date printed on the document.";
    else if (reportDate > TODAY_KEY) next.date = "The date issued can't be in the future.";
    if (!patientId) next.patient = "Choose whose record this belongs to.";
    else if (needsReview && !reviewerId) next.reviewer = "This patient has no primary doctor yet — choose who reviews it.";
    setErrors(next);
    if (Object.keys(next).length || !file || !type) return;
    const source: DocSource = isPatient ? "Patient upload" : role === "frontdesk" || role === "admin" ? "Front desk scan" : "Staff upload";
    const doc = addDocument({
      title: title.trim() || file.name.replace(/\.[a-z0-9]+$/i, ""),
      patientId,
      type,
      reportDate,
      uploadedBy: user.name,
      source,
      reviewerId: needsReview ? reviewerId : null,
      dueBy: needsReview ? isoAt(addDays(TODAY_KEY, 1), "18:00") : null,
      status: needsReview ? "awaiting-review" : "filed",
      sensitivity: restricted ? "restricted" : "standard",
      pages: 1,
      fileName: file.name,
      fileSize: file.size,
    });
    onOpenChange(false);
    onAdded(doc);
    const reviewer = staffById(reviewerId);
    toast({
      title: needsReview ? `Sent to ${reviewer?.name ?? "the doctor"} for review` : "Filed to the record",
      description: `Stored in this browser only — nothing was uploaded${needsReview ? ` and ${reviewer?.name ?? "the doctor"} wasn't notified` : ""}.`,
      tone: "success",
    });
  };

  const FileIcon = file?.type === "application/pdf" ? FilePdf : FileImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={isPatient ? "Upload a report" : "Upload report"}
        description="Add the date the report was issued. Today's upload date is recorded automatically, so an old report never looks like a new result."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              {needsReview ? "Upload for review" : "Upload"}
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="sm:col-span-2">
            {file ? (
              <div className="flex items-center gap-3 rounded-inner bg-canvas p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-2">
                  <FileIcon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-ink">{file.name}</p>
                  <p className="text-xs text-muted">{formatSize(file.size)} · kept in this browser, not uploaded</p>
                </div>
                <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label
                htmlFor={inputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-inner border border-dashed px-6 py-8 text-center transition-[background-color,border-color] duration-200",
                  dragging ? "border-primary bg-primary-soft" : errors.file ? "border-danger bg-danger-soft/40" : "border-line-strong bg-canvas hover:bg-sunken/60",
                )}
              >
                <CloudArrowUp size={28} className={dragging ? "text-primary" : "text-muted"} aria-hidden="true" />
                <span className="text-sm text-ink">{dragging ? "Drop to add" : "Drag a PDF or photo here"}</span>
                <span className="text-xs text-muted">or click to choose · PDF, JPG, PNG up to {MAX_MB} MB</span>
                <input
                  id={inputId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(e) => {
                    take(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {errors.file ? <p className="text-xs text-danger">{errors.file}</p> : <span className="text-xs text-muted">Files stay on this device in the demo.</span>}
              {!file ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-primary-ink underline-offset-2 hover:underline"
                  onClick={() => {
                    setFile({ name: "scan-1311-0942.pdf", size: 412_000, type: "application/pdf" });
                    setErrors((x) => ({ ...x, file: undefined }));
                  }}
                >
                  Use a sample file
                </button>
              ) : null}
            </div>
          </div>

          <Field label="Document type" error={errors.type}>
            {(p) => (
              <Select
                {...p}
                value={type}
                onValueChange={(v) => {
                  setType(v as ClinicalDocument["type"]);
                  setErrors((x) => ({ ...x, type: undefined }));
                }}
                placeholder="Choose a type"
                options={DOC_TYPES.map((t) => ({ value: t, label: t }))}
              />
            )}
          </Field>
          <Field label="Date issued" error={errors.date} hint={errors.date ? undefined : "Printed on the report"}>
            {(p) => (
              <Input
                {...p}
                type="date"
                max={TODAY_KEY}
                value={reportDate}
                onChange={(e) => {
                  setReportDate(e.target.value);
                  setErrors((x) => ({ ...x, date: undefined }));
                }}
              />
            )}
          </Field>
          {isPatient ? (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm text-ink">Patient</span>
              <span className="flex h-10 items-center rounded-control bg-canvas px-4 text-sm text-ink-2">{user.name} (you)</span>
            </div>
          ) : (
            <>
              <Field label="Patient" error={errors.patient}>
                {(p) => (
                  <Select
                    {...p}
                    value={patientId}
                    onValueChange={(v) => {
                      setPatientId(v);
                      setErrors((x) => ({ ...x, patient: undefined }));
                    }}
                    placeholder="Choose a patient"
                    options={patientOptions()}
                  />
                )}
              </Field>
              {needsReview && patientId && !primary ? (
                <Field label="Reviewer" error={errors.reviewer} hint={errors.reviewer ? undefined : "No primary doctor on record"}>
                  {(p) => (
                    <Select
                      {...p}
                      value={fallbackReviewer}
                      onValueChange={(v) => {
                        setFallbackReviewer(v);
                        setErrors((x) => ({ ...x, reviewer: undefined }));
                      }}
                      placeholder="Choose a doctor"
                      options={staffOptions((s) => s.role === "doctor")}
                    />
                  )}
                </Field>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-ink">Review</span>
                  <span className="flex min-h-10 items-center rounded-control bg-canvas px-4 py-2 text-sm text-ink-2">
                    {!needsReview ? "Filed — consent forms need no review" : primary ? `${primary.name} · primary doctor` : "The patient's primary doctor"}
                  </span>
                </div>
              )}
            </>
          )}
          <Field label="Title" optional className="sm:col-span-2">
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name, e.g. Lipid profile" />}
          </Field>
          {!isPatient ? (
            <label className="flex items-center justify-between gap-4 rounded-inner bg-canvas px-4 py-3 text-sm text-ink sm:col-span-2">
              <span>
                Restricted
                <span className="block text-xs text-muted">Only the reviewer can open it (e.g. mental-health records)</span>
              </span>
              <Switch checked={restricted} onCheckedChange={setRestricted} aria-label="Restricted document" />
            </label>
          ) : null}
          {!isPatient ? (
            <AddOnNotice addOn="labs" className="sm:col-span-2">
              Reports from partner labs arrive on their own and go straight to the primary doctor. Without it, upload lab reports here.
            </AddOnNotice>
          ) : null}
          <button type="submit" className="sr-only">
            Upload
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}
