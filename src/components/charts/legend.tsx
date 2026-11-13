import { cn } from "@/lib/cn";

/** Legend: swatch mirrors the mark (line for lines, rect for bars). Text stays in text tokens. */
export function Legend({
  items,
  note,
  className,
}: {
  items: { label: string; color: string; shape?: "line" | "rect" | "dot" }[];
  note?: string;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          {it.shape === "rect" ? (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden="true" />
          ) : it.shape === "dot" ? (
            <span className="size-2 rounded-full" style={{ background: it.color }} aria-hidden="true" />
          ) : (
            <span className="h-0.5 w-3 rounded-full" style={{ background: it.color }} aria-hidden="true" />
          )}
          <span className="text-ink-2">{it.label}</span>
        </li>
      ))}
      {note ? (
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full border-2 border-ink-2 bg-surface" aria-hidden="true" />
          <span>{note}</span>
        </li>
      ) : null}
    </ul>
  );
}
