"use client";

import { useMemo, useState } from "react";
import type { Role } from "@/data/types";
import { getRecord } from "@/data/record";
import { patientById } from "@/data/patients";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DocValue } from "./data";
import type { CareDocument } from "./store";

/** Report wording → the label the same analyte carries on the patient record. */
const RECORD_LABEL: Record<string, string> = { "LDL cholesterol": "LDL-C", "HDL cholesterol": "HDL-C" };

type Point = { date: string; value: number; flag?: "high" | "low" | undefined; report?: boolean };
type Row = { label: string; unit: string | undefined; points: Point[]; earlier: number };

const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const fmtDate = (iso: string, withYear = true) => formatDate(`${iso.slice(0, 10)}T12:00:00+05:30`, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
const fmtValue = (n: number) => (Math.abs(n) < 10 && !Number.isInteger(n) ? String(Number(n.toFixed(2))) : String(Math.round(n * 10) / 10));

/**
 * Each reported value set against the same test's earlier readings on the patient's record
 * (getRecord): readings dated before this report, then the report itself. Rows share one time
 * axis; each has its own value scale. Patients only see readings already released to them.
 */
export function ValueTrends({ doc, values, role }: { doc: CareDocument; values: DocValue[]; role: Role }) {
  const rows = useMemo<Row[]>(() => {
    const record = doc.patientId ? getRecord(doc.patientId) : null;
    if (!record) return [];
    const events = record.events.filter((e) => (role === "patient" ? e.released : true) && e.date < doc.reportDate);
    return values
      .map((v) => {
        const value = Number(v.value);
        if (!Number.isFinite(value)) return null;
        const label = RECORD_LABEL[v.label] ?? v.label;
        const earlier: Point[] = events
          .flatMap((e) => (e.values ?? []).filter((x) => x.label === label).map((x) => ({ date: e.date, value: Number(x.value), flag: x.flag })))
          .filter((p) => Number.isFinite(p.value))
          .sort((a, b) => a.date.localeCompare(b.date));
        if (!earlier.length) return null;
        return { label: v.label, unit: v.unit, earlier: earlier.length, points: [...earlier, { date: doc.reportDate, value, flag: v.flag, report: true }] };
      })
      .filter((r): r is Row => !!r);
  }, [doc.patientId, doc.reportDate, values, role]);

  if (!rows.length) return null;
  const first = rows.reduce((m, r) => (r.points[0].date < m ? r.points[0].date : m), doc.reportDate);
  const t0 = day(first), t1 = day(doc.reportDate);
  const name = patientById(doc.patientId)?.name.split(" ")[0] ?? "the patient";

  return (
    <section aria-labelledby="value-trends" className="mt-6 rounded-inner bg-canvas p-4">
      <h4 id="value-trends" className="text-sm text-ink">
        Against {name}&apos;s earlier readings
      </h4>
      <p className="mt-0.5 text-xs text-muted">From the patient record · readings before this report, then this report · each row has its own scale</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <TrendRow key={r.label} row={r} t0={t0} t1={t1} />
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)_96px] gap-3 text-[11px] text-muted tabular" aria-hidden="true">
        <span />
        <span className="flex justify-between">
          <span>{fmtDate(first)}</span>
          <span>{fmtDate(doc.reportDate)}</span>
        </span>
        <span />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--color-ink-2)]" aria-hidden="true" />
          Earlier reading on the record
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
          This report
        </span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-2 underline-offset-2 hover:underline">Readings as a table</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">Readings for {rows.map((r) => r.label).join(", ")}</caption>
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="pb-1 font-normal">Test</th>
              <th scope="col" className="pb-1 font-normal">Date</th>
              <th scope="col" className="pb-1 text-right font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) =>
              r.points.map((p) => (
                <tr key={`${r.label}-${p.date}-${p.report ? "r" : "e"}`} className="border-t border-line">
                  <td className="py-1 text-ink-2">{r.label}</td>
                  <td className="py-1 text-ink-2 tabular">
                    {fmtDate(p.date)}
                    {p.report ? " · this report" : ""}
                  </td>
                  <td className="py-1 text-right text-ink tabular">
                    {fmtValue(p.value)} {r.unit}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const W = 240, H = 40, PAD = 6;

function TrendRow({ row, t0, t1 }: { row: Row; t0: number; t1: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = row.points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) || 1;
  const pts = row.points.map((p) => ({
    ...p,
    x: t1 > t0 ? PAD + ((day(p.date) - t0) / (t1 - t0)) * (W - PAD * 2) : W - PAD,
    y: PAD + (1 - (p.value - lo) / span) * (H - PAD * 2),
  }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const firstV = row.points[0].value, lastV = row.points[row.points.length - 1].value;
  const delta = lastV - firstV;
  const spoken = row.points.map((p) => `${fmtValue(p.value)} on ${fmtDate(p.date)}${p.report ? " (this report)" : ""}`).join(", ");
  const h = hover !== null ? pts[hover] : null;

  return (
    <li className="grid grid-cols-[112px_minmax(0,1fr)_96px] items-center gap-3">
      <span className="min-w-0">
        <span className="block truncate text-xs text-ink-2">{row.label}</span>
        <span className="block text-[11px] text-muted tabular">
          {row.earlier} earlier {row.earlier === 1 ? "reading" : "readings"}
        </span>
      </span>
      <span className="relative block">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-10 w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${row.label}${row.unit ? ` (${row.unit})` : ""}: ${spoken}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            let best = 0;
            pts.forEach((p, i) => (Math.abs(p.x - x) < Math.abs(pts[best].x - x) ? (best = i) : null));
            setHover(best);
          }}
          onPointerLeave={() => setHover(null)}
        >
          <path d={d} fill="none" stroke="var(--color-line-strong)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* markers in HTML so they stay round while the line stretches with the row */}
        {pts.map((p, i) => (
          <span
            key={`${p.date}-${i}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200",
              p.report ? "size-3 bg-primary shadow-[0_0_0_2px_var(--color-canvas)]" : "size-2.5 bg-surface shadow-[inset_0_0_0_2px_var(--color-ink-2)]",
              hover === i && "scale-125",
            )}
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          />
        ))}
        {h ? (
          <span
            className="pointer-events-none absolute bottom-full z-[2] mb-1 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-charcoal px-2 py-1 text-[11px] text-white shadow-pop tabular"
            style={{ left: `${Math.min(88, Math.max(12, (h.x / W) * 100))}%` }}
          >
            {fmtDate(h.date)} · {fmtValue(h.value)} {row.unit}
            {h.flag ? <span className="text-white/70"> · {h.flag === "high" ? "above" : "below"} range</span> : null}
            {h.report ? <span className="text-white/70"> · this report</span> : null}
          </span>
        ) : null}
      </span>
      <span className="text-right text-xs tabular">
        <span className="text-muted">{fmtValue(firstV)} → </span>
        <span className="text-ink">{fmtValue(lastV)}</span>
        <span className="block text-[11px] text-muted">
          {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${fmtValue(Math.abs(delta))}`} {row.unit}
        </span>
      </span>
    </li>
  );
}
