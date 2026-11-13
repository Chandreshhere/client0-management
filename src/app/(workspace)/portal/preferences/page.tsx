import type { Metadata } from "next";
import { PreferencesView } from "@/features/portal/preferences/preferences-view";

export const metadata: Metadata = { title: "Preferences" };

/** Patient portal: channels per message type, reminder timing, language, consents with dates and scoped caregiver access. */
export default function PortalPreferencesPage() {
  return <PreferencesView />;
}
