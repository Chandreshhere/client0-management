"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Files, ShieldCheck, UploadSimple } from "@phosphor-icons/react";
import type { ClinicalDocument, DocStatus } from "@/data/types";
import { DOC_STATUS_LABEL } from "@/data/records";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput, Switch } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useRole } from "@/components/shell/role-context";
import { ChipGroup } from "@/components/viz/cards";
import { QueryFlag, useClearQuery } from "@/features/tasks/ui";
import { byTime } from "@/features/tasks/time";
import { DOC_STATUSES, DOC_TYPES } from "./doc-meta";
import { DocTable } from "./doc-table";
import { IdentifyModal } from "./identify-modal";
import { ReviewSheet } from "./review-sheet";
import { UploadModal } from "./upload-modal";
import { ImagingStrip, QueueCard } from "./overview";
import { contentAccess, useDocuments, type CareDocument } from "./store";

const EMPTY: Record<DocStatus, { title: string; description: string }> = {
  unclassified: { title: "Nothing waiting to be identified", description: "New scans and email imports without a matched patient land here." },
  "awaiting-review": { title: "No reports waiting for review", description: "Routed reports appear here with their reviewer and due date." },
  reviewed: { title: "Nothing reviewed yet", description: "Reviewed reports wait here until they're filed to the record." },
  filed: { title: "Nothing filed yet", description: "Filed documents live on the patient's record." },
};

/** /documents — intake queue (§2A), routing without reading (§3A) and the clinician review inbox. */
export function DocumentsView() {
  const { role, user } = useRole();
  const docs = useDocuments();
  const isPatient = role === "patient";
  const [tab, setTab] = useState<DocStatus>(role === "frontdesk" ? "unclassified" : "awaiting-review");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<ClinicalDocument["type"][]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [identify, setIdentify] = useState<CareDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const clearUpload = useClearQuery("upload");

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2400);
    // Bring the new/moved row into view once the tab has re-rendered.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-doc-id="${CSS.escape(id)}"]`));
        rows.find((el) => el.offsetParent !== null)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }),
    );
  };

  const scoped = useMemo(() => (isPatient ? docs.filter((d) => d.patientId === user.id) : docs), [docs, isPatient, user.id]);
  const counts = useMemo(() => Object.fromEntries(DOC_STATUSES.map((s) => [s, scoped.filter((d) => d.status === s).length])) as Record<DocStatus, number>, [scoped]);
  const mineCount = scoped.filter((d) => d.status === tab && d.reviewerId === user.id).length;

  const q = query.trim().toLowerCase();
  const matchesSearch = useMemo(
    () => (d: CareDocument) => {
      if (mineOnly && d.reviewerId !== user.id) return false;
      if (!q) return true;
      const title = contentAccess(d, role, user.id) === "restricted" ? "restricted" : d.title;
      return `${title} ${d.type} ${d.source} ${d.uploadedBy} ${patientById(d.patientId)?.name ?? "not identified"}`.toLowerCase().includes(q);
    },
    [mineOnly, user.id, q, role],
  );
  // type chips count what each type would show in the current queue (search and "mine" applied)
  const inQueue = useMemo(() => scoped.filter((d) => (isPatient || d.status === tab) && matchesSearch(d)), [scoped, isPatient, tab, matchesSearch]);
  const typeCounts = useMemo(() => Object.fromEntries(DOC_TYPES.map((t) => [t, inQueue.filter((d) => d.type === t).length])) as Record<ClinicalDocument["type"], number>, [inQueue]);
  const typeOptions = DOC_TYPES.filter((t) => typeCounts[t] > 0 || types.includes(t)).map((t) => ({ value: t, label: t, count: typeCounts[t] }));
  // imaging strip: every imaging study in scope (all queues), narrowed by search and type chips
  const imaging = useMemo(
    () => (types.length && !types.includes("Imaging") ? [] : scoped.filter((d) => d.type === "Imaging" && matchesSearch(d)).sort((a, b) => byTime(b.uploadedAt, a.uploadedAt))),
    [scoped, types, matchesSearch],
  );

  const list = useMemo(() => {
    const rows = inQueue.filter((d) => !types.length || types.includes(d.type));
    const sorter: Record<DocStatus, (a: CareDocument, b: CareDocument) => number> = {
      unclassified: (a, b) => byTime(b.uploadedAt, a.uploadedAt),
      "awaiting-review": (a, b) => byTime(a.dueBy ?? "2100-01-01", b.dueBy ?? "2100-01-01"),
      reviewed: (a, b) => byTime(b.review?.at ?? b.uploadedAt, a.review?.at ?? a.uploadedAt),
      filed: (a, b) => byTime(b.uploadedAt, a.uploadedAt),
    };
    return rows.sort(isPatient ? (a, b) => byTime(b.uploadedAt, a.uploadedAt) : sorter[tab]);
  }, [inQueue, types, isPatient, tab]);

  const routingRole = role === "frontdesk" || role === "coordinator" || role === "admin";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow={isPatient ? undefined : "Intake & review"}
        title="Documents"
        description={
          isPatient
            ? "Your reports. Each keeps the date of the test separately from the date it was uploaded."
            : "Every report keeps two dates — when the test happened and when it reached Carelane — so an old report never reads as a new result."
        }
        actions={
          <Button variant="primary" leading={<UploadSimple />} onClick={() => setUploadOpen(true)}>
            {isPatient ? "Upload a report" : "Upload document"}
          </Button>
        }
      />

      {!isPatient && routingRole ? (
        <Card className="flex items-start gap-4 p-4 sm:items-center sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink">Routing without reading</p>
            <p className="text-xs text-muted">You can match patients, classify documents and assign reviewers. Clinical content stays hidden for your role — restricted documents show no title at all.</p>
          </div>
        </Card>
      ) : null}

      {!isPatient ? (
        <div className={cn("grid grid-cols-1 gap-6", imaging.length > 0 && "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-end")}>
          <QueueCard docs={scoped} userId={user.id} mineLabel={role === "doctor" || role === "nutritionist"} />
          <ImagingStrip docs={imaging} role={role} userId={user.id} onOpen={(d) => setOpenId(d.id)} />
        </div>
      ) : (
        <ImagingStrip docs={imaging} role={role} userId={user.id} onOpen={(d) => setOpenId(d.id)} />
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {!isPatient ? (
          <div className="scrollbar-none -mx-4 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6 xl:mx-0 xl:shrink-0 xl:px-0" data-lenis-prevent>
            <Segmented ariaLabel="Document queue" value={tab} onChange={setTab} className="w-max" items={DOC_STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABEL[s], count: counts[s] }))} />
          </div>
        ) : null}
        <SearchInput className="w-full xl:ml-auto xl:w-[300px]" placeholder={isPatient ? "Search your documents" : "Search title, patient, source"} aria-label="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
        {role === "doctor" || role === "nutritionist" ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-ink-2">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} aria-label="Only documents assigned to me" />
            Assigned to me
            <span className="rounded-full bg-sunken px-1.5 text-[11px] tabular">{mineCount}</span>
          </label>
        ) : null}
      </div>

      {typeOptions.length > 1 || types.length ? (
        <div className="-mt-2 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs text-muted">Type</span>
          <div className="scrollbar-none -mr-4 min-w-0 overflow-x-auto pr-4 lg:mr-0 lg:overflow-x-visible lg:pr-0" data-lenis-prevent>
            <ChipGroup ariaLabel="Filter by document type" className="flex-nowrap lg:flex-wrap [&>button]:shrink-0 [&>button]:whitespace-nowrap" value={types} onChange={setTypes} options={typeOptions} />
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Files />}
            title={q || mineOnly || types.length ? "No documents match" : isPatient ? "No documents yet" : EMPTY[tab].title}
            description={q || mineOnly || types.length ? "Clear the search, the type chips or the “Assigned to me” switch." : isPatient ? "Upload a report and your care team will review it." : EMPTY[tab].description}
            action={
              q || mineOnly || types.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setMineOnly(false);
                    setTypes([]);
                  }}
                >
                  Clear
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <DocTable docs={list} tab={isPatient ? "mine" : tab} role={role} userId={user.id} flashId={flashId} onOpen={(d) => setOpenId(d.id)} onIdentify={setIdentify} />
      )}

      <ReviewSheet
        docId={openId}
        onClose={() => setOpenId(null)}
        onIdentify={(d) => {
          setOpenId(null);
          setIdentify(d);
        }}
      />
      <IdentifyModal
        doc={identify}
        onClose={() => setIdentify(null)}
        onRouted={(d, status) => {
          setIdentify(null);
          setTab(status);
          setTypes([]);
          flash(d.id);
        }}
      />
      <UploadModal
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o);
          if (!o) clearUpload();
        }}
        onAdded={(d) => {
          setTab("awaiting-review");
          setMineOnly(false);
          setQuery("");
          setTypes([]);
          flash(d.id);
        }}
      />
      <Suspense fallback={null}>
        <QueryFlag name="upload" onMatch={() => setUploadOpen(true)} />
      </Suspense>
    </div>
  );
}
