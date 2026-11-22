/**
 * Travel Report / Ending Screen — Priority-Ranked 8-Ending Evaluation,
 * Suspicion/Sanity/Flag/Haven/Restraint/Trial/Tuner summary, Unlocked Achievements,
 * Archive shortcut, and Nightmare unlock notice.
 */

import React from 'react';
import { getLineDefinition } from '../game/route';
import { EndingReportData, RideDifficulty } from '../game/state';
import { getSuspicionBandInfo } from '../game/suspicion';

interface EndingReportProps {
  report: EndingReportData;
  nightmareUnlocked: boolean;
  discoveredEndingsCount: number;
  onOpenArchive: () => void;
  onPlayAgain: (difficulty: RideDifficulty) => void;
  onReturnTitle: () => void;
}

export const EndingReport: React.FC<EndingReportProps> = ({
  report,
  nightmareUnlocked,
  discoveredEndingsCount,
  onOpenArchive,
  onPlayAgain,
  onReturnTitle,
}) => {
  const bandInfo = getSuspicionBandInfo(report.finalSuspicion);
  const line = getLineDefinition(report.lineId);
  const mins = Math.floor(report.durationSec / 60);
  const secs = String(report.durationSec % 60).padStart(2, '0');
  const totalEvidence = report.photosTaken + report.evpClipsRecorded + report.tunerSignalsLocked;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(8, 10, 11, 0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ending-report-title"
      data-testid="ending-report"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto ll-scroll bg-[#121517] border border-white/15 rounded-md p-6 text-[#eef0ee]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9aa4a0] mb-1.5">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: line.color }}
              >
                {line.id}
              </span>
              <span className="font-mono-tabular text-[#d4dad7]">
                {report.priority > 0 ? `P${report.priority} · ${report.code}` : report.code}
              </span>
              <span aria-hidden="true">·</span>
              <span>{line.terminusName} Travel Report</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {mins}:{secs}
              </span>
            </div>
            <h1 id="ending-report-title" className="font-display text-3xl sm:text-4xl font-bold tracking-wide">
              {report.title}
            </h1>
            <p className="text-xs text-[#9ca5a1] mt-1">{report.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-[#98a29e] uppercase tracking-wider">Final Band</div>
            <div
              className="font-display text-2xl font-bold tracking-wider"
              style={{ color: bandInfo.color }}
            >
              {report.finalSuspicionBand}
            </div>
          </div>
        </div>

        {/* Narrative Summary */}
        <p className="text-sm sm:text-[15px] leading-relaxed text-[#d6dcd9] mb-6">
          {report.summary}
        </p>

        {/* Nightmare Mode Unlock Notice */}
        {report.nightmareJustUnlocked && (
          <div className="mb-5 px-4 py-3 bg-[#241313] border border-[#dc2626]/45 rounded text-xs text-[#fecaca]">
            <strong className="font-semibold">Nightmare Mode Unlocked:</strong> Shorter cruise
            times, faster train speed, more frequent parent glances, longer held stares, and faster
            sanity drift.
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#0b0d0f] border border-white/10 rounded p-3">
            <div className="text-[11px] text-[#8e9894]">Suspicion</div>
            <div className="font-mono-tabular text-xl font-semibold mt-0.5">
              {report.finalSuspicion}
              <span className="text-xs text-[#7d8682] font-normal"> / 100</span>
            </div>
            <div className="text-[11px] text-[#858f8b] mt-0.5">Peak {report.peakSuspicion}</div>
          </div>

          <div className="bg-[#0b0d0f] border border-white/10 rounded p-3">
            <div className="text-[11px] text-[#8e9894]">Sanity</div>
            <div className="font-mono-tabular text-xl font-semibold mt-0.5">
              {report.finalSanity}
            </div>
            <div className="text-[11px] text-[#858f8b] mt-0.5">{report.finalSanityTier} Tier</div>
          </div>

          <div className="bg-[#0b0d0f] border border-white/10 rounded p-3">
            <div className="text-[11px] text-[#8e9894]">Flags Verified</div>
            <div className="font-mono-tabular text-xl font-semibold mt-0.5">
              {report.trueFlags}
              <span className="text-xs text-[#7d8682] font-normal"> / {report.totalFlags}</span>
            </div>
            <div className="text-[11px] text-[#858f8b] mt-0.5">
              {report.falsePositives} false positives
            </div>
          </div>

          <div className="bg-[#0b0d0f] border border-white/10 rounded p-3">
            <div className="text-[11px] text-[#8e9894]">Archive Evidence</div>
            <div className="font-mono-tabular text-xl font-semibold mt-0.5">{totalEvidence}</div>
            <div className="text-[11px] text-[#858f8b] mt-0.5">
              {report.photosTaken}P · {report.evpClipsRecorded}E · {report.tunerSignalsLocked}R
            </div>
          </div>
        </div>

        {/* Key Stop & Trial Decisions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6 text-xs">
          <div className="bg-[#0b0d0f] border border-white/10 rounded px-3 py-2.5">
            <div className="text-[#8e9894] text-[11px]">Stop 6 · Safe Haven</div>
            <div className="font-medium text-[#eef0ee] mt-0.5">
              {report.safeHavenChoice === 'taken'
                ? 'Took Shelter'
                : report.safeHavenChoice === 'refused'
                  ? 'Refused (+10)'
                  : 'Not Reached'}
            </div>
          </div>
          <div className="bg-[#0b0d0f] border border-white/10 rounded px-3 py-2.5">
            <div className="text-[#8e9894] text-[11px]">Stop 11 · Restraint</div>
            <div className="font-medium text-[#eef0ee] mt-0.5">
              {report.restraintOutcome === 'held_still'
                ? 'Held Still'
                : report.restraintOutcome === 'let_go'
                  ? 'Let Go / Moved'
                  : 'Not Reached'}
            </div>
          </div>
          <div className="bg-[#0b0d0f] border border-white/10 rounded px-3 py-2.5">
            <div className="text-[#8e9894] text-[11px]">False Stop Trial</div>
            <div className="font-medium text-[#eef0ee] mt-0.5">
              {report.falseStopTrialCollapsed
                ? 'Collapsed'
                : report.falseStopTrialsSurvived > 0
                  ? `Survived (${report.falseStopTrialsSurvived})`
                  : 'Never Triggered'}
            </div>
          </div>
        </div>

        {/* Unlocked Achievements */}
        {report.unlockedAchievements.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-medium text-[#aeb7b3] mb-2">
              Achievements Recorded ({report.unlockedAchievements.length})
            </div>
            <ul className="space-y-1.5 text-xs text-[#d6dcd9]">
              {report.unlockedAchievements.map((ach) => (
                <li
                  key={ach}
                  className="px-3 py-2 bg-[#0b0d0f] border border-white/8 rounded flex items-center justify-between"
                >
                  <span>{ach}</span>
                  <span className="font-mono-tabular text-[11px] text-[#6cbe45]">SAVED</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnTitle();
              }}
              className="px-4 py-2 text-xs font-medium text-[#cfd6d3] hover:text-white border border-white/15 rounded transition-colors whitespace-nowrap"
            >
              Return to Title
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenArchive();
              }}
              className="px-3.5 py-2 text-xs font-medium text-[#dce2df] bg-[#191e21] hover:bg-[#242b30] border border-white/15 rounded transition-colors whitespace-nowrap"
            >
              Archive ({discoveredEndingsCount}/8)
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {nightmareUnlocked && report.difficulty !== 'nightmare' && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPlayAgain('nightmare');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#fecaca] bg-[#2a1212] hover:bg-[#3a1616] border border-[#dc2626]/50 rounded transition-colors whitespace-nowrap"
              >
                Try Nightmare Mode
              </button>
            )}
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onPlayAgain(report.difficulty === 'practice' ? 'standard' : report.difficulty);
              }}
              className="px-5 py-2 text-sm font-semibold text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap"
            >
              {report.difficulty === 'practice' ? 'Start Full 13-Stop Ride' : 'Ride Again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
