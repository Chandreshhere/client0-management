"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Path } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { clinicNoOf, type RegistryPatient, type Row } from "./data";
import { AllergyLine, CareTeamStack, FlagPills, NextVisitLine, PatientStatusBadge } from "./registry-bits";
import { OrganGlyph } from "./organ-glyph";
import { RowActions } from "./row-actions";

/** Card list — the registry on narrow screens, and the "Cards" view on wide ones. */
export function RegistryCards({
  rows,
  selected,
  onToggle,
  onOpen,
  onAssign,
  onOpenLocal,
  showBalance,
  highlight,
  className,
}: {
  rows: Row[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (p: RegistryPatient) => void;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
  showBalance: boolean;
  highlight: string | null;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-1 gap-4 @[640px]:grid-cols-2 @[1040px]:grid-cols-3", className)}>
      {rows.map((r) => {
        const p = r.patient;
        const isSelected = selected.has(p.id);
        return (
          <motion.li key={p.id} layout="position" transition={spring}>
            <article
              className={cn(
                "flex h-full flex-col rounded-card p-2 transition-colors duration-500",
                isSelected ? "bg-sunken-2" : highlight === p.id ? "bg-primary-soft-2" : "bg-sunken",
              )}
            >
              <div className="flex flex-1 flex-col rounded-inner bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={p.avatar} name={p.name} size="md" />
                  <div className="min-w-0 flex-1">
                    {p.local ? (
                      <button type="button" onClick={() => onOpenLocal(p.id)} className="block max-w-full truncate text-left text-sm font-medium text-ink hover:underline">
                        {p.name}
                      </button>
                    ) : (
                      <Link href={`/patients/${p.id}`} className="block truncate text-sm font-medium text-ink hover:underline">
                        {p.name}
                      </Link>
                    )}
                    <p className="truncate text-xs text-muted">
                      <span className="font-mono">{clinicNoOf(p)}</span> · {p.age} y · {p.sex}
                    </p>
                  </div>
                  <div className="-mr-2 -mt-1 flex items-center gap-1">
                    <span className="flex size-8 items-center justify-center">
                      <Checkbox aria-label={`Select ${p.name}`} checked={isSelected} onCheckedChange={() => onToggle(p.id)} />
                    </span>
                    <RowActions patient={p} onAssign={onAssign} onOpenLocal={onOpenLocal} />
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <OrganGlyph patient={p} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onOpen(p)} className="text-left text-sm leading-snug text-ink-2 hover:text-ink">
                      {p.primaryConcern}
                    </button>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <Path size={14} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{p.local ? "Registered in this session · no programme yet" : (p.program ?? "No programme")}</span>
                    </p>
                  </div>
                </div>
                <AllergyLine allergies={p.allergies} className="mt-1" />

                <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                  <PatientStatusBadge status={p.status} />
                  <FlagPills flags={r.flags.filter((f) => f !== "allergies")} patient={p} showBalance={showBalance} max={3} quietWhenEmpty />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
                <CareTeamStack ids={r.team} onAssign={() => onAssign(p.id)} />
                <NextVisitLine visit={r.next} last={r.last} className="text-right [&_p]:justify-end" />
              </div>
            </article>
          </motion.li>
        );
      })}
    </ul>
  );
}
