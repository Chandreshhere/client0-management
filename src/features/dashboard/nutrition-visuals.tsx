"use client";

import { useMemo, useState } from "react";
import { Barbell, Fire, Leaf } from "@phosphor-icons/react";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { Segmented } from "@/components/ui/segmented";
import { BarsSpark, SparkValue } from "@/components/viz/condition";
import { SectionLabel } from "@/components/viz/cards";
import { NUTRITION_PLANS, PLAN_STATUS_LABEL } from "@/data/programs";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { GUIDANCE, LOG_MATCH_LABEL, SLOTS, type LogMatch } from "@/features/nutrition/data";
import { sumItems, totals } from "@/features/nutrition/model";
import { useNutrition } from "@/features/nutrition/store";
import { istDayKey, shortDate } from "./data";
import { MATCH_LEVEL, logsFor, planNutrients, type Nutrient } from "./derive";
import { ReadingTile } from "./viz";

/**
 * Nutritionist visuals: a plan's planned energy, protein and fibre against the referring
 * doctor's targets (summed from the plan's items — the same items, with this session's edits,
 * that the plan builder shows), and each patient's self-reported meal logs as dots.
 */

const NUTRIENTS: { key: Nutrient; label: string; unit: string; icon: typeof Fire }[] = [
  { key: "kcal", label: "Energy", unit: "kcal", icon: Fire },
  { key: "protein", label: "Protein", unit: "g", icon: Barbell },
  { key: "fibre", label: "Fibre", unit: "g", icon: Leaf },
];

const fmt = (n: Nutrient, v: number) => (n === "kcal" ? formatNumber(Math.round(v)) : String(Math.round(v)));

export function PlanTargets({ authorId, defaultPlanId, className }: { authorId: string; defaultPlanId?: string; className?: string }) {
  const { plans } = useNutrition();
  // Live plans of mine that have doctor guidance to compare against.
  const options = useMemo(
    () => NUTRITION_PLANS.filter((p) => p.authorId === authorId && p.status !== "superseded" && GUIDANCE[p.patientId]).map((p) => ({ id: p.id, patientId: p.patientId })),
    [authorId],
  );
  const [planId, setPlanId] = useState(defaultPlanId && options.some((o) => o.id === defaultPlanId) ? defaultPlanId : options[0]?.id ?? "");
  const option = options.find((o) => o.id === planId);
  if (!option) return null;

  const stored = plans[option.id];
  const base = planNutrients(option.id, option.patientId);
  const total = stored ? totals(stored.slots) : base?.total;
  const perSlot = stored ? SLOTS.map((s) => ({ id: s.id, label: s.label, ...sumItems(stored.slots[s.id]) })) : base?.perSlot;
  const guidance = GUIDANCE[option.patientId];
  const summary = NUTRITION_PLANS.find((p) => p.id === option.id)!;
  const version = stored?.version ?? summary.version;
  const status = stored?.status ?? summary.status;
  const patient = patientById(option.patientId);
  const doctor = staffById(guidance.by);
  if (!total || !perSlot) return null;

  return (
    <section aria-labelledby="plan-targets" className={className}>
      <SectionLabel
        actions={
          <div className="-mr-1 max-w-full overflow-x-auto">
            <Segmented
              size="sm"
              variant="tray"
              ariaLabel="Plan to compare"
              value={planId}
              onChange={setPlanId}
              items={options.map((o) => ({ value: o.id, label: patientById(o.patientId)?.name.split(" ")[0] ?? o.id }))}
            />
          </div>
        }
      >
        <span id="plan-targets">Plans against doctor targets</span>
      </SectionLabel>
      <p className="mb-3 text-xs text-muted">
        {patient?.name} · plan v{version} ({PLAN_STATUS_LABEL[status].toLowerCase()}) · targets from {doctor?.name}&apos;s guidance {guidance.version}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {NUTRIENTS.map((n) => {
          const planned = total[n.key];
          const target = guidance.targets[n.key];
          const pct = Math.round((planned / target) * 100);
          const diff = Math.round(planned - target);
          const within = Math.abs(planned - target) / target <= 0.05;
          const Icon = n.icon;
          return (
            <ReadingTile
              key={n.key}
              icon={<Icon />}
              label={`${n.label} · planned`}
              value={fmt(n.key, planned)}
              unit={n.unit}
              chart={
                <div className="h-full [&>div]:justify-between">
                  <BarsSpark
                    highlightLast={false}
                    values={perSlot.map((s) => s[n.key])}
                    label={`${n.label} by meal slot: ${perSlot.map((s) => `${s.label} ${fmt(n.key, s[n.key])} ${n.unit}`).join(", ")}`}
                  />
                </div>
              }
              aside={<SparkValue value={`${pct}%`} sub="of target" />}
              caption={
                within
                  ? `Within 5% of the ${fmt(n.key, target)} ${n.unit} target`
                  : `${fmt(n.key, Math.abs(diff))} ${n.unit} ${diff > 0 ? "above" : "below"} the ${fmt(n.key, target)} ${n.unit} target`
              }
            />
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Bars are the plan&apos;s six meal slots, early morning to dinner. Planned amounts are summed from the plan&apos;s items, including edits saved in this browser session.
      </p>
    </section>
  );
}

const MATCH_ORDER: LogMatch[] = ["as-planned", "partly", "different", "skipped"];
/** Row names for the dot plot: LOG_MATCH_LABEL, shortened to fit the 11px label column. */
const MATCH_ROW: Record<LogMatch, string> = { "as-planned": "As planned", partly: "Partly", different: "Different", skipped: "Skipped" };
/** One 16px row per match level (11px labels on a 16px leading sit centred on their track). */
const ROW_H = 16;
/** Inset of the first/last dot from the track ends: half the latest dot plus its ring. */
const DOT_PAD = 10;
/** Narrowest plot this renders at (177px in the dashboard column at 1280px) — used to thin colliding day labels. */
const MIN_PLOT_W = 176;
/** Widest weekday label ("Wed") at 11px, rounded up. */
const DAY_LABEL_W = 24;

/**
 * A patient's self-reported meal logs as a dot plot: one dot per logged meal in time order, its
 * row = how closely the meal matched the plan (every row named, as planned at the top, skipped at
 * the bottom), with the day under each run of dots. Earlier meals are hollow; the latest is the
 * accent dot. Laid out in HTML so labels share the rows' geometry (a stretched SVG viewBox drifted
 * off its labels).
 */
export function LogDots({ patientId }: { patientId: string }) {
  const logs = logsFor(patientId);
  if (!logs.length) return <p className="mt-3 text-xs text-muted">No meals logged yet in Carelane.</p>;
  const counts = MATCH_ORDER.map((m) => ({ m, n: logs.filter((l) => l.match === m).length })).filter((c) => c.n);
  const breakdown = counts.map((c) => `${c.n} ${LOG_MATCH_LABEL[c.m].toLowerCase()}`).join(", ");
  const range = logs.length > 1 ? `${shortDate(logs[0].eatenAt)}–${shortDate(logs[logs.length - 1].eatenAt)}` : shortDate(logs[0].eatenAt);

  const frac = (i: number) => (logs.length === 1 ? 0.5 : i / (logs.length - 1));
  const left = (f: number) => `calc(${DOT_PAD}px + (100% - ${DOT_PAD * 2}px) * ${f})`;
  const rowY = (m: LogMatch) => (3 - MATCH_LEVEL[m]) * ROW_H + ROW_H / 2;

  // Day labels: one per IST day, centred under that day's dots. Within a week a weekday reads
  // fastest (the caption carries the dates); longer spans fall back to "7 Nov".
  const days: { key: string; at: string; from: number; to: number }[] = [];
  logs.forEach((l, i) => {
    const key = istDayKey(l.eatenAt);
    const d = days[days.length - 1];
    if (d?.key === key) d.to = i;
    else days.push({ key, at: l.eatenAt, from: i, to: i });
  });
  const spanDays = (Date.parse(days[days.length - 1].key) - Date.parse(days[0].key)) / 86_400_000;
  const dayText = (iso: string) => (spanDays <= 6 ? formatDate(iso, { weekday: "short" }) : shortDate(iso));
  // Thin labels that would touch at the narrowest plot width; the latest day is always kept.
  const shown: { f: number; text: string }[] = [];
  const gap = (a: number, b: number) => (b - a) * (MIN_PLOT_W - DOT_PAD * 2);
  days.forEach((d, k) => {
    const f = (frac(d.from) + frac(d.to)) / 2;
    const label = { f, text: dayText(d.at) };
    if (k === days.length - 1) {
      while (shown.length && gap(shown[shown.length - 1].f, f) < DAY_LABEL_W + 4) shown.pop();
      shown.push(label);
    } else if (!shown.length || gap(shown[shown.length - 1].f, f) >= DAY_LABEL_W + 4) shown.push(label);
  });

  return (
    <figure className="mt-3 rounded-[12px] bg-sunken/70 p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        <span className="flex flex-col text-[11px] leading-4 text-muted" aria-hidden="true">
          {MATCH_ORDER.map((m) => (
            <span key={m} className="whitespace-nowrap">
              {MATCH_ROW[m]}
            </span>
          ))}
        </span>
        <div
          className="relative"
          style={{ height: ROW_H * MATCH_ORDER.length }}
          role="img"
          aria-label={`Self-reported meal logs, oldest to newest: ${logs.map((l) => `${shortDate(l.eatenAt)} ${l.slot}, ${LOG_MATCH_LABEL[l.match].toLowerCase()}`).join("; ")}`}
        >
          {MATCH_ORDER.map((m) => (
            <span key={m} aria-hidden="true" className="absolute inset-x-0 h-px -translate-y-1/2 bg-line-strong" style={{ top: rowY(m) }} />
          ))}
          {logs.map((l, i) => (
            <span
              key={l.id}
              aria-hidden="true"
              className={
                i === logs.length - 1
                  ? "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface"
                  : "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink-2 bg-surface"
              }
              style={{ left: left(frac(i)), top: rowY(l.match) }}
            />
          ))}
        </div>
        <div className="relative col-start-2 mt-1 h-4 text-[11px] leading-4 text-muted" aria-hidden="true">
          {shown.map((d) => (
            <span key={d.f} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: left(d.f) }}>
              {d.text}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] leading-snug text-muted">
        Self-reported · {pluralize(logs.length, "meal")} logged {range}: {breakdown}
      </figcaption>
    </figure>
  );
}
