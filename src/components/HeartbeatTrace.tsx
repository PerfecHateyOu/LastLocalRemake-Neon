/**
 * Live Heartbeat ECG Trace Canvas — visualizes the current sanity-driven BPM (82–118 bpm).
 */

import React, { useEffect, useRef } from 'react';
import { SanityTier } from '../game/sanity';

interface HeartbeatTraceProps {
  bpm: number;
  tier: SanityTier;
  paused: boolean;
}

export const HeartbeatTrace: React.FC<HeartbeatTraceProps> = ({ bpm, tier, paused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const pointsRef = useRef<number[]>(new Array(96).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const colorByTier: Record<SanityTier, string> = {
      High: '#7dd3a8',
      Medium: '#f59e0b',
      Low: '#f97316',
      Critical: '#ef4444',
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!paused) {
        const beatsPerSec = bpm / 60;
        phaseRef.current = (phaseRef.current + dt * beatsPerSec) % 1;
        const p = phaseRef.current;

        // Sharp realistic QRS ECG spike shape
        let y = 0;
        if (p > 0.1 && p < 0.16) y = -0.18 * Math.sin(((p - 0.1) / 0.06) * Math.PI);
        else if (p >= 0.2 && p < 0.23) y = 0.22;
        else if (p >= 0.23 && p < 0.27) y = -0.95;
        else if (p >= 0.27 && p < 0.31) y = 0.38;
        else if (p >= 0.4 && p < 0.52) y = -0.24 * Math.sin(((p - 0.4) / 0.12) * Math.PI);

        const pts = pointsRef.current;
        pts.push(y);
        if (pts.length > 96) pts.shift();
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle baseline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Trace path
      const pts = pointsRef.current;
      ctx.strokeStyle = colorByTier[tier];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = (i / (pts.length - 1)) * w;
        const py = h * 0.56 + pts[i] * (h * 0.42);
        if (i === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [bpm, tier, paused]);

  return (
    <div className="flex items-center gap-2.5 bg-[#0c0e10]/90 border border-white/12 rounded px-2.5 py-1.5">
      <canvas
        ref={canvasRef}
        width={112}
        height={24}
        className="block w-[112px] h-[24px]"
        aria-label={`Heartbeat trace ${bpm} beats per minute`}
      />
      <div className="flex flex-col leading-none">
        <span className="font-mono-tabular text-xs font-semibold text-[#eef0ee]">{bpm} BPM</span>
        <span className="text-[10px] text-[#98a19d] mt-0.5">{tier} Sanity</span>
      </div>
    </div>
  );
};
