"use client";

import { useMemo, useState } from "react";
import type { Patient } from "@/data/types";
import type { CareEvent, CareEventType } from "@/data/featured";
import { EVENT_TYPE_LABEL, LINK_LABEL, RECORD_STATE_LABEL } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Avatar } from "@/components/ui/avatar";
import { FlowMap, type FlowEdge, type FlowNode } from "@/components/viz/flow-map";
import { ChipGroup } from "@/components/viz/cards";
import { EVENT_ICON } from "./event-meta";
import { EventDrawer } from "./event-drawer";
import { RecordProvider, useRecord } from "./record-context";

/**
 * Care journey (ref 5 "metro map"), built only from documented data:
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

type Filter = "docs" | "labs" | "imaging" | "medications" | "visits" | "programmes";
const FILTER_TYPES: Record<Filter, CareEventType[]> = {
  docs: ["document", "note"],
  labs: ["lab", "vitals"],
  imaging: ["imaging"],
  medications: ["medication"],
  visits: ["consult"],
  programmes: ["nutrition", "movement"],
};

const COL_W = 210;
const LEFT = 176;
const LANE_H = 150;
const NODE_W = 196;
const TOP = 56;

export function JourneyView({ patient, record }: { patient: Patient; record: PatientRecord }) {
  return (
    <RecordProvider record={record}>
      <JourneyInner patient={patient} />
    </RecordProvider>
  );
}

function JourneyInner({ patient }: { patient: Patient }) {
  const { record, conditionById } = useRecord();
  const [year, setYear] = useState(record.years[0] ?? 2026);
  const [filters, setFilters] = useState<Filter[]>(["docs", "labs", "imaging", "medications", "visits", "programmes"]);
  const [system, setSystem] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  const { nodes, edges, shown, linkCount, lastX } = useMemo(() => {
    const allowed = new Set(filters.flatMap((f) => FILTER_TYPES[f]));
    const evs = record.events
      .filter((e) => e.date.startsWith(String(year)))
      .filter((e) => allowed.has(e.type))
      .filter((e) => (system === "all" ? true : e.systemId === system))
      .sort((a, b) => a.date.localeCompare(b.date));

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
  }, [record.events, year, filters, system, conditionById]);

  const width = LEFT + 12 * COL_W + 80;
  const height = TOP + LANES.length * LANE_H + 40;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <Avatar src={patient.avatar} name={patient.name} size="xs" /> {patient.name} · {patient.age} years
          </span>
        }
        title="Care journey"
        description="Every card is a dated event in this record. Lines appear only where the record documents a link — a consult that ordered a test, a result reviewed at a visit, a referral that started a plan."
        actions={
          <Segmented ariaLabel="Year" variant="tray" value={String(year)} onChange={(v) => setYear(Number(v))} items={record.years.map((y) => ({ value: String(y), label: String(y) }))} />
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipGroup
          ariaLabel="Event types"
          value={filters}
          onChange={setFilters}
          options={[
            { value: "docs", label: "Docs" },
            { value: "labs", label: "Labs & tests" },
            { value: "imaging", label: "Imaging" },
            { value: "medications", label: "Medications" },
            { value: "visits", label: "Visits" },
            { value: "programmes", label: "Nutrition & movement" },
          ]}
        />
        <Segmented
          size="sm"
          variant="tray"
          ariaLabel="Body system"
          value={system}
          onChange={setSystem}
          items={[{ value: "all", label: "All systems" }, ...record.systems.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {shown} events · {linkCount} documented links in {year}
        {linkCount === 0 && shown > 0 ? " — no links recorded between the visible events." : ""}
      </p>
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
        key={`${year}-${system}`}
      />
      <EventDrawer events={record.events} eventId={open} onClose={() => setOpen(null)} onOpenEvent={setOpen} patientId={patient.id} />
    </div>
  );
}
