import type { Metadata } from "next";
import { AccessView } from "@/features/settings/access-view";

export const metadata: Metadata = { title: "Access" };

/** Settings → Access: role × permission matrix (deny by default) and the access review. */
export default function AccessPage() {
  return <AccessView />;
}
