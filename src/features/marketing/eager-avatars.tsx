import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/**
 * Overlapping avatar stack for the public pages. Avatars here are part of the product proof
 * (tiny static SVGs), so they load eagerly instead of popping in mid-scroll — the kit's
 * AvatarStack has no `loading` prop, so this mirrors it with `loading="eager"`.
 */
const SIZE = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm" } as const;

export function EagerAvatarStack({ people, max = 3, size = "sm", className }: { people: { name: string; avatar?: string | null }[]; max?: number; size?: keyof typeof SIZE; className?: string }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("flex items-center -space-x-2", className)}>
      {shown.map((p) => (
        <Avatar key={p.name} src={p.avatar} name={p.name} size={size} ring loading="eager" />
      ))}
      {rest > 0 ? <span className={cn("relative inline-flex items-center justify-center rounded-full bg-sunken font-medium text-ink-2 ring-2 ring-surface", SIZE[size])}>+{rest}</span> : null}
    </span>
  );
}
