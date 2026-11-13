import type { Metadata } from "next";
import { FoodLogs } from "@/features/nutrition/food-logs";

export const metadata: Metadata = { title: "Food logs" };

/** Self-reported food logs + adherence review (doc §2C). */
export default function FoodLogsPage() {
  return <FoodLogs />;
}
