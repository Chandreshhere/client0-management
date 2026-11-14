import { ADDONS, PLANS, yearlyCost } from "@/data/plans";
import { PlanCards } from "@/features/pricing/plan-cards";
import { EXAMPLE_PRACTITIONERS } from "@/features/pricing/model";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { ArrowLink } from "./cta";
import { LANDING_FAQ, LANDING_FAQ_TOPICS } from "./faq-data";
import { FaqTopics } from "./faq-topics";
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
        title="How much does clinic management software cost per practitioner?"
        lead={`${PLANS.map((p) => `${p.name} ${formatINR(p.price.annual)}`).join(", ")} per practitioner a month, billed annually and before GST. Admin and reception seats are free up to each plan's limit, onboarding is a one-time fee, and each plan includes everything in the one before it.`}
        aside={<ArrowLink href="/pricing">Compare every feature and work out your cost</ArrowLink>}
      />
      <PlanCards className="mt-12 md:mt-16" />
      <div className={cn("mt-4 grid grid-cols-1 gap-4 md:grid-cols-2", s.reveal)}>
        <div className="rounded-card bg-sunken p-6">
          <p className="text-xs text-muted">Example · {EXAMPLE_PRACTITIONERS} practitioners, billed annually</p>
          <p className="mt-2 text-base text-ink">
            {PLANS.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? " · " : ""}
                <span className="whitespace-nowrap">
                  {p.name} <span className="tabular">{formatINR(yearlyCost(p, EXAMPLE_PRACTITIONERS))}</span>/yr
                </span>
              </span>
            ))}
          </p>
          <p className="mt-1 text-sm text-muted">Plus the one-time onboarding fee.</p>
        </div>
        <div className="rounded-card bg-sunken p-6">
          <p className="text-xs text-muted">Add-ons · any plan, priced separately</p>
          <p className="mt-2 text-base text-ink">{ADDONS.map((a) => a.label).join(" · ")}</p>
          <ArrowLink href="/pricing#add-ons" className="mt-2">
            See how add-ons are priced
          </ArrowLink>
        </div>
      </div>
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section id="faq" nav="faq" labelledBy="faq-title">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        <div className={cn("lg:sticky lg:top-28 lg:col-span-4 lg:self-start", s.reveal)}>
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">FAQ</span>
          <h2 id="faq-title" className="mt-6 max-w-[16ch] text-[32px] font-light leading-[1.06] tracking-[-0.028em] text-ink md:text-[44px]">
            What do clinic owners ask before switching?
          </h2>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-muted">Straight answers, including the parts that are still on the roadmap.</p>
          <FaqTopics topics={LANDING_FAQ_TOPICS} />
          <ArrowLink href="/demo" className="mt-8 hidden lg:inline-flex">
            Still deciding? Open the live demo
          </ArrowLink>
        </div>
        <FaqList items={LANDING_FAQ} className="lg:col-span-8" />
      </div>
    </Section>
  );
}
