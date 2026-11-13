import type { Metadata } from "next";
import { ReferralsView } from "@/features/referrals/referrals-view";

export const metadata: Metadata = { title: "Referrals" };

/** Referral pipeline: where each handoff stopped, who it waits on, and role-aware next steps. */
export default function ReferralsPage() {
  return <ReferralsView />;
}
