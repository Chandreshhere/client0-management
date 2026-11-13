import { cn } from "@/lib/cn";

export type MeterTone = "neutral" | "warning" | "danger" | "muted";

const FILL: Record<MeterTone, string> = {
  neutral: "bg-charcoal",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-faint",
};
const TRACK: Record<MeterTone, string> = {
  neutral: "bg-sunken-2",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  muted: "bg-sunken",
};

/**
 * Session-credit meter. One pip per session (up to 40), so a package reads as countable sessions;
 * larger totals fall back to a continuous bar. Fill = used; the unfilled track is the lighter
 * step of the same ramp; severity (warning/danger) is always paired with a text label nearby.
 */
export function CreditMeter({ used, total, tone = "neutral", className, label }: { used: number; total: number; tone?: MeterTone; className?: string; label: string }) {
  const clamped = Math.max(0, Math.min(used, total));
  const aria = { role: "meter" as const, "aria-label": label, "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": clamped, "aria-valuetext": `${clamped} of ${total} used` };
  if (total <= 40) {
    return (
      <div {...aria} className={cn("flex h-2 w-full items-stretch gap-0.5", className)}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("min-w-0 flex-1 rounded-full", i < clamped ? FILL[tone] : TRACK[tone])} />
        ))}
      </div>
    );
  }
  return (
    <div {...aria} className={cn("h-2 w-full overflow-hidden rounded-full", TRACK[tone], className)}>
      <div className={cn("h-full rounded-full", FILL[tone])} style={{ width: `${(clamped / total) * 100}%` }} />
    </div>
  );
}
