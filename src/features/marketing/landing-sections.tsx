import { PlanCards } from "@/features/pricing/plan-cards";
import { cn } from "@/lib/cn";
import { ArrowLink } from "./cta";
import { LANDING_FAQ } from "./faq-data";
import { FaqList } from "./faq";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/** Landing pricing and FAQ sections (thin wrappers around shared pricing / FAQ components). */

export function PricingSection() {
  return (
    <Section id="pricing" nav="pricing" labelledBy="pricing-title">
      <SectionIntro
        id="pricing-title"
        eyebrow="Pricing"
        title="How much does clinic management software cost for a team of one to ten?"
        lead="Three plans, priced in rupees: a one-time setup fee, then a monthly fee — flat for a single practitioner, per user for a team. Every plan can be explored in the live demo first."
        aside={<ArrowLink href="/pricing">Compare every feature and work out your cost</ArrowLink>}
      />
      <PlanCards className="mt-12 md:mt-16" />
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section id="faq" nav="faq" labelledBy="faq-title">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        <div className={cn("lg:col-span-4", s.reveal)}>
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">FAQ</span>
          <h2 id="faq-title" className="mt-6 max-w-[16ch] text-[32px] font-light leading-[1.06] tracking-[-0.028em] text-ink md:text-[44px]">
            What do clinic owners ask before switching?
          </h2>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-muted">Straight answers, including the parts that are still on the roadmap.</p>
        </div>
        <FaqList items={LANDING_FAQ} className="lg:col-span-8" />
      </div>
    </Section>
  );
}
