import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

/**
 * The reference's call to action: a pill with a circular ↗ at its end. The circle turns 45° into
 * a → on hover (spring-pop curve). Server-safe — no client state.
 * - dark: charcoal pill + white circle (default on canvas / white surfaces)
 * - light: white pill + charcoal circle (on the cobalt focal surfaces)
 */
type Tone = "dark" | "light";
type Size = "md" | "lg";

const tones: Record<Tone, { pill: string; circle: string }> = {
  dark: { pill: "bg-charcoal text-white hover:bg-ink-2", circle: "bg-white text-ink" },
  light: { pill: "bg-surface text-ink hover:bg-canvas", circle: "bg-charcoal text-white" },
};

const sizes: Record<Size, { pill: string; circle: string }> = {
  md: { pill: "h-10 gap-3 pl-4 pr-1 text-sm", circle: "size-8 [&_svg]:size-4" },
  lg: { pill: "h-12 gap-4 pl-6 pr-1 text-[15px]", circle: "size-10 [&_svg]:size-[18px]" },
};

/** Pill classes, shared by links and buttons (e.g. the cookie-setting demo buttons). */
export function ctaClasses(tone: Tone = "dark", size: Size = "lg", className?: string) {
  return cn(
    "group/cta inline-flex shrink-0 select-none items-center whitespace-nowrap rounded-full font-medium",
    "transition-[background-color,transform] duration-200 [transition-timing-function:var(--ease-out-quart)] active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-60",
    tones[tone].pill,
    sizes[size].pill,
    className,
  );
}

export type CtaTone = Tone;

export function CtaLink({
  href,
  children,
  tone = "dark",
  size = "lg",
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; children: ReactNode; tone?: Tone; size?: Size }) {
  return (
    <Link
      href={href}
      className={ctaClasses(tone, size, className)}
      {...props}
    >
      <span>{children}</span>
      <CtaCircle tone={tone} size={size} />
    </Link>
  );
}

export function CtaCircle({ tone = "dark", size = "lg", className }: { tone?: Tone; size?: Size; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-transform duration-500 [transition-timing-function:var(--ease-spring-pop)] group-hover/cta:rotate-45",
        tones[tone].circle,
        sizes[size].circle,
        className,
      )}
    >
      <ArrowUpRight weight="regular" />
    </span>
  );
}

/** Quiet text link with a trailing ↗ used for secondary actions inside sections. */
export function ArrowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group/al inline-flex items-center gap-2 rounded-full text-sm text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink", className)}>
      {children}
      <ArrowUpRight size={16} aria-hidden="true" className="transition-transform duration-300 [transition-timing-function:var(--ease-spring-pop)] group-hover/al:rotate-45" />
    </Link>
  );
}
