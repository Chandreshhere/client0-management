"use client";

import { cn } from "@/lib/cn";
import type { Discipline } from "@/data/types";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { tipLeft, useMarks, useWidth } from "./chart-utils";
import { DISCIPLINE_COLOR } from "./data";
import { hhmm } from "./engine";
import { minutesLabel } from "./insights";
import { ChartTable } from "./load-chart";

/**
 * "Waits today": one row per checked-in visit on a time axis — a grey bar from arrival to being
 * called in (amber past the 30-minute flag), then a bar in the discipline's colour while they're
 * with the practitioner, a hollow ring at the booked start, and the 09:40 "now" line. Bars join only
 * within one visit. Every time comes from the visit itself (arrival log, called-in and done times).
 */

export type WaitStage = "arrived" | "waiting" | "in-session" | "checkout" | "completed";

export type WaitRow = {
  id: string;
  token: string;
  /** patient name, or null when names are hidden (queue display) */
  name: string | null;
  discipline: Discipline;
  practitioner: string;
  stage: WaitStage;
  /** minutes from midnight */
  arrived: number;
  booked: number;
  called: number | null;
  done: number | null;
};

const FLAG = 30;
const ESCALATE = 45;
const TIP_W = 248;
const ROW_H = 36;
const BAR_H = 8;

const waitFill = (min: number) => (min >= ESCALATE ? "var(--color-danger)" : min >= FLAG ? "var(--color-warning)" : "var(--color-ink-2)");
const waitOpacity = (min: number) => (min >= FLAG ? 1 : 0.38);

/** Wait so far (still waiting) or until called in. */
export const waitOf = (r: WaitRow, now: number) => Math.max(0, (r.called ?? now) - r.arrived);
/** Time with the practitioner so far (in session / at checkout) or in total (done). Null before they're called. */
export const seenFor = (r: WaitRow, now: number) => (r.called === null ? null : Math.max(0, (r.done ?? now) - r.called));

export function WaitTimeline({ rows, now, onPick, className }: { rows: WaitRow[]; now: number; onPick?: (id: string) => void; className?: string }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const { active, markProps } = useMarks(rows.length, 0, onPick ? (i) => onPick(rows[i].id) : undefined, "y");

  const narrow = width > 0 && width < 560;
  const m = { t: 28, r: narrow ? 48 : 72, b: 28, l: narrow ? 64 : 200 };
  const height = m.t + m.b + rows.length * ROW_H;
  const iw = Math.max(0, width - m.l - m.r);

  const lo = Math.floor(Math.min(now, ...rows.map((r) => Math.min(r.arrived, r.booked))) / 30) * 30;
  const hi = Math.ceil(Math.max(now + 15, ...rows.map((r) => Math.max(r.booked, r.done ?? 0))) / 30) * 30;
  const sx = (min: number) => m.l + ((min - lo) / Math.max(1, hi - lo)) * iw;
  const step = iw / Math.max(1, (hi - lo) / 30) < 48 ? 60 : 30;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const nowX = sx(now);
  const tip = active !== null ? rows[active] : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div ref={wrap} className="relative w-full" style={{ height }} role="group" aria-label={`Waits today: ${rows.length} checked-in ${rows.length === 1 ? "visit" : "visits"}, arrival to called in to done`}>
        {width > 0 ? (
          <svg width={width} height={height} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t} aria-hidden="true">
                <line x1={sx(t)} x2={sx(t)} y1={m.t - 4} y2={height - m.b} stroke="var(--color-line)" strokeWidth={1} />
                <text x={sx(t)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px] tabular">
                  {hhmm(t)}
                </text>
              </g>
            ))}

            {rows.map((r, i) => {
              const y = m.t + i * ROW_H;
              const cy = y + ROW_H / 2;
              const wait = waitOf(r, now);
              const seen = seenFor(r, now);
              const wx0 = sx(r.arrived);
              const wx1 = sx(r.called ?? now);
              const sx0 = r.called !== null ? sx(r.called) + (wait > 0 ? 2 : 0) : 0;
              const sx1 = r.called !== null ? Math.max(sx0 + 4, sx(r.done ?? now)) : 0;
              const endX = r.called !== null ? sx1 : Math.max(wx1, wx0 + 4);
              const endLabel = r.stage === "completed" ? `done ${hhmm(r.done ?? now)}` : r.called === null ? minutesLabel(wait) : r.stage === "checkout" ? "checkout" : `in ${minutesLabel(seen ?? 0)}`;
              // Direct label after the bar end; hop over the booked ring when they would touch.
              const ringX = sx(r.booked);
              const labelW = endLabel.length * 6.4;
              let labelX = endX + 8;
              if (ringX > endX && ringX - 6 < labelX + labelW) labelX = ringX + 10;
              const labelEnd = labelX + labelW > width - 2;
              if (labelEnd) labelX = width - 2;
              return (
                <g
                  key={r.id}
                  {...markProps(i)}
                  role={onPick ? "button" : "img"}
                  aria-label={describe(r, now) + (onPick ? ". Show on the board" : "")}
                  className={cn("outline-none", onPick && "cursor-pointer")}
                  style={{ opacity: active !== null && active !== i ? 0.45 : 1, transition: "opacity 160ms var(--ease-out-quart)" }}
                >
                  {/* hit target: the full row, larger than the marks */}
                  <rect x={0} y={y} width={width} height={ROW_H} fill="transparent" />
                  {active === i ? <rect x={m.l - 8} y={y + 2} width={iw + 16} height={ROW_H - 4} rx={12} fill="var(--color-sunken)" /> : null}

                  {/* label column: token (machine-read → mono) and, on wider screens, the patient */}
                  <g aria-hidden="true">
                    <rect x={0} y={cy - 10} width={52} height={20} rx={10} fill={r.stage === "completed" ? "var(--color-sunken)" : "var(--color-charcoal)"} />
                    <text x={26} y={cy} dy="0.35em" textAnchor="middle" className={cn("font-mono text-[11px] tabular", r.stage === "completed" ? "fill-muted" : "fill-white")}>
                      {r.token}
                    </text>
                    {!narrow ? (
                      <text x={62} y={cy} dy="0.35em" className="fill-ink-2 text-xs">
                        {truncate(r.name ?? r.practitioner, 20)}
                      </text>
                    ) : null}
                  </g>

                  {/* waiting: arrival → called in (or now) */}
                  {wait > 0 ? <rect x={wx0} y={cy - BAR_H / 2} width={Math.max(2, wx1 - wx0)} height={BAR_H} rx={BAR_H / 2} fill={waitFill(wait)} fillOpacity={waitOpacity(wait)} /> : null}
                  {/* arrival tick, so a zero-minute wait still shows when they came in */}
                  <line x1={wx0} x2={wx0} y1={cy - 7} y2={cy + 7} stroke="var(--color-ink-2)" strokeWidth={1.5} strokeLinecap="round" />
                  {/* with the practitioner: called in → done (or now) */}
                  {r.called !== null ? <rect x={sx0} y={cy - BAR_H / 2} width={sx1 - sx0} height={BAR_H} rx={BAR_H / 2} fill={DISCIPLINE_COLOR[r.discipline]} /> : null}
                  {/* booked start: hollow ring with a surface halo */}
                  <circle cx={ringX} cy={cy} r={5} fill="var(--color-surface)" stroke="var(--color-surface)" strokeWidth={2} />
                  <circle cx={ringX} cy={cy} r={4} fill="var(--color-surface)" stroke="var(--color-ink-2)" strokeWidth={1.5} />

                  <text x={labelX} y={cy} dy="0.35em" textAnchor={labelEnd ? "end" : "start"} aria-hidden="true" stroke="var(--color-surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" className={cn("text-[11px] tabular", r.called === null && wait >= FLAG ? "fill-ink" : "fill-muted")}>
                    {endLabel}
                  </text>
                </g>
              );
            })}

            <g aria-hidden="true" className="pointer-events-none">
              <line x1={nowX} x2={nowX} y1={20} y2={height - m.b} stroke="var(--color-charcoal)" strokeWidth={1.5} />
              <rect x={Math.min(Math.max(nowX - 22, 0), width - 44)} y={2} width={44} height={18} rx={9} fill="var(--color-charcoal)" />
              <text x={Math.min(Math.max(nowX, 22), width - 22)} y={11} dy="0.35em" textAnchor="middle" className="fill-white font-mono text-[11px]">
                {hhmm(now)}
              </text>
            </g>
          </svg>
        ) : null}

        {tip && active !== null && width > 0 ? (
          <div
            className="pointer-events-none absolute z-10 rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop"
            style={{ left: tipLeft(Math.min(sx(tip.called ?? now), m.l + iw * 0.6), width, TIP_W), top: m.t + active * ROW_H + ROW_H, width: TIP_W }}
          >
            <p className="text-white/60">
              <span className="font-mono">{tip.token}</span>
              {tip.name ? ` · ${tip.name}` : ""}
            </p>
            <p className="mt-0.5 text-sm font-medium tabular">
              {tip.called === null ? `Waiting ${minutesLabel(waitOf(tip, now))} so far` : `Waited ${minutesLabel(waitOf(tip, now))}`}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 text-white/80 tabular">
              <li>
                Arrived {hhmm(tip.arrived)} · booked {hhmm(tip.booked)}
                {tip.arrived < tip.booked ? ` (${minutesLabel(tip.booked - tip.arrived)} early)` : tip.arrived > tip.booked ? ` (${minutesLabel(tip.arrived - tip.booked)} late)` : ""}
              </li>
              {tip.called !== null ? (
                <li>
                  {tip.stage === "completed" ? `With ${tip.practitioner} ${hhmm(tip.called)}–${hhmm(tip.done ?? now)}` : tip.stage === "checkout" ? `Seen by ${tip.practitioner} from ${hhmm(tip.called)} · now at checkout` : `With ${tip.practitioner} since ${hhmm(tip.called)}`}
                </li>
              ) : (
                <li>For {tip.practitioner}</li>
              )}
              <li className="flex items-center gap-2 text-white/60">
                <span className="h-0.5 w-3 rounded-full" style={{ background: DISCIPLINE_COLOR[tip.discipline] }} aria-hidden="true" />
                {DISCIPLINE_LABEL[tip.discipline]}
              </li>
            </ul>
            {onPick ? <p className="mt-2 text-white/60">Click to show on the board</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-ink-2/40" aria-hidden="true" />
            Waiting
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-warning" aria-hidden="true" />
            Waiting {FLAG}+ min
          </li>
          <li className="flex items-center gap-2">
            <span className="flex gap-px" aria-hidden="true">
              {(["medical", "nutrition", "movement"] as const).map((d) => (
                <span key={d} className="h-2 w-1.5 first:rounded-l-full last:rounded-r-full" style={{ background: DISCIPLINE_COLOR[d] }} />
              ))}
            </span>
            With practitioner (discipline colour)
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full border-[1.5px] border-ink-2 bg-surface" aria-hidden="true" />
            Booked time
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-[1.5px] rounded-full bg-ink-2" aria-hidden="true" />
            Arrived
          </li>
        </ul>
        <ChartTable
          caption="Waits today"
          head={["Token", "Arrived", "Booked", "Called in", "Done", "Wait"]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [r.name ? `${r.token} · ${r.name}` : r.token, hhmm(r.arrived), hhmm(r.booked), r.called !== null ? hhmm(r.called) : "—", r.done !== null ? hhmm(r.done) : "—", `${minutesLabel(waitOf(r, now))}${r.called === null ? " so far" : ""}`],
          }))}
        />
      </div>
    </div>
  );
}

function describe(r: WaitRow, now: number) {
  const who = r.name ? `${r.token}, ${r.name}` : r.token;
  const wait = waitOf(r, now);
  const base = `${who}: arrived ${hhmm(r.arrived)}, booked ${hhmm(r.booked)}`;
  if (r.called === null) return `${base}, waiting ${minutesLabel(wait)} so far${wait >= FLAG ? `, over ${FLAG} minutes` : ""}`;
  const seen = `with ${r.practitioner} from ${hhmm(r.called)}${r.done !== null ? ` to ${hhmm(r.done)}` : ""}`;
  return `${base}, waited ${minutesLabel(wait)}, ${seen}${r.stage === "checkout" ? ", now at checkout" : ""}`;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
