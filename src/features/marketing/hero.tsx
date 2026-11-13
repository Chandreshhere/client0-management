import { Fragment, type CSSProperties } from "react";
import { DemoFlag } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { AnchorLink } from "./anchor-link";
import { CareMapProof } from "./care-map-proof";
import { CtaLink } from "./cta";
import { Magnetic } from "./magnetic";
import { GUTTER } from "./section";
import s from "./motion.module.css";

/**
 * Hero: the claim (who it is for + the one differentiator) and live product proof right below.
 * Type budget: 12 / 16 / 40→68px · weights 300 / 400 / 500.
 */
const HEADLINE = "Your doctor, nutritionist and yoga instructor, working from one patient record.";
const i = (n: number) => ({ "--i": n }) as CSSProperties;

export function Hero() {
  const words = HEADLINE.split(" ");
  return (
    <section aria-labelledby="hero-title" className={cn("pb-16 pt-8 md:pb-24 md:pt-12", GUTTER)}>
      <div className="mx-auto max-w-[1312px]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <p className={cn("inline-flex h-8 items-center gap-2 rounded-full bg-surface pl-1 pr-3 text-xs text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]", s.enter)} style={i(0)}>
              <span className="flex h-6 items-center gap-1 rounded-full bg-sunken px-2" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-medical" />
                <span className="size-1.5 rounded-full bg-nutrition" />
                <span className="size-1.5 rounded-full bg-movement" />
              </span>
              <span className="hidden sm:inline">Clinic management software for multidisciplinary care</span>
              <span className="sm:hidden">Software for multidisciplinary clinics</span>
            </p>
            <h1 id="hero-title" className="mt-6 max-w-[880px] text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px] xl:text-[64px]">
              {words.map((w, n) => (
                <Fragment key={n}>
                  <span className={s.word} style={i(n)}>
                    {w}
                  </span>{" "}
                </Fragment>
              ))}
            </h1>
          </div>
          <div className="lg:col-span-4 lg:pb-2">
            <p className={cn("max-w-[46ch] text-base leading-relaxed text-muted", s.enter)} style={i(1)}>
              Carelane is clinic management software for outpatient clinics that combine medicine, nutrition and yoga. Referrals, care plans, reports and sessions stay on one
              timeline, so everyone can see where a patient&apos;s care stands — and where it stopped.
            </p>
            <div className={cn("mt-6 flex flex-wrap items-center gap-3", s.enter)} style={i(2)}>
              <Magnetic>
                <CtaLink href="/demo">Try the live demo</CtaLink>
              </Magnetic>
              <AnchorLink
                href="#pricing"
                className="inline-flex h-12 items-center rounded-full px-5 text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-sunken"
              >
                See pricing
              </AnchorLink>
            </div>
          </div>
        </div>

        <div className={cn("mt-12 md:mt-16", s.enter)} style={i(3)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <DemoFlag>Live product · synthetic patient</DemoFlag>
            <p className="text-xs text-muted">Pick a body system or any event. Threads show documented links between records — not cause and effect.</p>
          </div>
          <CareMapProof />
        </div>
      </div>
    </section>
  );
}
