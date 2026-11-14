"use client";

import { ArrowUpRight, LockSimple, Scan } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import type { ScanKind } from "@/data/featured";
import { patientById } from "@/data/patients";
import { TODAY, formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { SegmentedBar } from "@/components/charts/bar-chart";
import { MediaStatCard, SectionLabel } from "@/components/viz/cards";
import { ScanThumb } from "@/features/patient/scan-thumb";
import { OrganGlyph } from "@/features/tasks/organ-glyph";
import { TODAY_KEY, byTime, dayKey, hoursSince } from "@/features/tasks/time";
import { docHeadline, OUTCOME_LABEL } from "./data";
import { docDue } from "./doc-meta";
import { SpineMriThumb } from "./spine-mri-thumb";
import { DOC_QUEUES, QUEUE_LABEL, contentAccess, displayTitle, queueOf, statusText, type CareDocument, type DocQueue } from "./store";

/** Which illustrative render matches a study, from its title. Null = no matching render. */
function studyRender(title: string): ScanKind | "spine" | null {
  const t = title.toLowerCase();
  if (/lumbar|spine|spondyl|disc/.test(t)) return "spine";
  if (/echo/.test(t)) return "echo";
  if (/cardiac mri|heart mri/.test(t)) return "cardiac-mri";
  if (/brain|mra|head/.test(t)) return "brain-mra";
  if (/carotid|doppler/.test(t)) return "carotid";
  if (/x-?ray|cxr|radiograph/.test(t)) return "chest-xray";
  if (/\bct\b|hrct/.test(t)) return "chest-ct";
  return null;
}

const shortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
const wholeDays = (h: number) => Math.max(0, Math.floor(h / 24));

/**
 * Imaging documents as dark stat cards (ref 5), leading with the report's own finding. The view
 * passes only studies the viewer may read — admin and Reception never see this strip.
 */
export function ImagingStrip({ docs, role, userId, onOpen, className }: { docs: CareDocument[]; role: Role; userId: string; onOpen: (d: CareDocument) => void; className?: string }) {
  if (!docs.length) return null;
  return (
    <section aria-labelledby="imaging-strip" className={cn("min-w-0", className)}>
      <SectionLabel actions={<span className="hidden text-[11px] text-muted sm:inline">Illustrative renders — not diagnostic images</span>}>
        <span id="imaging-strip">
          Imaging studies · {docs.length}
        </span>
      </SectionLabel>
      <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-[repeat(auto-fill,minmax(264px,1fr))]">
        {docs.map((d) => (
          <ImagingCard key={d.id} doc={d} role={role} userId={userId} onOpen={onOpen} />
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted sm:hidden">Illustrative renders — not diagnostic images.</p>
    </section>
  );
}

function ImagingCard({ doc, role, userId, onOpen }: { doc: CareDocument; role: Role; userId: string; onOpen: (d: CareDocument) => void }) {
  const access = contentAccess(doc, role, userId);
  const readable = access === "full";
  const headline = readable ? docHeadline(doc.id) : null;
  const render = access === "restricted" ? null : studyRender(doc.title);
  const title = displayTitle(doc, access);
  const patient = patientById(doc.patientId);

  // Without read access (or without a quantitative finding) the number is operational: queue age.
  const waited = doc.status === "awaiting-review" || doc.status === "unclassified";
  const turnaround = doc.review ? wholeDays((Date.parse(doc.review.at) - Date.parse(doc.uploadedAt)) / 3_600_000) : null;
  const value = headline ? headline.value : waited ? String(wholeDays(hoursSince(doc.uploadedAt))) : turnaround !== null ? String(turnaround) : "—";
  const label = headline ? headline.label : waited ? (doc.status === "unclassified" ? "days not matched" : "days awaiting review") : turnaround !== null ? "days upload → review" : "no finding recorded";

  const thumb =
    render === "spine" ? (
      <SpineMriThumb title={`${title} (illustrative render)`} />
    ) : render ? (
      <ScanThumb kind={render} title={`${title} (illustrative render)`} />
    ) : (
      <span className="flex size-full items-center justify-end pr-6 text-white/40" aria-hidden="true">
        <Scan size={40} />
      </span>
    );
  const media = readable ? (
    thumb
  ) : (
    <span className="relative block size-full">
      <span className="block size-full opacity-50 blur-[3px]">{render ? thumb : null}</span>
      <span className="absolute inset-0 flex items-end justify-center pb-5 text-white/80">
        <LockSimple size={20} aria-hidden="true" />
      </span>
    </span>
  );

  const due = docDue(doc);
  const status =
    doc.status === "awaiting-review"
      ? `${statusText(doc)}${due.tone === "danger" ? ` · ${due.text.toLowerCase()}` : due.text !== "—" ? ` · due ${due.text.toLowerCase()}` : ""}`
      : doc.review
        ? `${OUTCOME_LABEL[doc.review.outcome]} · reviewed ${shortDate(doc.review.at)}`
        : statusText(doc);

  return (
    <li className="w-[272px] shrink-0 snap-start sm:w-auto">
      <button
        type="button"
        onClick={() => onOpen(doc)}
        aria-label={`Open ${title}${patient ? ` for ${patient.name}` : ""} — ${value} ${label}`}
        className="group relative block w-full rounded-card text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <MediaStatCard value={value} label={label} time={`Issued ${shortDate(`${doc.reportDate}T12:00:00+05:30`)}`} media={media} className="transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-0.5" />
        <span aria-hidden="true" className="absolute right-3 top-3 z-[2] flex size-9 items-center justify-center rounded-full bg-white text-ink transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-105">
          <ArrowUpRight size={16} />
        </span>
      </button>
      <div className="mt-2 flex items-center gap-2 px-1">
        {access === "restricted" ? null : <OrganGlyph patientId={doc.patientId} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink">
            {title}
            {patient ? <span className="text-muted"> · {patient.name}</span> : null}
          </p>
          <p className={cn("truncate text-[11px]", due.tone === "danger" && doc.status === "awaiting-review" ? "text-danger" : "text-muted")}>{status}</p>
        </div>
      </div>
    </li>
  );
}

const QUEUE_COLOR: Record<DocQueue, string> = {
  unmatched: "var(--color-warning)",
  review: "var(--color-primary)",
  done: "var(--color-success)",
  archived: "var(--color-faint)",
};

/** Where every document sits in the match → review pipeline, and what is late. */
export function QueueCard({ docs, userId, mineLabel, className }: { docs: CareDocument[]; userId: string; mineLabel?: boolean; className?: string }) {
  const awaiting = docs.filter((d) => queueOf(d) === "review");
  const overdue = awaiting.filter((d) => d.dueBy && Date.parse(d.dueBy) < TODAY.getTime());
  const dueToday = awaiting.filter((d) => d.dueBy && Date.parse(d.dueBy) >= TODAY.getTime() && dayKey(d.dueBy) === TODAY_KEY);
  const oldest = [...awaiting].sort((a, b) => byTime(a.uploadedAt, b.uploadedAt))[0];
  const mine = awaiting.filter((d) => d.reviewerId === userId);
  return (
    <section aria-labelledby="queue-card" className={cn("flex flex-col justify-between gap-6 rounded-card bg-surface p-6", className)}>
      <div>
        <h2 id="queue-card" className="text-xs text-muted">
          Review queue
        </h2>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{awaiting.length}</span>
          <span className="text-sm text-ink-2">awaiting review</span>
        </p>
        <p className="mt-2 text-xs text-muted">
          <span className={overdue.length ? "text-danger" : undefined}>{overdue.length} overdue</span> · {dueToday.length} due today
          {oldest ? ` · oldest uploaded ${pluralize(wholeDays(hoursSince(oldest.uploadedAt)), "day")} ago` : ""}
          {mineLabel ? ` · ${mine.length} assigned to you` : ""}
        </p>
      </div>
      <SegmentedBar label="Documents by status" parts={DOC_QUEUES.map((q) => ({ label: QUEUE_LABEL[q], value: docs.filter((d) => queueOf(d) === q).length, color: QUEUE_COLOR[q] }))} />
    </section>
  );
}
