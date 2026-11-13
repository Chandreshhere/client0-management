import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { RoleProvider } from "@/components/shell/role-context";
import { isRole } from "@/lib/roles";
import { DEFAULT_PLAN, effectiveRole, isPlanId } from "@/data/plans";
import { COOKIE_PLAN, COOKIE_ROLE, COOKIE_SIDEBAR } from "@/lib/cookies";

// Signed-in workspace: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const planCookie = store.get(COOKIE_PLAN)?.value;
  const plan = isPlanId(planCookie) ? planCookie : DEFAULT_PLAN;
  const roleCookie = store.get(COOKIE_ROLE)?.value;
  const role = effectiveRole(plan, isRole(roleCookie) ? roleCookie : "doctor");
  const collapsed = store.get(COOKIE_SIDEBAR)?.value === "collapsed";
  return (
    <RoleProvider initialRole={role} initialPlan={plan} initialCollapsed={collapsed}>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
