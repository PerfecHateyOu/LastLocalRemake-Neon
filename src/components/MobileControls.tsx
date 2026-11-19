/**
 * Mobile Touch Controls — Virtual move stick (bottom-left) + touch look drag zone (right side)
 * + quick Flag button. Visible on touch/small viewports so mobile play works cleanly.
 */

import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  onMoveStick: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFlag: () => void;
  canFlag: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMoveStick,
  onLookDelta,
  onFlag,
  canFlag,
}) => {
  const stickOrigin = useRef<{ x: number; y: number } | null>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const maxRadius = 32;

  const handleStickStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    stickOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleStickMove = (e: React.TouchEvent) => {
    const origin = stickOrigin.current;
    const t = e.changedTouches[0];
    if (!origin || !t) return;
    const dx = t.clientX - origin.x;
    const dy = t.clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: kx, y: ky });
    onMoveStick(kx / maxRadius, -ky / maxRadius);
  };

  const handleStickEnd = () => {
    stickOrigin.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMoveStick(0, 0);
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    lookLast.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    const prev = lookLast.current;
    const t = e.changedTouches[0];
    if (!prev || !t) return;
    onLookDelta(t.clientX - prev.x, t.clientY - prev.y);
    lookLast.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookEnd = () => {
    lookLast.current = null;
  };

  return (
    <div className="fixed inset-0 z-15 pointer-events-none md:hidden">
      {/* Right half touch-look drag surface */}
      <div
        className="absolute right-0 top-20 bottom-24 w-1/2 pointer-events-auto touch-none"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        aria-label="Touch drag area to look around"
      />

      {/* Bottom-left virtual move stick */}
      <div
        className="absolute left-4 bottom-5 w-24 h-24 rounded-full bg-[#0c0e10]/70 border border-white/20 pointer-events-auto touch-none flex items-center justify-center"
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        aria-label="Virtual movement joystick"
      >
        <div
          className="w-10 h-10 rounded-full bg-[#eef0ee]/80"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Bottom-right mobile Flag button */}
      <button
        type="button"
        disabled={!canFlag}
        onClick={(e) => {
          e.currentTarget.blur();
          onFlag();
        }}
        className={`absolute right-4 bottom-6 pointer-events-auto px-4 py-3 text-xs font-semibold rounded border whitespace-nowrap ${
          canFlag
            ? 'bg-[#eef0ee] text-[#0b0d0e] border-white'
            : 'bg-[#121517]/80 text-[#7d8682] border-white/15'
        }`}
      >
        Log Change
      </button>
    </div>
  );
};
