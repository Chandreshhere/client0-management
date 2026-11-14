"use client";

import { ArrowsLeftRight, BowlFood, Briefcase, ClockCounterClockwise, Stethoscope } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatNumber, formatTime } from "@/lib/format";
import { staffById } from "@/data/staff";
import { ProgressBar } from "@/components/ui/misc";
import { Panel, SelfReportedBadge } from "../ui";
import { TODAY_KEY, longDate, shortDate, dayLabel } from "../time";
import {
  CURRENT_VERSION,
  LOG_MATCH_LABEL,
  MEAL_SLOTS,
  MY_FOOD_LOGS,
  NUTRITION,
  NUTRITION_GUIDANCE,
  OFFICE_DAY_NAMES,
  OIL_PER_DAY,
  PLAN_TOTALS,
  SALT_PER_DAY,
  TODAY_IS_OFFICE,
  isOfficeDay,
  type MealSlot,
} from "./data";

const CHANGE_WORD: Record<string, string> = { "+": "Added", "−": "Removed", "-": "Removed", "~": "Changed" };

const MAIN_MEALS: ReadonlySet<string> = new Set(["breakfast", "lunch", "dinner"]);
/** Time-of-day position, used on phones where the meal stacks collapse into one column. */
const TIME_ORDER = ["order-1", "order-2", "order-3", "order-4", "order-5", "order-6"];

function MealList({ slots, label }: { slots: MealSlot[]; label: string }) {
  return (
    <ul className="contents sm:flex sm:flex-col sm:gap-2" aria-label={label}>
      {slots.map((s) => (
        <li key={s.id} className={cn(TIME_ORDER[MEAL_SLOTS.indexOf(s)], "sm:order-none")}>
          <SlotCard slot={s} />
        </li>
      ))}
    </ul>
  );
}

/** Nutrition plan (published version) as meal slots in plain words, with the day's totals vs targets. */
export function MealsPanel() {
  if (!NUTRITION || !MEAL_SLOTS.length) {
    return (
      <Panel icon={<BowlFood />} title="Meal plan" subtitle="No plan published yet">
        <p className="rounded-inner bg-surface p-4 text-sm text-muted">Your nutritionist hasn&apos;t published a meal plan yet. It will appear here once it&apos;s released to you.</p>
      </Panel>
    );
  }
  const author = staffById(NUTRITION.authorId);
  const targets = NUTRITION_GUIDANCE?.targets;
  const doctor = staffById(NUTRITION_GUIDANCE?.by);

  return (
    <Panel
      icon={<BowlFood />}
      title={`Meal plan v${NUTRITION.version}`}
      subtitle={`${author?.name} · published ${shortDate(NUTRITION.updatedAt)} · ${NUTRITION.title}`}
      href="/messages?new=1"
      actionLabel={`Message ${author?.name ?? "your nutritionist"} about your plan`}
    >
      {/* Three stacks instead of a row-aligned grid, so no card is stretched to a taller neighbour:
          small meals + what changed · main meals · day totals, guidance and logs. They come out within a
          few px of each other. On phones the stacks dissolve (contents) and order-* restores time order. */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        <div className="contents sm:flex sm:flex-col sm:gap-2">
          <MealList slots={MEAL_SLOTS.filter((s) => !MAIN_MEALS.has(s.id))} label="Small meals and snacks" />
          {CURRENT_VERSION ? (
            <section aria-labelledby="meal-changed" className="order-8 rounded-inner bg-surface p-4 sm:order-none">
              <h3 id="meal-changed" className="flex items-center gap-2 text-sm text-ink">
                <ClockCounterClockwise size={16} className="text-muted" aria-hidden="true" />
                What changed in v{CURRENT_VERSION.version}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {longDate(CURRENT_VERSION.at)} · {CURRENT_VERSION.why}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {CURRENT_VERSION.changes.map((c) => {
                  const sym = c.trim().charAt(0);
                  return (
                    <li key={c} className="flex items-start gap-2 text-sm text-ink-2">
                      <span className="mt-0.5 shrink-0 rounded-full bg-sunken px-2 text-[11px] text-ink-2">{CHANGE_WORD[sym] ?? "Note"}</span>
                      <span>{CHANGE_WORD[sym] ? c.trim().slice(1).trim() : c}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
        <MealList slots={MEAL_SLOTS.filter((s) => MAIN_MEALS.has(s.id))} label="Main meals" />
        <div className="contents sm:col-span-2 sm:flex sm:flex-col sm:gap-2 xl:col-span-1">
          <section aria-labelledby="meal-day" className="order-7 rounded-inner bg-surface p-4 sm:order-none">
            <h3 id="meal-day" className="text-sm text-ink">
              {TODAY_IS_OFFICE ? "Today is an office day" : "Today is a home day"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Office days ({OFFICE_DAY_NAMES.join(", ")}) use the earlier times shown on each meal.
            </p>
            <dl className="mt-4 flex flex-col gap-3">
              {targets ? (
                <>
                  <Total label="Energy" value={`${formatNumber(PLAN_TOTALS.kcal)} kcal`} target={`of ${formatNumber(targets.kcal)} kcal`} ratio={PLAN_TOTALS.kcal / targets.kcal} />
                  <Total label="Protein" value={`${PLAN_TOTALS.protein} g`} target={`target ${targets.protein} g`} ratio={PLAN_TOTALS.protein / targets.protein} />
                  <Total label="Fibre" value={`${PLAN_TOTALS.fibre} g`} target={`at least ${targets.fibre} g`} ratio={PLAN_TOTALS.fibre / targets.fibre} />
                </>
              ) : null}
              {OIL_PER_DAY || SALT_PER_DAY ? (
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-muted">Cooking</dt>
                  <dd className="text-right text-ink">
                    {OIL_PER_DAY ? `Oil ${OIL_PER_DAY} a day` : null}
                    {OIL_PER_DAY && SALT_PER_DAY ? " · " : null}
                    {SALT_PER_DAY ? `salt ${SALT_PER_DAY}` : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-[11px] text-muted">Totals add up the foods in this plan (rounded reference values). Targets are from your care team.</p>
          </section>
          {NUTRITION_GUIDANCE ? (
            <section aria-labelledby="meal-doctor" className="order-9 rounded-inner bg-surface p-4 sm:order-none">
              <h3 id="meal-doctor" className="flex items-center gap-2 text-sm text-ink">
                <Stethoscope size={16} className="text-muted" aria-hidden="true" />
                Food guidance from {doctor?.name ?? "your doctor"}
              </h3>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2 marker:text-faint">
                {NUTRITION_GUIDANCE.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted">
                Guidance {NUTRITION_GUIDANCE.version} · from {shortDate(NUTRITION_GUIDANCE.effective)} · next review {shortDate(`${NUTRITION_GUIDANCE.review}T12:00:00+05:30`)}
              </p>
            </section>
          ) : null}
          {MY_FOOD_LOGS.length ? (
            <section aria-labelledby="meal-logs" className="order-10 rounded-inner bg-surface p-4 sm:order-none">
              <h3 id="meal-logs" className="text-sm text-ink">
                Your recent food logs
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {MY_FOOD_LOGS.slice(0, 3).map((l) => {
                  const slot = MEAL_SLOTS.find((s) => s.id === l.slot);
                  const day = l.eatenAt.slice(0, 10);
                  const office = isOfficeDay(day);
                  const planned = slot ? (office ? slot.office : slot.home) : null;
                  const late = planned ? minutesOf(formatTime(l.eatenAt)) - minutesOf(planned) : 0;
                  return (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
                      {/* min width: in the narrow xl column the badge drops below instead of squeezing the text */}
                      <span className="min-w-[12rem] flex-1">
                        <span className="block text-sm text-ink">“{l.text}”</span>
                        <span className="block text-xs text-muted">
                          {slot?.label} · {dayLabel(l.eatenAt)} {formatTime(l.eatenAt)}
                          {office ? " · office day" : ""} · {LOG_MATCH_LABEL[l.match].toLowerCase()}
                          {planned && late > 30 ? ` · ${Math.floor(late / 60) ? `${Math.floor(late / 60)} h ` : ""}${late % 60 ? `${late % 60} min ` : ""}after the planned ${planned}` : ""}
                        </span>
                      </span>
                      <SelfReportedBadge reviewed={l.reviewedBy ?? null} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function Total({ label, value, target, ratio }: { label: string; value: string; target: string; ratio: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <dt className="text-muted">{label}</dt>
        <dd className="text-right">
          <span className="text-ink tabular">{value}</span> <span className="text-xs text-muted">{target}</span>
        </dd>
      </div>
      <ProgressBar value={Math.round(Math.min(1, ratio) * 100)} max={100} tone="dark" label={`${label}: ${value}, ${target}`} />
    </div>
  );
}

function SlotCard({ slot }: { slot: MealSlot }) {
  const time = TODAY_IS_OFFICE ? slot.office : slot.home;
  const other = TODAY_IS_OFFICE ? slot.home : slot.office;
  const logged = MY_FOOD_LOGS.find((l) => l.slot === slot.id && l.eatenAt.slice(0, 10) === TODAY_KEY);
  return (
    <article className="flex flex-col gap-3 rounded-inner bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm text-ink">{slot.label}</h3>
          {other !== time ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Briefcase size={12} aria-hidden="true" />
              {TODAY_IS_OFFICE ? "Home days" : "Office days"} {other}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-xl font-light leading-none text-ink tabular">{time}</p>
      </header>
      <ul className="flex flex-col gap-2">
        {slot.items.map((it) => (
          <li key={it.id} className="text-sm">
            <span className="block text-ink">{it.name}</span>
            <span className="block text-xs text-muted">{it.portion}</span>
            {it.note ? <span className="mt-1 block text-xs text-ink-2">{it.note}</span> : null}
            {it.swaps.length ? (
              <span className="mt-1 flex items-start gap-1 text-[11px] text-muted">
                <ArrowsLeftRight size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Or {it.swaps.map((s) => s.name.toLowerCase()).join(" / ")} — {it.swaps[0].note.toLowerCase()}
                </span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted">
        <span className="tabular">
          ≈ {slot.kcal} kcal · {slot.fibre} g fibre
        </span>
        {logged ? <span className="text-ink-2">You logged this at {formatTime(logged.eatenAt)}</span> : null}
      </footer>
    </article>
  );
}
