import type { Metadata } from "next";
import { ReferralsView } from "@/features/referrals/referrals-view";

export const metadata: Metadata = { title: "Assignments" };

/** Assignments (spec F5): doctor → nutritionist or instructor, assigned → seen; back with the doctor after 48 h. */
export default function ReferralsPage() {
  return <ReferralsView />;
}
