/**
 * G Train Route Definition — All 13 stops from Hoyt-Schermerhorn to Court Sq.
 * Order is exact and matches the in-car strip map and PA board.
 */

export type StopKind =
  | 'boarding'
  | 'normal'
  | 'false_stop'
  | 'safe_haven'
  | 'restraint'
  | 'forced_bait'
  | 'final';

export interface RouteStop {
  /** 1-based stop number (1..13) */
  number: number;
  /** Zero-based index (0..12) */
  index: number;
  /** Canonical station name displayed on strip map */
  name: string;
  /** Special segment behavior */
  kind: StopKind;
  /** True if the train opens doors at a station not truly on the route */
  isFalseStop: boolean;
  /** False stops can forgive minor reactions (Stop 4: Classon Av) */
  isForgivingFalseStop?: boolean;
  /** Override text shown on the amber in-car LED strip sign */
  ledOverride?: string;
  /** Lying PA announcement played on arrival (Stop 9: Metropolitan Av) */
  lyingPaLine?: string;
  /** Whether the long blackout stretch follows departing this stop (Stop 6) */
  blackoutAfter?: boolean;
  /**
   * TBD: exact dwell seconds per stop.
   * Placeholder playable value marked TBD per specification.
   */
  dwellSeconds: number;
  /** Base cruise duration (seconds) to reach this stop from the previous one */
  cruiseSeconds: number;
  /** Whether Court Sq dot glows brighter on the strip map */
  brighterDot?: boolean;
}

/**
 * TBD: Exact per-stop minimum dwell seconds are not finalized in the brief.
 * Using a clearly marked placeholder constant until final balancing.
 */
export const TBD_DEFAULT_DWELL_SECONDS = 8;

export const ROUTE_STOPS: readonly RouteStop[] = [
  {
    number: 1,
    index: 0,
    name: 'Hoyt-Schermerhorn',
    kind: 'boarding',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 0,
  },
  {
    number: 2,
    index: 1,
    name: 'Fulton St',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 18,
  },
  {
    number: 3,
    index: 2,
    name: 'Clinton-Washington Avs',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 19,
  },
  {
    number: 4,
    index: 3,
    name: 'Classon Av',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: true,
    ledOverride: 'CLASS ON AV',
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 19,
  },
  {
    number: 5,
    index: 4,
    name: 'Bedford-Nostrand Avs',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 20,
  },
  {
    number: 6,
    index: 5,
    name: 'Myrtle-Willoughby Avs',
    kind: 'safe_haven',
    isFalseStop: false,
    blackoutAfter: true,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS + 4, // Extra time to choose Safe Haven
    cruiseSeconds: 20,
  },
  {
    number: 7,
    index: 6,
    name: 'Flushing Av',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 21,
  },
  {
    number: 8,
    index: 7,
    name: 'Broadway',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 19,
  },
  {
    number: 9,
    index: 8,
    name: 'Metropolitan Av',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: false,
    ledOverride: 'COURT SQ — LAST STOP',
    lyingPaLine: 'This is Court Square. Last stop. Everybody off the train.',
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS + 2,
    cruiseSeconds: 20,
  },
  {
    number: 10,
    index: 9,
    name: 'Nassau Av',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 20,
  },
  {
    number: 11,
    index: 10,
    name: 'Greenpoint Av',
    kind: 'restraint',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS + 2,
    cruiseSeconds: 21,
  },
  {
    number: 12,
    index: 11,
    name: '21 St',
    kind: 'forced_bait',
    isFalseStop: false,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 20,
  },
  {
    number: 13,
    index: 12,
    name: 'Court Sq',
    kind: 'final',
    isFalseStop: false,
    brighterDot: true,
    dwellSeconds: TBD_DEFAULT_DWELL_SECONDS,
    cruiseSeconds: 19,
  },
] as const;

/** Practice mode uses a shorter, safer 4-stop slice ending at a safe terminus */
export const PRACTICE_STOP_INDICES = [0, 1, 2, 3] as const;

export function getStopByIndex(index: number): RouteStop {
  const clamped = Math.max(0, Math.min(ROUTE_STOPS.length - 1, index));
  return ROUTE_STOPS[clamped];
}

export function getLedDisplayText(
  stop: RouteStop,
  phase: 'cruising' | 'braking' | 'dwelling' | 'blackout' | 'restraint' | 'arrived',
): string {
  if (phase === 'blackout') {
    return '';
  }
  if (phase === 'dwelling' || phase === 'braking' || phase === 'arrived') {
    if (stop.ledOverride) {
      return stop.ledOverride;
    }
    if (phase === 'dwelling' || phase === 'arrived') {
      return `THIS IS: ${stop.name.toUpperCase()}`;
    }
    return `APPROACHING: ${stop.name.toUpperCase()}`;
  }
  return `NEXT STOP: ${stop.name.toUpperCase()}`;
}
