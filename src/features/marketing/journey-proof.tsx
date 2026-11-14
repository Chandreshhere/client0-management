"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { BubbleChart } from "@/components/viz/bubble-chart";
import { ChipGroup } from "@/components/viz/cards";
import { FlowMap, type FlowEdge, type FlowNode } from "@/components/viz/flow-map";
import { EVENT_TYPE_LABEL, LINK_LABEL, RECORD_STATE_LABEL, type CareEvent, type LinkKind } from "@/data/featured";
import { careTeamActivity, eventsByType } from "@/data/insights";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { snappy } from "@/lib/motion";
import { EVENT_ICON, NOW, PROOF_PATIENTS, conditionOf, proofPatient } from "./care-map-model";
import { KIND_CHIP, LANES, LINK_KINDS, documentedLinks, laneOf, linkSentence, monthKey, monthLabel, type DocLink } from "./journey-model";
import { OpenRecordLink } from "./open-record";
import { PatientSwitcher } from "./patient-switcher";

/**
 * Journey proof (refs 5 & 6): a metro map of one record's documented links, filterable by link
 * kind, beside a bubble chart of that record's events by type (cobalt focal card) and the people
 * who authored the record. Desktop/tablet: the pannable FlowMap with minimap. Phones: the same
 * links as a readable list (a canvas you drag would fight the page scroll).
 */
const COL_W = 200;
const LEFT = 150;
const LANE_H = 148;
const NODE_W = 188;
const TOP = 56;
const SHORT = { day: "numeric", month: "short" } as const;
/** How a documented link reads from each end (the record stores it on the earlier event). */
const INCOMING: Record<LinkKind, string> = { ordered: "Ordered at", "reviewed-in": "Reviews", "led-to": "Follows from", referred: "Assigned from", revised: "Revises", "follow-up": "Follow-up to" };
const OUTGOING: Record<LinkKind, string> = { ordered: "Ordered", "reviewed-in": "Reviewed in", "led-to": "Led to", referred: "Assigned to", revised: "Revised as", "follow-up": "Followed up by" };

export function JourneyProof() {
  const [pid, setPid] = useState(PROOF_PATIENTS[0].patient.id);
  const pp = proofPatient(pid);
  const { record, patient } = pp;
  const all = useMemo(() => documentedLinks(record), [record]);
  const present = useMemo(() => LINK_KINDS.filter((k) => all.some((l) => l.kind === k)), [all]);
  const [kinds, setKinds] = useState<LinkKind[]>(present);
  const links = useMemo(() => all.filter((l) => kinds.includes(l.kind)), [all, kinds]);
  const [selected, setSelected] = useState<string | null>(null);

  const switchPatient = (id: string) => {
    const next = documentedLinks(proofPatient(id).record);
    setPid(id);
    setKinds(LINK_KINDS.filter((k) => next.some((l) => l.kind === k)));
    setSelected(null);
  };

  const events = useMemo(() => {
    const map = new Map<string, CareEvent>();
    for (const l of links) {
      map.set(l.from.id, l.from);
      map.set(l.to.id, l.to);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [links]);
  // opening stop: the newest recorded event that something in the record points to (shows "why")
  const focus =
    events.find((e) => e.id === selected) ??
    [...events].reverse().find((e) => e.state !== "scheduled" && links.some((l) => l.to.id === e.id)) ??
    events[events.length - 1];

  const firstName = patient.name.split(" ")[0];
  const year = record.years[0];
  const byType = useMemo(() => eventsByType(record, year).map((t) => ({ id: t.id, label: t.label, value: t.value })), [record, year]);
  const yearTotal = byType.reduce((n, t) => n + t.value, 0);
  const authors = useMemo(() => careTeamActivity(record).slice(0, 4), [record]);
  const conditionName = useCallback((id: string) => conditionOf(record, id)?.name ?? "", [record]);

  return (
    <div className="flex flex-col gap-4">
      <PatientSwitcher value={pid} onChange={switchPatient} label="Patient journey to show" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[344px_minmax(0,1fr)]">
        <div className="order-2 flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:items-start xl:order-1 xl:flex">
          <div className="rounded-card bg-primary p-6 text-white">
            <p className="text-sm">Records by type · {year}</p>
            <p className="mt-1 text-xs text-white/70">
              <span className="tabular">{yearTotal}</span> events in {firstName}&apos;s {year} record · bubble area = count
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${pid}-${year}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={snappy}>
                {byType.length ? (
                  <BubbleChart items={byType} title={`${firstName}'s records by type, ${year}`} unit="events" className="-mx-2 mt-4 w-[calc(100%+16px)]" height={220} />
                ) : (
                  <p className="mt-4 rounded-inner bg-white/10 p-4 text-sm">No events recorded in {year}.</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="rounded-card bg-sunken p-2">
            <p className="flex items-center justify-between px-2 pb-2 pt-2 text-xs text-muted">
              Records authored
              <span>all years</span>
            </p>
            <ul className="flex flex-col gap-1">
              {authors.map(({ staff, count }) => (
                <li key={staff.id} className="flex items-center gap-3 rounded-inner bg-surface p-2 pr-3">
                  <Avatar src={staff.avatar} name={staff.name} size="md" loading="eager" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-muted">{staff.title.split(" ·")[0]}</span>
                    <span className="block truncate text-sm text-ink">{staff.name}</span>
                  </span>
                  <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-charcoal px-1.5 text-xs text-white tabular" aria-label={`${count} records`}>
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <div className="flex flex-col gap-2">
            <ChipGroup
              ariaLabel="Documented link kinds"
              value={kinds}
              onChange={setKinds}
              options={present.map((k) => ({ value: k, label: KIND_CHIP[k], count: all.filter((l) => l.kind === k).length }))}
            />
            <p className="text-xs text-muted" aria-live="polite">
              {firstName}&apos;s record · <span className="tabular">{events.length}</span> events joined by <span className="tabular">{links.length}</span> documented{" "}
              {links.length === 1 ? "link" : "links"}
              {events.length ? (
                <>
                  {" "}
                  · {formatDate(events[0].date, { month: "short", year: "numeric" })} – {formatDate(events[events.length - 1].date, { month: "short", year: "numeric" })}
                </>
              ) : null}
              . Lines appear only where the record documents the link.
            </p>
          </div>
          <div className="hidden rounded-card bg-sunken p-2 md:block">
            {links.length ? (
              <JourneyMap key={`${pid}-${kinds.join(",")}`} links={links} events={events} selected={focus?.id ?? null} onSelect={setSelected} patientName={patient.name} conditionName={conditionName} />
            ) : (
              <EmptyLinks firstName={firstName} className="rounded-inner" />
            )}
          </div>
          <div className="md:hidden">{links.length ? <LinkList links={links} onSelect={setSelected} selected={focus?.id ?? null} /> : <EmptyLinks firstName={firstName} />}</div>
          {focus ? <FocusStrip event={focus} links={links} onSelect={setSelected} patientId={patient.id} conditionName={conditionOf(record, focus.conditionId)?.name ?? ""} /> : null}
        </div>
      </div>
    </div>
  );
}

function EmptyLinks({ firstName, className }: { firstName: string; className?: string }) {
  return <p className={cn("rounded-card bg-surface p-6 text-sm text-muted", className)}>No documented links of the selected kinds in {firstName}&apos;s record. Turn a link kind back on above.</p>;
}

/* ------------------------------------------------------------------ desktop metro map */

function JourneyMap({
  links,
  events,
  selected,
  onSelect,
  patientName,
  conditionName,
}: {
  links: DocLink[];
  events: CareEvent[];
  selected: string | null;
  onSelect: (id: string) => void;
  patientName: string;
  conditionName: (id: string) => string;
}) {
  const first = monthKey(events[0].date);
  const last = Math.max(monthKey(events[events.length - 1].date), first);
  const months = last - first + 1;
  const lanes = LANES.filter((l) => events.some((e) => laneOf(e) === l.key));

  const { nodes, focusX } = useMemo(() => {
    const lastRight: Record<string, number[]> = {};
    let focusX = 0;
    const nodes: FlowNode[] = events.map((e) => {
      const lane = laneOf(e);
      const laneIdx = lanes.findIndex((l) => l.key === lane);
      const d = Number(e.date.slice(8, 10));
      const x = LEFT + (monthKey(e.date) - first) * COL_W + ((d - 1) / 31) * (COL_W - 20);
      const rows = (lastRight[lane] ??= []);
      let sub = rows.findIndex((r) => x > r + 12);
      if (sub === -1) sub = rows.length;
      rows[sub] = x + NODE_W;
      if (e.state !== "scheduled") focusX = Math.max(focusX, x);
      const Icon = EVENT_ICON[e.type];
      const on = e.id === selected;
      const tone = e.state === "scheduled" ? "scheduled" : e.state === "draft" ? "draft" : e.state === "awaiting-review" ? "review" : e.state === "self-reported" ? "self" : "done";
      return {
        id: e.id,
        x,
        y: TOP + laneIdx * LANE_H + (sub % 3) * 48,
        width: NODE_W,
        content: (
          <button
            type="button"
            onClick={() => onSelect(e.id)}
            aria-pressed={on}
            aria-label={`${EVENT_TYPE_LABEL[e.type]}: ${e.title}, ${formatDate(e.date)}, ${RECORD_STATE_LABEL[e.state]}`}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-full bg-surface pl-1 pr-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5",
              on ? "shadow-[inset_0_0_0_2px_var(--color-charcoal)]" : tone === "scheduled" ? "shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "shadow-[0_1px_2px_rgb(33_38_34/0.06)]",
              tone === "self" && !on && "border border-dashed border-primary",
            )}
          >
            <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full", tone === "scheduled" || tone === "draft" || tone === "self" ? "bg-primary-soft text-primary" : "bg-primary text-white")}>
              <Icon size={16} aria-hidden="true" />
              {tone === "review" ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning ring-2 ring-surface" aria-hidden="true" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{e.title}</span>
              <span className="block truncate text-[10px] text-muted">{conditionName(e.conditionId)}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted tabular">
              {e.date.slice(8, 10)}.{e.date.slice(5, 7)}
            </span>
          </button>
        ),
      };
    });
    return { nodes, focusX };
  }, [events, lanes, first, selected, onSelect, conditionName]);

  const edges: FlowEdge[] = links.map((l) => ({
    from: l.from.id,
    to: l.to.id,
    tone: "primary",
    label: linkSentence(l),
    detail: `${formatDate(l.from.date, SHORT)} → ${formatDate(l.to.date, SHORT)} · documented link: ${LINK_LABEL[l.kind]}`,
  }));
  const width = LEFT + months * COL_W + 120;
  const height = TOP + lanes.length * LANE_H + 8;
  const nowKey = NOW.year * 12 + NOW.month;

  return (
    <FlowMap
      className="rounded-inner"
      label={`Documented care journey for ${patientName}`}
      nodes={nodes}
      edges={edges}
      width={width}
      height={height}
      viewportHeight={Math.min(height, 584)}
      minimap={height > 440}
      rows={lanes.map((l, i) => ({ y: TOP + i * LANE_H + 22, label: l.label, hint: l.hint }))}
      columns={Array.from({ length: months }, (_, i) => {
        const key = first + i;
        return { x: LEFT + i * COL_W, label: monthLabel(key, i === 0 || key % 12 === 0), strong: key === nowKey };
      })}
      initialFocusX={focusX}
    />
  );
}

/* ------------------------------------------------------------------ phone list */

function LinkList({ links, onSelect, selected }: { links: DocLink[]; onSelect: (id: string) => void; selected: string | null }) {
  const [all, setAll] = useState(false);
  const newest = [...links].reverse();
  const shown = all ? newest : newest.slice(0, 6);
  return (
    <div className="rounded-card bg-surface p-2">
      <ol className="flex flex-col gap-2" aria-label="Documented links, newest first">
        {shown.map((l) => (
          <li key={l.id} className="rounded-inner bg-canvas p-3">
            <div className="flex items-center gap-2">
              <EventButton event={l.from} onSelect={onSelect} on={selected === l.from.id} />
              <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-muted" />
              <EventButton event={l.to} onSelect={onSelect} on={selected === l.to.id} />
            </div>
            <p className="mt-2 text-[11px] text-muted">Documented: {linkSentence(l)}</p>
          </li>
        ))}
      </ol>
      {links.length > 6 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="m-2 inline-flex h-8 items-center rounded-full px-3 text-xs text-ink hover:bg-sunken">
          {all ? "Show fewer" : `Show all ${links.length} links`}
        </button>
      ) : null}
    </div>
  );
}

function EventButton({ event, onSelect, on }: { event: CareEvent; onSelect: (id: string) => void; on: boolean }) {
  const Icon = EVENT_ICON[event.type];
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      aria-pressed={on}
      className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2 text-left", on && "shadow-[inset_0_0_0_2px_var(--color-charcoal)]")}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-ink">{event.title}</span>
        <span className="block text-[10px] text-muted tabular">{formatDate(event.date, SHORT)}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ selected stop */

function FocusStrip({ event, links, onSelect, patientId, conditionName }: { event: CareEvent; links: DocLink[]; onSelect: (id: string) => void; patientId: string; conditionName: string }) {
  const incoming = links.filter((l) => l.to.id === event.id);
  const outgoing = links.filter((l) => l.from.id === event.id);
  const Icon = EVENT_ICON[event.type];
  return (
    <div className="grid grid-cols-1 gap-4 rounded-card bg-surface p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:p-6" aria-live="polite">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {EVENT_TYPE_LABEL[event.type]} · {conditionName}
          </p>
          <p className="mt-1 text-base leading-snug text-ink">{event.title}</p>
          <p className="mt-1 text-xs text-muted tabular">
            Happened {formatDate(event.date, SHORT)} · entered {formatDate(event.enteredAt, SHORT)}
          </p>
          <StatusBadge tone={recordTone(event.state)} className="mt-2">
            {RECORD_STATE_LABEL[event.state]}
          </StatusBadge>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <LinkGroup title="Linked from" empty="Nothing in the record points to this event." items={incoming.map((l) => ({ id: l.from.id, text: `${INCOMING[l.kind]} ${l.from.title}`, date: l.from.date }))} onSelect={onSelect} />
        <LinkGroup title="Links to" empty="No later event is linked from this one yet." items={outgoing.map((l) => ({ id: l.to.id, text: `${OUTGOING[l.kind]} ${l.to.title}`, date: l.to.date }))} onSelect={onSelect} />
        <OpenRecordLink patientId={patientId} tab="journey" className="-ml-3 self-start">
          Open the full journey in the demo
        </OpenRecordLink>
      </div>
    </div>
  );
}

function LinkGroup({ title, items, empty, onSelect }: { title: string; items: { id: string; text: string; date: string }[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="text-xs text-muted">{title}</p>
      {items.length ? (
        <ul className="mt-1 flex flex-col">
          {items.map((it) => (
            <li key={it.id + it.text}>
              <button type="button" onClick={() => onSelect(it.id)} className="flex w-full items-baseline justify-between gap-3 rounded-[8px] py-1 text-left text-sm text-ink hover:text-primary-ink">
                <span className="min-w-0 truncate">{it.text}</span>
                <span className="shrink-0 text-xs text-muted tabular">{formatDate(it.date, SHORT)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}
