import type { Metadata } from "next";
import { AppointmentsView } from "@/features/portal/appointments/appointments-view";

export const metadata: Metadata = { title: "My appointments" };

/** Patient portal: next visit (prepare + directions), upcoming/past, book/request, move and cancel (?book=1). */
export default function PortalAppointmentsPage() {
  return <AppointmentsView />;
}
