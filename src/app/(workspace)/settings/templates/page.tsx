import type { Metadata } from "next";
import { TemplatesView } from "@/features/settings/templates-view";

export const metadata: Metadata = { title: "Templates" };

/** Settings → Templates: message, form and note templates with record-filled previews. */
export default function TemplatesPage() {
  return <TemplatesView />;
}
