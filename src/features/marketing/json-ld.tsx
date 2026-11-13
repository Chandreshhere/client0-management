import { PLANS, type Plan } from "@/data/plans";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Faq } from "./faq-data";

/**
 * Structured data for the public pages (schema.org JSON-LD). Organization is declared on every
 * marketing page and referenced by @id. No ratings or reviews: none exist, so none are claimed.
 */
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;

export const SITE_DESCRIPTION =
  "Carelane is clinic management software for multidisciplinary outpatient clinics in India: one shared patient record for doctors, nutritionists and yoga instructors, with referrals, shared care plans, report review, a front-desk queue and a patient portal.";

type Json = { [key: string]: unknown };

export function JsonLd({ data }: { data: Json }) {
  // JSON.stringify output is inert; escaping "<" keeps "</script>" sequences from closing the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const organizationLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon.svg`,
  description: SITE_DESCRIPTION,
});

export const websiteLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": SITE_ID,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  inLanguage: "en-IN",
  publisher: { "@id": ORG_ID },
});

function planOffer(plan: Plan): Json {
  const p = plan.pricing;
  const perUser = p.kind === "per-user";
  return {
    "@type": "Offer",
    name: `${plan.name} plan`,
    description: plan.audience,
    url: `${SITE_URL}/pricing#plan-${plan.id}`,
    price: p.monthly,
    priceCurrency: "INR",
    priceSpecification: [
      {
        "@type": "UnitPriceSpecification",
        name: perUser ? "Monthly fee per user" : "Flat monthly fee",
        price: p.monthly,
        priceCurrency: "INR",
        unitText: perUser ? "per user per month" : "per month",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      { "@type": "PriceSpecification", name: "One-time setup fee", price: plan.setupFee, priceCurrency: "INR" },
    ],
    ...(p.kind === "per-user" ? { eligibleQuantity: { "@type": "QuantitativeValue", minValue: p.minUsers, maxValue: p.maxUsers, unitText: "users" } } : {}),
  };
}

export const softwareLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": APP_ID,
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Clinic management software",
  operatingSystem: "Web browser",
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  publisher: { "@id": ORG_ID },
  offers: PLANS.map(planOffer),
});

export const faqLd = (items: Faq[]): Json => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const breadcrumbLd = (trail: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${SITE_URL}${t.path}` })),
});

export const webPageLd = ({ path, name, description, dateModified }: { path: string; name: string; description: string; dateModified: string }): Json => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}${path}#webpage`,
  url: `${SITE_URL}${path}`,
  name,
  description,
  dateModified,
  inLanguage: "en-IN",
  isPartOf: { "@id": SITE_ID },
  about: { "@id": APP_ID },
  publisher: { "@id": ORG_ID },
});
