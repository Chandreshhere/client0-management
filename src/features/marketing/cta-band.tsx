import Link from "next/link";
import { cn } from "@/lib/cn";
import { CtaLink } from "./cta";
import { Magnetic } from "./magnetic";
import { GUTTER } from "./section";
import s from "./motion.module.css";

/**
 * Closing call to action: the section's single cobalt surface. Behind it, three threads — medical,
 * nutrition, movement — converge on one ring: the shared record.
 */
const THREADS = ["M1200,60 C1040,60 980,210 860,210", "M1200,210 L860,210", "M1200,360 C1040,360 980,210 860,210"];

export function CtaBand({ title = "Want to see one patient move from consultation to kitchen to yoga mat?" }: { title?: string }) {
  return (
    <section aria-labelledby="cta-title" className={cn("pb-16 md:pb-24", GUTTER)}>
      <div className={cn("relative mx-auto max-w-[1312px] overflow-hidden rounded-card bg-primary px-6 py-12 text-white md:px-16 md:py-20", s.threadScope, s.revealTall)}>
        <svg aria-hidden="true" viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMid slice" className="pointer-events-none absolute inset-0 hidden size-full lg:block">
          {THREADS.map((d) => (
            // No vector-effect here: non-scaling-stroke breaks pathLength-normalised dashes (the draw-in).
            <path key={d} d={d} pathLength={1} fill="none" stroke="rgb(255 255 255 / 0.4)" strokeWidth={1.1} strokeLinecap="round" className={s.threadDraw} />
          ))}
          <circle cx={860} cy={210} r={22} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <circle cx={860} cy={210} r={6} fill="#ffffff" />
        </svg>
        <div className="relative max-w-[620px]">
          <h2 id="cta-title" className="text-[32px] font-light leading-[1.06] tracking-[-0.028em] md:text-[48px]">
            {title}
          </h2>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-white">
            The live demo opens a fictional clinic full of synthetic patients. Pick a plan and a role, then follow Kabir&apos;s record through every discipline — no sign-up, nothing
            sent anywhere.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <CtaLink href="/demo" tone="light">
                Try the live demo
              </CtaLink>
            </Magnetic>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45)] transition-colors duration-200 hover:bg-white/10"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
