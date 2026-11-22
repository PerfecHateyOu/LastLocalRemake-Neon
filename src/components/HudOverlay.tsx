/**
 * World-Matched NYC Transit Playing HUD Overlay.
 * Keeps >= 85% of the central 3D Car B viewport unobstructed.
 * Zero backdrop-filter/blur over WebGL; uses clean solid/rgba transit-metal surfaces.
 */

import React from 'react';
import { AnomalyTargetId, INSPECTABLE_TARGETS } from '../game/anomalies';
import { getLineDefinition } from '../game/route';
import {
  ActivePanelId,
  GameSettings,
  GameState,
  getCurrentHeartbeat,
  getCurrentLedText,
  getCurrentStop,
} from '../game/state';
import { HeartbeatTrace } from './HeartbeatTrace';
import { SuspicionBar } from './SuspicionBar';

interface HudOverlayProps {
  state: GameState;
  settings: GameSettings;
  aimTarget: AnomalyTargetId | null;
  pointerLocked: boolean;
  onTogglePanel: (panel: Exclude<ActivePanelId, 'none'>) => void;
  onPause: () => void;
  onToggleMute: () => void;
  onFlagTarget: (targetId: AnomalyTargetId) => void;
  onAnswerMask: (optionId: string) => void;
  onSafeHavenChoice: (takeShelter: boolean) => void;
  onAttemptStepOff: () => void;
  onRestraintHoldChange: (holding: boolean) => void;
  onRequestPointerLock: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  state,
  settings,
  aimTarget,
  pointerLocked,
  onTogglePanel,
  onPause,
  onToggleMute,
  onFlagTarget,
  onAnswerMask,
  onSafeHavenChoice,
  onAttemptStepOff,
  onRestraintHoldChange,
  onRequestPointerLock,
}) => {
  const stop = getCurrentStop(state);
  const line = getLineDefinition(state.lineId);
  const ledText = getCurrentLedText(state);
  const hb = getCurrentHeartbeat(state);
  const isGlitching =
    !settings.reducedGlitch &&
    (state.sanity.glitchTimer > 0 ||
      (state.sanity.tier === 'Critical' && Math.floor(state.elapsedSec * 4) % 5 === 0));
  const glitchStrength =
    state.sanity.glitchTimer > 0
      ? state.sanity.glitchIntensity
      : state.sanity.tier === 'Critical'
        ? 0.45
        : state.sanity.tier === 'Low'
          ? 0.2
          : 0;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Screen Glitch & Chromatic Aberration Layer (Low/Critical sanity + critical anomaly + decoys) */}
      {isGlitching && glitchStrength > 0.08 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
          <div
            className="absolute inset-x-0 h-8 ll-glitch-tear"
            style={{
              top: `${22 + ((Math.floor(state.elapsedSec * 19) * 17) % 52)}%`,
              background:
                'linear-gradient(90deg, rgba(239,68,68,0.22), rgba(255,255,255,0.08), rgba(56,189,248,0.22))',
              opacity: glitchStrength,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              boxShadow: `inset ${Math.round(glitchStrength * 6)}px 0 0 rgba(239,68,68,0.22), inset ${-Math.round(glitchStrength * 6)}px 0 0 rgba(56,189,248,0.22)`,
            }}
          />
        </div>
      )}

      {/* Subtle peripheral tension vignette at Low/Critical sanity or Blackout */}
      {(state.sanity.tier === 'Low' ||
        state.sanity.tier === 'Critical' ||
        state.phase === 'blackout') && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              state.phase === 'blackout'
                ? 'radial-gradient(circle at center, transparent 28%, rgba(0,0,0,0.72) 100%)'
                : state.sanity.tier === 'Critical'
                  ? 'radial-gradient(circle at center, transparent 48%, rgba(12,6,6,0.58) 100%)'
                  : 'radial-gradient(circle at center, transparent 58%, rgba(8,10,11,0.34) 100%)',
          }}
        />
      )}

      {/* TOP BAR CLUSTER: Top-Left (Suspicion + Heartbeat), Top-Center (LED + Dwell), Top-Right (Utilities) */}
      <div className="relative z-20 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        {/* Top-Left: Suspicion Meter + Heartbeat Trace */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <SuspicionBar value={state.suspicion.value} />
          <div className="hidden sm:block">
            <HeartbeatTrace
              bpm={hb.bpm}
              tier={state.sanity.tier}
              paused={state.screen !== 'playing'}
            />
          </div>
        </div>

        {/* Top-Center: Overhead LED Next-Stop Readout & Minimum-Dwell Banner */}
        <div className="flex flex-col items-center gap-1.5 mx-auto sm:mx-0">
          <div
            className="bg-[#08090a]/95 border border-white/15 rounded px-3.5 py-1.5 flex items-center gap-2.5 max-w-[92vw] sm:max-w-[380px]"
            data-testid="hud-led-sign"
          >
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white shrink-0"
              style={{ backgroundColor: line.color }}
            >
              {line.id}
            </span>
            <span className="font-mono-tabular text-xs sm:text-sm font-semibold tracking-wider text-[#fbbf24] truncate">
              {ledText || 'POWER LOST — CAR B'}
            </span>
            <span className="font-mono-tabular text-[11px] text-[#88928e] shrink-0">
              {stop.number}/13
            </span>
          </div>

          {/* Minimum-Dwell Banner with Countdown when stopped at station */}
          {state.phase === 'dwelling' && (
            <div
              className="pointer-events-auto flex items-center gap-3 bg-[#111517]/95 border border-[#6cbe45]/45 rounded px-3 py-1.5 text-xs text-[#e6ece9]"
              data-testid="dwell-banner"
            >
              <span className="font-mono-tabular text-[#86efac] font-semibold">
                DOORS OPEN · {Math.ceil(state.phaseTimer)}s
              </span>
              <span aria-hidden="true" className="text-white/25">
                |
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onAttemptStepOff();
                }}
                className="px-2.5 py-0.5 text-[11px] font-medium bg-[#22282b] hover:bg-[#31393d] text-white border border-white/15 rounded transition-colors whitespace-nowrap"
              >
                Step Off Doors
              </button>
            </div>
          )}

          {state.phase === 'blackout' && (
            <div className="bg-[#090a0b]/95 border border-white/15 rounded px-3 py-1 text-[11px] font-mono-tabular text-[#9ca5a1]">
              BLACKOUT STRETCH · STAY SEATED
            </div>
          )}
        </div>

        {/* Top-Right: Compact Utility Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePanel('pa_board');
            }}
            aria-label="Open PA Board (B)"
            className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              state.activePanel === 'pa_board'
                ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
                : 'bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22]'
            }`}
          >
            PA [B]
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePanel('evidence');
            }}
            aria-label="Open Evidence Log (TAB)"
            className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              state.activePanel === 'evidence'
                ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
                : 'bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22]'
            }`}
          >
            Log [TAB]
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePanel('polaroid');
            }}
            aria-label="Toggle Polaroid Camera (C)"
            className={`hidden sm:inline-flex px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              state.activePanel === 'polaroid'
                ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
                : 'bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22]'
            }`}
          >
            Cam [C]
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePanel('tuner');
            }}
            aria-label="Toggle Radio Tuner (T)"
            className={`hidden sm:inline-flex px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              state.activePanel === 'tuner'
                ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
                : 'bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22]'
            }`}
          >
            Tuner [T]
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePanel('evp');
            }}
            aria-label="Toggle EVP Tape Recorder (V)"
            className={`hidden sm:inline-flex px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              state.activePanel === 'evp'
                ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
                : 'bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22]'
            }`}
          >
            EVP [V]
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={settings.muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            className="px-2.5 py-1.5 text-xs font-medium rounded border bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22] transition-colors whitespace-nowrap"
          >
            {settings.muted ? 'Unmute' : 'Mute'}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause Game (P)"
            className="px-2.5 py-1.5 text-xs font-medium rounded border bg-[#0c0e10]/90 text-[#dce2df] border-white/15 hover:bg-[#1a1f22] transition-colors whitespace-nowrap"
          >
            Pause [P]
          </button>
        </div>
      </div>

      {/* CENTER RETICLE & AIMED TARGET PROMPT */}
      {state.activePanel === 'none' &&
        !state.maskPrompt &&
        !state.safeHavenPromptOpen &&
        state.phase !== 'trial' && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <div
            className={`w-2 h-2 rounded-full border transition-transform ${
              aimTarget
                ? 'border-[#fbbf24] bg-[#fbbf24]/30 scale-125'
                : 'border-white/60 bg-transparent'
            }`}
          />
          {aimTarget && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onFlagTarget(aimTarget);
              }}
              className="pointer-events-auto mt-3 px-3 py-1 bg-[#0c0e10]/92 border border-white/20 rounded text-xs text-[#eef0ee] hover:bg-[#1a1f22] whitespace-nowrap"
            >
              [F] Log Change: {INSPECTABLE_TARGETS[aimTarget]}
            </button>
          )}
        </div>
      )}

      {/* STOP 6 SAFE HAVEN PROMPT (Myrtle-Willoughby Avs) */}
      {state.safeHavenPromptOpen && state.phase === 'dwelling' && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[92vw] max-w-md bg-[#111517] border border-[#6cbe45]/50 rounded-md p-5 pointer-events-auto"
          role="dialog"
          aria-label="Myrtle-Willoughby Safe Haven"
          data-testid="safe-haven-prompt"
        >
          <div className="text-xs font-mono-tabular text-[#86efac] uppercase tracking-wider mb-1">
            Stop {stop.number} · {stop.name}
          </div>
          <h3 className="font-display text-2xl font-bold text-white mb-2">
            Safe Haven Available
          </h3>
          <p className="text-xs sm:text-sm text-[#cfd6d3] leading-relaxed mb-4">
            The platform alcove is brightly lit and quiet before the dark stretch ahead. Take
            shelter briefly, or stay on the bench and refuse (+10 Suspicion).
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onSafeHavenChoice(true);
              }}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap"
            >
              Take Shelter
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onSafeHavenChoice(false);
              }}
              className="flex-1 py-2.5 px-4 text-xs font-medium text-[#fecaca] bg-[#2a1515] hover:bg-[#3a1b1b] border border-[#dc2626]/40 rounded transition-colors whitespace-nowrap"
            >
              Refuse Shelter (+10)
            </button>
          </div>
        </div>
      )}

      {/* STOP 11 RESTRAINT PROMPT (Greenpoint Av) */}
      {state.phase === 'restraint' && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[92vw] max-w-md bg-[#131112] border border-[#dc2626]/55 rounded-md p-5 pointer-events-auto text-center"
          data-testid="restraint-prompt"
        >
          <div className="text-xs font-mono-tabular text-[#fca5a5] uppercase tracking-wider mb-1">
            Stop {stop.number} · {stop.name}
          </div>
          <h3 className="font-display text-2xl font-bold text-white mb-1.5">
            Something Is Holding Your Shoulders
          </h3>
          <p className="text-xs text-[#d6dcd9] mb-4">
            Hold <strong className="text-white">SPACE</strong> (or press and hold the button below)
            and do not move the camera until it lets go.
          </p>

          <div className="w-full h-2.5 bg-[#231c1d] rounded overflow-hidden mb-4">
            <div
              className="h-full bg-[#eef0ee] transition-all duration-100"
              style={{ width: `${Math.round(state.restraintProgress * 100)}%` }}
            />
          </div>

          <button
            type="button"
            onMouseDown={() => onRestraintHoldChange(true)}
            onMouseUp={() => onRestraintHoldChange(false)}
            onMouseLeave={() => onRestraintHoldChange(false)}
            onTouchStart={() => onRestraintHoldChange(true)}
            onTouchEnd={() => onRestraintHoldChange(false)}
            className={`w-full py-3 px-4 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
              state.restraintHolding
                ? 'bg-[#6cbe45] text-[#080a09]'
                : 'bg-[#eef0ee] text-[#0b0d0e] hover:bg-white'
            }`}
          >
            {state.restraintHolding ? 'Holding Still — Do Not Move' : 'Hold Still [SPACE]'}
          </button>
        </div>
      )}

      {/* BOTTOM REGION: Parent Mask Question OR Dialogue Subtitle + Neutral Notice */}
      <div className="fixed inset-x-0 bottom-3 sm:bottom-5 z-20 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {/* Neutral Flag/Photo/EVP Confirmation Toast (Never reveals right or wrong) */}
        {state.neutralNotice && (
          <div className="bg-[#0c0e10]/94 border border-white/15 rounded px-3.5 py-1.5 text-xs text-[#dce2df]">
            {state.neutralNotice}
          </div>
        )}

        {/* Active Parent Mask Question Prompt */}
        {state.maskPrompt && (
          <div
            className="pointer-events-auto w-full max-w-xl bg-[#111416]/96 border border-[#f59e0b]/45 rounded-md p-4"
            role="dialog"
            aria-label="Parent question"
            data-testid="mask-prompt"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#fbbf24]">
                {state.maskPrompt.question.speaker}
              </span>
              <span className="font-mono-tabular text-[#b6bfbc]">
                {Math.ceil(state.maskPrompt.remainingSec)}s
              </span>
            </div>
            <p className="text-sm text-white mb-3">“{state.maskPrompt.question.prompt}”</p>
            <div className="w-full h-1 bg-[#222629] rounded overflow-hidden mb-3">
              <div
                className="h-full bg-[#f59e0b]"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (state.maskPrompt.remainingSec / state.maskPrompt.totalSec) * 100),
                  )}%`,
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {state.maskPrompt.question.options.map((opt, idx) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onAnswerMask(opt.id);
                  }}
                  className="text-left px-3.5 py-2 text-xs sm:text-sm text-[#e6ece9] bg-[#191e21] hover:bg-[#252c30] border border-white/12 rounded transition-colors"
                >
                  <span className="font-mono-tabular text-[#8f9995] mr-2">[{idx + 1}]</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ambient Parent Dialogue Subtitle */}
        {!state.maskPrompt && state.subtitle && (
          <div
            className="max-w-lg bg-[#0b0d0f]/92 border border-white/12 rounded px-4 py-2 text-xs sm:text-sm text-[#eef0ee] text-center"
            data-testid="parent-subtitle"
          >
            <span className="font-semibold text-[#cfd6d3] mr-2">{state.subtitle.speaker}:</span>
            <span>“{state.subtitle.text}”</span>
          </div>
        )}

        {/* Quiet desktop pointer-lock cue (only when unlocked and no modal open) */}
        {!pointerLocked &&
          state.activePanel === 'none' &&
          !state.maskPrompt &&
          !state.safeHavenPromptOpen &&
          state.phase !== 'restraint' &&
          state.phase !== 'trial' && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRequestPointerLock();
            }}
            className="hidden md:inline-block pointer-events-auto text-[11px] text-[#9ba4a0] hover:text-white bg-[#0b0d0f]/80 border border-white/10 rounded px-2.5 py-1 transition-colors"
          >
            Click to lock mouse look · Or use Arrow keys &amp; WASD
          </button>
        )}
      </div>
    </div>
  );
};
