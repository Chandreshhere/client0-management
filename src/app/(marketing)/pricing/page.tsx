import type { Metadata } from "next";
import { PLANS, yearlyCost } from "@/data/plans";
import { formatINR } from "@/lib/format";
import { ArrowLink } from "@/features/marketing/cta";
import { CtaBand } from "@/features/marketing/cta-band";
import { FaqList } from "@/features/marketing/faq";
import { PRICING_FAQ } from "@/features/marketing/faq-data";
import { JsonLd, breadcrumbLd, faqLd, softwareLd, webPageLd } from "@/features/marketing/json-ld";
import { Section, SectionIntro } from "@/features/marketing/section";
import { AddOns } from "@/features/pricing/add-ons";
import { PricingCalculator } from "@/features/pricing/calculator";
import { ComparisonTable } from "@/features/pricing/comparison";
import { DOCUMENT_RULES, DocumentsByPlan } from "@/features/pricing/documents-by-plan";
import { EXAMPLE_PRACTITIONERS } from "@/features/pricing/model";
import { PlanCards } from "@/features/pricing/plan-cards";
import { PricingHero } from "@/features/pricing/pricing-hero";

const TITLE = "Clinic management software pricing";
const DESCRIPTION = `Carelane pricing in INR: ${PLANS.map((p) => `${p.name} ${formatINR(p.price.annual)}`).join(", ")} per practitioner per month, billed annually, before GST, plus one-time onboarding. ${EXAMPLE_PRACTITIONERS} practitioners on ${PLANS[0].name}: ${formatINR(yearlyCost(PLANS[0], EXAMPLE_PRACTITIONERS))} a year.`;

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
          title="What would Carelane cost for your clinic?"
          lead="Set your practitioners and your admin and reception seats, then pick annual or monthly billing. Each plan shows the monthly and yearly cost, plus the one-time onboarding fee. Prices are before GST."
        />
        <div className="mt-12 md:mt-16">
          <PricingCalculator />
        </div>
      </Section>

      <Section id="compare" labelledBy="compare-title">
        <SectionIntro
          id="compare-title"
          eyebrow="Compare plans"
          title="What does each plan add?"
          lead="Core is the whole shared patient record. Clinic adds the front office and the Reception role. Pro brings the patient in with the app, adds care coordination, programmes and branches. Consent, access rules and the activity log are in every plan."
        />
        <div className="mt-12 md:mt-16">
          <ComparisonTable />
        </div>
      </Section>

      <Section id="add-ons" labelledBy="add-ons-title">
        <SectionIntro
          id="add-ons-title"
          eyebrow="Add-ons"
          title="What isn't included in any plan?"
          lead="These add-ons work with any plan and are priced separately — none is included in Core, Clinic or Pro. In the live demo they are marked as add-ons, never shown as working features."
        />
        <AddOns className="mt-12 md:mt-16" />
      </Section>

      <Section id="documents" labelledBy="documents-title">
        <SectionIntro
          id="documents-title"
          eyebrow="Documents by plan"
          title="Which documents does each plan produce?"
          lead="Every clinical document a patient needs is in Core. Clinic adds financial documents, and Pro adds documents shared with the patient and created by the patient."
        />
        <DocumentsByPlan className="mt-12 md:mt-16" />
        <div className="mt-4 rounded-card bg-sunken p-6">
          <h3 className="text-sm text-ink">Rules for documents, on every plan</h3>
          <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm text-ink-2 md:grid-cols-2">
            {DOCUMENT_RULES.map((r) => (
              <li key={r} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-2" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="pricing-faq" labelledBy="pricing-faq-title">
        <SectionIntro
          id="pricing-faq-title"
          eyebrow="Questions"
          title="What else should you know before choosing a plan?"
          lead="The details behind the numbers."
          aside={<ArrowLink href="/demo">Open each plan in the live demo</ArrowLink>}
        />
        <FaqList items={PRICING_FAQ} className="mt-12 md:mt-16" />
      </Section>

      <CtaBand title="Not sure which plan fits? Log in to each one in the live demo." />

      <JsonLd data={softwareLd()} />
      <JsonLd data={faqLd(PRICING_FAQ)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])} />
      <JsonLd data={webPageLd({ path: "/pricing", name: TITLE, description: DESCRIPTION, dateModified: "2026-11-14" })} />
    </>
  );
}
