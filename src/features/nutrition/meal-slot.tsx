"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowsLeftRight, Briefcase, CaretDown, Check, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring, snappy } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { StatusBadge } from "@/components/ui/status";
import { SUB_REASON_LABEL, foodById, type SlotId } from "./data";
import { grams, kcal, sumItems, type PlanItem } from "./model";
import { DietMark } from "./ui";

/** One meal slot: a recessed group of white item cards — inline editing, alternatives, template review. */

export interface SlotMeta {
  id: SlotId;
  label: string;
  time: string;
  packed: boolean;
}

export function MealSlot({
  slot,
  items,
  editable,
  pendingReview,
  patientFirstName,
  autoEditId,
  onAutoEditDone,
  onAdd,
  onAddAlternative,
  onChange,
  onRemove,
  onMarkReviewed,
}: {
  slot: SlotMeta;
  items: PlanItem[];
  editable: boolean;
  pendingReview: boolean;
  patientFirstName: string;
  autoEditId: string | null;
  onAutoEditDone: () => void;
  onAdd: () => void;
  onAddAlternative: (item: PlanItem) => void;
  onChange: (item: PlanItem) => void;
  onRemove: (item: PlanItem, index: number) => void;
  onMarkReviewed: () => void;
}) {
  const sum = sumItems(items);
  const headingId = `slot-${slot.id}`;
  return (
    <section aria-labelledby={headingId} className="rounded-card bg-sunken p-2">
      <header className="flex flex-wrap items-center gap-3 p-2">
        <span className="flex h-10 min-w-16 items-center justify-center rounded-full bg-surface px-3 text-sm text-ink tabular">{slot.time}</span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-sm font-medium text-ink">{slot.label}</h3>
          <p className="text-xs text-muted tabular">
            {items.length ? `${kcal(sum.kcal)} kcal · ${grams(sum.protein)} protein` : "No items yet"}
          </p>
        </div>
        {slot.packed ? (
          <Pill size="sm" tone="white" icon={<Briefcase aria-hidden="true" />}>Packed</Pill>
        ) : null}
        {pendingReview ? (
          <span className="flex items-center gap-2">
            <StatusBadge tone="warning">Template · review for {patientFirstName}</StatusBadge>
            {editable ? (
              <Button size="sm" variant="dark" leading={<Check />} onClick={onMarkReviewed}>Mark reviewed</Button>
            ) : null}
          </span>
        ) : null}
        {editable ? (
          <IconButton label={`Add item to ${slot.label}`} tooltip="top" onClick={onAdd}>
            <Plus />
          </IconButton>
        ) : null}
      </header>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              layout="position"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
              transition={spring}
            >
              <ItemCard
                item={item}
                editable={editable}
                startEditing={autoEditId === item.id}
                onEditStarted={onAutoEditDone}
                onChange={onChange}
                onRemove={() => onRemove(item, index)}
                onAddAlternative={() => onAddAlternative(item)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 ? (
          <li className="rounded-inner border border-dashed border-line-strong p-4 text-sm text-muted">
            {editable ? "Empty slot — add a food, or leave it out on purpose and note why in the plan." : "Nothing planned for this slot."}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function ItemCard({
  item,
  editable,
  startEditing,
  onEditStarted,
  onChange,
  onRemove,
  onAddAlternative,
}: {
  item: PlanItem;
  editable: boolean;
  startEditing: boolean;
  onEditStarted: () => void;
  onChange: (item: PlanItem) => void;
  onRemove: () => void;
  onAddAlternative: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [altOpen, setAltOpen] = useState(false);
  const food = item.foodId ? foodById(item.foodId) : undefined;
  const needsValues = item.kcal <= 0;

  if (startEditing && !editing) setEditing(true);

  if (editing && editable) {
    return (
      <ItemEditor
        item={item}
        onCancel={() => {
          setEditing(false);
          onEditStarted();
        }}
        onSave={(next) => {
          onChange(next);
          setEditing(false);
          onEditStarted();
        }}
      />
    );
  }

  return (
    <div className="rounded-inner bg-surface p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
        {/* columns: diet mark · name/portion/alternatives · energy · actions (≥sm) */}
        <span className="mt-1">{food ? <DietMark diet={food.diet} /> : <span className="block size-3.5 rounded-[3px] shadow-[inset_0_0_0_1.5px_var(--color-faint)]" title="Custom item" aria-label="Custom item" role="img" />}</span>
        <div className="min-w-0">
          <p className="text-sm text-ink">{item.name}</p>
          <p className="text-xs text-muted">{item.portion}</p>
          {item.note ? <p className="mt-1 text-xs text-ink-2">{item.note}</p> : null}
          {item.alternatives.length ? (
            <button
              type="button"
              onClick={() => setAltOpen((v) => !v)}
              aria-expanded={altOpen}
              className="-ml-2 mt-1 inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-ink-2 transition-colors hover:bg-canvas hover:text-ink"
            >
              <ArrowsLeftRight size={14} aria-hidden="true" />
              {item.alternatives.length} alternative{item.alternatives.length === 1 ? "" : "s"}
              <motion.span animate={{ rotate: altOpen ? 180 : 0 }} transition={snappy} className="inline-flex">
                <CaretDown size={12} aria-hidden="true" />
              </motion.span>
            </button>
          ) : editable ? (
            <button
              type="button"
              onClick={onAddAlternative}
              className="-ml-2 mt-1 inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <Plus size={14} aria-hidden="true" />
              Add alternative
            </button>
          ) : null}
        </div>
        <div className="text-right">
          <p className={cn("text-sm tabular", needsValues ? "text-danger" : "text-ink")}>{needsValues ? "Enter values" : `${kcal(item.kcal)} kcal`}</p>
          <p className="text-xs text-muted tabular">{grams(item.protein)} protein</p>
          {/* phones: actions tuck under the values instead of taking their own row */}
          {editable ? <ItemActions name={item.name} onEdit={() => setEditing(true)} onRemove={onRemove} className="-mr-2 mt-1 justify-end sm:hidden" /> : null}
        </div>
        {editable ? <ItemActions name={item.name} onEdit={() => setEditing(true)} onRemove={onRemove} className="-mr-2 -mt-1 hidden sm:flex" /> : null}
      </div>
      <AnimatePresence initial={false}>
        {altOpen ? (
          <motion.div
            key="alts"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="-mx-2 -mb-2 mt-3 flex flex-col rounded-[8px] bg-canvas p-2">
              {item.alternatives.length === 0 ? <p className="px-2 py-1 text-xs text-muted">No reviewed swaps yet.</p> : null}
              {item.alternatives.map((alt) => (
                <div key={alt.id} className="flex items-start gap-3 border-t border-line p-2 first:border-t-0">
                  <Pill size="sm" tone={alt.reason === "budget" ? "dark" : alt.reason === "preference" ? "primary" : "neutral"}>{SUB_REASON_LABEL[alt.reason]}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{alt.name}</p>
                    <p className="text-xs text-muted">{alt.portion} · <span className="tabular">{kcal(alt.kcal)} kcal · {grams(alt.protein)} protein</span></p>
                    {alt.note ? <p className="mt-1 text-xs text-ink-2">{alt.note}</p> : null}
                  </div>
                  {editable ? (
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label={`Remove alternative ${alt.name}`}
                      onClick={() => onChange({ ...item, alternatives: item.alternatives.filter((a) => a.id !== alt.id) })}
                    >
                      <X />
                    </IconButton>
                  ) : null}
                </div>
              ))}
              {editable ? (
                <Button size="sm" variant="ghost" leading={<Plus />} className="self-start" onClick={onAddAlternative}>
                  Add alternative
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ItemActions({ name, onEdit, onRemove, className }: { name: string; onEdit: () => void; onRemove: () => void; className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <IconButton size="sm" variant="ghost" label={`Edit ${name}`} tooltip="top" onClick={onEdit}>
        <PencilSimple />
      </IconButton>
      <IconButton size="sm" variant="ghost" label={`Remove ${name}`} tooltip="top" onClick={onRemove}>
        <Trash />
      </IconButton>
    </div>
  );
}

function ItemEditor({ item, onCancel, onSave }: { item: PlanItem; onCancel: () => void; onSave: (item: PlanItem) => void }) {
  const [name, setName] = useState(item.name);
  const [portion, setPortion] = useState(item.portion);
  const [energy, setEnergy] = useState(item.kcal ? String(item.kcal) : "");
  const [protein, setProtein] = useState(String(item.protein));
  const [note, setNote] = useState(item.note);
  const [tried, setTried] = useState(false);

  const kcalNum = Number(energy);
  const proteinNum = Number(protein);
  const errors = {
    name: name.trim() ? null : "Name the food",
    portion: portion.trim() ? null : "Give a household portion, e.g. 1 katori",
    kcal: energy.trim() === "" || !Number.isFinite(kcalNum) || kcalNum <= 0 || kcalNum > 2500 ? "1–2,500 kcal" : null,
    protein: protein.trim() === "" || !Number.isFinite(proteinNum) || proteinNum < 0 || proteinNum > 200 ? "0–200 g" : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = () => {
    setTried(true);
    if (invalid) return;
    const scale = item.kcal > 0 ? kcalNum / item.kcal : 1;
    onSave({ ...item, name: name.trim(), portion: portion.trim(), kcal: Math.round(kcalNum), protein: Math.round(proteinNum * 10) / 10, fibre: Math.round(item.fibre * scale * 10) / 10, note: note.trim() });
  };

  return (
    <form
      className="rounded-inner bg-surface p-4 shadow-[inset_0_0_0_2px_var(--color-charcoal)]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Food" error={tried ? errors.name : null}>
          {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
        </Field>
        <Field label="Household portion" error={tried ? errors.portion : null}>
          {(a) => <Input {...a} value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="2 idli + 1 katori sambar" />}
        </Field>
        <Field label="Energy (kcal)" error={tried ? errors.kcal : null}>
          {(a) => <Input {...a} inputMode="numeric" value={energy} onChange={(e) => setEnergy(e.target.value.replace(/[^\d.]/g, ""))} className="tabular" />}
        </Field>
        <Field label="Protein (g)" error={tried ? errors.protein : null}>
          {(a) => <Input {...a} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^\d.]/g, ""))} className="tabular" />}
        </Field>
        <Field label="Practical note" optional className="sm:col-span-2">
          {(a) => <Input {...a} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pack in a steel tiffin on office days" />}
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" variant="dark" leading={<Check />}>Done</Button>
      </div>
    </form>
  );
}
