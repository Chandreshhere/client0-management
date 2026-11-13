import type { Metadata } from "next";
import { MealPlanBuilder } from "@/features/nutrition/builder";

export const metadata: Metadata = { title: "Meal plan builder" };

const DEFAULT_PLAN = "np-aditi";

/** Meal-plan builder for one plan (?plan=<id>). Defaults to Aditi Sharma's v3 in review. */
export default async function MealPlanBuilderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { plan } = await searchParams;
  const planId = typeof plan === "string" && plan ? plan : DEFAULT_PLAN;
  return <MealPlanBuilder key={planId} planId={planId} />;
}
