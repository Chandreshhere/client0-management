"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { CaretDown, ChatCircleDots, CreditCard, DownloadSimple, Info, Receipt, Wallet } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { pop, spring } from "@/lib/motion";
import { formatINR, formatTime, pluralize } from "@/lib/format";
import { CLINIC } from "@/data/staff";
import { INVOICE_STATUS_LABEL } from "@/data/records";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { EmptyState, ProgressRing } from "@/components/ui/misc";
import { StatusBadge, invoiceTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { DemoNote, FocalCard, Panel, PortalHeader, Reveal, downloadFile } from "../ui";
import { usePortalStore } from "../store";
import { apptStore } from "../appointments/store";
import { dayLabel, daysFromToday, longDate, shortDate } from "../time";
import { PackageBurnDown, VisitCoverage } from "./insights";
import { BALANCE_DUE, BOOKED_SESSIONS, CELLS, CLASS_DAY_NAMES, COVERS_UNTIL, FREE, MY_INVOICES, PACKAGE, PROGRAMME_REVIEW, receiptText, upcomingCharges, type SessionCell } from "./data";

/**
 * /portal/billing — the patient's invoices, package balance and what will be charged next.
 * Online payment isn't connected in the demo, and the page says so instead of faking success.
 */
export function BillingView() {
  const appts = usePortalStore(apptStore);
  const [payOpen, setPayOpen] = useState(false);
  const charges = upcomingCharges(appts.requests);
  const nextCharge = charges.find((c) => c.confirmed);
  const left = PACKAGE ? PACKAGE.total - PACKAGE.used : 0;

  return (
    <div className="flex flex-col gap-6">
      <PortalHeader
        title="Billing"
        description={`${BALANCE_DUE ? `${formatINR(BALANCE_DUE)} to pay` : "Nothing to pay right now"}${PACKAGE ? ` · ${left} of ${PACKAGE.total} sessions left · package expires ${longDate(`${PACKAGE.expires}T12:00:00+05:30`)}` : ""}.`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/messages?new=1">
              <ChatCircleDots />
              Ask about a bill
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Reveal index={0}>{PACKAGE ? <PackageCard /> : <EmptyState icon={<Wallet />} title="No package on your account" className="bg-surface" />}</Reveal>
        <Reveal index={1} className="flex flex-col gap-4">
          <section aria-labelledby="bill-balance" className="flex flex-col gap-6 rounded-card bg-surface p-6">
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <h2 id="bill-balance">Balance today</h2>
              <Wallet size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{formatINR(BALANCE_DUE)}</p>
              <p className="mt-2 text-xs text-muted">
                {BALANCE_DUE ? "Pay at reception or ask the front desk for a payment link." : MY_INVOICES.length === 1 ? "Your invoice is settled." : `All ${MY_INVOICES.length} invoices are settled.`}
                {nextCharge ? ` Next: ${formatINR(nextCharge.amount)} after your ${nextCharge.label.toLowerCase()} ${dayLabel(nextCharge.at).toLowerCase()}.` : ""}
              </p>
            </div>
            {/* Quiet on purpose: there's nothing to pay online here (no gateway in the demo). It used to be a
                dark primary in the header, which contradicted a ₹0 balance; it now only explains. */}
            <Button variant="secondary" size="sm" className="self-start text-muted" leading={<CreditCard />} onClick={() => setPayOpen(true)}>
              Online payment · not available
            </Button>
          </section>

          <Panel icon={<Receipt />} title="Coming up" subtitle={charges.length ? `${pluralize(charges.length, "visit")} with a charge` : "Nothing scheduled to be charged"}>
            {charges.length ? (
              <ul className="flex flex-col gap-2">
                {charges.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-inner bg-surface p-4">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{c.label}</span>
                      <span className="block text-xs text-muted">
                        {dayLabel(c.at)} · {formatTime(c.at)} · {c.when.toLowerCase()}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm text-ink tabular">{formatINR(c.amount)}</span>
                      <span className="block text-[11px] text-muted">{c.confirmed ? "Booked" : "If the clinic confirms"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-inner bg-surface p-4 text-sm text-muted">Programme visits and package sessions aren&apos;t charged separately.</p>
            )}
          </Panel>
        </Reveal>
      </div>

      {PACKAGE ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Reveal index={2}>
            <PackageBurnDown />
          </Reveal>
          <Reveal index={3}>
            <VisitCoverage requests={appts.requests} />
          </Reveal>
        </div>
      ) : null}

      <Reveal index={4}>
        <InvoicesSection />
      </Reveal>

      <Reveal index={5}>
        <section aria-labelledby="bill-how" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-card bg-surface p-6">
            <h2 id="bill-how" className="text-lg font-normal tracking-[-0.01em] text-ink">
              How to pay
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-2 marker:text-faint">
              <li>At reception after your visit — UPI, card or cash.</li>
              <li>Invoices are issued by {CLINIC.legal}.</li>
              <li>Package sessions are taken when you attend, not when you book. Cancelling with 24 hours&apos; notice keeps the session.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 rounded-card bg-surface p-6">
            <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Saved payment methods</h2>
            <p className="text-sm text-muted">None. Online payment isn&apos;t connected in this demo, so no card or UPI ID is stored.</p>
            <Button variant="secondary" className="self-start" onClick={() => setPayOpen(true)}>
              Why can&apos;t I pay online?
            </Button>
          </div>
        </section>
      </Reveal>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <ModalContent
          size="sm"
          title="Online payment isn't connected"
          description="This demo has no payment gateway, so nothing can be charged or saved here."
          footer={
            <>
              <Button asChild variant="ghost">
                <Link href="/messages?new=1">Message the front desk</Link>
              </Button>
              <Button variant="dark" onClick={() => setPayOpen(false)}>
                Got it
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-inner bg-sunken p-4">
              <p className="text-xs text-muted">Balance today</p>
              <p className="mt-1 text-title font-light text-ink tabular">{formatINR(BALANCE_DUE)}</p>
              {nextCharge ? (
                <p className="mt-2 text-sm text-ink-2">
                  After your {nextCharge.label.toLowerCase()} ({dayLabel(nextCharge.at).toLowerCase()}, {formatTime(nextCharge.at)}) you&apos;ll get an invoice for {formatINR(nextCharge.amount)}.
                </p>
              ) : null}
            </div>
            <DemoNote>Pay at reception by UPI, card or cash. A real portal would hand you to a payment provider and only mark a bill paid once the provider confirms it.</DemoNote>
          </div>
        </ModalContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Package: 24 cells — used (filled), booked (outlined, with dates), free (empty)
// ---------------------------------------------------------------------------------------------

function PackageCard() {
  const id = useId();
  if (!PACKAGE) return null;
  const left = PACKAGE.total - PACKAGE.used;
  const days = daysFromToday(`${PACKAGE.expires}T12:00:00+05:30`);
  return (
    <FocalCard labelledBy={id} className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 pb-2">
        <div className="min-w-0">
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">Your package</span>
          <h2 id={id} className="mt-4 text-title font-normal text-white">
            {PACKAGE.name}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            Expires {longDate(`${PACKAGE.expires}T12:00:00+05:30`)} · in {pluralize(days, "day")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing value={PACKAGE.used} max={PACKAGE.total} size={72} stroke={6} track="rgb(255 255 255 / 0.2)" className="text-white">
            <span className="text-sm text-white tabular">
              {PACKAGE.used}/{PACKAGE.total}
            </span>
          </ProgressRing>
          <p className="text-right">
            <span className="block text-[44px] font-light leading-none tracking-[-0.02em] text-white tabular">{left}</span>
            <span className="text-xs text-white/85">sessions left</span>
          </p>
        </div>
      </div>

      <div className="rounded-inner bg-white/10 p-4">
        <ol className="grid grid-cols-6 gap-2 sm:grid-cols-12" aria-label={`${PACKAGE.used} sessions used, ${BOOKED_SESSIONS.length} booked, ${FREE.length} free to book`}>
          {CELLS.map((c, i) => (
            <Cell key={c.n} cell={c} index={i} />
          ))}
        </ol>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-white" aria-hidden="true" />
            Used · {PACKAGE.used}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1.5px_white]" aria-hidden="true" />
            Booked · {BOOKED_SESSIONS.length}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-white/20" aria-hidden="true" />
            Free to book · {FREE.length}
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-1 p-4 pt-2 text-sm text-white">
        {FREE.length && COVERS_UNTIL ? (
          <p>
            At your {CLASS_DAY_NAMES.join(" / ")} class rhythm, the {pluralize(FREE.length, "free session")} would last until {dayLabel(COVERS_UNTIL)}.{" "}
            {PROGRAMME_REVIEW ? `Your programme completion review is ${dayLabel(PROGRAMME_REVIEW.at)}.` : ""}
          </p>
        ) : (
          <p>Every remaining session is booked.</p>
        )}
        <p className="text-xs text-white/85">Sessions are counted when you attend. Booked ones are listed in Appointments.</p>
      </div>
    </FocalCard>
  );
}

function Cell({ cell, index }: { cell: SessionCell; index: number }) {
  const date = cell.at ? shortDate(cell.at) : null;
  const tip = cell.state === "free" ? `Session ${cell.n} · free${date ? ` · could cover the ${dayLabel(cell.at!)} class` : ""}` : `${cell.label}${date ? ` · ${date}` : ""}`;
  return (
    <li>
      <Tip label={tip}>
        <motion.button
          type="button"
          aria-label={tip}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...pop, delay: Math.min(index, 23) * 0.02 }}
          className={cn(
            "flex aspect-square w-full flex-col items-center justify-center rounded-[10px] text-[11px] tabular outline-none focus-visible:outline-2 focus-visible:outline-white",
            cell.state === "used" && "bg-white text-primary-ink",
            cell.state === "booked" && "text-white shadow-[inset_0_0_0_1.5px_white]",
            cell.state === "free" && "bg-white/15 text-white/85",
          )}
        >
          <span>{cell.n}</span>
          {cell.state !== "used" && date ? <span className="hidden text-[10px] leading-none opacity-90 md:block">{date}</span> : null}
        </motion.button>
      </Tip>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------------------------

function InvoicesSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(MY_INVOICES[0]?.id ?? null);
  return (
    <section aria-labelledby="bill-invoices" className="flex flex-col gap-2 rounded-card bg-sunken p-2">
      <div className="flex items-center gap-3 p-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-hidden="true">
          <Receipt size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="bill-invoices" className="truncate text-sm font-medium text-ink">
            Invoices & receipts
          </h2>
          <p className="truncate text-xs text-muted">{pluralize(MY_INVOICES.length, "invoice")} on your account</p>
        </div>
      </div>
      {MY_INVOICES.length ? (
        <ul className="flex flex-col gap-2">
          {MY_INVOICES.map((inv) => {
            const expanded = open === inv.id;
            return (
              <li key={inv.id} className="rounded-inner bg-surface">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : inv.id)} className="flex w-full items-center gap-4 p-4 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{inv.items[0]?.label ?? "Invoice"}</span>
                    <span className="block text-xs text-muted">
                      <span className="font-mono">{inv.number}</span> · {longDate(inv.issuedAt)}
                      {inv.method ? ` · ${inv.method}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm text-ink tabular">{formatINR(inv.total)}</span>
                    <StatusBadge tone={invoiceTone(inv.status)} className="h-5 px-2 text-[11px]">
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </StatusBadge>
                  </span>
                  <CaretDown size={16} className={cn("shrink-0 text-muted transition-transform duration-300", expanded && "rotate-180")} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                      <div className="flex flex-col gap-3 border-t border-line p-4">
                        <table className="w-full text-sm">
                          <caption className="sr-only">Items on invoice {inv.number}</caption>
                          <thead>
                            <tr className="text-xs text-muted">
                              <th scope="col" className="pb-2 text-left font-normal">
                                Item
                              </th>
                              <th scope="col" className="pb-2 text-right font-normal">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.items.map((it) => (
                              <tr key={it.label} className="border-t border-line">
                                <td className="py-2 text-ink-2">{it.label}</td>
                                <td className="py-2 text-right text-ink tabular">{formatINR(it.amount)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-line">
                              <th scope="row" className="py-2 text-left font-normal text-ink">
                                Total
                              </th>
                              <td className="py-2 text-right text-ink tabular">{formatINR(inv.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="flex items-start gap-2 text-xs text-muted">
                          <Info size={16} className="shrink-0" aria-hidden="true" />
                          {inv.method === "Package credit"
                            ? "Settled from your package — no money changed hands."
                            : inv.payments?.length
                              ? `${inv.payments.filter((p) => p.confirmed).length} confirmed payment(s).`
                              : "No payment recorded yet."}
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="self-start"
                          leading={<DownloadSimple />}
                          onClick={() => {
                            const ok = downloadFile(`${inv.number}.txt`, receiptText(inv), "text/plain");
                            toast(ok ? { title: "Receipt created", description: "Made in your browser — nothing was sent." } : { tone: "warning", title: "Couldn't create the receipt" });
                          }}
                        >
                          Download receipt
                        </Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Receipt />} title="No invoices yet" className="bg-surface" />
      )}
    </section>
  );
}
