"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { ArrowUpRight, Drop, Gauge, Heart, Heartbeat, Lock, TestTube, Wind, Brain } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { ORGAN_LABEL, type SystemKey } from "@/data/anatomy";
import { CARE_PLAN, LAB_PANELS, VITAL_SERIES, type BodySystem } from "@/data/featured";
import type { PatientRecord } from "@/data/record";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { GlassCard, OrganCarousel } from "@/components/viz/organ";
import { BarsSpark, EcgSpark, SparkValue, ValuePill, WaveSpark } from "@/components/viz/condition";
import { ScheduleCard, SectionLabel } from "@/components/viz/cards";
import { UPCOMING, REQUESTED, type PortalAppt } from "@/features/portal/appointments/data";
import { TODAY_KEY, istDayKey, shortDate } from "./data";
import { ORGAN_ANCHORS, releasedHistory, visibleToPatient } from "./derive";
import { OrganStage, RangeDots, ReadingTile } from "./viz";

/**
 * Patient home, reference 3 ("Overview Conditions"): the patient's own organs and conditions
 * from their record, their tracked readings and their next visits. Everything shown here is
 * released to the patient; results still with a clinician are mentioned, never shown.
 */

type VitalPoint = { d: string; v: number; v2?: number; self: boolean };
const series = (id: string) => (VITAL_SERIES.find((s) => s.id === id)?.points ?? []) as VitalPoint[];

/**
 * The headline reading shown on the glass card for each body system: resting heart rate tracks
 * the tachycardia and beta-blocker dose, blood pressure is the modifiable risk for the vascular
 * (nervous-system) conditions, oxygen saturation follows the asthma.
 */
const HEADLINE: Partial<Record<SystemKey, { id: string; label: string }>> = {
  cardiovascular: { id: "hr", label: "Resting heart rate" },
  neurological: { id: "bp", label: "Blood pressure" },
  respiratory: { id: "spo2", label: "Oxygen saturation" },
};

/** Systolic scale (mmHg) for the blood-pressure bar spark; widened if a reading goes above it. */
const BP_SCALE: [number, number] = [100, 150];

const SYSTEM_ICON: Partial<Record<SystemKey, typeof Heart>> = { cardiovascular: Heart, neurological: Brain, respiratory: Wind };

const sourceLabel = (p: VitalPoint) => (p.self ? "home reading · self-reported" : "clinic reading");

/** Scale for a reference-range dot plot: the normal band plus 40% of its width each side, widened to fit every reading. */
function scaleAround(low: number, high: number, readings: number[]): [number, number] {
  const pad = (high - low || Math.abs(high) * 0.2 || 1) * 0.4;
  return [Math.min(low - pad, ...readings), Math.max(high + pad, ...readings)];
}

/** "Targets: blood pressure < 130/80 mmHg · …" — read from the vital series targets and the care-plan goal. */
function targetsLine() {
  const parts = ["bp", "hr"].flatMap((id) => {
    const s = VITAL_SERIES.find((x) => x.id === id);
    return s?.target ? [`${s.name.toLowerCase()} ${s.target.replace(/\s*–\s*/, "–")} ${s.unit}`] : [];
  });
  const ldlGoal = CARE_PLAN.goal.match(/LDL-C below [^;.]+/)?.[0];
  if (ldlGoal) parts.push(`${ldlGoal} (care-plan goal)`);
  return parts.length ? `Targets: ${parts.join(" · ")}.` : "";
}

// ---------------------------------------------------------------------------------------------
// Hero: organ + condition hotspots + glass reading card + condition list
// ---------------------------------------------------------------------------------------------

export function ConditionsHero({
  record,
  system,
  activeConditionId,
  onCondition,
  className,
}: {
  record: PatientRecord;
  system: BodySystem;
  activeConditionId: string | null;
  onCondition: (id: string) => void;
  className?: string;
}) {
  const conds = record.conditions.filter((c) => c.systemId === system.id);
  const active = conds.find((c) => c.id === activeConditionId) ?? conds.find((c) => c.status !== "Resolved") ?? conds[0];
  const anchors = ORGAN_ANCHORS[system.organ];
  const organ = ORGAN_LABEL[system.organ];
  const releasedCount = record.events.filter((e) => e.systemId === system.id && visibleToPatient(e) && e.state !== "scheduled").length;

  const hotspots = conds.map((c, i) => ({
    id: c.id,
    ...anchors[i % anchors.length],
    label: c.name,
    detail: `${c.status} · since ${formatDate(c.since, { month: "short", year: "numeric" })}`,
    active: c.id === active?.id,
    onClick: () => onCondition(c.id),
  }));

  return (
    <section aria-labelledby="overview-system" className={cn("relative flex flex-col gap-4 overflow-hidden rounded-card bg-sunken p-4 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Overview conditions · from your record
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2 key={system.id} id="overview-system" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={snappy} className="mt-2 text-[32px] font-light leading-[1.05] tracking-[-0.02em] text-ink">
              {system.name}
            </motion.h2>
          </AnimatePresence>
          <p className="mt-2 text-xs text-muted">
            {pluralize(conds.length, "condition")} on your {organ.toLowerCase()} · {pluralize(releasedCount, "record")} released to you
          </p>
        </div>
        <Link
          href="/portal/records"
          aria-label={`Open your ${system.name.toLowerCase()} records`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] duration-200 hover:bg-canvas active:scale-95"
        >
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <OrganStage
        kind={system.organ}
        organLabel={`3D ${organ.toLowerCase()} — ${system.name} system`}
        label={`Your ${organ.toLowerCase()}: ${conds.map((c) => `${c.name} (${c.status.toLowerCase()})`).join(", ")}`}
        hotspots={hotspots}
        className="mx-auto max-w-[420px]"
      >
        <HeadlineReading system={system} className="absolute bottom-[6%] left-0 hidden w-[min(232px,60%)] sm:block" />
      </OrganStage>
      {/* phones: the reading sits under the organ instead of covering it */}
      <HeadlineReading system={system} className="-mt-2 sm:hidden" />

      <ConditionList record={record} conditions={conds} activeId={active?.id ?? null} onSelect={onCondition} />
    </section>
  );
}

/** Glass card on the organ: the latest reading that best follows this system (ref 3 "Heart Rate"). */
function HeadlineReading({ system, className }: { system: BodySystem; className?: string }) {
  const pick = system.key ? HEADLINE[system.key] : undefined;
  const pts = pick ? series(pick.id) : [];
  const last = pts.at(-1);
  if (!pick || !last) return null;
  const Icon = (system.key && SYSTEM_ICON[system.key]) || Heart;
  const unit = VITAL_SERIES.find((s) => s.id === pick.id)?.unit ?? "";
  const value = last.v2 ? `${last.v}/${last.v2}` : String(last.v);
  return (
    <GlassCard className={className}>
      <p className="flex items-center gap-2 text-[11px] text-muted">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
          <Icon size={12} weight="fill" />
        </span>
        {pick.label}
      </p>
      <p className="mt-2 text-lg font-light leading-none text-ink">
        {value} <span className="text-xs text-muted">{unit}</span>
      </p>
      {pts.length > 1 ? (
        <div className="mt-2 h-9">
          <WaveSpark values={pts.map((p) => p.v)} label={`${last.v2 ? "Systolic blood pressure" : pick.label}, ${pts.length} readings from ${shortDate(pts[0].d)} to ${shortDate(last.d)}: ${pts.map((p) => p.v).join(", ")} ${unit}`} />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        {shortDate(last.d)} · {sourceLabel(last)} · {pts.length} readings since {shortDate(pts[0].d)}{last.v2 ? " (line = systolic)" : ""}
      </p>
    </GlassCard>
  );
}

function ConditionList({
  record,
  conditions,
  activeId,
  onSelect,
}: {
  record: PatientRecord;
  conditions: PatientRecord["conditions"];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Conditions in this body system">
      {conditions.map((c) => {
        const evs = record.events.filter((e) => e.conditionId === c.id);
        const done = evs.filter((e) => visibleToPatient(e) && e.state !== "scheduled" && e.date <= TODAY_KEY);
        const latest = done.at(-1);
        const next = evs.filter((e) => e.state === "scheduled" && e.released && e.date >= TODAY_KEY).sort((a, b) => a.date.localeCompare(b.date))[0];
        const pending = evs.filter((e) => e.state === "awaiting-review").length;
        const on = c.id === activeId;
        return (
          <li key={c.id}>
            <motion.button
              layout
              transition={spring}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={on}
              className={cn(
                "flex w-full flex-col gap-2 rounded-inner p-4 text-left transition-colors duration-200",
                on ? "bg-surface" : "bg-surface/55 hover:bg-surface/80",
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn("size-2 shrink-0 rounded-full", on ? "bg-primary" : "bg-faint")} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                <span className="shrink-0 text-xs text-muted">{c.status}</span>
              </span>
              <AnimatePresence initial={false}>
                {on ? (
                  <motion.span
                    key="detail"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={snappy}
                    className="block overflow-hidden pl-5 text-xs text-muted"
                  >
                    <span className="block">
                      Diagnosed {formatDate(c.since, { month: "short", year: "numeric" })} · {pluralize(done.length, "related record")} released to you
                    </span>
                    {latest ? (
                      <span className="block">
                        Latest: {latest.title} · {shortDate(latest.date)}
                      </span>
                    ) : null}
                    {next ? (
                      <span className="block text-ink-2">
                        Next: {next.title} · {next.date === TODAY_KEY ? "today" : shortDate(next.date)}
                      </span>
                    ) : null}
                    {pending ? (
                      <span className="mt-1 flex items-center gap-1.5 text-ink-2">
                        <Lock size={12} aria-hidden="true" />
                        {pluralize(pending, "new result")} with your doctor — you&apos;ll see {pending === 1 ? "it" : "them"} once released
                      </span>
                    ) : null}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// "My heart condition" tiles — the primary system's tracked readings
// ---------------------------------------------------------------------------------------------

export function ConditionTiles({ record, className }: { record: PatientRecord; className?: string }) {
  const primary = record.systems[0];
  const bp = series("bp");
  const hr = series("hr");
  const bpLast = bp.at(-1);
  const hrLast = hr.at(-1);
  const ldl = releasedHistory(record, "LDL-C");
  const ldlLast = ldl.points.at(-1);

  // Red cells come from the CBC panel; values from a lab day that is still under review stay hidden.
  const releasedLabDays = new Set(record.events.filter((e) => e.type === "lab" && visibleToPatient(e)).map((e) => e.date));
  type Analyte = { name: string; unit: string; range: string; points: { d: string; v: number }[]; low?: number; high?: number };
  const rbc = LAB_PANELS.flatMap((p) => p.analytes as Analyte[]).find((a) => a.name === "Erythrocytes");
  const rbcPts = (rbc?.points ?? []).filter((p) => releasedLabDays.has(p.d));
  const rbcLast = rbcPts.at(-1);

  if (!primary) return null;
  const organ = ORGAN_LABEL[primary.organ].toLowerCase();

  return (
    <section aria-labelledby="my-condition" className={className}>
      <SectionLabel>
        <span id="my-condition">My {organ} condition</span>
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {bpLast ? (
          <ReadingTile
            icon={<Gauge />}
            label="Blood pressure"
            value={`${bpLast.v}/${bpLast.v2}`}
            unit="mmHg"
            caption={`${shortDate(bpLast.d)} · ${bpLast.self ? "self-reported" : "clinic"} · ${bp.length} readings`}
            chart={
              <div className="h-full [&>div]:justify-between">
                {/* Systolic on a 100–150 mmHg scale: drawn from zero, 126–142 all read as full-height bars. */}
                <BarsSpark
                  values={bp.map((p) => p.v)}
                  domain={[BP_SCALE[0], Math.max(BP_SCALE[1], ...bp.map((p) => p.v))]}
                  label={`Systolic blood pressure, ${bp.length} readings from ${shortDate(bp[0].d)} to ${shortDate(bpLast.d)}: ${bp.map((p) => p.v).join(", ")} mmHg, bars drawn from ${BP_SCALE[0]} mmHg. Latest highlighted.`}
                />
              </div>
            }
            aside={<SparkValue value={bpLast.v} sub={`/${bpLast.v2}`} />}
          />
        ) : null}
        {hrLast ? (
          <ReadingTile
            accent
            icon={<Heartbeat />}
            label="Heart rate"
            value={hrLast.v}
            unit="bpm"
            caption={`Resting · ${shortDate(hrLast.d)} · ${hrLast.self ? "self-reported" : "clinic"}`}
            chart={<EcgSpark beats={Math.max(2, Math.round(hrLast.v / 20))} label={`Illustrative trace drawn at ${hrLast.v} beats per minute — not an ECG recording`} />}
            aside={<ValuePill value={hrLast.v} unit="bpm" />}
          />
        ) : null}
        {ldlLast ? (
          <ReadingTile
            icon={<TestTube />}
            label="LDL cholesterol"
            value={ldlLast.value}
            unit={ldlLast.unit ?? "mg/dL"}
            caption={
              ldl.pending ? (
                <span className="flex items-start gap-1">
                  <Lock size={12} className="mt-px shrink-0" aria-hidden="true" />
                  Lab, {shortDate(ldlLast.date)} · a newer result is with your doctor
                </span>
              ) : (
                `Lab · ${shortDate(ldlLast.date)}`
              )
            }
            chart={
              ldl.points.length > 1 ? (
                <WaveSpark values={ldl.points.map((p) => p.value)} label={`LDL cholesterol results released to you: ${ldl.points.map((p) => `${p.value} on ${shortDate(p.date)}`).join(", ")}`} />
              ) : (
                <span className="flex h-full items-center text-[11px] text-muted">First released result</span>
              )
            }
            aside={<SparkValue value={ldlLast.value} sub={ldlLast.unit} />}
          />
        ) : null}
        {rbc && rbcLast ? (
          <ReadingTile
            icon={<Drop />}
            label="Red blood cells"
            value={rbcLast.v.toFixed(1)}
            unit={rbc.unit}
            caption={`Lab · ${shortDate(rbcLast.d)} · normal ${rbc.range.replace(/\s*–\s*/, "–")}`}
            chart={
              <RangeDots
                readings={rbcPts.map((p) => p.v)}
                range={[rbc.low ?? rbcLast.v, rbc.high ?? rbcLast.v]}
                domain={scaleAround(rbc.low ?? rbcLast.v, rbc.high ?? rbcLast.v, rbcPts.map((p) => p.v))}
                label={`Red blood cells ${rbcPts.map((p) => `${p.v} on ${shortDate(p.d)}`).join(", ")} ${rbc.unit}; reference range ${rbc.range}`}
              />
            }
          />
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted">
        {targetsLine()} Dots on the red-cell scale: hollow = earlier result, blue = latest; the darker band is the normal range.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// "My schedule" — upcoming visits as the patient sees them, day by day
// ---------------------------------------------------------------------------------------------

const ROLE_LABEL = { doctor: "Doctor", nutritionist: "Nutritionist", yoga: "Yoga instructor", coordinator: "Care coordinator" } as const;

export function VisitsCard({ patientId, className }: { patientId: string; className?: string }) {
  const me = patientById(patientId);
  const days = useMemo(() => {
    const visits: PortalAppt[] = [...UPCOMING, ...REQUESTED].filter((a) => a.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
    const map = new Map<string, PortalAppt[]>();
    for (const v of visits) map.set(istDayKey(v.start), [...(map.get(istDayKey(v.start)) ?? []), v]);
    return [...map.entries()].map(([key, list]) => ({ key, list }));
  }, []);
  const [index, setIndex] = useState(0);
  const day = days[Math.min(index, days.length - 1)];

  const team = (Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).flatMap((k) => {
    const id = me?.careTeam[k];
    return id ? [{ id, role: ROLE_LABEL[k] }] : [];
  });
  const extra = day ? day.list.flatMap((v) => [v.staffId, ...(v.alsoWith ?? [])]).filter((id) => !team.some((t) => t.id === id)) : [];
  const people = [...team, ...[...new Set(extra)].map((id) => ({ id, role: staffById(id)?.title.split(" ·")[0] ?? "Clinician" }))]
    .map((t) => {
      const s = staffById(t.id);
      const visit = day?.list.find((v) => v.staffId === t.id || v.alsoWith?.includes(t.id));
      return {
        id: t.id,
        name: s?.name ?? t.id,
        avatar: s?.avatar,
        note: visit ? `${formatTime(visit.start)} · ${visit.service}${visit.status === "requested" ? " (requested)" : ""}` : t.role,
        has: !!visit,
        at: visit?.start ?? "",
      };
    })
    .sort((a, b) => Number(b.has) - Number(a.has) || a.at.localeCompare(b.at));

  if (!day) return null;
  const lead = day.list[0];
  const dayName = `${formatDate(lead.start, { weekday: "short" })} ${formatDate(lead.start, { day: "numeric", month: "short" })}`;
  const dateLabel = day.key === TODAY_KEY ? `Today · ${dayName}` : dayName;

  // Picking a person jumps to the next day you see them.
  const jumpTo = (personId: string) => {
    const i = days.findIndex((d) => d.list.some((v) => v.staffId === personId || v.alsoWith?.includes(personId)));
    if (i >= 0) setIndex(i);
  };

  return (
    <section aria-labelledby="my-schedule" className={className}>
      <SectionLabel
        actions={
          <Link href="/portal/appointments" className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-ink-2 transition-colors hover:bg-surface hover:text-ink">
            All visits
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        <span id="my-schedule">My schedule</span>
      </SectionLabel>
      <ScheduleCard
        title={`${pluralize(day.list.length, "visit")}${day.list.some((v) => v.status === "requested") ? " · time not confirmed yet" : ""}`}
        date={dateLabel}
        dayLabel={day.list.map((v) => formatTime(v.start)).join(" · ")}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
        people={people.map(({ id, name, avatar, note }) => ({ id, name, avatar, note }))}
        selected={lead.staffId}
        onSelect={jumpTo}
      />
      <p className="mt-3 text-xs text-muted" aria-live="polite">
        Day {Math.min(index, days.length - 1) + 1} of {days.length} with visits · pick a person to jump to your next visit with them
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// "My body systems" carousel
// ---------------------------------------------------------------------------------------------

export function SystemsCarousel({ record, selectedId, onSelect, className }: { record: PatientRecord; selectedId: string; onSelect: (systemId: string) => void; className?: string }) {
  const selected = record.systems.find((s) => s.id === selectedId) ?? record.systems[0];
  if (!selected) return null;
  return (
    <OrganCarousel
      className={className}
      title="My body systems"
      items={record.systems.map((s) => {
        const n = record.conditions.filter((c) => c.systemId === s.id).length;
        return { kind: s.organ, label: s.name, note: `${pluralize(n, "condition")} · ${ORGAN_LABEL[s.organ]}` };
      })}
      selected={selected.organ}
      onSelect={(k) => {
        const s = record.systems.find((x) => x.organ === k);
        if (s) onSelect(s.id);
      }}
    />
  );
}
