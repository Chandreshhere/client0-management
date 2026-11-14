import type { Metadata } from "next";
import { BillingView } from "@/features/billing/billing-view";

export const metadata: Metadata = { title: "Invoices" };

/** Billing (Clinic+, Reception and Admin): invoices, payments recorded at the desk, daily collections. */
export default function BillingPage() {
  return <BillingView />;
}
