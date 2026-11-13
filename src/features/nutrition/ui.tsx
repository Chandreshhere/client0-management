import { UserCircle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";
import { Pill } from "@/components/ui/pill";
import { DIET_LABEL, type Diet } from "./data";

/**
 * Small shared marks for the nutrition area (server-safe: no hooks).
 * DietMark follows the familiar Indian pack label: square + dot (veg), square + triangle (non-veg);
 * egg uses an amber dot. It is always paired with text or an accessible name.
 */
const DIET_COLOR: Record<Diet, string> = { veg: "var(--color-nutrition)", egg: "#b7791f", nonveg: "#8b3a1e" };

export function DietMark({ diet, className }: { diet: Diet; className?: string }) {
  const color = DIET_COLOR[diet];
  return (
    <span
      role="img"
      aria-label={DIET_LABEL[diet]}
      title={DIET_LABEL[diet]}
      className={cn("inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px]", className)}
      style={{ boxShadow: `inset 0 0 0 1.5px ${color}` }}
    >
      {diet === "nonveg" ? (
        <svg viewBox="0 0 8 8" className="size-2" aria-hidden="true">
          <path d="M4 1 L7 6.6 H1 Z" fill={color} />
        </svg>
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: color }} />
      )}
    </span>
  );
}

/** Patient-entered information stays visibly self-reported until a practitioner reviews it (doc §6). */
export function SelfReported({ className }: { className?: string }) {
  return (
    <Pill tone="outline" size="sm" icon={<UserCircle aria-hidden="true" />} className={className}>
      Self-reported
    </Pill>
  );
}

export function preferenceDiet(preference: string): Diet {
  const p = preference.toLowerCase();
  if (p.startsWith("non")) return "nonveg";
  if (p.startsWith("egg")) return "egg";
  return "veg";
}
