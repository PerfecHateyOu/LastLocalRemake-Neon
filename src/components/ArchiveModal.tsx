/**
 * Persistent Archive Modal — Last Local
 * Displays saved progress across runs: 8 Priority-Ranked Endings, 13-Case Psychological Log,
 * G/L/7 Line Records, Intercepted Radio Channels, Achievements, and Recent Run History.
 */

import React, { useState } from 'react';
import { ArchiveData } from '../game/archive';
import { ENDING_CATALOG } from '../game/endings';
import { PSYCH_CASE_TEMPLATES } from '../game/psychLog';
import { SUBWAY_LINES, SubwayLineId } from '../game/route';
import { TUNER_CHANNELS } from '../game/tuner';

interface ArchiveModalProps {
  archive: ArchiveData;
  onResetArchive: () => void;
  onClose: () => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  archive,
  onResetArchive,
  onClose,
}) => {
  const [tab, setTab] = useState<'endings' | 'cases' | 'lines' | 'history'>('endings');
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 9, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
      data-testid="archive-modal"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#111416] border border-white/15 rounded-md text-[#eef0ee] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div>
            <div className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#9aa4a0]">
              Saved Transit Records · {archive.totalRidesCompleted} Ride
              {archive.totalRidesCompleted === 1 ? '' : 's'} Logged
            </div>
            <h2 id="archive-modal-title" className="font-display text-2xl font-bold tracking-wide">
              Persistent Archive
            </h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#cfd6d3] hover:text-white border border-white/15 rounded transition-colors"
          >
            Close
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap items-center gap-1 px-5 pt-3 pb-2 border-b border-white/10 bg-[#0d1012]">
          <button
            type="button"
            onClick={() => setTab('endings')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'endings' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Endings ({archive.discoveredEndings.length}/8)
          </button>
          <button
            type="button"
            onClick={() => setTab('cases')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'cases' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            13-Case Psych Log ({archive.observedCases.length}/13)
          </button>
          <button
            type="button"
            onClick={() => setTab('lines')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'lines' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Lines &amp; Tuner ({archive.completedLines.length}/3)
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'history' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Run History ({archive.runHistory.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto ll-scroll flex-1">
          {tab === 'endings' && (
            <div className="space-y-2.5">
              <p className="text-xs text-[#98a29e] mb-3">
                All 8 endings evaluated in strict priority order (END-01 highest to END-08 default).
              </p>
              {ENDING_CATALOG.map((end) => {
                const unlocked = archive.discoveredEndings.includes(end.id);
                return (
                  <div
                    key={end.id}
                    className={`p-3.5 rounded border ${
                      unlocked
                        ? 'bg-[#0e1211] border-[#6cbe45]/40'
                        : 'bg-[#0b0d0f] border-white/8 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-tabular text-[11px] text-[#98a29e]">
                          P{end.priority} · {end.code}
                        </span>
                        <span className="text-sm font-semibold text-[#eef0ee]">
                          {unlocked ? end.title : 'Unrecorded Ending'}
                        </span>
                      </div>
                      <span
                        className={`font-mono-tabular text-[10px] uppercase ${
                          unlocked ? 'text-[#86efac]' : 'text-[#747e7a]'
                        }`}
                      >
                        {unlocked ? 'UNLOCKED' : 'LOCKED'}
                      </span>
                    </div>
                    <p className="text-xs text-[#9ca5a1]">{end.requirementHint}</p>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'cases' && (
            <div className="space-y-2">
              <p className="text-xs text-[#98a29e] mb-3">
                Clinical observation files unlocked across Stops 1–13 on any subway line.
              </p>
              {PSYCH_CASE_TEMPLATES.map((tpl) => {
                const unlocked = archive.observedCases.includes(tpl.caseNumber);
                return (
                  <div
                    key={tpl.caseNumber}
                    className="px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-semibold text-[#eef0ee]">
                        <span className="font-mono-tabular text-[#86efac] mr-2">{tpl.code}</span>
                        {tpl.clinicalTitle}
                      </div>
                      <span className="font-mono-tabular text-[10px] text-[#8d9793]">
                        {unlocked ? 'OBSERVED' : 'SEALED'}
                      </span>
                    </div>
                    <p className="text-[#9ca5a1]">
                      {unlocked
                        ? tpl.baselineNote
                        : `Reach Stop ${tpl.caseNumber} to unseal this clinical note.`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'lines' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium text-[#aeb7b3] mb-2.5">
                  NYC Local Lines Cleared
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['G', 'L', '7'] as SubwayLineId[]).map((id) => {
                    const line = SUBWAY_LINES[id];
                    const cleared = archive.completedLines.includes(id);
                    const bestSusp = archive.bestSuspicionByLine[id];
                    return (
                      <div
                        key={id}
                        className="p-3.5 bg-[#0b0d0f] border border-white/10 rounded"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: line.color }}
                          >
                            {line.id}
                          </span>
                          <span className="text-sm font-semibold">{line.name}</span>
                        </div>
                        <div className="text-[11px] text-[#98a29e]">
                          {line.stops[0].name} → {line.terminusName}
                        </div>
                        <div className="mt-2 font-mono-tabular text-[11px] text-[#d6dcd9]">
                          {cleared
                            ? `CLEARED · Best Suspicion ${bestSusp ?? 0}`
                            : 'Not yet cleared (Full Ride)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-[#aeb7b3] mb-2.5">
                  Intercepted Transit Radio Channels ({archive.unlockedTunerChannels.length}/
                  {TUNER_CHANNELS.length})
                </div>
                <div className="space-y-2">
                  {TUNER_CHANNELS.map((ch) => {
                    const locked = !archive.unlockedTunerChannels.includes(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className="px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-mono-tabular font-semibold text-[#fbbf24]">
                            {ch.frequencyMhz.toFixed(1)} MHz · {ch.label}
                          </span>
                          <span className="font-mono-tabular text-[10px] text-[#8d9793]">
                            {ch.lineScope === 'ALL' ? 'G / L / 7' : `${ch.lineScope} LINE`} · S
                            {ch.minStop}–S{ch.maxStop}
                          </span>
                        </div>
                        <p className="text-[#9ca5a1]">
                          {locked
                            ? 'Scan this frequency with the [T] Radio Tuner during a ride to log.'
                            : ch.transcript}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              {archive.runHistory.length === 0 ? (
                <div className="text-sm text-[#858f8b] py-8 text-center border border-white/8 rounded">
                  No completed rides recorded yet. Board Car B to begin your archive.
                </div>
              ) : (
                <div className="space-y-2">
                  {archive.runHistory.map((run) => (
                    <div
                      key={run.id}
                      className="px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono-tabular font-semibold text-[#eef0ee] mr-2">
                          [{run.lineId}] {run.endingTitle}
                        </span>
                        <span className="text-[#8f9995]">
                          {run.difficulty} · {run.chapterId.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-mono-tabular text-[#b8c1bd]">
                        Susp {run.finalSuspicion} · San {run.finalSanity} · Flags {run.trueFlags}/
                        {run.trueFlags + run.falsePositives}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {archive.achievements.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[#aeb7b3] mb-2">
                    Achievements ({archive.achievements.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {archive.achievements.map((ach) => (
                      <span
                        key={ach}
                        className="px-2.5 py-1 text-[11px] bg-[#0b0d0f] border border-white/10 rounded text-[#cfd6d3]"
                      >
                        {ach}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear archive option */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-[#8a9490]">
                  Archive data saves automatically in your browser.
                </span>
                {confirmReset ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetArchive();
                        setConfirmReset(false);
                      }}
                      className="px-3 py-1 text-xs font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded"
                    >
                      Confirm Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1 text-xs text-[#cfd6d3] border border-white/15 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="px-3 py-1 text-xs text-[#fca5a5] border border-[#dc2626]/35 hover:bg-[#2a1212] rounded"
                  >
                    Clear Archive
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
