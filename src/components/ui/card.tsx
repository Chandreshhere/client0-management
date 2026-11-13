import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

/**
 * Surfaces.
 * - Card: white, 24px radius, 24px inset (the default panel).
 * - Group: the reference's recessed grey container. Its children are white Inset cards with
 *   16px radius sitting 8px in — concentric radii: 24 outer − 8 inset = 16 inner.
 */
export function Card({ className, padded = true, ...props }: ComponentProps<"div"> & { padded?: boolean }) {
  return <div className={cn("rounded-card bg-surface", padded && "p-6", className)} {...props} />;
}

export function Group({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-card bg-sunken p-2", className)} {...props} />;
}

export function Inset({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-inner bg-surface p-4", className)} {...props} />;
}

/**
 * Group header from the reference: icon circle · title / subtitle · ↗ circle button.
 * Lives inside a Group with 8px padding, so it adds its own 8px to reach the 16px text inset.
 */
export function GroupHeader({
  icon,
  title,
  subtitle,
  href,
  action,
  actionLabel,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-2", className)}>
      {icon ? <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink [&_svg]:size-[18px]">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted">{subtitle}</div> : null}
      </div>
      {action}
      {href ? (
        <Link
          href={href}
          aria-label={actionLabel ?? `Open ${typeof title === "string" ? title : "details"}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] duration-200 hover:bg-canvas active:scale-95"
        >
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/** Section heading used inside pages and cards. */
export function SectionTitle({ title, description, actions, className, as: As = "h2" }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <As className="text-lg font-normal tracking-[-0.01em] text-ink">{title}</As>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
