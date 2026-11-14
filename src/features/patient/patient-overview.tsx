"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Patient } from "@/data/types";
import type { BodySystemId, CareEvent, CareEventType } from "@/data/featured";
import { EVENT_TYPE_LABEL, RECORD_STATE_LABEL } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { formatDate, TODAY } from "@/lib/format";
import { Dialog, ModalContent, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { AnchorProvider, ConnectorLayer, type Link } from "./connectors";
import { SummaryColumn } from "./summary-column";
import { SystemStack } from "./system-stack";
import { TimelinePanel, type Zoom } from "./timeline-panel";
import { EventDrawer } from "./event-drawer";
import { CarePlanSheet, ProfileSheet } from "./patient-sheets";
import { EVENT_ICON } from "./event-meta";
import { RecordProvider, useRecord } from "./record-context";

/**
 * Patient workspace overview — the reference dashboard, made functional:
 * summary column · body-system stack with 3D organ · connector threads · year timeline.
 * Container queries pick the layout from the space actually available (sidebar open or not):
 *   ≥1100px four tracks + threads · ≥940px three tracks + threads (1280–1366 laptops)
 *   · ≥760px two columns, timeline below · else stacked list.
 */
export function PatientOverview({ patient, record }: { patient: Patient; record: PatientRecord }) {
  return (
    <RecordProvider record={record}>
      <OverviewInner patient={patient} />
    </RecordProvider>
  );
}

function OverviewInner({ patient }: { patient: Patient }) {
  const { record, conditionById } = useRecord();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<BodySystemId>(record.systems[0]?.id ?? "");
  const [year, setYear] = useState(record.years[0] ?? 2026);
  const [zoom, setZoom] = useState<Zoom>(1);
  const [half, setHalf] = useState<0 | 1>(1);
  const [view, setView] = useState<"map" | "list">("map");
  const [eventId, setEventId] = useState<string | null>(null);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [carePlanOpen, setCarePlanOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [addFor, setAddFor] = useState<{ systemId: BodySystemId; conditionId?: string } | null>(null);
  const [localEvents, setLocalEvents] = useState<CareEvent[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Small screens default to the chronological list (doc §6: mobile default).
  const decided = useRef(false);
  useEffect(() => {
    if (!decided.current && width > 0) {
      decided.current = true;
      if (width < 760) setView("list");
    }
  }, [width]);

  const events = useMemo(() => [...record.events, ...localEvents].sort((a, b) => a.date.localeCompare(b.date)), [record.events, localEvents]);
  // threads need the timeline beside the systems: true from the three-track layout up
  const wide = width >= 940;

  const links = useMemo<Link[]>(() => {
    const inView = (e: CareEvent) => {
      if (!e.date.startsWith(String(year))) return false;
      if (zoom !== 2) return true;
      const m = Number(e.date.slice(5, 7)) - 1;
      return half === 0 ? m < 6 : m >= 6;
    };
    // One thread per condition × month (to that month's first event), like the reference's
    // clustered fan; muted systems only thread their significant events.
    const seen = new Set<string>();
    const out: Link[] = [];
    for (const e of events.filter(inView)) {
      const isActive = e.systemId === active;
      if (!isActive && e.weight < 2) continue;
      const key = `${e.conditionId}-${e.date.slice(0, 7)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: e.id,
        from: `cond:${e.conditionId}`,
        to: `evt:${e.id}`,
        tone: isActive ? "active" : "muted",
        group: e.conditionId,
        eventId: e.id,
        label: `${conditionById(e.conditionId)?.name ?? "Condition"} → ${e.title}`,
        detail: `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(e.date))} · ${RECORD_STATE_LABEL[e.state]}`,
      });
    }
    return out;
  }, [events, year, zoom, half, active, conditionById]);

  const version = `${active}-${year}-${zoom}-${half}-${view}-${localEvents.length}`;

  return (
    <AnchorProvider>
      <div ref={containerRef} className="@container relative">
        {/* 940–1100px (1280–1366 laptops): three columns so the care-map timeline stays beside the
            body systems instead of dropping below them and leaving the right side empty. */}
        <div className="grid grid-cols-1 gap-6 @[760px]:grid-cols-[minmax(232px,260px)_1fr] @[940px]:grid-cols-[minmax(232px,248px)_minmax(320px,1fr)_minmax(344px,420px)] @[1100px]:grid-cols-[minmax(232px,256px)_minmax(336px,392px)_minmax(40px,1fr)_minmax(372px,452px)]">
          <div className="order-2 @[760px]:order-1">
            <SummaryColumn
              patient={patient}
              active={active}
              onOpenProfile={() => setProfileOpen(true)}
              onOpenCarePlan={() => setCarePlanOpen(true)}
              onOpenEvent={setEventId}
            />
          </div>
          <div className="order-1 @[760px]:order-2">
            <SystemStack
              active={active}
              onActivate={(id) => {
                setHovered(null);
                setActive(id);
              }}
              onOpenCondition={setConditionId}
              onAddEvent={(systemId) => setAddFor({ systemId })}
              onOpenRecords={() => router.push(`/patients/${patient.id}/reports`)}
              hoveredCondition={hovered}
              onHoverCondition={setHovered}
              patient={patient}
              onOpenEvent={setEventId}
            />
          </div>
          <div aria-hidden="true" className="order-3 hidden @[1100px]:block" />
          <div className="order-3 @[760px]:col-span-2 @[940px]:order-4 @[940px]:col-span-1">
            <TimelinePanel
              events={events}
              year={year}
              onYear={setYear}
              activeSystem={active}
              zoom={zoom}
              onZoom={setZoom}
              view={view}
              onView={setView}
              half={half}
              onHalf={setHalf}
              onOpenEvent={setEventId}
              onHoverCondition={setHovered}
              compact={width > 0 && width < 760}
            />
          </div>
        </div>
        <ConnectorLayer containerRef={containerRef} links={links} version={version} highlightGroup={hovered} enabled={wide && view === "map"} onOpenEvent={setEventId} />
      </div>

      <EventDrawer events={events} eventId={eventId} onClose={() => setEventId(null)} onOpenEvent={setEventId} patientId={patient.id} />
      <ConditionSheet
        conditionId={conditionId}
        events={events}
        onClose={() => setConditionId(null)}
        onOpenEvent={(id) => {
          setConditionId(null);
          setEventId(id);
        }}
        onAdd={(c) => {
          setConditionId(null);
          setAddFor({ systemId: conditionById(c)?.systemId ?? active, conditionId: c });
        }}
      />
      <CarePlanSheet open={carePlanOpen} onOpenChange={setCarePlanOpen} patient={patient} />
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} patient={patient} />
      <AddEventModal
        target={addFor}
        onClose={() => setAddFor(null)}
        onSave={(ev) => {
          setLocalEvents((xs) => [...xs, ev]);
          setYear(Number(ev.date.slice(0, 4)));
          if (ev.systemId !== active) setActive(ev.systemId);
          setAddFor(null);
        }}
      />
    </AnchorProvider>
  );
}

function ConditionSheet({ conditionId, events, onClose, onOpenEvent, onAdd }: { conditionId: string | null; events: CareEvent[]; onClose: () => void; onOpenEvent: (id: string) => void; onAdd: (conditionId: string) => void }) {
  const { conditionById, systemById } = useRecord();
  const c = conditionId ? conditionById(conditionId) : null;
  const linked = c ? events.filter((e) => e.conditionId === c.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      {c ? (
        <SheetContent title={c.name} description={`${systemById(c.systemId).name} · ${c.status} · since ${formatDate(c.since, { month: "short", year: "numeric" })}`} footer={<Button variant="dark" onClick={() => onAdd(c.id)}>Add to timeline</Button>}>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-inner bg-canvas p-4"><p className="text-xs text-muted">Recorded since</p><p className="mt-1 text-sm">{formatDate(c.since, { month: "short", year: "numeric" })}</p></div>
            <div className="rounded-inner bg-canvas p-4"><p className="text-xs text-muted">Linked events</p><p className="mt-1 text-2xl font-light">{linked.length}</p></div>
            <div className="rounded-inner bg-canvas p-4"><p className="text-xs text-muted">Status</p><p className="mt-1 text-sm">{c.status}</p></div>
          </div>
          <p className="mt-4 text-xs text-muted">Lines on the care map show documented links between events and this condition — not cause and effect.</p>
          <ul className="mt-4 flex flex-col gap-1">
            {linked.map((e) => {
              const Icon = EVENT_ICON[e.type];
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpenEvent(e.id)} className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-canvas">
                    <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2"><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.title}</span>
                      <span className="block text-xs text-muted">{formatDate(e.date)}</span>
                    </span>
                    <StatusBadge tone={recordTone(e.state)}>{RECORD_STATE_LABEL[e.state]}</StatusBadge>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function AddEventModal({ target, onClose, onSave }: { target: { systemId: BodySystemId; conditionId?: string } | null; onClose: () => void; onSave: (e: CareEvent) => void }) {
  const { user, role } = useRole();
  const { record, systemById, conditionById } = useRecord();
  const { toast } = useToast();
  const [type, setType] = useState<CareEventType>("note");
  const [condition, setCondition] = useState<string>("");
  const [date, setDate] = useState("2026-11-13");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      const sys = systemById(target.systemId);
      setCondition(target.conditionId ?? sys.featuredConditionId);
      setType("note");
      setDate("2026-11-13");
      setTitle("");
      setSummary("");
      setError(null);
    }
  }, [target, systemById]);

  const conds = target ? record.conditions.filter((c) => c.systemId === target.systemId) : [];

  const submit = () => {
    if (!title.trim()) {
      setError("Add a short title so the event is recognisable on the timeline.");
      return;
    }
    const c = conditionById(condition)!;
    onSave({
      id: `local-${Date.now()}`,
      date,
      enteredAt: TODAY.toISOString(),
      type,
      systemId: c.systemId,
      conditionId: c.id,
      title: title.trim(),
      summary: summary.trim() || "No summary added yet.",
      authorId: user.id,
      authorRole: role === "patient" ? "Patient" : user.title,
      state: "draft",
      source: "Draft · this browser session",
      released: false,
      weight: 2,
    });
    toast({ title: "Draft added to the timeline", description: "Saved in this browser session only — drafts stay unsigned and unreleased.", tone: "success" });
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      {target ? (
        <ModalContent
          title="Add to timeline"
          description={`${systemById(target.systemId).name} · saved as a draft`}
          footer={
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="dark" onClick={submit}>Save draft</Button>
            </>
          }
        >
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label="Event type">
              {({ id }) => (
                <Select id={id} value={type} onValueChange={(v) => setType(v as CareEventType)} options={Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
              )}
            </Field>
            <Field label="Condition">
              {({ id }) => <Select id={id} value={condition} onValueChange={setCondition} options={conds.map((c) => ({ value: c.id, label: c.name }))} />}
            </Field>
            <Field label="Event date" hint="When it happened — the entry date is recorded separately.">
              {(p) => <Input type="date" value={date} max="2026-12-31" onChange={(e) => setDate(e.target.value)} {...p} />}
            </Field>
            <Field label="Title" error={error}>
              {(p) => <Input value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="e.g. Repeat ECG" {...p} />}
            </Field>
            <Field label="Summary" optional className="sm:col-span-2">
              {(p) => <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What happened, findings, next step…" {...p} />}
            </Field>
            <button type="submit" className="sr-only">Save draft</button>
          </form>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            {(() => {
              const Icon = EVENT_ICON[type];
              return <Icon size={14} aria-hidden="true" />;
            })()}
            Drafts appear on the timeline with a dashed outline until signed.
          </p>
        </ModalContent>
      ) : null}
    </Dialog>
  );
}

