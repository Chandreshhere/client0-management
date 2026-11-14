"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { FileArrowUp, FileText, Lock, PencilSimpleLine, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { formatTime, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status";
import { BubbleChart } from "@/components/viz/bubble-chart";
import { SectionLabel } from "@/components/viz/cards";
import { BodyConditionCard } from "@/components/viz/condition";
import { OrganImage } from "@/components/viz/organ";
import { FocalCard, PortalHeader, Reveal } from "../ui";
import { usePortalStore } from "../store";
import { IMAGING, LAB_RESULTS, PRIMARY_DOCTOR, RECORD_YEARS, RELEASED_PAST, SYSTEMS, releasedByType } from "../record";
import { dayLabel, shortDate } from "../time";
import { PENDING, ROWS, rowFromEvent, type RecordRow } from "./data";
import { ImagingSection, LabsSection, SummariesSection } from "./sections";
import { RecordSheet } from "./record-sheet";
import { MAX_UPLOAD_MB, UploadModal, formatSize } from "./upload-modal";
import { AccessRequestCard } from "./access-form";
import { recordsStore, removeUpload } from "./store";

/**
 * /portal/records — what the care team has released to the patient, grouped by body system:
 * a bubble summary by record type (cobalt focal), system cards, lab results in plain language,
 * visit notes/letters/prescriptions, imaging, uploads and record-rights requests.
 */
export function RecordsView() {
  const state = usePortalStore(recordsStore);
  const [year, setYear] = useState(RECORD_YEARS[0] ?? 2026);
  const [systemId, setSystemId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ row: RecordRow | null; open: boolean; nonce: number }>({ row: null, open: false, nonce: 0 });
  const [upload, setUpload] = useState({ open: false, nonce: 0 });
  const [preselect, setPreselect] = useState<{ recordId: string; nonce: number } | null>(null);
  const accessRef = useRef<HTMLElement>(null);

  const system = SYSTEMS.find((s) => s.id === systemId) ?? null;
  const inScope = <T extends { systemId?: string }>(x: T) => !systemId || x.systemId === systemId;
  const rows = ROWS.filter((r) => r.date.startsWith(String(year)) && inScope(r));
  const labs = LAB_RESULTS.filter(inScope);
  const studies = IMAGING.filter(inScope);
  const yearTotal = RELEASED_PAST.filter((e) => e.date.startsWith(String(year))).length;
  const scope = `${year} · ${system ? system.area : "all body systems"}`;

  const openRow = (row: RecordRow) => setSheet((s) => ({ row, open: true, nonce: s.nonce + 1 }));
  const openUpload = () => setUpload((u) => ({ open: true, nonce: u.nonce + 1 }));
  const correct = (recordId: string) => {
    setSheet((s) => ({ ...s, open: false }));
    setPreselect((p) => ({ recordId, nonce: (p?.nonce ?? 0) + 1 }));
    window.setTimeout(() => accessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  };

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <UploadParam onUpload={openUpload} />
      </Suspense>

      <PortalHeader
        title="My records"
        description={`${pluralize(RELEASED_PAST.length, "record")} released to you${RECORD_YEARS.length > 1 ? ` across ${RECORD_YEARS.at(-1)}–${RECORD_YEARS[0]}` : ""}, grouped by body system. You see a note, report or plan once your clinician releases it.${PENDING.length ? ` ${pluralize(PENDING.length, "report")} waiting for review.` : ""}`}
        actions={
          <>
            <Button variant="dark" leading={<FileArrowUp />} onClick={openUpload}>
              Upload a report
            </Button>
            <Button
              variant="secondary"
              leading={<PencilSimpleLine />}
              onClick={() => accessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Copy or correction
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Reveal index={0}>
          <TypeBubbles year={year} onYear={setYear} systemId={systemId} total={yearTotal} />
        </Reveal>
        <Reveal index={1} className="flex flex-col gap-4">
          <section aria-labelledby="rec-systems">
            <SectionLabel
              actions={
                systemId ? (
                  <Button size="sm" variant="ghost" leading={<X />} onClick={() => setSystemId(null)}>
                    Show all
                  </Button>
                ) : null
              }
            >
              <span id="rec-systems">Records by body system · {year}</span>
            </SectionLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {SYSTEMS.map((s) => {
                const n = RELEASED_PAST.filter((e) => e.systemId === s.id && e.date.startsWith(String(year))).length;
                const open = PENDING.filter((p) => p.event.systemId === s.id).length + state.uploads.filter((u) => u.systemId === s.id).length;
                return (
                  <BodyConditionCard
                    key={s.id}
                    icon={<OrganImage kind={s.organ} variant={systemId === s.id || !systemId ? "color" : "grey"} className="size-7" />}
                    label={s.area}
                    percent={yearTotal ? Math.round((n / yearTotal) * 100) : 0}
                    progress={{ value: n, max: Math.max(1, yearTotal) }}
                    count={open}
                    active={systemId === s.id}
                    onClick={() => setSystemId((cur) => (cur === s.id ? null : s.id))}
                  >
                    <span className="block text-[11px] text-muted">
                      {pluralize(n, "record")} in {year} · {pluralize(s.conditions.length, "condition")}
                    </span>
                  </BodyConditionCard>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Share of the records released to you in {year}. The number in the circle counts reports still awaiting review.</p>
          </section>

          {PENDING.map((p) => (
            <div key={p.event.id} className="flex items-start gap-3 rounded-card bg-surface p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                <Lock size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {p.event.title} · issued {shortDate(p.event.date)}
                </span>
                <span className="block text-xs text-muted">
                  Added {dayLabel(p.event.enteredAt).toLowerCase()} {formatTime(p.event.enteredAt)} · with {p.reviewer?.name ?? "your doctor"} for review. The results show here once they&apos;re released to you.
                </span>
              </span>
              <StatusBadge tone="warning" className="hidden shrink-0 sm:inline-flex">
                Awaiting review
              </StatusBadge>
            </div>
          ))}
        </Reveal>
      </div>

      <Reveal index={2}>
        <LabsSection labs={labs} />
      </Reveal>

      <Reveal index={3}>
        <SummariesSection key={`${year}-${systemId ?? "all"}`} rows={rows} scope={scope} onOpen={openRow} />
      </Reveal>

      <Reveal index={4}>
        <ImagingSection studies={studies} onOpen={(s) => openRow(rowFromEvent(s.event))} />
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Reveal index={5}>
          <UploadsPanel uploads={state.uploads} onUpload={openUpload} />
        </Reveal>
        <Reveal index={6}>
          <AccessRequestCard ref={accessRef} requests={state.requests} preselect={preselect} />
        </Reveal>
      </div>

      <RecordSheet key={`sheet-${sheet.nonce}`} row={sheet.row} open={sheet.open} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} onCorrect={correct} />
      <UploadModal key={`upload-${upload.nonce}`} open={upload.open} onOpenChange={(o) => setUpload((u) => ({ ...u, open: o }))} />
    </div>
  );
}

/** Shorter names for record types whose bubble is too small to hold the full label. */
const SHORT_TYPE_LABEL: Record<string, string> = { Consultation: "Consult", "Clinical note": "Notes", "Vitals & tests": "Vitals", Medication: "Meds", "Lab result": "Labs" };
const BUBBLE_W = 320;
const BUBBLE_H = 230;

/**
 * The shared BubbleChart writes each label inside its bubble at 10px. Mirror its sizing (area ∝ value)
 * and swap in a short name when the full one would spill past the circle (e.g. "Consultation" on a 2).
 */
function fitLabels(items: ReturnType<typeof releasedByType>) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const scale = Math.sqrt((BUBBLE_W * BUBBLE_H * 0.42) / (Math.PI * total));
  return items.map((it) => {
    const r = Math.max(14, Math.sqrt(it.value) * scale);
    const font = Math.min(12, Math.max(10, r * 0.22));
    const fits = it.label.length * font * 0.5 <= 2 * r - 2;
    return fits || !SHORT_TYPE_LABEL[it.label] ? it : { ...it, label: SHORT_TYPE_LABEL[it.label] };
  });
}

/** Cobalt focal: released records by type for one year (bubble area = count). */
function TypeBubbles({ year, onYear, systemId, total }: { year: number; onYear: (y: number) => void; systemId: string | null; total: number }) {
  const id = useId();
  const items = fitLabels(releasedByType(year, systemId ?? undefined).slice(0, 8));
  const shown = items.reduce((a, i) => a + i.value, 0);
  const system = SYSTEMS.find((s) => s.id === systemId);
  return (
    <FocalCard labelledBy={id} className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 pb-0">
        <div className="min-w-0">
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">Released to you</span>
          <h2 id={id} className="mt-4 text-title font-normal text-white">
            {pluralize(shown, "record")} in {year}
          </h2>
          <p className="mt-1 text-sm text-white/85">{system ? `${system.area} · ${shown} of ${total} this year` : "All body systems · by type"}</p>
        </div>
        <div role="radiogroup" aria-label="Year" className="flex gap-1 rounded-full bg-white/15 p-1">
          {RECORD_YEARS.map((y) => {
            const on = y === year;
            return (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onYear(y)}
                className={cn("relative h-8 rounded-full px-3 text-xs tabular transition-colors", on ? "text-ink" : "text-white hover:bg-white/10")}
              >
                {on ? <motion.span layoutId="rec-year" transition={snappy} className="absolute inset-0 rounded-full bg-white" /> : null}
                <span className="relative z-[1]">{y}</span>
              </button>
            );
          })}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {/* flex-1 + centred: the card matches the taller column beside it, so the bubbles take the middle of
            the spare height rather than leaving it as a blank band above the bottom edge. */}
        <motion.div key={`${year}-${systemId ?? "all"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex flex-1 flex-col justify-center px-2">
          {items.length ? (
            <BubbleChart title={`Records released to you in ${year}${system ? ` · ${system.area}` : ""}, by type`} items={items} unit="records" height={BUBBLE_H} />
          ) : (
            <p className="flex h-[230px] items-center justify-center text-sm text-white/85">Nothing released for this body system in {year}.</p>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="px-4 pb-4 text-xs text-white/85">Bubble size = how many records of that type. “Vitals & tests” includes your own home logs.</p>
    </FocalCard>
  );
}

/** Patient uploads go to the clinic's intake queue and are reviewed by the primary doctor (F4). */
const REVIEWER = PRIMARY_DOCTOR;

function UploadsPanel({ uploads, onUpload }: { uploads: { id: string; title: string; type: string; reportDate: string; uploadedAt: string; fileName: string; fileSize: number; where?: string }[]; onUpload: () => void }) {
  return (
    <section aria-labelledby="rec-uploads" className="flex h-full flex-col gap-2 rounded-card bg-sunken p-2">
      <div className="flex items-center gap-3 p-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-hidden="true">
          <FileArrowUp size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="rec-uploads" className="truncate text-sm font-medium text-ink">
            My uploads
          </h2>
          <p className="truncate text-xs text-muted">Matched and reviewed by {REVIEWER?.name ?? "your doctor"} before they join your record</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onUpload}>
          Upload
        </Button>
      </div>
      {uploads.length ? (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {uploads.map((u) => (
              <motion.li key={u.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex items-start gap-3 rounded-inner bg-surface p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{u.title}</span>
                  <span className="block text-xs text-muted">
                    {u.type} · issued {shortDate(`${u.reportDate}T12:00:00+05:30`)} · uploaded {dayLabel(u.uploadedAt).toLowerCase()} {formatTime(u.uploadedAt)}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {u.fileName} · {formatSize(u.fileSize)}
                    {u.where ? ` · ${u.where}` : ""}
                  </span>
                  <StatusBadge tone="warning" className="mt-2">
                    In the intake queue
                  </StatusBadge>
                  <span className="mt-1 block text-xs text-muted">{REVIEWER?.name ?? "Your doctor"} reviews it before it joins your record — not a result until then.</span>
                </span>
                <IconButton label={`Remove ${u.title}`} variant="ghost" size="sm" onClick={() => removeUpload(u.id)}>
                  <Trash size={16} />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        // Stretched to the "your rights" card beside it: a centred empty state, not text in the top corner.
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-inner bg-surface p-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <FileArrowUp size={18} />
          </span>
          <p className="text-sm text-ink">No uploads yet</p>
          <p className="max-w-[40ch] text-xs text-muted">Got a report from another lab or hospital? Upload it with the date it was issued — the upload date is recorded separately.</p>
          <p className="text-[11px] text-faint">PDF, JPG or PNG · up to {MAX_UPLOAD_MB} MB</p>
        </div>
      )}
      <p className="px-2 pb-2 text-[11px] text-muted">Demo: files stay in this browser — nothing is uploaded to the clinic.</p>
    </section>
  );
}

/** `/portal/records?upload=1` opens the upload dialog (then tidies the URL). */
function UploadParam({ onUpload }: { onUpload: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || params.get("upload") !== "1") return;
    handled.current = true;
    onUpload();
    router.replace(pathname, { scroll: false });
  }, [params, onUpload, router, pathname]);
  return null;
}
