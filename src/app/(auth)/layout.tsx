import type { Metadata } from "next";
import { Logo } from "@/components/shell/logo";
import { DemoFlag } from "@/components/ui/misc";
import { AuthShowcase } from "@/features/auth/auth-showcase";
import { AuthHeaderLink } from "@/features/auth/auth-header-link";

// Sign-in screens are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Split screen: the form column (logo top-left → "/", form centred at ≤400px) and, from lg up,
 * a cobalt showcase card inset 16px from the viewport's top, right and bottom edges.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col px-4 sm:px-8 lg:px-12">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4">
          <Logo href="/" />
          <AuthHeaderLink />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 pb-6 text-xs text-muted">
          <DemoFlag />
          <span>Nothing you type here leaves this browser.</span>
        </footer>
      </div>
      <aside aria-label="About Carelane" className="hidden lg:block">
        <div className="sticky top-0 h-dvh py-4 pr-4">
          <AuthShowcase />
        </div>
      </aside>
    </div>
  );
}
