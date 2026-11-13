"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { FileArrowUp, FileText, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoNote } from "../ui";
import { SYSTEMS } from "../record";
import { TODAY_KEY } from "../time";
import { addUpload, removeUpload, type UploadType } from "./store";

const TYPES: { value: UploadType; label: string }[] = [
  { value: "Lab report", label: "Lab report" },
  { value: "Imaging", label: "Scan or imaging report" },
  { value: "Discharge summary", label: "Hospital discharge summary" },
  { value: "Prescription", label: "Prescription" },
  { value: "Other", label: "Something else" },
];

const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];
const MAX_MB = 10;

type Errors = Partial<Record<"file" | "title" | "reportDate", string>>;

export const formatSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Upload a report. The file never leaves the browser in this demo — only its name and size are
 * kept. The report date (when the test was done) is required and kept apart from the upload date.
 */
export function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const inputId = useId();
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<UploadType>("Lab report");
  const [reportDate, setReportDate] = useState("");
  const [where, setWhere] = useState("");
  const [systemId, setSystemId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setErrors((x) => ({ ...x, file: "Use a PDF, JPG or PNG file" }));
    if (f.size > MAX_MB * 1_048_576) return setErrors((x) => ({ ...x, file: `That file is ${formatSize(f.size)} — the limit is ${MAX_MB} MB` }));
    setFile({ name: f.name, size: f.size });
    if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim());
    setErrors((x) => ({ ...x, file: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!file) next.file = "Choose the file to upload";
    if (!title.trim()) next.title = "Give the report a name you'll recognise";
    if (!reportDate) next.reportDate = "Add the date of the test — it's printed on the report";
    else if (reportDate > TODAY_KEY) next.reportDate = "The report date can't be in the future";
    else if (reportDate < "1990-01-01") next.reportDate = "Check the year";
    setErrors(next);
    if (Object.keys(next).length || !file) return;
    const u = addUpload({ title: title.trim(), type, reportDate, fileName: file.name, fileSize: file.size, where: where.trim() || undefined, systemId, note: note.trim() || undefined });
    onOpenChange(false);
    toast({
      title: "Uploaded · awaiting review",
      description: "Kept in this browser session for the demo — the clinic hasn't received it and nothing was sent.",
      action: { label: "Undo", onClick: () => removeUpload(u.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Upload a report"
        description="Your care team reviews every upload before it joins your record."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="upload-form" leading={<FileArrowUp />}>
              Upload
            </Button>
          </>
        }
      >
        <form id="upload-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink" id={`${inputId}-label`}>
              File
            </span>
            <input
              id={inputId}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={pick}
              className="peer sr-only"
              aria-labelledby={`${inputId}-label`}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? `${inputId}-err` : undefined}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-inner bg-sunken p-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-2" aria-hidden="true">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{file.name}</span>
                  <span className="block text-xs text-muted">{formatSize(file.size)} · stays in this browser</span>
                </span>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-inner bg-sunken px-4 py-8 text-center transition-colors hover:bg-sunken-2 peer-focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]",
                  errors.file && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink" aria-hidden="true">
                  <FileArrowUp size={18} />
                </span>
                <span className="text-sm text-ink">Choose a PDF or photo of the report</span>
                <span className="text-xs text-muted">PDF, JPG or PNG · up to {MAX_MB} MB</span>
              </label>
            )}
            {errors.file ? (
              <p id={`${inputId}-err`} className="text-xs text-danger">
                {errors.file}
              </p>
            ) : null}
          </div>

          <Field label="Name" error={errors.title}>
            {(f) => <Input {...f} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Lipid profile" />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              {(f) => <Select id={f.id} value={type} onValueChange={(v) => setType(v as UploadType)} options={TYPES} />}
            </Field>
            <Field label="Date of the test" error={errors.reportDate} hint="Not today's date — the date on the report">
              {(f) => <Input {...f} type="date" max={TODAY_KEY} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lab or hospital" optional>
              {(f) => <Input {...f} value={where} maxLength={60} onChange={(e) => setWhere(e.target.value)} placeholder="For example: Anand Diagnostics" />}
            </Field>
            <Field label="Which part of your care?" optional>
              {(f) => (
                <Select
                  id={f.id}
                  value={systemId}
                  onValueChange={setSystemId}
                  placeholder="Not sure"
                  options={SYSTEMS.map((s) => ({ value: s.id, label: s.area }))}
                />
              )}
            </Field>
          </div>

          <Field label="Note for your care team" optional hint={`${note.length} / 240`}>
            {(f) => <Textarea {...f} value={note} maxLength={240} onChange={(e) => setNote(e.target.value)} placeholder="For example: done at work health check, fasting" />}
          </Field>

          <DemoNote>In this demo the file is not uploaded anywhere — only its name and size are kept in this browser session.</DemoNote>
        </form>
      </ModalContent>
    </Dialog>
  );
}
