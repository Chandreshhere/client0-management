"use client";

import { LayoutGroup, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { EmptyState } from "@/components/ui/misc";
import { dayOfMonth, istIso, monthShort, weekdayShort } from "../time";
import { BOOKING_DAYS, slotsFor } from "./data";

/**
 * Day pills + time chips. The charcoal selection slides between chips (shared layoutId), like the
 * kit's Segmented. Times are preferences: the clinic confirms them.
 */
export function SlotPicker({
  staffId,
  durationMin,
  value,
  onChange,
  exclude,
  invalid,
  initialDay,
}: {
  staffId: string;
  durationMin: number;
  value: string | null;
  onChange: (iso: string) => void;
  exclude?: string;
  invalid?: boolean;
  initialDay?: string;
}) {
  const uid = useId();
  const counts = useMemo(() => Object.fromEntries(BOOKING_DAYS.map((d) => [d, slotsFor(staffId, d, durationMin).filter((t) => istIso(d, t) !== exclude).length])), [staffId, durationMin, exclude]);
  const firstOpen = BOOKING_DAYS.find((d) => counts[d] > 0) ?? BOOKING_DAYS[0];
  const [day, setDay] = useState(() =>
    value && BOOKING_DAYS.includes(value.slice(0, 10)) ? value.slice(0, 10) : initialDay && BOOKING_DAYS.includes(initialDay) && counts[initialDay] > 0 ? initialDay : firstOpen,
  );
  const slots = slotsFor(staffId, day, durationMin).filter((t) => istIso(day, t) !== exclude);
  const dayName = `${weekdayShort(istIso(day, "12:00"))} ${dayOfMonth(istIso(day, "12:00"))} ${monthShort(istIso(day, "12:00"))}`;

  return (
    <div className="flex flex-col gap-4">
      <LayoutGroup id={`${uid}-days`}>
        <div role="radiogroup" aria-label="Day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" data-lenis-prevent>
          {BOOKING_DAYS.map((d) => {
            const iso = istIso(d, "12:00");
            const active = d === day;
            const full = counts[d] === 0;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={full}
                onClick={() => setDay(d)}
                className={cn(
                  "relative flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-inner text-center transition-colors duration-200",
                  active ? "text-white" : "text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-canvas",
                  full && "opacity-50",
                )}
              >
                {active ? <motion.span layoutId="day-indicator" transition={snappy} className="absolute inset-0 rounded-inner bg-charcoal" /> : null}
                <span className={cn("relative z-[1] text-xs", active ? "text-white" : "text-muted")}>{weekdayShort(iso)}</span>
                <span className="relative z-[1] text-lg leading-tight tabular">{dayOfMonth(iso)}</span>
                <span className={cn("relative z-[1] text-[11px]", active ? "text-white" : "text-muted")}>{full ? "Full" : `${counts[d]} free`}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {slots.length ? (
        <LayoutGroup id={`${uid}-slots`}>
          <div role="radiogroup" aria-label={`Times on ${dayName}`} aria-invalid={invalid || undefined} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots.map((t) => {
              const iso = istIso(day, t);
              const active = value === iso;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(iso)}
                  className={cn(
                    "relative h-10 rounded-full text-sm tabular transition-colors duration-200",
                    active ? "text-white" : "bg-sunken text-ink hover:bg-sunken-2",
                    invalid && !active && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]",
                  )}
                >
                  {active ? <motion.span layoutId="slot-indicator" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                  <span className="relative z-[1]">{t}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      ) : (
        <EmptyState icon={<CalendarBlank />} title={`No open times on ${dayName}`} description="Try another day, or message the clinic and the front desk will look for a time." className="bg-sunken py-8" />
      )}
    </div>
  );
}
