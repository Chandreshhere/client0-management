import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/**
 * Illustrated avatar (pre-generated SVG in /public/avatars) with an initials fallback for
 * people created in the demo (no image yet).
 */
const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-12 text-base", xl: "size-16 text-lg" } as const;

export function Avatar({ src, name, size = "md", className, ring, loading = "lazy" }: { src?: string | null; name: string; size?: keyof typeof sizes; className?: string; ring?: boolean; loading?: "lazy" | "eager" }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-medium text-primary-ink",
        ring && "ring-2 ring-surface",
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds no value here
        <img src={src} alt="" className="size-full object-cover" loading={loading} decoding="async" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = "sm" }: { people: { name: string; avatar?: string | null }[]; max?: number; size?: keyof typeof sizes }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.name} src={p.avatar} name={p.name} size={size} ring />
      ))}
      {rest > 0 ? (
        <span className={cn("relative inline-flex items-center justify-center rounded-full bg-sunken font-medium text-ink-2 ring-2 ring-surface", sizes[size])}>+{rest}</span>
      ) : null}
    </span>
  );
}
