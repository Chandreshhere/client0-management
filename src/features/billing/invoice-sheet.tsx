"use client";

import Link from "next/link";
import { ArrowCounterClockwise, ArrowUpRight, BellSimple, ClockCountdown, DownloadSimple, Receipt, WarningOctagon } from "@phosphor-icons/react";
import { patientById, clinicNumber } from "@/data/patients";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { InfoNote } from "@/features/settings/ui";
import { whenLabel } from "@/features/settings/time";
import { CONFIRMATION_LABEL, CONFIRMATION_TONE, OPEN_STATUSES, STATUS_LABEL, STATUS_TONE, type PaymentEvent } from "./data";
import { METHOD_ICON, money } from "./meta";
import { noteReminder, usePackages, type InvoiceView } from "./store";

/** Invoice detail: line items, totals, payment history (with how each payment is known), actions. */
export function InvoiceSheet({
  invoice,
  canRecord,
  onClose,
  onRecord,
}: {
  invoice: InvoiceView | null;
  canRecord: boolean;
  onClose: () => void;
  onRecord: (inv: InvoiceView) => void;
}) {
  const { toast } = useToast();
  const { has } = usePlan();
  const { user } = useRole();
  const packages = usePackages();
  const inv = invoice;
  const p = inv ? patientById(inv.patientId) : undefined;
  const open = inv ? OPEN_STATUSES.includes(inv.display) : false;
  const hasMoney = inv ? inv.events.some((e) => e.kind === "payment" || e.kind === "refund") : false;
  const pkg = inv ? packages.find((k) => k.patientId === inv.patientId) : undefined;

  return (
    <Dialog open={!!inv} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {inv ? (
        <SheetContent
          title={<span className="font-mono text-lg">{inv.number}</span>}
          description={`${p?.name ?? "Unknown patient"} · issued ${formatDate(inv.issuedAt)}, ${formatTime(inv.issuedAt)}`}
          headerExtra={<StatusBadge tone={STATUS_TONE[inv.display]} className="mt-1 hidden sm:inline-flex">{STATUS_LABEL[inv.display]}</StatusBadge>}
          footer={
            <>
              {hasMoney ? (
                <Button
                  variant="secondary"
                  leading={<DownloadSimple />}
                  onClick={() =>
                    toast({
                      title: "Receipt not generated",
                      description: "Receipts aren't produced in this prototype — no file was created or sent.",
                    })
                  }
                >
                  Download receipt
                </Button>
              ) : (
                <Tip label="No payment recorded yet">
                  <span tabIndex={0} className="rounded-full">
                    <Button variant="secondary" leading={<DownloadSimple />} disabled>
                      Download receipt
                    </Button>
                  </span>
                </Tip>
              )}
              {open && canRecord ? (
                <Button variant="primary" leading={<Receipt />} onClick={() => onRecord(inv)}>
                  Record payment
                </Button>
              ) : null}
            </>
          }
        >
          <div className="flex flex-col gap-6">
            <StatusBadge tone={STATUS_TONE[inv.display]} className="w-max sm:hidden">
              {STATUS_LABEL[inv.display]}
            </StatusBadge>

            {inv.display === "failed" ? (
              <div className="rounded-inner bg-danger-soft p-4 text-danger">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <WarningOctagon size={18} aria-hidden="true" />
                  Payment not confirmed
                </p>
                <p className="mt-1 text-xs">
                  A UPI collect request went out, but the gateway&apos;s confirmation callback never arrived. Not marked paid until the gateway confirms — a browser redirect or a screenshot is not proof of payment.
                </p>
                {canRecord ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      leading={<ArrowCounterClockwise />}
                      onClick={() =>
                        toast({
                          tone: "warning",
                          title: "Gateway not connected",
                          description: "Nothing was checked — this prototype has no payment gateway. The invoice stays “Payment not confirmed”.",
                        })
                      }
                    >
                      Check gateway again
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Patient */}
            {p ? (
              <div className="flex items-center gap-3 rounded-inner bg-sunken p-3">
                <Avatar src={p.avatar} name={p.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p.name}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{clinicNumber(p.id)}</span> · {p.phone}
                  </p>
                </div>
                <Link href={`/patients/${p.id}`} aria-label={`Open ${p.name}'s record`} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-canvas">
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              </div>
            ) : null}

            {/* Line items */}
            <section aria-labelledby="inv-items">
              <h3 id="inv-items" className="text-xs text-muted">
                Line items
              </h3>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">Line items for {inv.number}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, i) => (
                    <tr key={`${it.label}-${i}`} className="border-t border-line first:border-t-0">
                      <td className="py-2 pr-3 text-ink">{it.label}</td>
                      <td className="py-2 text-right text-ink tabular">{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">
                      Total
                    </th>
                    <td className="py-2 text-right text-ink tabular">{money(inv.total)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 pr-3 text-left font-normal text-muted">
                      Paid
                    </th>
                    <td className="py-1 text-right text-ink tabular">{money(inv.paidNow)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-3 flex items-end justify-between rounded-inner bg-sunken p-4">
                <span className="text-xs text-muted">{inv.display === "refunded" ? "Refunded" : "Balance due"}</span>
                <span className={cn("text-[32px] font-light leading-none tracking-[-0.02em] tabular", inv.balance > 0 ? "text-ink" : "text-muted")}>
                  {inv.display === "refunded" ? money(Math.abs(inv.total)) : money(inv.balance)}
                </span>
              </div>
            </section>

            {/* Payment history */}
            <section aria-labelledby="inv-history">
              <h3 id="inv-history" className="text-xs text-muted">
                Payment history
              </h3>
              {inv.events.length === 0 ? (
                <p className="mt-2 rounded-inner bg-sunken p-4 text-sm text-muted">No payments or attempts recorded for this invoice yet.</p>
              ) : (
                <ol className="mt-3 flex flex-col">
                  {inv.events.map((e, i) => (
                    <HistoryItem key={e.id} event={e} last={i === inv.events.length - 1} />
                  ))}
                </ol>
              )}
              {inv.reminderAt ? (
                <InfoNote className="mt-3" icon={<BellSimple />}>
                  Reminder requested {whenLabel(inv.reminderAt).toLowerCase()} — not sent, because SMS and WhatsApp aren&apos;t connected in this demo.
                </InfoNote>
              ) : null}
            </section>

            {/* Package credits */}
            {pkg ? (
              <section aria-labelledby="inv-pkg" className="rounded-inner bg-sunken p-4">
                <h3 id="inv-pkg" className="text-xs text-muted">
                  Session credits
                </h3>
                <p className="mt-1 text-sm text-ink">{pkg.name}</p>
                <p className="mt-1 text-xs text-muted tabular">
                  {pkg.total - pkg.used} of {pkg.total} left · expires {formatDate(pkg.expires)}
                </p>
                {has("packages") ? (
                  <Link href="/billing/packages" className="mt-3 inline-flex items-center gap-1 text-xs text-ink underline-offset-2 hover:underline">
                    Open packages
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted">
                    <LockBadge />
                    Package management is on the Clinic plan
                  </span>
                )}
              </section>
            ) : null}

            {open && canRecord && inv.display !== "failed" ? (
              <Button
                variant="ghost"
                className="w-max"
                leading={<BellSimple />}
                onClick={() => {
                  noteReminder(inv.id, user.id);
                  toast({
                    tone: "warning",
                    title: "Reminder not sent",
                    description: "SMS and WhatsApp aren't connected in this demo. Noted on the invoice so the team knows a reminder is still needed.",
                  });
                }}
              >
                Send payment reminder
              </Button>
            ) : null}
          </div>
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function HistoryItem({ event: e, last }: { event: PaymentEvent; last: boolean }) {
  const by = e.byId ? staffById(e.byId)?.name : e.byLabel;
  const title =
    e.kind === "attempt"
      ? `${money(e.amount)} requested · ${e.method}`
      : e.kind === "check"
        ? "Gateway checked · no confirmation"
        : e.kind === "refund"
        ? `${money(e.amount)} refunded · ${e.method}`
        : e.kind === "credit"
          ? "Package credit applied"
          : `${money(e.amount)} · ${e.method}`;
  return (
    <li className="relative flex gap-3 pb-4">
      {!last ? <span className="absolute left-4 top-9 h-[calc(100%-36px)] w-px bg-line-strong" aria-hidden="true" /> : null}
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
          e.confirmation === "pending" ? "bg-danger-soft text-danger" : e.local ? "bg-primary-soft text-primary-ink" : "bg-sunken text-ink-2",
        )}
        aria-hidden="true"
      >
        {e.kind === "attempt" || e.kind === "check" ? <ClockCountdown /> : METHOD_ICON[e.method]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-ink tabular">{title}</p>
          <StatusBadge tone={CONFIRMATION_TONE[e.confirmation]}>{CONFIRMATION_LABEL[e.confirmation]}</StatusBadge>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {whenLabel(e.at)}
          {by ? ` · ${by}` : ""}
          {e.local ? " · this session" : ""}
        </p>
        {e.reference ? <p className="mt-1 font-mono text-[11px] text-ink-2">{e.reference}</p> : null}
        {e.note ? <p className="mt-1 text-xs text-ink-2">{e.note}</p> : null}
      </div>
    </li>
  );
}
