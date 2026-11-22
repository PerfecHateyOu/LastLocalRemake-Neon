/**
 * 3-Stage False Stop Trial State Machine — Last Local
 * Triggered whenever the player steps off the train at a false stop
 * (Stop 4 forgiving false stop or Stop 9 lying-PA false stop).
 *
 * Stage 1: Platform Orientation — Identify the tell on the blank platform (timed 3-choice).
 * Stage 2: The Voice on the Platform — Hold still without reacting for 3.2s while a voice calls.
 * Stage 3: Closing Doors Re-entry — Slip cleanly back into Car B before the doors seal.
 *
 * Surviving all 3 stages returns the player to Car B with scaled penalties.
 * Accumulating >= maxStrikes collapses the trial and ends the ride (END-01: Left on the Blank Platform).
 */

import { RouteStop, SubwayLineId, getLineDefinition } from './route';

export type TrialStageNumber = 1 | 2 | 3;

export interface TrialChoice {
  id: string;
  text: string;
  isSafe: boolean;
  /** Some panicked actions in Stage 3 cost 2 strikes (immediate collapse) */
  fatal?: boolean;
}

export interface TrialState {
  active: boolean;
  status: 'in_progress' | 'survived' | 'collapsed';
  lineId: SubwayLineId;
  stopNumber: number;
  stopName: string;
  isForgiving: boolean;
  stage: TrialStageNumber;
  strikes: number;
  maxStrikes: number;
  stageTimer: number;
  stageDuration: number;
  /** Stage 2 hold-still state */
  holdingStill: boolean;
  holdProgress: number; // 0..1
  holdSlipFrames: number;
  /** Current prompt copy & choices (Stages 1 & 3) */
  headline: string;
  prompt: string;
  choices: TrialChoice[];
  lastFeedback: string | null;
}

function buildStage1Content(stop: RouteStop, lineId: SubwayLineId): {
  headline: string;
  prompt: string;
  choices: TrialChoice[];
  duration: number;
} {
  const line = getLineDefinition(lineId);
  const wrongSign = stop.ledOverride ?? stop.name.toUpperCase();
  return {
    headline: 'Stage 1 of 3 · Blank Platform',
    prompt: `The mosaic tiles are blank white plaster. Above the closed stairwell the sign reads "${wrongSign}". Keep your head clear — how do you verify this stop isn’t ${line.terminusName}?`,
    duration: stop.isForgivingFalseStop ? 13 : 10,
    choices: [
      {
        id: 's1_count',
        text: `Count the stations from ${line.stops[0].name} — this is Stop ${stop.number}, not ${line.terminusName}.`,
        isSafe: true,
      },
      {
        id: 's1_shout',
        text: 'Shout down the empty platform to ask if anyone else got off.',
        isSafe: false,
      },
      {
        id: 's1_walk_stairs',
        text: 'Walk toward the darkened turnstiles to check the street sign.',
        isSafe: false,
      },
    ],
  };
}

function buildStage2Content(stop: RouteStop): {
  headline: string;
  prompt: string;
  duration: number;
} {
  return {
    headline: 'Stage 2 of 3 · The Voice on the Stairs',
    prompt:
      'Someone with Mom’s voice calls your name from the unlit stairwell behind you. Hold [SPACE] (or hold the button below) and do not turn around until the echo stops.',
    duration: stop.isForgivingFalseStop ? 10 : 8.5,
  };
}

function buildStage3Content(stop: RouteStop): {
  headline: string;
  prompt: string;
  choices: TrialChoice[];
  duration: number;
} {
  return {
    headline: 'Stage 3 of 3 · Closing Doors',
    prompt:
      'The Car B door chime sounds twice. Dad is looking straight down the aisle past the orange benches. How do you get back inside?',
    duration: stop.isForgivingFalseStop ? 11 : 9,
    choices: [
      {
        id: 's3_composed',
        text: 'Step smoothly through the closing gap, eyes forward, and sit without explaining.',
        isSafe: true,
      },
      {
        id: 's3_apologize',
        text: 'Rush through yelling that the intercom lied about the last stop.',
        isSafe: false,
      },
      {
        id: 's3_freeze',
        text: 'Stay behind the yellow line and wait for the next local train.',
        isSafe: false,
        fatal: true,
      },
    ],
  };
}

export function createTrialState(stop: RouteStop, lineId: SubwayLineId): TrialState {
  const s1 = buildStage1Content(stop, lineId);
  return {
    active: true,
    status: 'in_progress',
    lineId,
    stopNumber: stop.number,
    stopName: stop.name,
    isForgiving: Boolean(stop.isForgivingFalseStop),
    stage: 1,
    strikes: 0,
    // Stop 4 (forgiving) grants 3 strikes before collapse; Stop 9 (lying PA) allows only 2
    maxStrikes: stop.isForgivingFalseStop ? 3 : 2,
    stageTimer: s1.duration,
    stageDuration: s1.duration,
    holdingStill: false,
    holdProgress: 0,
    holdSlipFrames: 0,
    headline: s1.headline,
    prompt: s1.prompt,
    choices: s1.choices,
    lastFeedback: null,
  };
}

function advanceToStage2(trial: TrialState, stop: RouteStop, feedback: string): TrialState {
  const s2 = buildStage2Content(stop);
  return {
    ...trial,
    stage: 2,
    stageTimer: s2.duration,
    stageDuration: s2.duration,
    holdingStill: false,
    holdProgress: 0,
    holdSlipFrames: 0,
    headline: s2.headline,
    prompt: s2.prompt,
    choices: [],
    lastFeedback: feedback,
  };
}

function advanceToStage3(trial: TrialState, stop: RouteStop, feedback: string): TrialState {
  const s3 = buildStage3Content(stop);
  return {
    ...trial,
    stage: 3,
    stageTimer: s3.duration,
    stageDuration: s3.duration,
    holdingStill: false,
    holdProgress: 1,
    headline: s3.headline,
    prompt: s3.prompt,
    choices: s3.choices,
    lastFeedback: feedback,
  };
}

function applyTrialStrike(
  trial: TrialState,
  stop: RouteStop,
  strikeCount: number,
  feedback: string,
  advanceOnSurvive: boolean,
): TrialState {
  const nextStrikes = trial.strikes + strikeCount;
  if (nextStrikes >= trial.maxStrikes) {
    return {
      ...trial,
      active: false,
      status: 'collapsed',
      strikes: nextStrikes,
      lastFeedback: feedback,
    };
  }

  const updated: TrialState = {
    ...trial,
    strikes: nextStrikes,
    lastFeedback: feedback,
  };

  if (!advanceOnSurvive) {
    return updated;
  }

  if (trial.stage === 1) {
    return advanceToStage2(updated, stop, feedback);
  }
  if (trial.stage === 2) {
    return advanceToStage3(updated, stop, feedback);
  }
  // Survived Stage 3 with strikes still below maxStrikes
  return {
    ...updated,
    active: false,
    status: 'survived',
  };
}

export function submitTrialChoice(
  trial: TrialState,
  choiceId: string,
  stop: RouteStop,
): TrialState {
  if (!trial.active || trial.status !== 'in_progress') return trial;
  if (trial.stage === 2) return trial; // Stage 2 is hold-still

  const chosen = trial.choices.find((c) => c.id === choiceId);
  if (!chosen) return trial;

  if (trial.stage === 1) {
    if (chosen.isSafe) {
      return advanceToStage2(
        trial,
        stop,
        'You kept your voice down and verified the stop count.',
      );
    }
    return applyTrialStrike(
      trial,
      stop,
      1,
      'Your footsteps echoed too loud across the blank tile.',
      true,
    );
  }

  // Stage 3
  if (chosen.isSafe) {
    return {
      ...trial,
      active: false,
      status: 'survived',
      lastFeedback: 'You slipped back inside Car B before the doors sealed.',
    };
  }

  if (chosen.fatal) {
    return {
      ...trial,
      active: false,
      status: 'collapsed',
      strikes: trial.maxStrikes,
      lastFeedback: 'The doors sealed shut. There is no next train on this track.',
    };
  }

  return applyTrialStrike(
    trial,
    stop,
    1,
    'You scrambled inside as the doors pinched shut. Dad saw everything.',
    true,
  );
}

export function setTrialHolding(trial: TrialState, holding: boolean): TrialState {
  if (!trial.active || trial.stage !== 2) return trial;
  return {
    ...trial,
    holdingStill: holding,
  };
}

export function stepTrialState(
  trial: TrialState,
  dt: number,
  stop: RouteStop,
  movedCamera: boolean,
): TrialState {
  if (!trial.active || trial.status !== 'in_progress' || dt <= 0) return trial;
  const clampedDt = Math.min(dt, 0.05);

  if (trial.stage === 2) {
    let nextHold = trial.holdProgress;
    let nextSlips = trial.holdSlipFrames;
    let nextStrikes = trial.strikes;
    let feedback = trial.lastFeedback;

    if (trial.holdingStill && !movedCamera) {
      nextHold = Math.min(1, nextHold + clampedDt / 3.2);
    } else if (movedCamera) {
      nextHold = Math.max(0, nextHold - clampedDt * 0.35);
      nextSlips += 1;
      if (nextSlips % 18 === 1) {
        nextStrikes += 1;
        feedback = 'You flinched toward the stairwell voice.';
        if (nextStrikes >= trial.maxStrikes) {
          return {
            ...trial,
            active: false,
            status: 'collapsed',
            strikes: nextStrikes,
            holdProgress: nextHold,
            holdSlipFrames: nextSlips,
            lastFeedback: feedback,
          };
        }
      }
    } else {
      nextHold = Math.max(0, nextHold - clampedDt * 0.14);
    }

    if (nextHold >= 1) {
      return advanceToStage3(
        {
          ...trial,
          strikes: nextStrikes,
          holdProgress: 1,
          holdSlipFrames: nextSlips,
        },
        stop,
        'The voice stopped calling. The train chime rings behind you.',
      );
    }

    const nextTimer = trial.stageTimer - clampedDt;
    if (nextTimer <= 0) {
      return applyTrialStrike(
        {
          ...trial,
          strikes: nextStrikes,
          holdProgress: nextHold,
          holdSlipFrames: nextSlips,
          stageTimer: 0,
        },
        stop,
        1,
        'You hesitated too long on the platform.',
        true,
      );
    }

    return {
      ...trial,
      strikes: nextStrikes,
      holdProgress: nextHold,
      holdSlipFrames: nextSlips,
      stageTimer: nextTimer,
      lastFeedback: feedback,
    };
  }

  // Stage 1 or Stage 3 countdown
  const nextTimer = trial.stageTimer - clampedDt;
  if (nextTimer <= 0) {
    return applyTrialStrike(
      { ...trial, stageTimer: 0 },
      stop,
      1,
      trial.stage === 1
        ? 'You froze staring at the blank tile until the chime warned you.'
        : 'You froze at the threshold as the rubber door edge brushed your coat.',
      true,
    );
  }

  return {
    ...trial,
    stageTimer: nextTimer,
  };
}
