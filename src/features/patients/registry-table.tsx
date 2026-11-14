"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { clinicNoOf, type RegistryLens, type RegistryPatient, type Row } from "./data";
import { AllergyAlert, CONCERN_HEADER, CareTeamStack, ConcernCell, FlagPills, NextVisitLine, PatientStatusBadge, PrimaryDoctor, RegisteredLine } from "./registry-bits";
import { RowActions } from "./row-actions";

const th = "h-11 bg-surface px-3 text-left text-xs font-normal text-muted shadow-[inset_0_-1px_0_var(--color-line)] whitespace-nowrap";
const td = "px-3 py-3 align-middle shadow-[inset_0_-1px_0_var(--color-line)] [tr:last-child>&]:shadow-none";

/** Ignore clicks that land on a control inside the row (links, buttons, checkboxes, menus). */
const fromControl = (e: MouseEvent) => !!(e.target as HTMLElement).closest("a,button,input,label,[role='checkbox'],[role='menuitem'],[tabindex]");

/**
 * Desktop table (shown from an 880px container). Clinical roles see the concern, care team and
 * status; Admin and Reception get the demographic table below. Fixed layout sized so the columns fit
 * the content area with the sidebar open (≥960px; narrower containers scroll sideways). On Pro the
 * programme gets its own column from a 1240px container; flags get theirs from 1400px (otherwise they
 * sit under the status). Allergy "not recorded" shows as a marker by the name. Duplicate review is
 * the admin's, so clinical roles don't see that flag.
 */
export function RegistryTable({
  rows,
  selected,
  onToggle,
  onTogglePage,
  onOpen,
  onAssign,
  onOpenLocal,
  onReview,
  lens,
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
  onReview: (id: string) => void;
  lens: RegistryLens;
  highlight: string | null;
  caption: string;
}) {
  const pageSelected = rows.filter((r) => selected.has(r.patient.id)).length;
  const headerState = pageSelected === 0 ? false : pageSelected === rows.length ? true : "indeterminate";
  const showBalance = lens.showBalance;
  // The coordinator's concern column is the programme already, so it gets no second one.
  const programmeColumn = lens.programmes && lens.concern !== "none";
  if (!lens.clinical) {
    return (
      <DemographicTable
        rows={rows}
        selected={selected}
        onToggle={onToggle}
        onOpen={onOpen}
        onAssign={onAssign}
        onOpenLocal={onOpenLocal}
        onReview={onReview}
        lens={lens}
        highlight={highlight}
        caption={caption}
        headerState={headerState}
        onTogglePage={onTogglePage}
      />
    );
  }

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
            <th scope="col" className={th}>{CONCERN_HEADER[lens.concern]}</th>
            <th scope="col" className={cn(th, "w-[128px]")}>Care team</th>
            {programmeColumn ? <th scope="col" className={cn(th, "hidden w-[13%] @[1240px]:table-cell")}>Programme</th> : null}
            <th scope="col" className={cn(th, "w-[184px]")}>
              Status<span className="@[1400px]:hidden"> · flags</span>
            </th>
            <th scope="col" className={cn(th, "w-[144px]")}>{lens.diary ? "Next appointment" : "Next follow-up"}</th>
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
                        {lens.concern === "diagnosis" ? <AllergyAlert allergies={p.allergies} /> : null}
                      </div>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">{clinicNoOf(p)}</span> · {p.age} · {p.sex === "Other" ? "Other" : p.sex[0]}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <ConcernCell patient={p} lens={lens} programmeBelow={programmeColumn ? "@[1240px]:hidden" : undefined} />
                </td>
                <td className={td}>
                  <CareTeamStack ids={r.team} onAssign={lens.canAssignTeam ? () => onAssign(p.id) : undefined} />
                </td>
                {programmeColumn ? (
                  <td className={cn(td, "hidden @[1240px]:table-cell")}>
                    {p.program ? <p className="line-clamp-2 text-ink-2">{p.program}</p> : <span className="text-xs text-muted">None</span>}
                  </td>
                ) : null}
                <td className={td}>
                  <PatientStatusBadge status={p.status} />
                  {/* below 1400px the flags column folds in here */}
                  <div className="mt-1 empty:hidden @[1400px]:hidden">
                    <FlagPills flags={r.flags.filter((f) => f !== "allergies" && f !== "duplicate")} patient={p} showBalance={showBalance} quietWhenEmpty />
                  </div>
                </td>
                <td className={td}>
                  <NextVisitLine visit={r.next} last={r.last} diary={lens.diary} />
                </td>
                <td className={cn(td, "hidden @[1400px]:table-cell")}>
                  <FlagPills flags={r.flags.filter((f) => f !== "allergies" && f !== "duplicate")} patient={p} showBalance={showBalance} />
                </td>
                <td className={cn(td, "pr-4 text-right")}>
                  <RowActions patient={p} flags={r.flags} lens={lens} onAssign={onAssign} onOpenLocal={onOpenLocal} onReview={onReview} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Admin and Reception: demographics and routing only — clinic ID, age and sex, phone, primary
 * doctor, next appointment (Clinic+) or registration date (Core), and admin flags. No concern,
 * condition, organ or allergy is shown.
 */
function DemographicTable({
  rows,
  selected,
  onToggle,
  onTogglePage,
  onOpen,
  onAssign,
  onOpenLocal,
  onReview,
  lens,
  highlight,
  caption,
  headerState,
}: {
  rows: Row[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onTogglePage: (select: boolean) => void;
  onOpen: (p: RegistryPatient) => void;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
  onReview: (id: string) => void;
  lens: RegistryLens;
  highlight: string | null;
  caption: string;
  headerState: boolean | "indeterminate";
}) {
  return (
    <div className="scrollbar-thin relative overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(th, "w-[52px] pl-5 pr-2")}>
              <Checkbox aria-label="Select all patients on this page" checked={headerState} onCheckedChange={(v) => onTogglePage(v === true)} />
            </th>
            <th scope="col" className={cn(th, "w-[248px]")}>Patient</th>
            <th scope="col" className={cn(th, "w-[168px]")}>Mobile</th>
            <th scope="col" className={th}>Primary doctor</th>
            <th scope="col" className={cn(th, "w-[168px]")}>{lens.diary ? "Next appointment" : "Registered"}</th>
            <th scope="col" className={cn(th, "w-[200px]")}>Flags</th>
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
                className={cn("cursor-pointer transition-colors duration-500", isSelected ? "bg-sunken/60" : highlight === p.id ? "bg-primary-soft" : "hover:bg-canvas")}
              >
                <td className={cn(td, "pl-5 pr-2")}>
                  <Checkbox aria-label={`Select ${p.name}`} checked={isSelected} onCheckedChange={() => onToggle(p.id)} />
                </td>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={p.avatar} name={p.name} size="sm" />
                    <div className="min-w-0">
                      {p.local ? (
                        <button type="button" onClick={() => onOpenLocal(p.id)} className="block max-w-full truncate text-left font-medium text-ink hover:underline">
                          {p.name}
                        </button>
                      ) : (
                        <Link href={`/patients/${p.id}`} className="block truncate font-medium text-ink hover:underline">
                          {p.name}
                        </Link>
                      )}
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">{clinicNoOf(p)}</span> · {p.age} · {p.sex === "Other" ? "Other" : p.sex[0]}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <p className="whitespace-nowrap font-mono text-xs text-ink-2">{p.phone}</p>
                  <p className="truncate text-xs text-muted">{p.area}</p>
                </td>
                <td className={td}>
                  <PrimaryDoctor id={p.careTeam.doctor} onAssign={lens.canAssignTeam ? () => onAssign(p.id) : undefined} />
                </td>
                <td className={td}>{lens.diary ? <NextVisitLine visit={r.next} last={r.last} diary /> : <RegisteredLine patient={p} />}</td>
                <td className={td}>
                  <FlagPills flags={r.flags.filter((f) => f !== "allergies")} patient={p} showBalance={lens.showBalance} onDuplicate={lens.canMerge ? () => onReview(p.id) : undefined} />
                </td>
                <td className={cn(td, "pr-4 text-right")}>
                  <RowActions patient={p} flags={r.flags} lens={lens} onAssign={onAssign} onOpenLocal={onOpenLocal} onReview={onReview} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
