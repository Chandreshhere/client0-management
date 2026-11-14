"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { Drop, Heartbeat, Scales, TestTube, Wind } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { pluralize } from "@/lib/format";
import { staffById } from "@/data/staff";
import { MediaStatCard, SectionLabel } from "@/components/viz/cards";
import { BarsSpark, SparkValue, ValuePill, VitalTile, WaveSpark } from "@/components/viz/condition";
import { ScanThumb } from "@/features/patient/scan-thumb";
import {
  IMAGING,
  ME,
  METRICS,
  ORGAN_PLAIN,
  STATUS_TEXT,
  SYSTEM_METRICS,
  WITHHELD,
  authorName,
  formatValue,
  pointLabel,
  targetStatus,
  type ImagingStudy,
  type Metric,
  type MetricId,
  type MetricPoint,
  type PortalSystem,
} from "../record";
import { DatedWell, RangeGauge, StatusLine } from "../viz";
import { shortDate } from "../time";
import type { LoggedReading } from "./store";

const ICON: Record<MetricId, ReactNode> = {
  bp: <Drop />,
  hr: <Heartbeat />,
  weight: <Scales />,
  spo2: <Wind />,
  ldl: <TestTube />,
  hdl: <TestTube />,
  tg: <TestTube />,
  peakflow: <Wind />,
  fev1fvc: <TestTube />,
};

const BP_BASELINE = 100;
const withUnit = (unit: string) => (!unit ? "" : unit === "%" ? "%" : ` ${unit}`);
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Lab analyte name for metrics that come from lab reports (to spot newer, unreleased results). */
const LAB_LABEL: Partial<Record<MetricId, string>> = { ldl: "LDL-C", hdl: "HDL-C", tg: "Triglycerides" };

/** Released points + what the patient logged in this session (always self-reported). */
export function withLocal(metric: Metric, readings: LoggedReading[]): MetricPoint[] {
  const local = readings
    .filter((r) => r.kind === metric.id)
    .map((r): MetricPoint => ({ date: r.measuredAt, value: r.value, value2: r.value2, self: true, source: "Logged by you · awaiting review", local: true }));
  return [...metric.points, ...local].sort((a, b) => a.date.localeCompare(b.date));
}

type Tile = { kind: "metric"; metric: Metric } | { kind: "imaging"; study: ImagingStudy };

function tilesFor(system: PortalSystem): Tile[] {
  const metrics: Tile[] = (SYSTEM_METRICS[system.id] ?? []).map((id) => ({ kind: "metric", metric: METRICS[id] }));
  const imaging: Tile[] = IMAGING.filter((s) => s.systemId === system.id).map((study) => ({ kind: "imaging", study }));
  return [...metrics, ...imaging].slice(0, 4);
}

/** "My heart condition" (ref 3): 2×2 tiles for the selected body system, from released data. */
export function ConditionTiles({ system, readings }: { system: PortalSystem; readings: LoggedReading[] }) {
  const tiles = tilesFor(system);
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <SectionLabel>
        <span id={id}>My {ORGAN_PLAIN[system.organ].short} condition</span>
      </SectionLabel>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={system.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          transition={spring}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {tiles.map((t, i) =>
            t.kind === "metric" ? (
              <MetricTile key={t.metric.id} metric={t.metric} points={withLocal(t.metric, readings)} wide={tiles.length % 2 === 1 && i === tiles.length - 1} />
            ) : (
              <ImagingTile key={t.study.id} study={t.study} wide={tiles.length % 2 === 1 && i === tiles.length - 1} />
            ),
          )}
          {tiles.length === 0 ? <p className="text-sm text-muted">Nothing has been measured for this system yet.</p> : null}
        </motion.div>
      </AnimatePresence>
      <p className="mt-3 text-xs text-muted">
        Readings your care team has released, plus your own home readings (labelled “your reading”). Targets come from your care plan.
      </p>
    </section>
  );
}

function MetricTile({ metric, points, wide }: { metric: Metric; points: MetricPoint[]; wide?: boolean }) {
  const last = points.at(-1);
  const first = points[0];
  if (!last || !first) return null;
  const status = targetStatus(metric.target, last.value, last.value2);
  const tone = status === "on" ? "good" : status === "none" ? "neutral" : "watch";
  const values = points.map((p) => p.value);
  const lastText = pointLabel(metric, last);
  const unit = metric.unit;
  const range = `${points.length} readings, ${shortDate(first.date)} to ${shortDate(last.date)}`;
  const doctor = staffById(ME.careTeam.doctor)?.name ?? "your doctor";
  const withheld = LAB_LABEL[metric.id] ? WITHHELD.find((e) => e.values?.some((v) => v.label === LAB_LABEL[metric.id])) : undefined;
  const change = points.length > 1 ? last.value - first.value : 0;

  let chart: ReactNode;
  let aside: ReactNode = <SparkValue value={formatValue(metric, last.value)} sub={last.value2 !== undefined ? `/${formatValue(metric, last.value2)}` : unit} />;
  const dated = (node: ReactNode) => (
    <DatedWell from={shortDate(first.date)} to={shortDate(last.date)}>
      {node}
    </DatedWell>
  );
  if (metric.id === "bp" && points.length > 1) {
    // one bar per reading, spread across the well; bars rise from 100 mmHg so changes are visible
    chart = dated(
      <div className="h-full [&>div]:justify-between">
        <BarsSpark values={values.map((v) => Math.max(1, v - BP_BASELINE))} label={`Systolic pressure, ${range}: ${values.join(", ")} mmHg (bars drawn from ${BP_BASELINE} mmHg)`} />
      </div>,
    );
  } else if (metric.id === "hr" && points.length > 1) {
    // his own resting-rate readings (not an illustrative ECG); the pill holds the latest value
    chart = dated(<WaveSpark values={values} label={`Resting heart rate, ${range}: ${values.join(", ")} bpm`} />);
    aside = <ValuePill value={lastText} unit="bpm" />;
  } else if (metric.id === "weight" && points.length > 1) {
    chart = dated(<DotsTrend values={values} label={`Weight, ${range}: ${values.join(", ")} kg`} />);
  } else if (points.length > 1) {
    chart = dated(<WaveSpark values={values} label={`${metric.label}, ${range}: ${values.map((v) => formatValue(metric, v)).join(", ")} ${unit}`} />);
  } else {
    const t = metric.target.above ?? metric.target.below ?? last.value;
    chart = (
      <RangeGauge
        min={+(t * 0.6).toFixed(metric.decimals)}
        max={+(t * 1.35).toFixed(metric.decimals)}
        value={last.value}
        threshold={t}
        good={metric.target.above !== undefined ? "above" : "below"}
        format={(v) => formatValue(metric, v)}
        label={`${metric.label} ${lastText} ${unit}; target ${metric.target.text}`}
        className="py-2"
      />
    );
  }

  return (
    <figure className={wide ? "sm:col-span-2" : undefined}>
      <VitalTile
        icon={ICON[metric.id]}
        label={`${metric.label} · ${shortDate(last.date)}`}
        value={lastText}
        unit={unit}
        accent={metric.id === "hr"}
        chart={chart}
        aside={aside}
      />
      <figcaption className="flex flex-col gap-1 px-2 pt-2">
        <StatusLine tone={tone}>
          {STATUS_TEXT[status]} · target {metric.target.text}
          {unit && !/[a-z%]$/i.test(metric.target.text) ? ` ${unit}` : ""}
        </StatusLine>
        <span className="text-[11px] text-muted">
          {last.self ? "Your reading" : /lab report/i.test(last.source) ? "Lab report" : "Clinic"}
          {" · "}
          {withheld
            ? `a newer result (${shortDate(withheld.date)}) is with ${doctor} for review`
            : points.length > 1
              ? `${change < 0 ? "down" : change > 0 ? "up" : "no change"}${change ? ` ${formatValue(metric, Math.abs(change))}${withUnit(unit)}` : ""} since ${shortDate(first.date)} · ${pluralize(points.length, "reading")}`
              : lowerFirst(last.source.replace(/\s*·\s*lab report$/i, ""))}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * One dot per reading, latest in primary — the same colours as the BP bars. HTML dots stay round and
 * legible in the stretched well (the shared SVG sparkline squashed them into faint 2px specks).
 */
function DotsTrend({ values, label }: { values: number[]; label: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <div className="size-full p-1" role="img" aria-label={label}>
      <div className="relative size-full">
        {values.map((v, i) => {
          const last = i === values.length - 1;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full", last ? "size-2.5 bg-primary ring-2 ring-surface" : "size-2 bg-faint")}
              style={{ left: `${(i / Math.max(1, values.length - 1)) * 100}%`, top: `${100 - ((v - min) / (max - min || 1)) * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ImagingTile({ study, wide }: { study: ImagingStudy; wide?: boolean }) {
  const router = useRouter();
  return (
    <figure className={wide ? "sm:col-span-2" : undefined}>
      <MediaStatCard
        className="h-[164px]"
        value={study.finding?.value ?? "Report"}
        label={study.finding?.label ?? study.title}
        time={shortDate(study.date)}
        media={<ScanThumb kind={study.kind} title={`Illustrative ${study.title} thumbnail — not your actual image`} />}
        onOpen={() => router.push("/portal/records#imaging")}
      />
      <figcaption className="flex flex-col gap-1 px-2 pt-2">
        <span className="text-xs text-ink-2">{study.title}</span>
        <span className="text-[11px] text-muted">
          Released report · {authorName(study.event)} · picture is illustrative
        </span>
      </figcaption>
    </figure>
  );
}
