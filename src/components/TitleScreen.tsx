/**
 * Start Screen — Diegetic MTA Transit Sign Lockup over Live 3D Car B View.
 * Supports G, L, and 7 Line selection, Full Ride & 4 Chapters, Practice & Nightmare Modes,
 * Persistent Archive (8 Endings / 13 Cases), and Settings.
 */

import React from 'react';
import { ArchiveData } from '../game/archive';
import {
  CHAPTERS,
  ChapterId,
  getLineDefinition,
  SUBWAY_LINES,
  SubwayLineId,
} from '../game/route';
import { RideDifficulty } from '../game/state';

interface TitleScreenProps {
  selectedLine: SubwayLineId;
  selectedChapter: ChapterId;
  nightmareUnlocked: boolean;
  archive: ArchiveData;
  onSelectLine: (lineId: SubwayLineId) => void;
  onSelectChapter: (chapterId: ChapterId) => void;
  onStartRide: (difficulty: RideDifficulty) => void;
  onOpenArchive: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedLine,
  selectedChapter,
  nightmareUnlocked,
  archive,
  onSelectLine,
  onSelectChapter,
  onStartRide,
  onOpenArchive,
  onOpenSettings,
}) => {
  const line = getLineDefinition(selectedLine);
  const chapter = CHAPTERS.find((c) => c.id === selectedChapter) ?? CHAPTERS[0];

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-9 pointer-events-none"
      style={{
        background:
          'linear-gradient(95deg, rgba(9, 11, 12, 0.90) 0%, rgba(9, 11, 12, 0.68) 46%, rgba(9, 11, 12, 0.12) 100%)',
      }}
    >
      {/* Top quiet route line */}
      <div className="flex items-center justify-between gap-2 text-xs tracking-wide text-[#aeb6b3]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono-tabular text-[#eef0ee] font-semibold shrink-0">CAR B</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {line.stops[0].name} to {line.terminusName}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="hidden sm:inline">13 Stops</span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            data-testid="open-archive-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenArchive();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#d4dad7] bg-[#141719]/90 border border-white/15 rounded hover:bg-[#1f2427] hover:text-white transition-colors whitespace-nowrap"
          >
            Archive ({archive.discoveredEndings.length}/8)
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#d4dad7] bg-[#141719]/90 border border-white/15 rounded hover:bg-[#1f2427] hover:text-white transition-colors whitespace-nowrap"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Title Emblem & Menu Actions */}
      <main className="max-w-md my-auto pointer-events-auto">
        {/* Custom Inline SVG Transit Sign Emblem */}
        <svg
          viewBox="0 0 420 116"
          className="w-full max-w-[350px] h-auto mb-4"
          role="img"
          aria-label={`Last Local — ${line.name}`}
        >
          <rect x="0" y="0" width="420" height="3" fill="#eef0ee" />
          <circle cx="34" cy="56" r="28" fill={line.color} />
          <text
            x="34"
            y="67"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Barlow Condensed, Helvetica Neue, Arial, sans-serif"
            fontWeight="700"
            fontSize="38"
          >
            {line.id}
          </text>
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
          <text
            x="80"
            y="84"
            fill="#b6bfbc"
            fontFamily="IBM Plex Sans, Arial, sans-serif"
            fontWeight="500"
            fontSize="13"
            letterSpacing="1.4"
          >
            {line.subtitle}
          </text>
          <rect x="0" y="106" width="420" height="1" fill="rgba(255,255,255,0.22)" />
        </svg>

        <p className="text-sm leading-relaxed text-[#cfd6d3] mb-4 max-w-[40ch]">
          Notice what changes in the car. Don’t show that you noticed. Learn which doors are safe.
        </p>

        {/* Line Selector (G / L / 7) */}
        <div className="mb-3">
          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#909a96] mb-1.5">
            Select Line
          </div>
          <div className="flex items-center gap-2">
            {(['G', 'L', '7'] as SubwayLineId[]).map((id) => {
              const def = SUBWAY_LINES[id];
              const active = selectedLine === id;
              const cleared = archive.completedLines.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`select-line-${id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectLine(id);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1f2528] border-white/60 text-white'
                      : 'bg-[#111416]/90 border-white/12 text-[#b4bdb9] hover:bg-[#191e21]'
                  }`}
                >
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: def.color }}
                  >
                    {def.id}
                  </span>
                  <span>{def.name}</span>
                  {cleared && (
                    <span className="font-mono-tabular text-[10px] text-[#86efac]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chapter Selector */}
        <div className="mb-4">
          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#909a96] mb-1.5">
            Chapter · {chapter.title}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CHAPTERS.map((ch) => {
              const active = selectedChapter === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  data-testid={`select-chapter-${ch.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectChapter(ch.id);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#eef0ee] text-[#0b0d0e] border-white font-semibold'
                      : 'bg-[#111416]/90 text-[#aeb7b3] border-white/12 hover:bg-[#1a1f22]'
                  }`}
                >
                  {ch.code}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Ride Actions */}
        <div className="flex flex-col gap-2 max-w-[290px]">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRide('standard');
            }}
            className="w-full px-5 py-2.5 text-left text-sm font-semibold tracking-wide text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors flex items-center justify-between whitespace-nowrap"
          >
            <span>Board {line.name}</span>
            <span className="font-mono-tabular text-xs opacity-70">
              {chapter.stopIndices.length} Stops
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRide('practice');
            }}
            className="w-full px-5 py-2 text-left text-sm font-medium text-[#e2e7e5] bg-[#141719]/90 hover:bg-[#1e2326] border border-white/15 rounded transition-colors flex items-center justify-between whitespace-nowrap"
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
            className={`w-full px-5 py-2 text-left text-sm font-medium rounded border transition-colors flex items-center justify-between whitespace-nowrap ${
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
        <span>TAB 13-Case Log</span>
        <span aria-hidden="true">·</span>
        <span>T Tuner</span>
        <span aria-hidden="true">·</span>
        <span>C Polaroid</span>
        <span aria-hidden="true">·</span>
        <span>V EVP</span>
        <span aria-hidden="true">·</span>
        <span>P Pause</span>
      </footer>
    </div>
  );
};
