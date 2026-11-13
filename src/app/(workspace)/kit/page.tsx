import type { Metadata } from "next";
import { KitGallery } from "@/features/kit/kit-gallery";

export const metadata: Metadata = { title: "Visual kit" };

/** Internal gallery of the rich visual components (refs 2–6). Not linked from navigation. */
export default function KitPage() {
  return <KitGallery />;
}
