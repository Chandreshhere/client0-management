import type { CSSProperties } from "react";
import { PLANS } from "@/data/plans";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { AnchorLink } from "@/features/marketing/anchor-link";
import { GUTTER } from "@/features/marketing/section";
import s from "@/features/marketing/motion.module.css";

/** /pricing page heading: the commercial query as the H1, answered in the first sentence. */
const i = (n: number) => ({ "--i": n }) as CSSProperties;
const base = PLANS[0];
const top = PLANS[PLANS.length - 1];

const LINKS: { href: `#${string}`; label: string }[] = [
  { href: "#calculator", label: "Estimate your cost" },
  { href: "#compare", label: "Compare plans" },
  { href: "#add-ons", label: "Add-ons" },
  { href: "#documents", label: "Documents by plan" },
];

export function PricingHero() {
  return (
    <section aria-labelledby="pricing-title" className={cn("pb-12 pt-8 md:pb-16 md:pt-12", GUTTER)}>
      <div className="mx-auto grid max-w-[1312px] grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]", s.enter)} style={i(0)}>
            Pricing · INR · before GST
          </span>
          <h1 id="pricing-title" className={cn("mt-6 max-w-[20ch] text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px] xl:text-[64px]", s.enter)} style={i(1)}>
            Clinic management software pricing, per practitioner
          </h1>
        </div>
        <div className={cn("lg:col-span-5 lg:pb-2", s.enter)} style={i(2)}>
          <p className="max-w-[48ch] text-base leading-relaxed text-muted">
            Plans run from {formatINR(base.price.annual)} to {formatINR(top.price.annual)} per practitioner — each doctor, nutritionist and yoga instructor — per month, billed annually.
            Admin and reception seats are free up to each plan&apos;s limit, and onboarding is a one-time fee. Each plan includes everything in the one before it.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {LINKS.map((l) => (
              <AnchorLink
                key={l.href}
                href={l.href}
                className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas"
              >
                {l.label}
              </AnchorLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
