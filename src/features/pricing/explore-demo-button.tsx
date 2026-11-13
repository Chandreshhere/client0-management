"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { planById, type PlanId } from "@/data/plans";
import type { Role } from "@/data/types";
import { Spinner } from "@/components/ui/button";
import { COOKIE_PLAN, COOKIE_ROLE, setCookie } from "@/lib/cookies";
import { cn } from "@/lib/cn";
import { CtaCircle, ctaClasses, type CtaTone } from "@/features/marketing/cta";

/**
 * Enters the demo with a plan (and a role): sets the cl_plan / cl_role demo cookies, then opens
 * /dashboard. The cookies only choose what the prototype shows — they are not authentication.
 */
export function enterDemo(plan: PlanId, role: Role) {
  setCookie(COOKIE_PLAN, plan);
  setCookie(COOKIE_ROLE, role);
}

export function ExploreDemoButton({ planId, role, tone = "dark", label, className }: { planId: PlanId; role?: Role; tone?: CtaTone; label?: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const plan = planById(planId);
  const asRole = role ?? plan.roles[0];

  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      onClick={() => {
        enterDemo(plan.id, asRole);
        startTransition(() => router.push("/dashboard"));
      }}
      className={cn(ctaClasses(tone, "lg"), "justify-between", className)}
    >
      <span>{pending ? "Opening the demo…" : (label ?? `Explore the ${plan.name} demo`)}</span>
      {pending ? (
        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone === "dark" ? "bg-white text-ink" : "bg-charcoal text-white")}>
          <Spinner />
        </span>
      ) : (
        <CtaCircle tone={tone} />
      )}
    </button>
  );
}
