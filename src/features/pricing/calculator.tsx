"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type CSSProperties } from "react";
import { Info, Minus, Plus } from "@phosphor-icons/react";
import { planById } from "@/data/plans";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { snappy, spring } from "@/lib/motion";
import { MAX_USERS, MIN_USERS, plansFor, roleLabel } from "./model";
import s from "./pricing.module.css";

/**
 * User-count calculator: 1–10 users → per plan, the monthly cost (monthlyCost) and the first-year
 * total (setup + 12 × monthly). Plans that don't cover the count say so. Figures come from plan data.
 * Type budget: 12 / 14 / 24 / 48px · 300 / 400.
 */
const users = (n: number) => `${n} ${n === 1 ? "user" : "users"}`;

export function PricingCalculator() {
  const [n, setN] = useState(5);
  const id = useId();
  const rows = plansFor(n);
  const team = planById("team");
  const clinic = planById("clinic");
  const teamMonthly = rows.find((r) => r.plan.id === "team")?.monthly ?? null;
  const clinicMonthly = rows.find((r) => r.plan.id === "clinic")?.monthly ?? null;
  const overlap = teamMonthly !== null && clinicMonthly !== null;
  const fill = { "--fill": `${((n - MIN_USERS) / (MAX_USERS - MIN_USERS)) * 100}%` } as CSSProperties;

  const summary = rows.map((r) => `${r.plan.name}: ${r.monthly === null ? "not available" : `${formatINR(r.monthly)} a month`}`).join("; ");

  return (
    <div className="grid grid-cols-1 gap-2 rounded-card bg-surface p-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col p-4 md:p-6">
        <label htmlFor={`${id}-range`} className="text-sm text-ink">
          How many people will use Carelane?
        </label>
        <p className="mt-1 text-xs text-muted">Count everyone who signs in: practitioners, front desk and administrators.</p>

        <div className="mt-8 flex items-center justify-between gap-4">
          <IconButton label="Remove a user" variant="white" onClick={() => setN((v) => Math.max(MIN_USERS, v - 1))} disabled={n <= MIN_USERS}>
            <Minus />
          </IconButton>
          <p className="flex items-baseline gap-2" aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={n}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={snappy}
                className="inline-block text-[48px] font-light leading-none tracking-[-0.03em] text-ink tabular"
              >
                {n}
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-muted">{n === 1 ? "user" : "users"}</span>
          </p>
          <IconButton label="Add a user" variant="white" onClick={() => setN((v) => Math.min(MAX_USERS, v + 1))} disabled={n >= MAX_USERS}>
            <Plus />
          </IconButton>
        </div>

        <input
          id={`${id}-range`}
          type="range"
          min={MIN_USERS}
          max={MAX_USERS}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-valuetext={users(n)}
          className={cn("mt-6", s.range)}
          style={fill}
        />
        <div aria-hidden="true" className="mt-1 flex justify-between px-[7px] text-xs text-muted tabular">
          {Array.from({ length: MAX_USERS - MIN_USERS + 1 }, (_, i) => i + MIN_USERS).map((v) => (
            <span key={v} className={cn("w-[10px] text-center", v === n && "text-ink")}>
              {v}
            </span>
          ))}
        </div>

        <output htmlFor={`${id}-range`} aria-live="polite" className="sr-only">
          {`At ${users(n)}: ${summary}.`}
        </output>

        <AnimatePresence initial={false}>
          {overlap ? (
            <motion.p
              key="overlap"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              className="overflow-hidden"
            >
              <span className="mt-8 flex gap-3 rounded-inner bg-primary-soft p-4 text-sm text-primary-ink">
                <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>
                  {users(n)} fits both {team.name} and {clinic.name}. {clinic.name} is cheaper at {n} — {formatINR(clinicMonthly ?? 0)} a month against {formatINR(teamMonthly ?? 0)} — and adds the
                  patient portal, the care-coordinator workspace and administration.
                </span>
              </span>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <ul className="flex flex-col gap-2 rounded-inner bg-sunken p-2" aria-label={`Cost per plan for ${users(n)}`}>
        {rows.map(({ plan, monthly, firstYear }) => {
          const available = monthly !== null && firstYear !== null;
          const p = plan.pricing;
          return (
            <motion.li key={plan.id} layout transition={spring} className={cn("flex flex-1 flex-col justify-center rounded-[8px] bg-surface p-4", !available && "bg-surface/60")}>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <p className={cn("text-base", available ? "text-ink" : "text-muted")}>{plan.name}</p>
                  <p className="text-xs text-muted">
                    {plan.usersLabel} · {plan.roles.length === 1 ? `${roleLabel(plan.roles[0])} workspace` : `${plan.roles.length} workspaces`}
                  </p>
                </div>
                {available ? (
                  <div className="text-right">
                    <p className="text-[24px] font-light leading-none tracking-[-0.02em] text-ink tabular">
                      {formatINR(monthly)}
                      <span className="ml-1 text-xs tracking-normal text-muted">/ month</span>
                    </p>
                    <p className="mt-2 text-xs text-muted tabular">
                      First year {formatINR(firstYear)}
                      <span className="block">
                        {formatINR(plan.setupFee)} setup + 12 × {formatINR(monthly)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm text-muted">Not available for {users(n)}</p>
                    <p className="mt-1 text-xs text-muted">{p.kind === "per-user" ? `${plan.name} covers ${p.minUsers}–${p.maxUsers} users` : ""}</p>
                  </div>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
