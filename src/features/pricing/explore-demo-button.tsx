"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlanId } from "@/data/plans";
import type { Role } from "@/data/types";
import { COOKIE_PLAN, COOKIE_ROLE, setCookie } from "@/lib/cookies";

/**
 * Demo logins: each one is a single real setup — one plan, one role. Logging in sets the cl_plan
 * and cl_role demo cookies, then opens /dashboard. The cookies only choose what the prototype
 * shows — they are not authentication.
 */
export function enterDemo(plan: PlanId, role: Role) {
  setCookie(COOKIE_PLAN, plan);
  setCookie(COOKIE_ROLE, role);
}

/** Log in to a demo and open its home; `target` is the login being opened (for a pending state). */
export function useDemoLogin() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const login = (plan: PlanId, role: Role) => {
    setTarget(`${plan}:${role}`);
    enterDemo(plan, role);
    startTransition(() => router.push("/dashboard"));
  };
  return { login, pending, target };
}
