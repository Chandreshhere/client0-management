"use client";

import { useLenis } from "lenis/react";
import type { ComponentProps } from "react";

/**
 * In-page link ("#pricing") that scrolls with Lenis and keeps the URL hash in sync.
 * Falls back to the browser's native jump when Lenis isn't running.
 */
export function AnchorLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: `#${string}` }) {
  const lenis = useLenis();
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !lenis) return;
        e.preventDefault();
        lenis.scrollTo(href, { offset: -96 });
        window.history.replaceState(null, "", href);
      }}
      {...props}
    />
  );
}
