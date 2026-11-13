import type { Metadata } from "next";
import { GeneralView } from "@/features/settings/general-view";

export const metadata: Metadata = { title: "Settings" };

/** Settings → General: your profile, the clinic profile, branches and rooms. */
export default function SettingsPage() {
  return <GeneralView />;
}
