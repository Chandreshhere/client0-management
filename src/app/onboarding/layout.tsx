import type { Metadata } from "next";

// Setup lives outside the app shell and is never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas">{children}</div>;
}
