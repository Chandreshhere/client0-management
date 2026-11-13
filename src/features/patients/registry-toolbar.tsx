"use client";

import { ArrowsDownUp, CaretDown, Rows, SidebarSimple, SquaresFour, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LockBadge } from "@/components/shell/plan-switcher";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { SORT_LABEL, type Filters, type Scope, type SortKey } from "./data";

export type RegistryView = "table" | "cards" | "browse";
export type FacetOption = { value: string; label: string; count?: number; group?: string; description?: string };
export type FacetKey = keyof Filters;
export type Facet = { key: FacetKey; label: string; options: FacetOption[]; locked?: string };

const trigger =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const triggerIdle = "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--color-line-strong)]";
const triggerActive = "bg-charcoal text-white hover:bg-ink-2";

/** Checkbox filter menu: stays open while toggling; shows the selection count on the trigger. */
function FacetMenu({ facet, selected, onChange }: { facet: Facet; selected: string[]; onChange: (values: string[]) => void }) {
  if (facet.locked) {
    return (
      <Tip label={facet.locked}>
        <span tabIndex={0} className={cn(trigger, "cursor-not-allowed bg-surface text-faint shadow-[inset_0_0_0_1px_var(--color-line)]")} aria-disabled="true">
          {facet.label}
          <LockBadge />
          <span className="sr-only"> — {facet.locked}</span>
        </span>
      </Tip>
    );
  }
  const groups = [...new Set(facet.options.map((o) => o.group ?? ""))];
  const toggle = (value: string, on: boolean) => onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button type="button" className={cn(trigger, selected.length ? triggerActive : triggerIdle)}>
          {facet.label}
          {selected.length ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[11px] leading-5 tabular">{selected.length}</span>
          ) : (
            <CaretDown size={14} className="text-muted" aria-hidden="true" />
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" data-lenis-prevent className="scrollbar-thin max-h-[min(440px,var(--radix-dropdown-menu-content-available-height))] w-[272px] overflow-auto">
        {groups.map((g, gi) => (
          <div key={g || gi}>
            {gi > 0 ? <DropdownSeparator /> : null}
            {g.trim() ? <DropdownLabel>{g}</DropdownLabel> : null}
            {facet.options
              .filter((o) => (o.group ?? "") === g)
              .map((o) => (
                <DropdownCheckboxItem
                  key={o.value}
                  checked={selected.includes(o.value)}
                  onCheckedChange={(v) => toggle(o.value, v === true)}
                  onSelect={(e) => e.preventDefault()}
                  className={o.description ? "h-auto py-2" : undefined}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.description ? <span className="block truncate text-xs text-muted">{o.description}</span> : null}
                    </span>
                    {typeof o.count === "number" ? <span className="text-xs text-muted tabular">{o.count}</span> : null}
                  </span>
                </DropdownCheckboxItem>
              ))}
          </div>
        ))}
        {selected.length ? (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onChange([])} icon={<X />}>
              Clear {facet.label.toLowerCase()}
            </DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}

function SortMenu({ sort, onSort }: { sort: SortKey; onSort: (s: SortKey) => void }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button type="button" className={cn(trigger, triggerIdle)} aria-label={`Sort by ${SORT_LABEL[sort]}`}>
          <ArrowsDownUp size={18} aria-hidden="true" />
          <span className="text-muted">Sort</span>
          {SORT_LABEL[sort]}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-[248px]">
        <DropdownLabel>Sort patients by</DropdownLabel>
        <DropdownRadioGroup value={sort} onValueChange={(v) => onSort(v as SortKey)}>
          <DropdownRadioItem value="name" description="A to Z">Name</DropdownRadioItem>
          <DropdownRadioItem value="next" description="In the clinic now, then soonest">Next appointment</DropdownRadioItem>
          <DropdownRadioItem value="last" description="Most recent first">Last visit</DropdownRadioItem>
          <DropdownRadioItem value="status" description="Needs attention first">Status</DropdownRadioItem>
        </DropdownRadioGroup>
      </DropdownContent>
    </Dropdown>
  );
}

export function RegistryToolbar({
  scope,
  onScope,
  scopes,
  view,
  onView,
  query,
  onQuery,
  facets,
  filters,
  onFilter,
  sort,
  onSort,
}: {
  scope: Scope;
  onScope: (s: Scope) => void;
  scopes: { value: Scope; label: string; count: number }[];
  view: RegistryView;
  onView: (v: RegistryView) => void;
  query: string;
  onQuery: (q: string) => void;
  facets: Facet[];
  filters: Filters;
  onFilter: (key: FacetKey, values: string[]) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="scrollbar-none -mx-4 -my-1 min-w-0 overflow-x-auto px-4 py-1 lg:-mx-0 lg:px-0">
          <Segmented items={scopes} value={scope} onChange={onScope} ariaLabel="Saved views" />
        </div>
        <Segmented
          variant="tray"
          size="sm"
          ariaLabel="Layout"
          value={view}
          onChange={onView}
          className="hidden shrink-0 @[880px]:flex"
          items={[
            { value: "table", label: "Table", icon: <Rows /> },
            { value: "cards", label: "Cards", icon: <SquaresFour /> },
            { value: "browse", label: "Browse", icon: <SidebarSimple /> },
          ]}
        />
        {/* Narrow screens have no table: cards or browse. */}
        <Segmented
          variant="tray"
          size="sm"
          ariaLabel="Layout"
          value={view === "browse" ? "browse" : "cards"}
          onChange={onView}
          className="shrink-0 @[880px]:hidden"
          items={[
            { value: "cards", label: <span className="sr-only">Cards</span>, icon: <SquaresFour aria-hidden="true" /> },
            { value: "browse", label: <span className="sr-only">Browse</span>, icon: <SidebarSimple aria-hidden="true" /> },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 @[880px]:flex-row @[880px]:items-center">
        <SearchInput
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Name, clinic number or concern"
          aria-label="Search patients by name, clinic number or concern"
          className="w-full shrink-0 @[880px]:w-[300px]"
        />
        <div className="scrollbar-none -mx-4 -my-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0">
          {facets.map((f) => (
            <FacetMenu key={f.key} facet={f} selected={filters[f.key] as string[]} onChange={(v) => onFilter(f.key, v)} />
          ))}
          <div className="ml-auto pl-2">
            <SortMenu sort={sort} onSort={onSort} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Removable chips for every active filter value, plus "Clear all". */
export function ActiveFilters({ chips, onRemove, onClear, children }: { chips: { key: FacetKey; value: string; label: string }[]; onRemove: (key: FacetKey, value: string) => void; onClear: () => void; children?: ReactNode }) {
  if (!chips.length && !children) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {chips.map((c) => (
        <button
          key={`${c.key}:${c.value}`}
          type="button"
          onClick={() => onRemove(c.key, c.value)}
          aria-label={`Remove filter ${c.label}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface pl-3 pr-2 text-xs text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,color] duration-200 hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
        >
          {c.label}
          <X size={14} aria-hidden="true" className="text-muted" />
        </button>
      ))}
      {chips.length ? (
        <button type="button" onClick={onClear} className="h-8 rounded-full px-3 text-xs text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
          Clear all
        </button>
      ) : null}
    </div>
  );
}
