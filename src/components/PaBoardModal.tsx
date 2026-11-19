/**
 * [B] PA Board Modal — G Train 13-stop route strip (Court Sq dot glows brighter),
 * live PA announcement feed, and display-only Suspicion meter.
 */

import React from 'react';
import { ROUTE_STOPS } from '../game/route';
import { PaFeedEntry } from '../game/state';
import { SuspicionBar } from './SuspicionBar';

interface PaBoardModalProps {
  currentStopIndex: number;
  suspicionValue: number;
  paFeed: PaFeedEntry[];
  ledText: string;
  onClose: () => void;
}

export const PaBoardModal: React.FC<PaBoardModalProps> = ({
  currentStopIndex,
  suspicionValue,
  paFeed,
  ledText,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 9, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pa-board-title"
      data-testid="pa-board-modal"
    >
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-[#111416] border border-white/15 rounded-md text-[#eef0ee] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: '#6cbe45' }}
            >
              G
            </span>
            <h2 id="pa-board-title" className="font-display text-2xl font-bold tracking-wide">
              PA Board &amp; Route Strip
            </h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#cfd6d3] hover:text-white border border-white/15 rounded transition-colors whitespace-nowrap"
          >
            Close [B]
          </button>
        </div>

        <div className="p-5 overflow-y-auto ll-scroll space-y-5">
          {/* Overhead LED mirror + Display-only Suspicion Meter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="bg-[#08090a] border border-white/12 rounded px-3.5 py-2.5">
              <div className="text-[10px] tracking-wider uppercase text-[#88918d] mb-1">
                Car B Overhead LED
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-[#fbbf24] tracking-wider truncate">
                {ledText || '— POWER INTERRUPTED —'}
              </div>
            </div>
            <SuspicionBar value={suspicionValue} compact />
          </div>

          {/* Exact 13-stop Route Strip */}
          <div>
            <div className="flex items-center justify-between text-xs text-[#9ca5a1] mb-2.5">
              <span>Hoyt-Schermerhorn to Court Sq</span>
              <span className="font-mono-tabular">
                Stop {currentStopIndex + 1} / {ROUTE_STOPS.length}
              </span>
            </div>

            <div className="bg-[#0b0d0f] border border-white/10 rounded p-3.5">
              <ol className="space-y-1.5">
                {ROUTE_STOPS.map((stop) => {
                  const isCurrent = stop.index === currentStopIndex;
                  const isPassed = stop.index < currentStopIndex;
                  const isCourtSq = stop.index === 12;

                  return (
                    <li
                      key={stop.number}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                        isCurrent
                          ? 'bg-[#1c231f] text-white font-semibold'
                          : isPassed
                            ? 'text-[#7b8480]'
                            : 'text-[#cfd6d3]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-tabular w-5 text-[11px] text-[#7e8884] shrink-0">
                          {String(stop.number).padStart(2, '0')}
                        </span>
                        {/* Route Line Dot */}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: isCourtSq
                              ? '#bbf7d0'
                              : isCurrent
                                ? '#6cbe45'
                                : isPassed
                                  ? '#3f5a38'
                                  : '#2b3133',
                            border: isCourtSq
                              ? '2px solid #4ade80'
                              : isCurrent
                                ? '2px solid #ffffff'
                                : '1.5px solid #6cbe45',
                            boxShadow: isCourtSq
                              ? '0 0 10px 2px rgba(134, 239, 172, 0.75)'
                              : 'none',
                          }}
                        />
                        <span className="truncate">{stop.name}</span>
                      </div>

                      <span className="font-mono-tabular text-[11px] text-[#98a29e] shrink-0 ml-2">
                        {isCurrent ? 'CURRENT' : isCourtSq ? 'TERMINUS' : isPassed ? 'PASSED' : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Live PA Announcement Feed */}
          <div>
            <div className="text-xs font-medium text-[#aeb7b3] mb-2">Intercom PA Feed</div>
            <div className="bg-[#0b0d0f] border border-white/10 rounded p-3 max-h-40 overflow-y-auto ll-scroll space-y-2">
              {paFeed.length === 0 ? (
                <p className="text-xs text-[#7d8682]">No intercom announcements recorded yet.</p>
              ) : (
                paFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs text-[#d6dcd9] pb-2 border-b border-white/6 last:border-b-0 last:pb-0 flex gap-3"
                  >
                    <span className="font-mono-tabular text-[11px] text-[#8a9490] shrink-0">
                      S{String(entry.stopNumber).padStart(2, '0')}
                    </span>
                    <span>“{entry.text}”</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
