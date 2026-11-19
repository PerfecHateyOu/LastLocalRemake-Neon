/**
 * [C] Polaroid Camera Viewfinder Overlay — Captures live WebGL frames into the Polaroid album.
 */

import React, { useState } from 'react';

interface PolaroidViewfinderProps {
  photoCount: number;
  onCapture: () => void;
  onClose: () => void;
}

export const PolaroidViewfinder: React.FC<PolaroidViewfinderProps> = ({
  photoCount,
  onCapture,
  onClose,
}) => {
  const [flashing, setFlashing] = useState(false);

  const handleSnap = () => {
    setFlashing(true);
    onCapture();
    window.setTimeout(() => setFlashing(false), 300);
  };

  return (
    <div
      className="fixed inset-0 z-25 pointer-events-none flex flex-col items-center justify-between p-6"
      data-testid="polaroid-viewfinder"
    >
      {flashing && <div className="fixed inset-0 bg-white ll-shutter-flash pointer-events-none" />}

      {/* Viewfinder corner crop marks */}
      <div className="fixed inset-8 sm:inset-14 pointer-events-none">
        <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/75" />
        <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/75" />
        <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/75" />
        <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/75" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border border-white/45 rounded-full" />
      </div>

      {/* Top Viewfinder Label */}
      <div className="mt-14 bg-[#0b0d0f]/90 border border-white/15 rounded px-3 py-1 text-xs font-mono-tabular text-[#e8ecea]">
        INSTANT 600 VIEWFINDER · SHOTS SAVED: {photoCount}
      </div>

      {/* Bottom Shutter Bar */}
      <div className="pointer-events-auto flex items-center gap-3 bg-[#0c0e10]/92 border border-white/15 rounded px-4 py-2.5 mb-2">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleSnap();
          }}
          className="px-4 py-2 text-xs font-semibold text-[#0b0d0e] bg-[#eef0ee] hover:bg-white rounded transition-colors whitespace-nowrap"
        >
          Take Polaroid [Space]
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          className="px-3 py-2 text-xs font-medium text-[#cfd6d3] hover:text-white border border-white/15 rounded transition-colors whitespace-nowrap"
        >
          Put Away [C]
        </button>
      </div>
    </div>
  );
};
