"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * Lenis smooth scrolling for the whole document.
 * - Nested scroll areas (menus, drawers, tables) keep native scrolling (allowNestedScroll +
 *   data-lenis-prevent on overlays).
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

  // Smooth wheel scrolling only on capable desktops; everyone else gets native scrolling.
  useEffect(() => {
    if (!lenis) return;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = !window.matchMedia("(pointer: fine)").matches || (nav.hardwareConcurrency ?? 4) < 8 || (nav.deviceMemory !== undefined && nav.deviceMemory < 8);
    if (weak) lenis.options.smoothWheel = false;
  }, [lenis]);

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
