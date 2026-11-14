"use client";

import { AnimatePresence, motion } from "motion/react";
import { Export, UserSwitch, X } from "@phosphor-icons/react";
import { pop } from "@/lib/motion";

/** Floating bulk-action bar; springs in when rows are selected. */
export function BulkBar({
  count,
  onAssign,
  onExport,
  onClear,
}: {
  count: number;
  /** Assign a care coordinator (Pro) — omitted when the plan or role doesn't allow it. */
  onAssign?: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          key="bulk"
          role="region"
          aria-label="Bulk actions"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
          transition={pop}
          className="fixed inset-x-4 bottom-4 z-[50] mx-auto flex max-w-[560px] items-center gap-1 rounded-full bg-charcoal p-2 pl-5 text-sm text-white shadow-pop lg:bottom-6"
        >
          <p className="mr-auto whitespace-nowrap" aria-live="polite">
            <span className="tabular">{count}</span> selected
          </p>
          {onAssign ? (
            <button type="button" onClick={onAssign} className="inline-flex h-10 items-center gap-2 rounded-full px-3 transition-colors hover:bg-white/10">
              <UserSwitch size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Assign coordinator</span>
              <span className="sr-only sm:hidden">Assign coordinator</span>
            </button>
          ) : null}
          <button type="button" onClick={onExport} className="inline-flex h-10 items-center gap-2 rounded-full px-3 transition-colors hover:bg-white/10">
            <Export size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
            <span className="sr-only sm:hidden">Export</span>
          </button>
          <button type="button" onClick={onClear} aria-label="Clear selection" className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
            <X size={18} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
