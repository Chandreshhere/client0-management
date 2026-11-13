import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Wordmark in the reference's style ("Ehr." → "Carelane."): sans, medium, closing period in
 * cobalt. Collapsed form is the "C." monogram.
 */
export function Logo({ collapsed, href = "/dashboard", className, tone = "ink" }: { collapsed?: boolean; href?: string; className?: string; tone?: "ink" | "white" }) {
  return (
    <Link href={href} aria-label="Carelane home" className={cn("inline-flex items-baseline rounded-full text-[22px] font-medium leading-none tracking-[-0.03em]", tone === "white" ? "text-white" : "text-ink", className)}>
      {collapsed ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-charcoal text-[18px] text-white">
          C<span className="text-[#7fa8ff]">.</span>
        </span>
      ) : (
        <>
          Carelane<span className="text-primary">.</span>
        </>
      )}
    </Link>
  );
}
