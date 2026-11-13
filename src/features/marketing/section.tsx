import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./motion.module.css";

/**
 * Page rhythm for the public site: a 1312px content column (64px gutters at 1440), 96px
 * vertical rhythm on desktop / 64px on mobile. `nav` feeds the header's scroll-spy.
 */
export const GUTTER = "px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16";

export function Section({
  id,
  nav,
  labelledBy,
  className,
  innerClassName,
  children,
}: {
  id?: string;
  nav?: "product" | "workflows" | "pricing" | "faq";
  labelledBy?: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-nav={nav} aria-labelledby={labelledBy} className={cn("scroll-mt-24 py-16 md:py-20", GUTTER, className)}>
      <div className={cn("mx-auto max-w-[1312px]", innerClassName)}>{children}</div>
    </section>
  );
}

/**
 * Section heading: outline eyebrow chip (the reference's "N instances" chip), a full-sentence
 * buyer question as the H2, and a lead paragraph that answers it directly (extractable).
 * Type budget: 12 / 16 / 32→44px · weights 300 / 400.
 */
export function SectionIntro({
  id,
  eyebrow,
  title,
  lead,
  aside,
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-8", s.reveal, className)}>
      <div className="lg:col-span-7">
        <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">{eyebrow}</span>
        <h2 id={id} className="mt-6 max-w-[24ch] text-balance text-[32px] font-light leading-[1.06] tracking-[-0.028em] text-ink md:text-[44px]">
          {title}
        </h2>
      </div>
      <div className="lg:col-span-5 lg:pb-2">
        <p className="max-w-[56ch] text-base leading-relaxed text-muted">{lead}</p>
        {aside ? <div className="mt-6">{aside}</div> : null}
      </div>
    </div>
  );
}
