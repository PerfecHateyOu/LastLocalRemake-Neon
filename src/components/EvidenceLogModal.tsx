/**
 * [TAB] Evidence & 13-Case Psychological Log Modal
 * - 13-Case Psych Log: clinical dossier (CASE 01..CASE 13) + field flags (never leaks right/wrong mid-ride)
 * - Polaroid Album: instant photos captured from Car B
 * - EVP Tapes: recorded cassette clips
 * - Tuner Signals: intercepted transit-band broadcasts
 */

import React, { useState } from 'react';
import { FlagLogEntry } from '../game/anomalies';
import { buildPsychCaseLog } from '../game/psychLog';
import { SubwayLineId } from '../game/route';
import { EvpRecording, PolaroidPhoto } from '../game/state';
import { TunerSignalLog } from '../game/tuner';

interface EvidenceLogModalProps {
  lineId: SubwayLineId;
  highestStopReached: number;
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  falseStopIncidentStops: number[];
  flagLog: FlagLogEntry[];
  photos: PolaroidPhoto[];
  evpClips: EvpRecording[];
  tunerLogs: TunerSignalLog[];
  onPlayEvp: (clip: EvpRecording) => void;
  onClose: () => void;
}

export const EvidenceLogModal: React.FC<EvidenceLogModalProps> = ({
  lineId,
  highestStopReached,
  safeHavenChoice,
  restraintOutcome,
  falseStopIncidentStops,
  flagLog,
  photos,
  evpClips,
  tunerLogs,
  onPlayEvp,
  onClose,
}) => {
  const [tab, setTab] = useState<'cases' | 'flags' | 'album' | 'evp' | 'tuner'>('cases');
  const cases = buildPsychCaseLog({
    lineId,
    highestStopReached,
    flagLog,
    safeHavenChoice,
    restraintOutcome,
    falseStopIncidentStops,
  });

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 9, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-log-title"
      data-testid="evidence-log-modal"
    >
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-[#111416] border border-white/15 rounded-md text-[#eef0ee] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 id="evidence-log-title" className="font-display text-2xl font-bold tracking-wide">
            13-Case Psych Log &amp; Evidence
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#cfd6d3] hover:text-white border border-white/15 rounded transition-colors whitespace-nowrap"
          >
            Close [TAB]
          </button>
        </div>

        {/* Interactive Tab Selector */}
        <div className="flex flex-wrap items-center gap-1 px-5 pt-3 pb-2 border-b border-white/10 bg-[#0d1012]">
          <button
            type="button"
            onClick={() => setTab('cases')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'cases' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            13-Case Log ({highestStopReached}/13)
          </button>
          <button
            type="button"
            onClick={() => setTab('flags')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'flags' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Flags ({flagLog.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('album')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'album' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Polaroids ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('evp')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'evp' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            EVP ({evpClips.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('tuner')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'tuner' ? 'bg-[#22282b] text-white' : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Radio ({tunerLogs.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto ll-scroll flex-1">
          {tab === 'cases' && (
            <div className="space-y-2">
              <p className="text-xs text-[#98a29e] mb-3">
                Clinical stop-by-stop case log for the {lineId} line. Flag verification is withheld
                until the final report.
              </p>
              {cases.map((entry) => (
                <div
                  key={entry.caseNumber}
                  className={`px-3.5 py-2.5 rounded border text-xs ${
                    entry.status === 'incident'
                      ? 'bg-[#1a1213] border-[#dc2626]/35'
                      : entry.status === 'flagged'
                        ? 'bg-[#121714] border-[#6cbe45]/35'
                        : entry.status === 'observed'
                          ? 'bg-[#0b0d0f] border-white/10'
                          : 'bg-[#090b0c] border-white/6 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold text-[#eef0ee]">
                      <span className="font-mono-tabular text-[#86efac] mr-2">{entry.code}</span>
                      {entry.stopName} · <span className="font-normal text-[#b7c0bc]">{entry.clinicalTitle}</span>
                    </div>
                    <span className="font-mono-tabular text-[10px] uppercase text-[#9aa4a0] shrink-0">
                      {entry.status === 'unvisited' ? 'SEALED' : entry.status}
                    </span>
                  </div>
                  <p className="text-[#9ca5a1]">{entry.summaryNote}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'flags' && (
            <div>
              <p className="text-xs text-[#98a29e] mb-3">
                Observations you flagged inside Car B. Verification is withheld until the terminus.
              </p>
              {flagLog.length === 0 ? (
                <div className="text-sm text-[#858f8b] py-8 text-center border border-white/8 rounded">
                  No observations logged yet. Aim at something wrong and press F (or click) to log
                  it.
                </div>
              ) : (
                <ul className="space-y-2">
                  {flagLog.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[#eef0ee] truncate">
                          {item.targetLabel}
                        </div>
                        <div className="text-[#8f9995] mt-0.5">
                          Stop {item.stopNumber} · {item.stopName}
                        </div>
                      </div>
                      <span className="font-mono-tabular text-[11px] text-[#8d9793] shrink-0">
                        {Math.floor(item.timestampSec)}s
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'album' && (
            <div>
              {photos.length === 0 ? (
                <div className="text-sm text-[#858f8b] py-8 text-center border border-white/8 rounded">
                  No Polaroids taken yet. Press C to raise the camera viewfinder and snap a photo.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {photos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="bg-[#eaeae4] text-[#181b1c] p-2.5 pb-4 rounded-sm"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.caption}
                        className="w-full aspect-video object-cover bg-[#111] block"
                      />
                      <figcaption className="mt-2.5 text-xs font-mono-tabular text-[#2a2f31] flex items-center justify-between">
                        <span className="truncate">{photo.caption}</span>
                        <span>{Math.floor(photo.timestampSec)}s</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'evp' && (
            <div>
              {evpClips.length === 0 ? (
                <div className="text-sm text-[#858f8b] py-8 text-center border border-white/8 rounded">
                  No EVP clips recorded yet. Press V to open the tape recorder.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {evpClips.map((clip) => (
                    <li
                      key={clip.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#eef0ee]">
                          Stop {clip.stopNumber} · {clip.stopName} ({clip.durationSec}s)
                        </div>
                        <div className="text-xs text-[#98a29e] mt-0.5 truncate">
                          {clip.transcriptHint}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPlayEvp(clip)}
                        className="px-3 py-1.5 text-xs font-medium text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap shrink-0"
                      >
                        Play Tape
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'tuner' && (
            <div>
              {tunerLogs.length === 0 ? (
                <div className="text-sm text-[#858f8b] py-8 text-center border border-white/8 rounded">
                  No transit radio broadcasts intercepted yet. Press T to open the Frequency Tuner.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {tunerLogs.map((sig) => (
                    <li
                      key={sig.id}
                      className="px-3.5 py-2.5 bg-[#0b0d0f] border border-white/10 rounded text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono-tabular font-semibold text-[#fbbf24]">
                          {sig.frequencyMhz.toFixed(1)} MHz · {sig.label}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-[#8d9793]">
                          S{sig.stopNumber} · {sig.stopName}
                        </span>
                      </div>
                      <p className="text-[#cfd6d3]">{sig.transcript}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
