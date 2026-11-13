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

const th = "sticky top-0 z-[2] h-11 bg-surface px-3 text-left text-xs font-normal text-muted shadow-[inset_0_-1px_0_var(--color-line)] whitespace-nowrap";
const td = "px-3 py-3 align-middle shadow-[inset_0_-1px_0_var(--color-line)] [tr:last-child>&]:shadow-none";

/** Ignore clicks that land on a control inside the row (links, buttons, checkboxes, menus). */
const fromControl = (e: MouseEvent) => !!(e.target as HTMLElement).closest("a,button,input,label,[role='checkbox'],[role='menuitem'],[tabindex]");

/**
 * Desktop table. Fixed layout so the columns fit the content area with the sidebar open
 * (≈1140px); the programme gets its own column only when there is room (≥1240px container),
 * otherwise it sits under the concern. Allergy "not recorded" shows as a marker by the name.
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
    <div data-lenis-prevent className="scrollbar-thin relative max-h-[max(480px,calc(100dvh-208px))] overflow-auto overscroll-contain">
      <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(th, "w-[52px] pl-5 pr-2")}>
              <Checkbox aria-label="Select all patients on this page" checked={headerState} onCheckedChange={(v) => onTogglePage(v === true)} />
            </th>
            <th scope="col" className={th}>Patient</th>
            <th scope="col" className={cn(th, "w-[21%]")}>Primary concern</th>
            <th scope="col" className={cn(th, "w-[124px]")}>Care team</th>
            <th scope="col" className={cn(th, "hidden w-[13%] @[1240px]:table-cell")}>Programme</th>
            <th scope="col" className={cn(th, "w-[164px]")}>Status</th>
            <th scope="col" className={cn(th, "w-[148px]")}>Next appointment</th>
            <th scope="col" className={cn(th, "w-[164px]")}>Flags</th>
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
                      <p className="truncate text-ink-2" title={p.primaryConcern}>
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
                </td>
                <td className={td}>
                  <NextVisitLine visit={r.next} last={r.last} />
                </td>
                <td className={td}>
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
