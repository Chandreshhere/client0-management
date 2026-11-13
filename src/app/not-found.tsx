import type { Metadata } from "next";
import Link from "next/link";
import { Check, WarningCircle } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/shell/logo";
import { CtaLink } from "@/features/marketing/cta";

/**
 * 404, in the system's language: a thread that stops short of its next stage — the same
 * "where did it stop?" idea as the referral workflow. Links home and to the demo.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-4 py-6 sm:px-6 md:px-8 lg:px-12 xl:px-16">
      <header className="mx-auto flex h-16 w-full max-w-[1312px] items-center">
        <Logo href="/" />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[1312px] flex-1 items-center py-12">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
              Error <span className="ml-1 font-mono">404</span>
            </span>
            <h1 className="mt-6 max-w-[16ch] text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-ink md:text-[56px]">This page isn&apos;t part of the record.</h1>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">
              The link may be old or mistyped. Nothing was lost — head back to the overview, or open the live demo and pick a plan.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaLink href="/">Go to the homepage</CtaLink>
              <Link href="/demo" className="inline-flex h-12 items-center rounded-full bg-surface px-6 text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas">
                Open the live demo
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6" aria-hidden="true">
            <div className="rounded-card bg-surface p-6 md:p-8">
              <p className="text-xs text-muted">Where it stopped</p>
              <div className="relative mt-8 flex items-center justify-between">
                <div className="absolute left-5 right-5 top-5 h-px border-t border-dashed border-line-strong" />
                <div className="absolute left-5 top-5 h-0.5 w-[calc(50%-20px)] -translate-y-px bg-primary" />
                {["Requested", "Found", "Opened"].map((label, i) => (
                  <div key={label} className="relative flex flex-col items-center gap-3">
                    <span
                      className={
                        i === 0
                          ? "flex size-10 items-center justify-center rounded-full bg-primary text-sm text-white ring-4 ring-surface"
                          : i === 1
                            ? "flex size-10 items-center justify-center rounded-full bg-surface text-sm text-warning shadow-[inset_0_0_0_1.5px_var(--color-warning)] ring-4 ring-surface"
                            : "flex size-10 items-center justify-center rounded-full bg-surface text-sm text-faint shadow-[inset_0_0_0_1px_var(--color-line-strong)] ring-4 ring-surface"
                      }
                    >
                      {i === 0 ? <Check size={18} weight="bold" /> : i === 1 ? <WarningCircle size={18} /> : <span className="tabular">3</span>}
                    </span>
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 rounded-inner bg-warning-soft p-4 text-sm text-warning">Stopped at “Found” — no page lives at this address.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
