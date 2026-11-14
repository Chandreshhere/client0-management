"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChartLine, FileText, Flask, Minus, Table as TableIcon } from "@phosphor-icons/react";
import { CARE_EVENTS } from "@/data/featured";
import { patientById } from "@/data/patients";
import { useRole } from "@/components/shell/role-context";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { MediaStatCard, SectionLabel } from "@/components/viz/cards";
import { BodyConditionCard } from "@/components/viz/condition";
import { Sparkline } from "@/components/charts/bar-chart";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorName } from "@/features/patient/event-meta";
import { DOC_EVENT, EXTRA_DOCUMENTS, LAB_PLAN_THRESHOLDS, recordHref } from "./data";
import { clinicalAccess } from "./access";
import { useRecord } from "./store";
import { NoRecordState, OrganThumb, RecordFrame, RestrictedRecord } from "./record-frame";
import { TrendChart, TrendKey, type TrendThreshold } from "./trend-chart";
import { TargetGauge } from "./sparks";
import { docIdForEvent, eventById, isFeaturedPatient, labGroups, recordOf, systemOf, untranscribedLabDocs, type Flag, type LabAnalyte, type LabGroup } from "./record-model";

const fmtShort = (d: string) => formatDate(d, { day: "numeric", month: "short" });
const fmtLong = (d: string) => formatDate(d, { day: "numeric", month: "short", year: "numeric" });
const fmtV = (a: LabAnalyte, v: number) => v.toFixed(a.decimals);

/** Featured patient: lab events by report date (source and review state for each column). */
const KABIR_LAB_EVENTS = CARE_EVENTS.filter((e) => e.type === "lab");
const KABIR_DOC_FOR_EVENT: Record<string, string> = Object.fromEntries([
  ...Object.entries(DOC_EVENT).map(([doc, ev]) => [ev, doc]),
  ...EXTRA_DOCUMENTS.filter((d) => d.eventId).map((d) => [d.eventId!, d.id]),
]);

type PointMeta = { pending: boolean; lab: string; ref: string; docId?: string };

function FlagText({ flag }: { flag: Flag }) {
  if (!flag) return null;
  return <span className={cn("rounded-full px-1.5 text-[11px] leading-5", flag === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{flag === "high" ? "High" : "Low"}</span>;
}

const rangeNoun = (a: LabAnalyte) => (a.isTarget ? "target" : "reference range");

/** Results from the last 12 months (all on file when none are that recent). */
const YEAR_AGO = "2025-11-13";

/**
 * Share of a group's results inside their target / reference range: every reported value of
 * every test that has one, over the last 12 months (falls back to everything on file). This is
 * the number the body-condition card prints — the caption says exactly what it counts.
 */
function groupShare(g: LabGroup) {
  const all = g.analytes.filter((a) => a.low !== undefined || a.high !== undefined).flatMap((a) => a.points);
  const recent = all.filter((p) => p.d >= YEAR_AGO);
  const pts = recent.length ? recent : all;
  const within = pts.filter((p) => !p.flag).length;
  return { within, total: pts.length, recent: recent.length > 0, percent: pts.length ? Math.round((within / pts.length) * 100) : 0 };
}

/** Reports in a group still awaiting clinician review (a panel report counts once). */
function pendingCount(g: LabGroup, metaFor: MetaFor, featured: boolean) {
  const keys = new Set<string>();
  for (const a of g.analytes) for (const p of a.points) if (metaFor(a, p.d, p.eventId).pending) keys.add(featured ? p.d : (p.eventId ?? p.d));
  return keys.size;
}

/** In the two-column card grids (from 560px), an odd last card spans both columns instead of leaving a hole. */
const loneLast = (i: number, n: number) => (n > 1 && n % 2 === 1 && i === n - 1 ? "@[560px]:col-span-2" : undefined);

export function LabsTab({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role } = useRole();
  const access = clinicalAccess(role, patientId);
  const record = recordOf(patientId);
  const groups = useMemo(() => labGroups(patientId), [patientId]);
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  return (
    <RecordFrame
      patient={patient}
      focusSystemId={group?.systemId}
      title="Lab results"
      description="Results by report date — the day the sample was taken, not the day the report arrived. Flags compare each value with its target or the lab's reference range."
    >
      {!record ? (
        <NoRecordState patient={patient} tab="labs" />
      ) : access === "none" ? (
        <RestrictedRecord role={role} tab="labs" />
      ) : (
        <LabsBody patientId={patientId} groups={groups} group={group} onGroup={setGroupId} />
      )}
    </RecordFrame>
  );
}

function LabsBody({ patientId, groups, group, onGroup }: { patientId: string; groups: LabGroup[]; group: LabGroup | undefined; onGroup: (id: string) => void }) {
  const featured = isFeaturedPatient(patientId);
  const record = recordOf(patientId)!;
  const reviews = useRecord((s) => s.reviews);
  const pendingDocs = untranscribedLabDocs(patientId);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const analyte = group ? (group.analytes.find((a) => a.key === selected[group.id]) ?? group.analytes[0]) : undefined;

  /** Review state and source report for one result. */
  const metaFor = useMemo(() => {
    return (a: LabAnalyte, d: string, eventId?: string): PointMeta => {
      if (featured) {
        const sameDay = KABIR_LAB_EVENTS.filter((x) => x.date === d);
        // attribute a report only when it actually carries one of this panel's analytes
        const match = sameDay.find((x) => x.values?.some((v) => v.label === a.name)) ?? sameDay.find((x) => x.values?.some((v) => group?.analytes.some((g) => g.name === v.label)));
        const reviewed = (id: string) => !!KABIR_DOC_FOR_EVENT[id] && !!reviews[KABIR_DOC_FOR_EVENT[id]];
        const pending = sameDay.some((x) => x.state === "awaiting-review" && !reviewed(x.id));
        const ev = match ?? sameDay[0];
        return { pending, lab: ev ? authorName(ev.authorId) : "Lab partner", ref: match ? match.source : "Panel archive record", docId: match ? KABIR_DOC_FOR_EVENT[match.id] : undefined };
      }
      const ev = eventById(record, eventId);
      const docId = docIdForEvent(patientId, eventId);
      return { pending: ev?.state === "awaiting-review" && !(docId && reviews[docId]), lab: ev ? authorName(ev.authorId) : "Lab partner", ref: ev?.source ?? "—", docId };
    };
  }, [featured, group, record, patientId, reviews]);

  if (!groups.length || !group || !analyte) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="py-6">
          <EmptyState
            icon={<Flask />}
            title="No transcribed lab values on this record"
            description={pendingDocs.length ? "The reports below are on file, but their values haven't been entered as structured results — open each report to read it." : "No laboratory tests have been requested or uploaded for this patient yet."}
          />
        </Card>
        {pendingDocs.length ? <UntranscribedReports patientId={patientId} docs={pendingDocs} /> : null}
      </div>
    );
  }

  const select = (key: string) => setSelected((s) => ({ ...s, [group.id]: key }));
  const systemFor = (g: LabGroup) => (g.systemId ? systemOf(record, g.systemId) : undefined);
  // Featured: the selected panel's tests. Generated records: every test on file (≤ 4), across systems.
  const cards = (featured ? group.analytes.map((a) => ({ a, g: group })) : groups.flatMap((g) => g.analytes.map((a) => ({ a, g })))).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 @[1040px]:grid-cols-2">
        <section aria-label={featured ? "Results within range, by panel" : "Results within target, by body system"} className="min-w-0">
          <SectionLabel>{featured ? "Within range · by panel" : "Within target · by body system"}</SectionLabel>
          <div className={cn("grid grid-cols-1 gap-3", groups.length > 1 && "@[560px]:grid-cols-2")}>
            {groups.map((g, i) => {
              const share = groupShare(g);
              const s = systemFor(g);
              const open = pendingCount(g, metaFor, featured);
              return (
                <BodyConditionCard
                  key={g.id}
                  icon={s ? <OrganThumb kind={s.organ} className="size-9 bg-surface" /> : <Flask />}
                  label={g.name}
                  percent={share.percent}
                  progress={{ value: share.within, max: share.total }}
                  count={open || undefined}
                  active={groups.length > 1 && g.id === group.id}
                  onClick={groups.length > 1 ? () => onGroup(g.id) : undefined}
                  className={loneLast(i, groups.length)}
                >
                  <span className="block text-[11px] leading-snug text-muted">
                    {share.within} of {share.total} {share.total === 1 ? "result" : "results"} {g.analytes.every((a) => a.isTarget) ? "on target" : "in range"} · {share.recent ? "last 12 months" : "all on file (none in the last 12 months)"}
                    {open ? ` · ${open} awaiting review` : ""}
                  </span>
                </BodyConditionCard>
              );
            })}
          </div>
        </section>

        <section aria-label="Latest result per test" className="min-w-0">
          <SectionLabel>Latest result per test</SectionLabel>
          <div className={cn("grid grid-cols-1 gap-3", cards.length > 1 && "@[560px]:grid-cols-2")}>
            {cards.map(({ a, g }, i) => {
              const latest = a.points[a.points.length - 1];
              const on = g.id === group.id && a.key === analyte.key;
              const meta = metaFor(a, latest.d, latest.eventId);
              return (
                <MediaStatCard
                  key={`${g.id}-${a.key}`}
                  className={cn("transition-shadow duration-200", on && "shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-ink)]", loneLast(i, cards.length))}
                  value={
                    <>
                      {fmtV(a, latest.v)}
                      {a.unit ? <span className="ml-1 text-sm text-white/60">{a.unit}</span> : null}
                    </>
                  }
                  label={a.name}
                  time={`${fmtShort(latest.d)}${latest.flag ? ` · ${latest.flag === "high" ? "High" : "Low"}` : ""}${meta.pending ? " · awaiting review" : ""}`}
                  onOpen={() => {
                    onGroup(g.id);
                    setSelected((s) => ({ ...s, [g.id]: a.key }));
                  }}
                  media={
                    <div className="flex size-full items-center justify-end pr-4" role="img" aria-label={a.points.length > 1 ? `${a.name}: ${a.points.length} results, oldest to newest, latest ${fmtV(a, latest.v)} ${a.unit}` : `${a.name}: first result`}>
                      {a.points.length > 1 ? <Sparkline tone="white" className="h-12 w-[112px]" values={a.points.map((p) => p.v)} /> : <span className="text-[11px] text-white/60">first result</span>}
                    </div>
                  }
                />
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 @[1040px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {featured ? (
          <PanelMatrix group={group} selected={analyte.key} onSelect={select} metaFor={metaFor} patientId={patientId} />
        ) : (
          <ResultList group={group} selected={analyte.key} onSelect={select} metaFor={metaFor} patientId={patientId} />
        )}
        <AnalyteCard key={`${group.id}-${analyte.key}`} analyte={analyte} metaFor={metaFor} patientId={patientId} />
      </div>

      {pendingDocs.length ? <UntranscribedReports patientId={patientId} docs={pendingDocs} /> : null}
    </div>
  );
}

type MetaFor = (a: LabAnalyte, d: string, eventId?: string) => PointMeta;

/** Featured patient's cumulative panel: report dates as columns, analytes as rows. */
function PanelMatrix({ group, selected, onSelect, metaFor, patientId }: { group: LabGroup; selected: string; onSelect: (k: string) => void; metaFor: MetaFor; patientId: string }) {
  const dates = Array.from(new Set(group.analytes.flatMap((a) => a.points.map((p) => p.d)))).sort();
  const lead = group.analytes[0];
  return (
    <Card padded={false} className="flex min-w-0 flex-col">
      <div className="px-6 pb-4 pt-6">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">{group.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {dates.length} report dates · {group.analytes.length} analytes · select a row to chart it
        </p>
      </div>
      <div className="scrollbar-thin relative overflow-x-auto pb-2">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{group.name} results by report date. Select an analyte row to chart it.</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-surface py-2 pl-6 pr-3 text-left text-xs font-normal text-muted">
                Analyte
              </th>
              {dates.map((d) => (
                <th key={d} scope="col" className="px-3 py-2 text-right align-bottom text-xs font-normal text-muted last:pr-6">
                  <span className="block whitespace-nowrap text-ink-2">{fmtShort(d)}</span>
                  <span className="block">{d.slice(0, 4)}</span>
                  {metaFor(lead, d).pending ? <span className="mt-1 block whitespace-nowrap text-[11px] text-warning">Awaiting review</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.analytes.map((a) => {
              const active = a.key === selected;
              return (
                <tr key={a.key} onClick={() => onSelect(a.key)} className={cn("cursor-pointer transition-colors", active ? "bg-sunken" : "hover:bg-canvas")}>
                  <th scope="row" className={cn("sticky left-0 z-[1] py-3 pl-6 pr-3 text-left font-normal transition-colors", active ? "bg-sunken" : "bg-surface")}>
                    <AnalyteButton a={a} active={active} onSelect={onSelect} />
                  </th>
                  {dates.map((d) => {
                    const p = a.points.find((x) => x.d === d);
                    return (
                      <td key={d} className="whitespace-nowrap px-3 py-3 text-right tabular last:pr-6">
                        {p ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span className={cn(p.flag ? "text-ink" : "text-ink-2")}>{fmtV(a, p.v)}</span>
                            <FlagText flag={p.flag} />
                          </span>
                        ) : (
                          <span className="text-faint">
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Not tested</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SourceReports items={[...dates].reverse().map((d) => ({ d, meta: metaFor(lead, d) }))} patientId={patientId} />
    </Card>
  );
}

function AnalyteButton({ a, active, onSelect }: { a: LabAnalyte; active: boolean; onSelect: (k: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(a.key);
      }}
      className="flex items-center gap-2 rounded-md text-left"
    >
      <span className={cn("size-2 shrink-0 rounded-full", active ? "bg-primary" : "bg-line-strong")} aria-hidden="true" />
      <span>
        <span className="block text-ink">{a.name}</span>
        <span className="block whitespace-nowrap text-xs text-muted">
          {a.unit ? `${a.unit} · ` : ""}
          {a.isTarget ? "target " : ""}
          {a.rangeText}
        </span>
      </span>
    </button>
  );
}

/** Generated records: one row per test — latest, previous, change and how many reports. */
function ResultList({ group, selected, onSelect, metaFor, patientId }: { group: LabGroup; selected: string; onSelect: (k: string) => void; metaFor: MetaFor; patientId: string }) {
  const reports = group.analytes
    .flatMap((a) => a.points.map((p) => ({ a, p })))
    .sort((x, y) => y.p.d.localeCompare(x.p.d))
    .slice(0, 6);
  return (
    <Card padded={false} className="flex min-w-0 flex-col">
      <div className="px-6 pb-4 pt-6">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">{group.name} · results</h2>
        <p className="mt-1 text-sm text-muted">
          {group.analytes.length} {group.analytes.length === 1 ? "test" : "tests"} · {group.analytes.reduce((n, a) => n + a.points.length, 0)} reports · select a row to chart it
        </p>
      </div>
      <div className="scrollbar-thin relative overflow-x-auto pb-2">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{group.name} results: latest and previous value per test.</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="sticky left-0 z-[1] bg-surface py-2 pl-6 pr-3 text-left font-normal">
                Test
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Latest
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Previous
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Change
              </th>
              <th scope="col" className="py-2 pl-3 pr-6 text-right font-normal">
                Reports
              </th>
            </tr>
          </thead>
          <tbody>
            {group.analytes.map((a) => {
              const active = a.key === selected;
              const n = a.points.length;
              const last = a.points[n - 1], prev = a.points[n - 2];
              const diff = prev ? +(last.v - prev.v).toFixed(a.decimals) : null;
              const DirIcon = diff === null || diff === 0 ? Minus : diff > 0 ? ArrowUp : ArrowDown;
              return (
                <tr key={a.key} onClick={() => onSelect(a.key)} className={cn("cursor-pointer transition-colors", active ? "bg-sunken" : "hover:bg-canvas")}>
                  <th scope="row" className={cn("sticky left-0 z-[1] border-t border-line py-3 pl-6 pr-3 text-left font-normal transition-colors", active ? "bg-sunken" : "bg-surface")}>
                    <AnalyteButton a={a} active={active} onSelect={onSelect} />
                  </th>
                  <td className="whitespace-nowrap border-t border-line px-3 py-3 text-right align-middle tabular">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="text-ink">{fmtV(a, last.v)}</span>
                      <FlagText flag={last.flag} />
                    </span>
                    <span className="block text-xs text-muted">
                      {fmtShort(last.d)}
                      {metaFor(a, last.d, last.eventId).pending ? <span className="text-warning"> · awaiting review</span> : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-t border-line px-3 py-3 text-right align-middle tabular text-ink-2">
                    {prev ? (
                      <>
                        {fmtV(a, prev.v)}
                        <span className="block text-xs text-muted">{fmtShort(prev.d)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">First result</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-t border-line px-3 py-3 text-right align-middle tabular text-ink-2">
                    {diff === 0 ? (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <DirIcon size={12} aria-hidden="true" />
                        No change
                      </span>
                    ) : diff !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <DirIcon size={12} aria-hidden="true" />
                        {diff > 0 ? "+" : "−"}
                        {Math.abs(diff).toFixed(a.decimals)}
                        <span className="sr-only">{diff > 0 ? " higher" : " lower"} than the previous result</span>
                      </span>
                    ) : (
                      <span className="text-faint" aria-hidden="true">
                        —
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-t border-line py-3 pl-3 pr-6 text-right align-middle tabular text-ink-2">{n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SourceReports title="Latest source reports" items={reports.map(({ a, p }) => ({ d: p.d, meta: metaFor(a, p.d, p.eventId), note: `${a.name} ${fmtV(a, p.v)}${a.unit ? ` ${a.unit}` : ""}` }))} patientId={patientId} />
    </Card>
  );
}

function SourceReports({ items, patientId, title = "Source reports" }: { items: { d: string; meta: PointMeta; note?: string }[]; patientId: string; title?: string }) {
  return (
    <div className="mt-auto border-t border-line px-6 pb-4 pt-4">
      <h3 className="text-xs text-muted">{title}</h3>
      <ul className="mt-1 flex flex-col">
        {items.map(({ d, meta, note }, i) => (
          <li key={`${d}-${i}`} className="flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-0">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-2">
                {fmtLong(d)}
                {note ? <span className="text-muted"> · {note}</span> : null}
              </span>
              <span className="block truncate text-xs text-muted">
                {meta.lab} · <span className="font-mono">{meta.ref}</span>
              </span>
            </span>
            {meta.pending ? <StatusBadge tone="warning">Awaiting review</StatusBadge> : <span className="hidden text-xs text-muted @[480px]:inline">Reviewed</span>}
            {meta.docId ? (
              <IconButton asChild label={`Open the ${fmtLong(d)} report`} size="sm" variant="ghost" tooltip="left">
                <Link href={`${recordHref(patientId, "documents")}?doc=${meta.docId}`}>
                  <ArrowUpRight />
                </Link>
              </IconButton>
            ) : (
              <span className="size-8 shrink-0" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyteCard({ analyte, metaFor, patientId }: { analyte: LabAnalyte; metaFor: MetaFor; patientId: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const pts = analyte.points;
  const latest = pts[pts.length - 1];
  const latestMeta = metaFor(analyte, latest.d, latest.eventId);
  const range = analyte.low !== undefined || analyte.high !== undefined ? { low: analyte.low, high: analyte.high, label: `${analyte.isTarget ? "Target" : "Reference"} ${analyte.rangeText}${analyte.unit ? ` ${analyte.unit}` : ""}` } : undefined;
  const thresholds: TrendThreshold[] = [
    ...(analyte.low !== undefined ? [{ value: analyte.low, label: analyte.isTarget ? `Target ≥ ${analyte.low}` : `Low < ${analyte.low}` }] : []),
    ...(analyte.high !== undefined ? [{ value: analyte.high, label: analyte.isTarget ? `Target < ${analyte.high}` : `High > ${analyte.high}` }] : []),
    ...(isFeaturedPatient(patientId) ? (LAB_PLAN_THRESHOLDS[analyte.name] ?? []) : []),
  ];

  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">{analyte.name}</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{fmtV(analyte, latest.v)}</span>
            <span className="text-sm text-muted">{analyte.unit}</span>
            <FlagText flag={latest.flag} />
          </p>
          <p className="mt-2 text-xs text-muted">
            Latest · {fmtLong(latest.d)}
            {latestMeta.pending ? <span className="text-warning"> · awaiting review</span> : null}
          </p>
        </div>
        <Segmented
          ariaLabel="View"
          size="sm"
          variant="tray"
          value={view}
          onChange={setView}
          items={[
            { value: "chart", label: "Chart", icon: <ChartLine /> },
            { value: "table", label: "Table view", icon: <TableIcon /> },
          ]}
        />
      </div>

      {view === "chart" ? (
        pts.length > 1 ? (
          <div className="flex flex-col gap-3">
            <TrendChart
              height={232}
              ariaLabel={`${analyte.name} trend, ${pts.length} results, latest ${fmtV(analyte, latest.v)} ${analyte.unit} on ${fmtLong(latest.d)}. ${range?.label ?? "No target recorded"}. Use left and right arrow keys to read values.`}
              series={[{ id: analyte.key, name: `${analyte.name}${analyte.unit ? ` · ${analyte.unit}` : ""}`, color: "var(--color-medical)", points: pts.map((p) => ({ x: p.d, y: p.v })) }]}
              range={range}
              thresholds={thresholds}
              formatY={(v) => (analyte.decimals ? v.toFixed(Number.isInteger(v) ? 0 : Math.min(2, analyte.decimals)) : String(v))}
            />
            <TrendKey range={range} thresholds={thresholds} />
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-inner bg-canvas p-4">
            <div className="h-[72px] rounded-[12px] bg-surface px-4">
              <TargetGauge value={latest.v} low={analyte.low} high={analyte.high} unit={analyte.unit} decimals={analyte.decimals} caption={analyte.name} />
            </div>
            <p className="text-sm text-muted">
              One result so far — {fmtV(analyte, latest.v)} {analyte.unit} on {fmtLong(latest.d)}. The trend line appears from the second report.
            </p>
            {range ? <TrendKey range={range} /> : null}
          </div>
        )
      ) : (
        <div className="scrollbar-thin relative -mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">{analyte.name} results</caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="pb-2 text-left font-normal">Report date</th>
                <th scope="col" className="pb-2 text-right font-normal">Value</th>
                <th scope="col" className="pb-2 pl-4 text-left font-normal">Review</th>
                <th scope="col" className="pb-2 pl-4 text-left font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {[...pts].reverse().map((p) => {
                const m = metaFor(analyte, p.d, p.eventId);
                return (
                  <tr key={`${p.d}-${p.eventId ?? ""}`} className="border-t border-line">
                    <td className="py-2.5 text-ink-2">{fmtLong(p.d)}</td>
                    <td className="py-2.5 text-right tabular">
                      <span className="inline-flex items-center gap-1.5">
                        {fmtV(analyte, p.v)} <span className="text-xs text-muted">{analyte.unit}</span>
                        <FlagText flag={p.flag} />
                      </span>
                    </td>
                    <td className="py-2.5 pl-4">{m.pending ? <StatusBadge tone="warning">Awaiting review</StatusBadge> : <span className="text-xs text-muted">Reviewed</span>}</td>
                    <td className="py-2.5 pl-4 text-xs text-muted">
                      {m.lab} · <span className="font-mono">{m.ref}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-inner bg-canvas p-4">
        <h3 className="text-xs text-muted">Trend note</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{trendNote(analyte)}</p>
        <p className="mt-2 text-xs text-muted">A description of recorded values only — interpretation stays with the reviewing clinician.</p>
      </div>
    </Card>
  );
}

function trendNote(a: LabAnalyte): string {
  const pts = a.points;
  const n = pts.length;
  const first = pts[0], last = pts[n - 1], prev = pts[n - 2];
  const u = a.unit ? ` ${a.unit}` : "";
  const parts: string[] = [n === 1 ? `One result, on ${fmtLong(first.d)}.` : `${n} results between ${fmtLong(first.d)} and ${fmtLong(last.d)}.`];
  if (prev) {
    const diff = +(last.v - prev.v).toFixed(a.decimals);
    parts.push(diff === 0 ? `Latest ${fmtV(a, last.v)}${u}, unchanged from ${fmtShort(prev.d)}.` : `Latest ${fmtV(a, last.v)}${u}, ${diff > 0 ? "up" : "down"} ${Math.abs(diff).toFixed(a.decimals)} from ${fmtV(a, prev.v)} on ${fmtShort(prev.d)}.`);
  }
  if (n > 2) {
    const lo = pts.reduce((m, p) => (p.v < m.v ? p : m));
    const hi = pts.reduce((m, p) => (p.v > m.v ? p : m));
    parts.push(`Lowest ${fmtV(a, lo.v)} (${fmtShort(lo.d)}), highest ${fmtV(a, hi.v)} (${fmtShort(hi.d)}).`);
  }
  if (a.low === undefined && a.high === undefined) {
    parts.push("No target is recorded for this test.");
  } else {
    const out = pts.filter((p) => p.flag).length;
    const noun = rangeNoun(a);
    parts.push(out === 0 ? `Every result is inside the ${noun} (${a.rangeText}).` : out === n ? `Every result is outside the ${noun} (${a.rangeText}).` : `${out} of ${n} results are outside the ${noun} (${a.rangeText}).`);
  }
  return parts.join(" ");
}

/** Lab reports on file whose values were never entered as structured results. */
function UntranscribedReports({ patientId, docs }: { patientId: string; docs: { id: string; title: string; reportDate: string; uploadedAt: string; source: string; status: string }[] }): ReactNode {
  return (
    <Card padded={false}>
      <div className="flex items-start gap-3 px-6 pb-2 pt-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Reports without transcribed values</h2>
          <p className="mt-1 text-sm text-muted">Their results aren&apos;t in the charts above — open the document to read them.</p>
        </div>
      </div>
      <ul className="px-6 pb-4">
        {docs.map((d) => (
          <li key={d.id} className="flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{d.title}</span>
              <span className="block text-xs text-muted">
                Report {fmtLong(d.reportDate)} · uploaded {fmtShort(d.uploadedAt)} · {d.source}
              </span>
            </span>
            {d.status === "awaiting-review" ? <StatusBadge tone="warning">Awaiting review</StatusBadge> : null}
            <IconButton asChild label={`Open ${d.title}`} size="sm" variant="ghost" tooltip="left">
              <Link href={`${recordHref(patientId, "documents")}?doc=${d.id}`}>
                <ArrowUpRight />
              </Link>
            </IconButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
