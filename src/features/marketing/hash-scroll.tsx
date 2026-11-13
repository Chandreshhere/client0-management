"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { scrollToElement } from "@/lib/scroll";

/**
 * Arriving on a public page with a hash ("/#faq" from /pricing, or a shared "/#pricing" link):
 * once the page has rendered, land the target just below the sticky header.
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2) return;
    const raf = requestAnimationFrame(() => scrollToElement(hash, 96, { instant: true }));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
