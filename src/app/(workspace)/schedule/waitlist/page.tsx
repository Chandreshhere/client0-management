import type { Metadata } from "next";
import { WaitlistView } from "@/features/schedule/waitlist-view";

export const metadata: Metadata = { title: "Waitlist" };

/** Waitlist: offer freed or open slots to waiting patients; record replies. */
export default function WaitlistPage() {
  return <WaitlistView />;
}
