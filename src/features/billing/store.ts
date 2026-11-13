import { useMemo } from "react";
import type { Invoice } from "@/data/types";
import { patientById } from "@/data/patients";
import { formatDate, formatINR } from "@/lib/format";
import { createSessionStore, localId, useSessionStore } from "@/features/settings/session";
import { NOW_ISO, addDays, newestFirst } from "@/features/settings/time";
import { logAudit } from "@/features/settings/audit";
import { BASE_INVOICES, SEED_PACKAGES, SEED_PAYMENTS, programmeById, type DisplayStatus, type PackageRow, type PayMethod, type PaymentEvent } from "./data";

/**
 * Billing = shared fixtures + what was recorded in this browser session. Nothing is sent to a
 * gateway, bank or patient; manual entries are labelled as such everywhere they appear.
 */
interface LocalInvoice extends Invoice {
  draft: true;
}

interface BillingState {
  payments: PaymentEvent[];
  invoices: LocalInvoice[];
  reminders: Record<string, string>;
  packages: PackageRow[];
  extensions: Record<string, number>;
}

const SEED: BillingState = { payments: [], invoices: [], reminders: {}, packages: [], extensions: {} };
export const billingStore = createSessionStore<BillingState>("carelane.admin.billing.v1", SEED);

/** Raw session state (manual payments, drafts, reminders, packages) for the overview charts. */
export const useBillingSession = () => useSessionStore(billingStore);

export interface InvoiceView extends Invoice {
  events: PaymentEvent[];
  paidNow: number;
  balance: number;
  display: DisplayStatus;
  draft: boolean;
  reminderAt: string | null;
  /** at least one payment was recorded by hand in this session */
  manual: boolean;
}

function toView(inv: Invoice, session: PaymentEvent[], reminders: Record<string, string>, draft: boolean): InvoiceView {
  const mine = session.filter((p) => p.invoiceId === inv.id);
  const events = [...SEED_PAYMENTS.filter((p) => p.invoiceId === inv.id), ...mine].sort((a, b) => newestFirst(a.at, b.at) || (b.local ? 1 : 0) - (a.local ? 1 : 0));
  const paidNow = inv.paid + mine.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, inv.total - paidNow);
  const display: DisplayStatus = mine.length ? (balance <= 0 ? "recorded" : "partially-paid") : inv.status;
  return {
    ...inv,
    method: mine.length ? mine[mine.length - 1].method : inv.method,
    events,
    paidNow,
    balance,
    display,
    draft,
    reminderAt: reminders[inv.id] ?? null,
    manual: mine.length > 0,
  };
}

/** "INV-2611-0412 · Harish Gowda" for audit targets (shared or drafted in this session). */
function invoiceTarget(invoiceId: string) {
  const inv = BASE_INVOICES.find((i) => i.id === invoiceId) ?? billingStore.get().invoices.find((i) => i.id === invoiceId);
  const name = inv ? patientById(inv.patientId)?.name : undefined;
  return { kind: "invoice" as const, id: invoiceId, label: inv ? `${inv.number}${name ? ` · ${name}` : ""}` : invoiceId };
}

export function useInvoices(): InvoiceView[] {
  const s = useSessionStore(billingStore);
  return useMemo(
    () => [...s.invoices.map((i) => toView(i, s.payments, s.reminders, true)), ...BASE_INVOICES.map((i) => toView(i, s.payments, s.reminders, false))],
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
    confirmation: "manual",
    byId: input.byId,
    reference: input.reference?.trim() || undefined,
    note: input.method === "Cash" ? "Recorded manually at the desk — saved in this browser session only." : "Recorded manually — gateway confirmation not connected. Saved in this browser session only.",
    local: true,
  };
  billingStore.update((s) => ({ ...s, payments: [...s.payments, ev] }));
  logAudit({
    actorId: input.byId,
    category: "payment",
    action: `Recorded a ${input.method} payment of ${formatINR(input.amount)} manually — not confirmed by a gateway or bank`,
    target: invoiceTarget(input.invoiceId),
    detail: ev.reference ? `Reference ${ev.reference}` : "No reference entered",
    scope: "financial",
  });
  return ev.id;
}

export function undoPayment(id: string, actorId: string) {
  const ev = billingStore.get().payments.find((p) => p.id === id);
  billingStore.update((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
  if (ev) logAudit({ actorId, category: "payment", action: `Removed a manual ${ev.method} entry of ${formatINR(ev.amount)} (undo)`, target: invoiceTarget(ev.invoiceId), scope: "financial" });
}

export function noteReminder(invoiceId: string, actorId: string) {
  billingStore.update((s) => ({ ...s, reminders: { ...s.reminders, [invoiceId]: NOW_ISO } }));
  logAudit({ actorId, category: "payment", action: "Requested a payment reminder — not sent, messaging isn't connected", target: invoiceTarget(invoiceId), scope: "financial" });
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

export function sellPackage(input: { patientId: string; programmeId: string; start: string; draftInvoice: boolean; actorId: string }): { pkg: PackageRow; invoice: LocalInvoice | null } {
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
  const invoice: LocalInvoice | null = input.draftInvoice
    ? {
        id: localId("inv"),
        number: `INV-2611-D${String(billingStore.get().invoices.length + 1).padStart(3, "0")}`,
        patientId: input.patientId,
        issuedAt: NOW_ISO,
        items: [{ label: prog.billing === "monthly" ? `${prog.name} · instalment 1` : prog.name, amount: firstCharge }],
        total: firstCharge,
        paid: 0,
        status: "due",
        method: null,
        draft: true,
      }
    : null;
  billingStore.update((s) => ({ ...s, packages: [pkg, ...s.packages], invoices: invoice ? [invoice, ...s.invoices] : s.invoices }));
  logAudit({
    actorId: input.actorId,
    category: "payment",
    action: `Added a ${prog.match} package (${prog.credits} credits, valid to ${formatDate(pkg.expires)}) — no payment taken${invoice ? `; draft invoice ${invoice.number} for ${formatINR(invoice.total)}` : ""}`,
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
  if (pkg) logAudit({ actorId, category: "payment", action: `Removed the ${pkg.name} package added in error (undo)${invoiceId ? " and its draft invoice" : ""}`, target: { kind: "patient", id: pkg.patientId, label: patientById(pkg.patientId)?.name ?? "Patient" }, scope: "financial" });
  billingStore.update((s) => ({
    ...s,
    packages: s.packages.filter((p) => p.key !== pkgKey),
    invoices: invoiceId ? s.invoices.filter((i) => i.id !== invoiceId) : s.invoices,
  }));
}
