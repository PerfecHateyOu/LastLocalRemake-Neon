/**
 * 3-Stage False Stop Trial Overlay — Last Local
 * Appears when the player steps off Car B at a false stop (Stop 4 or Stop 9).
 * Supports Stage 1 (Platform Orientation), Stage 2 (Hold Still vs Voice), and Stage 3 (Closing Doors).
 */

import React from 'react';
import { TrialState } from '../game/trial';

interface FalseStopTrialModalProps {
  trial: TrialState;
  onSelectChoice: (choiceId: string) => void;
  onHoldChange: (holding: boolean) => void;
}

export const FalseStopTrialModal: React.FC<FalseStopTrialModalProps> = ({
  trial,
  onSelectChoice,
  onHoldChange,
}) => {
  const timerPct = Math.max(
    0,
    Math.min(100, (trial.stageTimer / Math.max(0.1, trial.stageDuration)) * 100),
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(8, 9, 10, 0.86)' }}
      role="dialog"
      aria-modal="true"
      aria-label="False Stop Trial"
      data-testid="false-stop-trial-modal"
    >
      <div className="w-full max-w-xl bg-[#131112] border border-[#dc2626]/55 rounded-md p-5 sm:p-6 text-[#eef0ee]">
        {/* Header Row: Stop & Stage + Strikes */}
        <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
          <div>
            <div className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#fca5a5]">
              FALSE STOP TRIAL · STOP {trial.stopNumber} ({trial.stopName})
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white mt-0.5">
              {trial.headline}
            </h2>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-[#9ba3a0]">Strikes</div>
            <div className="font-mono-tabular text-base font-bold text-[#fca5a5]">
              {trial.strikes} / {trial.maxStrikes}
            </div>
          </div>
        </div>

        {/* Stage Progress Indicator + Countdown */}
        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#b0b8b5] mb-1.5">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`px-2 py-0.5 rounded border ${
                  trial.stage === s
                    ? 'bg-[#dc2626]/25 border-[#f87171] text-white'
                    : trial.stage > s
                      ? 'bg-[#19281d] border-[#6cbe45]/50 text-[#86efac]'
                      : 'bg-[#0b0d0e] border-white/10 text-[#727a77]'
                }`}
              >
                S{s}
              </span>
            ))}
          </div>
          <span>{Math.ceil(trial.stageTimer)}s remaining</span>
        </div>

        <div className="w-full h-1.5 bg-[#241b1c] rounded overflow-hidden mb-4">
          <div
            className="h-full bg-[#ef4444] transition-all duration-100"
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Previous Stage Feedback */}
        {trial.lastFeedback && (
          <div className="mb-3 px-3 py-2 bg-[#1c1718] border border-white/10 rounded text-xs text-[#e5cfcf]">
            {trial.lastFeedback}
          </div>
        )}

        {/* Prompt Copy */}
        <p className="text-sm leading-relaxed text-[#e2e7e5] mb-5">{trial.prompt}</p>

        {/* Stage 2: Hold Still Mechanics */}
        {trial.stage === 2 ? (
          <div>
            <div className="flex items-center justify-between text-xs font-mono-tabular text-[#a9b2ae] mb-1.5">
              <span>Composure Lock</span>
              <span>{Math.round(trial.holdProgress * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#231c1d] rounded overflow-hidden mb-4">
              <div
                className="h-full bg-[#eef0ee] transition-all duration-75"
                style={{ width: `${Math.round(trial.holdProgress * 100)}%` }}
              />
            </div>

            <button
              type="button"
              data-testid="trial-hold-btn"
              onMouseDown={() => onHoldChange(true)}
              onMouseUp={() => onHoldChange(false)}
              onMouseLeave={() => onHoldChange(false)}
              onTouchStart={() => onHoldChange(true)}
              onTouchEnd={() => onHoldChange(false)}
              className={`w-full py-3 px-4 text-sm font-semibold rounded transition-colors ${
                trial.holdingStill
                  ? 'bg-[#6cbe45] text-[#080a09]'
                  : 'bg-[#eef0ee] text-[#0b0d0e] hover:bg-white'
              }`}
            >
              {trial.holdingStill
                ? 'Holding Still — Do Not Turn Around'
                : 'Hold Still [SPACE] (or Press & Hold)'}
            </button>
          </div>
        ) : (
          /* Stage 1 & Stage 3: Timed 3-Choice Decisions */
          <div className="grid grid-cols-1 gap-2.5">
            {trial.choices.map((choice, idx) => (
              <button
                key={choice.id}
                type="button"
                data-testid={`trial-choice-${idx + 1}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectChoice(choice.id);
                }}
                className="text-left px-4 py-3 text-xs sm:text-sm text-[#eef0ee] bg-[#1a1d1f] hover:bg-[#262b2e] border border-white/15 rounded transition-colors"
              >
                <span className="font-mono-tabular text-[#fca5a5] mr-2.5">[{idx + 1}]</span>
                {choice.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
