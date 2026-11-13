import { Check } from "@phosphor-icons/react/ssr";
import { PLANS, type Plan } from "@/data/plans";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import s from "@/features/marketing/motion.module.css";
import { ExploreDemoButton } from "./explore-demo-button";
import { basePlanName, cardFeatures, planAnchor, priceParts, roleLabel } from "./model";

/**
 * The three plans. Team is the cobalt focal card. Each card lists its features grouped by
 * FEATURE_GROUPS — the base plan lists everything, the others "Everything in X, plus…".
 * Prices come straight from @/data/plans. Type budget per card: 12 / 14 / 26 / 44px · 300 / 400.
 */
export function PlanCards({ headingLevel = "h3", className }: { headingLevel?: "h2" | "h3"; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-3", className)}>
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} Heading={headingLevel} />
      ))}
    </div>
  );
}

function PlanCard({ plan, Heading }: { plan: Plan; Heading: "h2" | "h3" }) {
  const focal = plan.id === "team";
  const { amount, unit } = priceParts(plan);
  const base = basePlanName(plan);
  const groups = cardFeatures(plan);
  const sub = focal ? "text-white/90" : "text-muted";

  return (
    <article
      id={planAnchor(plan.id)}
      aria-labelledby={`${plan.id}-plan-name`}
      className={cn("flex scroll-mt-28 flex-col rounded-card p-2", focal ? "bg-primary text-white" : "bg-surface text-ink", s.revealTall)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <Heading id={`${plan.id}-plan-name`} className="text-[26px] font-light leading-none tracking-[-0.02em]">
            {plan.name}
          </Heading>
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-xs",
              focal ? "text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
            )}
          >
            {plan.usersLabel}
          </span>
        </div>
        <p className={cn("mt-3 min-h-[40px] text-sm", sub)}>{plan.audience}</p>

        <p className="mt-8 flex items-baseline gap-2">
          <span className="text-[44px] font-light leading-none tracking-[-0.03em] tabular">{amount}</span>
          <span className={cn("text-sm", sub)}>{unit}</span>
        </p>
        <p className={cn("mt-2 text-sm", sub)}>+ {formatINR(plan.setupFee)} one-time setup fee</p>

        <ExploreDemoButton planId={plan.id} tone={focal ? "light" : "dark"} className="mt-6 w-full" />
      </div>

      <div className={cn("flex flex-1 flex-col rounded-inner p-4", focal ? "bg-black/10" : "bg-sunken")}>
        <p className="text-sm">{base ? `Everything in ${base}, plus:` : "Includes:"}</p>
        {groups.map((g) => (
          <div key={g.group} className="mt-4">
            <p className={cn("text-xs", sub)}>{g.group}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {g.features.map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <Check size={16} weight="bold" aria-hidden="true" className={cn("mt-0.5 shrink-0", focal ? "text-white" : "text-ink")} />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className={cn("mt-auto pt-6 text-xs", sub)}>
          Workspaces in the demo: {plan.roles.map(roleLabel).join(" · ")}
        </p>
      </div>
    </article>
  );
}
