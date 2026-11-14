"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarBlank, Scan, UploadSimple } from "@phosphor-icons/react";
import { RECORD_STATE_LABEL } from "@/data/featured";
import { patientById } from "@/data/patients";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { MediaStatCard } from "@/components/viz/cards";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorName } from "@/features/patient/event-meta";
import { MODALITY, recordHref, type StudyKind } from "./data";
import { clinicalAccess } from "./access";
import { NoRecordState, OrganThumb, RecordFrame, RestrictedRecord } from "./record-frame";
import { ImagingViewer } from "./imaging-viewer";
import { StudyThumb } from "./study-thumb";
import { baseDocuments, conditionOf, recordOf, studies as studiesOf, studyPeople, systemConditionText, systemOf, type Study } from "./record-model";
import { uploadLag } from "./documents-tab";

export type { Study };

const fmtShort = (d: string) => formatDate(d, { day: "numeric", month: "short" });

/** Short modality names for the dark stat cards. */
const CARD_NAME: Record<StudyKind, string> = {
  "brain-mra": "MR angiography",
  "cardiac-mri": "Cardiac MRI",
  echo: "Echo",
  "echo-plain": "Echo",
  carotid: "Carotid doppler",
  "chest-xray": "Chest X-ray",
  "chest-ct": "Chest CT",
  "spine-mri": "Spine MRI",
};

/**
 * The modality badge sits top-left, except on renders that print their own label there (the
 * featured echo carries "EF 58%" in its top-left corner): those get the badge top-right, so the
 * two never stack into "Echo58%". The organ chip keeps the bottom-right corner.
 */
const LABEL_TOP_LEFT = new Set<StudyKind>(["echo"]);
const badgeSide = (kind: StudyKind) => (LABEL_TOP_LEFT.has(kind) ? "right-2" : "left-2");

export function ImagingTab({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role } = useRole();
  const access = clinicalAccess(role, patientId);
  const record = recordOf(patientId);
  const [system, setSystem] = useState<string>("all");
  return (
    <RecordFrame
      patient={patient}
      focusSystemId={system === "all" ? undefined : system}
      title="Imaging"
      description="Studies by the date they were performed, with the reporting clinician and report. Thumbnails and the viewer are illustrative renders — not diagnostic images."
    >
      {!record ? (
        <NoRecordState patient={patient} tab="imaging" />
      ) : access === "none" ? (
        <RestrictedRecord role={role} tab="imaging" />
      ) : (
        <ImagingBody patientId={patientId} system={system} onSystem={setSystem} />
      )}
    </RecordFrame>
  );
}

function ImagingBody({ patientId, system, onSystem }: { patientId: string; system: string; onSystem: (s: string) => void }) {
  const patient = patientById(patientId)!;
  const record = recordOf(patientId)!;
  const all = useMemo(() => studiesOf(patientId), [patientId]);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(
    () => all.filter((s) => system === "all" || s.systemId === system).sort((a, b) => (sort === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))),
    [all, system, sort],
  );
  const viewable = shown.filter((s) => s.kind !== null);

  if (all.length === 0) {
    const first = patient.name.split(" ")[0];
    return (
      <Card className="py-6">
        <EmptyState
          icon={<Scan />}
          title={`No imaging requested for ${first}`}
          description={`No scans have been requested, performed or uploaded for ${first}'s record. A requested study appears here as scheduled; an uploaded report appears with an illustrative render.`}
          action={
            <Button asChild variant="secondary">
              <Link href={`${recordHref(patientId, "documents")}?upload=1`}>
                <UploadSimple />
                Upload an imaging report
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  // One card per modality: how many studies, the latest one's date and its render.
  const performed = all.filter((s): s is Study & { kind: StudyKind } => s.kind !== null).sort((a, b) => b.date.localeCompare(a.date));
  const modalities = Array.from(new Set(performed.map((s) => CARD_NAME[s.kind])))
    .map((name) => {
      const list = performed.filter((s) => CARD_NAME[s.kind] === name);
      return { name, latest: list[0], count: list.length };
    })
    .sort((a, b) => b.count - a.count || b.latest.date.localeCompare(a.latest.date));
  const scheduled = all.filter((s) => s.kind === null).sort((a, b) => a.date.localeCompare(b.date));
  const systemsWithStudies = record.systems.filter((s) => all.some((x) => x.systemId === s.id));

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Studies by modality — number of studies, latest render" className="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 @[640px]:mx-0 @[640px]:px-0">
        {modalities.map((m) => (
          <MediaStatCard
            key={m.name}
            className="w-[264px] shrink-0 snap-start"
            value={m.count}
            label={`${m.name} ${m.count === 1 ? "study" : "studies"}`}
            time={`Latest ${fmtShort(m.latest.date)}${m.latest.date.slice(0, 4) !== "2026" ? ` ${m.latest.date.slice(0, 4)}` : ""}`}
            media={<StudyThumb kind={m.latest.kind} title={`${m.latest.title} (illustrative)`} />}
            onOpen={() => {
              onSystem("all");
              setOpenId(m.latest.id);
            }}
          />
        ))}
        {scheduled.length ? (
          <MediaStatCard
            className="w-[264px] shrink-0 snap-start"
            value={scheduled.length}
            label={scheduled.length === 1 ? "Study requested" : "Studies requested"}
            time={`Next ${fmtShort(scheduled[0].date)} · ${scheduled[0].title}`}
            media={
              <div className="flex size-full items-center justify-end pr-6 text-white/40" aria-hidden="true">
                <CalendarBlank size={40} />
              </div>
            }
          />
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none -mx-4 min-w-0 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:px-0">
          <Segmented<string>
            ariaLabel="Body system"
            value={system}
            onChange={onSystem}
            items={[
              { value: "all", label: "All studies", count: all.length },
              ...systemsWithStudies.map((s) => ({
                value: s.id,
                label: s.name,
                icon: <OrganThumb kind={s.organ} size="sm" className="-ml-2 bg-surface" />,
                count: all.filter((x) => x.systemId === s.id).length,
              })),
            ]}
          />
        </div>
        <Select
          ariaLabel="Sort studies"
          size="sm"
          className="w-[164px]"
          value={sort}
          onValueChange={(v) => setSort(v === "oldest" ? "oldest" : "newest")}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Scan />} title="No studies for this body system" description="Choose another system or show all studies." />
        </Card>
      ) : shown.length <= 2 && shown.every((s) => s.kind !== null) ? (
        // Few studies: a wide card each, with the report's context beside the render.
        <ul className={cn("grid grid-cols-1 gap-4", shown.length > 1 && "@[1100px]:grid-cols-2")}>
          {shown.map((s) => (
            <li key={s.id} className="min-w-0">
              <StudyFeature study={s} kind={s.kind!} patientId={patientId} onOpen={() => setOpenId(s.id)} wide={shown.length === 1} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-4 @[720px]:grid-cols-3 @[1100px]:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id} className="min-w-0">
              {s.kind ? <StudyCard study={s} kind={s.kind} patientId={patientId} onOpen={() => setOpenId(s.id)} /> : <ScheduledCard study={s} patientId={patientId} />}
            </li>
          ))}
        </ul>
      )}

      <ImagingViewer patientId={patientId} studies={viewable.length ? viewable : performed} openId={openId} onOpenChange={setOpenId} />
    </div>
  );
}

function StudyCard({ study, kind, patientId, onOpen }: { study: Study; kind: StudyKind; patientId: string; onOpen: () => void }) {
  const record = recordOf(patientId)!;
  const e = study.event;
  const condition = e ? conditionOf(record, e.conditionId) : undefined;
  const sys = systemOf(record, study.systemId);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${study.title}, ${formatDate(study.date)}, in the viewer`}
      className="group flex h-full w-full flex-col rounded-card bg-surface p-2 text-left transition-[box-shadow] duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-inner bg-black">
        <StudyThumb kind={kind} title={`${study.title} (illustrative)`} className="transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-105" />
        <span className={cn("absolute top-2 inline-flex h-6 items-center rounded-full bg-black/45 px-2.5 text-[11px] text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.24)]", badgeSide(kind))}>{MODALITY[kind].short}</span>
        {sys ? (
          <span className="absolute bottom-2 right-2 flex rounded-full ring-2 ring-black/30" title={`${sys.name} system`}>
            <OrganThumb kind={sys.organ} size="sm" className="bg-white/90" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-3">
        <span className="line-clamp-2 text-sm text-ink">{study.title}</span>
        <span className="text-xs text-muted">{formatDate(study.date)}</span>
        <span className="truncate text-xs text-muted">{peopleLine(patientId, study)}</span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {e ? <StatusBadge tone={recordTone(e.state)}>{RECORD_STATE_LABEL[e.state]}</StatusBadge> : null}
          {condition ? <span className="truncate text-xs text-ink-2">{condition.short}</span> : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Wide study card for records with one or two studies: the render beside what the record says
 * about it — the condition and organ it was done for, report date vs upload date, who reports
 * or reviews it, its review state — and the way to the viewer and the source document.
 */
function StudyFeature({ study, kind, patientId, onOpen, wide = false }: { study: Study; kind: StudyKind; patientId: string; onOpen: () => void; wide?: boolean }) {
  const record = recordOf(patientId)!;
  const e = study.event;
  const condition = e ? conditionOf(record, e.conditionId) : undefined;
  const sys = systemOf(record, study.systemId);
  const doc = study.docId ? baseDocuments(patientId).find((d) => d.id === study.docId) : undefined;
  const lag = doc ? uploadLag(doc) : null;
  const people = studyPeople(patientId, study);
  return (
    <article
      className={cn("grid h-full grid-cols-1 gap-2 rounded-card bg-surface p-2", wide ? "@[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[1100px]:grid-cols-[minmax(0,520px)_minmax(0,1fr)]" : "@[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}
      aria-label={`${study.title}, ${formatDate(study.date)}`}
    >
      <button type="button" onClick={onOpen} aria-label={`Open ${study.title} in the viewer`} className="group relative block aspect-[4/3] overflow-hidden rounded-inner bg-black">
        <StudyThumb kind={kind} title={`${study.title} (illustrative)`} className="transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-105" />
        <span className={cn("absolute top-2 inline-flex h-6 items-center rounded-full bg-black/45 px-2.5 text-[11px] text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.24)]", badgeSide(kind))}>{MODALITY[kind].long}</span>
        <span className="absolute bottom-2 left-2 text-[11px] text-white/60">Illustrative render — not diagnostic</span>
      </button>
      <div className="flex min-w-0 flex-col gap-4 p-2 @[560px]:p-4">
        <div className="min-w-0">
          <h3 className="text-lg font-normal tracking-[-0.01em] text-ink">{study.title}</h3>
          <p className="mt-1 text-xs text-muted">{peopleLine(patientId, study)}</p>
        </div>
        {sys ? (
          <p className="flex min-w-0 items-center gap-3 rounded-inner bg-canvas p-2 pr-3">
            <OrganThumb kind={sys.organ} size="lg" className="bg-surface" />
            <span className="min-w-0">
              <span className="block text-[11px] text-muted">Done for · {sys.name} system</span>
              <span className="block truncate text-sm text-ink">{condition?.name ?? systemConditionText(record, sys)}</span>
            </span>
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted">Report date</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDate(study.date)}</dd>
          </div>
          <div>
            <dt className="text-muted">Uploaded</dt>
            <dd className="mt-0.5 text-sm text-ink">{doc ? formatDate(doc.uploadedAt) : "—"}</dd>
            {lag ? <dd className={lag.late ? "text-warning" : "text-muted"}>{lag.text}</dd> : null}
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Review</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {e ? <StatusBadge tone={recordTone(e.state)}>{RECORD_STATE_LABEL[e.state]}</StatusBadge> : null}
              <span className="text-ink-2">{people.reviewerId ? `Reviewer ${authorName(people.reviewerId)}` : people.reporter ? `Reported by ${authorName(people.reporter)}` : "Reviewer not assigned"}</span>
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="dark" size="sm" leading={<Scan />} onClick={onOpen}>
            Open viewer
          </Button>
          {doc ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`${recordHref(patientId, "documents")}?doc=${doc.id}`}>
                Source document
                <ArrowUpRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function peopleLine(patientId: string, study: Study) {
  const p = studyPeople(patientId, study);
  if (p.reporter) return `${authorName(p.reporter)} · ${p.via}`;
  if (p.via) return `${p.via}${p.reviewerId ? ` · review ${authorName(p.reviewerId)}` : ""}`;
  return "Reporter not recorded";
}

function ScheduledCard({ study, patientId }: { study: Study; patientId: string }) {
  const record = recordOf(patientId)!;
  const e = study.event;
  const sys = systemOf(record, study.systemId);
  return (
    <article className="flex h-full flex-col rounded-card bg-surface p-2" aria-label={`${study.title}, scheduled ${formatDate(study.date)}`}>
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-inner bg-canvas text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-2">
          <CalendarBlank size={18} aria-hidden="true" />
        </span>
        <span className="px-4 text-xs text-muted">Images appear here once the study is reported</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-3">
        <p className="line-clamp-2 text-sm text-ink">{study.title}</p>
        <p className="text-xs text-muted">Scheduled · {formatDate(study.date)}</p>
        <p className="truncate text-xs text-muted">{e ? `Requested by ${authorName(e.authorId)}` : null}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge tone="info">Scheduled</StatusBadge>
          {sys ? <span className="truncate text-xs text-ink-2">{sys.name}</span> : null}
        </div>
      </div>
    </article>
  );
}
