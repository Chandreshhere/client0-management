import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your clinic workspace",
  description: "Start a Carelane clinic workspace in this prototype. No account is created.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <SignupForm />;
}
