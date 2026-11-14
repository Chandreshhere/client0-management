"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ArrowUpRight, ChartLine, Plus, Table as TableIcon } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import type { BodySystem } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { ORGAN_LABEL } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { GlassCard } from "@/components/viz/organ";
import { SparkValue, ValuePill, VitalTile } from "@/components/viz/condition";
import type { LineSeries } from "@/components/charts/line-chart";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OrganCanvas } from "@/features/patient/organ-canvas";
import { recordHref } from "./data";
import { clinicalAccess } from "./access";
import { useRecord } from "./store";
import { NoRecordState, OrganThumb, RecordFrame, RestrictedRecord } from "./record-frame";
import { TrendChart, TrendKey } from "./trend-chart";
import { AddReadingDialog } from "./add-reading-dialog";
import { isFeaturedPatient, recordOf, systemConditionText, systemOf } from "./record-model";
import { STATUS_TEXT, measureValueText, vitalMeasures, type VitalMeasure } from "./measures";
import { MeasureSpark, measureIcon } from "./sparks";

const fmtShort = (d: string) => formatDate(d, { day: "numeric", month: "short" });
const fmtLong = (d: string) => formatDate(d, { day: "numeric", month: "short", year: "numeric" });
const SELF_NOTE = "Self-reported (home device)";
const SOURCE_SHORT: Record<VitalMeasure["source"], string> = { Lab: "Lab", Clinic: "Clinic", "Home device (self-reported)": "Home · self-reported", "Clinic & home": "Clinic & home" };

export function VitalsTab({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role } = useRole();
  const access = clinicalAccess(role, patientId);
  const record = recordOf(patientId);
  const readings = useRecord((s) => s.readings);
  const measures = useMemo(() => vitalMeasures(patientId, readings), [patientId, readings]);
  const vitals = measures.filter((m) => !m.lab);
  const [systemId, setSystemId] = useState<string | undefined>(record?.systems[0]?.id);
  const [adding, setAdding] = useState(false);
  const canAdd = !!record && access !== "none" && vitals.length > 0;

  return (
    <RecordFrame
      patient={patient}
      focusSystemId={systemId}
      title="Vital signs"
      description="Clinic measurements and home readings on one timeline, grouped by the condition they are monitored for. Patient-entered values stay marked self-reported until a clinician reviews them."
      actions={
        canAdd ? (
          <Button variant="dark" leading={<Plus />} onClick={() => setAdding(true)}>
            Add reading
          </Button>
        ) : null
      }
    >
      {!record ? (
        <NoRecordState patient={patient} tab="vitals" />
      ) : access === "none" ? (
        <RestrictedRecord role={role} tab="vitals" />
      ) : (
        <VitalsBody patient={patient} record={record} measures={measures} systemId={systemId ?? record.systems[0].id} onSystem={setSystemId} />
      )}
      {canAdd ? <AddReadingDialog open={adding} onOpenChange={setAdding} selfOnly={role === "patient"} patient={patient} measures={vitals} /> : null}
    </RecordFrame>
  );
}

function VitalsBody({ patient, record, measures, systemId, onSystem }: { patient: Patient; record: PatientRecord; measures: VitalMeasure[]; systemId: string; onSystem: (id: string) => void }) {
  const featured = isFeaturedPatient(patient.id);
  const [view, setView] = useState<"charts" | "table">("charts");
  const system = systemOf(record, systemId) ?? record.systems[0];
  // The featured patient's vital signs are one programme set (not split by system).
  const shown = featured ? measures : measures.filter((m) => m.systemId === system.id);
  const charted = shown.filter((m) => !m.lab);
  const labs = shown.filter((m) => m.lab);
  const lead = shown[0];
  const owners = featured ? [] : record.systems.filter((s) => s.id !== system.id && measures.some((m) => m.systemId === s.id));

  return (
    <div className="grid grid-cols-1 items-start gap-6 @[1040px]:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
      <OrganFocus patient={patient} record={record} system={system} lead={lead} onSystem={onSystem} switchable={!featured && record.systems.length > 1} />

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="tiles-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 id="tiles-heading" className="flex items-center gap-2 text-sm text-ink">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {featured ? "Heart Health programme · latest readings" : `Monitoring for ${systemConditionText(record, system)}`}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {shown.length ? `${shown.length} monitored ${shown.length === 1 ? "measure" : "measures"} · each tile: latest value, its source and how it compares with the target` : "Nothing is measured for this system yet"}
              </p>
            </div>
          </div>
          {shown.length ? (
            <ul className="grid grid-cols-1 gap-3 @[560px]:grid-cols-2">
              {shown.map((m) => (
                <li key={m.key} className="min-w-0">
                  <MeasureTile m={m} patientId={patient.id} />
                </li>
              ))}
            </ul>
          ) : (
            <Card className="text-sm text-muted">
              {owners.length
                ? `Readings for ${systemConditionText(record, system)} are logged under ${owners.map((o) => o.name).join(", ")} — the same measure isn't recorded twice.`
                : `No readings are monitored for ${systemConditionText(record, system)} yet.`}
            </Card>
          )}
        </section>

        {charted.length ? (
          <section aria-labelledby="trends-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="trends-heading" className="sr-only">
                Trends
              </h2>
              <Segmented
                ariaLabel="View"
                value={view}
                onChange={setView}
                items={[
                  { value: "charts", label: "Trends", icon: <ChartLine /> },
                  { value: "table", label: "Table view", icon: <TableIcon /> },
                ]}
              />
              <p className="text-xs text-muted">Dates are when each reading was taken · targets from the care plan</p>
            </div>
            {view === "charts" ? (
              <div className={cn("grid grid-cols-1 gap-6", charted.length > 1 && "@[1040px]:grid-cols-2")}>
                {charted.map((m) => (
                  <MeasureChartCard key={m.key} m={m} />
                ))}
              </div>
            ) : (
              <MeasuresTable measures={charted} />
            )}
          </section>
        ) : null}

        {labs.length ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[56ch] text-sm text-muted">
              {labs.map((l) => l.label).join(" and ")} {labs.length === 1 ? "is a lab result" : "are lab results"}: {labs.length === 1 ? "its tile shows" : "their tiles show"} one dot per report, or a single report placed against its target. Full results, flags and source reports are under Labs.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href={recordHref(patient.id, "labs")}>
                Open lab results
                <ArrowUpRight />
              </Link>
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Organ for the selected body system (live, morphs when another system is chosen), its
 * conditions, and the system's lead reading in a glass card. Organs come from the conditions.
 */
function OrganFocus({ patient, record, system, lead, onSystem, switchable }: { patient: Patient; record: PatientRecord; system: BodySystem; lead?: VitalMeasure; onSystem: (id: string) => void; switchable: boolean }) {
  const conditions = record.conditions.filter((c) => c.systemId === system.id);
  const latest = lead?.points[lead.points.length - 1];
  return (
    <section aria-label={`${system.name} system`} className="relative flex flex-col overflow-hidden rounded-card bg-surface p-6 @[1040px]:sticky @[1040px]:top-[80px]">
      <p className="text-xs text-muted">
        {patient.name.split(" ")[0]} · {ORGAN_LABEL[system.organ]}
      </p>
      <h2 className="text-title font-light text-ink">{system.name}</h2>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Conditions in this system">
        {conditions.map((c) => (
          <li key={c.id} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-canvas px-3 text-xs text-ink-2">
            {c.name}
            <span className="text-muted">· {c.status}</span>
          </li>
        ))}
      </ul>
      <div className="relative mx-auto mt-2 aspect-square w-full max-w-[300px]">
        <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-canvas" />
        <div aria-hidden="true" className="absolute inset-[22%] rounded-full bg-surface/70 shadow-[inset_0_0_0_1px_var(--color-line)]" />
        {/* lifted so the glass card below overlaps the disc rim, never the organ itself */}
        <OrganCanvas shape={system.organ} tone="light" label={`3D illustration of the ${ORGAN_LABEL[system.organ].toLowerCase()} — organ for ${systemConditionText(record, system)}`} className="absolute inset-x-[4%] -top-[2%] bottom-[10%]" />
      </div>
      {lead && latest ? (
        <GlassCard className="-mt-6 relative z-[1]">
          <p className="truncate text-[11px] text-muted">
            {lead.label} · {SOURCE_SHORT[lead.source]} · {fmtShort(latest.d)}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5 text-ink">
            <span className="text-lg font-light tabular">{measureValueText(lead, latest)}</span>
            <span className="text-xs text-muted">{lead.unit}</span>
            <StatusText m={lead} className="ml-auto" />
          </p>
          <p className="text-[11px] text-muted">
            <KeepParts text={lead.targetLabel} />
          </p>
        </GlassCard>
      ) : null}
      {switchable ? (
        <div className="mt-4" role="group" aria-label="Body system">
          <p className="mb-2 text-xs text-muted">Body systems on this record</p>
          <div className="flex flex-wrap gap-2">
            {record.systems.map((s) => {
              const on = s.id === system.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSystem(s.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs transition-[background-color,color,box-shadow] duration-200",
                    on ? "bg-charcoal text-white" : "bg-canvas text-ink-2 hover:bg-sunken",
                  )}
                >
                  <OrganThumb kind={s.organ} active={on} className={on ? "bg-white/10" : "bg-surface"} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * "Systolic target < 130 · Diastolic target < 80 · Clinic & home" with each part on one line: a
 * narrow card wraps only between parts (the "·" stays with the part before it), never inside
 * "< 80".
 */
function KeepParts({ text }: { text: string }) {
  const parts = text.split(" · ");
  return parts.map((part, i) => (
    <Fragment key={i}>
      <span className="whitespace-nowrap">
        {part}
        {i < parts.length - 1 ? " ·" : null}
      </span>
      {i < parts.length - 1 ? " " : null}
    </Fragment>
  ));
}

function StatusText({ m, className }: { m: VitalMeasure; className?: string }) {
  if (m.status === "none") return <span className={cn("text-[11px] text-muted", className)}>Trend only — no target set</span>;
  return (
    <span className={cn("text-[11px]", m.status === "within" ? "text-success" : m.status === "above" ? "text-danger" : "text-warning", className)}>
      {STATUS_TEXT[m.status]}
    </span>
  );
}

/** Ref-3 tile: icon · label · value, a chart well with the spark that fits the measure. */
function MeasureTile({ m, patientId }: { m: VitalMeasure; patientId: string }) {
  const latest = m.points[m.points.length - 1];
  if (!latest) return null;
  const first = m.points[0];
  const accent = m.spark === "ecg";
  return (
    <div className="flex flex-col gap-2">
      <VitalTile
        icon={measureIcon(m)}
        label={`${m.label} · ${SOURCE_SHORT[m.source]}`}
        value={measureValueText(m, latest)}
        unit={m.unit}
        accent={accent}
        chart={<MeasureSpark m={m} />}
        aside={accent ? <ValuePill value={latest.v} unit={m.unit} /> : <SparkValue value={measureValueText(m, latest)} sub={m.twoValues ? m.unit : m.unit || undefined} />}
      />
      <div className="flex flex-col gap-0.5 px-2 text-xs">
        <p className="flex min-w-0 items-center gap-1.5">
          <StatusText m={m} />
          {m.status !== "none" ? <span className="truncate text-muted">· {m.targetLabel}</span> : null}
        </p>
        <p className="text-muted">
          {m.points.length} {m.points.length === 1 ? "reading" : "readings"}
          {m.points.length > 1 ? ` since ${fmtShort(first.d)}${first.d.slice(0, 4) !== latest.d.slice(0, 4) ? ` ${first.d.slice(0, 4)}` : ""}` : ""} · latest {fmtShort(latest.d)}
          {latest.self ? " (self-reported)" : ""}
          {m.lab ? (
            <>
              {" · "}
              <Link href={recordHref(patientId, "labs")} className="text-ink-2 underline underline-offset-4">
                all results in Labs
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function MeasureChartCard({ m }: { m: VitalMeasure }) {
  const hasSelf = m.points.some((p) => p.self);
  const latest = m.points[m.points.length - 1];
  const lines: LineSeries[] = m.twoValues
    ? [
        { id: "sys", name: "Systolic", color: "var(--color-medical)", points: m.points.map((p) => ({ x: p.d, y: p.v, hollow: p.self })) },
        { id: "dia", name: "Diastolic", color: "var(--color-nutrition)", points: m.points.filter((p) => p.v2 !== undefined).map((p) => ({ x: p.d, y: p.v2!, hollow: p.self })) },
      ]
    : [{ id: m.key, name: `${m.label}${m.unit ? ` · ${m.unit}` : ""}`, color: "var(--color-medical)", points: m.points.map((p) => ({ x: p.d, y: p.v, hollow: p.self })) }];
  // percentages near the ceiling (SpO₂) and 0–10 scores must not get an axis past their bounds
  const bounded = (m.unit === "%" && Math.max(...m.points.map((p) => p.v)) >= 90) || m.unit === "/10";
  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-normal tracking-[-0.01em] text-ink">{m.label}</h3>
          <p className="mt-1 text-xs text-muted">
            <KeepParts text={`${m.targetLabel} · ${SOURCE_SHORT[m.source]}`} />
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-[18px]" aria-hidden="true">
          {measureIcon(m)}
        </span>
      </div>
      {m.points.length > 1 ? (
        <>
          <TrendChart
            height={208}
            series={lines}
            range={m.range}
            thresholds={m.thresholds}
            hollowNote={hasSelf ? SELF_NOTE : undefined}
            yPadding={bounded ? 0 : undefined}
            formatY={(v) => (m.decimals ? v.toFixed(Number.isInteger(v) ? 0 : Math.min(2, m.decimals)) : String(v))}
            ariaLabel={`${m.label}: ${m.points.length} readings, latest ${measureValueText(m, latest)} ${m.unit} on ${fmtLong(latest.d)}${latest.self ? " (self-reported)" : ""}. ${m.targetLabel}. Use left and right arrow keys to read values.`}
          />
          <TrendKey range={m.range} thresholds={m.thresholds} />
        </>
      ) : (
        <p className="rounded-inner bg-canvas p-4 text-sm text-muted">
          One reading so far — {measureValueText(m, latest)} {m.unit} on {fmtLong(latest.d)}. A trend appears from the second reading.
        </p>
      )}
    </Card>
  );
}

function MeasuresTable({ measures }: { measures: VitalMeasure[] }) {
  const dates = Array.from(new Set(measures.flatMap((s) => s.points.map((p) => p.d)))).sort().reverse();
  return (
    <Card padded={false}>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Vital signs by date. Self-reported values are labelled.</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="sticky left-0 bg-surface py-4 pl-6 pr-3 text-left font-normal">
                Date
              </th>
              {measures.map((s) => (
                <th key={s.key} scope="col" className="px-3 py-4 text-right font-normal last:pr-6">
                  {s.short} {s.unit ? <span className="text-faint">· {s.unit}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => (
              <tr key={d}>
                <th scope="row" className="sticky left-0 whitespace-nowrap border-t border-line bg-surface py-3 pl-6 pr-3 text-left font-normal text-ink-2">
                  {formatDate(d)}
                </th>
                {measures.map((s) => {
                  const pts = s.points.filter((p) => p.d === d);
                  return (
                    <td key={s.key} className="whitespace-nowrap border-t border-line px-3 py-3 text-right align-top tabular last:pr-6">
                      {pts.length ? (
                        pts.map((p, i) => (
                          <span key={i} className="block">
                            <span className="text-ink">{measureValueText(s, p)}</span>
                            {p.self ? <span className="ml-1.5 rounded-full bg-sunken px-1.5 text-[11px] text-ink-2">Self-reported</span> : null}
                            {p.added ? <span className="ml-1.5 rounded-full bg-sunken px-1.5 text-[11px] text-muted">Added now</span> : null}
                          </span>
                        ))
                      ) : (
                        <span className="text-faint">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">No reading</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
