"use client";

import { useEffect, useRef } from "react";

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
  wobble: number;
}

/** A one-shot confetti burst from the board each time `burst` changes. */
export function Confetti({ burst, colors, from }: { burst: number; colors: string[]; from?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ colors, from });
  opts.current = { colors, from };

  useEffect(() => {
    const { colors, from } = opts.current;
    if (!burst) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    g.scale(dpr, dpr);

    const origin = from ? document.querySelector(from)?.getBoundingClientRect() : null;
    const ox = origin ? origin.left + origin.width / 2 : W / 2;
    const oy = origin ? origin.top + origin.height * 0.45 : H / 2;
    const spread = origin ? origin.width / 2 : 120;

    const bits: Bit[] = Array.from({ length: 150 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 7 + Math.random() * 9;
      return {
        x: ox + (Math.random() - 0.5) * spread,
        y: oy + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        round: Math.random() < 0.25,
        wobble: Math.random() * 10,
      };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      g.clearRect(0, 0, W, H);
      let alive = 0;
      for (const b of bits) {
        b.vy += 0.32;
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx + Math.sin((t / 120) + b.wobble) * 0.6;
        b.y += b.vy;
        b.r += b.vr;
        if (b.y < H + 30) alive++;
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, 1.8 - t / 1600));
        g.translate(b.x, b.y);
        g.rotate(b.r);
        g.fillStyle = b.color;
        if (b.round) {
          g.beginPath();
          g.arc(0, 0, b.h / 2 + 1, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(t / 160 + b.wobble)));
        }
        g.restore();
      }
      if (alive && t < 3200) raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      g.clearRect(0, 0, W, H);
    };
  }, [burst]);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
