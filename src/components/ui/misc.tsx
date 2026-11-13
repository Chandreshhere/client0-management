import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small shared pieces: page header, empty state, skeleton, kbd, progress, KPI stat, demo flag. */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0 max-w-[720px]">
        {eyebrow ? <div className="mb-3 text-sm text-muted">{eyebrow}</div> : null}
        <h1 className="text-[36px] font-light leading-[1.05] tracking-[-0.028em] text-ink md:text-display">{title}</h1>
        {description ? <p className="mt-3 max-w-[60ch] text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-card px-6 py-12 text-center", className)}>
      {icon ? <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-muted [&_svg]:size-6">{icon}</span> : null}
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-[42ch] text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-inner", className)} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-sunken px-1.5 font-mono text-[11px] text-muted", className)}>{children}</kbd>;
}

export function ProgressBar({ value, max = 100, tone = "primary", className, label }: { value: number; max?: number; tone?: "primary" | "dark" | "success" | "warning" | "danger"; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = { primary: "bg-primary", dark: "bg-charcoal", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, max = 100, size = 40, stroke = 4, className, children, track = "var(--color-sunken)" }: { value: number; max?: number; size?: number; stroke?: number; className?: string; children?: ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      {children ? <span className="absolute inset-0 flex items-center justify-center text-[11px] tabular">{children}</span> : null}
    </span>
  );
}

/** KPI tile: label, big light number, optional delta/context. Sizes: 12 / 32 / 12. */
export function Stat({ label, value, context, icon, className, tone = "surface" }: { label: ReactNode; value: ReactNode; context?: ReactNode; icon?: ReactNode; className?: string; tone?: "surface" | "sunken" | "primary" | "dark" }) {
  const toneClass = {
    surface: "bg-surface text-ink",
    sunken: "bg-sunken text-ink",
    primary: "bg-primary text-white",
    dark: "bg-charcoal text-white",
  }[tone];
  const sub = tone === "primary" || tone === "dark" ? "text-white/75" : "text-muted";
  return (
    <div className={cn("flex flex-col justify-between gap-6 rounded-card p-6", toneClass, className)}>
      <div className={cn("flex items-center justify-between gap-2 text-xs", sub)}>
        <span>{label}</span>
        {icon ? <span className="[&_svg]:size-[18px]">{icon}</span> : null}
      </div>
      <div>
        <div className="text-[32px] font-light leading-none tracking-[-0.02em] tabular">{value}</div>
        {context ? <div className={cn("mt-2 text-xs", sub)}>{context}</div> : null}
      </div>
    </div>
  );
}

/** Marks synthetic data, per the plan ("clearly labelled synthetic fixtures"). */
export function DemoFlag({ className, children = "Demo · synthetic data" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-[11px] font-medium text-warning", className)}>
      <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
      {children}
    </span>
  );
}
