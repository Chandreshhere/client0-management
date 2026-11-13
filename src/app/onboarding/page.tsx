import type { Metadata } from "next";
import { OnboardingWizard } from "@/features/onboarding/wizard";

export const metadata: Metadata = {
  title: "Set up your clinic",
  description: "Clinic setup for the Carelane prototype: clinic, plan, services, team and hours.",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
