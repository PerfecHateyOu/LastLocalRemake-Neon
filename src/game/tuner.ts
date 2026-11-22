/**
 * Transit-Band Radio / PA Frequency Tuner — Last Local
 * Lets players scan 88.0–108.0 MHz for hidden NYC Transit Control, Maintenance,
 * and Dead-Air carrier transmissions tied to each line & stop range.
 *
 * CRITICAL RULE: Tuner channels NEVER reveal whether a visual anomaly is currently
 * active inside Car B — they provide lore, atmosphere, and Archivist evidence.
 */

import { SubwayLineId } from './route';

export interface TunerChannel {
  id: string;
  frequencyMhz: number;
  label: string;
  lineScope: SubwayLineId | 'ALL';
  minStop: number;
  maxStop: number;
  transcript: string;
}

export interface TunerSignalLog {
  id: string;
  channelId: string;
  frequencyMhz: number;
  label: string;
  transcript: string;
  stopNumber: number;
  stopName: string;
  lineId: SubwayLineId;
  timestampSec: number;
}

export const TUNER_MIN_MHZ = 88.0;
export const TUNER_MAX_MHZ = 108.0;

export const TUNER_CHANNELS: readonly TunerChannel[] = [
  {
    id: 'ch_dispatch_g',
    frequencyMhz: 89.3,
    label: 'IND Crosstown Dispatch',
    lineScope: 'G',
    minStop: 1,
    maxStop: 13,
    transcript: '“Car B, maintain headway. Do not hold doors at unscheduled platforms.”',
  },
  {
    id: 'ch_dispatch_l',
    frequencyMhz: 91.7,
    label: 'BMT Canarsie Control',
    lineScope: 'L',
    minStop: 1,
    maxStop: 13,
    transcript: '“East River tube power fluctuates past First Av. Keep passengers seated.”',
  },
  {
    id: 'ch_dispatch_7',
    frequencyMhz: 93.5,
    label: 'IRT Flushing Tower',
    lineScope: '7',
    minStop: 1,
    maxStop: 13,
    transcript: '“Steinway tube signal amber. Disregard duplicate terminal announcements.”',
  },
  {
    id: 'ch_maintenance',
    frequencyMhz: 96.1,
    label: 'Track Maintenance Loop',
    lineScope: 'ALL',
    minStop: 1,
    maxStop: 6,
    transcript: '“Replaced ballast tube four in Car B. Still flickers mid-tunnel only.”',
  },
  {
    id: 'ch_haven_beacon',
    frequencyMhz: 99.4,
    label: 'Stop 6 Alcove Carrier',
    lineScope: 'ALL',
    minStop: 4,
    maxStop: 8,
    transcript: '“Safe alcove lights verified at Stop 6. Stay under the canopy before the dark stretch.”',
  },
  {
    id: 'ch_phantom_pa',
    frequencyMhz: 102.8,
    label: 'Intercom Bleed Carrier',
    lineScope: 'ALL',
    minStop: 7,
    maxStop: 11,
    transcript: '“Automated last-stop tape is looping four stops early. Check the strip map, not the speaker.”',
  },
  {
    id: 'ch_numbers_deadair',
    frequencyMhz: 106.5,
    label: 'Unmarked Dead-Air Carrier',
    lineScope: 'ALL',
    minStop: 9,
    maxStop: 13,
    transcript: '“...eleven... twelve... thirteen. Keep your shoulders still until the chime.”',
  },
] as const;

export function clampFrequency(freq: number): number {
  const rounded = Math.round(freq * 10) / 10;
  return Math.max(TUNER_MIN_MHZ, Math.min(TUNER_MAX_MHZ, rounded));
}

export function getActiveChannelsForContext(
  lineId: SubwayLineId,
  stopNumber: number,
): TunerChannel[] {
  return TUNER_CHANNELS.filter(
    (ch) =>
      (ch.lineScope === 'ALL' || ch.lineScope === lineId) &&
      stopNumber >= ch.minStop &&
      stopNumber <= ch.maxStop,
  );
}

/**
 * Returns signal strength (0..1) and nearest matching channel for the current frequency.
 * Locks cleanly within +/- 0.2 MHz of a broadcast carrier.
 */
export function evaluateTunerSignal(
  frequencyMhz: number,
  lineId: SubwayLineId,
  stopNumber: number,
): {
  strength: number;
  lockedChannel: TunerChannel | null;
  nearestDistanceMhz: number;
} {
  const active = getActiveChannelsForContext(lineId, stopNumber);
  if (active.length === 0) {
    return { strength: 0.05, lockedChannel: null, nearestDistanceMhz: 99 };
  }

  let bestChannel: TunerChannel | null = null;
  let bestDist = Infinity;

  for (const ch of active) {
    const dist = Math.abs(frequencyMhz - ch.frequencyMhz);
    if (dist < bestDist) {
      bestDist = dist;
      bestChannel = ch;
    }
  }

  // Smooth bell curve peaking at 1.0 when distance = 0, decaying over 1.2 MHz
  const normalized = Math.max(0, 1 - bestDist / 1.2);
  const strength = Math.max(0.06, Math.min(1, Number((normalized * normalized).toFixed(3))));
  const lockedChannel = bestChannel && bestDist <= 0.21 ? bestChannel : null;

  return {
    strength,
    lockedChannel,
    nearestDistanceMhz: Number(bestDist.toFixed(2)),
  };
}
