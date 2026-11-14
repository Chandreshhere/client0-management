import type { ReactNode } from "react";
import { Check, Minus } from "@phosphor-icons/react/ssr";
import { FEATURES, FEATURE_GROUPS, PLANS, planHas, type Plan } from "@/data/plans";
import type { Role } from "@/data/types";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { availabilityLabel, branchesShort, groupFirstPlan, roleLabel, storageLabel } from "./model";

/**
 * Plan comparison: one accessible table at every width (th scope, caption, row groups, sticky plan
 * header). Rows run from the commercial basics (price, seats, onboarding, branches, storage) to
 * who can sign in, then every feature by FEATURE_GROUPS, each group labelled with the plans that
 * carry it ("Every plan", "Clinic and Pro", "Pro only") so the step between plans is unmistakable.
 */
const TOP = PLANS[PLANS.length - 1];
const ROLES: Role[] = TOP.roles;

function Mark({ on }: { on: boolean }) {
  return on ? (
    <>
      <Check size={18} weight="bold" aria-hidden="true" className="text-ink" />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus size={18} aria-hidden="true" className="text-faint" />
      <span className="sr-only">Not included</span>
    </>
  );
}

const BASICS: { label: string; detail: string; value: (p: Plan) => ReactNode }[] = [
  { label: "Per practitioner, billed annually", detail: "Per month, before GST", value: (p) => formatINR(p.price.annual) },
  { label: "Per practitioner, billed monthly", detail: "Per month, before GST", value: (p) => formatINR(p.price.monthly) },
  {
    label: "Admin / reception seats",
    detail: "Free seats, then a fee per extra seat per month",
    value: (p) => (
      <>
        {p.freeSeats} free
        <span className="block text-xs text-muted">then {formatINR(p.extraSeat)}</span>
      </>
    ),
  },
  { label: "Onboarding", detail: "One-time", value: (p) => formatINR(p.onboardingFee) },
  { label: "Branches", detail: "Locations with their own rooms and staff", value: (p) => branchesShort(p) },
  { label: "Storage", detail: "Documents and reports; more is an add-on", value: (p) => storageLabel(p) },
];

const cellBase = "px-2 py-3 text-center align-middle transition-colors group-hover/row:bg-canvas md:px-4";
const headBase = "rounded-l-inner px-2 py-3 text-left align-middle font-normal transition-colors group-hover/row:bg-canvas md:px-4";

function GroupRow({ title, note }: { title: string; note?: string }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={PLANS.length + 1} className="px-2 pb-2 pt-8 text-left font-normal md:px-4">
        <span className="text-sm text-ink">{title}</span>
        {note ? <span className="ml-2 inline-flex h-6 items-center rounded-full bg-sunken px-2 align-middle text-xs text-ink-2">{note}</span> : null}
      </th>
    </tr>
  );
}

export function ComparisonTable() {
  return (
    <div className="rounded-card bg-surface px-1 pb-2 md:px-2">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">What each Carelane plan includes: price, seats, roles and every feature</caption>
        <colgroup>
          <col />
          {PLANS.map((p) => (
            <col key={p.id} className="w-[22%] md:w-[17%]" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky top-[64px] z-10 rounded-tl-card bg-surface px-2 pb-4 pt-6 align-bottom text-xs font-normal text-muted md:top-[72px] md:px-4">
              <span className="sr-only md:not-sr-only">Each plan includes everything in the one before it</span>
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="sticky top-[64px] z-10 bg-surface px-2 pb-4 pt-6 text-center align-bottom font-normal last:rounded-tr-card md:top-[72px] md:px-4">
                <span className="block text-base text-ink">{p.name}</span>
                <span className="hidden text-xs text-muted md:block">{p.positioning}</span>
                <span className="mt-1 block text-xs text-muted tabular">
                  {p.features.length} features · {p.roles.length} roles
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <GroupRow title="The plan" />
          {BASICS.map((b) => (
            <tr key={b.label} className="group/row">
              <th scope="row" className={headBase}>
                <span className="block text-ink">{b.label}</span>
                <span className="hidden text-xs text-muted md:block">{b.detail}</span>
              </th>
              {PLANS.map((p) => (
                <td key={p.id} className={cn(cellBase, "text-ink tabular last:rounded-r-inner")}>
                  {b.value(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        <tbody>
          <GroupRow title="Who can sign in" />
          {ROLES.map((r) => (
            <tr key={r} className="group/row">
              <th scope="row" className={headBase}>
                <span className="block text-ink">{roleLabel(r)}</span>
              </th>
              {PLANS.map((p) => (
                <td key={p.id} className={cn(cellBase, "last:rounded-r-inner")}>
                  <span className="inline-flex justify-center">
                    <Mark on={p.roles.includes(r)} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {FEATURE_GROUPS.map((group) => (
          <tbody key={group}>
            <GroupRow title={group} note={availabilityLabel(groupFirstPlan(group))} />
            {FEATURES.filter((f) => f.group === group).map((f) => (
              <tr key={f.id} className="group/row">
                <th scope="row" className={headBase}>
                  <span className="block text-ink">{f.label}</span>
                  <span className="hidden text-xs text-muted md:block">{f.description}</span>
                </th>
                {PLANS.map((p) => (
                  <td key={p.id} className={cn(cellBase, "last:rounded-r-inner")}>
                    <span className="inline-flex justify-center">
                      <Mark on={planHas(p.id, f.id)} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
