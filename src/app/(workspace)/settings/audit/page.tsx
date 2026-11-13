import type { Metadata } from "next";
import { AuditView } from "@/features/settings/audit-view";

export const metadata: Metadata = { title: "Audit log" };

/** Settings → Audit log: attributed, append-only history with category/scope/actor views and a local CSV export. */
export default function AuditPage() {
  return <AuditView />;
}
