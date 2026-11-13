import { useId } from "react";
import type { ScanKind } from "@/data/featured";
import { cn } from "@/lib/cn";

/**
 * Procedural, clearly-illustrative scan thumbnails (no real imaging). Built from SVG noise,
 * gradients and simple anatomy so the Imaging card reads like the reference without stock art.
 */
export function ScanThumb({ kind, className, title }: { kind: ScanKind; className?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const noise = `${uid}-n`, soft = `${uid}-s`, vig = `${uid}-v`, heat = `${uid}-h`;
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={cn("block size-full bg-black", className)} role="img" aria-label={title ?? "Illustrative scan"}>
      <defs>
        <filter id={noise} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={kind.length * 7} result="t" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.55" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={soft}>
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <radialGradient id={vig} cx="50%" cy="50%" r="65%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={heat} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd34d" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ff7a1a" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#c01d1d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {kind === "cardiac-mri" && (
        <g>
          <ellipse cx="80" cy="64" rx="70" ry="52" fill="#3a3a3a" filter={`url(#${soft})`} />
          <ellipse cx="80" cy="64" rx="70" ry="52" fill="#9a9a9a" filter={`url(#${noise})`} />
          <circle cx="84" cy="60" r="30" fill="#6f6f6f" filter={`url(#${soft})`} />
          <circle cx="84" cy="60" r="18" fill="#e9e9e9" filter={`url(#${soft})`} />
          <circle cx="54" cy="58" r="13" fill="#d4d4d4" filter={`url(#${soft})`} />
          <ellipse cx="84" cy="60" rx="34" ry="30" fill={`url(#${heat})`} style={{ mixBlendMode: "screen" }} />
          <ellipse cx="96" cy="48" rx="12" ry="10" fill="#ff5a1f" opacity="0.55" filter={`url(#${soft})`} style={{ mixBlendMode: "screen" }} />
        </g>
      )}

      {kind === "echo" && (
        <g>
          <path d="M80 4 L150 108 Q80 124 10 108 Z" fill="#1d1d1d" />
          <path d="M80 4 L150 108 Q80 124 10 108 Z" fill="#c8c8c8" filter={`url(#${noise})`} />
          <ellipse cx="66" cy="66" rx="16" ry="26" fill="#050505" filter={`url(#${soft})`} />
          <ellipse cx="96" cy="70" rx="13" ry="20" fill="#050505" filter={`url(#${soft})`} />
          <path d="M80 30 Q82 60 80 96" stroke="#d8d8d8" strokeWidth="3" fill="none" opacity="0.6" filter={`url(#${soft})`} />
          <text x="8" y="14" fill="#9aa" fontSize="7" fontFamily="monospace">EF 58%</text>
        </g>
      )}

      {kind === "brain-mra" && (
        <g>
          <ellipse cx="80" cy="60" rx="54" ry="50" fill="none" stroke="#d9d9d9" strokeWidth="5" filter={`url(#${soft})`} />
          <ellipse cx="80" cy="60" rx="48" ry="44" fill="#4a4a4a" />
          <ellipse cx="80" cy="60" rx="48" ry="44" fill="#a5a5a5" filter={`url(#${noise})`} />
          <g stroke="#f4f4f4" strokeWidth="1.6" fill="none" strokeLinecap="round" filter={`url(#${soft})`} opacity="0.95">
            <path d="M80 100 C78 84 70 76 62 66 C56 58 50 50 44 40" />
            <path d="M80 100 C82 84 90 76 98 66 C104 58 110 50 116 40" />
            <path d="M62 66 C68 60 74 58 80 58 C86 58 92 60 98 66" />
            <path d="M80 58 L80 30" />
          </g>
          <circle cx="66" cy="64" r="2.6" fill="#ffffff" />
        </g>
      )}

      {kind === "carotid" && (
        <g>
          <rect x="0" y="0" width="160" height="120" fill="#1a1a1a" />
          <rect x="0" y="0" width="160" height="120" fill="#bdbdbd" filter={`url(#${noise})`} />
          <path d="M0 52 C40 46 80 58 160 50 L160 74 C80 82 40 70 0 76 Z" fill="#060606" />
          <path d="M18 56 C50 52 80 62 130 56 L130 66 C80 72 50 64 18 68 Z" fill="#d6332b" opacity="0.8" filter={`url(#${soft})`} />
          <path d="M70 58 C90 60 110 62 130 58 L130 63 C110 66 90 64 70 63 Z" fill="#2b6cff" opacity="0.7" filter={`url(#${soft})`} />
        </g>
      )}

      {kind === "chest-xray" && (
        <g>
          <rect x="0" y="0" width="160" height="120" fill="#141414" />
          <ellipse cx="54" cy="64" rx="28" ry="44" fill="#050505" />
          <ellipse cx="106" cy="64" rx="28" ry="44" fill="#050505" />
          <g stroke="#cfcfcf" strokeWidth="2.2" fill="none" opacity="0.55" filter={`url(#${soft})`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <path d={`M78 ${28 + i * 13} C60 ${22 + i * 13} 40 ${30 + i * 13} 30 ${44 + i * 13}`} />
                <path d={`M82 ${28 + i * 13} C100 ${22 + i * 13} 120 ${30 + i * 13} 130 ${44 + i * 13}`} />
              </g>
            ))}
          </g>
          <rect x="74" y="8" width="12" height="112" rx="4" fill="#d9d9d9" opacity="0.8" filter={`url(#${soft})`} />
          <ellipse cx="88" cy="84" rx="24" ry="20" fill="#e2e2e2" opacity="0.75" filter={`url(#${soft})`} />
          <rect x="0" y="0" width="160" height="120" fill="#888" filter={`url(#${noise})`} opacity="0.5" />
        </g>
      )}

      {kind === "chest-ct" && (
        <g>
          <ellipse cx="80" cy="62" rx="72" ry="50" fill="#5b5b5b" />
          <ellipse cx="80" cy="62" rx="72" ry="50" fill="#a0a0a0" filter={`url(#${noise})`} />
          <ellipse cx="52" cy="58" rx="26" ry="32" fill="#070707" />
          <ellipse cx="108" cy="58" rx="26" ry="32" fill="#070707" />
          {[[44, 50], [58, 66], [50, 74], [112, 48], [100, 66], [118, 70], [106, 40]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#9a9a9a" />
          ))}
          <circle cx="80" cy="98" r="9" fill="#efefef" filter={`url(#${soft})`} />
          <ellipse cx="82" cy="70" rx="14" ry="12" fill="#8a8a8a" filter={`url(#${soft})`} />
        </g>
      )}

      <rect x="0" y="0" width="160" height="120" fill={`url(#${vig})`} />
    </svg>
  );
}
