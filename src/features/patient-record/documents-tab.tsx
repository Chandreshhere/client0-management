"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowsLeftRight, ArrowUpRight, FileText, Files, MagnifyingGlass, Pill as PillIcon, Scan, Signature, TestTube, UploadSimple } from "@phosphor-icons/react";
import type { DocStatus } from "@/data/types";
import { DOC_STATUS_LABEL } from "@/data/records";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { SearchInput, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { ChipGroup } from "@/components/viz/cards";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DOC_TYPES, recordHref, type DocType, type RecordDocument } from "./data";
import { useRecord } from "./store";
import { RecordFrame } from "./record-frame";
import { DOC_STATUS_TONE, DocumentPreview, dueText, useEffectiveStatus } from "./document-preview";
import { UploadDialog } from "./upload-dialog";
import { baseDocuments, recordOf } from "./record-model";

const TYPE_ICON: Record<DocType, ReactNode> = {
  "Lab report": <TestTube />,
  Imaging: <Scan />,
  "Discharge summary": <FileText />,
  Prescription: <PillIcon />,
  "Referral letter": <ArrowsLeftRight />,
  "Consent form": <Signature />,
};

/** Plural chip labels. */
const TYPE_PLURAL: Record<DocType, string> = {
  "Lab report": "Lab reports",
  Imaging: "Imaging",
  "Discharge summary": "Discharge summaries",
  Prescription: "Prescriptions",
  "Referral letter": "Referral letters",
  "Consent form": "Consent forms",
};

type SortKey = "report-desc" | "upload-desc" | "report-asc";
type StatusFilter = "all" | DocStatus;
type TypeChip = "all" | DocType;

const MS_DAY = 86_400_000;

/** How long after the report date a document reached Carelane — "same day", "+3 days", "7 years later". */
export function uploadLag(doc: RecordDocument): { text: string; late: boolean } {
  const days = Math.round((new Date(doc.uploadedAt).getTime() - new Date(`${doc.reportDate}T12:00:00+05:30`).getTime()) / MS_DAY);
  if (days <= 0) return { text: "Same day", late: false };
  if (days < 31) return { text: `+${days} ${days === 1 ? "day" : "days"}`, late: days > 14 };
  if (days < 365) return { text: `${Math.round(days / 30)} months later`, late: true };
  const years = Math.round(days / 365);
  return { text: `${years} ${years === 1 ? "year" : "years"} later`, late: true };
}

export function DocumentsTab({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const params = useSearchParams();
  const uploads = useRecord((s) => s.uploads);
  const statusOf = useEffectiveStatus();
  const record = recordOf(patientId);

  const docs = useMemo<RecordDocument[]>(() => [...uploads.filter((d) => d.patientId === patientId), ...baseDocuments(patientId)], [uploads, patientId]);

  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<DocType[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("report-desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  // Entry points: ?doc=<id> opens a preview, ?upload=1 opens the upload dialog.
  useEffect(() => {
    const doc = params.get("doc");
    const upload = params.get("upload") === "1";
    if (doc) setOpenId(doc);
    if (upload) setUploading(true);
    if (doc || upload) window.history.replaceState(null, "", window.location.pathname);
  }, [params]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = docs.filter(
      (d) =>
        (types.length === 0 || types.includes(d.type)) &&
        (status === "all" || statusOf(d) === status) &&
        (!q || [d.title, d.source, d.uploadedBy, d.type, d.summary ?? ""].some((s) => s.toLowerCase().includes(q))),
    );
    const key = (d: RecordDocument) => (sort === "upload-desc" ? d.uploadedAt : d.reportDate);
    return list.sort((a, b) => (sort === "report-asc" ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))));
  }, [docs, types, status, q, sort, statusOf]);

  const count = (s: DocStatus) => docs.filter((d) => statusOf(d) === s).length;
  const statusItems: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: docs.length },
    { value: "awaiting-review", label: "Awaiting review", count: count("awaiting-review") },
    { value: "reviewed", label: "Reviewed", count: count("reviewed") },
    { value: "filed", label: "Filed", count: count("filed") },
    ...(count("unclassified") ? [{ value: "unclassified" as const, label: DOC_STATUS_LABEL.unclassified, count: count("unclassified") }] : []),
  ];
  const presentTypes = DOC_TYPES.filter((t) => docs.some((d) => d.type === t));
  const typeOptions: { value: TypeChip; label: string; count: number }[] = [
    { value: "all", label: "All types", count: docs.length },
    ...presentTypes.map((t) => ({ value: t, label: TYPE_PLURAL[t], count: docs.filter((d) => d.type === t).length })),
  ];
  const filtered = q !== "" || types.length > 0 || status !== "all";
  const clear = () => {
    setQuery("");
    setTypes([]);
    setStatus("all");
  };
  const openDoc = docs.find((d) => d.id === openId) ?? null;
  const first = patient.name.split(" ")[0];

  return (
    <RecordFrame
      patient={patient}
      title="Documents"
      description="Reports, letters and forms on this record. The report date (when the test happened) is kept apart from the upload date (when it reached Carelane)."
      actions={
        <Button variant="primary" leading={<UploadSimple />} onClick={() => setUploading(true)}>
          Upload document
        </Button>
      }
    >
      {docs.length === 0 ? (
        <Card className="py-6">
          <EmptyState
            icon={<Files />}
            title={`No documents on file for ${first} yet`}
            description={`${record ? "Nothing has been uploaded or reported for this record." : `${first}'s record has no conditions or results yet.`} Uploads appear here marked “Awaiting review”, filed under the date printed on the report.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="dark" leading={<UploadSimple />} onClick={() => setUploading(true)}>
                  Upload document
                </Button>
                {!record ? (
                  <Button asChild variant="secondary">
                    <Link href={recordHref(patient.id)}>
                      Open registration &amp; intake
                      <ArrowUpRight />
                    </Link>
                  </Button>
                ) : null}
              </div>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="scrollbar-none -mx-4 min-w-0 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:overflow-visible @[640px]:px-0" data-lenis-prevent>
            <ChipGroup<TypeChip>
              ariaLabel="Document type"
              variant="dark"
              className="w-max flex-nowrap @[640px]:w-auto @[640px]:flex-wrap [&>button]:shrink-0 [&>button]:whitespace-nowrap"
              options={typeOptions}
              value={types.length ? types : ["all"]}
              onChange={(next) => {
                const added = next.find((v) => !(types.length ? types : ["all"]).includes(v));
                if (added === "all" || next.length === 0) setTypes([]);
                else setTypes(next.filter((v): v is DocType => v !== "all"));
              }}
            />
          </div>
          <div className="flex flex-col gap-3 @[1040px]:flex-row @[1040px]:items-center @[1040px]:justify-between">
            <div className="scrollbar-none -mx-4 min-w-0 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:px-0" data-lenis-prevent>
              <Segmented<StatusFilter> ariaLabel="Status" size="sm" value={status} onChange={setStatus} items={statusItems} />
            </div>
            <div className="grid grid-cols-1 gap-2 @[640px]:flex @[640px]:items-center">
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" aria-label="Search documents" className="@[640px]:w-[240px]" />
              <Select
                ariaLabel="Sort"
                size="sm"
                className="h-10 @[640px]:w-[196px]"
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
                options={[
                  { value: "report-desc", label: "Report date · newest" },
                  { value: "upload-desc", label: "Uploaded · newest" },
                  { value: "report-asc", label: "Report date · oldest" },
                ]}
              />
            </div>
          </div>

          {shown.length === 0 ? (
            <Card className="py-4">
              <EmptyState
                icon={<MagnifyingGlass />}
                title="No documents match these filters"
                description="Try another type or status, or clear the search."
                action={
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <DocTable docs={shown} statusOf={statusOf} onOpen={setOpenId} freshId={freshId} />
              <DocCards docs={shown} statusOf={statusOf} onOpen={setOpenId} freshId={freshId} />
              <p className="text-xs text-muted">
                Showing {shown.length} of {docs.length} · “Uploaded” notes how long after the report date each document reached Carelane
                {filtered ? (
                  <>
                    {" · "}
                    <button type="button" onClick={clear} className="text-ink-2 underline underline-offset-4">
                      Clear filters
                    </button>
                  </>
                ) : null}
              </p>
            </>
          )}
        </div>
      )}

      <DocumentPreview doc={openDoc} patient={patient} onOpenChange={(o) => !o && setOpenId(null)} />
      <UploadDialog
        open={uploading}
        onOpenChange={setUploading}
        patient={patient}
        onAdded={(d) => {
          clear();
          setSort("upload-desc");
          setFreshId(d.id);
        }}
      />
    </RecordFrame>
  );
}

type RowProps = { docs: RecordDocument[]; statusOf: (d: RecordDocument) => DocStatus; onOpen: (id: string) => void; freshId: string | null };

function TypeIcon({ type }: { type: DocType }) {
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4">{TYPE_ICON[type]}</span>;
}

function StatusCell({ doc, status }: { doc: RecordDocument; status: DocStatus }) {
  const due = dueText(doc, status);
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</StatusBadge>
      {due ? <span className={cn("whitespace-nowrap text-[11px]", due.overdue ? "text-danger" : "text-muted")}>{due.text}</span> : null}
    </span>
  );
}

function Reviewer({ id }: { id: string | null }) {
  const s = staffById(id ?? undefined);
  if (!s) return <span className="text-muted">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={s.avatar} name={s.name} size="xs" />
      <span className="truncate">{s.name}</span>
    </span>
  );
}

function LagText({ doc }: { doc: RecordDocument }) {
  const lag = uploadLag(doc);
  return <span className={cn("block text-[11px]", lag.late ? "text-warning" : "text-muted")}>{lag.text}</span>;
}

function DocTable({ docs, statusOf, onOpen, freshId }: RowProps) {
  return (
    <Card padded={false} className="hidden @[880px]:block">
      <div className="scrollbar-thin relative overflow-x-auto" data-lenis-prevent>
        <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Documents. Report date and uploaded date are separate columns.</caption>
          <colgroup>
            <col />
            <col className="w-[128px]" />
            <col className="w-[112px]" />
            <col className="w-[132px]" />
            <col className="w-[148px]" />
            <col className="w-[164px]" />
            <col className="w-[152px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-4 pl-6 pr-3 text-left font-normal">Document</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Type</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Report date</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Uploaded</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Source</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Reviewer</th>
              <th scope="col" className="px-3 py-4 text-left font-normal">Status</th>
              <th scope="col" className="py-4 pl-3 pr-6 font-normal">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const status = statusOf(d);
              const cell = "border-t border-line px-3 py-3 align-middle";
              return (
                <tr key={d.id} onClick={() => onOpen(d.id)} className={cn("group cursor-pointer transition-colors hover:bg-canvas", d.id === freshId && "bg-primary-soft/60")}>
                  <td className={cn(cell, "pl-6")}>
                    <span className="flex items-center gap-3">
                      <TypeIcon type={d.type} />
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(d.id);
                          }}
                          className="block w-full truncate rounded-md text-left text-ink"
                        >
                          {d.title}
                        </button>
                        <span className="block truncate text-xs text-muted">
                          {d.pages} {d.pages === 1 ? "page" : "pages"}
                          {d.id === freshId || d.local ? " · added now" : ""}
                          {d.summary && !d.local ? ` · ${d.summary}` : ""}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={cn(cell, "truncate text-ink-2")}>{d.type}</td>
                  <td className={cn(cell, "whitespace-nowrap text-ink")}>{formatDate(d.reportDate)}</td>
                  <td className={cn(cell, "whitespace-nowrap")}>
                    <span className="block text-ink-2">
                      {formatDate(d.uploadedAt)} <span className="font-mono text-[11px] text-muted">{formatTime(d.uploadedAt)}</span>
                    </span>
                    <LagText doc={d} />
                  </td>
                  <td className={cn(cell, "text-ink-2")}>
                    <span className="block truncate">{d.source}</span>
                    {d.uploadedBy !== d.source ? <span className="block truncate text-xs text-muted">{d.uploadedBy.replace(/^Lab partner · /, "")}</span> : null}
                  </td>
                  <td className={cn(cell, "text-ink-2")}>
                    <Reviewer id={d.reviewerId} />
                  </td>
                  <td className={cell}>
                    <StatusCell doc={d} status={status} />
                  </td>
                  <td className={cn(cell, "pr-6 text-right")}>
                    <span className="inline-flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors group-hover:bg-surface" aria-hidden="true">
                      <ArrowUpRight size={16} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DocCards({ docs, statusOf, onOpen, freshId }: RowProps) {
  return (
    <ul className="flex flex-col gap-2 @[880px]:hidden">
      {docs.map((d) => {
        const status = statusOf(d);
        const lag = uploadLag(d);
        return (
          <li key={d.id}>
            <button type="button" onClick={() => onOpen(d.id)} className={cn("flex w-full flex-col gap-3 rounded-card bg-surface p-4 text-left transition-colors hover:bg-canvas", d.id === freshId && "bg-primary-soft/60")}>
              <span className="flex items-start gap-3">
                <TypeIcon type={d.type} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{d.title}</span>
                  <span className="block text-xs text-muted">
                    {d.type} · {d.source}
                  </span>
                </span>
              </span>
              <span className="grid grid-cols-2 gap-2 rounded-inner bg-canvas p-3 text-xs">
                <span>
                  <span className="block text-muted">Report date</span>
                  <span className="block text-ink">{formatDate(d.reportDate)}</span>
                </span>
                <span>
                  <span className="block text-muted">Uploaded</span>
                  <span className="block text-ink">
                    {formatDate(d.uploadedAt, { day: "numeric", month: "short", year: "numeric" })} · {formatTime(d.uploadedAt)}
                  </span>
                  <span className={cn("block", lag.late ? "text-warning" : "text-muted")}>{lag.text}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                <Reviewer id={d.reviewerId} />
                <StatusCell doc={d} status={status} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
