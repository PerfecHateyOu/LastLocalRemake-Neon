/**
 * [TAB] Evidence & Psychological Log Modal
 * - Psychological Log: records what the player flagged (NEVER reveals right/wrong during ride)
 * - Polaroid Album: displays instant photos captured from Car B
 * - EVP Archive: lets the player play back recorded tape clips
 */

import React, { useState } from 'react';
import { FlagLogEntry } from '../game/anomalies';
import { EvpRecording, PolaroidPhoto } from '../game/state';

interface EvidenceLogModalProps {
  flagLog: FlagLogEntry[];
  photos: PolaroidPhoto[];
  evpClips: EvpRecording[];
  onPlayEvp: (clip: EvpRecording) => void;
  onClose: () => void;
}

export const EvidenceLogModal: React.FC<EvidenceLogModalProps> = ({
  flagLog,
  photos,
  evpClips,
  onPlayEvp,
  onClose,
}) => {
  const [tab, setTab] = useState<'log' | 'album' | 'evp'>('log');

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
            Evidence &amp; Psychological Log
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
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/10 bg-[#0d1012]">
          <button
            type="button"
            onClick={() => setTab('log')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'log'
                ? 'bg-[#22282b] text-white'
                : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Psychological Log ({flagLog.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('album')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'album'
                ? 'bg-[#22282b] text-white'
                : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            Polaroid Album ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('evp')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === 'evp'
                ? 'bg-[#22282b] text-white'
                : 'text-[#98a29e] hover:text-[#dce2df]'
            }`}
          >
            EVP Tapes ({evpClips.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto ll-scroll flex-1">
          {tab === 'log' && (
            <div>
              <p className="text-xs text-[#98a29e] mb-3">
                Observations you flagged inside Car B. Verification is withheld until Court Sq.
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
        </div>
      </div>
    </div>
  );
};
