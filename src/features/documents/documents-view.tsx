"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Files, ShieldCheck, UploadSimple } from "@phosphor-icons/react";
import type { ClinicalDocument } from "@/data/types";
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
import { DOC_TYPES } from "./doc-meta";
import { DocTable } from "./doc-table";
import { IdentifyModal } from "./identify-modal";
import { ReviewSheet } from "./review-sheet";
import { UploadModal } from "./upload-modal";
import { ImagingStrip, QueueCard } from "./overview";
import { DOC_QUEUES, MATCH_ROLES, QUEUE_LABEL, UPLOAD_ROLES, contentAccess, queueOf, useDocuments, type CareDocument, type DocQueue } from "./store";

const EMPTY: Record<DocQueue, { title: string; description: string }> = {
  unmatched: { title: "Intake is clear", description: "Uploads not yet matched to a patient, or not yet confirmed, wait here for the admin or Reception." },
  review: { title: "No reports waiting for review", description: "New reports go to the patient's primary doctor and wait here until they're reviewed." },
  done: { title: "Nothing reviewed yet", description: "Reviewed reports stay here and on the patient's timeline." },
  archived: { title: "Nothing archived", description: "Documents are never deleted. Archived ones are kept here, and archiving is in the activity log." },
};

/** /documents — report intake (F4): upload, match to a patient, primary-doctor review. */
export function DocumentsView() {
  const { role } = useRole();
  // Instructors see the doctor's precautions, not reports (titles alone can reveal a diagnosis).
  if (role === "yoga") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Documents" />
        <Card>
          <EmptyState
            icon={<Files />}
            title="Reports aren't part of the instructor workspace"
            description="Reports go to each patient's doctor. The precautions the doctor sets for yoga are on the patient's Yoga section, and you acknowledge them before the next session."
          />
        </Card>
      </div>
    );
  }
  return <DocumentsWorkspace />;
}

function DocumentsWorkspace() {
  const { role, user } = useRole();
  const docs = useDocuments();
  const isPatient = role === "patient";
  const routingRole = MATCH_ROLES.includes(role) || role === "coordinator";
  // Intake is the admin's and Reception's item; everyone else starts at review.
  const queues = MATCH_ROLES.includes(role) ? DOC_QUEUES : DOC_QUEUES.filter((q) => q !== "unmatched");
  const canUpload = UPLOAD_ROLES.includes(role);
  const [tab, setTab] = useState<DocQueue>(MATCH_ROLES.includes(role) ? "unmatched" : role === "doctor" || role === "coordinator" ? "review" : "done");
  const [mineOnly, setMineOnly] = useState(role === "doctor");
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

  const scoped = useMemo(() => (isPatient ? docs.filter((d) => d.patientId === user.id && !d.archived) : docs), [docs, isPatient, user.id]);
  const counts = useMemo(() => Object.fromEntries(DOC_QUEUES.map((q) => [q, scoped.filter((d) => queueOf(d) === q).length])) as Record<DocQueue, number>, [scoped]);
  const mineCount = scoped.filter((d) => queueOf(d) === tab && d.reviewerId === user.id).length;

  const q = query.trim().toLowerCase();
  const matchesSearch = useMemo(
    () => (d: CareDocument) => {
      if (mineOnly && d.reviewerId !== user.id) return false;
      if (!q) return true;
      const title = contentAccess(d, role, user.id) === "restricted" ? "restricted" : d.title;
      return `${title} ${d.fileName ?? ""} ${d.type} ${d.source} ${d.uploadedBy} ${patientById(d.patientId)?.name ?? "not matched"}`.toLowerCase().includes(q);
    },
    [mineOnly, user.id, q, role],
  );
  // type chips count what each type would show in the current queue (search and "mine" applied)
  const inQueue = useMemo(() => scoped.filter((d) => (isPatient || queueOf(d) === tab) && matchesSearch(d)), [scoped, isPatient, tab, matchesSearch]);
  const typeCounts = useMemo(() => Object.fromEntries(DOC_TYPES.map((t) => [t, inQueue.filter((d) => d.type === t).length])) as Record<ClinicalDocument["type"], number>, [inQueue]);
  const typeOptions = DOC_TYPES.filter((t) => typeCounts[t] > 0 || types.includes(t)).map((t) => ({ value: t, label: t, count: typeCounts[t] }));
  // Imaging cards lead with a finding, so they only show studies this role may read.
  const imaging = useMemo(
    () =>
      types.length && !types.includes("Imaging")
        ? []
        : scoped.filter((d) => d.type === "Imaging" && !d.archived && contentAccess(d, role, user.id) === "full" && matchesSearch(d)).sort((a, b) => byTime(b.reportDate, a.reportDate)),
    [scoped, types, matchesSearch, role, user.id],
  );

  const list = useMemo(() => {
    const rows = inQueue.filter((d) => !types.length || types.includes(d.type));
    // Work queues by urgency; everything else by date issued (never by upload date).
    const sorter: Record<DocQueue, (a: CareDocument, b: CareDocument) => number> = {
      unmatched: (a, b) => byTime(a.uploadedAt, b.uploadedAt),
      review: (a, b) => byTime(a.dueBy ?? "2100-01-01", b.dueBy ?? "2100-01-01"),
      done: (a, b) => byTime(b.reportDate, a.reportDate),
      archived: (a, b) => byTime(b.archived?.at ?? b.uploadedAt, a.archived?.at ?? a.uploadedAt),
    };
    return rows.sort(isPatient ? (a, b) => byTime(b.reportDate, a.reportDate) : sorter[tab]);
  }, [inQueue, types, isPatient, tab]);

  const filtered = q || mineOnly || types.length;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow={isPatient ? undefined : "Reports"}
        title="Documents"
        description={
          isPatient
            ? "Your reports. Each keeps the date it was issued separately from the date it was uploaded."
            : "Every report keeps the date it was issued apart from the date it was uploaded, so an old report never reads as a new result. New reports go to the patient's primary doctor for review."
        }
        actions={
          canUpload ? (
            <Button variant="primary" leading={<UploadSimple />} onClick={() => setUploadOpen(true)}>
              {isPatient ? "Upload a report" : "Upload report"}
            </Button>
          ) : undefined
        }
      />

      {routingRole ? (
        <Card className="flex items-start gap-4 p-4 sm:items-center sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink">File names and types only</p>
            <p className="text-xs text-muted">
              {MATCH_ROLES.includes(role) ? "You upload documents and match them to patients. " : ""}Clinical content opens only for the patient&apos;s care team — restricted documents show no title at all.
            </p>
          </div>
        </Card>
      ) : null}

      {!isPatient ? (
        <div className={cn("grid grid-cols-1 gap-6", imaging.length > 0 && "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-end")}>
          <QueueCard docs={scoped} userId={user.id} mineLabel={role === "doctor"} />
          <ImagingStrip docs={imaging} role={role} userId={user.id} onOpen={(d) => setOpenId(d.id)} />
        </div>
      ) : (
        <ImagingStrip docs={imaging} role={role} userId={user.id} onOpen={(d) => setOpenId(d.id)} />
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {!isPatient ? (
          <div className="scrollbar-none -mx-4 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6 xl:mx-0 xl:shrink-0 xl:px-0">
            <Segmented ariaLabel="Document queue" value={tab} onChange={setTab} className="w-max" items={queues.map((s) => ({ value: s, label: QUEUE_LABEL[s], count: counts[s] }))} />
          </div>
        ) : null}
        <SearchInput className="w-full xl:ml-auto xl:w-[300px]" placeholder={isPatient ? "Search your documents" : "Search name, type, patient"} aria-label="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
        {role === "doctor" ? (
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
          <div className="scrollbar-none -mr-4 min-w-0 overflow-x-auto pr-4 lg:mr-0 lg:overflow-x-visible lg:pr-0">
            <ChipGroup ariaLabel="Filter by document type" className="flex-nowrap lg:flex-wrap [&>button]:shrink-0 [&>button]:whitespace-nowrap" value={types} onChange={setTypes} options={typeOptions} />
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Files />}
            title={filtered ? "No documents match" : isPatient ? "No documents yet" : EMPTY[tab].title}
            description={filtered ? "Clear the search, the type chips or the “Assigned to me” switch." : isPatient ? "Upload a report and your doctor will review it." : EMPTY[tab].description}
            action={
              filtered ? (
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
          setTab(status === "awaiting-review" ? "review" : "done");
          setMineOnly(false);
          setTypes([]);
          flash(d.id);
        }}
      />
      {canUpload ? (
        <UploadModal
          open={uploadOpen}
          onOpenChange={(o) => {
            setUploadOpen(o);
            if (!o) clearUpload();
          }}
          onAdded={(d) => {
            setTab(queueOf(d));
            setMineOnly(false);
            setQuery("");
            setTypes([]);
            flash(d.id);
          }}
        />
      ) : null}
      <Suspense fallback={null}>
        <QueryFlag name="upload" onMatch={() => (canUpload ? setUploadOpen(true) : clearUpload())} />
      </Suspense>
    </div>
  );
}
