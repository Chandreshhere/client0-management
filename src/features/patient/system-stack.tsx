"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUpRight, Files, Plus } from "@phosphor-icons/react";
import type { BodySystem, BodySystemId } from "@/data/featured";
import type { Patient } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { useRecord } from "./record-context";
import { cn } from "@/lib/cn";
import { spring, snappy } from "@/lib/motion";
import { Tip } from "@/components/ui/tooltip";
import { useAnchor } from "./connectors";
import { OrganCanvas } from "./organ-canvas";
import { EVENT_ICON } from "./event-meta";
import { formatDate } from "@/lib/format";

/**
 * Centre column of the reference: page title, focal cobalt system card with the 3D organ,
 * a dark glass card for the featured condition, and the other body systems as recessed
 * grey cards with their condition chips. Clicking a grey card promotes it to the focal slot.
 */
export function SystemStack({
  active,
  onActivate,
  onOpenCondition,
  onAddEvent,
  onOpenRecords,
  hoveredCondition,
  onHoverCondition,
  patient,
  onOpenEvent,
}: {
  active: BodySystemId;
  onActivate: (id: BodySystemId) => void;
  onOpenCondition: (conditionId: string) => void;
  onAddEvent: (systemId: BodySystemId) => void;
  onOpenRecords: (systemId: BodySystemId) => void;
  hoveredCondition: string | null;
  onHoverCondition: (id: string | null) => void;
  patient: Patient;
  onOpenEvent?: (eventId: string) => void;
}) {
  const { record, systemById, conditionById } = useRecord();
  const sys = systemById(active);
  const others = record.systems.filter((s) => s.id !== sys.id);
  const featured = conditionById(sys.featuredConditionId)!;
  const secondary = sys.conditionIds.filter((c) => c !== sys.featuredConditionId).map((id) => conditionById(id)!).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="max-w-[9ch] text-[40px] font-light leading-[1.02] tracking-[-0.03em] text-ink xl:text-[44px]">
        Overview Patient Health
        <span className="sr-only"> — {patient.name}</span>
      </h1>
      {/* Small screens: identity right under the title (the summary column comes later). */}
      <div className="-mt-2 flex items-center gap-3 @[760px]:hidden" aria-hidden="true">
        <Avatar src={patient.avatar} name={patient.name} size="sm" />
        <span className="text-sm text-ink">{patient.name}</span>
        <span className="text-sm text-muted">{patient.age} years</span>
      </div>

      {/* Focal slot: the card stays put; its content crossfades and the organ morphs. */}
      <div className="relative h-[284px]">
        <div className="absolute inset-y-0 left-0 w-[64%] overflow-hidden rounded-card bg-primary text-white">
          <div className="absolute left-4 top-4 z-[3]">
            <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">
              {sys.conditionIds.length} {sys.conditionIds.length === 1 ? "condition" : "conditions"}
            </span>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h2
              key={sys.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={spring}
              // wraps before the glass condition card (which starts at 50% of the stack = 78% of this card)
              className={cn("absolute left-4 top-[64px] z-[3] max-w-[min(168px,calc(78%-24px))] font-normal leading-[1.1] tracking-[-0.015em]", sys.name.length > 12 ? "text-[21px]" : "text-title")}
            >
              {sys.name}
            </motion.h2>
          </AnimatePresence>
          <div className="absolute bottom-4 left-4 z-[3] flex gap-2">
            <Tip label={`Add ${sys.name.toLowerCase()} event`}>
              <button type="button" aria-label={`Add event to ${sys.name}`} onClick={() => onAddEvent(sys.id)} className="flex size-10 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95">
                <Plus size={18} />
              </button>
            </Tip>
            <Tip label="Records for this system">
              <button type="button" aria-label={`Open ${sys.name} records`} onClick={() => onOpenRecords(sys.id)} className="flex size-10 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95">
                <Files size={18} />
              </button>
            </Tip>
          </div>
        </div>
        {/* Organ: outside the clipped card so it can overflow under the glass card, like the reference. */}
        <OrganCanvas shape={sys.organ} label={`3D illustration of the ${sys.organ} — ${sys.name} system`} className="pointer-events-none absolute left-[9%] top-[54px] z-[2] h-[236px] w-[236px] drop-shadow-[0_18px_24px_rgb(0_0_0/0.28)]" />

        <FeaturedCondition key={featured.id} conditionId={featured.id} onOpen={onOpenCondition} hovered={hoveredCondition === featured.id} onHover={onHoverCondition} />

        <div className="absolute left-[54%] top-[244px] z-[3] flex flex-col items-start gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {secondary.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={spring}>
                <ConditionChip id={c.id} name={c.name} tone="white" onOpen={onOpenCondition} hovered={hoveredCondition === c.id} onHover={onHoverCondition} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {others.length ? (
        <LayoutGroup id="systems">
          {/* 16px below the focal card, like the gap between system cards; more only when the
              secondary condition chips hang below the card (each chip ≈ 40px from top 244px). */}
          <div className="flex flex-col gap-4" style={{ marginTop: Math.max(0, secondary.length * 40 - 48) - 8 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {others.map((s) => (
                <SystemRow key={s.id} system={s} onActivate={onActivate} onOpenCondition={onOpenCondition} onAddEvent={onAddEvent} onOpenRecords={onOpenRecords} hoveredCondition={hoveredCondition} onHoverCondition={onHoverCondition} />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      ) : (
        <SingleSystemFill system={sys} patient={patient} onOpenEvent={onOpenEvent} gap={Math.max(0, secondary.length * 40 - 48) - 8} />
      )}
    </div>
  );
}

function FeaturedCondition({ conditionId, onOpen, hovered, onHover }: { conditionId: string; onOpen: (id: string) => void; hovered: boolean; onHover: (id: string | null) => void }) {
  const { conditionById } = useRecord();
  const c = conditionById(conditionId)!;
  const ref = useAnchor(`cond:${c.id}`);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: 16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={spring}
      onPointerEnter={() => onHover(c.id)}
      onPointerLeave={() => onHover(null)}
      className={cn("glass-dark absolute left-[50%] top-[22px] z-[4] flex h-[208px] w-[46%] min-w-[168px] max-w-[196px] flex-col rounded-card p-4 text-white transition-shadow", hovered && "outline-2 outline-offset-2 outline-white/50")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="pt-1 text-xs text-white/70">{c.status}</span>
        <button type="button" onClick={() => onOpen(c.id)} aria-label={`Open ${c.name}`} className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95">
          <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="mt-2 text-lg leading-[1.15] tracking-[-0.01em]">{c.name}</p>
      <p className="mt-1 text-xs text-white/60">{c.markers} linked {c.markers === 1 ? "record" : "records"}</p>
      <div className="mt-auto flex justify-end">
        <button type="button" onClick={() => onOpen(c.id)} aria-label={`Add note to ${c.name}`} className="flex size-9 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 active:scale-95">
          <Plus size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function ConditionChip({ id, name, tone, onOpen, hovered, onHover }: { id: string; name: string; tone: "white" | "light"; onOpen: (id: string) => void; hovered: boolean; onHover: (id: string | null) => void }) {
  const ref = useAnchor(`cond:${id}`);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(id)}
      onPointerEnter={() => onHover(id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      className={cn(
        "inline-flex h-9 max-w-full items-center rounded-full px-4 text-xs transition-[background-color,box-shadow,color] duration-200",
        tone === "white" ? "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-surface/60 text-ink-2",
        hovered ? "bg-charcoal text-white shadow-none" : "hover:bg-surface hover:text-ink",
      )}
    >
      <span className="truncate">{name}</span>
    </button>
  );
}

function SystemRow({
  system,
  onActivate,
  onOpenCondition,
  onAddEvent,
  onOpenRecords,
  hoveredCondition,
  onHoverCondition,
}: {
  system: BodySystem;
  onActivate: (id: BodySystemId) => void;
  onOpenCondition: (id: string) => void;
  onAddEvent: (id: BodySystemId) => void;
  onOpenRecords: (id: BodySystemId) => void;
  hoveredCondition: string | null;
  onHoverCondition: (id: string | null) => void;
}) {
  const { record } = useRecord();
  const conditions = record.conditions.filter((c) => c.systemId === system.id);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={spring}
      className="flex items-center gap-4"
    >
      <div className="relative h-[176px] w-[56%] max-w-[216px] shrink-0 rounded-card bg-sunken">
        <button
          type="button"
          onClick={() => onActivate(system.id)}
          className="absolute inset-0 rounded-card transition-colors hover:bg-sunken-2 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`Focus ${system.name} system`}
        />
        <span className="pointer-events-none absolute left-4 top-4 inline-flex h-8 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
          {conditions.length} {conditions.length === 1 ? "condition" : "conditions"}
        </span>
        <motion.h3 layout="position" transition={snappy} className="pointer-events-none absolute left-4 top-[60px] text-[22px] font-normal tracking-[-0.015em] text-ink">
          {system.name}
        </motion.h3>
        <div className="absolute bottom-4 left-4 flex gap-2">
          <Tip label={`Add ${system.name.toLowerCase()} event`}>
            <button type="button" aria-label={`Add event to ${system.name}`} onClick={() => onAddEvent(system.id)} className="flex size-10 items-center justify-center rounded-full bg-surface text-ink transition-transform hover:scale-105 active:scale-95">
              <Plus size={18} />
            </button>
          </Tip>
          <Tip label="Records for this system">
            <button type="button" aria-label={`Open ${system.name} records`} onClick={() => onOpenRecords(system.id)} className="flex size-10 items-center justify-center rounded-full bg-surface text-ink transition-transform hover:scale-105 active:scale-95">
              <Files size={18} />
            </button>
          </Tip>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {conditions.map((c) => (
          <ConditionChip key={c.id} id={c.id} name={c.name} tone="light" onOpen={onOpenCondition} hovered={hoveredCondition === c.id} onHover={onHoverCondition} />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * A patient with one body system has no other system cards: instead of an empty column, show
 * what was recorded most recently for this system (each row opens the event) and say plainly
 * that nothing else is on record.
 */
function SingleSystemFill({ system, patient, onOpenEvent, gap }: { system: BodySystem; patient: Patient; onOpenEvent?: (eventId: string) => void; gap: number }) {
  const { record } = useRecord();
  const today = "2026-11-13";
  const recent = record.events
    .filter((e) => e.systemId === system.id && e.state !== "scheduled" && e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return (
    <div className="flex flex-col gap-4" style={{ marginTop: gap }}>
      {recent.length ? (
        <section aria-label={`Latest in ${system.name}`} className="rounded-card bg-sunken p-2">
          <p className="px-2 pb-2 pt-1 text-xs text-muted">Latest in {system.name}</p>
          <ul className="flex flex-col gap-1">
            {recent.map((e) => {
              const Icon = EVENT_ICON[e.type];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onOpenEvent?.(e.id)}
                    className="flex w-full items-center gap-3 rounded-inner bg-surface p-3 text-left transition-colors hover:bg-canvas"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{e.title}</span>
                      <span className="block truncate text-xs text-muted">{formatDate(e.date, { day: "numeric", month: "short" })}{e.source ? ` · ${e.source}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <p className="rounded-card px-4 py-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
        No other body systems on record for {patient.name.split(" ")[0]}. A condition recorded against another system gets its own card here.
      </p>
    </div>
  );
}
