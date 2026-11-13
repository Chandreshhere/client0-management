"use client";

import { ORGAN_LABEL, SYSTEM_INFO, organForSystem, patientSystems, type OrganKind } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Tip } from "@/components/ui/tooltip";
import { OrganImage } from "@/components/viz/organ";

export type OrganInfo = { organ: OrganKind; system: string; conditions: string[] };

/**
 * The organ of a patient's primary body system — derived from their recorded conditions through
 * the anatomy model (COPD → lungs, CKD → kidneys, hypothyroidism → thyroid…). Never a default
 * heart: a patient with nothing recorded gets no glyph at all.
 */
export function patientOrgan(patientId: string | null | undefined): OrganInfo | null {
  const p = patientById(patientId ?? undefined);
  if (!p) return null;
  const primary = patientSystems(p)[0];
  if (!primary) return null;
  return { organ: organForSystem(primary.key, primary.conditions), system: SYSTEM_INFO[primary.key].name, conditions: primary.conditions };
}

export function organGlyphLabel(info: OrganInfo, lead = "Primary body system on record") {
  return `${lead}: ${info.system} (${ORGAN_LABEL[info.organ].toLowerCase()}) — ${info.conditions.join(", ")}`;
}

const SIZE = { xs: "size-6", sm: "size-7", md: "size-10" } as const;

/** Organ disc for an explicit body system (the label says what it stands for). */
export function OrganBadge({ info, label, size = "sm", className }: { info: OrganInfo; label: string; size?: keyof typeof SIZE; className?: string }) {
  return (
    <Tip label={label}>
      <span
        role="img"
        aria-label={label}
        className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]", SIZE[size], className)}
      >
        <OrganImage kind={info.organ} className="size-[128%] max-w-none" />
      </span>
    </Tip>
  );
}

export function OrganGlyph({ patientId, size = "sm", className }: { patientId: string | null | undefined; size?: keyof typeof SIZE; className?: string }) {
  const info = patientOrgan(patientId);
  if (!info) return null;
  return <OrganBadge info={info} label={organGlyphLabel(info)} size={size} className={className} />;
}

/** Organ glyph + the system it stands for, e.g. "(lungs) Respiratory" — for table cells and cards. */
export function OrganTag({ patientId, info, label, className }: { patientId?: string | null; info?: OrganInfo | null; label?: string; className?: string }) {
  const resolved = info ?? patientOrgan(patientId);
  if (!resolved) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted", className)}>
      <OrganBadge info={resolved} label={label ?? organGlyphLabel(resolved)} size="xs" />
      <span className="truncate">{resolved.system}</span>
    </span>
  );
}
