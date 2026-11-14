"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CaretDown } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { formatINR, formatTime, pluralize } from "@/lib/format";
import { BarChart, SegmentedBar } from "@/components/charts/bar-chart";
import { Avatar } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { TODAY_KEY, istDayKey, shortDate } from "@/features/settings/time";
import { FitBubbles } from "@/features/settings/viz";
import type { DisplayStatus } from "./data";
import { METHOD_ICON, money } from "./meta";
import { STATUS_FILL, WEEK_DAYS, collections, dailyCollections, dayBreakdown, dayLabel, oldestOpen, outstandingByStatus, rupeesShort, statusCounts, weeklyCollections } from "./insights";
import type { InvoiceView } from "./store";

/**
 * Billing overview: a cobalt focal card with the outstanding balance as bubbles, daily collections
 * by method and practitioner, and a stat row with the invoice status split. Every figure is
 * computed in ./insights from the invoices and the payments recorded against them.
 */

const SHORT_STATUS: Partial<Record<DisplayStatus, string>> = { "partially-paid": "Partly paid" };

/**
 * The shared packer leaves only ~6 viewBox px between neighbours, so on the cobalt card the white
 * focal bubble reads as touching (or overlapping) its neighbours. Drawing every circle at 90% of its
 * packed radius, about its own centre, opens a clear gap; areas stay proportional and labels stay put.
 */
export const BUBBLE_AIR = "[&_circle]:origin-center [&_circle]:[transform-box:fill-box] [&_circle]:scale-90";

export function OutstandingFocal({ invoices, onFocusStatus }: { invoices: InvoiceView[]; onFocusStatus: (s: DisplayStatus) => void }) {
  const buckets = useMemo(() => outstandingByStatus(invoices), [invoices]);
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const count = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <section aria-labelledby="outstanding-title" className="flex flex-col gap-2 rounded-card bg-primary p-2 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">{pluralize(count, "open invoice")}</span>
          <h2 id="outstanding-title" className="mt-4 text-sm text-white/90">
            Outstanding balance
          </h2>
          <p className="mt-1 text-[44px] font-light leading-none tracking-[-0.025em]">{formatINR(total)}</p>
        </div>
        <p className="max-w-[24ch] text-xs text-white/90 sm:text-right">Bubble area = amount still owed, split by invoice status</p>
      </div>
      {buckets.length ? (
        <>
          <div className="px-2">
            <FitBubbles
              className={BUBBLE_AIR}
              title="Outstanding balance by status"
              height={220}
              onSelect={(id) => onFocusStatus(id as DisplayStatus)}
              items={buckets.map((b) => ({ id: b.status, label: SHORT_STATUS[b.status] ?? b.label, value: b.amount, display: rupeesShort(b.amount), detail: `${formatINR(b.amount)} across ${pluralize(b.count, "invoice")} — select to list them` }))}
            />
          </div>
          <ul className="grid grid-cols-2 gap-2" aria-label="Open invoices by status">
            {buckets.map((b) => (
              <li key={b.status}>
                <button
                  type="button"
                  onClick={() => onFocusStatus(b.status)}
                  className="group flex h-full w-full flex-col gap-3 rounded-inner bg-surface p-4 text-left text-ink transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5"
                  aria-label={`Show ${b.label.toLowerCase()} invoices: ${pluralize(b.count, "invoice")}, ${formatINR(b.amount)}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_FILL[b.status] }} aria-hidden="true" />
                      <span className="truncate">{b.label}</span>
                    </span>
                    <ArrowUpRight size={16} className="shrink-0 text-ink-2 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[22px] font-light leading-none tracking-[-0.01em]">{formatINR(b.amount)}</span>
                    <span className="mt-1.5 block text-xs text-muted">{pluralize(b.count, "invoice")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mx-2 mb-2 rounded-inner bg-surface p-4 text-sm text-ink">Nothing outstanding — every invoice is settled or refunded.</p>
      )}
    </section>
  );
}

const SERIES = [{ id: "collected", name: "Collected", color: "var(--color-charcoal)" }];

/**
 * Daily collections (spec: total collected, by method and by practitioner). The week chart picks
 * nothing on its own; the day switch below it chooses which day the breakdown shows (today first).
 */
export function CollectionsCard({ invoices }: { invoices: InvoiceView[] }) {
  const all = useMemo(() => collections(invoices), [invoices]);
  const days = useMemo(() => weeklyCollections(all), [all]);
  const [day, setDay] = useState(TODAY_KEY);
  const [table, setTable] = useState(false);
  const d = useMemo(() => dayBreakdown(all, day), [all, day]);
  const weekTotal = days.reduce((s, x) => s + x.amount, 0);
  const maxMethod = Math.max(1, ...d.byMethod.map((m) => m.amount));
  const range = `${dayLabel(WEEK_DAYS[0])} – ${dayLabel(WEEK_DAYS[WEEK_DAYS.length - 1])} Nov`;
  const dayName = day === TODAY_KEY ? "Today" : dayLabel(day);

  return (
    <section aria-labelledby="collections-title" className="flex flex-col gap-6 rounded-card bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="collections-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Daily collections
          </h2>
          <p className="mt-1 text-xs text-muted">Payments recorded at the desk · cash, UPI and card · {range}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{formatINR(weekTotal)}</p>
          <p className="mt-1 text-xs text-muted">week to date · {pluralize(days.reduce((s, x) => s + x.count, 0), "payment")}</p>
        </div>
      </div>

      <BarChart
        ariaLabel={`Collected per day, ${range}: ${days.map((x) => `${x.label} ${formatINR(x.amount)}`).join(", ")}`}
        categories={days.map((x) => x.label)}
        series={SERIES}
        values={[days.map((x) => x.amount)]}
        highlight={WEEK_DAYS.indexOf(day)}
        formatY={rupeesShort}
        height={176}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm text-ink">
            {dayName} · <span className="tabular">{formatINR(d.total)}</span>
            <span className="text-muted"> · {pluralize(d.count, "payment")}</span>
          </h3>
          <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1 py-1">
            <Segmented
              ariaLabel="Day"
              size="sm"
              variant="tray"
              className="w-max"
              value={day}
              onChange={setDay}
              items={WEEK_DAYS.map((k) => ({ value: k, label: k === TODAY_KEY ? "Today" : dayLabel(k).split(" ")[0] }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-card bg-sunken p-2 md:grid-cols-2">
          <div className="rounded-inner bg-surface p-4">
            <h4 className="text-xs text-muted">By method</h4>
            <ul className="mt-3 flex flex-col gap-3">
              {d.byMethod.map((m) => (
                <li key={m.method} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="text-muted [&_svg]:size-4" aria-hidden="true">
                      {METHOD_ICON[m.method]}
                    </span>
                    {m.method}
                  </span>
                  <span className="flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                    <span className="h-full rounded-full bg-charcoal" style={{ width: `${(m.amount / maxMethod) * 100}%` }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-sm text-ink tabular">{m.amount ? formatINR(m.amount) : "—"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-inner bg-surface p-4">
            <h4 className="text-xs text-muted">By practitioner</h4>
            {d.byPractitioner.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {d.byPractitioner.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-ink-2">
                      <Avatar src={p.avatar} name={p.name} size="xs" />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="whitespace-nowrap text-ink tabular">
                      {formatINR(p.amount)}
                      <span className="text-xs text-muted"> · {p.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing recorded {day === TODAY_KEY ? "yet today" : "that day"}.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setTable((v) => !v)} aria-expanded={table} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-xs text-ink-2 transition-colors hover:bg-sunken-2">
          {table ? "Hide payments" : `Show ${dayName === "Today" ? "today's" : `${dayName}'s`} payments`}
          <CaretDown size={14} className={cn("transition-transform duration-300", table && "rotate-180")} aria-hidden="true" />
        </button>
        {table ? (
          d.payments.length ? (
            <div className="scrollbar-thin mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">Payments recorded on {dayName}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-2 pr-3 font-normal">Time</th>
                    <th scope="col" className="px-3 py-2 font-normal">Invoice</th>
                    <th scope="col" className="px-3 py-2 font-normal">Method</th>
                    <th scope="col" className="px-3 py-2 font-normal">Recorded by</th>
                    <th scope="col" className="py-2 pl-3 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.payments.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-2 pr-3 text-ink-2 tabular">{formatTime(c.at)}</td>
                      <td className="px-3 py-2 font-mono text-[13px] text-ink">{c.number}</td>
                      <td className="px-3 py-2 text-ink-2">{c.method}</td>
                      <td className="px-3 py-2 text-ink-2">{staffById(c.byId ?? undefined)?.name ?? "—"}{c.local ? " · this session" : ""}</td>
                      <td className="py-2 pl-3 text-right text-ink tabular">{formatINR(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 rounded-inner bg-sunken p-4 text-sm text-muted">No payments recorded {day === TODAY_KEY ? "yet today" : "that day"}.</p>
          )
        ) : null}
      </div>
    </section>
  );
}

/** Tiny day bars for a dark tile: zero days are dots (never a fake stub), today is solid white. */
function DaySpark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <span role="img" aria-label={label} className="flex h-10 w-[112px] shrink-0 items-end gap-[3px]">
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return v > 0 ? (
          <span key={i} className={cn("w-[5px] rounded-t-[2px]", last ? "bg-white" : "bg-white/45")} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
        ) : (
          <span key={i} className="mb-px size-[5px] rounded-full bg-white/25" />
        );
      })}
    </span>
  );
}

export function TodayTile({ invoices }: { invoices: InvoiceView[] }) {
  const all = useMemo(() => collections(invoices), [invoices]);
  const spark = useMemo(() => dailyCollections(all, 14), [all]);
  const today = spark[spark.length - 1];
  const payments = all.filter((c) => istDayKey(c.at) === today.key);
  const latest = payments[0];
  return (
    <Stat
      tone="dark"
      className="h-full"
      label="Collected today"
      value={formatINR(today.value)}
      context={
        <span className="flex items-end justify-between gap-3">
          <span>{latest ? `${pluralize(payments.length, "payment")} · last ${latest.method} ${formatTime(latest.at)}` : "Nothing recorded yet today"}</span>
          <DaySpark values={spark.map((x) => x.value)} label={`Collected per day, last 14 days: ${spark.map((x) => `${shortDate(x.key)} ${formatINR(x.value)}`).join(", ")}`} />
        </span>
      }
    />
  );
}

export function OldestOpenTile({ invoices, onOpen }: { invoices: InvoiceView[]; onOpen: (inv: InvoiceView) => void }) {
  const o = oldestOpen(invoices);
  if (!o) return <Stat className="h-full" label="Oldest open invoice" value="—" context="Nothing outstanding" />;
  return (
    <button type="button" onClick={() => onOpen(o.invoice)} className="group h-full rounded-card text-left" aria-label={`Oldest open invoice: ${o.invoice.number}, ${o.days} days. Open details`}>
      <Stat
        className="h-full transition-shadow duration-200 group-hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
        label="Oldest open invoice"
        icon={<ArrowUpRight />}
        value={pluralize(o.days, "day")}
        context={`${o.invoice.number} · ${o.patient?.name ?? "Unknown patient"} · ${money(o.invoice.balance)} left`}
      />
    </button>
  );
}

export function StatusCard({ invoices }: { invoices: InvoiceView[] }) {
  const parts = useMemo(() => statusCounts(invoices), [invoices]);
  return (
    <section aria-labelledby="status-title" className="flex h-full flex-col justify-between gap-6 rounded-card bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="status-title" className="text-xs text-muted">
          Invoice status
        </h2>
        <p className="text-xs text-muted">{pluralize(invoices.length, "invoice")} · bar width = number of invoices</p>
      </div>
      <SegmentedBar label="Invoices by status" parts={parts.map((p) => ({ label: p.label, value: p.value, color: STATUS_FILL[p.status] }))} />
    </section>
  );
}
