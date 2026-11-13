import type { Metadata } from "next";
import { BillingView } from "@/features/billing/billing-view";

export const metadata: Metadata = { title: "Invoices" };

/** Permitted billing (doc §3A): KPIs from invoices, filters, detail drawer, manual payment entry. */
export default function BillingPage() {
  return <BillingView />;
}
