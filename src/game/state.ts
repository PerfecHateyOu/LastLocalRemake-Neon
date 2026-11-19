/**
 * Core Game State Machine — Last Local
 * Coordinates the 13-stop G Train ride, Suspicion, Sanity, Anomalies, Parents,
 * Blackout, Safe Haven, Restraint, Polaroids, EVP Tape Recorder, Practice/Nightmare modes,
 * Achievements, and Court Sq Ending Report.
 */

import {
  ActiveAnomaly,
  AnomalyTargetId,
  evaluatePlayerFlag,
  FlagLogEntry,
  INSPECTABLE_TARGETS,
  selectAnomaliesForStop,
} from './anomalies';
import {
  BACKGROUND_PA_ANNOUNCEMENTS,
  MASK_QUESTIONS,
  MaskQuestion,
  PARENT_EXCHANGES,
  shuffleMaskOptions,
} from './dialogue';
import { getLedDisplayText, getStopByIndex, PRACTICE_STOP_INDICES, ROUTE_STOPS, RouteStop } from './route';
import {
  advanceSanityForStop,
  applySanityPenalty,
  createInitialSanity,
  getHeartbeatProfile,
  SanityState,
  tickSanityEffects,
  triggerSanityGlitch,
} from './sanity';
import {
  applySuspicionChange,
  createInitialSuspicion,
  getParentWatchProfile,
  getSuspicionBand,
  SuspicionBand,
  SuspicionState,
} from './suspicion';

export type ScreenMode = 'title' | 'tutorial' | 'playing' | 'paused' | 'ending';
export type RideDifficulty = 'standard' | 'practice' | 'nightmare';
export type RidePhase =
  | 'cruising'
  | 'braking'
  | 'dwelling'
  | 'blackout'
  | 'restraint'
  | 'arrived';

export interface PaFeedEntry {
  id: string;
  stopNumber: number;
  text: string;
  timestampSec: number;
}

export interface PolaroidPhoto {
  id: string;
  stopNumber: number;
  stopName: string;
  dataUrl: string;
  timestampSec: number;
  caption: string;
}

export interface EvpRecording {
  id: string;
  stopNumber: number;
  stopName: string;
  durationSec: number;
  timestampSec: number;
  transcriptHint: string;
  hasAnomalyResonance: boolean;
}

export interface ActiveSubtitle {
  speaker: 'Mom' | 'Dad';
  text: string;
  remainingSec: number;
}

export interface ActiveMaskPrompt {
  question: MaskQuestion;
  remainingSec: number;
  totalSec: number;
}

export interface GameSettings {
  volume: number;
  muted: boolean;
  sensitivity: number;
  reducedGlitch: boolean;
}

export interface EndingReportData {
  /**
   * TBD: Exact ending variants and scoring thresholds are marked TBD in the brief.
   * Placeholder variants evaluate suspicion, sanity, flags, haven, and restraint choices.
   */
  endingId: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: RideDifficulty;
  finalSuspicion: number;
  finalSuspicionBand: SuspicionBand;
  peakSuspicion: number;
  finalSanity: number;
  finalSanityTier: string;
  stopsCompleted: number;
  totalStops: number;
  trueFlags: number;
  falsePositives: number;
  totalFlags: number;
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  falseStopDisembarks: number;
  photosTaken: number;
  evpClipsRecorded: number;
  durationSec: number;
  unlockedAchievements: string[];
  nightmareJustUnlocked: boolean;
}

export interface GameState {
  screen: ScreenMode;
  difficulty: RideDifficulty;
  /** Index into active stop sequence */
  sequencePos: number;
  /** Canonical stop index (0..12) */
  stopIndex: number;
  phase: RidePhase;
  phaseTimer: number;
  phaseDuration: number;
  /** Normalized train speed 0..1.3 */
  trainSpeed: number;
  /** Door openness 0..1 */
  doorOpen: number;
  /** Total elapsed ride seconds (freezes when paused) */
  elapsedSec: number;

  suspicion: SuspicionState;
  sanity: SanityState;
  activeAnomalies: ActiveAnomaly[];
  flagLog: FlagLogEntry[];
  paFeed: PaFeedEntry[];
  photos: PolaroidPhoto[];
  evpClips: EvpRecording[];

  /** Active dialogue & prompts */
  subtitle: ActiveSubtitle | null;
  pendingSubtitleQueue: Array<{ speaker: 'Mom' | 'Dad'; text: string; durationSec: number }>;
  dialogueCooldown: number;
  maskPrompt: ActiveMaskPrompt | null;
  maskCooldown: number;
  paCooldown: number;

  /** Parent gaze & stare state */
  parentWatching: 'none' | 'mom' | 'dad';
  parentWatchTimer: number;
  parentGlanceCooldown: number;
  stareAccumulator: number;
  reactionCooldown: number;

  /** Single fluorescent tube flicker state (-1 = none, 0..5 = tube index) */
  flickeringTubeIndex: number;
  flickerTimer: number;
  flickerCooldown: number;

  /** Special segment tracking */
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  safeHavenPromptOpen: boolean;
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  restraintHolding: boolean;
  restraintProgress: number; // 0..1
  restraintSlips: number;
  falseStopDisembarks: number;
  hadMistakeThisStop: boolean;
  stopAnnouncementPlayed: boolean;

  /** Active tool overlays */
  activePanel: 'none' | 'pa_board' | 'evidence' | 'polaroid' | 'evp';
  evpRecordingActive: boolean;
  evpRecordElapsed: number;

  /** Transient neutral feedback banner (never reveals if a flag was right/wrong) */
  neutralNotice: string | null;
  neutralNoticeTimer: number;

  /** Completed ride report */
  endingReport: EndingReportData | null;
}

const STORAGE_KEY_NIGHTMARE = 'last_local_nightmare_unlocked_v1';
const STORAGE_KEY_ACHIEVEMENTS = 'last_local_achievements_v1';

export function isNightmareUnlocked(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY_NIGHTMARE) === '1';
  } catch {
    return false;
  }
}

export function saveNightmareUnlocked(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_NIGHTMARE, '1');
    }
  } catch {
    // Ignore storage failures
  }
}

export function loadSavedAchievements(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveAchievements(list: string[]): void {
  try {
    if (typeof window !== 'undefined') {
      const merged = Array.from(new Set([...loadSavedAchievements(), ...list]));
      window.localStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify(merged));
    }
  } catch {
    // Ignore storage failures
  }
}

export function getSequenceForDifficulty(difficulty: RideDifficulty): readonly number[] {
  if (difficulty === 'practice') {
    return PRACTICE_STOP_INDICES;
  }
  return ROUTE_STOPS.map((s) => s.index);
}

export function getCurrentStop(state: GameState): RouteStop {
  return getStopByIndex(state.stopIndex);
}

export function createInitialGameState(
  difficulty: RideDifficulty = 'standard',
  screen: ScreenMode = 'title',
): GameState {
  const firstStop = getStopByIndex(0);
  return {
    screen,
    difficulty,
    sequencePos: 0,
    stopIndex: 0,
    phase: 'dwelling',
    phaseTimer: firstStop.dwellSeconds,
    phaseDuration: firstStop.dwellSeconds,
    trainSpeed: 0,
    doorOpen: 1,
    elapsedSec: 0,

    suspicion: createInitialSuspicion(),
    sanity: createInitialSanity(),
    activeAnomalies: [],
    flagLog: [],
    paFeed: [
      {
        id: 'pa-boarding',
        stopNumber: 1,
        text: 'This is a Court Square-bound G local train. Next stop: Fulton St.',
        timestampSec: 0,
      },
    ],
    photos: [],
    evpClips: [],

    subtitle: {
      speaker: 'Mom',
      text: 'Sit still, sweetheart. Thirteen stops and we’re home.',
      remainingSec: 4.5,
    },
    pendingSubtitleQueue: [],
    dialogueCooldown: 9,
    maskPrompt: null,
    maskCooldown: 24,
    paCooldown: 14,

    parentWatching: 'none',
    parentWatchTimer: 0,
    parentGlanceCooldown: 10,
    stareAccumulator: 0,
    reactionCooldown: 0,

    flickeringTubeIndex: -1,
    flickerTimer: 0,
    flickerCooldown: 12,

    safeHavenChoice: 'not_reached',
    safeHavenPromptOpen: false,
    restraintOutcome: 'not_reached',
    restraintHolding: false,
    restraintProgress: 0,
    restraintSlips: 0,
    falseStopDisembarks: 0,
    hadMistakeThisStop: false,
    stopAnnouncementPlayed: true,

    activePanel: 'none',
    evpRecordingActive: false,
    evpRecordElapsed: 0,

    neutralNotice: null,
    neutralNoticeTimer: 0,

    endingReport: null,
  };
}

export interface StepCallbacks {
  onDoorChime?: () => void;
  onDoorSlide?: (opening: boolean) => void;
  onPaDing?: () => void;
}

/**
 * Advances the simulation by dt seconds (strictly skipped when paused or not playing).
 */
export function stepGameState(
  state: GameState,
  dt: number,
  options: {
    lookingAtAnomalyTarget: AnomalyTargetId | null;
    angularSpeedRadPerSec: number;
    restraintMoved: boolean;
    callbacks?: StepCallbacks;
    rng?: () => number;
  },
): GameState {
  if (state.screen !== 'playing' || dt <= 0) {
    return state;
  }

  const rng = options.rng ?? Math.random;
  const clampedDt = Math.min(dt, 0.05);
  const nightmare = state.difficulty === 'nightmare';
  const practice = state.difficulty === 'practice';
  const stop = getCurrentStop(state);

  const next: GameState = {
    ...state,
    elapsedSec: state.elapsedSec + clampedDt,
    sanity: tickSanityEffects(state.sanity, clampedDt, rng),
  };

  // Neutral toast timer
  if (next.neutralNoticeTimer > 0) {
    next.neutralNoticeTimer = Math.max(0, next.neutralNoticeTimer - clampedDt);
    if (next.neutralNoticeTimer === 0) {
      next.neutralNotice = null;
    }
  }

  // Active EVP recording timer
  if (next.evpRecordingActive) {
    next.evpRecordElapsed += clampedDt;
    if (next.evpRecordElapsed >= 4.0) {
      return finishEvpRecording(next);
    }
  }

  // Subtitle queue progression
  if (next.subtitle) {
    const rem = next.subtitle.remainingSec - clampedDt;
    if (rem <= 0) {
      if (next.pendingSubtitleQueue.length > 0) {
        const [head, ...rest] = next.pendingSubtitleQueue;
        next.subtitle = {
          speaker: head.speaker,
          text: head.text,
          remainingSec: head.durationSec,
        };
        next.pendingSubtitleQueue = rest;
      } else {
        next.subtitle = null;
      }
    } else {
      next.subtitle = { ...next.subtitle, remainingSec: rem };
    }
  }

  // Active Mask Question countdown
  if (next.maskPrompt) {
    const rem = next.maskPrompt.remainingSec - clampedDt;
    if (rem <= 0) {
      // Prompt timed out: +8 suspicion
      next.maskPrompt = null;
      next.hadMistakeThisStop = true;
      next.suspicion = applySuspicionChange(next.suspicion, 'prompt_timeout', stop.number, practice);
      next.subtitle = {
        speaker: 'Dad',
        text: '...You didn’t answer your mother.',
        remainingSec: 3.4,
      };
    } else {
      next.maskPrompt = { ...next.maskPrompt, remainingSec: rem };
    }
  }

  // Parent gaze & stare / head-snap reaction monitoring (disabled in blackout)
  if (next.phase !== 'blackout') {
    const watchProfile = getParentWatchProfile(next.suspicion.value, nightmare);
    next.reactionCooldown = Math.max(0, next.reactionCooldown - clampedDt);

    if (next.parentWatching !== 'none') {
      next.parentWatchTimer -= clampedDt;
      if (next.parentWatchTimer <= 0) {
        next.parentWatching = 'none';
        next.parentGlanceCooldown = watchProfile.glanceIntervalSec * (0.75 + rng() * 0.5);
      }
    } else {
      next.parentGlanceCooldown -= clampedDt;
      if (next.parentGlanceCooldown <= 0 && next.stopIndex >= 1) {
        next.parentWatching = rng() < 0.58 ? 'dad' : 'mom';
        next.parentWatchTimer = watchProfile.holdLookSec;
      }
    }

    // Check if player stares too long at an active anomaly or snaps head too fast while watched
    const isStaringAtActiveAnomaly =
      options.lookingAtAnomalyTarget !== null &&
      next.activeAnomalies.some((a) => a.definition.targetId === options.lookingAtAnomalyTarget);

    if (isStaringAtActiveAnomaly) {
      next.stareAccumulator += clampedDt;
    } else {
      next.stareAccumulator = Math.max(0, next.stareAccumulator - clampedDt * 1.4);
    }

    const snappedHead =
      options.angularSpeedRadPerSec > watchProfile.headSnapRadPerSec && next.stopIndex >= 1;
    const staredTooLong = next.stareAccumulator > watchProfile.stareToleranceSec;

    if ((staredTooLong || (snappedHead && next.parentWatching !== 'none')) && next.reactionCooldown <= 0) {
      next.stareAccumulator = 0;
      next.reactionCooldown = 7.0;
      next.hadMistakeThisStop = true;
      next.parentWatching = 'dad';
      next.parentWatchTimer = Math.max(next.parentWatchTimer, watchProfile.holdLookSec);

      // Stop 4 Classon Av is forgiving
      const reason = stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'visible_reaction';
      next.suspicion = applySuspicionChange(next.suspicion, reason, stop.number, practice);
      next.subtitle = {
        speaker: 'Dad',
        text: snappedHead ? 'Easy. Keep your head straight.' : 'Quit staring. Look forward.',
        remainingSec: 3.0,
      };
    }
  }

  // Single fluorescent tube flicker mid-ride (never on braking/approach, never whole car at once)
  if (next.phase === 'blackout') {
    next.flickeringTubeIndex = 2; // Single dim tube flickering during blackout
    next.flickerTimer = 1;
  } else if (stop.kind === 'forced_bait' && (next.phase === 'cruising' || next.phase === 'dwelling')) {
    next.flickeringTubeIndex = 4; // Bait flickering light at Stop 12 (21 St)
    next.flickerTimer = 1;
  } else if (next.phase === 'cruising') {
    if (next.flickerTimer > 0) {
      next.flickerTimer = Math.max(0, next.flickerTimer - clampedDt);
      if (next.flickerTimer === 0) {
        next.flickeringTubeIndex = -1;
        next.flickerCooldown = 8 + rng() * 11;
      }
    } else {
      next.flickerCooldown -= clampedDt;
      if (next.flickerCooldown <= 0) {
        next.flickeringTubeIndex = Math.floor(rng() * 6);
        next.flickerTimer = 1.6 + rng() * 2.2;
      }
    }
  } else {
    // Never flicker on station approach (braking) or normal dwell
    next.flickeringTubeIndex = -1;
    next.flickerTimer = 0;
  }

  // Ambient parent exchanges, mask prompts, and random PA announcements while cruising
  if (next.phase === 'cruising' && next.stopIndex >= 1) {
    next.dialogueCooldown -= clampedDt;
    if (next.dialogueCooldown <= 0 && !next.subtitle && !next.maskPrompt) {
      const hasUnasked = next.activeAnomalies.some(
        (a) => a.definition.id === 'parent_unasked_answer',
      );
      const ex = hasUnasked
        ? PARENT_EXCHANGES[PARENT_EXCHANGES.length - 1]
        : PARENT_EXCHANGES[Math.floor(rng() * (PARENT_EXCHANGES.length - 1))];
      const [first, ...rest] = ex.lines;
      next.subtitle = {
        speaker: first.speaker,
        text: first.text,
        remainingSec: first.durationSec,
      };
      next.pendingSubtitleQueue = rest;
      next.dialogueCooldown = nightmare ? 12 : 16;
    }

    next.maskCooldown -= clampedDt;
    if (next.maskCooldown <= 0 && !next.maskPrompt && next.activePanel === 'none') {
      const q = shuffleMaskOptions(
        MASK_QUESTIONS[Math.floor(rng() * MASK_QUESTIONS.length)],
        rng,
      );
      const adjustedTimeout = nightmare ? Math.max(6.5, q.timeoutSec * 0.78) : q.timeoutSec;
      next.maskPrompt = {
        question: q,
        remainingSec: adjustedTimeout,
        totalSec: adjustedTimeout,
      };
      next.maskCooldown = nightmare ? 22 : 30;
    }

    next.paCooldown -= clampedDt;
    if (next.paCooldown <= 0) {
      const line =
        BACKGROUND_PA_ANNOUNCEMENTS[Math.floor(rng() * BACKGROUND_PA_ANNOUNCEMENTS.length)];
      next.paFeed = [
        {
          id: `pa-${Math.round(next.elapsedSec * 100)}`,
          stopNumber: stop.number,
          text: line,
          timestampSec: next.elapsedSec,
        },
        ...next.paFeed.slice(0, 19),
      ];
      options.callbacks?.onPaDing?.();
      next.paCooldown = 14 + rng() * 12;
    }
  }

  // Restraint mechanics at Stop 11 (Greenpoint Av)
  if (next.phase === 'restraint') {
    if (next.restraintHolding && !options.restraintMoved) {
      next.restraintProgress = Math.min(1, next.restraintProgress + clampedDt / 6.5);
    } else if (options.restraintMoved || (!next.restraintHolding && next.elapsedSec > 0)) {
      next.restraintProgress = Math.max(0, next.restraintProgress - clampedDt * 0.18);
      if (options.restraintMoved) {
        next.restraintSlips += 1;
        if (next.restraintSlips % 24 === 1) {
          next.hadMistakeThisStop = true;
          next.suspicion = applySuspicionChange(
            next.suspicion,
            'restraint_let_go',
            stop.number,
            practice,
          );
          next.sanity = applySanityPenalty(next.sanity, 3, stop.number);
          next.sanity = triggerSanityGlitch(next.sanity, 0.45, 0.85);
        }
      }
    }

    next.phaseTimer -= clampedDt;
    if (next.restraintProgress >= 1 || next.phaseTimer <= 0) {
      next.restraintOutcome = next.restraintProgress >= 0.75 ? 'held_still' : 'let_go';
      if (next.restraintOutcome === 'let_go') {
        next.suspicion = applySuspicionChange(
          next.suspicion,
          'restraint_let_go',
          stop.number,
          practice,
        );
      }
      next.phase = 'dwelling';
      next.phaseDuration = stop.dwellSeconds;
      next.phaseTimer = stop.dwellSeconds;
      next.doorOpen = 1;
      options.callbacks?.onDoorSlide?.(true);
    }
    return next;
  }

  // Phase timer & train speed/door animation
  next.phaseTimer -= clampedDt;
  const speedCap = nightmare ? 1.25 : 1.0;

  if (next.phase === 'cruising') {
    next.trainSpeed = Math.min(speedCap, next.trainSpeed + clampedDt * 0.55);
    next.doorOpen = Math.max(0, next.doorOpen - clampedDt * 2.2);
    if (next.phaseTimer <= 0) {
      next.phase = 'braking';
      next.phaseDuration = nightmare ? 3.2 : 4.2;
      next.phaseTimer = next.phaseDuration;
      next.stopAnnouncementPlayed = false;
    }
  } else if (next.phase === 'blackout') {
    next.trainSpeed = Math.min(speedCap * 0.88, next.trainSpeed + clampedDt * 0.35);
    next.doorOpen = 0;
    if (next.phaseTimer <= 0) {
      // Resume ride into Stop 7 (Flushing Av)
      return beginSegmentToNextStop(next, options.callbacks, rng);
    }
  } else if (next.phase === 'braking') {
    const progress = 1 - Math.max(0, next.phaseTimer / Math.max(0.1, next.phaseDuration));
    next.trainSpeed = Math.max(0, speedCap * (1 - progress));
    if (!next.stopAnnouncementPlayed && progress > 0.35) {
      next.stopAnnouncementPlayed = true;
      const announceText =
        stop.lyingPaLine ??
        (stop.kind === 'final'
          ? 'This is Court Square. Last stop. Thank you for riding the G train.'
          : `This is ${stop.name}.`);
      next.paFeed = [
        {
          id: `pa-stop-${stop.number}-${Math.round(next.elapsedSec)}`,
          stopNumber: stop.number,
          text: announceText,
          timestampSec: next.elapsedSec,
        },
        ...next.paFeed.slice(0, 19),
      ];
      options.callbacks?.onPaDing?.();
    }

    if (next.phaseTimer <= 0) {
      next.trainSpeed = 0;

      // Stop 13 (Court Sq) or end of Practice Mode finishes the ride
      const seq = getSequenceForDifficulty(next.difficulty);
      if (next.sequencePos >= seq.length - 1) {
        next.phase = 'arrived';
        next.doorOpen = 1;
        options.callbacks?.onDoorSlide?.(true);
        return finalizeRide(next);
      }

      // Stop 11 (Greenpoint Av) triggers the Restraint before doors open
      if (stop.kind === 'restraint' && next.restraintOutcome === 'not_reached') {
        next.phase = 'restraint';
        next.phaseDuration = 9.0;
        next.phaseTimer = 9.0;
        next.restraintHolding = false;
        next.restraintProgress = 0;
        next.sanity = triggerSanityGlitch(next.sanity, 0.65, 0.9);
        return next;
      }

      next.phase = 'dwelling';
      next.phaseDuration = stop.dwellSeconds;
      next.phaseTimer = stop.dwellSeconds;
      next.safeHavenPromptOpen = stop.kind === 'safe_haven' && next.safeHavenChoice === 'not_reached';
      options.callbacks?.onDoorSlide?.(true);
    }
  } else if (next.phase === 'dwelling') {
    next.trainSpeed = 0;
    next.doorOpen = Math.min(1, next.doorOpen + clampedDt * 2.4);

    if (next.phaseTimer <= 0) {
      // If player ignored Safe Haven at Stop 6, treat as refusing
      if (stop.kind === 'safe_haven' && next.safeHavenChoice === 'not_reached') {
        next.safeHavenChoice = 'refused';
        next.safeHavenPromptOpen = false;
        next.hadMistakeThisStop = true;
        next.suspicion = applySuspicionChange(
          next.suspicion,
          'refuse_safe_haven',
          stop.number,
          practice,
        );
      }

      // Clean stop reward (-5 suspicion) if no mistakes occurred at this stop
      if (next.stopIndex >= 1 && !next.hadMistakeThisStop) {
        next.suspicion = applySuspicionChange(next.suspicion, 'clean_stop', stop.number, practice);
      }

      options.callbacks?.onDoorChime?.();
      options.callbacks?.onDoorSlide?.(false);

      // After Stop 6 (Myrtle-Willoughby Avs): enter the Blackout segment!
      if (stop.blackoutAfter && !practice) {
        next.phase = 'blackout';
        next.phaseDuration = nightmare ? 11 : 13;
        next.phaseTimer = next.phaseDuration;
        next.activeAnomalies = [];
        next.subtitle = null;
        next.pendingSubtitleQueue = [];
        next.maskPrompt = null;
        next.parentWatching = 'none';
        next.safeHavenPromptOpen = false;
        return next;
      }

      return beginSegmentToNextStop(next, options.callbacks, rng);
    }
  }

  return next;
}

export function beginSegmentToNextStop(
  state: GameState,
  _callbacks?: StepCallbacks,
  rng: () => number = Math.random,
): GameState {
  const seq = getSequenceForDifficulty(state.difficulty);
  const nextSeqPos = Math.min(seq.length - 1, state.sequencePos + 1);
  const nextStopIndex = seq[nextSeqPos];
  const nextStop = getStopByIndex(nextStopIndex);
  const nightmare = state.difficulty === 'nightmare';
  const practice = state.difficulty === 'practice';

  const cruiseScale = nightmare ? 0.68 : practice ? 0.65 : 1.0;
  const cruiseDur = Math.max(8, Math.round(nextStop.cruiseSeconds * cruiseScale));

  const anomalies = selectAnomaliesForStop(nextStop.number, state.elapsedSec, practice, rng);
  let nextSanity = advanceSanityForStop(state.sanity, nextStop.number, nightmare, practice);

  // Critical anomalies trigger a glitch the moment they appear
  if (anomalies.some((a) => a.definition.isCritical)) {
    nextSanity = triggerSanityGlitch(nextSanity, 0.5, 0.82);
  }

  return {
    ...state,
    sequencePos: nextSeqPos,
    stopIndex: nextStopIndex,
    phase: 'cruising',
    phaseDuration: cruiseDur,
    phaseTimer: cruiseDur,
    doorOpen: 0,
    sanity: nextSanity,
    activeAnomalies: anomalies,
    hadMistakeThisStop: false,
    safeHavenPromptOpen: false,
    stopAnnouncementPlayed: false,
  };
}

/**
 * Player flags an object/area they suspect changed.
 * CRITICAL RULE: Never let any UI or visual effect tell the player whether the flag was right or wrong.
 */
export function submitPlayerFlag(state: GameState, targetId: AnomalyTargetId): GameState {
  if (state.screen !== 'playing') return state;
  const stop = getCurrentStop(state);
  const practice = state.difficulty === 'practice';

  const { matched, updatedAnomalies } = evaluatePlayerFlag(state.activeAnomalies, targetId);
  let nextSuspicion = state.suspicion;
  let hadMistake = state.hadMistakeThisStop;

  if (!matched) {
    // False positive: +20 suspicion (unless forgiving stop)
    hadMistake = true;
    nextSuspicion = applySuspicionChange(
      nextSuspicion,
      stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'false_positive',
      stop.number,
      practice,
    );
  }

  const label = INSPECTABLE_TARGETS[targetId] ?? targetId;
  const entry: FlagLogEntry = {
    id: `flag-${state.flagLog.length + 1}-${Math.round(state.elapsedSec * 10)}`,
    stopNumber: stop.number,
    stopName: stop.name,
    targetId,
    targetLabel: label,
    timestampSec: state.elapsedSec,
    note: `Logged observation: ${label}`,
    _wasTrueAnomaly: matched,
  };

  return {
    ...state,
    suspicion: nextSuspicion,
    activeAnomalies: updatedAnomalies,
    hadMistakeThisStop: hadMistake,
    flagLog: [entry, ...state.flagLog],
    neutralNotice: `Logged in Psychological Log: ${label}`,
    neutralNoticeTimer: 2.6,
  };
}

/** Answer an active parent mask prompt */
export function answerMaskPrompt(state: GameState, optionId: string): GameState {
  if (!state.maskPrompt) return state;
  const stop = getCurrentStop(state);
  const practice = state.difficulty === 'practice';
  const chosen = state.maskPrompt.question.options.find((o) => o.id === optionId);
  if (!chosen) return state;

  let nextSuspicion = state.suspicion;
  let hadMistake = state.hadMistakeThisStop;
  let reply: ActiveSubtitle;

  if (chosen.isCalm) {
    reply = {
      speaker: state.maskPrompt.question.speaker,
      text: 'Good. Just sit tight until Court Square.',
      remainingSec: 3.0,
    };
  } else {
    hadMistake = true;
    nextSuspicion = applySuspicionChange(
      nextSuspicion,
      'failed_mask_prompt',
      stop.number,
      practice,
    );
    reply = {
      speaker: state.maskPrompt.question.speaker,
      text: 'Don’t talk like that on the train.',
      remainingSec: 3.4,
    };
  }

  return {
    ...state,
    maskPrompt: null,
    suspicion: nextSuspicion,
    hadMistakeThisStop: hadMistake,
    subtitle: reply,
    parentWatching: chosen.isCalm ? state.parentWatching : 'dad',
    parentWatchTimer: chosen.isCalm ? state.parentWatchTimer : Math.max(state.parentWatchTimer, 4.5),
  };
}

/** Safe Haven choice at Stop 6 (Myrtle-Willoughby Avs) */
export function chooseSafeHaven(state: GameState, takeShelter: boolean): GameState {
  const stop = getCurrentStop(state);
  if (stop.kind !== 'safe_haven') return state;
  const practice = state.difficulty === 'practice';

  if (takeShelter) {
    // Shelter steadies nerves slightly without breaking per-stop ceiling
    const nextSanity = {
      ...state.sanity,
      value: Math.min(95, state.sanity.value + 6),
    };
    return {
      ...state,
      safeHavenChoice: 'taken',
      safeHavenPromptOpen: false,
      sanity: nextSanity,
      neutralNotice: 'You ducked beneath the Myrtle-Willoughby shelter awning until the doors chimed.',
      neutralNoticeTimer: 3.8,
    };
  }

  return {
    ...state,
    safeHavenChoice: 'refused',
    safeHavenPromptOpen: false,
    hadMistakeThisStop: true,
    suspicion: applySuspicionChange(state.suspicion, 'refuse_safe_haven', stop.number, practice),
    neutralNotice: 'You stayed on the bench and refused the Safe Haven.',
    neutralNoticeTimer: 3.2,
  };
}

/** Attempt to step off through open doors during dwell */
export function attemptStepOffAtStop(state: GameState): GameState {
  if (state.phase !== 'dwelling') return state;
  const stop = getCurrentStop(state);
  const practice = state.difficulty === 'practice';

  if (stop.isFalseStop) {
    const reason = stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'false_stop_exit';
    return {
      ...state,
      hadMistakeThisStop: true,
      falseStopDisembarks: state.falseStopDisembarks + 1,
      suspicion: applySuspicionChange(state.suspicion, reason, stop.number, practice),
      sanity: triggerSanityGlitch(applySanityPenalty(state.sanity, 6, stop.number), 0.65, 0.9),
      subtitle: {
        speaker: 'Dad',
        text: stop.isForgivingFalseStop
          ? 'Get back inside. That sign isn’t right.'
          : 'Sit down. This is not Court Square.',
        remainingSec: 3.8,
      },
      neutralNotice: 'The platform outside was blank concrete. You stepped back inside before the doors closed.',
      neutralNoticeTimer: 3.8,
    };
  }

  if (stop.kind === 'final') {
    return finalizeRide(state);
  }

  return {
    ...state,
    neutralNotice: 'Not our stop yet. Stay seated until Court Sq.',
    neutralNoticeTimer: 2.6,
  };
}

/** Add captured Polaroid photo */
export function addPolaroidPhoto(state: GameState, dataUrl: string): GameState {
  const stop = getCurrentStop(state);
  const photo: PolaroidPhoto = {
    id: `pol-${state.photos.length + 1}-${Math.round(state.elapsedSec * 10)}`,
    stopNumber: stop.number,
    stopName: stop.name,
    dataUrl,
    timestampSec: state.elapsedSec,
    caption: `Car B · Stop ${stop.number} (${stop.name})`,
  };
  return {
    ...state,
    photos: [photo, ...state.photos],
    neutralNotice: 'Polaroid saved to Evidence Album.',
    neutralNoticeTimer: 2.2,
  };
}

/** Complete an EVP tape recording */
export function finishEvpRecording(state: GameState): GameState {
  const stop = getCurrentStop(state);
  const hasResonance = state.activeAnomalies.length > 0 || state.phase === 'blackout';
  const hints = [
    'Low rail hum... faint whisper counting backwards.',
    'Fluorescent ballast buzz... distant chime on an empty track.',
    'Static floor... two breaths that do not match your own.',
    'Steady steel clack... muffled intercom tone.',
  ];
  const clip: EvpRecording = {
    id: `evp-${state.evpClips.length + 1}-${Math.round(state.elapsedSec * 10)}`,
    stopNumber: stop.number,
    stopName: stop.name,
    durationSec: Math.max(1, Number(state.evpRecordElapsed.toFixed(1))),
    timestampSec: state.elapsedSec,
    transcriptHint: hasResonance ? hints[stop.number % 3] : hints[3],
    hasAnomalyResonance: hasResonance,
  };
  return {
    ...state,
    evpRecordingActive: false,
    evpRecordElapsed: 0,
    evpClips: [clip, ...state.evpClips],
    neutralNotice: 'EVP clip recorded to Evidence Log.',
    neutralNoticeTimer: 2.4,
  };
}

/**
 * Evaluates the final Court Sq Travel Report and unlocks Nightmare mode / achievements.
 * TBD: Final ending variants and exact scoring thresholds are marked TBD per brief.
 */
export function finalizeRide(state: GameState): GameState {
  const trueFlags = state.flagLog.filter((f) => f._wasTrueAnomaly).length;
  const falsePositives = state.flagLog.filter((f) => !f._wasTrueAnomaly).length;
  const band = getSuspicionBand(state.suspicion.value);
  const seq = getSequenceForDifficulty(state.difficulty);

  // TBD: Placeholder ending variants & scoring thresholds
  let endingId = 'tbd_quiet_arrival';
  let title = 'Quiet Arrival';
  let subtitle = 'Ending A · Court Sq (Placeholder Thresholds — TBD)';
  let summary =
    'The doors open onto the real tile of Court Square. Mom stands first, Dad rests a hand on your shoulder, and neither of them asks what you counted.';

  if (state.difficulty === 'practice') {
    endingId = 'practice_complete';
    title = 'Practice Run Complete';
    subtitle = 'Training Segment Finished';
    summary =
      'You completed the shortened G train orientation loop. Ready for the full 13-stop ride from Hoyt-Schermerhorn to Court Sq.';
  } else if (state.suspicion.value >= 75 || state.falseStopDisembarks > 0) {
    endingId = 'tbd_kept_riding';
    title = 'Past the Last Stop';
    subtitle = 'Ending C · Hunted Variant (Placeholder Thresholds — TBD)';
    summary =
      'At Court Square the doors slide open, then close before you stand. Dad looks at the ceiling sign, smiles once, and says there is one more stop.';
  } else if (
    state.suspicion.value <= 24 &&
    state.safeHavenChoice === 'taken' &&
    state.restraintOutcome === 'held_still'
  ) {
    endingId = 'tbd_unseen_home';
    title = 'Unseen All the Way Home';
    subtitle = 'Ending S · Calm Variant (Placeholder Thresholds — TBD)';
    summary =
      'You noticed every wrong detail, kept your expression flat, sheltered at Myrtle-Willoughby, and never flinched at Greenpoint. The stairwell up to Jackson Ave smells like cold night air.';
  } else if (state.suspicion.value >= 50 || state.restraintOutcome === 'let_go') {
    endingId = 'tbd_watched_walk';
    title = 'The Long Walk Up';
    subtitle = 'Ending B · Watched Variant (Placeholder Thresholds — TBD)';
    summary =
      'You made it off the G at Court Square, though both parents stayed half a step behind you up the stairs, watching whether you turned around.';
  }

  const achievements: string[] = [];
  if (state.difficulty !== 'practice') {
    achievements.push('Last Local: Reached Court Sq');
    if (state.suspicion.value <= 24) achievements.push('Poker Face: Finished in CALM');
    if (state.safeHavenChoice === 'taken') achievements.push('Myrtle-Willoughby Shelter');
    if (state.restraintOutcome === 'held_still') achievements.push('Still Hands at Greenpoint');
    if (state.photos.length >= 1) achievements.push('Instant Evidence (Polaroid)');
    if (state.evpClips.length >= 1) achievements.push('Static Listener (EVP)');
    if (state.difficulty === 'nightmare') achievements.push('Nightmare Express');
  } else {
    achievements.push('First Token: Practice Complete');
  }

  const wasUnlocked = isNightmareUnlocked();
  const nightmareJustUnlocked = state.difficulty !== 'practice' && !wasUnlocked;
  if (state.difficulty !== 'practice') {
    saveNightmareUnlocked();
  }
  saveAchievements(achievements);

  const report: EndingReportData = {
    endingId,
    title,
    subtitle,
    summary,
    difficulty: state.difficulty,
    finalSuspicion: state.suspicion.value,
    finalSuspicionBand: band,
    peakSuspicion: state.suspicion.peak,
    finalSanity: state.sanity.value,
    finalSanityTier: state.sanity.tier,
    stopsCompleted: seq.length,
    totalStops: seq.length,
    trueFlags,
    falsePositives,
    totalFlags: state.flagLog.length,
    safeHavenChoice: state.safeHavenChoice,
    restraintOutcome: state.restraintOutcome,
    falseStopDisembarks: state.falseStopDisembarks,
    photosTaken: state.photos.length,
    evpClipsRecorded: state.evpClips.length,
    durationSec: Math.round(state.elapsedSec),
    unlockedAchievements: achievements,
    nightmareJustUnlocked,
  };

  return {
    ...state,
    screen: 'ending',
    phase: 'arrived',
    activePanel: 'none',
    maskPrompt: null,
    safeHavenPromptOpen: false,
    endingReport: report,
  };
}

export function getCurrentLedText(state: GameState): string {
  const stop = getCurrentStop(state);
  return getLedDisplayText(stop, state.phase);
}

export function getCurrentHeartbeat(state: GameState) {
  return getHeartbeatProfile(state.sanity.value, state.elapsedSec);
}
