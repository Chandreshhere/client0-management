"use client";

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { whenLabel } from "@/features/settings/time";
import { OPEN_STATUSES, STATUS_LABEL, STATUS_TONE } from "./data";
import { MethodLabel, itemsSummary, money } from "./meta";
import type { InvoiceView } from "./store";

/**
 * Invoices table. The failed UPI callback row says plainly that it is not marked paid; manual
 * entries say they were recorded by hand. Below md the rows become stacked cards.
 */
export function InvoiceTable({
  invoices,
  flashId,
  canRecord,
  onOpen,
  onRecord,
}: {
  invoices: InvoiceView[];
  flashId: string | null;
  canRecord: boolean;
  onOpen: (inv: InvoiceView) => void;
  onRecord: (inv: InvoiceView) => void;
}) {
  return (
    <>
      {/* Fixed layout so the table fits its card from ~970px up (narrower: it scrolls). Items is the
          flexible column and only appears once the card has room for it (container, not viewport, width). */}
      <div className="@container scrollbar-thin relative hidden overflow-x-auto rounded-card bg-surface md:block">
        <table className="w-full min-w-[968px] table-fixed text-sm">
          <caption className="sr-only">Invoices</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="w-[144px] py-4 pl-6 pr-2 font-normal">Invoice</th>
              <th scope="col" className="w-[184px] px-2 py-4 font-normal">Patient</th>
              <th scope="col" className="hidden px-2 py-4 font-normal @[1120px]:table-cell">Items</th>
              <th scope="col" className="w-[80px] px-2 py-4 text-right font-normal">Total</th>
              <th scope="col" className="w-[80px] px-2 py-4 text-right font-normal">Paid</th>
              <th scope="col" className="w-[192px] py-4 pl-4 pr-2 font-normal">Status</th>
              <th scope="col" className="w-[136px] px-2 py-4 font-normal">Method</th>
              <th scope="col" className="w-[152px] py-4 pl-2 pr-6 text-right font-normal">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const p = patientById(inv.patientId);
              const open = OPEN_STATUSES.includes(inv.display);
              return (
                <tr
                  key={inv.id}
                  data-invoice-id={inv.id}
                  onClick={() => onOpen(inv)}
                  className={cn(
                    "cursor-pointer border-t border-line align-top transition-colors duration-700",
                    flashId === inv.id ? "bg-primary-soft" : inv.display === "failed" ? "bg-danger-soft/40 hover:bg-danger-soft/60" : "hover:bg-canvas/70",
                  )}
                >
                  <td className="py-4 pl-6 pr-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(inv);
                      }}
                      className="whitespace-nowrap font-mono text-[13px] text-ink underline-offset-2 hover:underline"
                      aria-label={`Open invoice ${inv.number}`}
                    >
                      {inv.number}
                    </button>
                    <span className="mt-0.5 block whitespace-nowrap text-xs text-muted">{whenLabel(inv.issuedAt)}</span>
                    {inv.draft ? <span className="mt-1 inline-flex h-5 items-center rounded-full px-2 text-[11px] text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">Draft · this session</span> : null}
                  </td>
                  <td className="px-2 py-4">
                    {p ? (
                      <Link
                        href={`/patients/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex max-w-full items-center gap-2 text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                      >
                        <Avatar src={p.avatar} name={p.name} size="xs" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">Unknown patient</span>
                    )}
                  </td>
                  <td className="hidden px-2 py-4 @[1120px]:table-cell">
                    <span className="block truncate text-ink-2" title={inv.items.map((i) => i.label).join(", ")}>
                      {itemsSummary(inv.items)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-4 text-right text-ink tabular">{money(inv.total)}</td>
                  <td className={cn("whitespace-nowrap px-2 py-4 text-right tabular", inv.paidNow === 0 ? "text-muted" : "text-ink")}>{money(inv.paidNow)}</td>
                  <td className="py-4 pl-4 pr-2">
                    <StatusBadge tone={STATUS_TONE[inv.display]}>{STATUS_LABEL[inv.display]}</StatusBadge>
                    {inv.display === "failed" ? <span className="mt-1 block text-xs text-danger">Not marked paid until the gateway confirms</span> : null}
                    {inv.manual ? <span className="mt-1 block text-xs text-muted">Gateway confirmation not connected</span> : null}
                    {open && inv.balance > 0 && inv.display !== "failed" && inv.paidNow > 0 ? <span className="mt-1 block text-xs text-muted tabular">{money(inv.balance)} left</span> : null}
                  </td>
                  <td className="truncate px-2 py-4">
                    <MethodLabel method={inv.method} />
                  </td>
                  <td className="py-4 pl-2 pr-6 text-right">
                    {open && canRecord ? (
                      <Button
                        size="sm"
                        variant="dark"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecord(inv);
                        }}
                      >
                        Record payment
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(inv);
                        }}
                      >
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {invoices.map((inv) => {
          const p = patientById(inv.patientId);
          const open = OPEN_STATUSES.includes(inv.display);
          return (
            <li key={inv.id} data-invoice-id={inv.id} className={cn("rounded-card p-4 transition-colors duration-700", flashId === inv.id ? "bg-primary-soft" : "bg-surface")}>
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(inv)} className="min-w-0 text-left">
                  <span className="block font-mono text-[13px] text-ink">{inv.number}</span>
                  <span className="mt-0.5 block text-xs text-muted">{whenLabel(inv.issuedAt)}{inv.draft ? " · draft, this session" : ""}</span>
                </button>
                <StatusBadge tone={STATUS_TONE[inv.display]}>{STATUS_LABEL[inv.display]}</StatusBadge>
              </div>
              {p ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                  <Avatar src={p.avatar} name={p.name} size="xs" />
                  <span className="truncate">{p.name}</span>
                </p>
              ) : null}
              <p className="mt-1 truncate text-xs text-muted">{itemsSummary(inv.items)}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-xs">
                <div>
                  <dt className="text-muted">Total</dt>
                  <dd className="mt-0.5 text-ink tabular">{money(inv.total)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Paid</dt>
                  <dd className="mt-0.5 text-ink tabular">{money(inv.paidNow)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Method</dt>
                  <dd className="mt-0.5 truncate text-ink">{inv.method ?? "—"}</dd>
                </div>
              </dl>
              {inv.display === "failed" ? <p className="mt-2 text-xs text-danger">Not marked paid until the gateway confirms.</p> : null}
              {inv.manual ? <p className="mt-2 text-xs text-muted">Recorded manually — gateway confirmation not connected.</p> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => onOpen(inv)} trailing={<CaretRight />}>
                  Details
                </Button>
                {open && canRecord ? (
                  <Button size="sm" variant="dark" onClick={() => onRecord(inv)}>
                    Record payment
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
