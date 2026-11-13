"use client";

import Link from "next/link";
import { Fragment } from "react";
import { ArrowUpRight, BowlFood, CalendarCheck, CheckCircle, Heartbeat, PersonSimpleTaiChi, Pill as PillIcon, Stethoscope } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { ProgressRing } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { DemoNote, Panel } from "../ui";
import { NOW_LABEL, TODAY_KEY, istDay, istMinutes, nowIso, weekdayShort } from "../time";
import { TODAY_IS_OFFICE, TODAY_ITEMS, type TodayItem, type TodayKind } from "./data";
import { setTick, tickKey, type LoggedReading } from "./store";

const KIND_ICON: Record<TodayKind, typeof BowlFood> = {
  meal: BowlFood,
  medicine: PillIcon,
  practice: PersonSimpleTaiChi,
  log: Heartbeat,
  class: PersonSimpleTaiChi,
  visit: Stethoscope,
};

const NOW_MIN = istMinutes(nowIso());

/**
 * Today's plan as one checklist on a time rail: meals at home-day (or office-day) times,
 * medicines, practice and logging, with today's visits as context. Ticks persist per day in this
 * browser session; items done elsewhere (class attendance, the patient's food log) are locked.
 */
export function TodayPanel({ ticks, readings, onLogBp }: { ticks: Record<string, boolean>; readings: LoggedReading[]; onLogBp: () => void }) {
  const bpToday = readings.filter((r) => r.kind === "bp" && istDay(r.measuredAt) === TODAY_KEY).at(-1);
  const isDone = (it: TodayItem) => !!it.doneBy || (it.kind === "log" ? !!bpToday : !!ticks[tickKey(it.id)]);
  const counted = TODAY_ITEMS.filter((i) => i.kind !== "visit");
  const done = counted.filter(isDone).length;
  const nowIndex = TODAY_ITEMS.findIndex((i) => i.at > NOW_MIN);

  return (
    <Panel
      icon={<CalendarCheck />}
      title="Today"
      subtitle={`${weekdayShort(nowIso())} · ${TODAY_IS_OFFICE ? "office day" : "home day"} · ${done} of ${counted.length} done`}
      action={
        <ProgressRing value={done} max={counted.length} size={40} stroke={4} className={cn("rounded-full bg-surface transition-colors", done === counted.length ? "text-success" : "text-ink")}>
          <span className="text-ink" aria-label={`${done} of ${counted.length} done`}>
            {done}/{counted.length}
          </span>
        </ProgressRing>
      }
      className="h-full"
    >
      <ol className="relative flex flex-col rounded-inner bg-surface p-2" aria-label="Today's plan, in time order">
        <span aria-hidden="true" className="absolute bottom-6 left-[84px] top-6 w-px bg-line" />
        {TODAY_ITEMS.map((it, i) => (
          <Fragment key={it.id}>
            {i === nowIndex ? <NowLine /> : null}
            <Row item={it} done={isDone(it)} bpToday={bpToday} onLogBp={onLogBp} />
          </Fragment>
        ))}
        {nowIndex === -1 ? <NowLine /> : null}
      </ol>
      <DemoNote className="px-2 pb-2">Ticks are saved in this browser session only. Items marked “Clinic” or “Logged by you” were recorded elsewhere.</DemoNote>
    </Panel>
  );
}

function NowLine() {
  return (
    <li aria-label={`Now, ${NOW_LABEL}`} className="relative z-[1] grid grid-cols-[48px_16px_minmax(0,1fr)] items-center gap-x-3 px-2 py-1">
      <span className="text-[11px] text-primary-ink tabular">{NOW_LABEL}</span>
      <span className="mx-auto size-2 rounded-full bg-primary shadow-[0_0_0_3px_var(--color-surface)]" aria-hidden="true" />
      <span className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px flex-1 bg-primary/40" />
        <span className="text-[11px] text-primary-ink">Now</span>
      </span>
    </li>
  );
}

function Row({ item, done, bpToday, onLogBp }: { item: TodayItem; done: boolean; bpToday?: LoggedReading; onLogBp: () => void }) {
  const Icon = KIND_ICON[item.kind];
  const locked = !!item.doneBy;
  const visit = item.kind === "visit";
  return (
    <li className={cn("relative grid grid-cols-[48px_16px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-[12px] px-2 py-2", !visit && "hover:bg-canvas")}>
      <span className={cn("pt-0.5 text-xs tabular", visit ? "text-ink" : "text-muted")}>{item.time}</span>
      <span className="relative z-[1] flex justify-center pt-0.5">
        {visit ? (
          <span className="mt-1 size-2.5 rounded-full bg-charcoal shadow-[0_0_0_3px_var(--color-surface)]" aria-hidden="true" />
        ) : item.kind === "log" ? (
          <span className={cn("flex size-4 items-center justify-center rounded-full shadow-[0_0_0_3px_var(--color-surface)]", done ? "bg-charcoal text-white" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong),0_0_0_3px_var(--color-surface)]")} aria-hidden="true">
            {done ? <CheckCircle size={16} weight="fill" /> : null}
          </span>
        ) : (
          <Checkbox
            checked={done}
            disabled={locked}
            onCheckedChange={(v) => setTick(item.id, v === true)}
            aria-label={`${item.label}${item.time ? ` (${item.time})` : ""}`}
            className="size-4 rounded-[5px] shadow-[inset_0_0_0_1.5px_var(--color-line-strong),0_0_0_3px_var(--color-surface)] disabled:opacity-100"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className={cn("flex items-start gap-1.5 text-sm transition-colors duration-200 sm:items-center", done && !locked && item.kind !== "log" ? "text-muted line-through" : "text-ink")}>
          <Icon size={16} className="mt-0.5 shrink-0 text-muted sm:mt-0" aria-hidden="true" />
          <span className="min-w-0 sm:truncate">{item.label}</span>
        </span>
        <span className="block text-xs text-muted">
          {item.kind === "log" && bpToday
            ? `${bpToday.value}/${bpToday.value2} mmHg at ${formatTime(bpToday.measuredAt)} · self-reported`
            : (item.doneBy ?? item.detail)}
        </span>
      </span>
      <span className="flex items-center self-center">
        {visit && item.href ? (
          <Link href={item.href} className="inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" aria-label={`Open ${item.label} in appointments`}>
            <ArrowUpRight size={16} />
          </Link>
        ) : item.kind === "log" && !done ? (
          <Button size="sm" variant="dark" onClick={onLogBp}>
            Log reading
          </Button>
        ) : locked ? (
          <StatusBadge tone="neutral" dot={false} className="h-5 px-2 text-[11px]">
            {item.kind === "class" ? "Clinic" : "Logged by you"}
          </StatusBadge>
        ) : null}
      </span>
    </li>
  );
}
