"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileText, UploadSimple, X } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { STAFF } from "@/data/staff";
import { useRole } from "@/components/shell/role-context";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DOC_SOURCES, DOC_TYPES, type DocSource, type DocType, type RecordDocument } from "./data";
import { localId, updateRecord } from "./store";

const TODAY_DATE = "2026-11-13";
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/png", "image/jpeg", "image/heic", "image/webp"];
const DOCTORS = STAFF.filter((s) => s.role === "doctor");

type Errors = Partial<Record<"file" | "title" | "type" | "reportDate", string>>;

const sizeText = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/**
 * Upload: the file never leaves the device — only its name, size and the details entered here
 * are recorded (this browser session). Report date is required and kept apart from upload date.
 */
export function UploadDialog({ open, onOpenChange, patient, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient; onAdded: (doc: RecordDocument) => void }) {
  const { user, role } = useRole();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType | "">("");
  const [reportDate, setReportDate] = useState("");
  const [source, setSource] = useState<DocSource>(role === "frontdesk" ? "Front desk scan" : "Clinic upload");
  const [reviewer, setReviewer] = useState<string>(patient.careTeam.doctor ?? "s-ananya");
  const [errors, setErrors] = useState<Errors>({});

  const reset = () => {
    setOver(false);
    setFile(null);
    setTitle("");
    setType("");
    setReportDate("");
    setSource(role === "frontdesk" ? "Front desk scan" : "Clinic upload");
    setReviewer(patient.careTeam.doctor ?? "s-ananya");
    setErrors({});
  };

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type) && !/\.(pdf|png|jpe?g|heic|webp)$/i.test(f.name)) {
      setErrors((e) => ({ ...e, file: "Use a PDF or an image (PNG, JPG, HEIC, WebP)." }));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, file: `That file is ${sizeText(f.size)} — the limit is 20 MB.` }));
      return;
    }
    setFile({ name: f.name, size: f.size });
    const prefill = !title.trim();
    if (prefill) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    setErrors((e) => ({ ...e, file: undefined, title: prefill ? undefined : e.title }));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    accept(e.dataTransfer.files?.[0]);
  };

  const ageDays = reportDate ? Math.round((TODAY.getTime() - new Date(reportDate).getTime()) / 86_400_000) : 0;

  const submit = () => {
    const errs: Errors = {};
    if (!file) errs.file = "Drop a file here or choose one.";
    if (!title.trim()) errs.title = "Give the document a recognisable title.";
    if (!type) errs.type = "Choose the document type.";
    if (!reportDate) errs.reportDate = "Enter the date printed on the report.";
    else if (reportDate > TODAY_DATE) errs.reportDate = "The report date can't be in the future.";
    setErrors(errs);
    if (Object.keys(errs).length || !file || !type) return;

    const due = new Date(TODAY.getTime() + 2 * 86_400_000);
    const doc: RecordDocument = {
      id: localId("up"),
      title: title.trim(),
      patientId: patient.id,
      type,
      reportDate,
      uploadedAt: TODAY.toISOString(),
      uploadedBy: user.name,
      source,
      reviewerId: reviewer === "none" ? null : reviewer,
      dueBy: reviewer === "none" ? null : `${due.toISOString().slice(0, 10)}T18:00:00+05:30`,
      status: "awaiting-review",
      sensitivity: "standard",
      pages: 1,
      fileName: file.name,
      local: true,
      summary: "Added in this browser session. The original file stayed on this device, so this preview is synthetic.",
    };
    const persisted = updateRecord((s) => ({ ...s, uploads: [doc, ...s.uploads] }));
    toast({
      title: "Added to the review queue",
      description: `${persisted ? "Recorded in this browser session" : "Kept in memory only (browser storage is blocked)"}. The file itself wasn't uploaded anywhere.`,
      tone: "success",
    });
    onAdded(doc);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <ModalContent
        title="Upload document"
        description={`Adds a row for ${patient.name} marked “Awaiting review”.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<UploadSimple />} onClick={submit}>
              Add to review queue
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
              }}
              onDrop={onDrop}
              aria-describedby="drop-hint"
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-inner border-2 border-dashed px-6 py-8 text-center transition-colors duration-200",
                over ? "border-primary bg-primary-soft" : errors.file ? "border-danger/50 bg-danger-soft/40" : "border-line-strong bg-canvas",
              )}
            >
              {file ? (
                <div className="flex w-full items-center gap-3 rounded-[12px] bg-surface p-3 text-left shadow-[inset_0_0_0_1px_var(--color-line)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
                    <FileText size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{file.name}</span>
                    <span className="block text-xs text-muted">{sizeText(file.size)} · stays on this device</span>
                  </span>
                  <IconButton label="Remove file" variant="ghost" size="sm" onClick={() => setFile(null)}>
                    <X />
                  </IconButton>
                </div>
              ) : (
                <>
                  <span className={cn("flex size-12 items-center justify-center rounded-full", over ? "bg-primary text-white" : "bg-surface text-ink-2")}>
                    <UploadSimple size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm text-ink">{over ? "Drop to attach" : "Drag a PDF or image here"}</p>
                    <p id="drop-hint" className="mt-1 text-xs text-muted">
                      Up to 20 MB · the file isn&apos;t sent anywhere in this prototype
                    </p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}>
                    Choose file
                  </Button>
                </>
              )}
              <input
                ref={input}
                type="file"
                accept=".pdf,image/*"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose a file to upload"
                onChange={(e) => {
                  accept(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {errors.file ? <p className="text-xs text-danger">{errors.file}</p> : null}
          </div>

          <Field label="Title" error={errors.title}>
            {(p) => (
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((x) => ({ ...x, title: undefined }));
                }}
                placeholder="e.g. Lipid profile — Anand Diagnostics"
                {...p}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Document type" error={errors.type}>
              {({ id }) => (
                <Select
                  id={id}
                  value={type}
                  placeholder="Choose type"
                  onValueChange={(v) => {
                    setType(v as DocType);
                    setErrors((x) => ({ ...x, type: undefined }));
                  }}
                  options={DOC_TYPES.map((t) => ({ value: t, label: t }))}
                  className={errors.type ? "shadow-[inset_0_0_0_1.5px_var(--color-danger)]" : undefined}
                />
              )}
            </Field>
            <Field
              label="Report date"
              error={errors.reportDate}
              hint={reportDate && ageDays > 90 ? `Older report — filed under ${formatDate(reportDate)}, so it won't read as a new result.` : "The date printed on the report, not today's upload date."}
            >
              {(p) => (
                <Input
                  type="date"
                  value={reportDate}
                  max={TODAY_DATE}
                  onChange={(e) => {
                    setReportDate(e.target.value);
                    setErrors((x) => ({ ...x, reportDate: undefined }));
                  }}
                  {...p}
                />
              )}
            </Field>
            <Field label="Source">
              {({ id }) => <Select id={id} value={source} onValueChange={(v) => setSource(v as DocSource)} options={DOC_SOURCES.map((s) => ({ value: s, label: s }))} />}
            </Field>
            <Field label="Reviewer">
              {({ id }) => (
                <Select
                  id={id}
                  value={reviewer}
                  onValueChange={setReviewer}
                  options={[...DOCTORS.map((d) => ({ value: d.id, label: d.name, description: d.status === "on-leave" ? "On leave" : d.title })), { value: "none", label: "Unassigned" }]}
                />
              )}
            </Field>
          </div>
          <button type="submit" className="sr-only">
            Add to review queue
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}
