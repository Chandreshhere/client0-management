import type { Metadata } from "next";
import { MessagesView } from "@/features/messages/messages-view";

export const metadata: Metadata = { title: "Messages" };

/** Secure messages: thread list + conversation, response-time banners, ?new=1 modal. */
export default function MessagesPage() {
  return <MessagesView />;
}
