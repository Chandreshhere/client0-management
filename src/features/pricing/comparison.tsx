import { CaretDown, Check, Minus } from "@phosphor-icons/react/ssr";
import { FEATURES, FEATURE_GROUPS, PLANS, planHas } from "@/data/plans";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { monthlyLine } from "./model";

/**
 * Feature comparison. Desktop: one accessible table (th scope, caption, row groups) with a sticky
 * plan header row. Mobile: a per-plan accordion (native <details>) with the same marks.
 */
function Mark({ on, tone = "ink" }: { on: boolean; tone?: "ink" | "white" }) {
  return on ? (
    <>
      <Check size={18} weight="bold" aria-hidden="true" className={tone === "white" ? "text-white" : "text-ink"} />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus size={18} aria-hidden="true" className="text-faint" />
      <span className="sr-only">Not included</span>
    </>
  );
}

export function ComparisonTable() {
  return (
    <>
      {/* ≥ md: table */}
      <div className="hidden rounded-card bg-surface px-2 pb-2 md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">Features included in each Carelane plan</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-[72px] z-10 rounded-tl-card bg-surface px-4 pb-4 pt-6 align-bottom text-xs font-normal text-muted">
                Feature
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col" className="sticky top-[72px] z-10 w-[18%] bg-surface px-4 pb-4 pt-6 text-center align-bottom font-normal last:rounded-tr-card">
                  <span className="block text-base text-ink">{p.name}</span>
                  <span className="block text-xs text-muted">{monthlyLine(p)}</span>
                  <span className="block text-xs text-muted">+ {formatINR(p.setupFee)} setup</span>
                </th>
              ))}
            </tr>
          </thead>
          {FEATURE_GROUPS.map((group) => (
            <tbody key={group}>
              <tr>
                <th scope="rowgroup" colSpan={PLANS.length + 1} className="px-4 pb-2 pt-8 text-xs font-normal text-muted">
                  {group}
                </th>
              </tr>
              {FEATURES.filter((f) => f.group === group).map((f) => (
                <tr key={f.id} className="group/row">
                  <th scope="row" className="rounded-l-inner px-4 py-3 font-normal transition-colors group-hover/row:bg-canvas">
                    <span className="block text-ink">{f.label}</span>
                    <span className="block text-xs text-muted">{f.description}</span>
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-center transition-colors last:rounded-r-inner group-hover/row:bg-canvas">
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

      {/* < md: one accordion per plan */}
      <div className="flex flex-col gap-2 md:hidden">
        {PLANS.map((p, i) => {
          const count = p.features.length;
          return (
            <details key={p.id} open={i === 1} className="group rounded-card bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card p-6 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-[20px] font-light tracking-[-0.015em] text-ink">{p.name}</span>
                  <span className="block text-xs text-muted">
                    {monthlyLine(p)} · {count} of {FEATURES.length} features
                  </span>
                </span>
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink transition-transform duration-300 group-open:rotate-180">
                  <CaretDown size={18} />
                </span>
              </summary>
              <div className="px-6 pb-6">
                {FEATURE_GROUPS.map((group) => (
                  <div key={group} className="mt-4 first:mt-0">
                    <p className="text-xs text-muted">{group}</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {FEATURES.filter((f) => f.group === group).map((f) => {
                        const on = planHas(p.id, f.id);
                        return (
                          <li key={f.id} className={cn("flex items-center justify-between gap-4 text-sm", on ? "text-ink" : "text-muted")}>
                            <span>{f.label}</span>
                            <span className="inline-flex shrink-0">
                              <Mark on={on} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
