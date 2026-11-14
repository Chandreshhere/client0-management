"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CaretDown, Hourglass } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatINR, formatTime, pluralize } from "@/lib/format";
import { BarChart, SegmentedBar } from "@/components/charts/bar-chart";
import { Stat } from "@/components/ui/misc";
import { shortDate } from "@/features/settings/time";
import { FitBubbles } from "@/features/settings/viz";
import type { DisplayStatus, PaymentEvent } from "./data";
import { METHOD_ICON, money } from "./meta";
import { STATUS_FILL, WEEK_DAYS, confirmedOn, dailyCollections, dayLabel, methodsThisWeek, oldestOpen, outstandingByStatus, rupeesShort, statusCounts, weeklyCollections } from "./insights";
import type { InvoiceView } from "./store";

/**
 * Billing overview (refs 5 & 6): a cobalt focal card with the outstanding balance as bubbles,
 * a week-to-date collections chart with a method breakdown, and a stat row with the invoice
 * status split. Every figure is computed in ./insights from the shared invoices and payments.
 */

const SHORT_STATUS: Partial<Record<DisplayStatus, string>> = { failed: "Not confirmed", "partially-paid": "Partially paid" };

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

const SERIES = [
  { id: "confirmed", name: "Confirmed", color: "var(--color-charcoal)" },
  { id: "manual", name: "Recorded manually · not confirmed", color: "#a9afa9" },
];

export function CollectionsCard({ session }: { session: PaymentEvent[] }) {
  const days = useMemo(() => weeklyCollections(session), [session]);
  const methods = useMemo(() => methodsThisWeek(session), [session]);
  const [table, setTable] = useState(false);
  const confirmedTotal = days.reduce((s, d) => s + d.confirmed, 0);
  const manualTotal = days.reduce((s, d) => s + d.manual, 0);
  const payments = methods.reduce((s, m) => s + m.count, 0);
  const notCounted = days.flatMap((d) => d.unconfirmed.map((p) => ({ ...p, day: d.label })));
  const maxMethod = Math.max(1, ...methods.map((m) => m.amount + m.manual));
  const range = `${dayLabel(WEEK_DAYS[0])} – ${dayLabel(WEEK_DAYS[WEEK_DAYS.length - 1])} Nov`;

  return (
    <section aria-labelledby="collections-title" className="flex flex-col gap-6 rounded-card bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="collections-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Collections · week to date
          </h2>
          <p className="mt-1 text-xs text-muted">Money confirmed by a payment gateway, the bank or the desk · {range}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{formatINR(confirmedTotal)}</p>
          <p className="mt-1 text-xs text-muted">
            {pluralize(payments, "confirmed payment")}
            {manualTotal ? ` · ${formatINR(manualTotal)} recorded manually` : ""}
          </p>
        </div>
      </div>

      <BarChart
        ariaLabel={`Confirmed collections per day, ${range}: ${days.map((d) => `${d.label} ${formatINR(d.confirmed)}${d.manual ? ` plus ${formatINR(d.manual)} recorded manually` : ""}`).join(", ")}`}
        categories={days.map((d) => d.label)}
        series={SERIES}
        values={[days.map((d) => d.confirmed), days.map((d) => d.manual)]}
        highlight={days.length - 1}
        formatY={rupeesShort}
        height={208}
      />

      {notCounted.length ? (
        <p className="-mt-2 flex items-start gap-2 rounded-[12px] bg-danger-soft p-3 text-xs text-danger">
          <Hourglass size={16} className="mt-px shrink-0" aria-hidden="true" />
          <span>
            Not counted:{" "}
            {notCounted.map((p, i) => (
              <span key={`${p.number}-${i}`}>
                {i ? "; " : ""}
                {formatINR(p.amount)} {p.method} request on {p.day} at {formatTime(p.at)} (<span className="font-mono">{p.number}</span>) — the gateway never confirmed it
              </span>
            ))}
            .
          </span>
        </p>
      ) : null}

      <div>
        <h3 className="text-xs text-muted">By method · week to date</h3>
        <ul className="mt-3 flex flex-col gap-3">
          {methods.map((m) => (
            <li key={m.method} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <span className="text-muted [&_svg]:size-4" aria-hidden="true">
                  {METHOD_ICON[m.method]}
                </span>
                {m.method}
              </span>
              <span className="flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <span className="h-full rounded-full bg-charcoal" style={{ width: `${(m.amount / maxMethod) * 100}%` }} />
                {m.manual ? <span className="ml-0.5 h-full rounded-full bg-[#a9afa9]" style={{ width: `${(m.manual / maxMethod) * 100}%` }} /> : null}
              </span>
              <span className="whitespace-nowrap text-right text-xs text-muted tabular">
                <span className="text-sm text-ink">{m.amount ? formatINR(m.amount) : "—"}</span>
                {m.count ? ` · ${m.count}` : ""}
                {m.manual ? ` · +${formatINR(m.manual)} manual` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button type="button" onClick={() => setTable((v) => !v)} aria-expanded={table} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-xs text-ink-2 transition-colors hover:bg-sunken-2">
          {table ? "Hide table" : "Show as table"}
          <CaretDown size={14} className={cn("transition-transform duration-300", table && "rotate-180")} aria-hidden="true" />
        </button>
        {table ? (
          <div className="scrollbar-thin mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Collections per day, {range}</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-normal">Day</th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">Confirmed</th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">Recorded manually</th>
                  <th scope="col" className="py-2 pl-3 text-right font-normal">Not confirmed (excluded)</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.key} className="border-t border-line">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{d.label}</th>
                    <td className="px-3 py-2 text-right text-ink tabular">{formatINR(d.confirmed)}</td>
                    <td className="px-3 py-2 text-right text-ink-2 tabular">{d.manual ? formatINR(d.manual) : "—"}</td>
                    <td className="py-2 pl-3 text-right text-ink-2 tabular">{d.unconfirmed.length ? formatINR(d.unconfirmed.reduce((s, p) => s + p.amount, 0)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

export function TodayTile({ session }: { session: PaymentEvent[] }) {
  const spark = useMemo(() => dailyCollections(14), []);
  const today = spark[spark.length - 1];
  const payments = confirmedOn(today.key);
  const latest = payments[0];
  const manual = session.filter((p) => p.kind === "payment" && p.local).reduce((s, p) => s + p.amount, 0);
  return (
    <Stat
      tone="dark"
      className="h-full"
      label="Collected today · confirmed"
      value={formatINR(today.value)}
      context={
        <span className="flex items-end justify-between gap-3">
          <span>
            {latest ? `${pluralize(payments.length, "payment")} · ${latest.method} ${formatTime(latest.at)}` : "Nothing confirmed yet today"}
            {manual ? <span className="mt-1 block">+{formatINR(manual)} recorded manually</span> : null}
          </span>
          <DaySpark values={spark.map((d) => d.value)} label={`Confirmed collections per day, last 14 days: ${spark.map((d) => `${shortDate(d.key)} ${formatINR(d.value)}`).join(", ")}`} />
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
