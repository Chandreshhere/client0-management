import { Plus } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";
import type { Faq } from "./faq-data";
import s from "./motion.module.css";

/**
 * FAQ as native <details> — keyboard and screen-reader friendly, works without JavaScript, and
 * the answers are in the server HTML for crawlers. Same data feeds the FAQPage JSON-LD.
 */
export function FaqList({ items, className, openFirst = true }: { items: Faq[]; className?: string; openFirst?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((f, i) => (
        <details key={f.id} id={`faq-${f.id}`} open={openFirst && i === 0} className={cn("group scroll-mt-28 rounded-card bg-surface", s.reveal)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-card p-6 transition-colors hover:bg-canvas/60 [&::-webkit-details-marker]:hidden">
            <h3 className="text-[18px] font-normal leading-snug tracking-[-0.01em] text-ink">{f.q}</h3>
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink transition-transform duration-500 [transition-timing-function:var(--ease-spring-pop)] group-open:rotate-45"
            >
              <Plus size={18} />
            </span>
          </summary>
          <p className="max-w-[72ch] px-6 pb-6 text-base leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
