"use client";

import { useMemo, useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { formatDate, pluralize } from "@/lib/format";
import { BarChart } from "@/components/charts/bar-chart";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { PeopleList } from "@/components/viz/cards";
import { TODAY_KEY } from "@/features/settings/time";
import { CLINICIANS, WEEK_KEYS, countTick, durationText, nowState, todayLoad, weekLoad } from "./data";

/**
 * Today's load (ref 5 "doctor list with counts"): clinicians ranked by today's appointments from
 * the shared diary; selecting one shows their week as stacked columns (attended · booked ahead ·
 * no-show). Cancellations are listed in text, never stacked as load.
 */
const SERIES = [
  { id: "attended", name: "Attended or in progress", color: "var(--color-charcoal)" },
  { id: "booked", name: "Booked ahead", color: "#a9afa9" },
  { id: "noshow", name: "No-show", color: "#e34948" },
];

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const dayShort = (key: string) => `${DAY.format(new Date(`${key}T12:00:00Z`))} ${Number(key.slice(8, 10))}`;

export function LoadCard({ deactivated, onOpenStaff }: { deactivated: Record<string, string>; onOpenStaff: (id: string) => void }) {
  const ranked = useMemo(
    () =>
      CLINICIANS.map((s) => ({ s, load: todayLoad(s.id), now: nowState(s, !!deactivated[s.id]) })).sort(
        (a, b) => b.load.count - a.load.count || b.load.minutes - a.load.minutes || a.s.name.localeCompare(b.s.name),
      ),
    [deactivated],
  );
  const [selected, setSelected] = useState(ranked[0]?.s.id ?? "");
  const sel = ranked.find((r) => r.s.id === selected) ?? ranked[0];
  const week = useMemo(() => (sel ? weekLoad(sel.s.id) : []), [sel]);
  const total = week.reduce((s, d) => s + d.attended + d.booked + d.noShow, 0);
  const noShows = week.reduce((s, d) => s + d.noShow, 0);
  const cancelled = week.reduce((s, d) => s + d.cancelled, 0);
  const todayIdx = WEEK_KEYS.indexOf(TODAY_KEY);
  const totalToday = ranked.reduce((s, r) => s + r.load.count, 0);

  return (
    <Group role="region" aria-labelledby="load-title" className="flex flex-col">
      <GroupHeader icon={<ChartBar />} title={<span id="load-title">Today&apos;s load</span>} subtitle={`${pluralize(totalToday, "appointment")} across ${CLINICIANS.length} clinicians · from the shared diary`} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 p-2 pt-0 md:pt-2">
          <PeopleList
            selected={sel?.s.id}
            onSelect={setSelected}
            people={ranked.map((r) => ({
              id: r.s.id,
              name: r.s.name,
              avatar: r.s.avatar,
              role: r.now.key === "leave" ? r.now.label : r.load.count ? `${r.s.title.split(" ·")[0]} · ${durationText(r.load.minutes)} booked` : `${r.s.title.split(" ·")[0]} · nothing booked`,
              count: r.load.count,
            }))}
          />
          <p className="px-2 text-[11px] text-muted">Count = today&apos;s appointments, cancellations excluded (a no-show still held the slot).</p>
        </div>
        {sel ? (
          <Inset className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ink">{sel.s.name} · this week</p>
                <p className="text-xs text-muted">
                  {formatDate(`${WEEK_KEYS[0]}T12:00:00+05:30`, { day: "numeric", month: "short" })} – {formatDate(`${WEEK_KEYS[WEEK_KEYS.length - 1]}T12:00:00+05:30`, { day: "numeric", month: "short" })} · diary days
                </p>
              </div>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[26px] font-light leading-none tracking-[-0.01em] text-ink tabular">{total}</span>
                <span className="text-xs text-muted">
                  {pluralize(total, "appointment")}
                  {noShows ? ` · ${pluralize(noShows, "no-show")}` : ""}
                  {cancelled ? ` · ${cancelled} cancelled` : ""}
                </span>
              </p>
            </div>
            {total || cancelled ? (
              <BarChart
                ariaLabel={`${sel.s.name}, appointments per day this week: ${week.map((d) => `${dayShort(d.key)} ${d.attended} attended, ${d.booked} booked, ${d.noShow} no-show`).join("; ")}`}
                categories={week.map((d) => dayShort(d.key))}
                series={SERIES}
                values={[week.map((d) => d.attended), week.map((d) => d.booked), week.map((d) => d.noShow)]}
                highlight={todayIdx >= 0 ? todayIdx : undefined}
                formatY={countTick}
                height={196}
              />
            ) : (
              <p className="flex min-h-[196px] items-center justify-center rounded-[12px] bg-sunken p-6 text-center text-sm text-muted">
                {sel.now.key === "leave" ? `${sel.s.name} is on leave — no diary this week.` : "Nothing in the diary this week."}
              </p>
            )}
            <button type="button" onClick={() => onOpenStaff(sel.s.id)} className="w-max text-xs text-ink underline underline-offset-2">
              Open {sel.s.name.split(" ").slice(0, 2).join(" ")}&apos;s profile
            </button>
          </Inset>
        ) : null}
      </div>
    </Group>
  );
}
