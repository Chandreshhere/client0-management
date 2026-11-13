"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, DownloadSimple, Receipt, WarningOctagon } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { patientById } from "@/data/patients";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { FilterPill, ROLE_LABEL } from "@/features/settings/ui";
import { logAudit } from "@/features/settings/audit";
import { TODAY_KEY, daysAgo, istDayKey, newestFirst, whenInline } from "@/features/settings/time";
import { ALL_METHODS, OPEN_STATUSES, type DisplayStatus, type PayMethod } from "./data";
import { money } from "./meta";
import { InvoiceTable } from "./invoice-table";
import { InvoiceSheet } from "./invoice-sheet";
import { RecordPaymentModal } from "./record-payment";
import { CollectionsCard, OldestOpenTile, OutstandingFocal, StatusCard, TodayTile } from "./overview";
import { useBillingSession, useInvoices } from "./store";

/** Roles whose workspace includes invoices (doc §3A "permitted billing"; the solo doctor on Starter). */
const BILLING_ROLES: Role[] = ["admin", "frontdesk", "doctor"];

type View = "all" | "open" | "due" | "overdue" | "partial" | "failed" | "settled" | "refunded";
type MethodFilter = "all" | "none" | PayMethod;
type DateFilter = "all" | "today" | "7d" | "30d";

const VIEW_MATCH: Record<View, (s: DisplayStatus) => boolean> = {
  all: () => true,
  open: (s) => OPEN_STATUSES.includes(s),
  due: (s) => s === "due",
  overdue: (s) => s === "overdue",
  partial: (s) => s === "partially-paid",
  failed: (s) => s === "failed",
  settled: (s) => s === "paid" || s === "recorded",
  refunded: (s) => s === "refunded",
};

const DATE_MATCH: Record<DateFilter, (iso: string) => boolean> = {
  all: () => true,
  today: (iso) => istDayKey(iso) === TODAY_KEY,
  "7d": (iso) => daysAgo(iso) <= 6,
  "30d": (iso) => daysAgo(iso) <= 29,
};

export function BillingView() {
  const { role } = useRole();
  if (role === "patient") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Billing" />
        <Card>
          <EmptyState
            icon={<Receipt />}
            title="Your invoices live in your portal"
            description="The clinic's billing workspace is for the front desk and administrators. Your own invoices, receipts and session balances are in your portal."
            action={
              <Button asChild variant="dark">
                <Link href="/portal/billing">Open my billing</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  if (!BILLING_ROLES.includes(role)) {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader eyebrow="Billing" title="Invoices" />
        <Card>
          <EmptyState
            icon={<Receipt />}
            title={`Billing isn't part of the ${ROLE_LABEL(role).toLowerCase()} workspace`}
            description="Invoices, receipts and outstanding balances are handled by the front desk and administrators. Ask them if a patient has a billing question."
          />
        </Card>
      </div>
    );
  }
  return <BillingWorkspace />;
}

function BillingWorkspace() {
  const { toast } = useToast();
  const { user } = useRole();
  const invoices = useInvoices();
  const session = useBillingSession();
  const [view, setView] = useState<View>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [date, setDate] = useState<DateFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2400);
  };

  /** From the focal card: narrow the list to one status and bring it into view. */
  const focusStatus = (s: DisplayStatus) => {
    const next: View = s === "failed" ? "failed" : s === "overdue" ? "overdue" : s === "partially-paid" ? "partial" : s === "due" ? "due" : "all";
    setView(next);
    setMethod("all");
    setDate("all");
    setQuery("");
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const counts = useMemo(
    () => Object.fromEntries((Object.keys(VIEW_MATCH) as View[]).map((v) => [v, invoices.filter((i) => VIEW_MATCH[v](i.display)).length])) as Record<View, number>,
    [invoices],
  );

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      invoices
        .filter((i) => VIEW_MATCH[view](i.display))
        .filter((i) => (method === "all" ? true : method === "none" ? i.method === null : i.method === method))
        .filter((i) => DATE_MATCH[date](i.issuedAt))
        .filter((i) => !q || `${i.number} ${patientById(i.patientId)?.name ?? ""} ${i.items.map((x) => x.label).join(" ")}`.toLowerCase().includes(q))
        .sort((a, b) => Number(b.draft) - Number(a.draft) || newestFirst(a.issuedAt, b.issuedAt)),
    [invoices, view, method, date, q],
  );

  const failedInvoices = invoices.filter((i) => i.display === "failed");
  const opened = invoices.find((i) => i.id === openId) ?? null;
  const recording = invoices.find((i) => i.id === recordId) ?? null;
  const filtered = view !== "all" || method !== "all" || date !== "all" || q !== "";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Invoices, receipts and outstanding balances. A payment counts only when a gateway, the bank or the desk confirms it — a browser redirect is never proof of payment."
        actions={
          <Button
            variant="secondary"
            leading={<DownloadSimple />}
            onClick={() => {
              logAudit({ actorId: user.id, category: "export", action: "Requested an invoice export — not generated in this prototype", detail: "No file was created", scope: "financial" });
              toast({
                title: "Export not generated",
                description: "Exports aren't produced in this prototype — no file was created. The request is in the audit log.",
              });
            }}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <OutstandingFocal invoices={invoices} onFocusStatus={focusStatus} />
        <CollectionsCard session={session.payments} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TodayTile session={session.payments} />
        <OldestOpenTile invoices={invoices} onOpen={(i) => setOpenId(i.id)} />
        <div className="sm:col-span-2">
          <StatusCard invoices={invoices} />
        </div>
      </div>

      {failedInvoices.length ? (
        <ul className="flex flex-col gap-2" aria-label="Payments not confirmed">
          {failedInvoices.map((inv) => {
            const p = patientById(inv.patientId);
            const attempts = inv.events.filter((e) => e.kind === "attempt");
            const attempt = attempts[attempts.length - 1]; // events are newest first → the original request
            return (
              <li key={inv.id} className="flex flex-col gap-4 rounded-card bg-surface p-4 sm:flex-row sm:items-center sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <WarningOctagon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    Payment not confirmed · <span className="font-mono text-[13px]">{inv.number}</span> · {p?.name} · <span className="tabular">{money(inv.balance)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {inv.method} request {attempt ? `sent ${whenInline(attempt.at)}` : "sent"} — the gateway never confirmed it. Not marked paid until the gateway confirms.
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="w-max" trailing={<ArrowUpRight />} onClick={() => setOpenId(inv.id)}>
                  Open invoice
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div ref={listRef} className="flex scroll-mt-28 flex-col gap-3">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6" data-lenis-prevent>
          <Segmented
            ariaLabel="Invoice status"
            value={view}
            onChange={setView}
            className="w-max"
            items={[
              { value: "all", label: "All", count: counts.all },
              { value: "open", label: "Open", count: counts.open },
              { value: "due", label: "Due", count: counts.due },
              { value: "overdue", label: "Overdue", count: counts.overdue },
              { value: "partial", label: "Partially paid", count: counts.partial },
              { value: "failed", label: "Not confirmed", count: counts.failed },
              { value: "settled", label: "Paid", count: counts.settled },
              { value: "refunded", label: "Refunded", count: counts.refunded },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill<MethodFilter>
            label="Method"
            value={method}
            defaultValue="all"
            onChange={setMethod}
            options={[{ value: "all", label: "Any" }, ...ALL_METHODS.map((m) => ({ value: m, label: m })), { value: "none", label: "Not paid yet" }]}
          />
          <FilterPill<DateFilter>
            label="Issued"
            value={date}
            defaultValue="all"
            onChange={setDate}
            options={[
              { value: "all", label: "Any" },
              { value: "today", label: "Today" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
            ]}
          />
          <SearchInput className="w-full sm:ml-auto sm:w-[280px]" placeholder="Search invoice, patient, item" aria-label="Search invoices" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt />}
            title={filtered ? "No invoices match" : "No invoices yet"}
            description={filtered ? "Try another status, method or date — or clear the search." : "Invoices created at checkout appear here."}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setView("all");
                    setMethod("all");
                    setDate("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <InvoiceTable invoices={list} flashId={flashId} canRecord onOpen={(i) => setOpenId(i.id)} onRecord={(i) => setRecordId(i.id)} />
      )}

      <p className="text-xs text-muted">
        {pluralize(list.length, "invoice")} shown · synthetic data · amounts in INR. Payments recorded here are saved in this browser session only.
      </p>

      <InvoiceSheet invoice={opened} canRecord onClose={() => setOpenId(null)} onRecord={(i) => setRecordId(i.id)} />
      <RecordPaymentModal invoice={recording} onClose={() => setRecordId(null)} onRecorded={(id) => flash(id)} />
    </div>
  );
}
