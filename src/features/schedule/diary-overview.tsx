"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { Staff } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { CapacityChart, type CapacityItem } from "./capacity-chart";
import { ChartTable, LoadChart, LoadLegend, plural, type Unit } from "./load-chart";
import { DISCIPLINE_COLOR, LEAVE, LUNCH, NOW_MIN, TODAY_KEY, quickService } from "./data";
import { hhmm, hoursLabel, rangeLabel, shortDay, type DiaryEvent, type Occupant } from "./engine";
import { dailyLoad, hourlyLoad, minutesLabel, nextFreeStart, placesOf, utilisation, type LoadBin, type LoadMeasure } from "./insights";
import { HatchSwatch } from "./ui";

const UNITS: Record<LoadMeasure, Unit> = { patients: { one: "patient", many: "patients" }, bookings: { one: "booking", many: "bookings" } };
const STORE_KEY = "carelane.schedule.overview";

/** Per-viewer convenience: remember whether the overview is folded (browser storage, optional). */
function useFolded() {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORE_KEY) === "folded") setFolded(true);
    } catch {
      /* storage unavailable: stay open */
    }
  }, []);
  const set = (v: boolean) => {
    setFolded(v);
    try {
      window.localStorage.setItem(STORE_KEY, v ? "folded" : "open");
    } catch {
      /* not persisted — fine */
    }
  };
  return [folded, set] as const;
}

/**
 * "Day overview" band above the diary: load by hour (or by day in week view) and practitioner
 * utilisation. Everything is computed from the same filtered diary the grid shows below.
 */
export function DiaryOverview({
  view,
  date,
  days,
  events,
  pool,
  occupants,
  classSeats,
  range,
  describe,
  onJump,
  onOpenDay,
  onBook,
}: {
  view: "day" | "week";
  date: string;
  days: string[];
  /** visible (filtered) diary events for the period */
  events: DiaryEvent[];
  /** practitioners in scope after the practitioner and discipline filters */
  pool: Staff[];
  /** every booking and class — free slots are checked against all of them */
  occupants: Occupant[];
  classSeats: Record<string, number>;
  range: { start: number; end: number };
  describe: (ev: DiaryEvent) => string;
  onJump: (min: number) => void;
  onOpenDay: (date: string) => void;
  onBook: (staffId: string, date: string, start: number, serviceId?: string) => void;
}) {
  const [measure, setMeasure] = useState<LoadMeasure>("patients");
  const [folded, setFolded] = useFolded();
  const unit = UNITS[measure];
  const period = view === "day" ? [date] : days;

  const bins = useMemo(
    () => (view === "day" ? hourlyLoad(events, date, range, measure, classSeats) : dailyLoad(events, days, measure, classSeats)),
    [view, events, date, range, measure, classSeats, days],
  );
  const total = bins.reduce((n, b) => n + b.total, 0);
  const peak = bins.reduce<LoadBin | null>((best, b) => (b.total > (best?.total ?? 0) ? b : best), null);
  const currentIdx = bins.findIndex((b) => b.current);
  const now = view === "day" && currentIdx >= 0 ? { index: currentIdx, fraction: (NOW_MIN % 60) / 60, label: hhmm(NOW_MIN) } : null;
  const fadedNote = view === "day" && date === TODAY_KEY ? `Started before ${hhmm(NOW_MIN)}` : view === "week" && days.some((d) => d < TODAY_KEY) ? "Days already over" : undefined;

  const utils = useMemo(() => pool.map((s) => utilisation(s, period, events)), [pool, period, events]);
  const working = utils.filter((u) => u.workMin > 0);
  const away = utils.filter((u) => u.workMin === 0);
  const items: CapacityItem[] = useMemo(
    () =>
      working.map((u) => {
        const svc = quickService(u.staff.id);
        const duration = svc?.durationMin ?? 30;
        return { util: u, duration, service: svc, next: view === "day" ? nextFreeStart(u.staff, date, occupants, duration) : null };
      }),
    [working, view, date, occupants],
  );
  const teamWork = working.reduce((n, u) => n + u.workMin, 0);
  const teamBooked = working.reduce((n, u) => n + u.bookedMin, 0);
  const teamPct = teamWork ? Math.round((teamBooked / teamWork) * 100) : null;
  const anyOutside = working.some((u) => u.outsideMin > 0);
  const periodLabel = view === "day" ? (date === TODAY_KEY ? "today" : shortDay(date)) : "this week";

  const summary = [
    plural(total, unit),
    peak ? `busiest ${view === "day" ? peak.label : peak.title} (${peak.total})` : null,
    teamPct !== null ? `${teamPct}% of working time booked` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="diary-overview-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="diary-overview-title" className="flex min-w-0 items-center gap-2 text-sm text-ink">
          <span className="size-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
          {view === "day" ? "Day overview" : "Week overview"}
          <span className="truncate text-muted">· {view === "day" ? shortDay(date) : `${shortDay(days[0])} – ${shortDay(days[days.length - 1])}`}</span>
          {folded ? <span className="hidden truncate text-muted sm:inline">· {summary}</span> : null}
        </h2>
        <Button size="sm" variant="ghost" trailing={folded ? <CaretDown /> : <CaretUp />} aria-expanded={!folded} aria-controls="diary-overview-body" onClick={() => setFolded(!folded)}>
          {folded ? "Show overview" : "Hide overview"}
        </Button>
      </div>

      {!folded ? (
        <div id="diary-overview-body" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          {/* load */}
          <div className="flex min-w-0 flex-col gap-4 rounded-card bg-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-normal tracking-[-0.01em] text-ink">{view === "day" ? "Load by hour" : "Load by day"}</h3>
                <p className="mt-1 text-xs text-muted">
                  {measure === "patients" ? "Patients due to start" : "Bookings starting"} {view === "day" ? "each hour" : "each day"} ·{" "}
                  {measure === "patients" ? "a class counts its enrolled places" : "a class counts once"} · cancelled and no-shows left out
                </p>
              </div>
              <Segmented
                size="sm"
                variant="tray"
                className="shrink-0"
                ariaLabel="Count"
                value={measure}
                onChange={setMeasure}
                items={[
                  { value: "patients", label: "Patients" },
                  { value: "bookings", label: "Bookings" },
                ]}
              />
            </div>
            <p className="-mt-2 text-sm text-ink-2">
              <span className="text-ink">{plural(total, unit)}</span> {periodLabel}
              {peak ? (
                <>
                  {" "}
                  · busiest <span className="text-ink">{peak.title}</span> with {plural(peak.total, unit)}
                </>
              ) : null}
            </p>
            <LoadChart
              height={240}
              bins={bins}
              unit={unit}
              ariaLabel={`${view === "day" ? "Load by hour" : "Load by day"}, ${unit.many} by discipline`}
              now={now}
              fadePast
              detail={(b) => (
                <ul className="flex flex-col gap-0.5">
                  {b.events.slice(0, 4).map((e) => (
                    <li key={e.id} className="truncate">
                      {describe(e)}
                    </li>
                  ))}
                  {b.events.length > 4 ? <li className="text-white/60">+{b.events.length - 4} more</li> : null}
                </ul>
              )}
              onPick={(b) => (view === "day" ? onJump(b.start ?? range.start) : b.date ? onOpenDay(b.date) : undefined)}
              pickHint={(b) => (view === "day" ? `Click to show ${b.label} in the diary` : `Click to open ${b.title}`)}
            />
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <LoadLegend fadedNote={fadedNote} />
              <ChartTable
                caption={`${view === "day" ? "Load by hour" : "Load by day"} (${unit.many})`}
                head={[view === "day" ? "Hour" : "Day", "Medical", "Nutrition", "Movement", "Total"]}
                rows={bins.map((b) => ({ key: b.key, cells: [b.title, b.counts.medical, b.counts.nutrition, b.counts.movement, b.total] }))}
              />
            </div>
          </div>

          {/* utilisation */}
          <div className="flex min-w-0 flex-col gap-4 rounded-card bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-normal tracking-[-0.01em] text-ink">Utilisation</h3>
                <p className="mt-1 text-xs text-muted">
                  Booked ÷ working time · hours from staff profiles, lunch {rangeLabel(LUNCH.start, LUNCH.end)} excluded
                </p>
              </div>
              {teamPct !== null ? (
                <div className="shrink-0 text-right">
                  <p className="text-[28px] font-light leading-none tracking-[-0.02em] text-ink">{teamPct}%</p>
                  <p className="mt-1 text-xs text-muted">
                    {minutesLabel(teamBooked)} of {minutesLabel(teamWork)}
                  </p>
                </div>
              ) : null}
            </div>
            {items.length ? (
              <CapacityChart items={items} single={view === "day"} date={view === "day" ? date : undefined} onBook={view === "day" ? (it) => it.next !== null && onBook(it.util.staff.id, date, it.next, it.service?.id) : undefined} />
            ) : (
              <p className="flex min-h-[160px] items-center justify-center rounded-inner bg-sunken px-4 text-center text-sm text-muted">
                {pool.length ? "No one in this selection works on this day." : "No practitioners match the filters."}
              </p>
            )}
            <div className="flex flex-col gap-2 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-2">
                  <span className="flex gap-px" aria-hidden="true">
                    {(["medical", "nutrition", "movement"] as const).map((d) => (
                      <span key={d} className="h-2.5 w-1.5 first:rounded-l-[3px] last:rounded-r-[3px]" style={{ background: DISCIPLINE_COLOR[d] }} />
                    ))}
                  </span>
                  <span className="text-ink-2">Booked (discipline colour)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[3px] bg-sunken-2" aria-hidden="true" />
                  <span className="text-ink-2">Free working time</span>
                </span>
                {anyOutside ? (
                  <span className="flex items-center gap-2">
                    <HatchSwatch />
                    <span className="text-ink-2">Booked outside profile hours</span>
                  </span>
                ) : null}
              </div>
              {view === "day" && date >= TODAY_KEY && items.length ? <p>Click a column to book that practitioner&apos;s next free slot for their shortest service.</p> : null}
              {away.length ? (
                <p>
                  Not working {periodLabel}:{" "}
                  {away.map((u, i) => (
                    <span key={u.staff.id}>
                      {i ? ", " : ""}
                      {u.staff.name}
                      {LEAVE[u.staff.id] ? ` (${LEAVE[u.staff.id].label.replace(/^On/, "on")})` : ""}
                    </span>
                  ))}
                </p>
              ) : null}
              {items.length ? (
                <ChartTable
                  caption={`Utilisation ${periodLabel}`}
                  head={view === "day" ? ["Practitioner", "Hours", "Booked", "Working", "Utilisation", "Next free"] : ["Practitioner", "Booked", "Working", "Utilisation"]}
                  rows={items.map((it) => ({
                    key: it.util.staff.id,
                    cells:
                      view === "day"
                        ? [it.util.staff.name, it.util.hours ? hoursLabel(it.util.hours) : "—", minutesLabel(it.util.bookedMin), minutesLabel(it.util.workMin), `${it.util.pct}%`, it.next !== null ? `${hhmm(it.next)} (${it.duration} min)` : "—"]
                        : [it.util.staff.name, minutesLabel(it.util.bookedMin), minutesLabel(it.util.workMin), `${it.util.pct}%`],
                  }))}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Tooltip line for one diary entry: "12:00 Breath & Balance · 8 places" / "12:30 Aditi Sharma". */
export function describeEvent(e: DiaryEvent, name: string, classSeats: Record<string, number>) {
  const n = e.cls ? placesOf(e, classSeats) : 0;
  return `${hhmm(e.start)} ${name}${e.cls ? ` · ${n} ${n === 1 ? "place" : "places"}` : ""}`;
}
