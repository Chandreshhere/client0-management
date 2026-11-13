import type { Metadata } from "next";
import { AnatomySection } from "@/features/marketing/anatomy-section";
import { CtaBand } from "@/features/marketing/cta-band";
import { Disciplines } from "@/features/marketing/disciplines";
import { LANDING_FAQ } from "@/features/marketing/faq-data";
import { Handoff } from "@/features/marketing/handoff";
import { Hero } from "@/features/marketing/hero";
import { IndiaFirst } from "@/features/marketing/india";
import { JourneySection } from "@/features/marketing/journey-section";
import { JsonLd, faqLd, softwareLd, websiteLd } from "@/features/marketing/json-ld";
import { FaqSection, PricingSection } from "@/features/marketing/landing-sections";
import { Modules } from "@/features/marketing/modules";

const TITLE = "Carelane — clinic management software for doctors, nutritionists and yoga instructors";
const DESCRIPTION =
  "One shared patient record for doctors, nutritionists and yoga instructors. Referrals, shared care plans, report review, a front-desk queue and a patient portal for outpatient clinics in India. Try the live demo.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: TITLE, description: DESCRIPTION, siteName: "Carelane", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <AnatomySection />
      <Disciplines />
      <JourneySection />
      <Handoff />
      <Modules />
      <IndiaFirst />
      <PricingSection />
      <FaqSection />
      <CtaBand />
      <JsonLd data={websiteLd()} />
      <JsonLd data={softwareLd()} />
      <JsonLd data={faqLd(LANDING_FAQ)} />
    </>
  );
}
