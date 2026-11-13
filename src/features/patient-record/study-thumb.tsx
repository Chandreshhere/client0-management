"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { ScanThumb } from "@/features/patient/scan-thumb";
import type { StudyKind } from "./data";

/**
 * Illustrative study renders (never real imaging). Uses the shared procedural scans where one
 * matches the study, and local renders where none does: a sagittal lumbar-spine MRI, and an echo
 * sector without the featured patient's printed EF (which belongs to his own report).
 */
export function StudyThumb({ kind, className, title }: { kind: StudyKind; className?: string; title?: string }) {
  if (kind === "spine-mri") return <SpineMriThumb className={className} title={title} />;
  if (kind === "echo-plain") return <EchoPlainThumb className={className} title={title} />;
  return <ScanThumb kind={kind} className={className} title={title} />;
}

function Filters({ uid }: { uid: string }) {
  return (
    <defs>
      <filter id={`${uid}-n`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={11} result="t" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.55" />
        </feComponentTransfer>
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id={`${uid}-s`}>
        <feGaussianBlur stdDeviation="1.4" />
      </filter>
      <radialGradient id={`${uid}-v`} cx="50%" cy="50%" r="65%">
        <stop offset="60%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
      </radialGradient>
    </defs>
  );
}

/** Sagittal T2-style lumbar spine: vertebral bodies on a lordotic curve, bright discs and CSF canal. */
function SpineMriThumb({ className, title }: { className?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const n = `url(#${uid}-n)`, s = `url(#${uid}-s)`;
  // centre line of the vertebral column (anterior = left), gentle lordosis
  const bodies = [
    { x: 64, y: 14, r: -10 },
    { x: 60, y: 34, r: -6 },
    { x: 58, y: 54, r: 0 },
    { x: 60, y: 74, r: 8 },
    { x: 66, y: 94, r: 16 },
  ];
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={cn("block size-full bg-black", className)} role="img" aria-label={title ?? "Illustrative spine MRI"}>
      <Filters uid={uid} />
      {/* soft tissue and paraspinal muscle */}
      <path d="M20 0 H150 V120 H24 C34 90 30 40 20 0 Z" fill="#2c2c2c" filter={s} />
      <path d="M20 0 H150 V120 H24 C34 90 30 40 20 0 Z" fill="#8a8a8a" filter={n} opacity="0.55" />
      <path d="M104 0 C118 30 120 80 112 120 H150 V0 Z" fill="#4a4a4a" filter={s} />
      {/* CSF canal (bright on T2) posterior to the bodies */}
      <path d="M84 0 C80 30 80 70 86 100 C88 108 90 114 92 120" stroke="#e8e8e8" strokeWidth="7" fill="none" opacity="0.85" filter={s} />
      <path d="M84 0 C80 30 80 70 86 100 C88 108 90 114 92 120" stroke="#7a7a7a" strokeWidth="2" fill="none" opacity="0.6" />
      {/* vertebral bodies with intervertebral discs */}
      {bodies.map((b, i) => (
        <g key={i} transform={`rotate(${b.r} ${b.x} ${b.y})`}>
          <rect x={b.x - 15} y={b.y - 8} width="30" height="16" rx="4" fill="#9b9b9b" filter={s} />
          <rect x={b.x - 15} y={b.y - 8} width="30" height="16" rx="4" fill="#c4c4c4" filter={n} opacity="0.6" />
          {i < bodies.length - 1 ? <ellipse cx={b.x - 1} cy={b.y + 10.5} rx="13" ry="2.4" fill="#e6e6e6" opacity="0.85" filter={s} /> : null}
        </g>
      ))}
      {/* sacrum */}
      <path d="M58 104 C70 106 82 110 88 120 H52 C54 114 55 108 58 104 Z" fill="#8f8f8f" filter={s} />
      {/* spinous processes */}
      {bodies.map((b, i) => (
        <ellipse key={`sp-${i}`} cx={b.x + 40} cy={b.y + 2} rx="7" ry="4.5" fill="#6d6d6d" transform={`rotate(${b.r + 20} ${b.x + 40} ${b.y + 2})`} filter={s} />
      ))}
      <rect x="0" y="0" width="160" height="120" fill={`url(#${uid}-v)`} />
    </svg>
  );
}

/** Echo sector with speckle and two dark chambers — no measurements printed on the image. */
function EchoPlainThumb({ className, title }: { className?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={cn("block size-full bg-black", className)} role="img" aria-label={title ?? "Illustrative echocardiogram"}>
      <Filters uid={uid} />
      <path d="M80 4 L150 108 Q80 124 10 108 Z" fill="#1d1d1d" />
      <path d="M80 4 L150 108 Q80 124 10 108 Z" fill="#c8c8c8" filter={`url(#${uid}-n)`} />
      <ellipse cx="66" cy="66" rx="16" ry="26" fill="#050505" filter={`url(#${uid}-s)`} />
      <ellipse cx="96" cy="70" rx="13" ry="20" fill="#050505" filter={`url(#${uid}-s)`} />
      <path d="M80 30 Q82 60 80 96" stroke="#d8d8d8" strokeWidth="3" fill="none" opacity="0.6" filter={`url(#${uid}-s)`} />
      <rect x="0" y="0" width="160" height="120" fill={`url(#${uid}-v)`} />
    </svg>
  );
}
