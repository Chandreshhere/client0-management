"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowCounterClockwise, ArrowSquareOut, CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { RECORD_STATE_LABEL, type ScanKind } from "@/data/featured";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorAvatar, authorName } from "@/features/patient/event-meta";
import { MODALITY, TECHNIQUE, recordHref, type StudyKind } from "./data";
import { conditionOf, isFeaturedPatient, readableDates, recordOf, studyPeople, type Study } from "./record-model";
import { StudyThumb } from "./study-thumb";

/**
 * Study viewer: zoom (buttons, wheel, keyboard), pan (pointer drag / arrow keys), window
 * presets and fine brightness/contrast via CSS filters, beside the report. The image is an
 * illustrative render — the label stays on the viewport at every zoom level.
 */
type PresetId = "default" | "soft" | "bone" | "lung" | "invert";
const PRESETS: { id: PresetId; label: string; b: number; c: number; invert: boolean }[] = [
  { id: "default", label: "Default", b: 100, c: 100, invert: false },
  { id: "soft", label: "Soft tissue", b: 108, c: 85, invert: false },
  { id: "bone", label: "Bone", b: 92, c: 160, invert: false },
  { id: "lung", label: "Lung", b: 135, c: 135, invert: false },
  { id: "invert", label: "Invert", b: 100, c: 110, invert: true },
];

type View = { zoom: number; x: number; y: number };
const ZOOM_MIN = 1, ZOOM_MAX = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function clampView(v: View, w: number, h: number): View {
  const zoom = clamp(Math.round(v.zoom * 100) / 100, ZOOM_MIN, ZOOM_MAX);
  const mx = (w * (zoom - 1)) / 2, my = (h * (zoom - 1)) / 2;
  return { zoom, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
}

const isScanKind = (k: StudyKind): k is ScanKind => k !== "spine-mri" && k !== "echo-plain";

/** " · Dr. X" for the reporting clinician, " · review: Dr. X" when only the reviewer is known. */
function headerPerson(patientId: string, study: Study) {
  const p = studyPeople(patientId, study);
  if (p.reporter) return ` · ${authorName(p.reporter)}`;
  return p.reviewerId ? ` · review: ${authorName(p.reviewerId)}` : "";
}

export function ImagingViewer({ patientId, studies, openId, onOpenChange }: { patientId: string; studies: Study[]; openId: string | null; onOpenChange: (id: string | null) => void }) {
  const index = studies.findIndex((s) => s.id === openId);
  const study = index >= 0 ? studies[index] : null;
  const go = (d: -1 | 1) => {
    const next = studies[index + d];
    if (next) onOpenChange(next.id);
  };

  return (
    <Dialog open={!!study} onOpenChange={(o) => !o && onOpenChange(null)}>
      {study && study.kind ? (
        <ModalContent
          size="xl"
          title={study.title}
          description={`${MODALITY[study.kind].long} · ${formatDate(study.date)}${headerPerson(patientId, study)}`}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" leading={<CaretLeft />} disabled={index <= 0} onClick={() => go(-1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" trailing={<CaretRight />} disabled={index >= studies.length - 1} onClick={() => go(1)}>
                  Next
                </Button>
                <span className="text-xs text-muted tabular">
                  {index + 1} of {studies.length}
                </span>
              </div>
              <Button variant="dark" onClick={() => onOpenChange(null)}>
                Close viewer
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Viewport key={study.id} study={study} kind={study.kind} />
            <ReportPanel study={study} patientId={patientId} />
          </div>
        </ModalContent>
      ) : null}
    </Dialog>
  );
}

function Viewport({ study, kind }: { study: Study; kind: NonNullable<Study["kind"]> }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [preset, setPreset] = useState<PresetId>("default");
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);

  const size = () => ({ w: ref.current?.clientWidth ?? 0, h: ref.current?.clientHeight ?? 0 });
  const update = (fn: (v: View) => View) => {
    const { w, h } = size();
    setView((v) => clampView(fn(v), w, h));
  };
  const zoomBy = (f: number) => update((v) => ({ ...v, zoom: v.zoom * f }));
  const reset = () => setView({ zoom: 1, x: 0, y: 0 });

  // Wheel zoom needs a non-passive listener so the modal body doesn't scroll instead.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { clientWidth: w, clientHeight: h } = el;
      setView((v) => clampView({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12) }, w, h));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const applyPreset = (id: PresetId) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setBright(p.b);
    setContrast(p.c);
    setInvert(p.invert);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (view.zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    update((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 32;
    const keys: Record<string, () => void> = {
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
      "0": reset,
      ArrowLeft: () => update((v) => ({ ...v, x: v.x + step })),
      ArrowRight: () => update((v) => ({ ...v, x: v.x - step })),
      ArrowUp: () => update((v) => ({ ...v, y: v.y + step })),
      ArrowDown: () => update((v) => ({ ...v, y: v.y - step })),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const filter = `brightness(${bright}%) contrast(${contrast}%)${invert ? " invert(1)" : ""}`;
  const source = study.event?.source ?? "Archive";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Controls are siblings of the pannable surface so a pan's pointer capture never swallows their clicks. */}
      <div className={cn("relative aspect-[4/3] select-none overflow-hidden rounded-inner transition-colors", invert ? "bg-white" : "bg-black")}>
        <div
          ref={ref}
          role="img"
          tabIndex={0}
          aria-label={`${study.title}, illustrative render. Zoom ${Math.round(view.zoom * 100)}%. Plus and minus keys zoom, arrow keys pan, 0 resets.`}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => (view.zoom > 1 ? reset() : zoomBy(2))}
          style={{ touchAction: view.zoom > 1 ? "none" : "auto" }}
          className={cn(
            "absolute inset-0 rounded-inner outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
            view.zoom > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
          )}
        >
          <div
            className={cn("absolute inset-0 will-change-transform", !dragging && "transition-transform duration-300 [transition-timing-function:var(--ease-out-quart)]")}
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`, filter }}
          >
            <StudyThumb kind={kind} title={`${study.title} (illustrative render)`} />
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-black/55 px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]">
          Illustrative render — not diagnostic
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white/85 tabular">{Math.round(view.zoom * 100)}%</span>
        <span className="pointer-events-none absolute bottom-3 left-3 hidden rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] leading-4 text-white/85 sm:block">
          {MODALITY[kind].short} · {formatDate(study.date)}
          <br />
          {source}
        </span>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/45 p-1">
          <IconButton label="Zoom out" size="sm" variant="outline-light" onClick={() => zoomBy(0.8)} disabled={view.zoom <= ZOOM_MIN}>
            <MagnifyingGlassMinus />
          </IconButton>
          <IconButton label="Zoom in" size="sm" variant="outline-light" onClick={() => zoomBy(1.25)} disabled={view.zoom >= ZOOM_MAX}>
            <MagnifyingGlassPlus />
          </IconButton>
          <IconButton label="Reset view" size="sm" variant="outline-light" onClick={reset} disabled={view.zoom === 1 && view.x === 0 && view.y === 0}>
            <ArrowCounterClockwise />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="scrollbar-none -mx-1 overflow-x-auto px-1" data-lenis-prevent>
          <Segmented ariaLabel="Window preset" size="sm" variant="tray" value={preset} onChange={applyPreset} items={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Slider label="Brightness" value={bright} min={50} max={180} onChange={(v) => { setBright(v); setPreset("default"); }} />
          <Slider label="Contrast" value={contrast} min={50} max={200} onChange={(v) => { setContrast(v); setPreset("default"); }} />
        </div>
        <p className="text-xs text-muted">Drag to pan when zoomed · scroll or +/− to zoom · double-click to toggle 2×.</p>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-xs text-muted">
      <span className="w-[72px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-charcoal)]" />
      <span className="w-10 text-right font-mono tabular text-ink-2">{value}%</span>
    </label>
  );
}

function ReportPanel({ study, patientId }: { study: Study; patientId: string }) {
  const e = study.event;
  const kind = study.kind!;
  const record = recordOf(patientId);
  const condition = e && record ? conditionOf(record, e.conditionId) : undefined;
  const docId = study.docId;
  const people = studyPeople(patientId, study);
  // Technique lines cite the featured patient's own history; other reports don't carry one.
  const technique = isFeaturedPatient(patientId) && isScanKind(kind) ? TECHNIQUE[kind] : null;
  return (
    <aside className="flex min-w-0 flex-col gap-4" aria-label="Report">
      <div className="flex flex-wrap gap-2">
        {e ? <StatusBadge tone={recordTone(e.state)}>{RECORD_STATE_LABEL[e.state]}</StatusBadge> : null}
        {e ? <StatusBadge tone={e.released ? "info" : "neutral"} dot={false}>{e.released ? "Released to patient" : "Not released"}</StatusBadge> : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-inner bg-canvas p-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Study date</dt>
          <dd className="mt-0.5 text-ink">{formatDate(study.date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Reported</dt>
          <dd className="mt-0.5 text-ink">{e ? formatDate(e.enteredAt) : "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">{people.reporter ? "Reporting clinician" : "Assigned reviewer"}</dt>
          <dd className="mt-1 flex items-center gap-2 text-ink">
            {people.reporter || people.reviewerId ? (
              <>
                <Avatar src={authorAvatar(people.reporter ?? people.reviewerId!)} name={authorName(people.reporter ?? people.reviewerId!)} size="sm" />
                <span className="min-w-0">
                  {authorName(people.reporter ?? people.reviewerId!)} {people.reporter ? <span className="text-muted">· {people.via}</span> : null}
                </span>
              </>
            ) : (
              "Not recorded"
            )}
          </dd>
          {!people.reporter && people.via ? <dd className="mt-1 text-xs text-muted">Arrived as {people.via} — the external reporting clinician isn&apos;t recorded</dd> : null}
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Modality · linked condition</dt>
          <dd className="mt-0.5 text-ink">
            {MODALITY[kind].long}
            {condition ? <span className="text-muted"> · {condition.name}</span> : null}
          </dd>
        </div>
      </dl>

      {technique ? (
        <section>
          <h3 className="text-xs text-muted">Technique</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{technique}</p>
        </section>
      ) : null}
      <section>
        <h3 className="text-xs text-muted">Report</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink">{e?.summary ? readableDates(e.summary) : "No report text recorded."}</p>
      </section>
      <section>
        <h3 className="text-xs text-muted">Source record</h3>
        <p className="mt-1 font-mono text-xs text-ink-2">{e?.source ?? "Archive"}</p>
      </section>
      {docId ? (
        <Button asChild variant="secondary" size="sm" className="self-start">
          <Link href={`${recordHref(patientId, "documents")}?doc=${docId}`}>
            Open the report document
            <ArrowSquareOut />
          </Link>
        </Button>
      ) : null}
    </aside>
  );
}
