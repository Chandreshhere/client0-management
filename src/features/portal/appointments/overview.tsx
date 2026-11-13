"use client";

import { useState } from "react";
import { BowlFood, CalendarPlus, PersonSimpleTaiChi, Stethoscope } from "@phosphor-icons/react";
import { formatTime, pluralize } from "@/lib/format";
import { staffById } from "@/data/staff";
import type { Discipline } from "@/data/types";
import { Button } from "@/components/ui/button";
import { MonthStrip } from "@/components/viz/timeline-scrubber";
import { PeopleList, ScheduleCard, SectionLabel } from "@/components/viz/cards";
import { ME } from "../record";
import { NOW_MS, dayLabel, dayOfMonth, istIso, monthShort, weekdayShort } from "../time";
import { BOOKING_DAYS, BOOK_SERVICES, UPCOMING, slotsFor, type PortalAppt } from "./data";

const DISCIPLINE_ICON: Record<Discipline, typeof Stethoscope> = { medical: Stethoscope, nutrition: BowlFood, movement: PersonSimpleTaiChi, operations: Stethoscope };

const dayName = (day: string) => {
  const iso = istIso(day, "12:00");
  return `${weekdayShort(iso)} ${dayOfMonth(iso)} ${monthShort(iso)}`;
};

/**
 * Reference 3 "My schedule": the next check-up after today, a day stepper over the open booking
 * days, and the patient's own care team with how many times each has free that day.
 */
export function BookWidget({ onBook }: { onBook: (serviceId: string, staffId: string, day: string, slot?: string) => void }) {
  const team = [ME.careTeam.doctor, ME.careTeam.nutritionist, ME.careTeam.yoga]
    .filter((id): id is string => !!id)
    .flatMap((id) => {
      const staff = staffById(id);
      const service = BOOK_SERVICES.find((s) => s.staff.includes(id));
      return staff && service ? [{ staff, service }] : [];
    });
  const firstDayWithSlots = Math.max(0, BOOKING_DAYS.findIndex((d) => team.some((t) => slotsFor(t.staff.id, d, t.service.durationMin).length)));
  const [dayIdx, setDayIdx] = useState(firstDayWithSlots);
  const day = BOOKING_DAYS[dayIdx];
  const options = team.map((t) => ({ ...t, times: slotsFor(t.staff.id, day, t.service.durationMin) }));
  const [selected, setSelected] = useState<string | undefined>(options.find((o) => o.times.length)?.staff.id ?? options[0]?.staff.id);
  const sel = options.find((o) => o.staff.id === selected) ?? options[0];

  const nextCheckup = UPCOMING.filter((a) => a.discipline === "medical" && Date.parse(a.start) > NOW_MS).sort((a, b) => a.start.localeCompare(b.start))[1] ?? null;

  return (
    <section aria-label="Book a visit with your care team" className="flex h-full flex-col gap-3 rounded-card bg-surface p-4">
      <ScheduleCard
        className="rounded-none bg-transparent p-0"
        title="Next check-up after today"
        date={nextCheckup ? `${dayLabel(nextCheckup.start)} · ${formatTime(nextCheckup.start)} · ${nextCheckup.service}` : "Nothing booked yet"}
        dayLabel={dayName(day)}
        onPrev={() => setDayIdx((i) => Math.max(0, i - 1))}
        onNext={() => setDayIdx((i) => Math.min(BOOKING_DAYS.length - 1, i + 1))}
        people={options.map((o) => ({
          id: o.staff.id,
          name: `${o.staff.name} · ${o.service.name}`,
          avatar: o.staff.avatar,
          note: o.staff.status === "on-leave" ? o.staff.workingHours : o.times.length ? `${pluralize(o.times.length, "open time")} · from ${o.times[0]}` : "No open times this day",
        }))}
        selected={sel?.staff.id}
        onSelect={setSelected}
      />
      <div className="flex flex-col gap-2 rounded-[16px] bg-canvas p-3">
        <p className="text-xs text-muted" aria-live="polite">
          {sel && sel.times.length
            ? `Open with ${sel.staff.name.startsWith("Dr.") ? sel.staff.name : sel.staff.name.split(" ")[0]} · ${dayName(day)} · ${sel.service.durationMin} min`
            : `No open times with ${sel?.staff.name ?? "them"} on ${dayName(day)} — try the next day.`}
        </p>
        {sel && sel.times.length ? (
          <ul className="grid grid-cols-3 gap-1.5" aria-label={`Open times on ${dayName(day)}`}>
            {sel.times.slice(0, 9).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => onBook(sel.service.id, sel.staff.id, day, istIso(day, t))}
                  className="h-8 w-full rounded-full bg-surface text-xs text-ink tabular shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-sunken"
                  aria-label={`Request ${t} on ${dayName(day)} with ${sel.staff.name}`}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button variant="dark" className="mt-auto justify-between rounded-[16px]" disabled={!sel || !sel.times.length} trailing={<CalendarPlus />} onClick={() => sel && onBook(sel.service.id, sel.staff.id, day)}>
        Request a time
      </Button>
      <p className="text-[11px] text-muted">Times are requests until the front desk confirms them.</p>
    </section>
  );
}

/** Reference 5 doctor list: the people the patient sees, with how many visits each (all shown here). */
export function CareTeamList({ appts, selected, onSelect }: { appts: PortalAppt[]; selected?: string; onSelect: (id: string | undefined) => void }) {
  const counts = new Map<string, number>();
  for (const a of appts) for (const id of [a.staffId, ...(a.alsoWith ?? [])]) counts.set(id, (counts.get(id) ?? 0) + 1);
  const people = [...counts.entries()]
    .map(([id, count]) => ({ s: staffById(id), count }))
    .filter((p): p is { s: NonNullable<ReturnType<typeof staffById>>; count: number } => !!p.s)
    .sort((a, b) => b.count - a.count)
    .map(({ s, count }) => ({ id: s.id, name: s.name, role: s.title.split(" · ")[0], avatar: s.avatar, count }));
  return (
    <section aria-labelledby="appt-team">
      <SectionLabel>
        <span id="appt-team">My care team · visits</span>
      </SectionLabel>
      <PeopleList people={people} selected={selected} onSelect={(id) => onSelect(id === selected ? undefined : id)} />
      <p className="mt-2 text-xs text-muted">Number = visits with each person on this page (past, booked and requested). Tap to filter; tap again to clear.</p>
    </section>
  );
}

/** Reference 2 month strip: one pill per month with a bubble per visit (by discipline). */
export function VisitMonths({ appts, active, onSelect }: { appts: PortalAppt[]; active: string; onSelect: (key: string) => void }) {
  const months = Array.from(new Set(appts.map((a) => a.start.slice(0, 7)))).sort();
  return (
    <section aria-labelledby="appt-months" className="min-w-0">
      <SectionLabel>
        <span id="appt-months">Visits by month</span>
      </SectionLabel>
      <MonthStrip
        active={active}
        onSelect={onSelect}
        months={months.map((k) => {
          const inMonth = appts.filter((a) => a.start.startsWith(k)).sort((a, b) => a.start.localeCompare(b.start));
          return {
            key: k,
            label: `${new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${k}-15T12:00:00+05:30`))} · ${inMonth.length}`,
            items: inMonth.map((a) => {
              const Icon = DISCIPLINE_ICON[a.discipline];
              return { id: a.id, icon: <Icon />, label: `${a.service} · ${dayLabel(a.start)}` };
            }),
          };
        })}
      />
      <p className="mt-2 text-xs text-muted">Bubbles = visits (first four shown): stethoscope doctor, bowl nutrition, figure yoga. Tap a month to filter the list; tap again to clear.</p>
    </section>
  );
}
