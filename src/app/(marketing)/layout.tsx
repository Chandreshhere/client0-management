import type { ReactNode } from "react";
import { EagerAvatars } from "@/features/marketing/eager-avatars";
import { HashScroll } from "@/features/marketing/hash-scroll";
import { JsonLd, organizationLd } from "@/features/marketing/json-ld";
import { SiteFooter } from "@/features/marketing/site-footer";
import { SiteHeader } from "@/features/marketing/site-header";

/** Public marketing shell: header, main landmark, footer, sitewide Organization JSON-LD. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-charcoal focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <HashScroll />
      <EagerAvatars />
      <JsonLd data={organizationLd()} />
    </div>
  );
}
