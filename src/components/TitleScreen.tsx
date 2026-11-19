/**
 * Start Screen — Diegetic MTA G Train Transit Sign Lockup over Live 3D Car B View.
 * Includes Start Ride (data-start="true"), Practice Mode, Nightmare Mode (unlockable),
 * Settings, and a single flat control hint line at the bottom margin.
 */

import React from 'react';
import { RideDifficulty } from '../game/state';

interface TitleScreenProps {
  nightmareUnlocked: boolean;
  onStartRide: (difficulty: RideDifficulty) => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  nightmareUnlocked,
  onStartRide,
  onOpenSettings,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none"
      style={{
        background:
          'linear-gradient(95deg, rgba(9, 11, 12, 0.88) 0%, rgba(9, 11, 12, 0.62) 44%, rgba(9, 11, 12, 0.12) 100%)',
      }}
    >
      {/* Top quiet route line */}
      <div className="flex items-center justify-between text-xs tracking-wide text-[#aeb6b3]">
        <div className="flex items-center gap-2.5">
          <span className="font-mono-tabular text-[#eef0ee] font-semibold">CAR B</span>
          <span aria-hidden="true">·</span>
          <span>Hoyt-Schermerhorn to Court Sq</span>
          <span aria-hidden="true">·</span>
          <span>13 Stops</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenSettings();
          }}
          className="pointer-events-auto px-3 py-1.5 text-xs font-medium text-[#d4dad7] bg-[#141719]/90 border border-white/15 rounded hover:bg-[#1f2427] hover:text-white transition-colors whitespace-nowrap"
        >
          Settings
        </button>
      </div>

      {/* Main Title Emblem & Menu Actions */}
      <main className="max-w-md my-auto pointer-events-auto">
        {/* Custom Inline SVG Transit Sign Emblem */}
        <svg
          viewBox="0 0 420 116"
          className="w-full max-w-[360px] h-auto mb-5"
          role="img"
          aria-label="Last Local — G Train"
        >
          {/* Matte transit sign top white rule */}
          <rect x="0" y="0" width="420" height="3" fill="#eef0ee" />
          {/* MTA G-Line Green Bullet */}
          <circle cx="34" cy="56" r="28" fill="#6cbe45" />
          <text
            x="34"
            y="67"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Barlow Condensed, Helvetica Neue, Arial, sans-serif"
            fontWeight="700"
            fontSize="38"
          >
            G
          </text>
          {/* Main Title */}
          <text
            x="78"
            y="58"
            fill="#f5f7f6"
            fontFamily="Barlow Condensed, Helvetica Neue, Arial, sans-serif"
            fontWeight="700"
            fontSize="48"
            letterSpacing="2.5"
          >
            LAST LOCAL
          </text>
          {/* Sub-rule */}
          <text
            x="80"
            y="84"
            fill="#b6bfbc"
            fontFamily="IBM Plex Sans, Arial, sans-serif"
            fontWeight="500"
            fontSize="13"
            letterSpacing="1.4"
          >
            BROOKLYN — QUEENS CROSSTOWN LOCAL
          </text>
          <rect x="0" y="106" width="420" height="1" fill="rgba(255,255,255,0.22)" />
        </svg>

        <p className="text-sm sm:text-[15px] leading-relaxed text-[#cfd6d3] mb-7 max-w-[38ch]">
          Notice what changes in the car. Don’t show that you noticed. Learn which doors are safe.
        </p>

        <div className="flex flex-col gap-2.5 max-w-[280px]">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRide('standard');
            }}
            className="w-full px-5 py-3 text-left text-sm font-semibold tracking-wide text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors flex items-center justify-between whitespace-nowrap"
          >
            <span>Board Train</span>
            <span className="font-mono-tabular text-xs opacity-70">13 Stops</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRide('practice');
            }}
            className="w-full px-5 py-2.5 text-left text-sm font-medium text-[#e2e7e5] bg-[#141719]/90 hover:bg-[#1e2326] border border-white/15 rounded transition-colors flex items-center justify-between whitespace-nowrap"
          >
            <span>Practice Ride</span>
            <span className="font-mono-tabular text-xs text-[#9ca5a1]">4 Stops · Safer</span>
          </button>

          <button
            type="button"
            disabled={!nightmareUnlocked}
            onClick={(e) => {
              e.currentTarget.blur();
              if (nightmareUnlocked) onStartRide('nightmare');
            }}
            className={`w-full px-5 py-2.5 text-left text-sm font-medium rounded border transition-colors flex items-center justify-between whitespace-nowrap ${
              nightmareUnlocked
                ? 'text-[#fecaca] bg-[#2a1212]/90 hover:bg-[#3a1616] border-[#dc2626]/50'
                : 'text-[#737c78] bg-[#111415]/80 border-white/10 cursor-not-allowed'
            }`}
          >
            <span>Nightmare Mode</span>
            <span className="font-mono-tabular text-xs">
              {nightmareUnlocked ? 'Unlocked' : 'Finish 1 Ride'}
            </span>
          </button>
        </div>
      </main>

      {/* Bottom single-line flat control hint */}
      <footer className="text-xs text-[#9ba3a0] tracking-wide flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Mouse / Arrows Look</span>
        <span aria-hidden="true">·</span>
        <span>WASD Move</span>
        <span aria-hidden="true">·</span>
        <span>F / Click Flag</span>
        <span aria-hidden="true">·</span>
        <span>B PA Board</span>
        <span aria-hidden="true">·</span>
        <span>TAB Evidence Log</span>
        <span aria-hidden="true">·</span>
        <span>C Polaroid</span>
        <span aria-hidden="true">·</span>
        <span>V EVP Tape</span>
        <span aria-hidden="true">·</span>
        <span>P Pause</span>
      </footer>
    </div>
  );
};
