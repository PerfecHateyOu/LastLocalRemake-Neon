/**
 * Anomaly Registry & Manager
 * Structured so additional anomalies can be registered without rewriting the manager.
 *
 * TBD: Full anomaly catalog expansion — currently implements core catalog:
 *   - poster_changed
 *   - map_stop_moved
 *   - extra_passenger
 *   - parent_face_frozen
 *   - car_goes_empty
 *   - parent_unasked_answer
 *   - door_sign_wrong (tied to false stops)
 */

export type AnomalyTargetId =
  | 'poster_left'
  | 'poster_right'
  | 'route_map'
  | 'extra_seat'
  | 'mom_face'
  | 'dad_face'
  | 'car_passengers'
  | 'led_sign'
  | 'umbrella_seat';

export type AnomalyId =
  | 'poster_changed'
  | 'map_stop_moved'
  | 'extra_passenger'
  | 'parent_face_frozen'
  | 'car_goes_empty'
  | 'parent_unasked_answer'
  | 'false_stop_sign';

export interface AnomalyDefinition {
  id: AnomalyId;
  label: string;
  targetId: AnomalyTargetId;
  isCritical: boolean;
  /** Minimum stop number (1..13) where this anomaly may appear */
  minStop: number;
  /** Human-readable note stored only in internal evaluation / end report */
  reportDescription: string;
}

export interface ActiveAnomaly {
  definition: AnomalyDefinition;
  stopNumber: number;
  spawnedAtSec: number;
  flaggedByPlayer: boolean;
}

export interface FlagLogEntry {
  id: string;
  stopNumber: number;
  stopName: string;
  targetId: AnomalyTargetId;
  targetLabel: string;
  timestampSec: number;
  note: string;
  /**
   * Internal correctness — NEVER displayed to the player during the ride.
   * Only summarized in the Court Sq Travel Report.
   */
  _wasTrueAnomaly: boolean;
}

/**
 * Extensible anomaly catalog.
 * Add new AnomalyDefinition entries here and handle their visual hook in the 3D scene.
 * TBD: Additional catalog variants to be added in future content passes.
 */
export const ANOMALY_CATALOG: Record<AnomalyId, AnomalyDefinition> = {
  poster_changed: {
    id: 'poster_changed',
    label: 'Wall Poster',
    targetId: 'poster_right',
    isCritical: false,
    minStop: 2,
    reportDescription: 'The framed subway advertisement silently altered its text and silhouette.',
  },
  map_stop_moved: {
    id: 'map_stop_moved',
    label: 'G Line Strip Map',
    targetId: 'route_map',
    isCritical: false,
    minStop: 3,
    reportDescription: 'A station dot on the green G line strip map shifted out of order.',
  },
  extra_passenger: {
    id: 'extra_passenger',
    label: 'Far Bench Passenger',
    targetId: 'extra_seat',
    isCritical: true,
    minStop: 4,
    reportDescription: 'An extra passenger sat down where the umbrella seat had been empty.',
  },
  parent_face_frozen: {
    id: 'parent_face_frozen',
    label: 'Parent Expression',
    targetId: 'mom_face',
    isCritical: true,
    minStop: 5,
    reportDescription: 'Mom remained completely motionless with a fixed, unblinking expression.',
  },
  car_goes_empty: {
    id: 'car_goes_empty',
    label: 'Empty Car Seats',
    targetId: 'car_passengers',
    isCritical: true,
    minStop: 7,
    reportDescription: 'All four distant passengers vanished between stops without the doors opening.',
  },
  parent_unasked_answer: {
    id: 'parent_unasked_answer',
    label: 'Dad (Unprompted Reply)',
    targetId: 'dad_face',
    isCritical: false,
    minStop: 8,
    reportDescription: 'Dad answered a question nobody in the car had spoken aloud.',
  },
  false_stop_sign: {
    id: 'false_stop_sign',
    label: 'LED Station Sign',
    targetId: 'led_sign',
    isCritical: true,
    minStop: 4,
    reportDescription: 'The overhead LED strip displayed an impossible or falsified station name.',
  },
};

export const INSPECTABLE_TARGETS: Record<AnomalyTargetId, string> = {
  poster_left: 'Left Subway Ad Frame',
  poster_right: 'Right Subway Ad Frame',
  route_map: 'G Line Strip Route Map',
  extra_seat: 'Far Bench Seat',
  mom_face: 'Mom (Left Bench)',
  dad_face: 'Dad (Left Bench)',
  car_passengers: 'Down-Car Passengers',
  led_sign: 'Overhead LED Sign',
  umbrella_seat: 'Seat with Black Umbrella',
};

/**
 * Schedule 1 or 2 anomalies for a given stop segment.
 * Stop 1 (boarding) has 0 anomalies so the player learns baseline normality.
 * Stop 4 (Classon Av) & Stop 9 (Metropolitan Av) include the false_stop_sign anomaly.
 * Stop 12 (21 St) always forces a critical anomaly presented as bait under a flickering tube.
 */
export function selectAnomaliesForStop(
  stopNumber: number,
  elapsedSec: number,
  practiceMode: boolean,
  rng: () => number = Math.random,
): ActiveAnomaly[] {
  if (stopNumber <= 1 || stopNumber === 13) {
    return [];
  }

  const makeActive = (id: AnomalyId): ActiveAnomaly => ({
    definition: ANOMALY_CATALOG[id],
    stopNumber,
    spawnedAtSec: elapsedSec,
    flaggedByPlayer: false,
  });

  if (practiceMode) {
    if (stopNumber === 2) return [makeActive('poster_changed')];
    if (stopNumber === 3) return [makeActive('map_stop_moved')];
    if (stopNumber === 4) return [makeActive('false_stop_sign')];
    return [];
  }

  if (stopNumber === 4) {
    return [makeActive('false_stop_sign'), makeActive('poster_changed')];
  }

  if (stopNumber === 6) {
    // Safe Haven stop — quiet, subtle single anomaly
    return [makeActive('map_stop_moved')];
  }

  if (stopNumber === 9) {
    return [makeActive('false_stop_sign'), makeActive('parent_unasked_answer')];
  }

  if (stopNumber === 11) {
    return [makeActive('parent_face_frozen')];
  }

  if (stopNumber === 12) {
    // Forced critical anomaly presented as bait with a flickering light
    return [makeActive('extra_passenger'), makeActive('car_goes_empty')];
  }

  // Standard segments pick 1–2 eligible anomalies from the catalog
  const pool = Object.values(ANOMALY_CATALOG).filter(
    (def) => def.id !== 'false_stop_sign' && def.minStop <= stopNumber,
  );
  if (pool.length === 0) return [];

  const shuffled = [...pool].sort(() => rng() - 0.5);
  const count = stopNumber >= 7 && rng() > 0.45 ? 2 : 1;
  const chosen: ActiveAnomaly[] = [];
  const usedTargets = new Set<AnomalyTargetId>();

  for (const def of shuffled) {
    if (usedTargets.has(def.targetId)) continue;
    // Prevent conflicting car_goes_empty and extra_passenger on regular stops
    if (
      def.id === 'car_goes_empty' &&
      chosen.some((a) => a.definition.id === 'extra_passenger')
    ) {
      continue;
    }
    usedTargets.add(def.targetId);
    chosen.push(makeActive(def.id));
    if (chosen.length >= count) break;
  }

  return chosen;
}

/**
 * Evaluates a player flag silently.
 * Returns whether it matched an active unflagged anomaly so server/state logic can score suspicion,
 * while never surfacing correctness to the player UI.
 */
export function evaluatePlayerFlag(
  activeAnomalies: ActiveAnomaly[],
  targetId: AnomalyTargetId,
): {
  matched: boolean;
  updatedAnomalies: ActiveAnomaly[];
  matchedAnomaly: ActiveAnomaly | null;
} {
  let matchedAnomaly: ActiveAnomaly | null = null;
  const updatedAnomalies = activeAnomalies.map((a) => {
    if (!matchedAnomaly && a.definition.targetId === targetId && !a.flaggedByPlayer) {
      matchedAnomaly = { ...a, flaggedByPlayer: true };
      return matchedAnomaly;
    }
    return a;
  });

  // Also treat already-flagged anomaly target as non-penalty duplicate
  const alreadyFlagged =
    !matchedAnomaly &&
    activeAnomalies.some((a) => a.definition.targetId === targetId && a.flaggedByPlayer);

  return {
    matched: Boolean(matchedAnomaly) || alreadyFlagged,
    updatedAnomalies,
    matchedAnomaly,
  };
}
