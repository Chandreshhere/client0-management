"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Plumbing shared by the schedule's charts: measured width, integer ticks, roving keyboard focus. */

/** Clean integer ticks for counts (never 0.25 of a booking): ≤4 steps of 1, 2, 5, 10… */
export function intTicks(max: number) {
  if (max <= 0) return [0, 1];
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 4);
  const out: number[] = [];
  for (let v = 0; v <= Math.ceil(max / step) * step; v += step) out.push(v);
  return out;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One tab stop for a row of marks: ←/→ (and Home/End) move focus between them, Enter/Space picks.
 * Hover and focus share one "active" index so the tooltip shows the same thing for both.
 */
export function useMarks(count: number, initial: number, onPick?: (i: number) => void) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(initial);
  const [active, setActive] = useState<number | null>(null);
  const safe = Math.min(Math.max(0, focusIdx), Math.max(0, count - 1));

  const move = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(count - 1, i));
      setFocusIdx(next);
      refs.current[next]?.focus();
    },
    [count],
  );

  const markProps = (i: number) => ({
    ref: (el: SVGGElement | null) => {
      refs.current[i] = el;
    },
    tabIndex: i === safe ? 0 : -1,
    onPointerEnter: () => setActive(i),
    onPointerLeave: () => setActive((a) => (a === i ? null : a)),
    onFocus: () => {
      setActive(i);
      setFocusIdx(i);
    },
    onBlur: () => setActive((a) => (a === i ? null : a)),
    onClick: () => onPick?.(i),
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        move(i + (e.key === "ArrowRight" ? 1 : -1));
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        move(e.key === "Home" ? 0 : count - 1);
      } else if ((e.key === "Enter" || e.key === " ") && onPick) {
        e.preventDefault();
        onPick(i);
      }
    },
  });

  return { active, markProps };
}

/** Tooltip placement: to the right of the mark when it fits, otherwise to its left. */
export const tipLeft = (cx: number, width: number, tipWidth: number) => (cx + 16 + tipWidth <= width ? cx + 16 : Math.max(0, cx - 16 - tipWidth));
