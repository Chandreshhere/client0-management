import type { CSSProperties } from "react";
import { PLANS } from "@/data/plans";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { AnchorLink } from "@/features/marketing/anchor-link";
import { GUTTER } from "@/features/marketing/section";
import s from "@/features/marketing/motion.module.css";

/** /pricing page heading: the commercial query as the H1, answered in the first sentence. */
const i = (n: number) => ({ "--i": n }) as CSSProperties;
// The smallest bill is the base plan's (a per-user rate alone would understate a plan's minimum).
const base = PLANS[0];

export function PricingHero() {
  return (
    <section aria-labelledby="pricing-title" className={cn("pb-12 pt-8 md:pb-16 md:pt-12", GUTTER)}>
      <div className="mx-auto grid grid-cols-1 max-w-[1312px] gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]", s.enter)} style={i(0)}>
            Pricing · INR
          </span>
          <h1 id="pricing-title" className={cn("mt-6 max-w-[20ch] text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px] xl:text-[64px]", s.enter)} style={i(1)}>
            Clinic management software pricing, from one doctor to a ten-person clinic
          </h1>
        </div>
        <div className={cn("lg:col-span-4 lg:pb-2", s.enter)} style={i(2)}>
          <p className="max-w-[46ch] text-base leading-relaxed text-muted">
            Every plan is a one-time setup fee plus a monthly fee. {base.name} is a flat {formatINR(base.pricing.monthly)} a month after {formatINR(base.setupFee)} setup; Team and
            Clinic are priced per user.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <AnchorLink href="#calculator" className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas">
              Estimate your cost
            </AnchorLink>
            <AnchorLink href="#compare" className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas">
              Compare features
            </AnchorLink>
          </div>
        </div>
      </div>
    </section>
  );
}
