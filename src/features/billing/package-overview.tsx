"use client";

import { useMemo } from "react";
import { ArrowUpRight, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Tip } from "@/components/ui/tooltip";
import { FitBubbles } from "@/features/settings/viz";
import { addDays, TODAY_KEY } from "@/features/settings/time";
import type { PackageRow } from "./data";
import { healthOf, isLive, isLow, pace, runways, type Runway } from "./package-insights";

/**
 * Packages overview (refs 5 & 6): a cobalt focal card with credits still to use per active package
 * (bubble area), and an "expiry runway" — days until each package expires against the weekly pace
 * needed to use what's left, compared with the pace the programme schedules.
 */

const firstName = (name?: string) => name?.split(" ")[0] ?? "Patient";
const shortDay = (key: string) => formatDate(key, { day: "numeric", month: "short" });

export function CreditsFocal({ packages, onFocusPackage, onShowAttention }: { packages: PackageRow[]; onFocusPackage: (key: string) => void; onShowAttention: () => void }) {
  const live = useMemo(() => packages.map((p) => ({ p, h: healthOf(p) })).filter((r) => isLive(r.h)), [packages]);
  const runs = useMemo(() => runways(packages), [packages]);
  const left = live.reduce((s, r) => s + (r.p.total - r.p.used), 0);
  const sold = live.reduce((s, r) => s + r.p.total, 0);
  const patients = new Set(live.map((r) => r.p.patientId)).size;
  const expiring = runs.filter((r) => r.health.key === "expiring");
  const low = runs.filter((r) => isLow(r.row));
  const risky = runs.filter((r) => r.atRisk);

  const tiles = [
    { key: "active", label: "Active packages", value: live.length, sub: pluralize(patients, "patient") },
    { key: "expiring", label: "Expiring ≤ 30 days", value: expiring.length, sub: expiring[0] ? `Next: ${firstName(expiring[0].patient?.name)} · ${shortDay(expiring[0].row.expires)}` : "None" },
    { key: "low", label: "Running low", value: low.length, sub: low[0] ? `${firstName(low[0].patient?.name)} · ${pluralize(low[0].left, "credit")} left` : "None" },
    { key: "pace", label: "Pace above plan", value: risky.length, sub: risky[0] ? `${firstName(risky[0].patient?.name)} needs ${pace(risky[0].needed ?? 0)}` : "Every package on pace" },
  ];

  return (
    <section aria-labelledby="credits-focal-title" className="flex flex-col gap-2 rounded-card bg-primary p-2 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">{pluralize(live.length, "active package")}</span>
          <h2 id="credits-focal-title" className="mt-4 text-sm text-white/90">
            Session credits left
          </h2>
          <p className="mt-1 text-[44px] font-light leading-none tracking-[-0.025em] tabular">{left}</p>
          <p className="mt-2 text-xs text-white/90">
            of {sold} on active packages · {sold - left} used
          </p>
        </div>
        <p className="max-w-[24ch] text-xs text-white/90 sm:text-right">Bubble area = credits still to use on each package · select one to find it</p>
      </div>
      {live.length ? (
        <div className="px-2">
          <FitBubbles
            title="Credits left per active package"
            height={196}
            onSelect={onFocusPackage}
            smallNote="Unlabelled bubbles"
            items={runs
              .filter((r) => r.left > 0)
              .map((r) => ({
                id: r.row.key,
                label: firstName(r.patient?.name),
                value: r.left,
                display: String(r.left),
                detail: `${r.patient?.name ?? "Patient"} · ${r.row.name} · ${r.left} of ${r.row.total} left · expires ${shortDay(r.row.expires)}`,
              }))}
          />
        </div>
      ) : (
        <p className="mx-2 rounded-inner bg-surface p-4 text-sm text-ink">No active packages — sell one to start tracking credits.</p>
      )}
      <ul className="grid grid-cols-2 gap-2" aria-label="Package summary">
        {tiles.map((t) => {
          const actionable = t.key !== "active" && t.value > 0;
          const body = (
            <>
              <span className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{t.label}</span>
                {actionable ? <ArrowUpRight size={16} className="shrink-0 text-ink-2 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /> : null}
              </span>
              <span>
                <span className="block text-[22px] font-light leading-none tracking-[-0.01em] tabular">{t.value}</span>
                <span className="mt-1.5 block truncate text-xs text-muted">{t.sub}</span>
              </span>
            </>
          );
          return (
            <li key={t.key}>
              {actionable ? (
                <button
                  type="button"
                  onClick={t.key === "pace" && risky[0] ? () => onFocusPackage(risky[0].row.key) : onShowAttention}
                  className="group flex h-full w-full flex-col gap-3 rounded-inner bg-surface p-4 text-left text-ink transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5"
                >
                  {body}
                </button>
              ) : (
                <div className="flex h-full flex-col gap-3 rounded-inner bg-surface p-4 text-ink">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Day offsets → % along the runway axis. */
function useAxis(runs: Runway[]) {
  const maxDays = Math.max(60, ...runs.map((r) => r.days));
  const end = Math.ceil(maxDays / 30) * 30;
  const ticks = Array.from({ length: end / 30 + 1 }, (_, i) => i * 30);
  return { end, ticks, at: (d: number) => `${(Math.max(0, Math.min(end, d)) / end) * 100}%` };
}

export function ExpiryRunway({ packages, onFocusPackage }: { packages: PackageRow[]; onFocusPackage: (key: string) => void }) {
  const runs = useMemo(() => runways(packages), [packages]);
  const { ticks, at } = useAxis(runs);
  const risky = runs.filter((r) => r.atRisk);

  return (
    <section aria-labelledby="runway-title" className="flex flex-col gap-6 rounded-card bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="runway-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Expiry runway
          </h2>
          <p className="mt-1 max-w-[52ch] text-xs text-muted">Days until each active package expires, and the weekly pace needed to use the credits left before it does</p>
        </div>
        <div className="max-w-[18ch] shrink-0 text-right">
          <p className={cn("text-[32px] font-light leading-none tracking-[-0.02em] tabular", risky.length ? "text-danger" : "text-ink")}>{risky.length}</p>
          <p className="mt-1 text-xs text-muted">{risky.length === 1 ? "package needs a faster pace than planned" : "packages need a faster pace than planned"}</p>
        </div>
      </div>

      {runs.length ? (
        <div className="flex flex-col gap-1">
          {/* axis (desktop) */}
          <div className="hidden grid-cols-[176px_minmax(0,1fr)_148px] gap-4 md:grid" aria-hidden="true">
            <span />
            <div className="relative h-4 text-[11px] text-muted tabular">
              {ticks.map((t, i) => (
                <span key={t} className={cn("absolute whitespace-nowrap", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: at(t) }}>
                  {t === 0 ? "Today" : shortDay(addDays(TODAY_KEY, t))}
                </span>
              ))}
            </div>
            <span className="text-right text-[11px] text-muted">Pace needed · plan</span>
          </div>
          <ul className="flex flex-col">
            {runs.map((r) => (
              <li key={r.row.key}>
                <button
                  type="button"
                  onClick={() => onFocusPackage(r.row.key)}
                  className="grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 rounded-[16px] px-0 py-3 text-left transition-colors hover:bg-canvas md:grid-cols-[176px_minmax(0,1fr)_148px] md:px-0"
                  aria-label={`${r.patient?.name ?? "Patient"}, ${r.row.name}: ${pluralize(r.left, "credit")} left, expires ${shortDay(r.row.expires)} in ${pluralize(r.days, "day")}${r.needed ? `, needs ${pace(r.needed)}` : ""}${r.planned ? ` against a planned ${pace(r.planned)}` : ""}${r.atRisk ? " — faster than planned" : ""}. Find in the list`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {r.patient ? <Avatar src={r.patient.avatar} name={r.patient.name} size="sm" /> : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">
                        {r.patient?.name.split(" ")[0] ?? "Patient"} <span className="text-muted">· {r.row.name.split(" ·")[0]}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {pluralize(r.left, "credit")} · {pluralize(r.days, "day")} left
                      </span>
                    </span>
                  </span>
                  <span className="relative block h-8">
                    {/* 30-day window */}
                    <span className="absolute inset-y-0 left-0 rounded-[8px] bg-warning-soft/70" style={{ width: at(30) }} aria-hidden="true" />
                    {ticks.slice(1).map((t) => (
                      <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: at(t) }} aria-hidden="true" />
                    ))}
                    <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sunken" aria-hidden="true" />
                    <span
                      className={cn("absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]", r.days <= 30 ? "bg-warning" : "bg-charcoal")}
                      style={{ width: at(r.days) }}
                      aria-hidden="true"
                    />
                    <Tip label={`Expires ${formatDate(r.row.expires, { day: "numeric", month: "short", year: "numeric" })} · ${pluralize(r.days, "day")}`}>
                      <span className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", r.days <= 30 ? "bg-warning" : "bg-charcoal")} style={{ left: at(r.days) }} />
                    </Tip>
                  </span>
                  <span className="flex items-center gap-2 md:justify-end">
                    {r.atRisk ? <Warning size={16} className="shrink-0 text-danger" aria-hidden="true" /> : null}
                    <span className="text-right text-xs">
                      <span className={cn("text-sm tabular", r.atRisk ? "text-danger" : "text-ink")}>{r.needed ? pace(r.needed) : "—"}</span>
                      <span className="text-muted tabular"> · plan {r.planned ? pace(r.planned) : "—"}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-[12px] bg-sunken p-6 text-center text-sm text-muted">No active packages to plot.</p>
      )}

      {risky.map((r) => {
        const usable = Math.min(r.left, Math.floor((r.planned ?? 0) * (r.days / 7)));
        return (
          <p key={r.row.key} className="flex items-start gap-2 rounded-[12px] bg-danger-soft p-3 text-xs text-danger">
            <Warning size={16} className="mt-px shrink-0" aria-hidden="true" />
            <span>
              At the planned {pace(r.planned ?? 0)}, {r.patient?.name ?? "this patient"} would use about {usable} of {r.left} credits before {formatDate(r.row.expires, { day: "numeric", month: "short" })} — {pluralize(r.left - usable, "credit")} would lapse. Book extra sessions or extend the validity.
            </span>
          </p>
        );
      })}

      <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="h-1.5 w-4 rounded-full bg-charcoal" aria-hidden="true" />
          <span className="text-ink-2">Days until expiry</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-[4px] bg-warning-soft" aria-hidden="true" />
          <span className="text-ink-2">Next 30 days (amber = expires in it)</span>
        </li>
        <li>Pace needed = credits left ÷ weeks left · plan = sessions per week the programme schedules</li>
      </ul>
    </section>
  );
}
