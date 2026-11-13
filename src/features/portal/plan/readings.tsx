"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Pulse, PlusCircle, Trash } from "@phosphor-icons/react";
import { formatTime } from "@/lib/format";
import { spring } from "@/lib/motion";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { Panel, SelfReportedBadge } from "../ui";
import { METRICS, RELEASED_PAST, eventById, formatValue, pointLabel, type MetricId } from "../record";
import { RangeGauge } from "../viz";
import { TODAY_KEY, dayLabel, shortDate } from "../time";
import { removeReading, type LoggedReading, type ReadingKind } from "./store";
import { withLocal } from "./tiles";

const CHART_METRICS: { value: ReadingKind; label: string }[] = [
  { value: "bp", label: "Blood pressure" },
  { value: "hr", label: "Heart rate" },
  { value: "weight", label: "Weight" },
  { value: "peakflow", label: "Peak flow" },
];

const BANDS: Partial<Record<MetricId, { from: number; to: number; label: string }>> = {
  hr: { from: 55, to: 75, label: "Target 55–75 bpm" },
};

/** Your released self-reported entries this year (home logs and diaries). */
const RELEASED_SELF = RELEASED_PAST.filter((e) => e.state === "self-reported" && e.date.startsWith(TODAY_KEY.slice(0, 4))).sort((a, b) => b.date.localeCompare(a.date));

/** Line chart of a measurement (hollow = your own readings) + everything you have logged. */
export function ReadingsPanel({ readings, onLog }: { readings: LoggedReading[]; onLog: (k: ReadingKind) => void }) {
  const [metricId, setMetricId] = useState<ReadingKind>("bp");
  const metric = METRICS[metricId];
  const points = withLocal(metric, readings);
  const series: LineSeries[] =
    metricId === "bp"
      ? [
          { id: "sys", name: "Top (systolic)", color: "var(--color-primary)", points: points.map((p) => ({ x: p.date, y: p.value, hollow: p.self })) },
          { id: "dia", name: "Bottom (diastolic)", color: "var(--color-ink-2)", points: points.filter((p) => p.value2 !== undefined).map((p) => ({ x: p.date, y: p.value2!, hollow: p.self })) },
        ]
      : [{ id: metricId, name: metric.label, color: "var(--color-primary)", points: points.map((p) => ({ x: p.date, y: p.value, hollow: p.self })) }];
  const local = [...readings].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt) || b.measuredAt.localeCompare(a.measuredAt));

  return (
    <Panel
      icon={<Pulse />}
      title="My readings"
      subtitle="Your own readings stay labelled self-reported until reviewed"
      action={
        <Button size="sm" variant="dark" leading={<PlusCircle />} onClick={() => onLog(metricId)}>
          Log
        </Button>
      }
      className="h-full"
    >
      <div className="flex flex-col gap-4 rounded-inner bg-surface p-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
          <Segmented<ReadingKind> ariaLabel="Measurement to chart" value={metricId} onChange={setMetricId} variant="tray" size="sm" items={CHART_METRICS} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={metricId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={spring}>
            <p className="text-xs text-muted">
              {metric.label} · {points.length} {points.length === 1 ? "reading" : "readings"} · target {metric.target.text}
              {metric.unit && !/[a-z%]$/i.test(metric.target.text) ? ` ${metric.unit}` : ""}
            </p>
            {points.length > 1 ? (
              <LineChart
                className="mt-2"
                height={200}
                series={series}
                band={BANDS[metricId]}
                formatY={(v) => formatValue(metric, v)}
                ariaLabel={`${metric.label} over time, ${points.length} readings from ${shortDate(points[0].date)} to ${shortDate(points.at(-1)!.date)}`}
                hollowNote="Hollow = your own reading (self-reported)"
              />
            ) : points[0] ? (
              <div className="mt-4 h-16">
                <RangeGauge
                  min={+((metric.target.above ?? metric.target.below ?? points[0].value) * 0.6).toFixed(metric.decimals)}
                  max={+((metric.target.above ?? metric.target.below ?? points[0].value) * 1.35).toFixed(metric.decimals)}
                  value={points[0].value}
                  threshold={metric.target.above ?? metric.target.below ?? points[0].value}
                  good={metric.target.above !== undefined ? "above" : "below"}
                  format={(v) => formatValue(metric, v)}
                  label={`${metric.label} ${pointLabel(metric, points[0])} ${metric.unit} on ${shortDate(points[0].date)}; target ${metric.target.text}`}
                />
                <p className="mt-2 text-xs text-muted">One reading so far ({shortDate(points[0].date)}) — log more to see a trend.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No readings yet.</p>
            )}
            {points.length > 1 ? (
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">Show as a table</summary>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-[12px] bg-canvas">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-muted">
                        <th scope="col" className="px-3 py-2 font-normal">Date</th>
                        <th scope="col" className="px-3 py-2 font-normal">{metric.label}</th>
                        <th scope="col" className="px-3 py-2 font-normal">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...points].reverse().map((p, i) => (
                        <tr key={`${p.date}-${i}`} className="border-t border-line text-ink-2">
                          <td className="px-3 py-2 tabular">{shortDate(p.date)}</td>
                          <td className="px-3 py-2 tabular">
                            {pointLabel(metric, p)} {metric.unit}
                          </td>
                          <td className="px-3 py-2">{p.self ? "You (self-reported)" : "Clinic"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <section aria-labelledby="readings-logged" className="rounded-inner bg-surface p-4">
        <h3 id="readings-logged" className="text-sm text-ink">
          What you&apos;ve logged
        </h3>
        <ul className="mt-2 flex flex-col divide-y divide-line">
          <AnimatePresence initial={false}>
            {local.map((r) => {
              const m = METRICS[r.kind];
              return (
                <motion.li key={r.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {m.label} · <span className="tabular">{r.value2 !== undefined ? `${r.value}/${r.value2}` : r.value}</span> {m.unit}
                    </span>
                    <span className="block text-xs text-muted">
                      Measured {dayLabel(r.measuredAt)} {formatTime(r.measuredAt)}
                      {r.device ? ` · ${r.device}` : ""} · entered {formatTime(r.enteredAt)}
                      {r.note ? ` · “${r.note}”` : ""}
                    </span>
                  </span>
                  <SelfReportedBadge />
                  <IconButton label={`Remove ${m.label} reading`} variant="ghost" size="sm" onClick={() => removeReading(r.id)}>
                    <Trash size={16} />
                  </IconButton>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {RELEASED_SELF.map((e) => {
            const review = e.links?.map((l) => eventById(l.to)).find((x) => x?.state === "scheduled");
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{e.title.replace(/\s*\(self-reported\)/i, "")}</span>
                  <span className="block text-xs text-muted">
                    {shortDate(e.date)} · {e.summary}
                  </span>
                </span>
                <SelfReportedBadge pending={review ? `review ${dayLabel(`${review.date}T12:00:00+05:30`).toLowerCase()}` : "shared with your team"} />
              </li>
            );
          })}
          {!local.length && !RELEASED_SELF.length ? <li className="py-3 text-sm text-muted">Nothing logged yet.</li> : null}
        </ul>
      </section>
    </Panel>
  );
}
