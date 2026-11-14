import { useMemo } from "react";
import type { Invoice } from "@/data/types";
import { patientById } from "@/data/patients";
import { formatDate, formatINR } from "@/lib/format";
import { createSessionStore, localId, useSessionStore } from "@/features/settings/session";
import { NOW_ISO, addDays, newestFirst } from "@/features/settings/time";
import { logAudit } from "@/features/settings/audit";
import { BASE_INVOICES, INVOICE_PRACTITIONER, SEED_PACKAGES, SEED_PAYMENTS, programmeById, type DisplayStatus, type PackageRow, type PayMethod, type PaymentEvent } from "./data";

/**
 * Billing = shared fixtures + what was recorded in this browser session. Payments are recorded by
 * hand at the desk (cash, UPI, card); no gateway, bank or patient is contacted.
 */
interface LocalInvoice extends Invoice {
  local: true;
}

interface BillingState {
  payments: PaymentEvent[];
  invoices: LocalInvoice[];
  packages: PackageRow[];
  extensions: Record<string, number>;
}

const SEED: BillingState = { payments: [], invoices: [], packages: [], extensions: {} };
export const billingStore = createSessionStore<BillingState>("carelane.admin.billing.v2", SEED);

export interface InvoiceView extends Omit<Invoice, "method"> {
  /** method of the latest recorded payment; null until one is recorded */
  method: PayMethod | null;
  events: PaymentEvent[];
  paidNow: number;
  balance: number;
  display: DisplayStatus;
  /** issued in this browser session (e.g. when a package was sold) */
  local: boolean;
  /** practitioner the invoice is collected for */
  practitionerId: string | null;
}

/** Shared status, with an unconfirmed attempt treated as no payment at all (still due). */
const baseStatus = (inv: Invoice): DisplayStatus => (inv.status === "failed" ? "due" : inv.status);

function toView(inv: Invoice, session: PaymentEvent[], local: boolean): InvoiceView {
  const seeded = SEED_PAYMENTS.filter((p) => p.invoiceId === inv.id);
  const mine = session.filter((p) => p.invoiceId === inv.id);
  const events = [...seeded, ...mine].sort((a, b) => newestFirst(a.at, b.at) || (b.local ? 1 : 0) - (a.local ? 1 : 0));
  // Only recorded payments count: the shared `paid` already equals the recorded seed payments.
  const paidNow = (inv.status === "failed" ? 0 : inv.paid) + mine.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, inv.total - paidNow);
  const display: DisplayStatus = mine.length ? (balance <= 0 ? "paid" : "partially-paid") : baseStatus(inv);
  const lastPaid = events.find((e) => e.kind === "payment" || e.kind === "credit" || e.kind === "refund");
  return {
    ...inv,
    method: lastPaid?.method ?? null,
    events,
    paidNow,
    balance,
    display,
    local,
    practitionerId: INVOICE_PRACTITIONER[inv.id] ?? patientById(inv.patientId)?.careTeam.doctor ?? null,
  };
}

/** "INV-2611-0412 · Harish Gowda" for audit targets (shared or issued in this session). */
function invoiceTarget(invoiceId: string) {
  const inv = BASE_INVOICES.find((i) => i.id === invoiceId) ?? billingStore.get().invoices.find((i) => i.id === invoiceId);
  const name = inv ? patientById(inv.patientId)?.name : undefined;
  return { kind: "invoice" as const, id: invoiceId, label: inv ? `${inv.number}${name ? ` · ${name}` : ""}` : invoiceId };
}

export function useInvoices(): InvoiceView[] {
  const s = useSessionStore(billingStore);
  return useMemo(
    () => [...s.invoices.map((i) => toView(i, s.payments, true)), ...BASE_INVOICES.map((i) => toView(i, s.payments, false))],
    [s],
  );
}

export function recordPayment(input: { invoiceId: string; amount: number; method: PayMethod; reference?: string; byId: string }): string {
  const ev: PaymentEvent = {
    id: localId("pay"),
    invoiceId: input.invoiceId,
    at: NOW_ISO,
    amount: input.amount,
    method: input.method,
    kind: "payment",
    confirmation: "recorded",
    byId: input.byId,
    reference: input.reference?.trim() || undefined,
    local: true,
  };
  billingStore.update((s) => ({ ...s, payments: [...s.payments, ev] }));
  logAudit({
    actorId: input.byId,
    category: "payment",
    action: `Recorded a ${input.method} payment of ${formatINR(input.amount)} at the desk`,
    target: invoiceTarget(input.invoiceId),
    detail: ev.reference ? `Reference ${ev.reference}` : "No reference entered",
    scope: "financial",
  });
  return ev.id;
}

export function undoPayment(id: string, actorId: string) {
  const ev = billingStore.get().payments.find((p) => p.id === id);
  billingStore.update((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
  if (ev) logAudit({ actorId, category: "payment", action: `Removed a ${ev.method} payment of ${formatINR(ev.amount)} (undo)`, target: invoiceTarget(ev.invoiceId), scope: "financial" });
}

// ---------- packages ----------

export function usePackages(): PackageRow[] {
  const s = useSessionStore(billingStore);
  return useMemo(
    () => [...s.packages, ...SEED_PACKAGES].map((p) => (s.extensions[p.key] ? { ...p, expires: addDays(p.expires, s.extensions[p.key]) } : p)),
    [s],
  );
}

export function useExtensions() {
  return useSessionStore(billingStore).extensions;
}

export function extendPackage(key: string, days: number, actorId: string) {
  billingStore.update((s) => ({ ...s, extensions: { ...s.extensions, [key]: (s.extensions[key] ?? 0) + days } }));
  const pkg = [...billingStore.get().packages, ...SEED_PACKAGES].find((p) => p.key === key);
  const name = pkg ? patientById(pkg.patientId)?.name : undefined;
  logAudit({
    actorId,
    category: "payment",
    action: days > 0 ? `Extended package validity by ${days} days` : `Reverted a ${-days}-day package extension (undo)`,
    target: pkg ? { kind: "patient", id: pkg.patientId, label: `${name ?? "Patient"} · ${pkg.name}` } : undefined,
    scope: "financial",
  });
}

/** Sell a package: the credits are added and an invoice is issued (due until a payment is recorded). */
export function sellPackage(input: { patientId: string; programmeId: string; start: string; actorId: string }): { pkg: PackageRow; invoice: LocalInvoice } {
  const prog = programmeById(input.programmeId);
  if (!prog) throw new Error(`Unknown programme ${input.programmeId}`);
  const pkg: PackageRow = {
    key: localId("pk"),
    patientId: input.patientId,
    name: `${prog.match} · ${prog.credits} sessions`,
    used: 0,
    total: prog.credits,
    expires: addDays(input.start, prog.validityDays),
    local: true,
    soldAt: NOW_ISO,
  };
  const firstCharge = firstInstalment(prog.id);
  const invoice: LocalInvoice = {
    id: localId("inv"),
    number: `INV-2611-${String(419 + billingStore.get().invoices.length).padStart(4, "0")}`,
    patientId: input.patientId,
    issuedAt: NOW_ISO,
    items: [{ label: prog.billing === "monthly" ? `${prog.name} · instalment 1` : prog.name, amount: firstCharge }],
    total: firstCharge,
    paid: 0,
    status: "due",
    method: null,
    local: true,
  };
  billingStore.update((s) => ({ ...s, packages: [pkg, ...s.packages], invoices: [invoice, ...s.invoices] }));
  logAudit({
    actorId: input.actorId,
    category: "payment",
    action: `Sold a ${prog.match} package (${prog.credits} credits, valid to ${formatDate(pkg.expires)}) — invoice ${invoice.number} for ${formatINR(invoice.total)} issued, due`,
    target: { kind: "patient", id: input.patientId, label: patientById(input.patientId)?.name ?? "Patient" },
    scope: "financial",
  });
  return { pkg, invoice };
}

/** What the first invoice for a programme charges (one instalment for monthly programmes). */
export function firstInstalment(programmeId: string) {
  const prog = programmeById(programmeId);
  if (!prog) return 0;
  return prog.billing === "monthly" && prog.weeks ? Math.round(prog.price / Math.round(prog.weeks / 4)) : prog.price;
}

export function undoSale(pkgKey: string, invoiceId: string | null, actorId: string) {
  const pkg = billingStore.get().packages.find((p) => p.key === pkgKey);
  if (pkg) logAudit({ actorId, category: "payment", action: `Removed the ${pkg.name} package added in error (undo)${invoiceId ? " and its invoice" : ""}`, target: { kind: "patient", id: pkg.patientId, label: patientById(pkg.patientId)?.name ?? "Patient" }, scope: "financial" });
  billingStore.update((s) => ({
    ...s,
    packages: s.packages.filter((p) => p.key !== pkgKey),
    invoices: invoiceId ? s.invoices.filter((i) => i.id !== invoiceId) : s.invoices,
  }));
}
