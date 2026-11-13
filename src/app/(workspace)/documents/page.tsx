import type { Metadata } from "next";
import { DocumentsView } from "@/features/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

/** Document intake queue and review inbox (report date kept separate from upload date), ?upload=1 modal. */
export default function DocumentsPage() {
  return <DocumentsView />;
}
