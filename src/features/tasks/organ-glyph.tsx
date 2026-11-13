"use client";

import { ORGAN_LABEL, SYSTEM_INFO, organForSystem, patientSystems, type OrganKind } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Tip } from "@/components/ui/tooltip";
import { OrganImage } from "@/components/viz/organ";

/**
 * The organ of a patient's primary body system — derived from their recorded conditions through
 * the anatomy model (COPD → lungs, CKD → kidneys, hypothyroidism → thyroid…). Never a default
 * heart: a patient with nothing recorded gets no glyph at all.
 */
export function patientOrgan(patientId: string | null | undefined): { organ: OrganKind; system: string; conditions: string[] } | null {
  const p = patientById(patientId ?? undefined);
  if (!p) return null;
  const primary = patientSystems(p)[0];
  if (!primary) return null;
  return { organ: organForSystem(primary.key, primary.conditions), system: SYSTEM_INFO[primary.key].name, conditions: primary.conditions };
}

export function organGlyphLabel(info: NonNullable<ReturnType<typeof patientOrgan>>) {
  return `Primary body system on record: ${info.system} (${ORGAN_LABEL[info.organ].toLowerCase()}) — ${info.conditions.join(", ")}`;
}

export function OrganGlyph({ patientId, size = "sm", className }: { patientId: string | null | undefined; size?: "xs" | "sm" | "md"; className?: string }) {
  const info = patientOrgan(patientId);
  if (!info) return null;
  const label = organGlyphLabel(info);
  return (
    <Tip label={label}>
      <span
        role="img"
        aria-label={label}
        className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]", { xs: "size-6", sm: "size-7", md: "size-10" }[size], className)}
      >
        <OrganImage kind={info.organ} className="size-[128%] max-w-none" />
      </span>
    </Tip>
  );
}

/** Organ glyph + the system it stands for, e.g. "(lungs) Respiratory" — for table cells. */
export function OrganTag({ patientId, className }: { patientId: string | null | undefined; className?: string }) {
  const info = patientOrgan(patientId);
  if (!info) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted", className)}>
      <OrganGlyph patientId={patientId} size="xs" />
      <span className="truncate">{info.system}</span>
    </span>
  );
}
