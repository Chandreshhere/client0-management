import type { Metadata } from "next";
import { TeamView } from "@/features/team/team-view";

export const metadata: Metadata = { title: "Team" };

/** Staff directory, today's load, leave cover and seats (doc §2A administration). */
export default function TeamPage() {
  return <TeamView />;
}
