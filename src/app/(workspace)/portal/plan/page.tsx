import type { Metadata } from "next";
import { PlanView } from "@/features/portal/plan/plan-view";

export const metadata: Metadata = { title: "My plan" };

/** Patient portal: body systems + condition tiles, today's checklist, meal plan, movement and self-reported readings (?log=1). */
export default function PortalPlanPage() {
  return <PlanView />;
}
