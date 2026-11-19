/**
 * [V] Compact EVP Tape Recorder Deck — Record ambient car audio and play back the latest clip.
 */

import React from 'react';
import { EvpRecording } from '../game/state';

interface TapeRecorderWidgetProps {
  recording: boolean;
  elapsedSec: number;
  latestClip: EvpRecording | null;
  onToggleRecord: () => void;
  onPlayLatest: () => void;
  onClose: () => void;
}

export const TapeRecorderWidget: React.FC<TapeRecorderWidgetProps> = ({
  recording,
  elapsedSec,
  latestClip,
  onToggleRecord,
  onPlayLatest,
  onClose,
}) => {
  return (
    <div
      className="fixed bottom-16 right-4 z-25 w-[276px] bg-[#141719] border border-white/15 rounded-md p-3.5 text-[#eef0ee] pointer-events-auto"
      data-testid="evp-recorder"
    >
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
        <span className="font-mono-tabular text-xs font-semibold tracking-wider text-[#dce2df]">
          EVP CASSETTE DECK
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          className="text-[11px] text-[#9aa39f] hover:text-white whitespace-nowrap"
          aria-label="Close EVP Tape Recorder"
        >
          Close [V]
        </button>
      </div>

      {/* Tape Window */}
      <div className="bg-[#090b0c] border border-white/10 rounded px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[#7b8480] flex items-center justify-center text-[9px] font-mono-tabular">
            {recording ? '●' : '○'}
          </div>
          <div className="text-xs font-mono-tabular text-[#cfd6d3]">
            {recording ? `REC ${elapsedSec.toFixed(1)}s / 4.0s` : 'STANDBY'}
          </div>
        </div>
        <span className="font-mono-tabular text-[10px] text-[#8a9490]">SIDE A</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleRecord();
          }}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            recording
              ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
              : 'bg-[#eef0ee] text-[#0b0d0e] hover:bg-white'
          }`}
        >
          {recording ? 'Stop & Save' : 'Record EVP'}
        </button>

        <button
          type="button"
          disabled={!latestClip || recording}
          onClick={(e) => {
            e.currentTarget.blur();
            onPlayLatest();
          }}
          className={`py-2 px-3 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
            latestClip && !recording
              ? 'border-white/20 text-[#eef0ee] hover:bg-white/10'
              : 'border-white/8 text-[#636c68] cursor-not-allowed'
          }`}
        >
          Play Last
        </button>
      </div>

      {latestClip && (
        <div className="mt-2.5 pt-2 border-t border-white/8 text-[11px] text-[#9da7a3]">
          Last tape (Stop {latestClip.stopNumber}): {latestClip.transcriptHint}
        </div>
      )}
    </div>
  );
};
