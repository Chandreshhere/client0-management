"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { OrganKind } from "@/data/anatomy";
import { cn } from "@/lib/cn";
import { ORGAN_FRAG, ORGAN_INDEX, ORGAN_VERT, ORGAN_VIEW } from "./organ-shader";

/**
 * Organ illustration, performance-first.
 * - Always shows the pre-rendered WebP (same shader, rendered offline): instant, zero GPU cost.
 * - Upgrades to the live raymarched WebGL view ONLY on capable desktops: fine pointer, ≥8 CPU
 *   threads, hardware WebGL (failIfMajorPerformanceCaveat rejects software rendering), no
 *   reduced-motion / data-saver, and a frame-time probe under budget. One live canvas per page,
 *   rendered at reduced resolution and capped at 30 fps; paused offscreen and in hidden tabs.
 * Anything else keeps the static image (with a crossfade when the organ changes).
 */
let liveCanvases = 0;

function capableDevice() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(pointer: fine)").matches) return false;
  if ((nav.hardwareConcurrency ?? 4) < 8) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 8) return false;
  if (nav.connection?.saveData) return false;
  return true;
}

export function OrganCanvas({ shape, className, label, tone = "card", live: allowLive = false }: { shape: OrganKind; className?: string; label: string; tone?: "card" | "light"; /** opt in to the live WebGL view (one place only) */ live?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapeRef = useRef(shape);
  const [live, setLive] = useState(false);
  shapeRef.current = shape;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!allowLive || !canvas || !capableDevice() || liveCanvases >= 1) return;
    let teardown: (() => void) | undefined;
    let cancelled = false;
    // Wait until the page is idle so shader compilation never competes with first paint/input.
    const run = () => {
      if (!cancelled) teardown = setup(canvas);
    };
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle ? window.requestIdleCallback(run, { timeout: 2500 }) : window.setTimeout(run, 1200);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      teardown?.();
    };
  }, [tone, allowLive]);

  function setup(canvas: HTMLCanvasElement): (() => void) | undefined {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: true });
    if (!gl || liveCanvases >= 1) return;
    liveCanvases++;
    let disposed = false;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, ORGAN_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, ORGAN_FRAG);
    const prog = gl.createProgram()!;
    if (vs && fs) {
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
    }
    if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      liveCanvases--;
      return undefined;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = { res: U("uRes"), time: U("uTime"), beat: U("uBeatAmt"), ptr: U("uPtr"), a: U("uA"), b: U("uB"), mix: U("uMix"), grey: U("uGrey"), fov: U("uFov"), yaw: U("uYaw"), sway: U("uSway"), bounce: U("uBounce") };

    const morph = { from: shapeRef.current, to: shapeRef.current, mix: 1 };
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let time = 0.6;

    const resize = () => {
      // reduced internal resolution: smooth shading upsamples well and the cost drops ~2–3×
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.7;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const va = ORGAN_VIEW[morph.from], vb = ORGAN_VIEW[morph.to];
      const k = morph.mix;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, time);
      gl.uniform1f(u.beat, morph.to === "heart" ? 1 : 0);
      gl.uniform2f(u.ptr, ptr.x, ptr.y);
      gl.uniform1i(u.a, ORGAN_INDEX[morph.from]);
      gl.uniform1i(u.b, ORGAN_INDEX[morph.to]);
      gl.uniform1f(u.mix, k);
      gl.uniform1f(u.grey, 0);
      gl.uniform1f(u.fov, va.fov + (vb.fov - va.fov) * k);
      gl.uniform1f(u.yaw, va.yaw + (vb.yaw - va.yaw) * k);
      gl.uniform1f(u.sway, 1);
      gl.uniform1f(u.bounce, tone === "card" ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // frame-time probe: if this GPU can't draw the scene well under budget, stay on the image
    for (let i = 0; i < 2; i++) draw();
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) draw();
    gl.finish();
    const perFrame = (performance.now() - t0) / 3;
    if (perFrame > 12) {
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      liveCanvases--;
      return undefined;
    }

    const tick = (now: number) => {
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
      if (now - lastDraw < 33) return; // ~30 fps cap
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lastDraw = now;
      time += dt;
      const target = shapeRef.current;
      if (target !== morph.to) {
        morph.from = morph.mix >= 0.5 ? morph.to : morph.from;
        morph.to = target;
        morph.mix = morph.from === target ? 1 : 0;
      }
      morph.mix += (1 - morph.mix) * (1 - Math.exp(-dt * 4.2));
      if (morph.mix > 0.999) {
        morph.mix = 1;
        morph.from = morph.to;
      }
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 3));
      ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 3));
      draw();
    };
    const start = () => {
      if (!raf && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVis = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVis);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ptr.tx = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2.4));
      ptr.ty = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 2.4));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    setLive(true);
    start();

    const ctx = gl;
    function cleanup() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      ctx.deleteProgram(prog);
      ctx.deleteShader(vs);
      ctx.deleteShader(fs);
      ctx.deleteBuffer(buf);
      liveCanvases--;
      setLive(false);
    }
    return cleanup;
  }

  return (
    <div className={cn("relative", className)} role="img" aria-label={label}>
      <AnimatePresence initial={false}>
        {!live ? (
          <motion.img
            key={shape}
            src={`/organs/${shape}-color.webp`}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-0 size-full select-none object-contain"
          />
        ) : null}
      </AnimatePresence>
      <canvas ref={canvasRef} className={cn("absolute inset-0 block size-full transition-opacity duration-500", live ? "opacity-100" : "opacity-0")} aria-hidden="true" />
    </div>
  );
}
