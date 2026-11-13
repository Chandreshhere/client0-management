/**
 * Native page scrolling (no smooth-scroll library): programmatic jumps glide with the browser's
 * own smooth scrolling, or jump instantly when the viewer prefers reduced motion.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Scroll the page to an absolute Y position. */
export function scrollToY(top: number, opts?: { instant?: boolean }) {
  window.scrollTo({ top: Math.max(0, top), behavior: opts?.instant ? "auto" : scrollBehavior() });
}

/**
 * Scroll the page so `target` (an element, "#id" or a selector) sits `gap` px below the top of
 * the viewport — clear of the sticky header. Returns false when the target isn't on the page.
 */
export function scrollToElement(target: Element | string | null | undefined, gap = 0, opts?: { instant?: boolean }) {
  const el =
    typeof target === "string"
      ? target.startsWith("#")
        ? document.getElementById(decodeURIComponent(target.slice(1)))
        : document.querySelector(target)
      : target;
  if (!el) return false;
  scrollToY(el.getBoundingClientRect().top + window.scrollY - gap, opts);
  return true;
}
