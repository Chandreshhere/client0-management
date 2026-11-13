"use client";

import { motion } from "motion/react";
import { CaretRight } from "@phosphor-icons/react";
import type { Staff } from "@/data/types";
import { BRANCHES } from "@/data/staff";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status";
import { DisciplineTag, ROLE_LABEL, TableCard } from "@/features/settings/ui";
import { DayTrack, DayTrackScale } from "@/features/settings/viz";
import { NOW_MIN } from "@/features/settings/time";
import { breaksToday, careTeamOf, durationText, hoursToday, isClinician, spanText, todayBlocks, todayLoad, weekLoad, type NowState, type StaffRole } from "./data";

export type DirectoryRow = {
  s: Staff;
  now: NowState;
  deactivated: boolean;
  roleRequest: { role: StaffRole; pending: boolean } | null;
};

const branchName = (id: Staff["branch"]) => BRANCHES.find((b) => b.id === id)?.name ?? id;

function trackLabel(s: Staff) {
  const h = hoursToday(s);
  if (!h) return `${s.name}: not working today`;
  const load = todayLoad(s.id);
  return `${s.name} works ${spanText(h)} today${isClinician(s) ? ` with ${pluralize(load.count, "appointment")} (${durationText(load.minutes)} booked)` : ""}`;
}

function TodayStrip({ s, compact }: { s: Staff; compact?: boolean }) {
  const h = hoursToday(s);
  if (!h) return <p className="text-xs text-muted">{s.workingHours}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <DayTrack window={h} blocks={todayBlocks(s.id)} breaks={breaksToday(s)} now={NOW_MIN} label={trackLabel(s)} height={compact ? "h-2.5" : "h-3"} />
      {compact ? null : <DayTrackScale />}
    </div>
  );
}

function loadText(s: Staff) {
  if (!isClinician(s)) return s.role === "frontdesk" ? "Front desk · no diary" : s.role === "coordinator" ? "Coordination · no diary" : "Administration · no diary";
  const l = todayLoad(s.id);
  return l.count ? `${pluralize(l.count, "appointment")} · ${durationText(l.minutes)}` : "Nothing booked";
}

export function StaffCards({ rows, onOpen }: { rows: DirectoryRow[]; onOpen: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ s, now, deactivated, roleRequest }) => {
        const team = careTeamOf(s.id).length;
        return (
          <motion.li key={s.id} layout transition={spring}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className={cn(
                "flex h-full w-full flex-col gap-2 rounded-card bg-surface p-2 text-left transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                deactivated && "opacity-60",
              )}
              aria-label={`${s.name}, ${s.title}. ${now.label}. Open profile`}
            >
              <span className="flex items-start gap-3 p-2">
                <Avatar src={s.avatar} name={s.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{s.name}</span>
                  <span className="block truncate text-xs text-muted">{s.title}</span>
                </span>
                <StatusBadge tone={now.tone}>{now.label}</StatusBadge>
              </span>
              <span className="flex flex-col gap-2 rounded-inner bg-sunken p-3">
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-ink-2">Today · {spanText(hoursToday(s))}</span>
                  <span className="truncate text-muted">{loadText(s)}</span>
                </span>
                <TodayStrip s={s} />
              </span>
              <span className="flex items-center justify-between gap-2 px-2 pb-1 text-xs text-muted">
                <span className="flex min-w-0 items-center gap-3">
                  <DisciplineTag discipline={s.discipline} label={ROLE_LABEL(s.role)} className="shrink-0 whitespace-nowrap" />
                  <span className="truncate">
                    {branchName(s.branch)}
                    {s.room ? ` · ${s.room}` : ""}
                  </span>
                </span>
                <span className="shrink-0">{team ? `${team} in care team` : ""}</span>
              </span>
              {roleRequest ? (
                <span className="mx-2 mb-1 rounded-[10px] bg-warning-soft px-3 py-1.5 text-xs text-warning">
                  {roleRequest.pending ? `Change to ${ROLE_LABEL(roleRequest.role)} awaits the clinical lead` : `Role changed to ${ROLE_LABEL(roleRequest.role)} in this session`}
                </span>
              ) : null}
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function StaffTable({ rows, onOpen }: { rows: DirectoryRow[]; onOpen: (id: string) => void }) {
  return (
    <TableCard minWidth={1040}>
      <table className="w-full text-sm">
        <caption className="sr-only">Staff directory</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-4 pl-6 pr-2 font-normal">Name</th>
            <th scope="col" className="px-2 py-4 font-normal">Role</th>
            <th scope="col" className="px-2 py-4 font-normal">Branch · room</th>
            <th scope="col" className="px-2 py-4 font-normal">Now</th>
            <th scope="col" className="w-[220px] px-2 py-4 font-normal">Today (07–20)</th>
            <th scope="col" className="px-2 py-4 text-right font-normal">Today</th>
            <th scope="col" className="px-2 py-4 text-right font-normal">This week</th>
            <th scope="col" className="py-4 pl-2 pr-6 text-right font-normal">Care team</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, now, deactivated }) => {
            const clin = isClinician(s);
            const l = todayLoad(s.id);
            const wk = weekLoad(s.id).reduce((sum, d) => sum + d.attended + d.booked + d.noShow, 0);
            return (
              <tr key={s.id} onClick={() => onOpen(s.id)} className={cn("cursor-pointer border-t border-line align-middle transition-colors hover:bg-canvas/70", deactivated && "opacity-60")}>
                <td className="py-3 pl-6 pr-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(s.id); }} className="flex items-center gap-3 text-left" aria-label={`Open ${s.name}`}>
                    <Avatar src={s.avatar} name={s.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-muted">{s.title}</span>
                    </span>
                  </button>
                </td>
                <td className="px-2 py-3"><DisciplineTag discipline={s.discipline} label={ROLE_LABEL(s.role)} /></td>
                <td className="px-2 py-3 text-ink-2">{branchName(s.branch)}{s.room ? ` · ${s.room}` : ""}</td>
                <td className="px-2 py-3"><StatusBadge tone={now.tone}>{now.label}</StatusBadge></td>
                <td className="px-2 py-3"><TodayStrip s={s} compact /></td>
                <td className="px-2 py-3 text-right tabular">{clin ? <span className="text-ink">{l.count}<span className="ml-1 text-xs text-muted">· {durationText(l.minutes)}</span></span> : <span className="text-xs text-muted">No diary</span>}</td>
                <td className="px-2 py-3 text-right text-ink tabular">{clin ? wk : "—"}</td>
                <td className="py-3 pl-2 pr-6 text-right text-ink-2 tabular">
                  <span className="inline-flex items-center gap-2">{careTeamOf(s.id).length || "—"}<CaretRight size={14} className="text-faint" aria-hidden="true" /></span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
