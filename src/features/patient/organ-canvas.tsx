"use client";

import { useEffect, useRef, useState } from "react";
import type { OrganKind } from "@/data/anatomy";
import { cn } from "@/lib/cn";
import { ORGAN_FRAG, ORGAN_INDEX, ORGAN_VERT, ORGAN_VIEW } from "./organ-shader";

/**
 * Live raymarched organ. `shape` comes from the patient's data (anatomy.ts) — switching it
 * morphs between the two signed-distance models (any pair of the 11 organs). Beats only for
 * the heart; sways and follows the pointer gently. Paused offscreen/hidden; still frame under
 * reduced motion; falls back to the pre-rendered image without WebGL.
 */
function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function OrganCanvas({ shape, className, label, tone = "card" }: { shape: OrganKind; className?: string; label: string; tone?: "card" | "light" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapeRef = useRef(shape);
  const [fallback, setFallback] = useState(false);
  shapeRef.current = shape;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!supportsWebGL()) return setFallback(true);
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return setFallback(true);
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, ORGAN_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, ORGAN_FRAG);
    if (!vs || !fs) return setFallback(true);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return setFallback(true);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = { res: U("uRes"), time: U("uTime"), beat: U("uBeatAmt"), ptr: U("uPtr"), a: U("uA"), b: U("uB"), mix: U("uMix"), grey: U("uGrey"), fov: U("uFov"), yaw: U("uYaw"), sway: U("uSway"), bounce: U("uBounce") };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const morph = { from: shapeRef.current, to: shapeRef.current, mix: 1 };
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let time = 0.6;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
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
      gl.uniform1f(u.beat, reduce || morph.to !== "heart" ? 0 : 1);
      gl.uniform2f(u.ptr, ptr.x, ptr.y);
      gl.uniform1i(u.a, ORGAN_INDEX[morph.from]);
      gl.uniform1i(u.b, ORGAN_INDEX[morph.to]);
      gl.uniform1f(u.mix, k);
      gl.uniform1f(u.grey, 0);
      gl.uniform1f(u.fov, va.fov + (vb.fov - va.fov) * k);
      gl.uniform1f(u.yaw, va.yaw + (vb.yaw - va.yaw) * k);
      gl.uniform1f(u.sway, reduce ? 0 : 1);
      gl.uniform1f(u.bounce, tone === "card" ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const syncTarget = () => {
      const target = shapeRef.current;
      if (target !== morph.to) {
        // start the new morph from whichever organ is currently dominant
        morph.from = morph.mix >= 0.5 ? morph.to : morph.from;
        morph.to = target;
        morph.mix = morph.from === target ? 1 : 0;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      syncTarget();
      morph.mix += (1 - morph.mix) * (1 - Math.exp(-dt * 4.2));
      if (morph.mix > 0.999) {
        morph.mix = 1;
        morph.from = morph.to;
      }
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 3));
      ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 3));
      draw();
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (reduce) {
        syncTarget();
        morph.from = morph.to;
        morph.mix = 1;
        draw();
        return;
      }
      if (!raf) {
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
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });
    const interval = reduce ? window.setInterval(start, 400) : 0;

    start();
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      if (interval) window.clearInterval(interval);
      // StrictMode re-runs this effect on the same canvas: don't force-lose the context.
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [tone]);

  return (
    <div className={cn("relative", className)} role="img" aria-label={label}>
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element -- static organ render fallback
        <img src={`/organs/${shape}-color.webp`} alt="" className="size-full object-contain" />
      ) : (
        <canvas ref={canvasRef} className="block size-full" aria-hidden="true" />
      )}
    </div>
  );
}
