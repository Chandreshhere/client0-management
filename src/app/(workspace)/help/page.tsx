import type { Metadata } from "next";
import { HelpPage } from "@/features/help/help-page";

export const metadata: Metadata = { title: "Help & shortcuts" };

/** Help: keyboard shortcuts, how the demo works (roles and plans), what is synthetic. */
export default function HelpRoute() {
  return <HelpPage />;
}
