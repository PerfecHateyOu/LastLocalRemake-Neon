/**
 * Short Tutorial Briefing — Leads from Start Screen into Hoyt-Schermerhorn boarding.
 */

import React from 'react';
import { RideDifficulty } from '../game/state';

interface TutorialOverlayProps {
  difficulty: RideDifficulty;
  onContinue: () => void;
  onBack: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  difficulty,
  onContinue,
  onBack,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 10, 11, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-heading"
    >
      <div className="w-full max-w-lg bg-[#121517] border border-white/15 rounded-md p-6 text-[#e8ecea]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: '#6cbe45' }}
            >
              G
            </span>
            <h2 id="tutorial-heading" className="font-display text-2xl font-bold tracking-wide">
              Before the Doors Close
            </h2>
          </div>
          <span className="font-mono-tabular text-xs text-[#9aa39f] uppercase">
            {difficulty === 'practice'
              ? 'Practice Ride'
              : difficulty === 'nightmare'
                ? 'Nightmare Mode'
                : 'Standard Ride'}
          </span>
        </div>

        <ol className="space-y-3 text-sm text-[#cdd4d1] leading-relaxed mb-6">
          <li className="flex gap-3">
            <span className="font-mono-tabular text-[#6cbe45] font-semibold shrink-0">01.</span>
            <span>
              <strong className="text-white font-medium">Notice what changes in Car B.</strong>{' '}
              Aim at posters, the G-line strip map, passengers, parents, or the amber LED sign and
              press <span className="font-mono-tabular text-white">F</span> (or click) to log an
              anomaly. You will not be told if a flag was right or wrong until Court Sq.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono-tabular text-[#f59e0b] font-semibold shrink-0">02.</span>
            <span>
              <strong className="text-white font-medium">Don’t show that you noticed.</strong>{' '}
              Mom and Dad sit on the left bench. Answer their questions calmly, avoid staring too
              long at wrong details, and do not whip your head around when they watch you.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono-tabular text-[#eef0ee] font-semibold shrink-0">03.</span>
            <span>
              <strong className="text-white font-medium">Learn which doors are safe.</strong>{' '}
              Check the <span className="font-mono-tabular text-white">B</span> PA Board strip map.
              Some stops are false and announcements can lie. Take shelter at Myrtle-Willoughby,
              hold still at Greenpoint, and ride to Court Sq.
            </span>
          </li>
        </ol>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onBack();
            }}
            className="px-4 py-2 text-xs font-medium text-[#b5beb9] hover:text-white border border-white/15 rounded transition-colors whitespace-nowrap"
          >
            Back
          </button>
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onContinue();
            }}
            className="px-5 py-2.5 text-sm font-semibold text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap"
          >
            Sit Down at Hoyt-Schermerhorn
          </button>
        </div>
      </div>
    </div>
  );
};
