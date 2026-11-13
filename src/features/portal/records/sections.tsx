"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CaretDown, ClipboardText, FileText, Pill as PillIcon, Scan, TestTube } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { pluralize } from "@/lib/format";
import { staffById } from "@/data/staff";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { ChipGroup, MediaStatCard, SectionLabel } from "@/components/viz/cards";
import { SparkValue, VitalTile, WaveSpark } from "@/components/viz/condition";
import { MonthStrip } from "@/components/viz/timeline-scrubber";
import { ScanThumb } from "@/features/patient/scan-thumb";
import { IMAGING, STATUS_TEXT, SYSTEMS, authorName, labStatus, type ImagingStudy, type LabResult } from "../record";
import { DatedWell, RangeGauge, StatusLine } from "../viz";
import { dayOfMonth, monthShort, shortDate, weekdayShort } from "../time";
import { PENDING, ROW_KIND_LABEL, plainRange, type RecordRow, type RowKind } from "./data";

const KIND_ICON: Record<RowKind, typeof FileText> = { visit: ClipboardText, letter: FileText, prescription: PillIcon, plan: ClipboardText };
const PAGE = 8;

// ---------------------------------------------------------------------------------------------
// Visit notes, letters & prescriptions
// ---------------------------------------------------------------------------------------------

const monthName = (key: string, month: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-IN", { month, timeZone: "Asia/Kolkata" }).format(new Date(`${key}-15T12:00:00+05:30`));

export function SummariesSection({ rows, scope, onOpen }: { rows: RecordRow[]; scope: string; onOpen: (r: RecordRow) => void }) {
  const kinds = (Object.keys(ROW_KIND_LABEL) as RowKind[]).filter((k) => rows.some((r) => r.kind === k));
  const [on, setOn] = useState<RowKind[]>([]);
  const [month, setMonth] = useState("");
  const [all, setAll] = useState(false);
  const byKind = on.length ? rows.filter((r) => on.includes(r.kind)) : rows;
  const shown = month ? byKind.filter((r) => r.date.startsWith(month)) : byKind;
  const visible = all ? shown : shown.slice(0, PAGE);
  const months = Array.from(new Set(byKind.map((r) => r.date.slice(0, 7)))).sort();

  return (
    <section aria-labelledby="rec-summaries" className="flex flex-col gap-3">
      <SectionLabel
        actions={
          kinds.length > 1 ? (
            <ChipGroup<RowKind>
              ariaLabel="Filter by kind"
              variant="dot"
              value={on}
              onChange={(v) => {
                setOn(v);
                setMonth("");
                setAll(false);
              }}
              options={kinds.map((k) => ({ value: k, label: ROW_KIND_LABEL[k], count: rows.filter((r) => r.kind === k).length }))}
            />
          ) : null
        }
        className="mb-0 flex-wrap"
      >
        <span id="rec-summaries">Visit notes, letters & prescriptions · {scope}</span>
      </SectionLabel>
      {months.length > 1 ? (
        <div className="flex flex-col gap-2">
          <MonthStrip
            active={month}
            onSelect={(k) => {
              setMonth((cur) => (cur === k ? "" : k));
              setAll(false);
            }}
            months={months.map((k) => {
              const inMonth = byKind.filter((r) => r.date.startsWith(k)).sort((a, b) => a.date.localeCompare(b.date));
              return {
                key: k,
                label: `${monthName(k)} · ${inMonth.length}`,
                items: inMonth.map((r) => {
                  const Icon = KIND_ICON[r.kind];
                  return { id: r.id, icon: <Icon />, label: `${ROW_KIND_LABEL[r.kind]} · ${r.title} · ${shortDate(`${r.date}T12:00:00+05:30`)}` };
                }),
              };
            })}
          />
          <p className="text-xs text-muted">
            {month
              ? `Showing ${monthName(month, "long")} · ${pluralize(shown.length, "record")}. Tap the month again to show all.`
              : "Each bubble is one released record that month (first four shown; icon = kind). Tap a month to show only its records."}
          </p>
        </div>
      ) : null}
      {visible.length ? (
        <ul className="flex flex-col gap-2 rounded-card bg-sunken p-2">
          <AnimatePresence initial={false}>
            {visible.map((r) => (
              <motion.li key={r.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={spring}>
                <Row row={r} onOpen={() => onOpen(r)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <EmptyState icon={<FileText />} title="Nothing released here yet" description={month ? "Try another month, or tap the month again to show all." : "Try another year or body system."} className="bg-sunken" />
      )}
      {shown.length > PAGE ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll((v) => !v)} trailing={<CaretDown className={cn("transition-transform", all && "rotate-180")} />}>
          {all ? "Show fewer" : `Show all ${shown.length}`}
        </Button>
      ) : null}
    </section>
  );
}

function Row({ row, onOpen }: { row: RecordRow; onOpen: () => void }) {
  const Icon = KIND_ICON[row.kind];
  const iso = `${row.date}T12:00:00+05:30`;
  const system = SYSTEMS.find((s) => s.id === row.systemId);
  const staff = staffById(row.authorId);
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-4 rounded-inner bg-surface p-4 text-left transition-colors hover:bg-canvas">
      <span className="hidden size-14 shrink-0 flex-col items-center justify-center rounded-[12px] bg-sunken text-center sm:flex" aria-hidden="true">
        <span className="text-[11px] text-muted">{weekdayShort(iso)}</span>
        <span className="text-lg leading-none text-ink tabular">{dayOfMonth(iso)}</span>
        <span className="text-[11px] text-muted">{monthShort(iso)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon size={14} aria-hidden="true" />
            {ROW_KIND_LABEL[row.kind]}
          </span>
          <span className="sm:hidden">{shortDate(iso)}</span>
          {system ? <span>{system.area}</span> : null}
        </span>
        <span className="mt-1 block text-base text-ink">{row.title}</span>
        <span className="mt-1 line-clamp-2 block text-sm text-ink-2">{row.summary}</span>
        <span className="mt-2 block text-xs text-muted">
          {staff?.name ?? row.author} · {row.role}
          {row.enteredAt.slice(0, 10) !== row.date ? ` · added ${shortDate(row.enteredAt)}` : ""}
        </span>
      </span>
      <StatusBadge tone="success" className="hidden shrink-0 md:inline-flex">
        {row.state}
      </StatusBadge>
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Lab results in plain language (released reports only)
// ---------------------------------------------------------------------------------------------

export function LabsSection({ labs }: { labs: LabResult[] }) {
  return (
    <section aria-labelledby="rec-labs" className="flex flex-col gap-3">
      <SectionLabel className="mb-0">
        <span id="rec-labs">Lab results · from reports released to you</span>
      </SectionLabel>
      {PENDING.length ? (
        <p className="text-xs text-muted">
          {PENDING.map((p) => `${p.event.title} (${shortDate(p.event.date)}) is with ${p.reviewer?.name ?? "your doctor"} for review`).join(" · ")} — its results aren&apos;t shown until released.
        </p>
      ) : null}
      {labs.length ? (
        <div className="flex flex-col gap-6">
          {Array.from(new Set(labs.map((l) => l.panel))).map((panel) => {
            const inPanel = labs.filter((l) => l.panel === panel);
            const watch = inPanel.filter((l) => !["on", "none"].includes(labStatus(l))).length;
            return (
              <div key={panel} className="flex flex-col gap-3">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink">
                  {panel}
                  <span className="text-xs text-muted">
                    {pluralize(inPanel.length, "result")} · {watch ? `${watch} outside target` : "all on target"} · latest {shortDate(inPanel.map((l) => l.points.at(-1)!.date).sort().at(-1)!)}
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {inPanel.map((l) => (
                    <LabTile key={l.id} lab={l} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<TestTube />} title="No lab results for this body system" className="bg-sunken" />
      )}
    </section>
  );
}

const fmtLab = (l: LabResult, v: number) => (l.points.some((p) => !Number.isInteger(p.value)) ? (Math.abs(v) < 1 ? v.toFixed(2) : v.toFixed(1)) : String(v));

function LabTile({ lab }: { lab: LabResult }) {
  const last = lab.points.at(-1)!;
  const first = lab.points[0];
  const status = labStatus(lab);
  const tone = status === "on" ? "good" : status === "none" ? "neutral" : "watch";
  const values = lab.points.map((p) => p.value);
  const threshold = lab.high ?? lab.low ?? last.value;
  return (
    <figure>
      <VitalTile
        icon={<TestTube />}
        label={`${lab.name} · ${shortDate(last.date)}`}
        value={fmtLab(lab, last.value)}
        unit={lab.unit}
        chart={
          lab.points.length > 1 ? (
            <DatedWell from={shortDate(first.date)} to={shortDate(last.date)}>
              <WaveSpark values={values} label={`${lab.name}: ${lab.points.map((p) => `${fmtLab(lab, p.value)} on ${shortDate(p.date)}`).join(", ")}`} />
            </DatedWell>
          ) : (
            <RangeGauge
              min={+(threshold * 0.6).toFixed(2)}
              max={+(threshold * 1.4).toFixed(2)}
              value={last.value}
              threshold={threshold}
              good={lab.high !== undefined ? "below" : "above"}
              format={(v) => fmtLab(lab, v)}
              label={`${lab.name} ${fmtLab(lab, last.value)} ${lab.unit}; ${plainRange(lab)}`}
              className="py-2"
            />
          )
        }
        aside={<SparkValue value={fmtLab(lab, last.value)} sub={lab.unit || undefined} />}
      />
      <figcaption className="flex flex-col gap-1 px-2 pt-2">
        <span className="text-xs text-ink-2">{lab.plain}</span>
        <StatusLine tone={tone}>
          {STATUS_TEXT[status]} · {plainRange(lab)}
        </StatusLine>
        <span className="text-[11px] text-muted">
          {lab.newerWithheld ? "A newer result is with your doctor for review · " : ""}
          {lab.points.length > 1 ? `${pluralize(lab.points.length, "released result")} since ${shortDate(first.date)}` : "First released result"}
        </span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------
// Imaging (released studies; pictures are illustrative)
// ---------------------------------------------------------------------------------------------

export function ImagingSection({ studies, onOpen }: { studies: ImagingStudy[]; onOpen: (s: ImagingStudy) => void }) {
  return (
    <section id="imaging" aria-labelledby="rec-imaging" className="flex scroll-mt-24 flex-col gap-3">
      <SectionLabel className="mb-0">
        <span id="rec-imaging">Scans & imaging · {pluralize(studies.length, "released report")}</span>
      </SectionLabel>
      {studies.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {studies.map((s) => (
            <figure key={s.id}>
              <MediaStatCard
                value={s.finding?.value ?? "Report"}
                label={s.finding?.label ?? s.title}
                time={shortDate(s.date)}
                media={<ScanThumb kind={s.kind} title={`Illustrative ${s.title} thumbnail — not your actual image`} />}
                onOpen={() => onOpen(s)}
              />
              <figcaption className="flex flex-col gap-0.5 px-2 pt-2">
                <span className="text-xs text-ink-2">{s.title}</span>
                <span className="text-[11px] text-muted">
                  {authorName(s.event)} · {SYSTEMS.find((x) => x.id === s.systemId)?.area}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Scan />} title="No imaging for this body system" className="bg-sunken" />
      )}
      {IMAGING.length ? <p className="text-xs text-muted">Pictures are illustrative — the number is read from the released report. Open a card for the full report.</p> : null}
    </section>
  );
}
