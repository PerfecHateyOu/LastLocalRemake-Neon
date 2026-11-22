/**
 * Multi-Line NYC Subway Route Definitions — G, L, and 7 Lines (13 Stops Each) + 4 Chapters.
 * Preserves the canonical 13-stop G Train order (Hoyt-Schermerhorn -> Court Sq),
 * calibrated per-stop dwell & cruise timings, Safe Haven, Blackout, Lying PA, Restraint, and Forced Bait.
 */

export type SubwayLineId = 'G' | 'L' | '7';

export type ChapterId = 'full' | 'ch1' | 'ch2' | 'ch3' | 'ch4';

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
  /** Forgiving early false stop (Stop 4: Classon Av / 3 Av / Grand Central) */
  isForgivingFalseStop?: boolean;
  /** Override text shown on the amber in-car LED strip sign */
  ledOverride?: string;
  /** Lying PA announcement played on arrival (Stop 9: Metropolitan Av / Grand St / 33 St-Rawson St) */
  lyingPaLine?: string;
  /** Whether the long blackout stretch follows departing this stop (Stop 6) */
  blackoutAfter?: boolean;
  /** Calibrated dwell duration (seconds) with doors open */
  dwellSeconds: number;
  /** Calibrated cruise duration (seconds) to reach this stop from the previous one */
  cruiseSeconds: number;
  /** Whether terminus dot glows brighter on the strip map */
  brighterDot?: boolean;
}

export interface SubwayLineDefinition {
  id: SubwayLineId;
  name: string;
  subtitle: string;
  color: string;
  accentText: string;
  boardingPa: string;
  finalPa: string;
  terminusName: string;
  safeHavenName: string;
  stops: readonly RouteStop[];
}

export interface ChapterDefinition {
  id: ChapterId;
  code: string;
  title: string;
  summary: string;
  stopIndices: readonly number[];
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: 'full',
    code: 'FULL',
    title: 'Full 13-Stop Ride',
    summary: 'Complete end-to-end ride from boarding to terminus.',
    stopIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: 'ch1',
    code: 'CH I',
    title: 'Chapter I · Departure',
    summary: 'Stops 1–4. Learn the baseline car and face the first false stop.',
    stopIndices: [0, 1, 2, 3],
  },
  {
    id: 'ch2',
    code: 'CH II',
    title: 'Chapter II · The Tunnel',
    summary: 'Stops 5–7. Reach the Safe Haven and survive the blackout stretch.',
    stopIndices: [4, 5, 6],
  },
  {
    id: 'ch3',
    code: 'CH III',
    title: 'Chapter III · The Lie',
    summary: 'Stops 8–10. Hold your seat when the intercom lies about the last stop.',
    stopIndices: [7, 8, 9],
  },
  {
    id: 'ch4',
    code: 'CH IV',
    title: 'Chapter IV · Last Stops',
    summary: 'Stops 11–13. Endure the restraint, ignore the bait, reach the terminus.',
    stopIndices: [10, 11, 12],
  },
] as const;

export const G_LINE_STOPS: readonly RouteStop[] = [
  {
    number: 1,
    index: 0,
    name: 'Hoyt-Schermerhorn',
    kind: 'boarding',
    isFalseStop: false,
    dwellSeconds: 7,
    cruiseSeconds: 0,
  },
  {
    number: 2,
    index: 1,
    name: 'Fulton St',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 17,
  },
  {
    number: 3,
    index: 2,
    name: 'Clinton-Washington Avs',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 18,
  },
  {
    number: 4,
    index: 3,
    name: 'Classon Av',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: true,
    ledOverride: 'CLASS ON AV',
    dwellSeconds: 9,
    cruiseSeconds: 18,
  },
  {
    number: 5,
    index: 4,
    name: 'Bedford-Nostrand Avs',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 19,
  },
  {
    number: 6,
    index: 5,
    name: 'Myrtle-Willoughby Avs',
    kind: 'safe_haven',
    isFalseStop: false,
    blackoutAfter: true,
    dwellSeconds: 12,
    cruiseSeconds: 19,
  },
  {
    number: 7,
    index: 6,
    name: 'Flushing Av',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 20,
  },
  {
    number: 8,
    index: 7,
    name: 'Broadway',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 18,
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
    dwellSeconds: 11,
    cruiseSeconds: 19,
  },
  {
    number: 10,
    index: 9,
    name: 'Nassau Av',
    kind: 'normal',
    isFalseStop: false,
    dwellSeconds: 8,
    cruiseSeconds: 19,
  },
  {
    number: 11,
    index: 10,
    name: 'Greenpoint Av',
    kind: 'restraint',
    isFalseStop: false,
    dwellSeconds: 10,
    cruiseSeconds: 20,
  },
  {
    number: 12,
    index: 11,
    name: '21 St',
    kind: 'forced_bait',
    isFalseStop: false,
    dwellSeconds: 9,
    cruiseSeconds: 19,
  },
  {
    number: 13,
    index: 12,
    name: 'Court Sq',
    kind: 'final',
    isFalseStop: false,
    brighterDot: true,
    dwellSeconds: 8,
    cruiseSeconds: 18,
  },
] as const;

export const L_LINE_STOPS: readonly RouteStop[] = [
  { number: 1, index: 0, name: '8 Av', kind: 'boarding', isFalseStop: false, dwellSeconds: 7, cruiseSeconds: 0 },
  { number: 2, index: 1, name: '6 Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 16 },
  { number: 3, index: 2, name: '14 St-Union Sq', kind: 'normal', isFalseStop: false, dwellSeconds: 9, cruiseSeconds: 17 },
  {
    number: 4,
    index: 3,
    name: '3 Av',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: true,
    ledOverride: 'THIRD A V E',
    dwellSeconds: 9,
    cruiseSeconds: 17,
  },
  { number: 5, index: 4, name: '1 Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 18 },
  {
    number: 6,
    index: 5,
    name: 'Bedford Av',
    kind: 'safe_haven',
    isFalseStop: false,
    blackoutAfter: true,
    dwellSeconds: 12,
    cruiseSeconds: 21,
  },
  { number: 7, index: 6, name: 'Lorimer St', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 18 },
  { number: 8, index: 7, name: 'Graham Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 17 },
  {
    number: 9,
    index: 8,
    name: 'Grand St',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: false,
    ledOverride: 'CANARSIE — LAST STOP',
    lyingPaLine: 'This is Canarsie-Rockaway Pkwy. Last stop. Everybody off the train.',
    dwellSeconds: 11,
    cruiseSeconds: 18,
  },
  { number: 10, index: 9, name: 'Montrose Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 18 },
  { number: 11, index: 10, name: 'Morgan Av', kind: 'restraint', isFalseStop: false, dwellSeconds: 10, cruiseSeconds: 19 },
  { number: 12, index: 11, name: 'Jefferson St', kind: 'forced_bait', isFalseStop: false, dwellSeconds: 9, cruiseSeconds: 18 },
  {
    number: 13,
    index: 12,
    name: 'DeKalb Av',
    kind: 'final',
    isFalseStop: false,
    brighterDot: true,
    dwellSeconds: 8,
    cruiseSeconds: 18,
  },
] as const;

export const SEVEN_LINE_STOPS: readonly RouteStop[] = [
  { number: 1, index: 0, name: '34 St-Hudson Yards', kind: 'boarding', isFalseStop: false, dwellSeconds: 7, cruiseSeconds: 0 },
  { number: 2, index: 1, name: 'Times Sq-42 St', kind: 'normal', isFalseStop: false, dwellSeconds: 9, cruiseSeconds: 17 },
  { number: 3, index: 2, name: '5 Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 16 },
  {
    number: 4,
    index: 3,
    name: 'Grand Central-42 St',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: true,
    ledOverride: 'GRAND CENTR AL',
    dwellSeconds: 9,
    cruiseSeconds: 17,
  },
  { number: 5, index: 4, name: 'Vernon Blvd-Jackson Av', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 20 },
  {
    number: 6,
    index: 5,
    name: 'Hunters Point Av',
    kind: 'safe_haven',
    isFalseStop: false,
    blackoutAfter: true,
    dwellSeconds: 12,
    cruiseSeconds: 18,
  },
  { number: 7, index: 6, name: 'Court Sq', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 18 },
  { number: 8, index: 7, name: 'Queensboro Plaza', kind: 'normal', isFalseStop: false, dwellSeconds: 9, cruiseSeconds: 18 },
  {
    number: 9,
    index: 8,
    name: '33 St-Rawson St',
    kind: 'false_stop',
    isFalseStop: true,
    isForgivingFalseStop: false,
    ledOverride: 'FLUSHING-MAIN ST — LAST STOP',
    lyingPaLine: 'This is Flushing-Main St. Last stop. Everybody off the train.',
    dwellSeconds: 11,
    cruiseSeconds: 19,
  },
  { number: 10, index: 9, name: '40 St-Lowery St', kind: 'normal', isFalseStop: false, dwellSeconds: 8, cruiseSeconds: 18 },
  { number: 11, index: 10, name: '46 St-Bliss St', kind: 'restraint', isFalseStop: false, dwellSeconds: 10, cruiseSeconds: 19 },
  { number: 12, index: 11, name: '52 St', kind: 'forced_bait', isFalseStop: false, dwellSeconds: 9, cruiseSeconds: 18 },
  {
    number: 13,
    index: 12,
    name: 'Flushing-Main St',
    kind: 'final',
    isFalseStop: false,
    brighterDot: true,
    dwellSeconds: 8,
    cruiseSeconds: 19,
  },
] as const;

export const SUBWAY_LINES: Record<SubwayLineId, SubwayLineDefinition> = {
  G: {
    id: 'G',
    name: 'G Train',
    subtitle: 'BROOKLYN — QUEENS CROSSTOWN LOCAL',
    color: '#6cbe45',
    accentText: '#86efac',
    boardingPa: 'This is a Court Square-bound G local train. Next stop: Fulton St.',
    finalPa: 'This is Court Square. Last stop. Thank you for riding the G train.',
    terminusName: 'Court Sq',
    safeHavenName: 'Myrtle-Willoughby Avs',
    stops: G_LINE_STOPS,
  },
  L: {
    id: 'L',
    name: 'L Train',
    subtitle: '14TH STREET — CANARSIE LOCAL',
    color: '#8e9296',
    accentText: '#d4d8dc',
    boardingPa: 'This is a Brooklyn-bound L local train. Next stop: 6 Av.',
    finalPa: 'This is DeKalb Av. Last stop for this train. Thank you for riding the L.',
    terminusName: 'DeKalb Av',
    safeHavenName: 'Bedford Av',
    stops: L_LINE_STOPS,
  },
  '7': {
    id: '7',
    name: '7 Train',
    subtitle: 'FLUSHING LOCAL',
    color: '#b933ad',
    accentText: '#f0abfc',
    boardingPa: 'This is a Flushing-bound 7 local train. Next stop: Times Sq-42 St.',
    finalPa: 'This is Flushing-Main St. Last stop. Thank you for riding the 7 train.',
    terminusName: 'Flushing-Main St',
    safeHavenName: 'Hunters Point Av',
    stops: SEVEN_LINE_STOPS,
  },
};

/** Canonical G train stops export (preserves direct compatibility) */
export const ROUTE_STOPS: readonly RouteStop[] = G_LINE_STOPS;

/** Practice mode uses a shorter, safer 4-stop slice */
export const PRACTICE_STOP_INDICES = [0, 1, 2, 3] as const;

export function getLineDefinition(lineId: SubwayLineId = 'G'): SubwayLineDefinition {
  return SUBWAY_LINES[lineId] ?? SUBWAY_LINES.G;
}

export function getStopsForLine(lineId: SubwayLineId = 'G'): readonly RouteStop[] {
  return getLineDefinition(lineId).stops;
}

export function getStopByIndex(index: number, lineId: SubwayLineId = 'G'): RouteStop {
  const stops = getStopsForLine(lineId);
  const clamped = Math.max(0, Math.min(stops.length - 1, index));
  return stops[clamped];
}

export function getChapterDefinition(chapterId: ChapterId = 'full'): ChapterDefinition {
  return CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
}

export function getLedDisplayText(
  stop: RouteStop,
  phase: 'cruising' | 'braking' | 'dwelling' | 'blackout' | 'restraint' | 'trial' | 'arrived',
): string {
  if (phase === 'blackout') {
    return '';
  }
  if (phase === 'trial') {
    return stop.ledOverride ?? 'DOOR OBSTRUCTION — DO NOT BOARD';
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
