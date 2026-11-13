"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * On the public pages, avatars are part of the product proof and are tiny static SVGs, so they
 * load straight away instead of popping in mid-scroll. The kit Avatar always renders
 * loading="lazy"; this flips only /avatars/* images inside <main> (shared change requested:
 * a `loading` prop on Avatar).
 */
export function EagerAvatars() {
  const pathname = usePathname();
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLImageElement>('#main img[loading="lazy"][src^="/avatars/"]').forEach((img) => {
        img.loading = "eager";
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  return null;
}
