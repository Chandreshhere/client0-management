import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BRANCHES, CLINIC, STAFF } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import { cn } from "@/lib/cn";
import { TODAY, formatDayLabel, formatTime } from "@/lib/format";
import { ArrowLink } from "@/features/marketing/cta";
import { JsonLd, breadcrumbLd } from "@/features/marketing/json-ld";
import { GUTTER } from "@/features/marketing/section";
import s from "@/features/marketing/motion.module.css";
import { DemoChooser } from "@/features/pricing/demo-chooser";

const TITLE = "Live demo of Carelane clinic software — choose a plan";
const DESCRIPTION =
  "Explore Carelane with synthetic data: pick the Starter, Team or Clinic plan and enter as a doctor, nutritionist, yoga instructor, front desk, care coordinator, admin or patient. No sign-up.";

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
  `${STAFF.length} staff across ${BRANCHES.length} branches`,
  `Clock fixed at ${formatDayLabel(iso)}, ${formatTime(iso)} IST`,
];

export default function DemoPage() {
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
                Choose a plan, then step into the clinic as anyone in it.
              </h1>
            </div>
            <div className={cn("lg:col-span-5 lg:pb-2", s.enter)} style={i(2)}>
              <p className="max-w-[48ch] text-base leading-relaxed text-muted">
                The demo unlocks exactly what each plan includes. Everything runs on synthetic data, and nothing you do leaves your browser session. You can switch plan or role
                from inside the demo at any time.
              </p>
              <ArrowLink href="/pricing" className="mt-6">
                Compare plans in detail
              </ArrowLink>
            </div>
          </div>

          <div className={cn("mt-12 md:mt-16", s.enter)} style={i(3)}>
            <DemoChooser />
          </div>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="About the demo data">
            {FACTS.map((f) => (
              <li key={f} className="inline-flex h-8 items-center rounded-full bg-sunken px-3 text-xs text-ink-2">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Live demo", path: "/demo" }])} />
    </>
  );
}
