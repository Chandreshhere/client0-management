"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, Receipt } from "@phosphor-icons/react";
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
import { TODAY_KEY, daysAgo, istDayKey, newestFirst } from "@/features/settings/time";
import { ALL_METHODS, OPEN_STATUSES, type DisplayStatus, type PayMethod } from "./data";
import { InvoiceTable } from "./invoice-table";
import { InvoiceSheet } from "./invoice-sheet";
import { RecordPaymentModal } from "./record-payment";
import { CollectionsCard, OldestOpenTile, OutstandingFocal, StatusCard, TodayTile } from "./overview";
import { useInvoices } from "./store";

/** Billing is the front desk's (Reception) with the administrator; no clinical role works here. */
const BILLING_ROLES: Role[] = ["admin", "frontdesk"];

type View = "all" | "open" | "due" | "overdue" | "partial" | "settled" | "refunded";
type MethodFilter = "all" | "none" | PayMethod;
type DateFilter = "all" | "today" | "7d" | "30d";

const VIEW_MATCH: Record<View, (s: DisplayStatus) => boolean> = {
  all: () => true,
  open: (s) => OPEN_STATUSES.includes(s),
  due: (s) => s === "due",
  overdue: (s) => s === "overdue",
  partial: (s) => s === "partially-paid",
  settled: (s) => s === "paid",
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
            description="Invoices, receipts and outstanding balances are handled by Reception and administrators. Ask them if a patient has a billing question."
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
    const next: View = s === "overdue" ? "overdue" : s === "partially-paid" ? "partial" : s === "due" ? "due" : "all";
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
        .sort((a, b) => Number(b.local) - Number(a.local) || newestFirst(a.issuedAt, b.issuedAt)),
    [invoices, view, method, date, q],
  );

  const opened = invoices.find((i) => i.id === openId) ?? null;
  const recording = invoices.find((i) => i.id === recordId) ?? null;
  const filtered = view !== "all" || method !== "all" || date !== "all" || q !== "";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Invoices, receipts and balances due. Record cash, UPI and card payments as you take them — an invoice shows as paid only once its payment is recorded."
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
        <CollectionsCard invoices={invoices} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TodayTile invoices={invoices} />
        <OldestOpenTile invoices={invoices} onOpen={(i) => setOpenId(i.id)} />
        <div className="sm:col-span-2">
          <StatusCard invoices={invoices} />
        </div>
      </div>

      <div ref={listRef} className="flex scroll-mt-28 flex-col gap-3">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6">
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
              { value: "partial", label: "Partly paid", count: counts.partial },
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
        {pluralize(list.length, "invoice")} shown · synthetic data · amounts in INR. Payments you record are saved in this browser session only.
      </p>

      <InvoiceSheet invoice={opened} canRecord onClose={() => setOpenId(null)} onRecord={(i) => setRecordId(i.id)} />
      <RecordPaymentModal invoice={recording} onClose={() => setRecordId(null)} onRecorded={(id) => flash(id)} />
    </div>
  );
}
