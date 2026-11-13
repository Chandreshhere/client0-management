import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Carelane clinic workspace prototype.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
