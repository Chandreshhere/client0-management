"use client";

import { useId } from "react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { intTicks, tipLeft, useMarks, useWidth } from "./chart-utils";
import { DISCIPLINE_COLOR, TODAY_KEY, type Service } from "./data";
import { hhmm, hoursLabel } from "./engine";
import { lunchExcluded, minutesLabel, type Utilisation } from "./insights";

/**
 * Practitioner utilisation as capacity columns: each column's height is that practitioner's
 * working time (profile hours, lunch excluded), the solid fill is booked time in their discipline
 * colour, so the unfilled part is free time. Utilisation (booked ÷ working) is printed on top. A
 * hatched cap marks minutes booked outside their profile hours. Picking a column books their next
 * free 30-minute slot.
 */

export type CapacityItem = {
  util: Utilisation;
  /** next free start for `duration` minutes (day view, today or later) */
  next: number | null;
  duration: number;
  /** the service that slot is sized for (the practitioner's shortest) */
  service?: Service;
};

const TIP_W = 248;
const firstName = (name: string) => name.replace(/^Dr\.?\s+/, "").split(" ")[0];

export function CapacityChart({
  items,
  date,
  single,
  height = 216,
  onBook,
  className,
}: {
  items: CapacityItem[];
  /** the day being shown (day view); undefined for a week */
  date?: string;
  /** true when the period is one day (next-free slots and hours are per day) */
  single: boolean;
  height?: number;
  onBook?: (item: CapacityItem) => void;
  className?: string;
}) {
  const hatchId = useId().replace(/:/g, "");
  const [wrap, width] = useWidth<HTMLDivElement>();
  const bookable = (i: number) => single && items[i]?.next !== null && items[i]?.next !== undefined && !!onBook;
  const { active, markProps } = useMarks(items.length, 0, (i) => {
    const it = items[i];
    if (bookable(i)) onBook?.(it);
  });

  const maxMin = Math.max(60, ...items.map((it) => it.util.workMin + it.util.outsideMin));
  const ticksH = intTicks(Math.ceil(maxMin / 60));
  const yMax = ticksH[ticksH.length - 1] * 60;
  const m = { t: 24, r: 4, b: 48, l: 32 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const band = items.length ? iw / items.length : 0;
  const bw = Math.min(24, band * 0.5);
  const sy = (min: number) => m.t + ih - (min / (yMax || 1)) * ih;
  const tip = active !== null ? items[active] : null;

  const column = (x: number, yTop: number, yBottom: number, fill: string) => {
    const h = Math.max(0, yBottom - yTop);
    const r = Math.min(4, h);
    return <path d={`M${x - bw / 2},${yBottom} V${yTop + r} Q${x - bw / 2},${yTop} ${x - bw / 2 + r},${yTop} H${x + bw / 2 - r} Q${x + bw / 2},${yTop} ${x + bw / 2},${yTop + r} V${yBottom} Z`} fill={fill} />;
  };

  return (
    <div ref={wrap} className={cn("relative w-full", className)} style={{ height }} role="group" aria-label={`Utilisation by practitioner: booked time as a share of working time${single ? "" : " this week"}`}>
      {width > 0 ? (
        <svg width={width} height={height - m.b + 4} className="block overflow-visible">
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--color-surface)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-ink-2)" strokeWidth="1.5" />
            </pattern>
          </defs>
          {ticksH.map((t) => (
            <g key={t} aria-hidden="true">
              <line x1={m.l} x2={m.l + iw} y1={sy(t * 60)} y2={sy(t * 60)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={m.l - 8} y={sy(t * 60)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                {t} h
              </text>
            </g>
          ))}
          {items.map((it, i) => {
            const u = it.util;
            const cx = m.l + band * i + band / 2;
            const base = sy(0);
            const trackTop = sy(u.workMin);
            const fillTop = sy(u.bookedMin);
            const capTop = sy(u.workMin + u.outsideMin);
            const pctLabel = u.pct === null ? "—" : `${u.pct}%`;
            const canBook = bookable(i);
            const slotName = `${it.duration}-minute${it.service ? ` ${it.service.label.toLowerCase()}` : ""} slot`;
            const nextText = single ? (it.next !== null ? `Next free ${slotName} at ${hhmm(it.next)}${canBook ? ", press Enter to book it" : ""}` : date && date < TODAY_KEY ? "Day has passed" : `No free ${it.duration}-minute slot left in their hours`) : "";
            return (
              <g
                key={u.staff.id}
                {...markProps(i)}
                role={canBook ? "button" : "img"}
                aria-label={`${u.staff.name}: ${pctLabel} of working time booked — ${minutesLabel(u.bookedMin)} of ${minutesLabel(u.workMin)}${u.outsideMin ? `, plus ${minutesLabel(u.outsideMin)} outside their hours` : ""}. ${nextText}`}
                className={cn("outline-none", canBook && "cursor-pointer")}
                style={{ opacity: active !== null && active !== i ? 0.5 : 1, transition: "opacity 160ms var(--ease-out-quart)" }}
              >
                <rect x={m.l + band * i} y={m.t - 20} width={band} height={ih + 20 + m.b - 4} fill="transparent" />
                {active === i ? <rect x={cx - bw / 2 - 6} y={capTop - 22} width={bw + 12} height={base - capTop + 26} rx={10} fill="var(--color-canvas)" /> : null}
                {u.workMin > 0 ? column(cx, trackTop, base, "var(--color-sunken-2)") : null}
                {u.bookedMin > 0 ? column(cx, fillTop, base, DISCIPLINE_COLOR[u.staff.discipline]) : null}
                {u.outsideMin > 0 ? column(cx, capTop, trackTop - 2, `url(#${hatchId})`) : null}
                <text x={cx} y={capTop - 8} textAnchor="middle" className="fill-ink text-[11px] tabular" aria-hidden="true">
                  {pctLabel}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}

      {/* who each column is: avatar + first name, aligned to the columns */}
      {width > 0 ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: height - m.b + 8 }}>
          {items.map((it, i) => (
            <div key={it.util.staff.id} className="absolute flex flex-col items-center gap-1" style={{ left: m.l + band * i, width: band }}>
              <Avatar src={it.util.staff.avatar} name={it.util.staff.name} size="xs" />
              <span className={cn("max-w-full truncate px-0.5 text-[11px]", active === i ? "text-ink" : "text-muted")}>{firstName(it.util.staff.name)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tip && active !== null && width > 0 ? (
        <div className="pointer-events-none absolute top-0 z-10 rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop" style={{ left: tipLeft(m.l + band * active + band / 2, width, TIP_W), width: TIP_W }}>
          <p className="text-white/60">
            {tip.util.staff.name} · {DISCIPLINE_LABEL[tip.util.staff.discipline]}
          </p>
          <p className="mt-0.5 text-sm font-medium tabular">{tip.util.pct === null ? "Not working" : `${tip.util.pct}% booked`}</p>
          <p className="mt-1 text-white/80">
            {minutesLabel(tip.util.bookedMin)} of {minutesLabel(tip.util.workMin)} working time
            {single && tip.util.hours ? ` (${hoursLabel(tip.util.hours)}${lunchExcluded(tip.util.hours) ? ", lunch excluded" : ""})` : ""}
          </p>
          <p className="text-white/80">{minutesLabel(Math.max(0, tip.util.workMin - tip.util.bookedMin))} free</p>
          {tip.util.outsideMin ? <p className="text-white/80">+ {minutesLabel(tip.util.outsideMin)} booked outside profile hours</p> : null}
          {single ? (
            <p className="mt-2 text-white/60">
              {tip.next !== null
                ? `Next free ${tip.duration} min${tip.service ? ` (${tip.service.label})` : ""}: ${hhmm(tip.next)}${onBook ? " · click to book" : ""}`
                : date && date < TODAY_KEY
                  ? "This day has passed"
                  : `No free ${tip.duration}-minute slot left in their hours`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
