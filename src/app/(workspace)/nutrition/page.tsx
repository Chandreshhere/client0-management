import type { Metadata } from "next";
import { NutritionPlans } from "@/features/nutrition/plans-overview";

export const metadata: Metadata = { title: "Nutrition plans" };

/** Nutritionist workspace — plan list (doc §2C). Interactive UI lives in the client feature module. */
export default function NutritionPage() {
  return <NutritionPlans />;
}
