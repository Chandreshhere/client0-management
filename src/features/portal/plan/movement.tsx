"use client";

import Link from "next/link";
import { ArrowUpRight, PersonSimpleTaiChi, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime, pluralize } from "@/lib/format";
import { staffById } from "@/data/staff";
import { ProgressRing } from "@/components/ui/misc";
import { Panel } from "../ui";
import { UPCOMING } from "../appointments/data";
import { daysFromToday, dayLabel, longDate, shortDate } from "../time";
import { METRICS, type MetricPoint } from "../record";
import { HR_CEILING, MOVEMENT, PACKAGE, PRECAUTIONS } from "./data";
import type { LoggedReading } from "./store";
import { withLocal } from "./tiles";

/** Movement plan with the precautions it carries, the safe heart-rate zone and session balance. */
export function MovementPanel({ readings }: { readings: LoggedReading[] }) {
  const by = staffById(MOVEMENT.by);
  const restingHr = withLocal(METRICS.hr, readings).at(-1) ?? null;
  const nextSessions = UPCOMING.filter((a) => a.discipline === "movement").sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const left = PACKAGE ? PACKAGE.total - PACKAGE.used : 0;

  return (
    <Panel icon={<PersonSimpleTaiChi />} title="Movement plan" subtitle={`${by?.name} · updated ${shortDate(`${MOVEMENT.updated}T12:00:00+05:30`)}`} className="h-full">
      <div className="rounded-inner bg-surface p-4">
        <p className="text-sm text-ink">{MOVEMENT.text}</p>
        {nextSessions.length ? (
          <>
            <p className="mt-4 text-xs text-muted">Your next sessions</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {nextSessions.map((a) => (
                <li key={a.id} className="rounded-full bg-sunken px-3 py-1.5 text-xs text-ink-2">
                  <span className="text-ink">{dayLabel(a.start)}</span> · {formatTime(a.start)}
                  {a.kind === "session" ? " · 1:1" : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {Number.isFinite(HR_CEILING) ? <HeartRateZone ceiling={HR_CEILING} resting={restingHr} /> : null}

      {PRECAUTIONS.length ? (
        <section aria-labelledby="move-precautions" className="rounded-inner bg-surface p-4">
          <h3 id="move-precautions" className="flex items-center gap-2 text-sm text-ink">
            <ShieldCheck size={16} className="text-muted" aria-hidden="true" />
            Precautions
            {MOVEMENT.clearance === "current" ? <span className="text-xs text-muted">· clearance current</span> : null}
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {PRECAUTIONS.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-movement" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{p.text}</span>
                  <span className="block text-xs text-muted">{p.source}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {PACKAGE ? (
        <Link href="/portal/billing" className="group flex items-center gap-4 rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
          <ProgressRing value={PACKAGE.used} max={PACKAGE.total} size={56} stroke={5} className="text-ink">
            <span className="text-xs text-ink">
              {PACKAGE.used}/{PACKAGE.total}
            </span>
          </ProgressRing>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink">{pluralize(left, "session")} left in your package</span>
            <span className="block text-xs text-muted">
              {PACKAGE.name} · expires {longDate(`${PACKAGE.expires}T12:00:00+05:30`)} ({pluralize(daysFromToday(`${PACKAGE.expires}T12:00:00+05:30`), "day")})
            </span>
          </span>
          <ArrowUpRight size={18} className="shrink-0 text-ink-2 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ) : null}
    </Panel>
  );
}

/** Rest → exercise ceiling on one scale: where your resting rate sits and how far you can go. */
function HeartRateZone({ ceiling, resting }: { ceiling: number; resting: MetricPoint | null }) {
  const rest = resting?.value ?? null;
  const min = 40;
  const max = Math.max(ceiling + 30, 140);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <section aria-labelledby="move-hr" className="rounded-inner bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="move-hr" className="text-sm text-ink">
          Your exercise heart-rate zone
        </h3>
        <span className="text-xs text-muted tabular">
          {rest ? `${rest} → ` : "up to "}
          {ceiling} bpm
        </span>
      </div>
      <div
        role="img"
        aria-label={`Exercise zone from your resting heart rate${rest ? ` of ${rest} bpm` : ""} up to ${ceiling} bpm. Above ${ceiling} bpm, slow down and tell your instructor.`}
        className="relative mt-6 h-3"
      >
        <span className="absolute inset-0 rounded-full bg-sunken" aria-hidden="true" />
        {rest ? <span className="absolute inset-y-0 rounded-full bg-success-soft shadow-[inset_0_0_0_1px_var(--color-success)]" style={{ left: `${pct(rest)}%`, right: `${100 - pct(ceiling)}%` }} aria-hidden="true" /> : null}
        <span className="absolute inset-y-0 right-0 rounded-r-full bg-danger-soft" style={{ left: `${pct(ceiling)}%` }} aria-hidden="true" />
        <span className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-danger" style={{ left: `${pct(ceiling)}%` }} aria-hidden="true" />
        {rest ? <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-charcoal shadow-[0_0_0_2px_var(--color-surface)]" style={{ left: `${pct(rest)}%` }} aria-hidden="true" /> : null}
      </div>
      <div className="relative mt-2 h-8 text-[11px] text-muted" aria-hidden="true">
        {rest ? (
          <span className="absolute -translate-x-1/2 text-center" style={{ left: `${pct(rest)}%` }}>
            Resting
            <br />
            {rest}
          </span>
        ) : null}
        <span className={cn("absolute -translate-x-1/2 text-center text-danger")} style={{ left: `${pct(ceiling)}%` }}>
          Ceiling
          <br />
          {ceiling}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        {resting ? `Resting rate from ${resting.self ? "your home reading" : "the clinic"} on ${shortDate(resting.date)}. ` : ""}
        Green is your working range; if you go past {ceiling} bpm, slow down and tell your instructor.
      </p>
    </section>
  );
}
