import type { Metadata } from "next";
import { PackagesView } from "@/features/billing/packages-view";

export const metadata: Metadata = { title: "Packages" };

/** Session packages: credits used when attendance is marked, low-balance and expiry alerts, catalogue, "sell package" (issues an invoice). */
export default function PackagesPage() {
  return <PackagesView />;
}
