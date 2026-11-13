import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Fill, PlatePart, PlateSpec } from "./data";

/**
 * Procedural meal "photo" — a top-down SVG render standing in for a patient's photo (no stock
 * imagery). Deterministic: every speck comes from a seeded RNG, so server and client match.
 */

const FILL: Record<Fill, { base: string; hi: string; speck: string }> = {
  sambar: { base: "#c9772f", hi: "#e3a05c", speck: "#7d4318" },
  dal: { base: "#deb03f", hi: "#f2d07a", speck: "#6e5212" },
  curd: { base: "#f1ede2", hi: "#ffffff", speck: "#d8d0bd" },
  chutney: { base: "#5c984a", hi: "#86b86e", speck: "#2c5a24" },
  rajma: { base: "#7a2e22", hi: "#a5503a", speck: "#4a1810" },
  sabzi: { base: "#7d983c", hi: "#a6bc60", speck: "#46601e" },
  soup: { base: "#d6a463", hi: "#ecc792", speck: "#946229" },
  chai: { base: "#b4855a", hi: "#d3ad84", speck: "#86603f" },
  malt: { base: "#8d6c60", hi: "#b09183", speck: "#5b443a" },
  cabbage: { base: "#c8d488", hi: "#e3eab4", speck: "#8a9c46" },
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** points scattered inside a circle */
function scatter(rand: () => number, n: number, cx: number, cy: number, radius: number) {
  return Array.from({ length: n }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * radius;
    return { x: r2(cx + Math.cos(a) * d), y: r2(cy + Math.sin(a) * d), a: r2((a * 180) / Math.PI), k: rand() };
  });
}

/** irregular round blob (chilla, bhurji heap) */
function blob(rand: () => number, cx: number, cy: number, radius: number, wobble = 0.08, steps = 18) {
  const pts = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const rr = radius * (1 - wobble + rand() * wobble * 2);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const;
  });
  // smooth closed path through midpoints (quadratic)
  const mid = (p: readonly [number, number], q: readonly [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
  const start = mid(pts[steps - 1], pts[0]);
  let d = `M${r2(start[0])},${r2(start[1])}`;
  for (let i = 0; i < steps; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % steps]);
    d += ` Q${r2(p[0])},${r2(p[1])} ${r2(m[0])},${r2(m[1])}`;
  }
  return `${d} Z`;
}

export function Plate({ spec, seed, className }: { spec: PlateSpec; seed: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (k: string) => `${uid}-${k}`;
  const tableRand = rng(`${seed}-table`);

  return (
    <svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Photo (illustrative render): ${spec.alt}`} className={cn("block h-auto w-full", className)}>
      <defs>
        <linearGradient id={id("table")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ece6dc" />
          <stop offset="1" stopColor="#ddd5c8" />
        </linearGradient>
        <radialGradient id={id("vignette")} cx="0.5" cy="0.48" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2a18" stopOpacity="0.16" />
        </radialGradient>
        <radialGradient id={id("steel")} cx="0.42" cy="0.38" r="0.68">
          <stop offset="0" stopColor="#f6f7f7" />
          <stop offset="0.62" stopColor="#dde0e2" />
          <stop offset="0.9" stopColor="#c2c7ca" />
          <stop offset="1" stopColor="#a9afb3" />
        </radialGradient>
        <radialGradient id={id("ceramic")} cx="0.44" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fdfcf9" />
          <stop offset="0.8" stopColor="#f3f0ea" />
          <stop offset="1" stopColor="#e2ddd4" />
        </radialGradient>
        <linearGradient id={id("tray")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef0f1" />
          <stop offset="1" stopColor="#c4c9cc" />
        </linearGradient>
        <filter id={id("shadow")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* table surface with faint linen grain */}
      <rect width="240" height="180" fill={`url(#${id("table")})`} />
      {Array.from({ length: 14 }, (_, i) => {
        const y = r2(tableRand() * 180);
        return <line key={i} x1="0" x2="240" y1={y} y2={r2(y + (tableRand() - 0.5) * 18)} stroke="#a08868" strokeOpacity={r2(0.04 + tableRand() * 0.05)} strokeWidth="0.6" />;
      })}

      <Vessel kind={spec.vessel} id={id} />

      {spec.parts.map((p, i) => (
        <Part key={i} part={p} seed={`${seed}-${i}`} id={id} />
      ))}

      <rect width="240" height="180" fill={`url(#${id("vignette")})`} />
    </svg>
  );
}

function Vessel({ kind, id }: { kind: PlateSpec["vessel"]; id: (k: string) => string }) {
  if (kind === "none") return null;
  if (kind === "tray") {
    return (
      <g>
        <rect x="26" y="30" width="196" height="134" rx="16" fill="#3a2a18" opacity="0.2" filter={`url(#${id("shadow")})`} />
        <rect x="22" y="24" width="196" height="134" rx="16" fill={`url(#${id("tray")})`} stroke="#a9afb3" strokeWidth="1.2" />
        <rect x="32" y="34" width="92" height="114" rx="12" fill="#d3d7da" stroke="#b9bfc3" strokeWidth="0.8" />
        <circle cx="152" cy="58" r="24" fill="#d3d7da" stroke="#b9bfc3" strokeWidth="0.8" />
        <circle cx="184" cy="104" r="24" fill="#d3d7da" stroke="#b9bfc3" strokeWidth="0.8" />
        <rect x="128" y="104" width="34" height="42" rx="10" fill="#d3d7da" stroke="#b9bfc3" strokeWidth="0.8" />
      </g>
    );
  }
  const r = kind === "thali" ? 80 : kind === "plate" ? 76 : 58;
  const fill = kind === "plate" ? `url(#${id("ceramic")})` : `url(#${id("steel")})`;
  return (
    <g>
      <ellipse cx="125" cy="99" rx={r + 2} ry={r} fill="#3a2a18" opacity="0.22" filter={`url(#${id("shadow")})`} />
      <circle cx="120" cy="92" r={r} fill={fill} stroke={kind === "plate" ? "#ddd7cc" : "#a9afb3"} strokeWidth="1.2" />
      {kind === "thali" ? <circle cx="120" cy="92" r={r - 9} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" /> : null}
      {kind === "plate" ? <circle cx="120" cy="92" r={r - 16} fill="none" stroke="#000" strokeOpacity="0.05" strokeWidth="1" /> : null}
      {kind === "bowl" ? <circle cx="120" cy="92" r={r - 7} fill="#cdd2d5" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" /> : null}
    </g>
  );
}

function Part({ part, seed, id }: { part: PlatePart; seed: string; id: (k: string) => string }): ReactNode {
  // The RNG is created inside render from a seed string, so StrictMode's double render and the
  // server render produce identical specks (a shared closure would advance between renders).
  const rand = rng(seed);
  switch (part.k) {
    case "katori":
      return <Katori x={part.x} y={part.y} r={part.r ?? 18} fill={part.fill} seed={seed} gid={id(`k${part.x}${part.y}`)} />;
    case "idli":
      return (
        <g>
          <ellipse cx={part.x + 1.5} cy={part.y + 2} rx="15" ry="12" fill="#000" opacity="0.08" />
          <ellipse cx={part.x} cy={part.y} rx="15" ry="12" fill="#f7f3e8" />
          {scatter(rand, 10, part.x, part.y, 10).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={r2(0.5 + p.k * 0.5)} fill="#d9d0bb" />
          ))}
        </g>
      );
    case "roti": {
      const r = part.r ?? 26;
      return (
        <g>
          <circle cx={part.x + 1.5} cy={part.y + 2} r={r} fill="#000" opacity="0.08" />
          <circle cx={part.x} cy={part.y} r={r} fill="#ddb57c" />
          <circle cx={part.x} cy={part.y} r={r - 2} fill="none" stroke="#c99a5c" strokeOpacity="0.6" strokeWidth="1.4" />
          {scatter(rand, 18, part.x, part.y, r - 4).map((p, i) => (
            <ellipse key={i} cx={p.x} cy={p.y} rx={r2(1.2 + p.k * 2.4)} ry={r2(0.8 + p.k * 1.4)} transform={`rotate(${p.a} ${p.x} ${p.y})`} fill="#93582a" opacity={r2(0.25 + p.k * 0.35)} />
          ))}
        </g>
      );
    }
    case "chilla": {
      const r = part.r ?? 28;
      return (
        <g>
          <path d={blob(rand, part.x + 1.5, part.y + 2, r)} fill="#000" opacity="0.08" />
          <path d={blob(rand, part.x, part.y, r)} fill="#e0b257" />
          <path d={blob(rand, part.x, part.y, r - 5, 0.12)} fill="#d39c3c" opacity="0.45" />
          {scatter(rand, 16, part.x, part.y, r - 5).map((p, i) =>
            i % 3 === 0 ? (
              <ellipse key={i} cx={p.x} cy={p.y} rx="1.8" ry="0.9" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill="#3f7a2d" />
            ) : (
              <circle key={i} cx={p.x} cy={p.y} r={r2(0.6 + p.k)} fill="#9a5f22" opacity="0.5" />
            ),
          )}
        </g>
      );
    }
    case "rice": {
      const r = part.r ?? 32;
      return (
        <g>
          <circle cx={part.x + 1.5} cy={part.y + 2.5} r={r} fill="#000" opacity="0.08" />
          <circle cx={part.x} cy={part.y} r={r} fill="#f6f3ea" />
          {scatter(rand, 70, part.x, part.y, r - 2).map((p, i) => (
            <ellipse key={i} cx={p.x} cy={p.y} rx="2.4" ry="0.95" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill={p.k > 0.5 ? "#ffffff" : "#e2dccd"} />
          ))}
        </g>
      );
    }
    case "salad": {
      const r = part.r ?? 20;
      return (
        <g>
          {scatter(rand, 9, part.x, part.y, r).map((p, i) =>
            i % 3 === 0 ? (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill="#d7e8ad" stroke="#5f9234" strokeWidth="1" />
                <circle cx={p.x} cy={p.y} r="1.6" fill="#b9d68a" />
              </g>
            ) : i % 3 === 1 ? (
              <circle key={i} cx={p.x} cy={p.y} r="4.4" fill="#d6463a" stroke="#f08a74" strokeWidth="1" />
            ) : (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="none" stroke="#d8b2cf" strokeWidth="1.2" />
            ),
          )}
          {scatter(rand, 6, part.x, part.y, r).map((p, i) => (
            <ellipse key={`l${i}`} cx={p.x} cy={p.y} rx="2" ry="1" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill="#3e7d32" />
          ))}
        </g>
      );
    }
    case "fruit": {
      const colors = { guava: ["#f2908a", "#7aa94a"], papaya: ["#f39a4c", "#e5803a"], apple: ["#f6ebc9", "#c8423a"] }[part.fill];
      return (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const a = -40 + i * 26;
            return (
              <g key={i} transform={`rotate(${a} ${part.x} ${part.y})`}>
                <path d={`M${part.x},${part.y} l14,-5 a15,15 0 0 1 0,10 z`} fill={colors[0]} stroke={colors[1]} strokeWidth="1.4" />
              </g>
            );
          })}
        </g>
      );
    }
    case "bhurji": {
      const r = part.r ?? 28;
      return (
        <g>
          <path d={blob(rand, part.x + 1.5, part.y + 2, r, 0.14)} fill="#000" opacity="0.07" />
          {scatter(rand, 46, part.x, part.y, r - 3).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={r2(2 + p.k * 2.6)} fill={p.k > 0.6 ? "#f2cf5e" : p.k > 0.25 ? "#e7b83f" : "#f6dd84"} />
          ))}
          {scatter(rand, 12, part.x, part.y, r - 6).map((p, i) => (
            <circle key={`f${i}`} cx={p.x} cy={p.y} r="1" fill={i % 2 ? "#3f7a2d" : "#d6463a"} />
          ))}
        </g>
      );
    }
    case "samosa": {
      const rot = part.rot ?? 0;
      return (
        <g transform={`rotate(${rot} ${part.x} ${part.y})`}>
          <path d={`M${part.x - 17},${part.y + 13} Q${part.x},${part.y - 26} ${part.x + 17},${part.y + 13} Q${part.x},${part.y + 18} ${part.x - 17},${part.y + 13} Z`} fill="#000" opacity="0.1" transform="translate(1.5 2)" />
          <path d={`M${part.x - 17},${part.y + 13} Q${part.x},${part.y - 26} ${part.x + 17},${part.y + 13} Q${part.x},${part.y + 18} ${part.x - 17},${part.y + 13} Z`} fill="#d99a48" stroke="#b9772c" strokeWidth="1" />
          <path d={`M${part.x - 12},${part.y + 12} Q${part.x},${part.y + 15.5} ${part.x + 12},${part.y + 12}`} fill="none" stroke="#9c5f20" strokeWidth="1.2" strokeDasharray="2 2" />
          {scatter(rand, 8, part.x, part.y + 2, 9).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="0.9" fill="#a8681f" opacity="0.6" />
          ))}
        </g>
      );
    }
    case "papad": {
      const r = part.r ?? 20;
      return (
        <g>
          <circle cx={part.x} cy={part.y} r={r} fill="#efd9a6" stroke="#d9bd7f" strokeWidth="0.8" />
          {scatter(rand, 22, part.x, part.y, r - 2).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={r2(0.5 + p.k * 1.4)} fill={i % 4 === 0 ? "#3b2a1c" : "#c49a55"} opacity={i % 4 === 0 ? 0.7 : 0.6} />
          ))}
        </g>
      );
    }
    case "sprouts": {
      const r = part.r ?? 46;
      return (
        <g>
          <circle cx={part.x} cy={part.y} r={r} fill="#d6cba0" />
          {scatter(rand, 60, part.x, part.y, r - 3).map((p, i) => (
            <g key={i}>
              <ellipse cx={p.x} cy={p.y} rx="3" ry="2.1" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill={p.k > 0.5 ? "#efe6c3" : "#e3d6a6"} />
              {p.k > 0.55 ? <line x1={p.x} y1={p.y} x2={r2(p.x + 3.5)} y2={r2(p.y - 2)} stroke="#7fb24a" strokeWidth="0.9" strokeLinecap="round" /> : null}
            </g>
          ))}
          {scatter(rand, 12, part.x, part.y, r - 6).map((p, i) => (
            <rect key={`t${i}`} x={p.x} y={p.y} width="3.4" height="3.4" rx="0.6" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill={i % 3 ? "#d6463a" : "#e9d1e5"} />
          ))}
          {scatter(rand, 10, part.x, part.y, r - 6).map((p, i) => (
            <ellipse key={`c${i}`} cx={p.x} cy={p.y} rx="2.2" ry="1.1" transform={`rotate(${p.a} ${p.x} ${p.y})`} fill="#3e7d32" />
          ))}
        </g>
      );
    }
    case "dates":
      return (
        <g>
          {[0, 1].map((i) => {
            const x = part.x + i * 14;
            const y = part.y + (i ? 8 : 0);
            return (
              <g key={i} transform={`rotate(${i ? 28 : -18} ${x} ${y})`}>
                <ellipse cx={x + 1} cy={y + 2} rx="13" ry="6.5" fill="#000" opacity="0.12" />
                <ellipse cx={x} cy={y} rx="13" ry="6.5" fill="#6b2f1b" />
                <path d={`M${x - 8},${y - 2} q8,3 16,0`} fill="none" stroke="#9a5634" strokeWidth="0.9" opacity="0.8" />
                <path d={`M${x - 7},${y + 2} q7,2 14,0`} fill="none" stroke="#4a1d10" strokeWidth="0.8" opacity="0.7" />
              </g>
            );
          })}
        </g>
      );
    case "cup":
      return (
        <g>
          <circle cx={part.x + 2} cy={part.y + 3} r="30" fill="#000" opacity="0.12" />
          <circle cx={part.x} cy={part.y} r="30" fill="#f7f4ee" stroke="#e1dbcf" strokeWidth="1" />
          <rect x={part.x + 17} y={part.y - 5} width="16" height="10" rx="5" fill="#f2eee6" stroke="#ddd6c9" strokeWidth="1" />
          <circle cx={part.x} cy={part.y} r="21" fill="#ffffff" stroke="#e1dbcf" strokeWidth="1.2" />
          <circle cx={part.x} cy={part.y} r="17" fill={FILL[part.fill].base} />
          <ellipse cx={part.x - 5} cy={part.y - 6} rx="7" ry="3" fill={FILL[part.fill].hi} opacity="0.55" />
        </g>
      );
  }
}

function Katori({ x, y, r, fill, seed, gid }: { x: number; y: number; r: number; fill: Fill; seed: string; gid: string }) {
  const rand = rng(`${seed}-katori`);
  const c = FILL[fill];
  const inner = r * 0.8;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="1" stopColor={c.base} />
        </radialGradient>
      </defs>
      <circle cx={x + 1.5} cy={y + 2.5} r={r} fill="#000" opacity="0.12" />
      <circle cx={x} cy={y} r={r} fill="#c9ced1" stroke="#a9afb3" strokeWidth="1" />
      <circle cx={x} cy={y} r={r - 1.6} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
      <circle cx={x} cy={y} r={inner} fill={`url(#${gid})`} />
      {scatter(rand, Math.round(inner * 0.9), x, y, inner - 2).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={r2(0.5 + p.k * (fill === "rajma" ? 2.2 : 1.1))} fill={c.speck} opacity={r2(0.35 + p.k * 0.4)} />
      ))}
      <ellipse cx={x - inner * 0.35} cy={y - inner * 0.4} rx={inner * 0.4} ry={inner * 0.16} fill="#ffffff" opacity="0.28" />
    </g>
  );
}
