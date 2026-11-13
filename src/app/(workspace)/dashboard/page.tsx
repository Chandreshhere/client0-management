import type { Metadata } from "next";
import { Dashboard } from "@/features/dashboard/dashboard";

export const metadata: Metadata = { title: "Home" };

/** Role home. The interactive dashboards live in the client feature module. */
export default function DashboardPage() {
  return <Dashboard />;
}
