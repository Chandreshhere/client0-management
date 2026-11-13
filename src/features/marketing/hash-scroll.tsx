"use client";

import { useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The global Lenis bridge jumps to the top on every route change, which also cancels a hash
 * target ("/#faq" from /pricing, or a shared link to "/#pricing"). This runs after it (later in
 * the tree, then one frame later) and restores the anchor position.
 */
export function HashScroll() {
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: -96, immediate: true, force: true });
      else el.scrollIntoView();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, lenis]);

  return null;
}
