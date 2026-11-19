/**
 * Display-only Suspicion Meter (0–100) divided into 4 bands:
 * CALM 0–24 (soft green), UNEASY 25–49 (amber), WATCHED 50–74 (orange), HUNTED 75–100 (deep red)
 * with a glowing position marker.
 */

import React from 'react';
import { getSuspicionBandInfo, SUSPICION_BANDS } from '../game/suspicion';

interface SuspicionBarProps {
  value: number;
  compact?: boolean;
}

export const SuspicionBar: React.FC<SuspicionBarProps> = ({ value, compact = false }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const info = getSuspicionBandInfo(clamped);

  return (
    <div
      className={
        compact
          ? 'w-full'
          : 'bg-[#0c0e10]/90 border border-white/12 rounded px-3 py-2 min-w-[220px] sm:min-w-[250px]'
      }
      aria-label={`Suspicion ${clamped} out of 100, ${info.label}`}
      data-testid="suspicion-meter"
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[11px] font-medium tracking-wider text-[#aeb7b3] uppercase">
          Suspicion
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className="text-xs font-semibold tracking-wider"
            style={{ color: info.color }}
          >
            {info.label}
          </span>
          <span className="font-mono-tabular text-xs text-[#cfd6d3]">{clamped}</span>
        </div>
      </div>

      {/* Thin 4-band bar with glowing marker */}
      <div className="relative h-2 w-full flex gap-[2px] rounded-sm overflow-visible bg-[#181b1d]">
        {SUSPICION_BANDS.map((band) => {
          const isCurrent = band.band === info.band;
          return (
            <div
              key={band.band}
              className="flex-1 h-full first:rounded-l-sm last:rounded-r-sm transition-opacity"
              style={{
                backgroundColor: band.color,
                opacity: isCurrent ? 0.92 : 0.28,
              }}
            />
          );
        })}

        {/* Glowing position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-3.5 rounded-[2px] bg-white transition-transform duration-150"
          style={{
            left: `${clamped}%`,
            boxShadow: `0 0 10px 2px ${info.color}, 0 0 3px #ffffff`,
          }}
        />
      </div>
    </div>
  );
};
