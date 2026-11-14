"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { clinicNoOf, type RegistryPatient, type Row } from "./data";
import { AllergyAlert, CareTeamStack, FlagPills, NextVisitLine, PatientStatusBadge } from "./registry-bits";
import { OrganGlyph } from "./organ-glyph";
import { RowActions } from "./row-actions";

const th = "h-11 bg-surface px-3 text-left text-xs font-normal text-muted shadow-[inset_0_-1px_0_var(--color-line)] whitespace-nowrap";
const td = "px-3 py-3 align-middle shadow-[inset_0_-1px_0_var(--color-line)] [tr:last-child>&]:shadow-none";

/** Ignore clicks that land on a control inside the row (links, buttons, checkboxes, menus). */
const fromControl = (e: MouseEvent) => !!(e.target as HTMLElement).closest("a,button,input,label,[role='checkbox'],[role='menuitem'],[tabindex]");

/**
 * Desktop table (shown from an 880px container). Fixed layout sized so the columns fit the content
 * area with the sidebar open (≥960px; narrower containers scroll sideways): Patient is wide enough for
 * full names ("Ananya Srinivasan"), the programme gets its own column from a 1240px container (otherwise
 * it sits under the concern) and flags from 1400px (otherwise they sit under the status). The page is
 * the only vertical scroller — no inner height cap, so no sticky header. Allergy "not recorded" shows
 * as a marker by the name.
 */
export function RegistryTable({
  rows,
  selected,
  onToggle,
  onTogglePage,
  onOpen,
  onAssign,
  onOpenLocal,
  showBalance,
  highlight,
  caption,
}: {
  rows: Row[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onTogglePage: (select: boolean) => void;
  onOpen: (p: RegistryPatient) => void;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
  showBalance: boolean;
  highlight: string | null;
  caption: string;
}) {
  const pageSelected = rows.filter((r) => selected.has(r.patient.id)).length;
  const headerState = pageSelected === 0 ? false : pageSelected === rows.length ? true : "indeterminate";

  return (
    <div className="scrollbar-thin relative overflow-x-auto">
      <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(th, "w-[52px] pl-5 pr-2")}>
              <Checkbox aria-label="Select all patients on this page" checked={headerState} onCheckedChange={(v) => onTogglePage(v === true)} />
            </th>
            <th scope="col" className={cn(th, "w-[224px]")}>Patient</th>
            <th scope="col" className={th}>Primary concern</th>
            <th scope="col" className={cn(th, "w-[128px]")}>Care team</th>
            <th scope="col" className={cn(th, "hidden w-[13%] @[1240px]:table-cell")}>Programme</th>
            <th scope="col" className={cn(th, "w-[184px]")}>
              Status<span className="@[1400px]:hidden"> · flags</span>
            </th>
            <th scope="col" className={cn(th, "w-[144px]")}>Next appointment</th>
            <th scope="col" className={cn(th, "hidden w-[168px] @[1400px]:table-cell")}>Flags</th>
            <th scope="col" className={cn(th, "w-[56px] pr-4")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = r.patient;
            const isSelected = selected.has(p.id);
            return (
              <tr
                key={p.id}
                onClick={(e) => {
                  if (fromControl(e) || window.getSelection()?.toString()) return;
                  onOpen(p);
                }}
                aria-selected={isSelected}
                className={cn(
                  "cursor-pointer transition-colors duration-500",
                  isSelected ? "bg-sunken/60" : highlight === p.id ? "bg-primary-soft" : "hover:bg-canvas",
                )}
              >
                <td className={cn(td, "pl-5 pr-2")}>
                  <Checkbox aria-label={`Select ${p.name}`} checked={isSelected} onCheckedChange={() => onToggle(p.id)} />
                </td>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={p.avatar} name={p.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {p.local ? (
                          <button type="button" onClick={() => onOpenLocal(p.id)} className="truncate text-left font-medium text-ink hover:underline">
                            {p.name}
                          </button>
                        ) : (
                          <Link href={`/patients/${p.id}`} className="truncate font-medium text-ink hover:underline">
                            {p.name}
                          </Link>
                        )}
                        <AllergyAlert allergies={p.allergies} />
                      </div>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">{clinicNoOf(p)}</span> · {p.age} · {p.sex === "Other" ? "Other" : p.sex[0]}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-3">
                    <OrganGlyph patient={p} />
                    <div className="min-w-0">
                      <p className="text-pretty text-ink-2">
                        {p.primaryConcern}
                      </p>
                      <p className="truncate text-xs text-muted @[1240px]:hidden">{p.local ? "Registered in this session" : (p.program ?? "No programme")}</p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <CareTeamStack ids={r.team} onAssign={() => onAssign(p.id)} />
                </td>
                <td className={cn(td, "hidden @[1240px]:table-cell")}>
                  {p.program ? <p className="line-clamp-2 text-ink-2">{p.program}</p> : <span className="text-xs text-muted">None</span>}
                </td>
                <td className={td}>
                  <PatientStatusBadge status={p.status} />
                  {/* below 1400px the flags column folds in here */}
                  <div className="mt-1 empty:hidden @[1400px]:hidden">
                    <FlagPills flags={r.flags.filter((f) => f !== "allergies")} patient={p} showBalance={showBalance} quietWhenEmpty />
                  </div>
                </td>
                <td className={td}>
                  <NextVisitLine visit={r.next} last={r.last} />
                </td>
                <td className={cn(td, "hidden @[1400px]:table-cell")}>
                  <FlagPills flags={r.flags.filter((f) => f !== "allergies")} patient={p} showBalance={showBalance} />
                </td>
                <td className={cn(td, "pr-4 text-right")}>
                  <RowActions patient={p} onAssign={onAssign} onOpenLocal={onOpenLocal} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
