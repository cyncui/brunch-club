"use client";

import { useRef, useEffect } from "react";

/** #rrggbb + alpha → rgba() string. */
function w8(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Dissolve pattern: a pixel cross that shimmers, plus four orbiting dots.
const OFFSETS: [number, number][] = [
  [0, -4], [0, -3], [0, -2], [0, 2], [0, 3], [0, 4],
  [-4, 0], [-3, 0], [-2, 0], [2, 0], [3, 0], [4, 0],
  [-2, -2], [-1, -1], [1, -1], [2, -2],
  [-2, 2], [-1, 1], [1, 1], [2, 2],
];

function draw(
  t: CanvasRenderingContext2D,
  e: number,
  a: number,
  l: string,
): void {
  t.clearRect(0, 0, e, e);
  const o = e / 2;
  const n = e / 2;
  const h = e > 30 ? 2 : 1;
  OFFSETS.forEach(([i, u], c) => {
    t.fillStyle = w8(
      l,
      0.12 + 0.78 * Math.abs(Math.sin(0.002 * a - 0.55 * Math.hypot(i, u) + 0.33 * c)),
    );
    t.fillRect(Math.round(o + i * h - h / 2), Math.round(n + u * h - h / 2), h, h);
  });
  t.fillStyle = w8(l, 0.9);
  t.fillRect(o - h / 2, n - h / 2, h, h);
  for (let k = 0; k < 4; k++) {
    const c = 0.0022 * a + (k / 4) * Math.PI * 2;
    const i = e > 30 ? 9 : 4.5;
    t.fillStyle = w8(l, 0.1 + 0.28 * Math.abs(Math.sin(0.003 * a + 1.4 * k)));
    t.fillRect(Math.round(o + Math.cos(c) * i), Math.round(n + Math.sin(c) * i), 1, 1);
  }
}

export default function WhimsyLoader({
  color = "#a45d07",
  size = 44,
}: {
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const SC = window.devicePixelRatio || 2;
    cv.width = 32 * SC;
    cv.height = 32 * SC;
    ctx.scale(SC, SC);

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      draw(ctx, 32, 400, color);
      return;
    }

    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      draw(ctx, 32, performance.now() - t0, color);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <canvas
      ref={ref}
      width={32}
      height={32}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
