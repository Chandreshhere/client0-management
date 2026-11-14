"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import type { Billing } from "@/data/plans";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { formatINR, pluralize } from "@/lib/format";
import { snappy, spring } from "@/lib/motion";
import { BILLING_LABEL, EXAMPLE_PRACTITIONERS, MAX_PRACTITIONERS, MAX_STAFF_SEATS, MIN_PRACTITIONERS, costRows } from "./model";
import s from "./pricing.module.css";

/**
 * Cost calculator: practitioners (billed each) + admin/reception seats (free up to each plan's
 * limit, then a fee per seat) + annual/monthly billing → per plan, the monthly and yearly cost and
 * the one-time onboarding. Every figure comes from monthlyCost in @/data/plans.
 * Type budget: 12 / 14 / 24 / 48px · 300 / 400.
 */
const DEFAULT_SEATS = 2;

export function PricingCalculator() {
  const [practitioners, setPractitioners] = useState(EXAMPLE_PRACTITIONERS);
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [billing, setBilling] = useState<Billing>("annual");
  const id = useId();
  const rows = costRows(practitioners, seats, billing);
  const example = costRows(EXAMPLE_PRACTITIONERS, 0, "annual");
  const isExample = practitioners === EXAMPLE_PRACTITIONERS && seats <= Math.min(...rows.map((r) => r.plan.freeSeats)) && billing === "annual";
  const fill = { "--fill": `${((practitioners - MIN_PRACTITIONERS) / (MAX_PRACTITIONERS - MIN_PRACTITIONERS)) * 100}%` } as CSSProperties;

  const summary = rows.map((r) => `${r.plan.name}: ${formatINR(r.monthly)} a month, ${formatINR(r.yearly)} a year, plus ${formatINR(r.onboarding)} onboarding`).join("; ");

  return (
    <div className="grid grid-cols-1 gap-2 rounded-card bg-surface p-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-8 p-4 md:p-6">
        <Segmented<Billing>
          ariaLabel="Billing"
          variant="tray"
          value={billing}
          onChange={setBilling}
          items={(["annual", "monthly"] as const).map((b) => ({ value: b, label: BILLING_LABEL[b] }))}
          className="w-fit"
        />

        <Counter
          label="Practitioners"
          hint="Doctors, nutritionists and yoga instructors. Each one is billed per month."
          noun="practitioner"
          value={practitioners}
          min={MIN_PRACTITIONERS}
          max={MAX_PRACTITIONERS}
          onChange={setPractitioners}
        >
          <input
            id={`${id}-range`}
            type="range"
            min={MIN_PRACTITIONERS}
            max={MAX_PRACTITIONERS}
            step={1}
            value={practitioners}
            onChange={(e) => setPractitioners(Number(e.target.value))}
            aria-label="Practitioners"
            aria-valuetext={pluralize(practitioners, "practitioner")}
            className={cn("mt-4", s.range)}
            style={fill}
          />
          <div aria-hidden="true" className="flex justify-between text-xs text-muted tabular">
            <span>{MIN_PRACTITIONERS}</span>
            <span>{MAX_PRACTITIONERS}</span>
          </div>
        </Counter>

        <Counter
          label="Admin and reception seats"
          hint="Admin on every plan, reception on Clinic and Pro, care coordinators on Pro. Free up to each plan's limit."
          noun="seat"
          value={seats}
          min={0}
          max={MAX_STAFF_SEATS}
          onChange={setSeats}
        />

        <output aria-live="polite" className="sr-only">
          {`${pluralize(practitioners, "practitioner")}, ${pluralize(seats, "admin or reception seat")}, ${BILLING_LABEL[billing].toLowerCase()}: ${summary}.`}
        </output>

        <div className="mt-auto rounded-inner bg-sunken p-4">
          <p className="text-xs text-muted">Example · {EXAMPLE_PRACTITIONERS} practitioners, billed annually</p>
          <p className="mt-2 text-sm text-ink">
            {example.map((r, i) => (
              <span key={r.plan.id}>
                {i > 0 ? " · " : ""}
                <span className="whitespace-nowrap">
                  {r.plan.name} <span className="tabular">{formatINR(r.yearly)}</span>/yr
                </span>
              </span>
            ))}
            <span className="text-muted">, plus onboarding.</span>
          </p>
          {isExample ? null : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setPractitioners(EXAMPLE_PRACTITIONERS);
                setSeats(DEFAULT_SEATS);
                setBilling("annual");
              }}
            >
              Use this example
            </Button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2 rounded-inner bg-sunken p-2" aria-label={`Cost per plan for ${pluralize(practitioners, "practitioner")} and ${pluralize(seats, "seat")}`}>
        {rows.map((r) => (
          <motion.li key={r.plan.id} layout transition={spring} className="flex flex-1 flex-col justify-center rounded-[8px] bg-surface p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <p className="text-base text-ink">{r.plan.name}</p>
                <p className="text-xs text-muted">{r.plan.positioning}</p>
              </div>
              <div className="text-right">
                <p className="text-[24px] font-light leading-none tracking-[-0.02em] text-ink tabular">
                  {formatINR(r.yearly)}
                  <span className="ml-1 text-xs tracking-normal text-muted">/ year</span>
                </p>
                <p className="mt-2 text-xs text-muted tabular">{formatINR(r.monthly)} / month</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="sr-only">Practitioners</dt>
                <dd className="tabular">
                  {practitioners} × {formatINR(r.plan.price[billing])} per practitioner
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="sr-only">Admin and reception seats</dt>
                <dd className="tabular">
                  {r.extra ? (
                    <span className="text-ink-2">
                      {pluralize(r.extra, "extra seat")} × {formatINR(r.plan.extraSeat)}
                    </span>
                  ) : (
                    `${seats} of ${r.plan.freeSeats} free seats used`
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2 sm:block">
                <dt className="sr-only">Onboarding</dt>
                <dd className="tabular">
                  + {formatINR(r.onboarding)} one-time onboarding · first year {formatINR(r.firstYear)}
                </dd>
              </div>
            </dl>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Counter({
  label,
  hint,
  noun,
  value,
  min,
  max,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  noun: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm text-ink">{label}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <IconButton label={`One ${noun} fewer`} variant="white" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
          <Minus />
        </IconButton>
        <p className="flex items-baseline gap-2" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={snappy}
              className="inline-block text-[48px] font-light leading-none tracking-[-0.03em] text-ink tabular"
            >
              {value}
            </motion.span>
          </AnimatePresence>
          <span className="text-sm text-muted">{value === 1 ? noun : `${noun}s`}</span>
        </p>
        <IconButton label={`One more ${noun}`} variant="white" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
          <Plus />
        </IconButton>
      </div>
      {children}
    </div>
  );
}
