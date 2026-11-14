import { Check } from "@phosphor-icons/react/ssr";
import { PLANS, type Plan } from "@/data/plans";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { CtaLink } from "@/features/marketing/cta";
import s from "@/features/marketing/motion.module.css";
import { addedRoles, basePlanName, branchesShort, cardFeatures, planAnchor, priceParts, roleLabel, storageLabel } from "./model";

/**
 * The three plans, each including everything in the one before it. Clinic is the cobalt focal
 * card (the middle of the range — no popularity claim). Each card states the price per
 * practitioner, onboarding, free admin/reception seats, branches, storage, its roles (the roles it
 * adds are set dark) and only the features it adds: "Everything in Core, plus…". Every figure
 * comes from @/data/plans. Type budget per card: 12 / 14 / 26 / 44px · 300 / 400.
 */
const FOCAL = "clinic";

export function PlanCards({ headingLevel = "h3", className }: { headingLevel?: "h2" | "h3"; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start", className)}>
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} Heading={headingLevel} />
      ))}
    </div>
  );
}

function PlanCard({ plan, Heading }: { plan: Plan; Heading: "h2" | "h3" }) {
  const focal = plan.id === FOCAL;
  const { amount, unit } = priceParts(plan);
  const base = basePlanName(plan);
  const groups = cardFeatures(plan);
  const added = addedRoles(plan);
  const sub = focal ? "text-white/90" : "text-muted";

  const facts = [
    { label: "Admin / reception", value: `${plan.freeSeats} seats free`, note: `then ${formatINR(plan.extraSeat)} each` },
    { label: "Branches", value: branchesShort(plan), note: plan.branches === "unlimited" ? "with own rooms" : "one location" },
    { label: "Storage", value: storageLabel(plan), note: "more as add-on" },
  ];

  return (
    <article
      id={planAnchor(plan.id)}
      aria-labelledby={`${plan.id}-plan-name`}
      className={cn("flex scroll-mt-28 flex-col rounded-card p-2", focal ? "bg-primary text-white" : "bg-surface text-ink", s.revealTall)}
    >
      <div className="p-4">
        <Heading id={`${plan.id}-plan-name`} className="text-[26px] font-light leading-none tracking-[-0.02em]">
          {plan.name}
        </Heading>
        <p className="mt-3 text-sm">{plan.positioning}</p>
        <p className={cn("mt-1 text-sm md:min-h-[40px]", sub)}>{plan.audience}</p>

        <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[44px] font-light leading-none tracking-[-0.03em] tabular">{amount}</span>
          <span className={cn("text-sm", sub)}>{unit}</span>
        </p>
        <p className={cn("mt-2 text-sm", sub)}>
          Billed annually · <span className="whitespace-nowrap">{formatINR(plan.price.monthly)} billed monthly</span> · <span className="whitespace-nowrap">before GST</span>
        </p>
        <p className="mt-1 text-sm">+ {formatINR(plan.onboardingFee)} one-time onboarding</p>

        <dl className={cn("mt-6 grid grid-cols-2 gap-2 rounded-inner p-3 sm:grid-cols-3", focal ? "bg-white/10" : "bg-sunken")}>
          {facts.map((f, i) => (
            <div key={f.label} className={cn("min-w-0", i === 0 && "col-span-2 sm:col-span-1")}>
              <dt className={cn("text-xs", sub)}>{f.label}</dt>
              <dd className="mt-1 text-sm">{f.value}</dd>
              <dd className={cn("mt-0.5 text-xs", sub)}>{f.note}</dd>
            </div>
          ))}
        </dl>

        <CtaLink href={`/demo?plan=${plan.id}`} tone={focal ? "light" : "dark"} className="mt-6 w-full justify-between">
          Try the {plan.name} demo
        </CtaLink>
      </div>

      <div className={cn("flex flex-1 flex-col rounded-inner p-4", focal ? "bg-black/10" : "bg-sunken")}>
        <p className="text-sm">
          {plan.roles.length} roles{" "}
          <span className={sub}>· {base ? `adds ${added.map(roleLabel).join(" and ")}` : "the whole care team"}</span>
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Roles on ${plan.name}`}>
          {plan.roles.map((r) => {
            const isNew = base !== null && added.includes(r);
            return (
              <li
                key={r}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-2.5 text-xs",
                  isNew ? (focal ? "bg-white text-ink" : "bg-charcoal text-white") : focal ? "bg-black/15 text-white" : "bg-surface text-ink-2",
                )}
              >
                {roleLabel(r)}
                {isNew ? <span className="sr-only"> (added on {plan.name})</span> : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-sm">{base ? `Everything in ${base}, plus:` : "Includes:"}</p>
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
      </div>
    </article>
  );
}
