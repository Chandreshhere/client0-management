"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Magnetic hover for the primary call to action: the element leans toward the cursor and
 * springs back (k300 / c30 / m1). Only for hover-capable fine pointers and when motion is
 * allowed; touch, pen and reduced-motion users get the plain control.
 */
const SPRING = { stiffness: 300, damping: 30, mass: 1 };
const MAX = 10;

export function Magnetic({ children, strength = 0.24, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const enabled = fine && !reduce;
  const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

  return (
    <motion.div
      ref={ref}
      className={cn("inline-flex", className)}
      style={enabled ? { x: sx, y: sy } : undefined}
      onPointerMove={(e) => {
        if (!enabled || e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength));
        y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength * 1.4));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
