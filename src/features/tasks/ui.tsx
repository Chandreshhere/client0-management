"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { Discipline } from "@/data/types";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import { DISCIPLINE_DOT, personById } from "./people";

/** Small pieces shared by the care-coordination pages (tasks, referrals, messages, documents). */

/**
 * Opens something when the URL carries ?name=value — the shell's entry points
 * (/tasks?new=1, /documents?upload=1, /messages?new=1). Render inside <Suspense>.
 */
export function QueryFlag({ name, value = "1", onMatch }: { name: string; value?: string; onMatch: () => void }) {
  const params = useSearchParams();
  const hit = params.get(name) === value;
  const cb = useRef(onMatch);
  useEffect(() => {
    cb.current = onMatch;
  });
  useEffect(() => {
    if (hit) cb.current();
  }, [hit]);
  return null;
}

/** Drops an entry-point flag from the URL once its dialog closes, so refresh/back don't reopen it. */
export function useClearQuery(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has(name)) return;
    params.delete(name);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [name, pathname, router]);
}

/** Discipline dot + label (colour is never the only signal). */
export function DisciplineTag({ discipline, className, label }: { discipline: Discipline; className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DISCIPLINE_DOT[discipline])} aria-hidden="true" />
      {label ?? DISCIPLINE_LABEL[discipline]}
    </span>
  );
}

/** The reference's outline "N instances" chip, used for group counts. */
export function CountChip({ children, className, tone = "outline" }: { children: ReactNode; className?: string; tone?: "outline" | "light" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs tabular",
        tone === "outline" ? "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Avatar + name for a staff member or patient; links to the record for patients. */
export function PersonInline({ id, size = "xs", link = false, className, suffix }: { id: string | null | undefined; size?: "xs" | "sm"; link?: boolean; className?: string; suffix?: ReactNode }) {
  const p = personById(id);
  if (!p) return <span className={cn("text-xs text-muted", className)}>Unassigned</span>;
  const body = (
    <>
      <Avatar src={p.avatar} name={p.name} size={size} />
      <span className="truncate">{p.name}</span>
      {suffix}
    </>
  );
  if (link && p.kind === "patient") {
    return (
      <Link href={`/patients/${p.id}`} className={cn("relative z-10 inline-flex min-w-0 items-center gap-1.5 rounded-full text-ink-2 underline-offset-2 transition-colors hover:text-ink hover:underline", className)}>
        {body}
      </Link>
    );
  }
  return <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>{body}</span>;
}

/**
 * Filter pill + menu. White pill at its default value; charcoal once it narrows the list
 * (the reference's "selected pill"), so an active filter is visible at a glance.
 */
export function FilterMenu({
  label,
  value,
  active,
  children,
  className,
  contentClassName,
  icon,
}: {
  label: string;
  value: ReactNode;
  active: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-4",
            active
              ? "bg-charcoal text-white hover:bg-ink-2"
              : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
            className,
          )}
        >
          {icon}
          <span className={active ? "text-white/70" : "text-muted"}>{label}</span>
          <span className="max-w-[160px] truncate">{value}</span>
          <CaretDown className={active ? "text-white/70" : "text-muted"} aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className={cn("w-[260px]", contentClassName)}>
        <div className="scrollbar-thin max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain">
          {children}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

/** Lightweight striped "redacted page" used where content is hidden from the viewer. */
export function RedactedLines({ lines = 5, className }: { lines?: number; className?: string }) {
  const widths = ["92%", "78%", "86%", "64%", "88%", "54%", "80%"];
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block h-2 rounded-full bg-sunken" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
