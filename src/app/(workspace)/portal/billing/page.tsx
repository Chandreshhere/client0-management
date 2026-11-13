import type { Metadata } from "next";
import { BillingView } from "@/features/portal/billing/billing-view";

export const metadata: Metadata = { title: "Billing" };

/** Patient portal: package balance, upcoming charges, invoices/receipts; online payment honestly unavailable. */
export default function PortalBillingPage() {
  return <BillingView />;
}
