/**
 * Pause & Settings Modal — Fits comfortably inside a 360x640 phone screen.
 * Freezes simulation with zero look drift; resumes only on Resume click or fresh P/Escape press.
 */

import React from 'react';
import { GameSettings } from '../game/state';

interface PauseModalProps {
  mode: 'pause' | 'settings_only';
  settings: GameSettings;
  stopName: string;
  stopNumber: number;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  mode,
  settings,
  stopName,
  stopNumber,
  onUpdateSettings,
  onResume,
  onRestart,
  onQuitToTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3"
      style={{ backgroundColor: 'rgba(6, 8, 9, 0.86)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      data-testid="pause-modal"
    >
      <div className="w-full max-w-[336px] max-h-[600px] overflow-y-auto ll-scroll bg-[#121517] border border-white/15 rounded-md p-4 text-[#eef0ee]">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
          <h2 id="pause-modal-title" className="font-display text-2xl font-bold tracking-wide">
            {mode === 'pause' ? 'Paused' : 'Settings'}
          </h2>
          {mode === 'pause' && (
            <span className="font-mono-tabular text-[11px] text-[#9aa39f] truncate max-w-[165px]">
              Stop {stopNumber} · {stopName}
            </span>
          )}
        </div>

        {/* Settings Controls */}
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="setting-volume" className="text-[#c5ceca]">
                Audio Volume
              </label>
              <span className="font-mono-tabular text-[#eef0ee]">
                {settings.muted ? 'Muted' : `${Math.round(settings.volume * 100)}%`}
              </span>
            </div>
            <input
              id="setting-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) =>
                onUpdateSettings({ volume: parseFloat(e.target.value), muted: false })
              }
              className="w-full accent-[#6cbe45]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="setting-sens" className="text-[#c5ceca]">
                Look Sensitivity
              </label>
              <span className="font-mono-tabular text-[#eef0ee]">
                {settings.sensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              id="setting-sens"
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={settings.sensitivity}
              onChange={(e) => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-[#6cbe45]"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label htmlFor="setting-mute" className="text-xs text-[#c5ceca]">
              Mute All Audio
            </label>
            <input
              id="setting-mute"
              type="checkbox"
              checked={settings.muted}
              onChange={(e) => onUpdateSettings({ muted: e.target.checked })}
              className="w-4 h-4 accent-[#6cbe45]"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label htmlFor="setting-glitch" className="text-xs text-[#c5ceca]">
              Reduced Screen Glitch
            </label>
            <input
              id="setting-glitch"
              type="checkbox"
              checked={settings.reducedGlitch}
              onChange={(e) => onUpdateSettings({ reducedGlitch: e.target.checked })}
              className="w-4 h-4 accent-[#6cbe45]"
            />
          </div>
        </div>

        {/* Action Buttons — sized cleanly for 360x640 touch & desktop */}
        <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full py-2.5 px-4 text-sm font-semibold text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap"
          >
            {mode === 'pause' ? 'Resume Ride' : 'Close Settings'}
          </button>

          {mode === 'pause' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="w-full py-2 px-4 text-xs font-medium text-[#dce2df] bg-[#1a1f22] hover:bg-[#242a2e] border border-white/12 rounded transition-colors whitespace-nowrap"
              >
                Restart from Hoyt-Schermerhorn
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onQuitToTitle();
                }}
                className="w-full py-2 px-4 text-xs font-medium text-[#b5beb9] hover:text-white border border-white/10 rounded transition-colors whitespace-nowrap"
              >
                Return to Title
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
