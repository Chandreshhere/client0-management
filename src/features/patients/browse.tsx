"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowCounterClockwise, X } from "@phosphor-icons/react";
import type { Appointment } from "@/data/types";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SORT_LABEL, type Row, type SortKey } from "./data";
import { ConditionChip } from "./organ-glyph";
import { BrowsePreview } from "./browse-preview";

/**
 * "Browse" layout of the registry (reference 2): a dark patient list on the left — avatar,
 * name, sex · age, the primary-condition chip with its organ, and × to take someone out of this
 * list — and a preview of the selected patient built from their own record on the right.
 * Arrow keys move through the list. Below 880px the list becomes a horizontal strip above the
 * preview.
 */
export function RegistryBrowse({
  rows,
  sort,
  sessionVisits,
  highlight,
  showBalance,
  onAssign,
  onOpenLocal,
}: {
  rows: Row[];
  sort: SortKey;
  sessionVisits: Appointment[];
  highlight: string | null;
  showBalance: boolean;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const visible = useMemo(() => rows.filter((r) => !hidden.has(r.patient.id)), [rows, hidden]);
  const hiddenHere = rows.length - visible.length;
  const selected = visible.find((r) => r.patient.id === selectedId) ?? visible[0] ?? null;

  // A patient registered from this view becomes the one previewed.
  useEffect(() => {
    if (highlight) setSelectedId(highlight);
  }, [highlight]);

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    const el = buttons.current.get(id);
    if (!el) return;
    if (focus) el.focus();
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const hide = (id: string) => {
    const i = visible.findIndex((r) => r.patient.id === id);
    const next = visible[i + 1] ?? visible[i - 1] ?? null;
    setHidden((h) => new Set(h).add(id));
    if (selected?.patient.id === id && next) {
      setSelectedId(next.patient.id);
      // keep keyboard focus in the list after the row disappears
      requestAnimationFrame(() => buttons.current.get(next.patient.id)?.focus());
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!selected) return;
    const i = visible.findIndex((r) => r.patient.id === selected.patient.id);
    const to = (j: number) => {
      const r = visible[Math.max(0, Math.min(visible.length - 1, j))];
      if (r) select(r.patient.id, true);
    };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") to(i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to(i - 1);
    else if (e.key === "Home") to(0);
    else if (e.key === "End") to(visible.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 @[880px]:grid-cols-[304px_minmax(0,1fr)]">
      <section
        aria-label="Patients in this view"
        className="flex min-w-0 flex-col rounded-card bg-charcoal p-2 text-white @[880px]:sticky @[880px]:top-[104px] @[880px]:max-h-[calc(100dvh-128px)]"
      >
        <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
          <div className="min-w-0">
            <h2 className="text-sm text-white">
              <span className="tabular">{visible.length}</span> {visible.length === 1 ? "patient" : "patients"}
            </h2>
            <p className="truncate text-xs text-white/55">Sorted by {SORT_LABEL[sort].toLowerCase()}</p>
          </div>
          {hiddenHere > 0 ? (
            <button
              type="button"
              onClick={() => setHidden(new Set())}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white/85 transition-colors hover:bg-white/20 hover:text-white"
            >
              <ArrowCounterClockwise size={14} aria-hidden="true" />
              Restore {hiddenHere}
            </button>
          ) : null}
        </div>

        {visible.length ? (
          <LayoutGroup id="registry-browse">
            <ul
              data-lenis-prevent
              onKeyDown={onListKey}
              aria-describedby="browse-keys"
              className="scrollbar-none relative flex min-h-0 snap-x gap-1 overflow-x-auto overscroll-contain @[880px]:scrollbar-thin @[880px]:flex-1 @[880px]:snap-none @[880px]:flex-col @[880px]:overflow-y-auto @[880px]:overflow-x-hidden"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((r) => {
                  const p = r.patient;
                  const on = selected?.patient.id === p.id;
                  return (
                    <motion.li
                      key={p.id}
                      layout="position"
                      transition={spring}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
                      className="group relative w-[264px] shrink-0 snap-start @[880px]:w-auto"
                    >
                      {on ? (
                        <motion.span layoutId="browse-selected" transition={spring} className="absolute inset-0 rounded-inner bg-surface" aria-hidden="true" />
                      ) : (
                        <span className="absolute inset-0 rounded-inner bg-white/[0.06] opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden="true" />
                      )}
                      <div className="relative flex items-start gap-2 p-2">
                        <button
                          ref={(el) => {
                            if (el) buttons.current.set(p.id, el);
                            else buttons.current.delete(p.id);
                          }}
                          type="button"
                          onClick={() => select(p.id)}
                          aria-current={on ? "true" : undefined}
                          aria-controls="browse-preview"
                          tabIndex={on ? 0 : -1}
                          className="flex min-w-0 flex-1 items-start gap-3 rounded-[8px] p-1 text-left"
                        >
                          <span className="relative shrink-0">
                            <Avatar src={p.avatar} name={p.name} size="md" />
                            {p.status === "needs-attention" ? (
                              <span className={cn("absolute -right-0.5 -top-0.5 size-3 rounded-full bg-warning ring-2", on ? "ring-surface" : "ring-charcoal")} aria-hidden="true" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-sm transition-colors duration-200", on ? "text-ink" : "text-white")}>{p.name}</span>
                            <span className={cn("block truncate text-xs transition-colors duration-200", on ? "text-muted" : "text-white/55")}>
                              {p.sex} · {p.age}
                              {p.local ? " · this session" : ""}
                              {p.status === "needs-attention" ? <span className="sr-only"> · needs attention</span> : null}
                            </span>
                            <ConditionChip patient={p} tone={on ? "light" : "dark"} className="mt-2" />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => hide(p.id)}
                          aria-label={`Remove ${p.name} from this view`}
                          tabIndex={on ? 0 : -1}
                          className={cn(
                            "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                            on ? "bg-sunken text-ink-2 hover:bg-sunken-2 hover:text-ink" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
                          )}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        ) : (
          <p className="px-3 pb-4 text-sm text-white/70">Everyone in this view has been removed from the list.</p>
        )}

        <p id="browse-keys" className="px-3 pb-2 pt-3 text-[11px] leading-relaxed text-white/50">
          <span className="mr-1 inline-block size-2 rounded-full bg-warning align-middle" aria-hidden="true" /> needs attention<span className="hidden @[880px]:inline"> · ↑ ↓ move through patients</span> · × removes someone from this list only — their record doesn&apos;t change.
        </p>
      </section>

      <div id="browse-preview" className="relative min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {selected ? (
            <motion.div key={selected.patient.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
              <BrowsePreview row={selected} sessionVisits={sessionVisits} showBalance={showBalance} onAssign={onAssign} onOpenLocal={onOpenLocal} />
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-card bg-surface">
              <EmptyState
                title="No one left to preview"
                description="You removed every patient in this view from the list. Restore them, or change the search and filters."
                action={
                  <Button variant="dark" leading={<ArrowCounterClockwise />} onClick={() => setHidden(new Set())}>
                    Restore {hiddenHere}
                  </Button>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
