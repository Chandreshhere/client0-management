"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { Spinner } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { enterDemo } from "@/features/pricing/explore-demo-button";

/**
 * Opens one synthetic patient's record in the live demo: sets the demo cookies to the Clinic
 * plan as the doctor (the cookies choose what the prototype shows — they are not sign-in), then
 * navigates to /patients/<id>, where every patient has the full overview and journey.
 */
export function useOpenRecord() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = (patientId: string, tab: "" | "journey" = "") => {
    enterDemo("clinic", "doctor");
    start(() => router.push(`/patients/${patientId}${tab ? `/${tab}` : ""}`));
  };
  return { open, pending };
}

/** Circular white ↗ button (the reference's card affordance) that opens the record. */
export function OpenRecordButton({
  patientId,
  tab = "",
  className,
  tone = "white",
  size = "md",
}: {
  patientId: string;
  tab?: "" | "journey";
  className?: string;
  tone?: "white" | "surface";
  size?: "sm" | "md";
}) {
  const { open, pending } = useOpenRecord();
  const name = patientById(patientId)?.name ?? "this patient";
  const what = tab === "journey" ? `${name}'s care journey` : `${name}'s record`;
  return (
    <Tip label={`Open ${what} in the live demo (Clinic plan, doctor view)`}>
      <button
        type="button"
        aria-label={`Open ${what} in the live demo`}
        aria-busy={pending || undefined}
        onClick={() => open(patientId, tab)}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-ink transition-[background-color,transform] duration-200 active:scale-95",
          size === "md" ? "size-10" : "size-8",
          tone === "white" ? "bg-white hover:scale-105" : "bg-surface hover:bg-canvas",
          className,
        )}
      >
        {pending ? <Spinner /> : <ArrowUpRight size={size === "md" ? 18 : 16} />}
      </button>
    </Tip>
  );
}

/** Text link variant for lists ("Open record ↗"). */
export function OpenRecordLink({ patientId, tab = "", children, className }: { patientId: string; tab?: "" | "journey"; children: ReactNode; className?: string }) {
  const { open, pending } = useOpenRecord();
  return (
    <button
      type="button"
      onClick={() => open(patientId, tab)}
      aria-busy={pending || undefined}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink transition-colors duration-200 hover:bg-sunken", className)}
    >
      {children}
      {pending ? <Spinner /> : <ArrowUpRight size={14} aria-hidden="true" />}
    </button>
  );
}
