import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { CSSProperties } from "react";
import { PLANS, isPlanId } from "@/data/plans";
import { CLINIC, ROLE_ORDER, STAFF } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import type { Role } from "@/data/types";
import { COOKIE_PLAN, COOKIE_ROLE } from "@/lib/cookies";
import { cn } from "@/lib/cn";
import { TODAY, formatDayLabel, formatTime } from "@/lib/format";
import { ArrowLink } from "@/features/marketing/cta";
import { JsonLd, breadcrumbLd } from "@/features/marketing/json-ld";
import { GUTTER } from "@/features/marketing/section";
import s from "@/features/marketing/motion.module.css";
import { DemoChooser, type DemoLogin } from "@/features/pricing/demo-chooser";
import { DemoPatients } from "@/features/pricing/demo-patients";

const TITLE = "Live demo of Carelane clinic software — one login per plan and role";
const DESCRIPTION = `Explore Carelane with synthetic data and no sign-up. Each demo login is one real setup — one plan (${PLANS.map((p) => p.name).join(", ")}) and one role: doctor, nutritionist, yoga instructor, admin, reception, care coordinator or patient.`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · Carelane` },
  description: DESCRIPTION,
  alternates: { canonical: "/demo" },
  openGraph: { type: "website", url: "/demo", title: TITLE, description: DESCRIPTION, siteName: "Carelane", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const i = (n: number) => ({ "--i": n }) as CSSProperties;
const iso = TODAY.toISOString();

const FACTS = [
  `${CLINIC.name} (fictional)`,
  `${PATIENTS.length} synthetic patients`,
  `${STAFF.length} synthetic staff`,
  `Clock fixed at ${formatDayLabel(iso)}, ${formatTime(iso)} IST`,
];

const isRole = (v: string | undefined): v is Role => !!v && (ROLE_ORDER as string[]).includes(v);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const planParam = first(params.plan);
  const roleParam = first(params.role);
  const highlightPlan = isPlanId(planParam) ? planParam : undefined;
  const highlightRole = isRole(roleParam) ? roleParam : undefined;

  // Mark the visitor's current demo login, but only when both cookies were set by a demo login.
  const jar = await cookies();
  const cPlan = jar.get(COOKIE_PLAN)?.value;
  const cRole = jar.get(COOKIE_ROLE)?.value;
  const current: DemoLogin | undefined = isPlanId(cPlan) && isRole(cRole) && PLANS.find((p) => p.id === cPlan)?.roles.includes(cRole) ? { plan: cPlan, role: cRole } : undefined;

  return (
    <>
      <section aria-labelledby="demo-title" className={cn("pb-16 pt-8 md:pb-24 md:pt-12", GUTTER)}>
        <div className="mx-auto max-w-[1312px]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]", s.enter)} style={i(0)}>
                Live demo · no sign-up
              </span>
              <h1 id="demo-title" className={cn("mt-6 max-w-[18ch] text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px] xl:text-[64px]", s.enter)} style={i(1)}>
                Pick a demo login: one plan, one role.
              </h1>
            </div>
            <div className={cn("lg:col-span-5 lg:pb-2", s.enter)} style={i(2)}>
              <p className="max-w-[48ch] text-base leading-relaxed text-ink-2">
                Each demo is one real setup — one plan, one role. You see exactly what that plan includes and what that role works on, nothing more.
              </p>
              <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-muted">
                To switch, come back here and pick another login — inside the demo, use <span className="text-ink-2">Switch demo login</span> in the account menu, the sidebar
                or ⌘K. Everything runs on synthetic data and stays in your browser.
              </p>
              <ArrowLink href="/pricing" className="mt-6">
                Compare plans in detail
              </ArrowLink>
            </div>
          </div>

          <div className={cn("mt-12 md:mt-16", s.enter)} style={i(3)}>
            <DemoChooser highlightPlan={highlightPlan} highlightRole={highlightRole} current={current} />
          </div>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="About the demo data">
            {FACTS.map((f) => (
              <li key={f} className="inline-flex h-8 items-center rounded-full bg-sunken px-3 text-xs text-ink-2">
                {f}
              </li>
            ))}
          </ul>

          <section aria-labelledby="demo-patients-title" className="mt-16 md:mt-24">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
              <h2 id="demo-patients-title" className="max-w-[20ch] text-balance text-[32px] font-light leading-[1.06] tracking-[-0.028em] text-ink lg:col-span-7 md:text-[44px]">
                Or start from a patient&apos;s record.
              </h2>
              <p className="max-w-[52ch] text-base leading-relaxed text-muted lg:col-span-5 lg:pb-2">
                Each record opens with the Clinic plan&apos;s doctor login. The organ on each card comes from that patient&apos;s own conditions — the same rules every record in the
                demo uses.
              </p>
            </div>
            <div className="mt-8 md:mt-12">
              <DemoPatients />
            </div>
          </section>
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Live demo", path: "/demo" }])} />
    </>
  );
}
