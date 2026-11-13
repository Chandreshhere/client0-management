"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Prohibit } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/misc";
import { FOODS, SLOT_LABEL, SUB_REASON_LABEL, type Food, type SlotId, type SubReason } from "./data";
import { preferenceConflict } from "./model";
import { DietMark } from "./ui";

/** Searchable Indian food picker: household portions, diet tags, preference conflicts explained. */

export type PickerTarget = { slot: SlotId; mode: "item" } | { slot: SlotId; mode: "alternative"; itemId: string; itemName: string };

type DietFilter = "all" | "veg" | "jain" | "egg" | "nonveg";

const COST = ["", "₹", "₹₹", "₹₹₹"] as const;

export function FoodPicker({
  target,
  preference,
  onClose,
  onPickFood,
  onPickCustom,
}: {
  target: PickerTarget | null;
  preference: string;
  onClose: () => void;
  onPickFood: (food: Food, reason: SubReason) => void;
  onPickCustom: (name: string, reason: SubReason) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      {target ? <PickerBody key={`${target.slot}-${target.mode}`} target={target} preference={preference} onPickFood={onPickFood} onPickCustom={onPickCustom} /> : null}
    </Dialog>
  );
}

function PickerBody({ target, preference, onPickFood, onPickCustom }: { target: PickerTarget; preference: string; onPickFood: (food: Food, reason: SubReason) => void; onPickCustom: (name: string, reason: SubReason) => void }) {
  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [reason, setReason] = useState<SubReason>("availability");
  const alt = target.mode === "alternative";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FOODS.filter((food) => {
      if (diet === "jain" && !food.jain) return false;
      if (diet !== "all" && diet !== "jain" && food.diet !== diet) return false;
      if (!q) return true;
      return `${food.name} ${food.portion} ${food.region}`.toLowerCase().includes(q);
    })
      .map((food) => ({ food, conflict: preferenceConflict(food, preference) }))
      .sort((a, b) => Number(!!a.conflict) - Number(!!b.conflict));
  }, [query, diet, preference]);

  const allowed = results.filter((r) => !r.conflict).length;

  return (
    <ModalContent
      size="lg"
      title={alt ? `Alternative for ${target.itemName}` : `Add to ${SLOT_LABEL[target.slot]}`}
      description={`Indian dishes with household portions · values per portion are synthetic reference values · patient preference: ${preference}`}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        document.getElementById("food-search")?.focus();
      }}
    >
      <div className="flex flex-col gap-4">
        <SearchInput id="food-search" aria-label="Search foods" placeholder="Search idli, dal, paneer, ragi…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
            <Segmented
              ariaLabel="Diet filter"
              size="sm"
              variant="tray"
              value={diet}
              onChange={setDiet}
              items={[
                { value: "all", label: "All" },
                { value: "veg", label: "Vegetarian" },
                { value: "jain", label: "Jain" },
                { value: "egg", label: "Egg" },
                { value: "nonveg", label: "Non-veg" },
              ]}
            />
          </div>
          <p className="text-xs text-muted tabular" aria-live="polite">
            {allowed} of {results.length} fit {preference.toLowerCase()}
          </p>
        </div>
        {alt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-inner bg-canvas p-3 pl-4">
            <span className="text-sm text-ink" id="alt-reason">Why offer it?</span>
            <Segmented
              ariaLabel="Reason for this alternative"
              size="sm"
              value={reason}
              onChange={setReason}
              items={(Object.keys(SUB_REASON_LABEL) as SubReason[]).map((r) => ({ value: r, label: SUB_REASON_LABEL[r] }))}
            />
          </div>
        ) : null}

        {results.length ? (
          <ul className="flex flex-col gap-1" aria-label="Foods">
            {results.map(({ food, conflict }) => (
              <li key={food.id}>
                <button
                  type="button"
                  disabled={!!conflict}
                  onClick={() => onPickFood(food, reason)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] p-3 text-left transition-colors",
                    conflict ? "cursor-not-allowed opacity-60" : "hover:bg-canvas focus-visible:bg-canvas",
                  )}
                >
                  <DietMark diet={food.diet} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm text-ink">{food.name}</span>
                      <span className="text-xs text-muted">{food.portion}</span>
                    </span>
                    {conflict ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-danger">
                        <Prohibit size={12} aria-hidden="true" />
                        {conflict}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-muted">
                        {food.region}
                        {food.jain ? " · Jain" : ""}
                        {food.gi === "low" ? " · Low GI" : food.gi === "high" ? " · High GI" : ""}
                        {" · "}
                        <span aria-label={`Cost level ${food.cost} of 3`}>{COST[food.cost]}</span>
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm text-ink tabular">{food.kcal} kcal</span>
                    <span className="block text-xs text-muted tabular">{food.protein} g protein</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MagnifyingGlass />}
            title={`No dish matches “${query}”`}
            description="Add it as a custom item and enter its portion and values yourself."
            className="py-8"
          />
        )}

        {query.trim() ? (
          <div className="flex items-center justify-between gap-3 rounded-inner bg-canvas p-3 pl-4">
            <p className="min-w-0 text-sm text-ink-2">
              Not listed? Add <span className="text-ink">“{query.trim()}”</span> and fill in its values.
            </p>
            <Button size="sm" variant="dark" leading={<Plus />} onClick={() => onPickCustom(query.trim(), reason)}>
              Custom item
            </Button>
          </div>
        ) : null}
      </div>
    </ModalContent>
  );
}
