import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Procedural, clearly-illustrative sagittal T2 lumbar MRI (no real imaging), drawn in the same
 * language as the shared ScanThumb: vertebral bodies L1–L5 and the sacrum along a lordotic curve,
 * bright discs and CSF, and — matching the report it illustrates — a darker L4–L5 disc bulging
 * back into the canal. Used only for documents whose title says they are lumbar spine MRIs.
 */
export function SpineMriThumb({ className, title, bulgeLevel = 3 }: { className?: string; title?: string; bulgeLevel?: number }) {
  const uid = useId().replace(/:/g, "");
  const noise = `${uid}-n`, soft = `${uid}-s`, vig = `${uid}-v`;
  // centres of L1..L5 and the sacrum, following a gentle lordosis (anterior = left)
  const bodies = [
    { x: 64, y: 4 },
    { x: 68, y: 25 },
    { x: 71, y: 46 },
    { x: 71, y: 67 },
    { x: 68, y: 88 },
  ];
  const sacrum = { x: 60, y: 110 };
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={cn("block size-full bg-black", className)} role="img" aria-label={title ?? "Illustrative lumbar spine MRI"}>
      <defs>
        <filter id={noise} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={11} result="t" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.5" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={soft}>
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <radialGradient id={vig} cx="50%" cy="50%" r="65%">
          <stop offset="58%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.88" />
        </radialGradient>
      </defs>

      {/* soft tissue of the back and abdomen */}
      <rect x="0" y="0" width="160" height="120" fill="#171717" />
      <ellipse cx="86" cy="60" rx="78" ry="70" fill="#3a3a3a" filter={`url(#${soft})`} />
      <ellipse cx="86" cy="60" rx="78" ry="70" fill="#8e8e8e" filter={`url(#${noise})`} />
      {/* subcutaneous fat (bright on T2) behind the spine */}
      <path d="M128 -4 C140 30 142 80 128 124 L150 124 C160 80 160 30 150 -4 Z" fill="#cfcfcf" opacity="0.55" filter={`url(#${soft})`} />

      {/* CSF column (bright) posterior to the bodies */}
      <path d="M86 -4 C92 20 96 46 95 70 C94 90 88 108 82 124" stroke="#ececec" strokeWidth="9" fill="none" filter={`url(#${soft})`} opacity="0.9" />
      {/* cauda equina roots inside the canal */}
      <path d="M88 10 C93 34 95 56 94 76 C93 94 88 108 84 122" stroke="#9a9a9a" strokeWidth="1.2" fill="none" opacity="0.7" />

      {/* posterior elements / spinous processes */}
      {bodies.map((b, i) => (
        <ellipse key={`sp-${i}`} cx={b.x + 46} cy={b.y + 10} rx="9" ry="6" fill="#6d6d6d" filter={`url(#${soft})`} />
      ))}

      {/* vertebral bodies */}
      {bodies.map((b, i) => (
        <rect key={`vb-${i}`} x={b.x - 15} y={b.y - 8} width="30" height="16" rx="4" fill="#9c9c9c" filter={`url(#${soft})`} transform={`rotate(${-6 + i * 3} ${b.x} ${b.y})`} />
      ))}
      <path d={`M${sacrum.x - 18} ${sacrum.y - 6} Q${sacrum.x} ${sacrum.y - 12} ${sacrum.x + 16} ${sacrum.y - 4} L${sacrum.x + 10} ${sacrum.y + 16} L${sacrum.x - 20} ${sacrum.y + 14} Z`} fill="#8a8a8a" filter={`url(#${soft})`} />

      {/* discs: hydrated (bright) except the level the report describes */}
      {bodies.map((b, i) => {
        const next = i < bodies.length - 1 ? bodies[i + 1] : sacrum;
        const cx = (b.x + next.x) / 2;
        const cy = (b.y + next.y) / 2;
        const degenerate = i === bulgeLevel;
        return (
          <g key={`d-${i}`} transform={`rotate(${-4 + i * 3} ${cx} ${cy})`}>
            <ellipse cx={cx} cy={cy} rx="14" ry="2.6" fill={degenerate ? "#5c5c5c" : "#dcdcdc"} filter={`url(#${soft})`} />
            {degenerate ? <ellipse cx={cx + 15} cy={cy} rx="4.5" ry="3.4" fill="#4a4a4a" filter={`url(#${soft})`} /> : null}
          </g>
        );
      })}

      <rect x="0" y="0" width="160" height="120" fill="#888" filter={`url(#${noise})`} opacity="0.35" />
      <rect x="0" y="0" width="160" height="120" fill={`url(#${vig})`} />
    </svg>
  );
}
