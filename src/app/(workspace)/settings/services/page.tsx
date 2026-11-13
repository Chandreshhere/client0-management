import type { Metadata } from "next";
import { ServicesView } from "@/features/settings/services-view";

export const metadata: Metadata = { title: "Services" };

/** Settings → Services: catalogue, prices, lengths, rooms; bookings this week from the diary. */
export default function ServicesPage() {
  return <ServicesView />;
}
