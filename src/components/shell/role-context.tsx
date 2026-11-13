"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/data/types";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { effectiveRole, planById, planHas, type FeatureId, type PlanId } from "@/data/plans";
import { COOKIE_PLAN, COOKIE_ROLE, COOKIE_SIDEBAR, setCookie } from "@/lib/cookies";

/**
 * Demo session: workspace role + commercial plan (+ sidebar preference), cookie-backed so the
 * server renders exactly what the client hydrates. The role switcher is a demo affordance only —
 * real access must be enforced server-side from a trusted identity (doc §7).
 */
type Ctx = {
  role: Role;
  setRole: (r: Role, opts?: { navigate?: boolean }) => void;
  plan: PlanId;
  setPlan: (p: PlanId, opts?: { navigate?: boolean }) => void;
  has: (f: FeatureId) => boolean;
  user: { id: string; name: string; title: string; avatar: string };
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
};

const RoleCtx = createContext<Ctx | null>(null);

export function RoleProvider({
  initialRole,
  initialPlan,
  initialCollapsed,
  children,
}: {
  initialRole: Role;
  initialPlan: PlanId;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [plan, setPlanState] = useState<PlanId>(initialPlan);
  const [role, setRoleState] = useState<Role>(effectiveRole(initialPlan, initialRole));
  const [sidebarCollapsed, setCollapsedState] = useState(initialCollapsed);
  const router = useRouter();

  const setRole = useCallback(
    (r: Role, opts?: { navigate?: boolean }) => {
      const next = effectiveRole(plan, r);
      setRoleState(next);
      setCookie(COOKIE_ROLE, next);
      if (opts?.navigate !== false) router.push("/dashboard");
    },
    [plan, router],
  );

  const setPlan = useCallback(
    (p: PlanId, opts?: { navigate?: boolean }) => {
      setPlanState(p);
      setCookie(COOKIE_PLAN, p);
      const next = effectiveRole(p, role);
      if (next !== role) {
        setRoleState(next);
        setCookie(COOKIE_ROLE, next);
      }
      if (opts?.navigate) router.push("/dashboard");
    },
    [role, router],
  );

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    setCookie(COOKIE_SIDEBAR, v ? "collapsed" : "expanded");
  }, []);

  const has = useCallback((f: FeatureId) => planHas(plan, f), [plan]);

  const user = useMemo(() => {
    const demo = DEMO_USER[role];
    if (role === "patient") {
      const p = patientById(demo.personId)!;
      return { id: p.id, name: p.name, title: "Patient", avatar: p.avatar };
    }
    const s = staffById(demo.personId)!;
    return { id: s.id, name: s.name, title: s.title, avatar: s.avatar };
  }, [role]);

  const value = useMemo(
    () => ({ role, setRole, plan, setPlan, has, user, sidebarCollapsed, setSidebarCollapsed }),
    [role, setRole, plan, setPlan, has, user, sidebarCollapsed, setSidebarCollapsed],
  );
  return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}

/** Plan-aware helper for components: `const { has, plan } = usePlan()`. */
export function usePlan() {
  const { plan, setPlan, has } = useRole();
  return { plan, setPlan, has, details: planById(plan) };
}
