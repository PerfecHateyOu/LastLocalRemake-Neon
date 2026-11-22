/**
 * Core Game State Machine — Last Local
 * Coordinates multi-line (G, L, 7) 13-stop rides & 4 Chapters, Suspicion, Sanity,
 * Anomalies, Parents, Blackout, Safe Haven, Restraint, 3-Stage False Stop Trials,
 * Radio/PA Frequency Tuner, Polaroids, EVP Tape Recorder, 13-Case Psych Log,
 * Persistent Archive, Practice/Nightmare modes, and 8 Priority-Ranked Endings.
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
  loadArchive,
  recordRunInArchive,
  saveArchive,
} from './archive';
import {
  BACKGROUND_PA_ANNOUNCEMENTS,
  MASK_QUESTIONS,
  MaskQuestion,
  PARENT_EXCHANGES,
  shuffleMaskOptions,
} from './dialogue';
import { EndingId, evaluateEnding } from './endings';
import {
  ChapterId,
  getChapterDefinition,
  getLedDisplayText,
  getLineDefinition,
  getStopByIndex,
  PRACTICE_STOP_INDICES,
  RouteStop,
  SubwayLineId,
} from './route';
import {
  advanceSanityForStop,
  applySanityPenalty,
  createInitialSanity,
  getHeartbeatProfile,
  SanityState,
  SanityTier,
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
import {
  createTrialState,
  setTrialHolding,
  stepTrialState,
  submitTrialChoice,
  TrialState,
} from './trial';
import {
  clampFrequency,
  evaluateTunerSignal,
  TunerSignalLog,
} from './tuner';

export type ScreenMode = 'title' | 'tutorial' | 'playing' | 'paused' | 'ending';
export type RideDifficulty = 'standard' | 'practice' | 'nightmare';
export type RidePhase =
  | 'cruising'
  | 'braking'
  | 'dwelling'
  | 'blackout'
  | 'restraint'
  | 'trial'
  | 'arrived';

export type ActivePanelId = 'none' | 'pa_board' | 'evidence' | 'polaroid' | 'evp' | 'tuner';

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
  endingId: EndingId;
  priority: number;
  code: string;
  tone: 'dark' | 'uneasy' | 'clean' | 'true';
  title: string;
  subtitle: string;
  summary: string;
  lineId: SubwayLineId;
  chapterId: ChapterId;
  difficulty: RideDifficulty;
  finalSuspicion: number;
  finalSuspicionBand: SuspicionBand;
  peakSuspicion: number;
  finalSanity: number;
  finalSanityTier: SanityTier;
  stopsCompleted: number;
  totalStops: number;
  highestStopReached: number;
  trueFlags: number;
  falsePositives: number;
  totalFlags: number;
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  falseStopDisembarks: number;
  falseStopTrialsSurvived: number;
  falseStopTrialCollapsed: boolean;
  photosTaken: number;
  evpClipsRecorded: number;
  tunerSignalsLocked: number;
  durationSec: number;
  unlockedAchievements: string[];
  nightmareJustUnlocked: boolean;
}

export interface GameState {
  screen: ScreenMode;
  lineId: SubwayLineId;
  chapterId: ChapterId;
  difficulty: RideDifficulty;
  /** Index into active stop sequence */
  sequencePos: number;
  /** Canonical stop index (0..12) */
  stopIndex: number;
  /** Highest 1-based stop reached during this ride (for 13-Case Psych Log) */
  highestStopReached: number;
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
  tunerFrequencyMhz: number;
  tunerLogs: TunerSignalLog[];

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
  falseStopTrialsSurvived: number;
  falseStopTrialCollapsed: boolean;
  falseStopIncidentStops: number[];
  activeTrial: TrialState | null;
  hadMistakeThisStop: boolean;
  stopAnnouncementPlayed: boolean;

  /** Active tool overlays */
  activePanel: ActivePanelId;
  evpRecordingActive: boolean;
  evpRecordElapsed: number;

  /** Transient neutral feedback banner (never reveals if a flag was right/wrong) */
  neutralNotice: string | null;
  neutralNoticeTimer: number;

  /** Completed ride report */
  endingReport: EndingReportData | null;
}

export function isNightmareUnlocked(): boolean {
  return loadArchive().nightmareUnlocked;
}

export function saveNightmareUnlocked(): void {
  const archive = loadArchive();
  if (!archive.nightmareUnlocked) {
    saveArchive({ ...archive, nightmareUnlocked: true });
  }
}

export function loadSavedAchievements(): string[] {
  return loadArchive().achievements;
}

export function saveAchievements(list: string[]): void {
  const archive = loadArchive();
  const merged = Array.from(new Set([...archive.achievements, ...list]));
  saveArchive({ ...archive, achievements: merged });
}

export function getSequenceForDifficulty(
  difficulty: RideDifficulty,
  chapterId: ChapterId = 'full',
): readonly number[] {
  if (difficulty === 'practice') {
    return PRACTICE_STOP_INDICES;
  }
  return getChapterDefinition(chapterId).stopIndices;
}

export function getCurrentStop(state: GameState): RouteStop {
  return getStopByIndex(state.stopIndex, state.lineId);
}

export function createInitialGameState(
  difficulty: RideDifficulty = 'standard',
  screen: ScreenMode = 'title',
  lineId: SubwayLineId = 'G',
  chapterId: ChapterId = 'full',
): GameState {
  const line = getLineDefinition(lineId);
  const seq = getSequenceForDifficulty(difficulty, chapterId);
  const startStopIndex = seq[0] ?? 0;
  const firstStop = getStopByIndex(startStopIndex, lineId);
  const initialSanity =
    startStopIndex > 0
      ? advanceSanityForStop(createInitialSanity(), firstStop.number, difficulty === 'nightmare', difficulty === 'practice')
      : createInitialSanity();

  return {
    screen,
    lineId,
    chapterId: difficulty === 'practice' ? 'full' : chapterId,
    difficulty,
    sequencePos: 0,
    stopIndex: startStopIndex,
    highestStopReached: firstStop.number,
    phase: 'dwelling',
    phaseTimer: firstStop.dwellSeconds,
    phaseDuration: firstStop.dwellSeconds,
    trainSpeed: 0,
    doorOpen: 1,
    elapsedSec: 0,

    suspicion: createInitialSuspicion(),
    sanity: initialSanity,
    activeAnomalies: [],
    flagLog: [],
    paFeed: [
      {
        id: 'pa-boarding',
        stopNumber: firstStop.number,
        text:
          startStopIndex === 0
            ? line.boardingPa
            : `This is ${firstStop.name}. ${line.id} local service toward ${line.terminusName}.`,
        timestampSec: 0,
      },
    ],
    photos: [],
    evpClips: [],
    tunerFrequencyMhz: 92.5,
    tunerLogs: [],

    subtitle: {
      speaker: 'Mom',
      text:
        startStopIndex === 0
          ? `Sit still, sweetheart. Thirteen stops to ${line.terminusName} and we’re home.`
          : `Stay seated through ${firstStop.name}. Keep your eyes ahead.`,
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
    falseStopTrialsSurvived: 0,
    falseStopTrialCollapsed: false,
    falseStopIncidentStops: [],
    activeTrial: null,
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

function resolveTrialOutcome(
  state: GameState,
  updatedTrial: TrialState,
  stop: RouteStop,
): GameState {
  const practice = state.difficulty === 'practice';

  if (updatedTrial.status === 'collapsed') {
    const failedState: GameState = {
      ...state,
      activeTrial: null,
      falseStopTrialCollapsed: true,
      suspicion: applySuspicionChange(state.suspicion, 'false_stop_exit', stop.number, practice),
      sanity: triggerSanityGlitch(applySanityPenalty(state.sanity, 12, stop.number), 0.9, 1.0),
    };
    return finalizeRide(failedState);
  }

  if (updatedTrial.status === 'survived') {
    const strikePenalty = updatedTrial.strikes * 6;
    const nextSanity =
      strikePenalty > 0 ? applySanityPenalty(state.sanity, strikePenalty, stop.number) : state.sanity;
    return {
      ...state,
      phase: 'dwelling',
      phaseDuration: 2.2,
      phaseTimer: 2.2,
      doorOpen: 0.75,
      activeTrial: null,
      falseStopTrialsSurvived: state.falseStopTrialsSurvived + 1,
      sanity: nextSanity,
      parentWatching: 'dad',
      parentWatchTimer: 5.0,
      subtitle: {
        speaker: 'Dad',
        text: stop.isForgivingFalseStop
          ? 'Back in your seat. That platform sign wasn’t right.'
          : 'Sit down and don’t move. That was not our last stop.',
        remainingSec: 4.0,
      },
      neutralNotice:
        updatedTrial.lastFeedback ?? 'You made it back inside Car B before the doors sealed.',
      neutralNoticeTimer: 3.6,
    };
  }

  return {
    ...state,
    activeTrial: updatedTrial,
  };
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
  const line = getLineDefinition(state.lineId);

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

  // Active 3-Stage False Stop Trial takes priority over normal dwell progression
  if (next.phase === 'trial' && next.activeTrial) {
    next.trainSpeed = 0;
    const prevStrikes = next.activeTrial.strikes;
    const updatedTrial = stepTrialState(next.activeTrial, clampedDt, stop, options.restraintMoved);
    if (updatedTrial.strikes > prevStrikes) {
      next.hadMistakeThisStop = true;
      next.suspicion = applySuspicionChange(
        next.suspicion,
        stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'visible_reaction',
        stop.number,
        practice,
      );
      next.sanity = triggerSanityGlitch(applySanityPenalty(next.sanity, 4, stop.number), 0.55, 0.85);
    }
    return resolveTrialOutcome(next, updatedTrial, stop);
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

      const reason = stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'visible_reaction';
      next.suspicion = applySuspicionChange(next.suspicion, reason, stop.number, practice);
      next.subtitle = {
        speaker: 'Dad',
        text: snappedHead ? 'Easy. Keep your head straight.' : 'Quit staring. Look forward.',
        remainingSec: 3.0,
      };
    }
  }

  // Single fluorescent tube flicker mid-ride
  if (next.phase === 'blackout') {
    next.flickeringTubeIndex = 2;
    next.flickerTimer = 1;
  } else if (stop.kind === 'forced_bait' && (next.phase === 'cruising' || next.phase === 'dwelling')) {
    next.flickeringTubeIndex = 4;
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
      const lineText =
        BACKGROUND_PA_ANNOUNCEMENTS[Math.floor(rng() * BACKGROUND_PA_ANNOUNCEMENTS.length)];
      next.paFeed = [
        {
          id: `pa-${Math.round(next.elapsedSec * 100)}`,
          stopNumber: stop.number,
          text: lineText,
          timestampSec: next.elapsedSec,
        },
        ...next.paFeed.slice(0, 19),
      ];
      options.callbacks?.onPaDing?.();
      next.paCooldown = 14 + rng() * 12;
    }
  }

  // Restraint mechanics at Stop 11 (Greenpoint Av / Morgan Av / 46 St-Bliss St)
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
      return beginSegmentToNextStop(next, options.callbacks, rng);
    }
  } else if (next.phase === 'braking') {
    const progress = 1 - Math.max(0, next.phaseTimer / Math.max(0.1, next.phaseDuration));
    next.trainSpeed = Math.max(0, speedCap * (1 - progress));
    if (!next.stopAnnouncementPlayed && progress > 0.35) {
      next.stopAnnouncementPlayed = true;
      // Signature Lying PA preserved on Stop 9 (Metropolitan Av / Grand St / 33 St-Rawson St)
      const announceText =
        stop.lyingPaLine ?? (stop.kind === 'final' ? line.finalPa : `This is ${stop.name}.`);
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

      const seq = getSequenceForDifficulty(next.difficulty, next.chapterId);
      if (next.sequencePos >= seq.length - 1) {
        next.phase = 'arrived';
        next.doorOpen = 1;
        options.callbacks?.onDoorSlide?.(true);
        return finalizeRide(next);
      }

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

      if (next.stopIndex >= 1 && !next.hadMistakeThisStop) {
        next.suspicion = applySuspicionChange(next.suspicion, 'clean_stop', stop.number, practice);
      }

      options.callbacks?.onDoorChime?.();
      options.callbacks?.onDoorSlide?.(false);

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
  const seq = getSequenceForDifficulty(state.difficulty, state.chapterId);
  const nextSeqPos = Math.min(seq.length - 1, state.sequencePos + 1);
  const nextStopIndex = seq[nextSeqPos];
  const nextStop = getStopByIndex(nextStopIndex, state.lineId);
  const nightmare = state.difficulty === 'nightmare';
  const practice = state.difficulty === 'practice';

  const cruiseScale = nightmare ? 0.68 : practice ? 0.65 : 1.0;
  const cruiseDur = Math.max(8, Math.round(nextStop.cruiseSeconds * cruiseScale));

  const anomalies = selectAnomaliesForStop(nextStop.number, state.elapsedSec, practice, rng);
  let nextSanity = advanceSanityForStop(state.sanity, nextStop.number, nightmare, practice);

  if (anomalies.some((a) => a.definition.isCritical)) {
    nextSanity = triggerSanityGlitch(nextSanity, 0.5, 0.82);
  }

  return {
    ...state,
    sequencePos: nextSeqPos,
    stopIndex: nextStopIndex,
    highestStopReached: Math.max(state.highestStopReached, nextStop.number),
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
  const line = getLineDefinition(state.lineId);
  const practice = state.difficulty === 'practice';
  const chosen = state.maskPrompt.question.options.find((o) => o.id === optionId);
  if (!chosen) return state;

  let nextSuspicion = state.suspicion;
  let hadMistake = state.hadMistakeThisStop;
  let reply: ActiveSubtitle;

  if (chosen.isCalm) {
    reply = {
      speaker: state.maskPrompt.question.speaker,
      text: `Good. Just sit tight until ${line.terminusName}.`,
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

/** Safe Haven choice at Stop 6 (Myrtle-Willoughby / Bedford Av / Hunters Point Av) */
export function chooseSafeHaven(state: GameState, takeShelter: boolean): GameState {
  const stop = getCurrentStop(state);
  if (stop.kind !== 'safe_haven') return state;
  const practice = state.difficulty === 'practice';

  if (takeShelter) {
    const nextSanity = {
      ...state.sanity,
      value: Math.min(95, state.sanity.value + 6),
    };
    return {
      ...state,
      safeHavenChoice: 'taken',
      safeHavenPromptOpen: false,
      sanity: nextSanity,
      neutralNotice: `You ducked beneath the ${stop.name} shelter awning until the doors chimed.`,
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

/** Attempt to step off through open doors during dwell — triggers 3-stage False Stop Trial on false stops */
export function attemptStepOffAtStop(state: GameState): GameState {
  if (state.phase !== 'dwelling') return state;
  const stop = getCurrentStop(state);
  const line = getLineDefinition(state.lineId);
  const practice = state.difficulty === 'practice';

  if (stop.isFalseStop) {
    const reason = stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'false_stop_exit';
    const trial = createTrialState(stop, state.lineId);
    const incidentStops = state.falseStopIncidentStops.includes(stop.number)
      ? state.falseStopIncidentStops
      : [...state.falseStopIncidentStops, stop.number];

    return {
      ...state,
      phase: 'trial',
      activePanel: 'none',
      maskPrompt: null,
      safeHavenPromptOpen: false,
      hadMistakeThisStop: true,
      falseStopDisembarks: state.falseStopDisembarks + 1,
      falseStopIncidentStops: incidentStops,
      activeTrial: trial,
      suspicion: applySuspicionChange(state.suspicion, reason, stop.number, practice),
      sanity: triggerSanityGlitch(applySanityPenalty(state.sanity, 6, stop.number), 0.65, 0.9),
      subtitle: {
        speaker: 'Dad',
        text: stop.isForgivingFalseStop
          ? 'Get back inside. That sign isn’t right.'
          : `Sit down. This is not ${line.terminusName}.`,
        remainingSec: 3.8,
      },
      neutralNotice: null,
      neutralNoticeTimer: 0,
    };
  }

  if (stop.kind === 'final') {
    return finalizeRide(state);
  }

  return {
    ...state,
    neutralNotice: `Not our stop yet. Stay seated until ${line.terminusName}.`,
    neutralNoticeTimer: 2.6,
  };
}

/** Submit a Stage 1 or Stage 3 choice during an active False Stop Trial */
export function answerTrialChoice(state: GameState, choiceId: string): GameState {
  if (state.phase !== 'trial' || !state.activeTrial) return state;
  const stop = getCurrentStop(state);
  const practice = state.difficulty === 'practice';
  const prevStrikes = state.activeTrial.strikes;
  const updatedTrial = submitTrialChoice(state.activeTrial, choiceId, stop);

  let next = state;
  if (updatedTrial.strikes > prevStrikes) {
    next = {
      ...next,
      hadMistakeThisStop: true,
      suspicion: applySuspicionChange(
        next.suspicion,
        stop.isForgivingFalseStop ? 'forgiving_false_stop' : 'visible_reaction',
        stop.number,
        practice,
      ),
      sanity: triggerSanityGlitch(applySanityPenalty(next.sanity, 5, stop.number), 0.6, 0.85),
    };
  }

  return resolveTrialOutcome(next, updatedTrial, stop);
}

/** Toggle hold-still state during Stage 2 of an active False Stop Trial */
export function setTrialHoldState(state: GameState, holding: boolean): GameState {
  if (state.phase !== 'trial' || !state.activeTrial) return state;
  return {
    ...state,
    activeTrial: setTrialHolding(state.activeTrial, holding),
  };
}

/** Adjust the transit-band Radio/PA Frequency Tuner */
export function adjustTunerFrequency(state: GameState, nextFreqMhz: number): GameState {
  return {
    ...state,
    tunerFrequencyMhz: clampFrequency(nextFreqMhz),
  };
}

/** Attempt to lock and record the currently tuned frequency signal */
export function lockTunerSignal(state: GameState): GameState {
  if (state.screen !== 'playing') return state;
  const stop = getCurrentStop(state);
  const { lockedChannel } = evaluateTunerSignal(state.tunerFrequencyMhz, state.lineId, stop.number);

  if (!lockedChannel) {
    return {
      ...state,
      neutralNotice: `Static at ${state.tunerFrequencyMhz.toFixed(1)} MHz — no clean carrier locked.`,
      neutralNoticeTimer: 2.2,
    };
  }

  const alreadyLogged = state.tunerLogs.some((l) => l.channelId === lockedChannel.id);
  if (alreadyLogged) {
    return {
      ...state,
      neutralNotice: `${lockedChannel.frequencyMhz.toFixed(1)} MHz (${lockedChannel.label}) already logged.`,
      neutralNoticeTimer: 2.2,
    };
  }

  const entry: TunerSignalLog = {
    id: `tuner-${state.tunerLogs.length + 1}-${Math.round(state.elapsedSec * 10)}`,
    channelId: lockedChannel.id,
    frequencyMhz: lockedChannel.frequencyMhz,
    label: lockedChannel.label,
    transcript: lockedChannel.transcript,
    stopNumber: stop.number,
    stopName: stop.name,
    lineId: state.lineId,
    timestampSec: state.elapsedSec,
  };

  return {
    ...state,
    tunerLogs: [entry, ...state.tunerLogs],
    neutralNotice: `Signal locked: ${lockedChannel.frequencyMhz.toFixed(1)} MHz · ${lockedChannel.label}`,
    neutralNoticeTimer: 2.8,
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
    caption: `Car B (${state.lineId}) · Stop ${stop.number} (${stop.name})`,
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
  // Tape resonance is noise, not signal: derive it only from the clip's own
  // identity (stop, timestamp, tape count), never from whether an anomaly is
  // actually active — otherwise a recording would confirm one and give the
  // answer away. Roughly a third of tapes sound resonant either way.
  const tapeSeed = Math.round(state.elapsedSec * 10) + state.evpClips.length * 31 + stop.number * 7;
  const hasResonance = tapeSeed % 3 === 0;
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
 * Evaluates the final Travel Report using the 8 priority-ranked endings,
 * persists run stats & discoveries to the Archive, and unlocks Nightmare mode.
 */
export function finalizeRide(state: GameState): GameState {
  const trueFlags = state.flagLog.filter((f) => f._wasTrueAnomaly).length;
  const falsePositives = state.flagLog.filter((f) => !f._wasTrueAnomaly).length;
  const band = getSuspicionBand(state.suspicion.value);
  const seq = getSequenceForDifficulty(state.difficulty, state.chapterId);
  const line = getLineDefinition(state.lineId);

  const evaluated = evaluateEnding({
    difficulty: state.difficulty,
    lineId: state.lineId,
    chapterId: state.chapterId,
    finalSuspicion: state.suspicion.value,
    finalSuspicionBand: band,
    finalSanity: state.sanity.value,
    finalSanityTier: state.sanity.tier,
    trueFlags,
    falsePositives,
    safeHavenChoice: state.safeHavenChoice,
    restraintOutcome: state.restraintOutcome,
    falseStopDisembarks: state.falseStopDisembarks,
    falseStopTrialsSurvived: state.falseStopTrialsSurvived,
    falseStopTrialCollapsed: state.falseStopTrialCollapsed,
    photosTaken: state.photos.length,
    evpClipsRecorded: state.evpClips.length,
    tunerSignalsLocked: state.tunerLogs.length,
  });

  const achievements: string[] = [];
  if (state.difficulty !== 'practice') {
    if (!state.falseStopTrialCollapsed) {
      achievements.push(`Last Local (${line.id}): Reached ${line.terminusName}`);
    }
    if (state.suspicion.value <= 24 && !state.falseStopTrialCollapsed) {
      achievements.push('Poker Face: Finished in CALM');
    }
    if (state.safeHavenChoice === 'taken') achievements.push(`${line.safeHavenName} Shelter`);
    if (state.restraintOutcome === 'held_still') achievements.push('Still Hands Under Pressure');
    if (state.falseStopTrialsSurvived >= 1) achievements.push('Back Before the Chime: Survived False Stop Trial');
    if (state.photos.length >= 1) achievements.push('Instant Evidence (Polaroid)');
    if (state.evpClips.length >= 1) achievements.push('Static Listener (EVP)');
    if (state.tunerLogs.length >= 1) achievements.push('Transit Frequency Intercepted');
    if (state.difficulty === 'nightmare' && !state.falseStopTrialCollapsed) {
      achievements.push('Nightmare Express');
    }
  } else {
    achievements.push('First Token: Practice Complete');
  }

  const prevArchive = loadArchive();
  const wasUnlocked = prevArchive.nightmareUnlocked;
  const updatedArchive = recordRunInArchive(prevArchive, {
    lineId: state.lineId,
    chapterId: state.chapterId,
    difficulty: state.difficulty,
    endingId: evaluated.endingId,
    endingTitle: evaluated.title,
    finalSuspicion: state.suspicion.value,
    finalSanity: state.sanity.value,
    trueFlags,
    falsePositives,
    durationSec: Math.round(state.elapsedSec),
    highestStopReached: state.highestStopReached,
    tunerChannelIds: state.tunerLogs.map((t) => t.channelId),
    achievements,
  });
  saveArchive(updatedArchive);

  const nightmareJustUnlocked = !wasUnlocked && updatedArchive.nightmareUnlocked;

  const report: EndingReportData = {
    endingId: evaluated.endingId,
    priority: evaluated.priority,
    code: evaluated.code,
    tone: evaluated.tone,
    title: evaluated.title,
    subtitle: evaluated.subtitle,
    summary: evaluated.summary,
    lineId: state.lineId,
    chapterId: state.chapterId,
    difficulty: state.difficulty,
    finalSuspicion: state.suspicion.value,
    finalSuspicionBand: band,
    peakSuspicion: state.suspicion.peak,
    finalSanity: state.sanity.value,
    finalSanityTier: state.sanity.tier,
    stopsCompleted: state.falseStopTrialCollapsed ? state.sequencePos + 1 : seq.length,
    totalStops: seq.length,
    highestStopReached: state.highestStopReached,
    trueFlags,
    falsePositives,
    totalFlags: state.flagLog.length,
    safeHavenChoice: state.safeHavenChoice,
    restraintOutcome: state.restraintOutcome,
    falseStopDisembarks: state.falseStopDisembarks,
    falseStopTrialsSurvived: state.falseStopTrialsSurvived,
    falseStopTrialCollapsed: state.falseStopTrialCollapsed,
    photosTaken: state.photos.length,
    evpClipsRecorded: state.evpClips.length,
    tunerSignalsLocked: state.tunerLogs.length,
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
    activeTrial: null,
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
