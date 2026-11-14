"use client";

import type { ReactNode } from "react";
import { Egg, ForkKnife, Grains, Lightning, UserCircle } from "@phosphor-icons/react";
import { ORGAN_LABEL, type OrganKind } from "@/data/anatomy";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/bar-chart";
import { BarsSpark, DotsSpark, VitalTile } from "@/components/viz/condition";
import { OrganHero, OrganImage } from "@/components/viz/organ";
import { SLOTS, LOG_MATCH_LABEL, type FoodLog, type LogMatch, type SlotId } from "./data";
import { grams, kcal, type SlotItems } from "./model";
import { energyVerdict, lastDays, logsByDay, matchCounts, minimumVerdict, perSlot, planFocus, planMarker, shortDay, type MacroKey, type PlanFocus, type Targets, type Verdict } from "./insight";

/* ------------------------------------------------------------------ organ */

/** Small static organ render for the system a plan addresses (never a default heart). */
export function OrganBadge({ focus, size = 48, className }: { focus: PlanFocus | null; size?: number; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-sunken", className)} style={{ width: size, height: size }}>
      {focus ? (
        <OrganImage kind={focus.organ} alt={`${ORGAN_LABEL[focus.organ]} — ${focus.system.name}`} className="size-[84%]" />
      ) : (
        <ForkKnife size={18} className="text-muted" aria-label="No condition recorded" />
      )}
    </span>
  );
}

/** Hotspot anchors on each static organ render (percent of the hero box). */
const ANCHORS: Record<OrganKind, { x: number; y: number }[]> = {
  heart: [{ x: 58, y: 66 }, { x: 64, y: 26 }, { x: 34, y: 44 }],
  brain: [{ x: 40, y: 40 }, { x: 64, y: 60 }, { x: 52, y: 28 }],
  lungs: [{ x: 34, y: 56 }, { x: 66, y: 60 }, { x: 50, y: 24 }],
  kidney: [{ x: 56, y: 44 }, { x: 40, y: 64 }],
  liver: [{ x: 40, y: 48 }, { x: 58, y: 60 }],
  cells: [{ x: 40, y: 42 }, { x: 62, y: 60 }],
  thyroid: [{ x: 38, y: 50 }, { x: 62, y: 50 }],
  pancreas: [{ x: 36, y: 54 }, { x: 60, y: 46 }],
  spine: [{ x: 50, y: 62 }, { x: 50, y: 40 }],
  uterus: [{ x: 50, y: 46 }, { x: 30, y: 46 }, { x: 70, y: 46 }],
  gut: [{ x: 56, y: 46 }, { x: 44, y: 66 }],
  knee: [{ x: 50, y: 52 }, { x: 56, y: 42 }],
};

/**
 * "What this plan addresses" (ref 3 organ hero, static render): the organ of the system the
 * plan's record entries are filed under, a hotspot per recorded condition in that system, and the
 * clinical marker the diet should move, with its own readings as the trend.
 */
export function PlanOrganCard({ patientId, header, className, heroClassName }: { patientId: string; header?: ReactNode; className?: string; heroClassName?: string }) {
  const focus = planFocus(patientId);
  const marker = focus ? planMarker(patientId, focus.system.id) : null;
  return (
    <Card className={cn("flex flex-col", className)}>
      {header}
      {focus ? (
        <>
          <OrganHero
            kind={focus.organ}
            label={`${ORGAN_LABEL[focus.organ]} — ${focus.system.name}: ${focus.conditions.map((c) => c.name).join(", ")}`}
            className={cn("mx-auto max-w-[248px]", heroClassName)}
            hotspots={focus.conditions.map((c, i) => {
              const a = ANCHORS[focus.organ][i % ANCHORS[focus.organ].length];
              return { id: c.id, x: a.x, y: a.y, label: c.name, detail: `${c.status} · ${c.markers} linked records`, active: c.id === focus.condition?.id };
            })}
          />
          <p className="text-xs text-muted">Plan addresses · {ORGAN_LABEL[focus.organ]}</p>
          <p className="mt-1 text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">{focus.system.name}</p>
          <p className="mt-1 text-sm text-ink-2">
            {focus.condition ? `${focus.condition.name} · ${focus.condition.status.toLowerCase()}` : "No condition linked"}
          </p>
          <p className="mt-2 text-xs text-muted">{focus.basis}</p>
          {marker ? (
            <div className="mt-4 flex items-center gap-3 rounded-inner bg-canvas p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted">
                  Marker to watch · {marker.label} · {marker.source} · {formatDate(marker.date, { day: "numeric", month: "short" })}
                </p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-ink">
                  <span className="text-lg font-light tabular">{marker.value}</span>
                  {marker.unit ? <span className="text-xs text-muted">{marker.unit}</span> : null}
                  {marker.flag ? <span className="text-xs text-warning">{marker.flag === "high" ? "above" : "below"} target</span> : null}
                </p>
              </div>
              {marker.history.length > 1 ? (
                <>
                  <Sparkline values={marker.history.map((h) => h.value)} className="h-8 w-[96px] shrink-0" />
                  <span className="sr-only">
                    {marker.label} readings {formatDate(marker.history[0].date, { month: "short", year: "numeric" })} to {formatDate(marker.history[marker.history.length - 1].date, { month: "short", year: "numeric" })}: {marker.history.map((h) => h.value).join(", ")}
                  </span>
                </>
              ) : (
                <span className="shrink-0 text-[11px] text-muted">first reading</span>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-inner bg-canvas p-3 text-xs text-muted">No measurement recorded for this system yet.</p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-muted">
            <ForkKnife size={22} aria-hidden="true" />
          </span>
          <p className="max-w-[32ch] text-sm text-muted">No condition is recorded for this patient yet, so there is no body system to show. It appears once a clinician records a diagnosis.</p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ plan day vs targets */

const SLOT_ABBR: Record<SlotId, string> = { early: "EM", breakfast: "B", midmorning: "MM", lunch: "L", evening: "E", dinner: "D" };

/**
 * Kit BarsSpark, one bar per meal slot (spread across the well) with slot initials underneath.
 * In a narrow well (half-width tiles) six initials collide, so only the first and last
 * (EM … D) are labelled; the caption under the tiles spells out the order.
 */
function SlotBars({ values, label }: { values: number[]; label: string }) {
  return (
    <div className="@container flex h-full flex-col gap-1.5">
      <div className="min-h-0 flex-1 [&>div]:justify-between [&>div>span]:w-1.5 [&>div>span]:bg-faint">
        <BarsSpark values={values} highlightLast={false} label={label} />
      </div>
      <div className="flex justify-between text-[11px] leading-none text-muted" aria-hidden="true">
        {SLOTS.map((s, i) => (
          <span key={s.id} className={cn("flex w-1.5 justify-center", i > 0 && i < SLOTS.length - 1 && "invisible @[112px]:visible")}>
            {SLOT_ABBR[s.id]}
          </span>
        ))}
      </div>
    </div>
  );
}

function VerdictAside({ pct, verdict }: { pct: number; verdict: Verdict }) {
  return (
    <span className="flex shrink-0 flex-col items-end self-end pb-3">
      <span className="text-lg font-light leading-none text-ink tabular">{pct}%</span>
      <span className={cn("mt-1 text-[11px]", verdict.tone === "success" ? "text-success" : "text-warning")}>{verdict.short}</span>
    </span>
  );
}

/**
 * Energy, protein and fibre for the plan's day against the doctor's targets — one VitalTile each,
 * bars = the nutrient per meal slot (EM early morning · B breakfast · MM mid-morning · L lunch ·
 * E evening · D dinner). Returns the tiles only; the caller owns the grid.
 */
/** Grams with one decimal under 100 g, so a 0.2 g shortfall never reads as "75 / ≥ 75". */
const g1 = (n: number) => String(n < 100 ? Math.round(n * 10) / 10 : Math.round(n));

export function MacroTiles({ slots, targets, tileClassName }: { slots: SlotItems; targets: Targets; tileClassName?: string | ((id: MacroKey) => string | undefined) }) {
  const per = perSlot(slots);
  const total = per.reduce((a, s) => ({ kcal: a.kcal + s.kcal, protein: a.protein + s.protein, fibre: a.fibre + s.fibre }), { kcal: 0, protein: 0, fibre: 0 });
  const tiles: { id: MacroKey; label: string; unit: string; icon: ReactNode; fmt: (n: number) => string; target: string; verdict: Verdict }[] = [
    { id: "kcal", label: "Energy", unit: "kcal", icon: <Lightning />, fmt: kcal, target: kcal(targets.kcal), verdict: energyVerdict(total.kcal, targets.kcal) },
    { id: "protein", label: "Protein", unit: "g", icon: <Egg />, fmt: g1, target: `≥ ${targets.protein}`, verdict: minimumVerdict(total.protein, targets.protein) },
    { id: "fibre", label: "Fibre", unit: "g", icon: <Grains />, fmt: g1, target: `≥ ${targets.fibre}`, verdict: minimumVerdict(total.fibre, targets.fibre) },
  ];
  return (
    <>
      {tiles.map((t) => (
        <VitalTile
          key={t.id}
          className={typeof tileClassName === "function" ? tileClassName(t.id) : tileClassName}
          icon={t.icon}
          label={t.label}
          value={
            <>
              {t.fmt(total[t.id])} <span className="text-muted">/ {t.target}</span>
            </>
          }
          unit={t.unit}
          chart={<SlotBars values={per.map((s) => s[t.id])} label={`${t.label} per meal slot: ${per.map((s) => `${s.label} ${t.id === "kcal" ? kcal(s.kcal) : grams(s[t.id])}${t.id === "kcal" ? " kcal" : ""}`).join(", ")}. ${t.verdict.text}.`} />}
          aside={<VerdictAside pct={(t.id === "kcal" ? Math.round : Math.floor)((total[t.id] / Math.max(1, targets[t.id])) * 100)} verdict={t.verdict} />}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ self-reported logs */

/**
 * Self-reported food-log entries per day over the last 14 days (kit DotsSpark; last dot = today).
 * Counts only — deliberately not an adherence score (see the adherence review).
 */
export function LogsTile({ logs, patientId, className }: { logs: FoodLog[]; patientId: string; className?: string }) {
  const days = lastDays(14);
  const buckets = logsByDay(logs, patientId, days);
  const entries = buckets.flatMap((b) => b.entries);
  const c = matchCounts(entries);
  const last = entries.reduce<FoodLog | null>((a, l) => (!a || l.eatenAt > a.eatenAt ? l : a), null);
  const range = `${shortDay(days[0])} – ${shortDay(days[days.length - 1])}`;
  return (
    <VitalTile
      className={className}
      icon={<UserCircle />}
      label={`Self-reported entries per day · ${range}`}
      value={entries.length ? `${entries.length} logged · ${c["as-planned"]} as planned${last ? ` · latest ${last.eatenAt.startsWith("2026-11-13") ? "today" : shortDay(last.eatenAt.slice(0, 10))}` : ""}` : "Nothing logged"}
      chart={
        entries.length ? (
          // Inset the plot so the first and last dots (centred on the svg edges) are drawn whole.
          <div className="h-full px-2 [&>svg]:overflow-visible">
            <DotsSpark values={buckets.map((b) => b.entries.length)} label={`Self-reported entries per day, ${range}: ${buckets.map((b) => `${shortDay(b.day)} ${b.entries.length}`).join(", ")}`} />
          </div>
        ) : (
          <p className="flex h-full items-center text-xs text-muted">No entries since {shortDay(days[0])}</p>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ log match marks */

/** Validated set: charcoal / amber / ink ring / red cross — shape carries the meaning too. */
export const MATCH_COLOR: Record<LogMatch, string> = { "as-planned": "var(--color-charcoal)", partly: "#eda100", different: "var(--color-ink-2)", skipped: "var(--color-danger)" };

export function MatchMark({ match, className }: { match: LogMatch; className?: string }) {
  const c = MATCH_COLOR[match];
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", className)} aria-hidden="true">
      {match === "as-planned" ? <circle cx="6" cy="6" r="5" fill={c} /> : null}
      {match === "partly" ? (
        <>
          <circle cx="6" cy="6" r="4.25" fill="none" stroke={c} strokeWidth="1.5" />
          <path d="M6 1.75 A4.25 4.25 0 0 0 6 10.25 Z" fill={c} />
        </>
      ) : null}
      {match === "different" ? <circle cx="6" cy="6" r="4.25" fill="none" stroke={c} strokeWidth="1.5" /> : null}
      {match === "skipped" ? <path d="M2.75 2.75 L9.25 9.25 M9.25 2.75 L2.75 9.25" stroke={c} strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  );
}

export function MatchLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2", className)} aria-label="Legend">
      {(["as-planned", "partly", "different", "skipped"] as LogMatch[]).map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <MatchMark match={m} />
          {LOG_MATCH_LABEL[m]}
        </li>
      ))}
    </ul>
  );
}

