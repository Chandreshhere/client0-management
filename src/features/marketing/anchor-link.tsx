"use client";

import type { ComponentProps } from "react";
import { scrollToElement } from "@/lib/scroll";

/**
 * In-page link ("#pricing") that glides to its section with native smooth scrolling, clear of the
 * sticky header, and keeps the URL hash in sync. Without JavaScript it is a plain anchor jump.
 */
export function AnchorLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: `#${string}` }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !scrollToElement(href, 96)) return;
        e.preventDefault();
        window.history.replaceState(null, "", href);
      }}
      {...props}
    />
  );
}
