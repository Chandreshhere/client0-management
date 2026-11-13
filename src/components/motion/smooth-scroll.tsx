"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * Lenis smooth scrolling for the whole document, on every device (touch stays native, Lenis default).
 * - In-page scrollers (charts, tab strips, tables) carry NO data-lenis-prevent: allowNestedScroll
 *   lets a horizontal strip take sideways gestures while vertical wheel keeps scrolling the page,
 *   and a vertical pane scrolls itself until its end, then hands over to the page. Marking them
 *   prevented made the browser's native scroll fight Lenis' animation — the page "stuck" over them.
 * - Overlays (dialogs, menus, popovers) keep data-lenis-prevent: Lenis is stopped under a scroll lock.
 * - Paused while a Radix overlay locks scroll (body[data-scroll-locked]).
 * - Jumps to top on route change; honours prefers-reduced-motion (Lenis default).
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.11,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.2,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
        anchors: { offset: -96 },
      }}
    >
      <LenisBridge />
      {children}
    </ReactLenis>
  );
}

function LenisBridge() {
  const lenis = useLenis();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) return; // let #anchors land
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [pathname, lenis]);

  useEffect(() => {
    if (!lenis) return;
    const body = document.body;
    const sync = () => (body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start());
    const mo = new MutationObserver(sync);
    mo.observe(body, { attributes: true, attributeFilter: ["data-scroll-locked", "style"] });
    sync();
    return () => mo.disconnect();
  }, [lenis]);

  return null;
}
