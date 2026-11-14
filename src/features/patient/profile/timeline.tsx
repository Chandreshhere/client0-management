"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowsLeftRight, CalendarBlank, ClipboardText, Files, Flag, ListBullets, MapTrifold, NotePencil, ShieldWarning, Warning } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import type { CareEvent } from "@/data/featured";
import { RECORD_STATE_LABEL } from "@/data/featured";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone, type Tone } from "@/components/ui/status";
import { ChipGroup } from "@/components/viz/cards";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/shell/role-context";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorName } from "@/features/patient/event-meta";
import { EventDrawer } from "@/features/patient/event-drawer";
import { RecordProvider } from "@/features/patient/record-context";
import { CareMap } from "@/features/patient/journey";
import { readableDates, recordOf } from "@/features/patient-record/record-model";
import { useNutrition } from "@/features/nutrition/store";
import { ADHERENCE_LABEL } from "@/features/nutrition/data";
import { useTasks } from "@/features/tasks/store";
import { isFlagTask } from "@/features/tasks/flags";
import { NOW_ISO } from "@/features/tasks/time";
import { progressSummary } from "@/features/classes/progress-note-sheet";
import { ATT_LABEL } from "@/features/classes/model";
import { FlagToDoctorModal } from "@/features/tasks/flag-modal";
import { ProfileFrame } from "./frame";
import { useProfileStore } from "./profile-store";
import { assignmentsOf, firstName, precautionsOf } from "./derive";
import { useYogaProgress } from "./yoga-progress";

/**
 * Timeline (spec F9): every update — notes, reports, plan versions, sessions, assignments and
 * flags — in one feed by the date it happened (date issued, not date uploaded). Filter by
 * discipline, type and date. Instructors see the yoga side only (no diagnoses); the coordinator
 * sees status, not clinical detail.
 */

type Discipline = "medical" | "nutrition" | "yoga";
type ItemType = "notes" | "reports" | "plans" | "sessions" | "assignments" | "flags";
type Range = "since" | "3m" | "12m" | "all";

interface Item {
  id: string;
  /** when it happened (ISO date or datetime) — the feed's order */
  date: string;
  discipline: Discipline;
  type: ItemType;
  title: string;
  detail?: string;
  by: string;
  badge?: { tone: Tone; label: string };
  upcoming?: boolean;
  /** opens the full record in the event drawer */
  eventId?: string;
}

const DISCIPLINE_LABEL: Record<Discipline, string> = { medical: "Medical", nutrition: "Nutrition", yoga: "Yoga" };
const TYPE_LABEL: Record<ItemType, string> = { notes: "Notes", reports: "Reports", plans: "Plans", sessions: "Sessions", assignments: "Assignments", flags: "Flags" };
const TYPE_ICON: Record<ItemType, ReactNode> = {
  notes: <NotePencil />,
  reports: <Files />,
  plans: <ClipboardText />,
  sessions: <CalendarBlank />,
  assignments: <ArrowsLeftRight />,
  flags: <Flag />,
};
const DISCIPLINE_DOT: Record<Discipline, string> = { medical: "bg-medical", nutrition: "bg-nutrition", yoga: "bg-movement" };

const DAY_MS = 86_400_000;
const NOW = new Date(NOW_ISO).getTime();

/** Record events → feed items (plans, assignments and yoga sessions come from their own stores). */
function fromEvent(e: CareEvent): Item | null {
  if (e.type === "nutrition" && /^Plan /.test(e.source)) return null; // versions come from the plan history
  if (/^Referral /.test(e.source)) return null; // assignments come from the assignment list
  if (e.type === "movement" && /^Session c-/.test(e.source)) return null; // live attendance comes from the sessions store
  const discipline: Discipline = e.type === "nutrition" ? "nutrition" : e.type === "movement" ? "yoga" : "medical";
  const type: ItemType =
    e.type === "lab" || e.type === "imaging" || e.type === "vitals" || e.type === "document" ? "reports" : e.type === "nutrition" || e.type === "movement" ? "sessions" : "notes";
  return {
    id: e.id,
    date: e.date,
    discipline,
    type,
    title: e.title,
    detail: readableDates(e.summary),
    by: e.authorId,
    badge: { tone: recordTone(e.state), label: RECORD_STATE_LABEL[e.state] },
    upcoming: e.state === "scheduled",
    eventId: e.id,
  };
}

export function TimelineSection({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role, has } = useRole();
  const record = recordOf(patientId);
  const { plans, followUps, logs } = useNutrition();
  const tasks = useTasks();
  const yoga = useYogaProgress(patientId);
  const localAssignments = useProfileStore((s) => s.assignments);
  const localPrecautions = useProfileStore((s) => s.precautions);
  const instructor = role === "yoga";
  const coordinator = role === "coordinator";
  const clinician = role === "doctor" || role === "nutritionist";
  const first = firstName(patient);

  const allowedDisciplines: Discipline[] = instructor ? ["yoga"] : ["medical", "nutrition", "yoga"];
  const [disciplines, setDisciplines] = useState<Discipline[]>(allowedDisciplines);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [range, setRange] = useState<Range>("3m");
  const [view, setView] = useState<"list" | "map">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const e of record?.events ?? []) {
      if (e.state === "self-reported" && !has("self-report")) continue;
      const it = fromEvent(e);
      if (it) out.push(it);
    }
    // plan versions, with the reason for each change
    for (const p of Object.values(plans).filter((x) => x.patientId === patientId)) {
      for (const v of p.history) {
        out.push({
          id: `${p.id}-v${v.version}`,
          date: v.at,
          discipline: "nutrition",
          type: "plans",
          title: `Nutrition plan v${v.version} · ${v.status === "published" || v.status === "superseded" ? "published" : v.status === "in-review" ? "in review" : "draft"}`,
          detail: v.why || p.title,
          by: v.by,
          badge: v.status === "superseded" ? { tone: "neutral", label: "Superseded" } : v.status === "published" ? { tone: "success", label: "Current" } : { tone: "draft", label: "Not published" },
        });
      }
    }
    for (const f of followUps.filter((x) => x.patientId === patientId)) {
      out.push({ id: f.id, date: f.at, discipline: "nutrition", type: "notes", title: "Nutrition follow-up", detail: [f.weightKg !== null ? `Weight ${f.weightKg.toFixed(1)} kg` : null, ADHERENCE_LABEL[f.adherence], f.notes].filter(Boolean).join(" · "), by: f.by });
    }
    if (has("self-report")) {
      for (const l of Object.values(logs).filter((x) => x.patientId === patientId)) {
        out.push({ id: l.id, date: l.eatenAt, discipline: "nutrition", type: "reports", title: "Food log", detail: `${l.text} — planned: ${l.planned}`, by: patientId, badge: l.status === "reviewed" ? { tone: "success", label: "Reviewed" } : { tone: "neutral", label: "Self-reported" } });
      }
    }
    // yoga: sessions with attendance, progress notes, precautions
    for (const r of yoga.rows) {
      if (r.ended && r.state === "pending") continue;
      out.push({ id: `ses-${r.id}`, date: r.start, discipline: "yoga", type: "sessions", title: r.title, detail: r.reason || undefined, by: r.instructorId ?? "", badge: r.ended ? { tone: r.state === "absent" ? "danger" : r.state === "present" || r.state === "late" ? "success" : "neutral", label: ATT_LABEL[r.state] } : { tone: "info", label: "Upcoming" }, upcoming: !r.ended });
    }
    for (const n of yoga.notes) {
      out.push({ id: n.id, date: n.at, discipline: "yoga", type: "notes", title: `Progress note · ${n.classTitle}`, detail: [progressSummary(n), n.note].filter(Boolean).join(". "), by: n.by });
    }
    const pre = precautionsOf(patientId, localPrecautions);
    if (pre.at && pre.lines.length) {
      out.push({
        id: `pre-${patientId}`,
        date: pre.at,
        discipline: "yoga",
        type: "plans",
        title: pre.previous || pre.state === "changed" ? "Precautions changed" : "Precautions set",
        detail: pre.lines.join(" · "),
        by: pre.by ?? "",
        badge: pre.state === "changed" || pre.state === "expired" ? (yoga.ack ? { tone: "success", label: "Acknowledged" } : { tone: "warning", label: "Not acknowledged" }) : undefined,
      });
    }
    if (yoga.ack) out.push({ id: `ack-${patientId}`, date: yoga.ack.at, discipline: "yoga", type: "plans", title: "Precautions acknowledged", detail: yoga.ack.note || undefined, by: yoga.ack.by });
    for (const a of assignmentsOf(patientId, localAssignments)) {
      out.push({
        id: `asg-${a.id}`,
        date: a.at,
        discipline: a.discipline,
        type: "assignments",
        title: `Assigned to ${a.discipline} · ${staffById(a.toId)?.name ?? "the team"}`,
        detail: instructor ? undefined : a.reason,
        by: a.fromId,
        badge: a.state === "seen" ? { tone: "success", label: "Seen" } : a.overdue ? { tone: "danger", label: "Not seen in 48 h" } : { tone: "warning", label: "Assigned" },
      });
    }
    // flags to the doctor (F8) and the doctor's response
    for (const t of tasks.filter((x) => x.patientId === patientId && isFlagTask(x))) {
      const raiser = staffById(t.flag?.raisedBy ?? t.createdBy);
      const discipline: Discipline = raiser?.discipline === "nutrition" ? "nutrition" : raiser?.discipline === "movement" ? "yoga" : "medical";
      out.push({
        id: `flag-${t.id}`,
        date: t.local ? NOW_ISO : t.due,
        discipline,
        type: "flags",
        title: t.title.replace(/^Flag:\s*/, "Flag to doctor: "),
        // the title is the first sentence of the note — only repeat the note when it says more
        detail: t.notes && t.notes.replace(/[.!?]$/, "").length > t.title.replace(/^Flag:\s*/, "").replace(/…$/, "").length + 2 ? t.notes : t.notes ? undefined : t.source,
        by: raiser?.id ?? t.createdBy,
        badge: t.flag?.response ? { tone: "success", label: "Responded" } : t.status === "done" ? { tone: "neutral", label: "Closed" } : t.flag?.urgency === "same-day" || t.priority === "urgent" ? { tone: "danger", label: "Same day" } : { tone: "warning", label: "Routine" },
      });
      if (t.flag?.response) out.push({ id: `flag-${t.id}-re`, date: t.flag.response.at, discipline, type: "flags", title: "Doctor responded to a flag", detail: t.flag.response.text, by: t.flag.response.by });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [record, plans, followUps, logs, tasks, yoga, localAssignments, localPrecautions, patientId, has, instructor]);

  const since = patient.lastVisit ?? patient.registeredAt;
  const cutoff = range === "all" ? 0 : range === "since" ? new Date(since).getTime() : NOW - (range === "3m" ? 92 : 366) * DAY_MS;
  const inRange = (it: Item) => it.upcoming || new Date(it.date.length === 10 ? `${it.date}T12:00:00+05:30` : it.date).getTime() >= cutoff;
  const shown = items.filter((it) => allowedDisciplines.includes(it.discipline) && disciplines.includes(it.discipline) && (types.length === 0 || types.includes(it.type)) && inRange(it));
  const upcoming = shown.filter((it) => it.upcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = shown.filter((it) => !it.upcoming);
  const months = groupByMonth(past);
  // counts follow the range and discipline filters, so each chip says what it would show
  const typeCounts = (t: ItemType) => items.filter((it) => allowedDisciplines.includes(it.discipline) && disciplines.includes(it.discipline) && inRange(it) && it.type === t).length;

  const mapEvents = useMemo(() => {
    const ids = new Set(shown.filter((it) => it.eventId).map((it) => it.eventId));
    return (record?.events ?? []).filter((e) => ids.has(e.id));
  }, [shown, record]);

  const canOpen = clinician && !!record;

  return (
    <ProfileFrame
      patient={patient}
      title="Timeline"
      description={
        instructor
          ? `${first}'s yoga record in date order: sessions, progress notes, precautions and flags. Medical and nutrition entries are shown to the doctor and nutritionist.`
          : coordinator
            ? `Everything that happened for ${first}, in date order. Clinical detail is shown to the care team only.`
            : `Every update for ${first} in date order — by the date it happened, not the date it was uploaded.`
      }
      actions={
        (role === "nutritionist" || instructor) && has("flags") ? (
          <Button variant="secondary" leading={<Warning />} onClick={() => setFlagging(true)}>
            Flag to doctor
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="scrollbar-none -mx-4 min-w-0 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:px-0">
            <Segmented<Range>
              ariaLabel="Date range"
              size="sm"
              variant="tray"
              value={range}
              onChange={setRange}
              items={[
                { value: "since", label: patient.lastVisit ? "Since last visit" : "Since registration" },
                { value: "3m", label: "3 months" },
                { value: "12m", label: "12 months" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          {clinician && record ? (
            <Segmented
              ariaLabel="View"
              size="sm"
              value={view}
              onChange={setView}
              items={[
                { value: "list", label: "List", icon: <ListBullets /> },
                { value: "map", label: "Care map", icon: <MapTrifold /> },
              ]}
            />
          ) : null}
        </div>
        {allowedDisciplines.length > 1 ? (
          <ChipGroup<Discipline>
            ariaLabel="Discipline"
            variant="dot"
            value={disciplines}
            onChange={(v) => setDisciplines(v.length ? v : allowedDisciplines)}
            options={allowedDisciplines.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], dot: `var(--color-${d === "yoga" ? "movement" : d})` }))}
          />
        ) : null}
        <div className="scrollbar-none -mx-4 min-w-0 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:overflow-visible @[640px]:px-0">
          <ChipGroup<ItemType | "all">
            ariaLabel="Type"
            className="w-max flex-nowrap @[640px]:w-auto @[640px]:flex-wrap"
            value={types.length ? types : ["all"]}
            onChange={(next) => {
              const added = next.find((v) => !(types.length ? types : ["all"]).includes(v));
              if (added === "all" || next.length === 0) setTypes([]);
              else setTypes(next.filter((v): v is ItemType => v !== "all"));
            }}
            options={[{ value: "all" as const, label: "All types" }, ...(Object.keys(TYPE_LABEL) as ItemType[]).filter((t) => typeCounts(t) > 0 || types.includes(t)).map((t) => ({ value: t, label: TYPE_LABEL[t], count: typeCounts(t) }))]}
          />
        </div>
      </div>

      {view === "map" && clinician && record ? (
        <CareMap patient={patient} record={record} events={mapEvents} />
      ) : shown.length === 0 ? (
        <Card className="py-6">
          <EmptyState
            icon={<CalendarBlank />}
            title={items.length ? "Nothing matches these filters" : `Nothing on ${first}'s timeline yet`}
            description={items.length ? "Try a longer date range or another type." : "Notes, reports, plans, sessions and flags appear here as they happen."}
            action={
              items.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRange("all");
                    setTypes([]);
                    setDisciplines(allowedDisciplines);
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length ? <MonthBlock label="Upcoming" items={upcoming} hideDetail={coordinator} onOpen={canOpen ? setOpenId : undefined} /> : null}
          {months.map((m) => (
            <MonthBlock key={m.key} label={m.label} items={m.items} hideDetail={coordinator} onOpen={canOpen ? setOpenId : undefined} />
          ))}
          <p className="text-xs text-muted">
            Showing {shown.length} of {items.filter((it) => allowedDisciplines.includes(it.discipline)).length} entries · ordered by the date each event happened
          </p>
        </div>
      )}

      {record ? (
        <RecordProvider record={record}>
          <EventDrawer events={record.events} eventId={openId} onClose={() => setOpenId(null)} onOpenEvent={setOpenId} patientId={patientId} />
        </RecordProvider>
      ) : null}
      <FlagToDoctorModal open={flagging} onOpenChange={setFlagging} patients={[{ id: patient.id }]} context="Timeline" />
    </ProfileFrame>
  );
}

function groupByMonth(items: Item[]) {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    const k = it.date.slice(0, 7);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return [...map.entries()].map(([key, list]) => ({ key, label: formatDate(`${key}-15T12:00:00+05:30`, { month: "long", year: "numeric" }), items: list }));
}

function MonthBlock({ label, items, hideDetail, onOpen }: { label: string; items: Item[]; hideDetail: boolean; onOpen?: (id: string) => void }) {
  return (
    <section aria-label={label} className="rounded-card bg-sunken p-2">
      <h2 className="flex items-center justify-between p-2 text-sm text-ink">
        {label}
        <span className="text-xs text-muted tabular">{items.length}</span>
      </h2>
      <ol className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id}>
            <Row item={it} hideDetail={hideDetail} onOpen={onOpen} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ item, hideDetail, onOpen }: { item: Item; hideDetail: boolean; onOpen?: (id: string) => void }) {
  const clickable = !!onOpen && !!item.eventId;
  const who = item.by ? (staffById(item.by)?.name ?? authorName(item.by)) : null;
  const inner = (
    <>
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4" aria-hidden="true">
        {item.type === "plans" && item.discipline === "yoga" ? <ShieldWarning /> : TYPE_ICON[item.type]}
        <span className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface", DISCIPLINE_DOT[item.discipline])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{item.title}</span>
        {item.detail && !hideDetail ? <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-2">{item.detail}</span> : null}
        <span className="mt-1 block text-xs text-muted">
          {formatDate(item.date.length === 10 ? `${item.date}T12:00:00+05:30` : item.date, { day: "numeric", month: "short", year: "numeric" })} · {DISCIPLINE_LABEL[item.discipline]}
          {who ? ` · ${who}` : ""}
        </span>
      </span>
      {item.badge ? (
        <StatusBadge tone={item.badge.tone} className="shrink-0">
          {item.badge.label}
        </StatusBadge>
      ) : null}
    </>
  );
  const cls = "flex w-full items-start gap-3 rounded-inner bg-surface p-4 text-left";
  return clickable ? (
    <button type="button" onClick={() => onOpen!(item.eventId!)} className={cn(cls, "transition-colors hover:bg-canvas")}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

