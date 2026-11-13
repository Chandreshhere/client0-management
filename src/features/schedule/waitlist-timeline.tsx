"use client";

import { cn } from "@/lib/cn";
import type { Discipline, Priority } from "@/data/types";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { tipLeft, useMarks, useWidth } from "./chart-utils";
import { DISCIPLINE_COLOR, NOW_MIN, PRIORITY_LABEL, TODAY_KEY } from "./data";
import { addDays, dateOf, dayLabel, hhmm, minOf, shortDay } from "./engine";

/**
 * "On the list → next slot" (ref 5 metro lines): one line per open request on a day axis. A dot
 * where the patient joined the list, a grey bar for the time they've waited up to now, then a
 * dashed line to the earliest slot the diary can offer them (the same search as the Offer dialog),
 * to the slot already offered, or to the edge when their practitioner is on leave. Lines only join
 * one request's own dates.
 */

export type Outlook =
  | { kind: "slot"; date: string; start: number; count: number; unit: "slot" | "place" }
  | { kind: "offered"; date: string; start: number }
  | { kind: "leave"; who: string; until: string; others: number }
  | { kind: "none"; label: string };

export type ListRow = {
  id: string;
  name: string;
  priority: Priority;
  want: string;
  discipline: Discipline;
  /** ISO, +05:30 wall clock */
  added: string;
  outlook: Outlook;
};

const ROW_H = 44;
const BAR_H = 8;
const TIP_W = 260;

const dayIndex = (date: string, base: string) => Math.round((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - Date.UTC(+base.slice(0, 4), +base.slice(5, 7) - 1, +base.slice(8, 10))) / 86_400_000);
/** Minutes since midnight on `base`. */
const at = (date: string, min: number, base: string) => dayIndex(date, base) * 1440 + min;

const waitedLabel = (mins: number) => {
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  return d >= 1 ? `${d} ${d === 1 ? "day" : "days"}${d < 3 && h ? ` ${h} h` : ""}` : h >= 1 ? `${h} h` : `${mins} min`;
};

export const outlookText = (o: Outlook) => {
  if (o.kind === "slot") return `next ${shortDay(o.date)} · ${hhmm(o.start)} · ${o.count} ${o.count === 1 ? o.unit : `${o.unit}s`}`;
  if (o.kind === "offered") return `offered ${shortDay(o.date)} · ${hhmm(o.start)} — awaiting reply`;
  if (o.kind === "leave") return `${o.who} back ${o.until}${o.others ? ` · ${o.others} slots with others` : ""}`;
  return o.label;
};

export function WaitlistTimeline({ rows, endDate, onPick, className }: { rows: ListRow[]; endDate: string; onPick?: (id: string) => void; className?: string }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const { active, markProps } = useMarks(rows.length, 0, onPick ? (i) => onPick(rows[i].id) : undefined, "y");

  const narrow = width > 0 && width < 560;
  const first = rows.reduce((d, r) => (dateOf(r.added) < d ? dateOf(r.added) : d), TODAY_KEY);
  const base = first < TODAY_KEY ? first : addDays(TODAY_KEY, -1);
  const days = dayIndex(endDate, base) + 1;
  const m = { t: 28, r: 8, b: 28, l: narrow ? 72 : 152 };
  const height = m.t + m.b + Math.max(1, rows.length) * ROW_H;
  const iw = Math.max(0, width - m.l - m.r);
  const span = days * 1440;
  const sx = (t: number) => m.l + (Math.max(0, Math.min(span, t)) / span) * iw;
  const dayW = iw / days;
  const now = at(TODAY_KEY, NOW_MIN, base);
  const nowX = sx(now);
  const tip = active !== null ? rows[active] : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div ref={wrap} className="relative w-full" style={{ height }} role="group" aria-label={`Time on the waitlist and the next slot for ${rows.length} open ${rows.length === 1 ? "request" : "requests"}`}>
        {width > 0 ? (
          <svg width={width} height={height} className="block overflow-visible">
            {Array.from({ length: days }, (_, i) => {
              const d = addDays(base, i);
              const x0 = m.l + i * dayW;
              const sunday = dayLabel(d, { weekday: "short" }) === "Sun";
              const showLabel = dayW >= 40 || i % 2 === (days - 1) % 2;
              return (
                <g key={d} aria-hidden="true">
                  {sunday ? <rect x={x0} y={m.t - 4} width={dayW} height={height - m.t - m.b + 4} fill="var(--color-sunken)" /> : null}
                  <line x1={x0} x2={x0} y1={m.t - 4} y2={height - m.b} stroke="var(--color-line)" strokeWidth={1} />
                  {showLabel ? (
                    <text x={x0 + dayW / 2} y={height - 8} textAnchor="middle" className={cn("text-[11px] tabular", d === TODAY_KEY ? "fill-ink" : "fill-muted")}>
                      {dayW >= 44 ? `${dayLabel(d, { weekday: "short" })} ${dayLabel(d, { day: "numeric" })}` : dayLabel(d, { day: "numeric" })}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {rows.map((r, i) => {
              const y = m.t + i * ROW_H;
              const cy = y + ROW_H / 2;
              const x0 = sx(at(dateOf(r.added), minOf(r.added), base));
              const o = r.outlook;
              const target = o.kind === "slot" || o.kind === "offered" ? sx(at(o.date, o.start, base)) : o.kind === "leave" ? m.l + iw : null;
              const label = o.kind === "slot" ? `${dayLabel(o.date, { weekday: "short" })} ${hhmm(o.start)}` : o.kind === "offered" ? "offered" : o.kind === "leave" ? `back ${o.until}` : o.label;
              const labelW = label.length * 6.4;
              const anchorX = target ?? nowX;
              // Inline after the mark when it fits; otherwise lifted above the line, flush right (never over the bars).
              const lifted = o.kind === "leave" || anchorX + 10 + labelW > width - 2;
              const labelX = lifted ? width - 2 : anchorX + 10;
              return (
                <g
                  key={r.id}
                  {...markProps(i)}
                  role={onPick ? "button" : "img"}
                  aria-label={`${r.name}, ${PRIORITY_LABEL[r.priority]} priority: ${r.want}. On the list ${waitedLabel(now - at(dateOf(r.added), minOf(r.added), base))}; ${outlookText(o)}${onPick ? ". Show in the list" : ""}`}
                  className={cn("outline-none", onPick && "cursor-pointer")}
                  style={{ opacity: active !== null && active !== i ? 0.45 : 1, transition: "opacity 160ms var(--ease-out-quart)" }}
                >
                  <rect x={0} y={y} width={width} height={ROW_H} fill="transparent" />
                  {active === i ? <rect x={m.l - 8} y={y + 2} width={iw + 12} height={ROW_H - 4} rx={12} fill="var(--color-sunken)" fillOpacity={0.7} /> : null}

                  <g aria-hidden="true">
                    <text x={0} y={cy - 7} dy="0.35em" className="fill-ink text-xs">
                      {truncate(narrow ? r.name.split(" ")[0] : r.name, narrow ? 10 : 20)}
                    </text>
                    <text x={0} y={cy + 8} dy="0.35em" className="fill-muted text-[11px]">
                      {PRIORITY_LABEL[r.priority]}
                      {narrow ? "" : ` · ${DISCIPLINE_LABEL[r.discipline]}`}
                    </text>
                  </g>

                  {/* time on the list so far */}
                  <rect x={x0} y={cy - BAR_H / 2} width={Math.max(BAR_H, nowX - x0)} height={BAR_H} rx={BAR_H / 2} fill="var(--color-ink-2)" fillOpacity={0.38} />
                  <circle cx={x0} cy={cy} r={5} fill="var(--color-ink-2)" stroke="var(--color-surface)" strokeWidth={2} />

                  {/* what comes next */}
                  {target !== null ? <line x1={nowX + 3} x2={target} y1={cy} y2={cy} stroke="var(--color-ink-2)" strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" /> : null}
                  {o.kind === "slot" ? <circle cx={target!} cy={cy} r={5.5} fill={DISCIPLINE_COLOR[r.discipline]} stroke="var(--color-surface)" strokeWidth={2} /> : null}
                  {o.kind === "offered" ? <circle cx={target!} cy={cy} r={5} fill="var(--color-surface)" stroke="var(--color-ink-2)" strokeWidth={1.5} /> : null}
                  {o.kind === "leave" ? <path d={`M${m.l + iw - 6},${cy - 4} L${m.l + iw},${cy} L${m.l + iw - 6},${cy + 4}`} fill="none" stroke="var(--color-ink-2)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /> : null}

                  <text x={labelX} y={lifted ? cy - 12 : cy} dy="0.35em" textAnchor={lifted ? "end" : "start"} aria-hidden="true" stroke="var(--color-surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" className="fill-muted text-[11px] tabular">
                    {label}
                  </text>
                </g>
              );
            })}

            <g aria-hidden="true" className="pointer-events-none">
              <line x1={nowX} x2={nowX} y1={20} y2={height - m.b} stroke="var(--color-charcoal)" strokeWidth={1.5} />
              <rect x={Math.min(Math.max(nowX - 22, 0), width - 44)} y={2} width={44} height={18} rx={9} fill="var(--color-charcoal)" />
              <text x={Math.min(Math.max(nowX, 22), width - 22)} y={11} dy="0.35em" textAnchor="middle" className="fill-white text-[11px]">
                Now
              </text>
            </g>
          </svg>
        ) : null}

        {tip && active !== null && width > 0 ? (
          <div className="pointer-events-none absolute z-10 rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop" style={{ left: tipLeft(Math.min(nowX, m.l + iw * 0.55), width, TIP_W), top: m.t + active * ROW_H + ROW_H, width: TIP_W }}>
            <p className="text-white/60">
              {tip.name} · {PRIORITY_LABEL[tip.priority]} priority
            </p>
            <p className="mt-0.5 text-sm font-medium tabular">On the list {waitedLabel(now - at(dateOf(tip.added), minOf(tip.added), base))}</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-white/80 tabular">
              <li className="truncate">{tip.want}</li>
              <li>
                Added {shortDay(dateOf(tip.added))}, {hhmm(minOf(tip.added))}
              </li>
              <li>{outlookText(tip.outlook).replace(/^./, (c) => c.toUpperCase())}</li>
            </ul>
            {onPick ? <p className="mt-2 text-white/60">Click to show in the list</p> : null}
          </div>
        ) : null}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-2">
          <span className="relative flex h-2 w-5 items-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-ink-2/40" />
            <span className="relative size-2.5 rounded-full bg-ink-2 ring-2 ring-surface" />
          </span>
          Joined the list → now
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4 border-t-[1.5px] border-dashed border-ink-2" aria-hidden="true" />
          <span className="flex gap-px" aria-hidden="true">
            {(["medical", "nutrition", "movement"] as const).map((d) => (
              <span key={d} className="size-2 rounded-full" style={{ background: DISCIPLINE_COLOR[d] }} />
            ))}
          </span>
          Earliest matching slot (discipline colour)
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full border-[1.5px] border-ink-2 bg-surface" aria-hidden="true" />
          Slot offered
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px] bg-sunken shadow-[inset_0_0_0_1px_var(--color-line)]" aria-hidden="true" />
          Sunday (closed)
        </li>
      </ul>
    </div>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
