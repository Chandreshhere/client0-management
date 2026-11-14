"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { clinicNoOf, type RegistryLens, type RegistryPatient, type Row } from "./data";
import { AllergyLine, CareTeamStack, ConcernCell, FlagPills, NextVisitLine, PatientStatusBadge, PrimaryDoctor, RegisteredLine } from "./registry-bits";
import { RowActions } from "./row-actions";

/**
 * Card list — the registry on narrow screens, and the "Cards" view on wide ones. Admin and
 * Reception cards carry demographics only (phone, primary doctor, next appointment).
 */
export function RegistryCards({
  rows,
  selected,
  onToggle,
  onOpen,
  onAssign,
  onOpenLocal,
  onReview,
  lens,
  highlight,
  className,
}: {
  rows: Row[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (p: RegistryPatient) => void;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
  onReview: (id: string) => void;
  lens: RegistryLens;
  highlight: string | null;
  className?: string;
}) {
  const showBalance = lens.showBalance;
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
                    <RowActions patient={p} flags={r.flags} lens={lens} onAssign={onAssign} onOpenLocal={onOpenLocal} onReview={onReview} />
                  </div>
                </div>

                {!lens.clinical ? (
                  <>
                    <dl className="mt-4 grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-2 text-xs">
                      <dt className="text-muted">Mobile</dt>
                      <dd className="min-w-0 truncate font-mono text-ink-2">{p.phone}</dd>
                      <dt className="text-muted">Area</dt>
                      <dd className="min-w-0 truncate text-ink-2">{p.area || "—"}</dd>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-4 empty:hidden">
                      <FlagPills
                        flags={r.flags.filter((f) => f !== "allergies")}
                        patient={p}
                        showBalance={showBalance}
                        max={3}
                        quietWhenEmpty
                        onDuplicate={lens.canMerge ? () => onReview(p.id) : undefined}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <ConcernCell patient={p} lens={lens} onOpen={() => onOpen(p)} className="mt-4" />
                    {lens.concern === "diagnosis" ? <AllergyLine allergies={p.allergies} className="mt-1" /> : null}

                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                      <PatientStatusBadge status={p.status} />
                      <FlagPills flags={r.flags.filter((f) => f !== "allergies" && f !== "duplicate")} patient={p} showBalance={showBalance} max={3} quietWhenEmpty />
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
                {lens.clinical ? (
                  <CareTeamStack ids={r.team} onAssign={lens.canAssignTeam ? () => onAssign(p.id) : undefined} />
                ) : (
                  <PrimaryDoctor id={p.careTeam.doctor} onAssign={lens.canAssignTeam ? () => onAssign(p.id) : undefined} />
                )}
                {!lens.clinical && !lens.diary ? (
                  <RegisteredLine patient={p} className="text-right" />
                ) : (
                  <NextVisitLine visit={r.next} last={r.last} diary={lens.diary} className="text-right [&_p]:justify-end" />
                )}
              </div>
            </article>
          </motion.li>
        );
      })}
    </ul>
  );
}
