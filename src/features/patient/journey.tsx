"use client";

import { useMemo, useState } from "react";
import type { Patient } from "@/data/types";
import type { CareEvent } from "@/data/featured";
import { EVENT_TYPE_LABEL, LINK_LABEL, RECORD_STATE_LABEL } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Segmented } from "@/components/ui/segmented";
import { FlowMap, type FlowEdge, type FlowNode } from "@/components/viz/flow-map";
import { EVENT_ICON } from "./event-meta";
import { EventDrawer } from "./event-drawer";
import { RecordProvider, useRecord } from "./record-context";

/**
 * Care map (ref 5 "metro map"), built only from documented data:
 *  - lanes = who acted (medical, diagnostics, nutrition, movement, patient-reported),
 *  - x = the event date (months across the top),
 *  - connectors = documented links between events (ordered → result → reviewed in → led to …).
 * Nothing is connected unless the record says the two events are related.
 */
type Lane = "medical" | "diagnostics" | "nutrition" | "movement" | "patient";
const LANES: { key: Lane; label: string; hint: string }[] = [
  { key: "medical", label: "Medical", hint: "consults, notes, medication" },
  { key: "diagnostics", label: "Diagnostics", hint: "labs, imaging, tests" },
  { key: "nutrition", label: "Nutrition", hint: "plans & reviews" },
  { key: "movement", label: "Movement", hint: "yoga & mobility" },
  { key: "patient", label: "Patient-reported", hint: "self-reported logs" },
];

const laneOf = (e: CareEvent): Lane => {
  if (e.state === "self-reported" || e.authorRole === "Patient") return "patient";
  if (e.type === "nutrition") return "nutrition";
  if (e.type === "movement") return "movement";
  if (e.type === "lab" || e.type === "imaging" || e.type === "vitals") return "diagnostics";
  return "medical";
};

const COL_W = 210;
const LEFT = 176;
const LANE_H = 150;
const NODE_W = 196;
const TOP = 56;

/**
 * The care map: lanes by who acted, months across, documented links between events. Shown as the
 * Timeline's map view; `events` arrive already filtered (discipline, type, date) by the Timeline.
 */
export function CareMap({ patient, record, events }: { patient: Patient; record: PatientRecord; events: CareEvent[] }) {
  return (
    <RecordProvider record={record}>
      <CareMapInner patient={patient} events={events} />
    </RecordProvider>
  );
}

function CareMapInner({ patient, events }: { patient: Patient; events: CareEvent[] }) {
  const { record, conditionById } = useRecord();
  const years = useMemo(() => Array.from(new Set(events.map((e) => Number(e.date.slice(0, 4))))).sort((a, b) => b - a).slice(0, 3), [events]);
  const [pick, setYear] = useState<number | null>(null);
  const year = pick !== null && years.includes(pick) ? pick : (years[0] ?? record.years[0] ?? 2026);
  const [open, setOpen] = useState<string | null>(null);

  const { nodes, edges, shown, linkCount, lastX } = useMemo(() => {
    const evs = events.filter((e) => e.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
    // lay out by date within each lane; stack into sub-rows when cards would overlap
    const lastRight: Record<string, number[]> = {};
    const nodes: FlowNode[] = evs.map((e) => {
      const lane = laneOf(e);
      const laneIdx = LANES.findIndex((l) => l.key === lane);
      const m = Number(e.date.slice(5, 7)) - 1;
      const d = Number(e.date.slice(8, 10));
      const x = LEFT + m * COL_W + ((d - 1) / 31) * (COL_W - 20);
      const rows = (lastRight[lane] ??= []);
      let sub = rows.findIndex((r) => x > r + 12);
      if (sub === -1) sub = rows.length;
      rows[sub] = x + NODE_W;
      const Icon = EVENT_ICON[e.type];
      const tone = e.state === "scheduled" ? "scheduled" : e.state === "draft" ? "draft" : e.state === "awaiting-review" ? "review" : "done";
      return {
        id: e.id,
        x,
        y: TOP + laneIdx * LANE_H + (sub % 3) * 50,
        width: NODE_W,
        content: (
          <button
            type="button"
            onClick={() => setOpen(e.id)}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-full pl-1 pr-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5",
              "bg-surface shadow-[0_1px_2px_rgb(33_38_34/0.06)]",
              tone === "scheduled" && "shadow-[inset_0_0_0_1.5px_var(--color-primary)]",
              tone === "draft" && "border border-dashed border-primary",
            )}
            aria-label={`${EVENT_TYPE_LABEL[e.type]}: ${e.title}, ${formatDate(e.date)}, ${RECORD_STATE_LABEL[e.state]}`}
            title={`${e.title} — ${formatDate(e.date)} · ${RECORD_STATE_LABEL[e.state]}`}
          >
            <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full", tone === "scheduled" || tone === "draft" ? "bg-primary-soft text-primary" : "bg-primary text-white")}>
              <Icon size={16} aria-hidden="true" />
              {tone === "review" ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning ring-2 ring-surface" aria-hidden="true" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{e.title}</span>
              <span className="block truncate text-[10px] text-muted">{conditionById(e.conditionId)?.name}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted tabular">{e.date.slice(8, 10)}.{e.date.slice(5, 7)}</span>
          </button>
        ),
      };
    });
    const ids = new Set(evs.map((e) => e.id));
    const edges: FlowEdge[] = evs.flatMap((e) =>
      (e.links ?? [])
        .filter((l) => ids.has(l.to))
        .map((l) => {
          const to = evs.find((x) => x.id === l.to)!;
          return {
            from: e.id,
            to: l.to,
            tone: "primary" as const,
            label: `${e.title} ${LINK_LABEL[l.kind]} ${to.title}`,
            detail: `${formatDate(e.date, { day: "numeric", month: "short" })} → ${formatDate(to.date, { day: "numeric", month: "short" })}`,
          };
        }),
    );
    const lastX = nodes.length ? Math.max(...nodes.map((n) => n.x)) : 0;
    return { nodes, edges, shown: evs.length, linkCount: edges.length, lastX };
  }, [events, year, conditionById]);

  const width = LEFT + 12 * COL_W + 80;
  const height = TOP + LANES.length * LANE_H + 40;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          {shown} events · {linkCount} documented links in {year}
          {linkCount === 0 && shown > 0 ? " — no links recorded between the visible events." : ""}
        </p>
        {years.length > 1 ? <Segmented ariaLabel="Year" size="sm" variant="tray" value={String(year)} onChange={(v) => setYear(Number(v))} items={years.map((y) => ({ value: String(y), label: String(y) }))} /> : null}
      </div>
      <FlowMap
        label={`Care journey for ${patient.name}, ${year}`}
        nodes={nodes}
        edges={edges}
        width={width}
        height={height}
        viewportHeight={Math.min(height, 640)}
        rows={LANES.map((l, i) => ({ y: TOP + i * LANE_H + 22, label: l.label, hint: l.hint }))}
        columns={MONTHS.map((m, i) => ({ x: LEFT + i * COL_W, label: m, strong: year === 2026 && i === 10 }))}
        initialFocusX={lastX}
        key={`${year}-${events.length}`}
      />
      <EventDrawer events={record.events} eventId={open} onClose={() => setOpen(null)} onOpenEvent={setOpen} patientId={patient.id} />
    </div>
  );
}
