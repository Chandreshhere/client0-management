import type { Metadata } from "next";
import { PackagesView } from "@/features/billing/packages-view";

export const metadata: Metadata = { title: "Packages" };

/** Programme packages & session credits: usage meters, expiry, catalogue and a local "sell package" flow. */
export default function PackagesPage() {
  return <PackagesView />;
}
