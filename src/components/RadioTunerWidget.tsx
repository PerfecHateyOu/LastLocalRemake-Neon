/**
 * [T] Transit-Band Radio / PA Frequency Tuner Widget — Last Local
 * Compact handheld scanner (88.0–108.0 MHz) for intercepting hidden transit control,
 * maintenance loop, and dead-air carrier broadcasts.
 */

import React from 'react';
import { SubwayLineId } from '../game/route';
import {
  evaluateTunerSignal,
  TUNER_MAX_MHZ,
  TUNER_MIN_MHZ,
  TunerSignalLog,
} from '../game/tuner';

interface RadioTunerWidgetProps {
  frequencyMhz: number;
  lineId: SubwayLineId;
  stopNumber: number;
  logs: TunerSignalLog[];
  onChangeFrequency: (nextMhz: number) => void;
  onLockSignal: () => void;
  onClose: () => void;
}

export const RadioTunerWidget: React.FC<RadioTunerWidgetProps> = ({
  frequencyMhz,
  lineId,
  stopNumber,
  logs,
  onChangeFrequency,
  onLockSignal,
  onClose,
}) => {
  const { strength, lockedChannel } = evaluateTunerSignal(frequencyMhz, lineId, stopNumber);
  const strengthPct = Math.round(strength * 100);
  const alreadyLogged = lockedChannel ? logs.some((l) => l.channelId === lockedChannel.id) : false;

  return (
    <div
      className="fixed right-4 bottom-20 z-30 w-[92vw] max-w-sm bg-[#111416] border border-white/15 rounded-md p-4 text-[#eef0ee] pointer-events-auto"
      role="dialog"
      aria-label="Transit Radio Tuner"
      data-testid="radio-tuner-widget"
    >
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div>
          <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#9ba3a0]">
            Car B Handheld Scanner · {lineId} Band
          </div>
          <h3 className="font-display text-xl font-bold tracking-wide">PA / Radio Tuner</h3>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          className="px-2.5 py-1 text-xs text-[#cfd6d3] hover:text-white border border-white/15 rounded"
        >
          Close [T]
        </button>
      </div>

      {/* Digital Frequency Display */}
      <div className="bg-[#080a0b] border border-white/12 rounded p-3 mb-3">
        <div className="flex items-baseline justify-between">
          <span
            className="font-mono-tabular text-2xl font-bold tracking-wider"
            style={{ color: lockedChannel ? '#86efac' : '#fbbf24' }}
            data-testid="tuner-freq-readout"
          >
            {frequencyMhz.toFixed(1)} MHz
          </span>
          <span className="font-mono-tabular text-[11px] text-[#9ca5a1]">
            SIG {strengthPct}%
          </span>
        </div>

        {/* Signal Strength Meter */}
        <div className="w-full h-2 bg-[#1a1e20] rounded overflow-hidden mt-2 mb-2.5">
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${strengthPct}%`,
              backgroundColor: lockedChannel ? '#6cbe45' : strength > 0.45 ? '#f59e0b' : '#64748b',
            }}
          />
        </div>

        {/* Decoded Broadcast / Static Readout */}
        <div className="text-xs min-h-[38px] leading-snug text-[#d4dbd8]">
          {lockedChannel ? (
            <>
              <div className="font-mono-tabular text-[10px] uppercase text-[#86efac] mb-0.5">
                CARRIER LOCK · {lockedChannel.label}
              </div>
              <span>{lockedChannel.transcript}</span>
            </>
          ) : (
            <span className="text-[#7e8783]">
              {strength > 0.45
                ? '...carrier nearby — fine-tune 0.1 MHz...'
                : '...broadband tunnel static...'}
            </span>
          )}
        </div>
      </div>

      {/* Slider & Coarse/Fine Tuning Controls */}
      <input
        type="range"
        aria-label="Radio frequency in MHz"
        min={TUNER_MIN_MHZ}
        max={TUNER_MAX_MHZ}
        step={0.1}
        value={frequencyMhz}
        onChange={(e) => onChangeFrequency(parseFloat(e.target.value))}
        className="w-full accent-[#fbbf24] mb-2.5 cursor-pointer"
      />

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: '-1.0', delta: -1.0 },
          { label: '-0.1', delta: -0.1 },
          { label: '+0.1', delta: 0.1 },
          { label: '+1.0', delta: 1.0 },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onChangeFrequency(frequencyMhz + btn.delta);
            }}
            className="py-1.5 text-xs font-mono-tabular bg-[#191e21] hover:bg-[#252c30] border border-white/12 rounded"
          >
            {btn.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        data-testid="tuner-lock-btn"
        onClick={(e) => {
          e.currentTarget.blur();
          onLockSignal();
        }}
        className={`w-full py-2 text-xs font-semibold rounded transition-colors ${
          lockedChannel && !alreadyLogged
            ? 'bg-[#eef0ee] text-[#0b0d0e] hover:bg-white'
            : 'bg-[#1a1f22] text-[#b4bdb9] border border-white/12 hover:bg-[#232a2e]'
        }`}
      >
        {alreadyLogged
          ? 'Broadcast Logged'
          : lockedChannel
            ? `Log Broadcast (${lockedChannel.frequencyMhz.toFixed(1)} MHz)`
            : 'Attempt Carrier Lock'}
      </button>

      {/* Intercepted Count */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8f9995]">
        <span>Intercepted this ride</span>
        <span className="font-mono-tabular text-[#d4dad7]">{logs.length} logged</span>
      </div>
    </div>
  );
};
