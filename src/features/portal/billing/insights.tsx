"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { formatINR, pluralize } from "@/lib/format";
import { linear } from "@/components/charts/geometry";
import { Tip } from "@/components/ui/tooltip";
import { SectionLabel } from "@/components/viz/cards";
import type { PortalAppt } from "../appointments/data";
import { dayLabel, daysFromToday, longDate, nowIso, shortDate, threeLetterMonths } from "../time";
import {
  BURN,
  CLASS_DAY_NAMES,
  EXPIRES_AT,
  LAST_SESSION_AT,
  PACKAGE,
  PROGRAMME_REVIEW,
  UNDATED_USED,
  UNUSED_AT_EXPIRY,
  coverageGroups,
  phaseOf,
  type BurnPoint,
  type VisitPhase,
} from "./data";

/**
 * Billing figures. Both are read from the same appointments and package cells as the rest of the
 * page; every mark has a tooltip and the burn-down has a table view.
 */

// ---------------------------------------------------------------------------------------------
// "Will my sessions last?" — package burn-down with today / review / expiry markers
// ---------------------------------------------------------------------------------------------

type SegStyle = "known" | "undated" | "booked" | "forecast";

const segStyle = (a: BurnPoint, b: BurnPoint): SegStyle => {
  if (b.kind === "used") return a.n !== undefined && b.n !== undefined && b.n - a.n > 1 ? "undated" : "known";
  if (b.kind === "booked") return "booked";
  return "forecast";
};

const STROKE: Record<SegStyle, { color: string; dash?: string }> = {
  known: { color: "var(--color-primary)" },
  undated: { color: "var(--color-faint)", dash: "1 5" },
  booked: { color: "var(--color-primary)", dash: "6 5" },
  forecast: { color: "var(--color-faint)", dash: "6 5" },
};

const KIND_TEXT: Record<BurnPoint["kind"], string> = { used: "Attended", booked: "Booked", free: "Free · next class day", expiry: "Package expires" };

const t = (iso: string) => Date.parse(iso);

export function PackageBurnDown() {
  const titleId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!PACKAGE || !EXPIRES_AT || BURN.length < 2) return null;

  const m = { t: 28, r: 12, b: 28, l: 32 };
  const iw = Math.max(0, width - m.l - m.r);
  const x0 = t(BURN[0].at);
  const x1 = t(EXPIRES_AT);
  const sx = linear(x0, x1, m.l, m.l + iw);
  const wide = width >= 560;

  // month ticks (1st of each month inside the domain)
  const months: { at: number; label: string }[] = [];
  {
    const d = new Date(x0);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() <= x1) {
      months.push({ at: d.getTime(), label: threeLetterMonths(new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(d)) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }

  // date markers; a label that would overlap the one before it moves up a row
  const placed: { x0: number; x1: number; row: number }[] = [];
  const markers = [
    { id: "today", at: nowIso(), label: "Today", anchor: "middle" as const },
    ...(PROGRAMME_REVIEW && t(PROGRAMME_REVIEW.at) < x1 ? [{ id: "review", at: PROGRAMME_REVIEW.at, label: wide ? `Review · ${shortDate(PROGRAMME_REVIEW.at)}` : "Review", anchor: "end" as const }] : []),
    { id: "expiry", at: EXPIRES_AT, label: wide ? `Expires · ${shortDate(EXPIRES_AT)}` : "Expiry", anchor: "end" as const },
  ].map((mk) => {
    const x = sx(t(mk.at));
    const w = mk.label.length * 5.6; // ≈ 11px Geist
    const lx = mk.anchor === "end" ? x - 4 : x;
    const box = mk.anchor === "end" ? [lx - w, lx] : [lx - w / 2, lx + w / 2];
    const row = placed.some((p) => p.row === 0 && box[0] < p.x1 + 4 && box[1] > p.x0 - 4) ? 1 : 0;
    placed.push({ x0: box[0], x1: box[1], row });
    return { ...mk, x, lx, row };
  });
  if (markers.some((mk) => mk.row === 1)) m.t += 14;
  const H = 216 + (m.t - 28);
  const ih = H - m.t - m.b;
  const sy = linear(0, PACKAGE.total, m.t + ih, m.t);
  const yTicks = [0, Math.round(PACKAGE.total / 2), PACKAGE.total];

  const pts = BURN.map((p) => ({ ...p, x: sx(t(p.at)), y: sy(p.left) }));
  const sessionsPts = pts.filter((p) => p.kind !== "expiry");
  const focus = active === null ? null : sessionsPts[active];

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setActive((a) => {
      const n = sessionsPts.length;
      if (a === null) return e.key === "ArrowRight" ? 0 : n - 1;
      return Math.max(0, Math.min(n - 1, a + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };

  const lastDays = LAST_SESSION_AT ? daysFromToday(EXPIRES_AT) - daysFromToday(LAST_SESSION_AT) : 0;
  const summary = LAST_SESSION_AT
    ? `Yes — with time to spare. Sessions run out ${dayLabel(LAST_SESSION_AT)}, ${pluralize(lastDays, "day")} before the package expires on ${shortDate(EXPIRES_AT)}.`
    : UNUSED_AT_EXPIRY
      ? `Not all of them — ${pluralize(UNUSED_AT_EXPIRY, "session")} would still be unused when the package expires on ${longDate(EXPIRES_AT)}. Book them sooner to use them.`
      : "Every session is booked before the package expires.";

  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-4 rounded-card bg-surface p-6">
      <div>
        <SectionLabel className="mb-1">
          <span id={titleId}>Will my sessions last?</span>
        </SectionLabel>
        <p className="text-sm text-ink-2">{summary}</p>
      </div>

      <div
        ref={wrap}
        className="relative outline-none focus-visible:rounded-[12px] focus-visible:outline-2 focus-visible:outline-primary"
        style={{ height: H }}
        tabIndex={0}
        role="img"
        aria-label={`Sessions left in your ${PACKAGE.name} package: ${BURN.map((p) => `${shortDate(p.at)} ${p.left} left (${KIND_TEXT[p.kind].toLowerCase()})`).join("; ")}. Use left and right arrows to step through sessions.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {width > 0 ? (
          <svg width={width} height={H} className="block overflow-visible" aria-hidden="true">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={m.l + iw} y1={sy(v)} y2={sy(v)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={m.l - 8} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                  {v}
                </text>
              </g>
            ))}
            <text x={0} y={m.t - 12} className="fill-muted text-[11px]">
              Sessions left
            </text>
            {months.map((mo) => (
              <text key={mo.at} x={sx(mo.at)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {mo.label}
              </text>
            ))}
            {markers.map((mk) => (
              <g key={mk.id}>
                <line x1={mk.x} x2={mk.x} y1={m.t - 6 - mk.row * 14} y2={m.t + ih} stroke={mk.id === "today" ? "var(--color-ink-2)" : "var(--color-line-strong)"} strokeWidth={1} strokeDasharray={mk.id === "today" ? undefined : "2 3"} />
                <text x={mk.lx} y={m.t - 12 - mk.row * 14} textAnchor={mk.anchor} className={cn("text-[11px]", mk.id === "today" ? "fill-ink" : "fill-muted")}>
                  {mk.label}
                </text>
              </g>
            ))}
            {pts.slice(1).map((b, i) => {
              const a = pts[i];
              const s = STROKE[segStyle(a, b)];
              return <line key={`${a.at}-${b.at}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinecap="round" />;
            })}
            {sessionsPts.map((p, i) => (
              <circle
                key={p.at}
                cx={p.x}
                cy={p.y}
                r={active === i ? 6 : 4}
                fill={p.kind === "used" ? "var(--color-primary)" : "var(--color-surface)"}
                stroke={p.kind === "used" ? "var(--color-surface)" : p.kind === "booked" ? "var(--color-primary)" : "var(--color-faint)"}
                strokeWidth={2}
                style={{ transition: "r 160ms var(--ease-out-quart)" }}
              />
            ))}
            {focus ? <line x1={focus.x} x2={focus.x} y1={m.t} y2={m.t + ih} stroke="var(--color-ink-2)" strokeWidth={1} opacity={0.35} /> : null}
            <rect
              x={m.l}
              y={m.t}
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                const px = e.clientX - r.left;
                let best = 0;
                sessionsPts.forEach((p, i) => {
                  if (Math.abs(p.x - px) < Math.abs(sessionsPts[best].x - px)) best = i;
                });
                setActive(best);
              }}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        ) : null}
        {focus && width > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] rounded-[14px] bg-charcoal px-3 py-2 text-xs text-white shadow-pop"
            style={{ left: Math.max(0, Math.min(focus.x + 12, width - 170)), top: Math.max(0, focus.y - 64) }}
          >
            <div className="text-white/60">{dayLabel(focus.at)}</div>
            <div>{focus.label}</div>
            <div className="tabular text-white/80">{pluralize(focus.left, "session")} left</div>
          </div>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <LegendLine color="var(--color-primary)" label="Attended" />
        {UNDATED_USED.length ? <LegendLine color="var(--color-faint)" dash="1 4" label={`Sessions ${UNDATED_USED[0]}–${UNDATED_USED.at(-1)} (dates not listed)`} /> : null}
        <LegendLine color="var(--color-primary)" dash="5 4" label="Booked" />
        <LegendLine color="var(--color-faint)" dash="5 4" label={`Free · on your next ${CLASS_DAY_NAMES.join("/")} classes`} />
      </ul>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">Show as a table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-[12px] bg-canvas">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-3 py-2 font-normal">Date</th>
                <th scope="col" className="px-3 py-2 font-normal">Session</th>
                <th scope="col" className="px-3 py-2 font-normal">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Left</th>
              </tr>
            </thead>
            <tbody>
              {BURN.map((p) => (
                <tr key={p.at} className="border-t border-line text-ink-2">
                  <td className="px-3 py-2 tabular">{shortDate(p.at)}</td>
                  <td className="px-3 py-2 tabular">{p.n ?? "—"}</td>
                  <td className="px-3 py-2">{KIND_TEXT[p.kind]}</td>
                  <td className="px-3 py-2 text-right tabular">{p.left}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function LegendLine({ color, dash, label }: { color: string; dash?: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="20" height="8" aria-hidden="true" className="shrink-0">
        <line x1="1" x2="19" y1="4" y2="4" stroke={color} strokeWidth={2} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// "How your visits are covered" — one square per visit, grouped by what pays for it
// ---------------------------------------------------------------------------------------------

const PHASE_TEXT: Record<VisitPhase, string> = { done: "Attended", booked: "Booked", requested: "Requested", cancelled: "Cancelled" };

const PHASE_CLASS: Record<VisitPhase, string> = {
  done: "bg-ink",
  booked: "bg-surface shadow-[inset_0_0_0_2px_var(--color-ink)]",
  requested: "bg-surface outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-ink-2",
  cancelled: "bg-hatch bg-sunken",
};

export function VisitCoverage({ requests }: { requests: PortalAppt[] }) {
  const titleId = useId();
  const { total, groups } = coverageGroups(requests);
  const phases = (Object.keys(PHASE_TEXT) as VisitPhase[]).filter((p) => groups.some((g) => g.visits.some((v) => phaseOf(v) === p)));
  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-4 rounded-card bg-surface p-6">
      <div>
        <SectionLabel className="mb-1">
          <span id={titleId}>How your visits are covered</span>
        </SectionLabel>
        <p className="text-sm text-ink-2">Each square is one of the {pluralize(total, "visit")} on your Appointments page, grouped by what pays for it.</p>
      </div>
      <ul className="flex flex-col gap-4">
        {groups
          .filter((g) => g.visits.length)
          .map((g) => (
            <li key={g.id} className="flex flex-col gap-2">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink">{g.label}</span>
                <span className="shrink-0 text-xs text-muted tabular">
                  {g.visits.length}
                  {g.amount ? ` · ${formatINR(g.amount)}` : ""}
                </span>
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label={`${g.label}: ${pluralize(g.visits.length, "visit")}`}>
                {g.visits.map((v) => {
                  const ph = phaseOf(v);
                  const text = `${v.service} · ${dayLabel(v.start)} · ${PHASE_TEXT[ph]}`;
                  return (
                    <li key={v.id}>
                      <Tip label={text}>
                        <span tabIndex={0} role="img" aria-label={text} className={cn("block size-4 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-primary", PHASE_CLASS[ph])} />
                      </Tip>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
      </ul>
      <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {phases.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span className={cn("size-3 rounded-[3px]", PHASE_CLASS[p])} aria-hidden="true" />
            {PHASE_TEXT[p]}
          </li>
        ))}
      </ul>
    </section>
  );
}
