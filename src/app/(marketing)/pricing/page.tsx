import type { Metadata } from "next";
import { PLANS } from "@/data/plans";
import { formatINR } from "@/lib/format";
import { CtaBand } from "@/features/marketing/cta-band";
import { FaqList } from "@/features/marketing/faq";
import { PRICING_FAQ } from "@/features/marketing/faq-data";
import { JsonLd, breadcrumbLd, faqLd, softwareLd, webPageLd } from "@/features/marketing/json-ld";
import { Section, SectionIntro } from "@/features/marketing/section";
import { PricingCalculator } from "@/features/pricing/calculator";
import { ComparisonTable } from "@/features/pricing/comparison";
import { monthlyLine } from "@/features/pricing/model";
import { PlanCards } from "@/features/pricing/plan-cards";
import { PricingHero } from "@/features/pricing/pricing-hero";

const TITLE = "Clinic management software pricing";
const DESCRIPTION = `Carelane pricing in INR: ${PLANS.map((p) => `${p.name} ${formatINR(p.setupFee)} setup + ${monthlyLine(p)}${p.pricing.kind === "per-user" ? ` for ${p.pricing.minUsers}–${p.pricing.maxUsers} users` : ""}`).join("; ")}. Compare features and estimate your first-year cost.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { type: "website", url: "/pricing", title: `${TITLE} · Carelane`, description: DESCRIPTION, siteName: "Carelane", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: `${TITLE} · Carelane`, description: DESCRIPTION },
};

export default function PricingPage() {
  return (
    <>
      <PricingHero />

      <Section labelledBy="plans-title" className="pt-0 md:pt-0">
        <h2 id="plans-title" className="sr-only">
          Plans
        </h2>
        <PlanCards />
      </Section>

      <Section id="calculator" labelledBy="calculator-title">
        <SectionIntro
          id="calculator-title"
          eyebrow="Cost calculator"
          title="What would Carelane cost for your team in the first year?"
          lead="Move the slider to your team size. Each plan shows its monthly fee and the first-year total — the one-time setup fee plus twelve months."
        />
        <div className="mt-12 md:mt-16">
          <PricingCalculator />
        </div>
      </Section>

      <Section id="compare" labelledBy="compare-title">
        <SectionIntro
          id="compare-title"
          eyebrow="Compare plans"
          title="Which features come with each plan?"
          lead="Every feature of the three plans, grouped the way a clinic works. Each plan includes everything in the plan before it."
        />
        <div className="mt-12 md:mt-16">
          <ComparisonTable />
        </div>
      </Section>

      <Section id="pricing-faq" labelledBy="pricing-faq-title">
        <SectionIntro id="pricing-faq-title" eyebrow="Questions" title="What else should you know before choosing a plan?" lead="The details behind the numbers, including what isn't fixed yet." />
        <FaqList items={PRICING_FAQ} className="mt-12 md:mt-16" />
      </Section>

      <CtaBand title="Not sure which plan fits? Open each one in the live demo." />

      <JsonLd data={softwareLd()} />
      <JsonLd data={faqLd(PRICING_FAQ)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])} />
      <JsonLd data={webPageLd({ path: "/pricing", name: TITLE, description: DESCRIPTION, dateModified: "2026-11-13" })} />
    </>
  );
}
