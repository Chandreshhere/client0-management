"use client";

import { CaretDown, CaretLeft, CaretRight, Door, LockSimple, Stethoscope } from "@phosphor-icons/react";
import type { Staff } from "@/data/types";
import { BRANCHES } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Tip } from "@/components/ui/tooltip";
import { DisciplineDot } from "./ui";

export function DateNav({ onStep, onToday, isToday, unit }: { onStep: (n: -1 | 1) => void; onToday: () => void; isToday: boolean; unit: "day" | "week" }) {
  return (
    <div className="flex items-center gap-1">
      <Tip label={`Previous ${unit}`} shortcut="←">
        <IconButton label={`Previous ${unit}`} onClick={() => onStep(-1)}>
          <CaretLeft />
        </IconButton>
      </Tip>
      <Tip label="Jump to today" shortcut="T">
        <Button variant={isToday ? "soft" : "secondary"} onClick={onToday} aria-pressed={isToday}>
          Today
        </Button>
      </Tip>
      <Tip label={`Next ${unit}`} shortcut="→">
        <IconButton label={`Next ${unit}`} onClick={() => onStep(1)}>
          <CaretRight />
        </IconButton>
      </Tip>
    </div>
  );
}

const triggerClass =
  "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-surface px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,background-color] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=open]:shadow-[inset_0_0_0_1.5px_var(--color-charcoal)] [&_svg]:size-4";

/** Practitioner filter: checkbox list with avatars; staff outside the plan are shown locked. */
export function PractitionerFilter({
  all,
  allowedIds,
  selected,
  onChange,
  selfId,
  hideEmpty,
  onHideEmpty,
}: {
  all: Staff[];
  allowedIds: string[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  selfId?: string;
  hideEmpty: boolean;
  onHideEmpty: (v: boolean) => void;
}) {
  const allowed = all.filter((s) => allowedIds.includes(s.id));
  const chosen = selected === null ? allowed : allowed.filter((s) => selected.includes(s.id));
  const isAll = selected === null || chosen.length === allowed.length;
  const label = isAll ? "All practitioners" : chosen.length === 1 ? chosen[0].name : `${chosen.length} practitioners`;

  const toggle = (id: string, on: boolean) => {
    const base = selected === null ? allowed.map((s) => s.id) : selected;
    const next = on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
    onChange(next.length === allowed.length ? null : next);
  };

  return (
    <Dropdown>
      <DropdownTrigger className={triggerClass} aria-label={`Practitioners: ${label}`}>
        {chosen.length ? <AvatarStack people={chosen.map((s) => ({ name: s.name, avatar: s.avatar }))} max={3} size="xs" /> : <Stethoscope aria-hidden="true" />}
        <span className="max-w-[160px] truncate">{label}</span>
        <CaretDown className="text-muted" aria-hidden="true" />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[300px]">
        <DropdownLabel>Show diaries for</DropdownLabel>
        <DropdownItem onSelect={() => onChange(null)}>Everyone</DropdownItem>
        {selfId && allowedIds.includes(selfId) ? <DropdownItem onSelect={() => onChange([selfId])}>Only me</DropdownItem> : null}
        <DropdownSeparator />
        <div className="max-h-[320px] overflow-y-auto overscroll-contain">
          {all.map((s) => {
            const locked = !allowedIds.includes(s.id);
            const on = !locked && (selected === null || selected.includes(s.id));
            return (
              <DropdownCheckboxItem
                key={s.id}
                checked={on}
                disabled={locked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(v) => toggle(s.id, v === true)}
                className="h-12"
              >
                <span className="flex items-center gap-2">
                  <Avatar src={s.avatar} name={s.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {s.name}
                      {s.id === selfId ? <span className="text-muted"> · you</span> : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      {locked ? (
                        <>
                          <LockSimple aria-hidden="true" className="!size-3" />
                          Team plan
                        </>
                      ) : (
                        <>
                          <DisciplineDot discipline={s.discipline} />
                          {DISCIPLINE_LABEL[s.discipline]} · {s.room}
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </DropdownCheckboxItem>
            );
          })}
        </div>
        <DropdownSeparator />
        <DropdownCheckboxItem checked={hideEmpty} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => onHideEmpty(v === true)}>
          Hide diaries with no bookings
        </DropdownCheckboxItem>
      </DropdownContent>
    </Dropdown>
  );
}

export function RoomFilter({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const all = BRANCHES.flatMap((b) => b.rooms);
  const label = selected.length === 0 ? "All rooms" : selected.length === 1 ? selected[0] : `${selected.length} rooms`;
  return (
    <Dropdown>
      <DropdownTrigger className={triggerClass} aria-label={`Rooms: ${label}`}>
        <Door aria-hidden="true" />
        <span className="max-w-[140px] truncate">{label}</span>
        <CaretDown className="text-muted" aria-hidden="true" />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[260px]">
        <div className="max-h-[360px] overflow-y-auto overscroll-contain">
          {BRANCHES.map((b, i) => (
            <div key={b.id}>
              {i > 0 ? <DropdownSeparator /> : null}
              <DropdownLabel>{b.name}</DropdownLabel>
              {b.rooms.map((r) => (
                <DropdownCheckboxItem
                  key={r}
                  checked={selected.length === 0 || selected.includes(r)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => {
                    const base = selected.length === 0 ? all : selected;
                    const next = v ? [...new Set([...base, r])] : base.filter((x) => x !== r);
                    onChange(next.length === all.length ? [] : next);
                  }}
                >
                  {r}
                </DropdownCheckboxItem>
              ))}
            </div>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={() => onChange([])}>Show all rooms</DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

