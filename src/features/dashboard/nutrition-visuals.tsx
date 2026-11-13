"use client";

import { useMemo, useState } from "react";
import { Barbell, Fire, Leaf } from "@phosphor-icons/react";
import { formatNumber, pluralize } from "@/lib/format";
import { Segmented } from "@/components/ui/segmented";
import { BarsSpark, SparkValue } from "@/components/viz/condition";
import { SectionLabel } from "@/components/viz/cards";
import { NUTRITION_PLANS, PLAN_STATUS_LABEL } from "@/data/programs";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { GUIDANCE, LOG_MATCH_LABEL, SLOTS, type LogMatch } from "@/features/nutrition/data";
import { sumItems, totals } from "@/features/nutrition/model";
import { useNutrition } from "@/features/nutrition/store";
import { shortDate } from "./data";
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

/**
 * A patient's self-reported meal logs as a dot plot: one dot per logged meal in time order, its
 * row = how closely the meal matched the plan (as planned at the top, skipped at the bottom).
 * Earlier meals are hollow; the latest is the accent dot. (Same idea as the kit's DotsSpark,
 * drawn larger so each meal is legible at row size.)
 */
export function LogDots({ patientId }: { patientId: string }) {
  const logs = logsFor(patientId);
  if (!logs.length) return <p className="mt-3 text-xs text-muted">No meals logged yet in Carelane.</p>;
  const counts = MATCH_ORDER.map((m) => ({ m, n: logs.filter((l) => l.match === m).length })).filter((c) => c.n);
  const breakdown = counts.map((c) => `${c.n} ${LOG_MATCH_LABEL[c.m].toLowerCase()}`).join(", ");
  const range = logs.length > 1 ? `${shortDate(logs[0].eatenAt)}–${shortDate(logs[logs.length - 1].eatenAt)}` : shortDate(logs[0].eatenAt);
  const W = 240, H = 64, padX = 10, rowH = (H - 16) / 3;
  const x = (i: number) => (logs.length === 1 ? W / 2 : padX + (i / (logs.length - 1)) * (W - padX * 2));
  const y = (m: LogMatch) => 8 + (3 - MATCH_LEVEL[m]) * rowH;
  return (
    <figure className="mt-3 rounded-[12px] bg-sunken/70 p-3">
      <div className="flex items-stretch gap-3">
        <span className="flex shrink-0 flex-col justify-between py-0.5 text-[11px] leading-none text-muted" aria-hidden="true">
          <span>As planned</span>
          <span>Skipped</span>
        </span>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-16 min-w-0 flex-1" role="img" aria-label={`Self-reported meal logs, oldest to newest: ${logs.map((l) => `${shortDate(l.eatenAt)} ${l.slot}, ${LOG_MATCH_LABEL[l.match].toLowerCase()}`).join("; ")}`}>
          {MATCH_ORDER.map((m) => (
            <line key={m} x1={0} x2={W} y1={y(m)} y2={y(m)} stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {logs.map((l, i) => {
            const last = i === logs.length - 1;
            return last ? (
              <circle key={l.id} cx={x(i)} cy={y(l.match)} r={6} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ) : (
              <circle key={l.id} cx={x(i)} cy={y(l.match)} r={4.5} fill="var(--color-surface)" stroke="var(--color-ink-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-[11px] leading-snug text-muted">
        Self-reported · {pluralize(logs.length, "meal")} logged {range}: {breakdown}
      </figcaption>
    </figure>
  );
}
