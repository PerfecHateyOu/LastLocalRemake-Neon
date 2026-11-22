import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAPTERS,
  G_LINE_STOPS,
  L_LINE_STOPS,
  ROUTE_STOPS,
  SEVEN_LINE_STOPS,
  SUBWAY_LINES,
  getChapterDefinition,
  getLedDisplayText,
  getLineDefinition,
  getStopByIndex,
} from './route';
import {
  applySuspicionChange,
  createInitialSuspicion,
  getParentWatchProfile,
  getSuspicionBand,
} from './suspicion';
import {
  advanceSanityForStop,
  applySanityPenalty,
  createInitialSanity,
  getBreathingFov,
  getHeartbeatProfile,
  getPerStopSanityDrift,
  getSanityTier,
  getStopSanityBand,
  tickSanityEffects,
  triggerSanityGlitch,
} from './sanity';
import {
  ANOMALY_CATALOG,
  evaluatePlayerFlag,
  selectAnomaliesForStop,
} from './anomalies';
import {
  ARROW_PITCH_RAD_PER_SEC,
  ARROW_YAW_RAD_PER_SEC,
  addMouseLookDelta,
  createInitialInputState,
  handleKeyDown,
  setInputPaused,
  stepInput,
} from './input';
import {
  ENDING_CATALOG,
  EndingEvaluationInput,
  evaluateEnding,
} from './endings';
import {
  createTrialState,
  setTrialHolding,
  stepTrialState,
  submitTrialChoice,
} from './trial';
import {
  TUNER_CHANNELS,
  clampFrequency,
  evaluateTunerSignal,
  getActiveChannelsForContext,
} from './tuner';
import {
  PSYCH_CASE_TEMPLATES,
  buildPsychCaseLog,
} from './psychLog';
import {
  createEmptyArchive,
  deserializeArchive,
  recordRunInArchive,
  serializeArchive,
} from './archive';
import {
  addPolaroidPhoto,
  adjustTunerFrequency,
  answerMaskPrompt,
  answerTrialChoice,
  attemptStepOffAtStop,
  chooseSafeHaven,
  createInitialGameState,
  finishEvpRecording,
  lockTunerSignal,
  setTrialHoldState,
  stepGameState,
  submitPlayerFlag,
} from './state';

/* ============================================================================
 * 1. ROUTE, MULTI-LINE (G / L / 7), TIMINGS & CHAPTERS
 * ========================================================================== */

test('G Train has all 13 NYC stops in exact order with signature lying PA and special segments', () => {
  assert.equal(ROUTE_STOPS.length, 13);
  const expectedNames = [
    'Hoyt-Schermerhorn',
    'Fulton St',
    'Clinton-Washington Avs',
    'Classon Av',
    'Bedford-Nostrand Avs',
    'Myrtle-Willoughby Avs',
    'Flushing Av',
    'Broadway',
    'Metropolitan Av',
    'Nassau Av',
    'Greenpoint Av',
    '21 St',
    'Court Sq',
  ];
  assert.deepEqual(
    ROUTE_STOPS.map((s) => s.name),
    expectedNames,
  );

  // Stop 4: Classon Av forgiving false stop
  assert.equal(ROUTE_STOPS[3].isFalseStop, true);
  assert.equal(ROUTE_STOPS[3].isForgivingFalseStop, true);
  assert.equal(ROUTE_STOPS[3].ledOverride, 'CLASS ON AV');

  // Stop 6: Myrtle-Willoughby Avs Safe Haven + blackout after
  assert.equal(ROUTE_STOPS[5].kind, 'safe_haven');
  assert.equal(ROUTE_STOPS[5].blackoutAfter, true);

  // Stop 9: Metropolitan Av lying PA false stop
  assert.equal(ROUTE_STOPS[8].isFalseStop, true);
  assert.equal(ROUTE_STOPS[8].isForgivingFalseStop, false);
  assert.equal(
    ROUTE_STOPS[8].lyingPaLine,
    'This is Court Square. Last stop. Everybody off the train.',
  );

  // Stop 11 restraint, Stop 12 forced bait, Stop 13 brighter terminus
  assert.equal(ROUTE_STOPS[10].kind, 'restraint');
  assert.equal(ROUTE_STOPS[11].kind, 'forced_bait');
  assert.equal(ROUTE_STOPS[12].kind, 'final');
  assert.equal(ROUTE_STOPS[12].brighterDot, true);
});

test('L Train and 7 Train each define 13 calibrated stops with Safe Haven, Lying PA, Restraint, and Terminus', () => {
  for (const [id, stops] of [
    ['G', G_LINE_STOPS],
    ['L', L_LINE_STOPS],
    ['7', SEVEN_LINE_STOPS],
  ] as const) {
    assert.equal(stops.length, 13, `${id} should have 13 stops`);
    assert.equal(stops[0].kind, 'boarding');
    assert.equal(stops[3].isFalseStop, true);
    assert.equal(stops[3].isForgivingFalseStop, true);
    assert.equal(stops[5].kind, 'safe_haven');
    assert.equal(stops[5].blackoutAfter, true);
    assert.equal(stops[8].isFalseStop, true);
    assert.ok(stops[8].lyingPaLine && stops[8].lyingPaLine.includes('Last stop'));
    assert.equal(stops[10].kind, 'restraint');
    assert.equal(stops[11].kind, 'forced_bait');
    assert.equal(stops[12].kind, 'final');
    assert.equal(stops[12].brighterDot, true);
  }
  assert.equal(SUBWAY_LINES.L.terminusName, 'DeKalb Av');
  assert.equal(SUBWAY_LINES['7'].terminusName, 'Flushing-Main St');
});

test('Per-stop dwell and cruise timings are calibrated (no uniform placeholder dwell)', () => {
  const dwells = new Set(ROUTE_STOPS.map((s) => s.dwellSeconds));
  assert.ok(dwells.size >= 4, 'Stops should have distinct calibrated dwell durations');
  assert.equal(ROUTE_STOPS[0].dwellSeconds, 7);
  assert.equal(ROUTE_STOPS[5].dwellSeconds, 12); // Safe Haven extra decision window
  assert.equal(ROUTE_STOPS[8].dwellSeconds, 11); // Lying PA dwell tension
  assert.equal(ROUTE_STOPS[10].dwellSeconds, 10); // Restraint stop
  for (let i = 1; i < ROUTE_STOPS.length; i++) {
    assert.ok(ROUTE_STOPS[i].cruiseSeconds >= 16 && ROUTE_STOPS[i].cruiseSeconds <= 21);
  }
});

test('All 4 chapters partition the 13-stop ride cleanly without gaps or overlap', () => {
  assert.equal(CHAPTERS.length, 5); // full + ch1..ch4
  const full = getChapterDefinition('full');
  assert.equal(full.stopIndices.length, 13);

  const combined = [
    ...getChapterDefinition('ch1').stopIndices,
    ...getChapterDefinition('ch2').stopIndices,
    ...getChapterDefinition('ch3').stopIndices,
    ...getChapterDefinition('ch4').stopIndices,
  ];
  assert.deepEqual(combined, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('LED display text handles cruising, braking, dwelling, blackout, trial, and overrides', () => {
  assert.equal(getLedDisplayText(ROUTE_STOPS[3], 'dwelling'), 'CLASS ON AV');
  assert.equal(getLedDisplayText(ROUTE_STOPS[8], 'dwelling'), 'COURT SQ — LAST STOP');
  assert.equal(getLedDisplayText(ROUTE_STOPS[5], 'blackout'), '');
  assert.equal(getLedDisplayText(ROUTE_STOPS[3], 'trial'), 'CLASS ON AV');
  assert.equal(getLedDisplayText(ROUTE_STOPS[1], 'cruising'), 'NEXT STOP: FULTON ST');
  assert.equal(getLedDisplayText(ROUTE_STOPS[1], 'braking'), 'APPROACHING: FULTON ST');
});

test('getStopByIndex clamps out-of-range indices safely per line', () => {
  assert.equal(getStopByIndex(-5, 'L').name, '8 Av');
  assert.equal(getStopByIndex(99, '7').name, 'Flushing-Main St');
  assert.equal(getLineDefinition('7').color, '#b933ad');
});

/* ============================================================================
 * 2. SUSPICION SYSTEM
 * ========================================================================== */

test('Suspicion bands map exact 0-24, 25-49, 50-74, 75-100 ranges', () => {
  assert.equal(getSuspicionBand(0), 'CALM');
  assert.equal(getSuspicionBand(24), 'CALM');
  assert.equal(getSuspicionBand(25), 'UNEASY');
  assert.equal(getSuspicionBand(49), 'UNEASY');
  assert.equal(getSuspicionBand(50), 'WATCHED');
  assert.equal(getSuspicionBand(74), 'WATCHED');
  assert.equal(getSuspicionBand(75), 'HUNTED');
  assert.equal(getSuspicionBand(100), 'HUNTED');
});

test('Suspicion scoring deltas match specification and track peak', () => {
  let s = createInitialSuspicion();
  s = applySuspicionChange(s, 'false_positive', 2);
  assert.equal(s.value, 20);
  s = applySuspicionChange(s, 'failed_mask_prompt', 2);
  assert.equal(s.value, 35);
  s = applySuspicionChange(s, 'prompt_timeout', 3);
  assert.equal(s.value, 43);
  s = applySuspicionChange(s, 'visible_reaction', 3);
  assert.equal(s.value, 53);
  s = applySuspicionChange(s, 'refuse_safe_haven', 6);
  assert.equal(s.value, 63);
  s = applySuspicionChange(s, 'clean_stop', 7);
  assert.equal(s.value, 58);
  assert.equal(s.peak, 63);

  // Clamps cleanly at 100 and never throws
  s = applySuspicionChange(s, 'false_positive', 8);
  s = applySuspicionChange(s, 'false_positive', 8);
  s = applySuspicionChange(s, 'false_positive', 8);
  assert.equal(s.value, 100);
});

test('Practice mode halves positive suspicion penalties while keeping clean-stop relief', () => {
  let s = createInitialSuspicion();
  s = applySuspicionChange(s, 'false_positive', 2, true);
  assert.equal(s.value, 10);
  s = applySuspicionChange(s, 'clean_stop', 3, true);
  assert.equal(s.value, 5);
});

test('Parent watch profile escalates glance frequency and hold duration under HUNTED and Nightmare', () => {
  const calm = getParentWatchProfile(10, false);
  const hunted = getParentWatchProfile(85, false);
  const nightmareHunted = getParentWatchProfile(85, true);

  assert.ok(hunted.glanceIntervalSec < calm.glanceIntervalSec);
  assert.ok(hunted.holdLookSec > calm.holdLookSec);
  assert.ok(nightmareHunted.glanceIntervalSec < hunted.glanceIntervalSec);
  assert.ok(nightmareHunted.holdLookSec > hunted.holdLookSec);
});

/* ============================================================================
 * 3. SANITY SYSTEM
 * ========================================================================== */

test('Sanity per-stop bands tighten strictly from stops 1-3 down to 11-13', () => {
  assert.deepEqual(getStopSanityBand(1), { min: 80, max: 100 });
  assert.deepEqual(getStopSanityBand(3), { min: 80, max: 100 });
  assert.deepEqual(getStopSanityBand(4), { min: 50, max: 95 });
  assert.deepEqual(getStopSanityBand(6), { min: 50, max: 95 });
  assert.deepEqual(getStopSanityBand(7), { min: 30, max: 70 });
  assert.deepEqual(getStopSanityBand(9), { min: 30, max: 70 });
  assert.deepEqual(getStopSanityBand(10), { min: 5, max: 30 });
  assert.deepEqual(getStopSanityBand(11), { min: 0, max: 9 });
  assert.deepEqual(getStopSanityBand(13), { min: 0, max: 9 });
});

test('Per-stop sanity drift is -5 at stops 4, 5, 7, 10, 11 and 0 elsewhere', () => {
  for (let stop = 1; stop <= 13; stop++) {
    const expected = [4, 5, 7, 10, 11].includes(stop) ? -5 : 0;
    assert.equal(getPerStopSanityDrift(stop, false), expected);
    const expectedNightmare = [4, 5, 7, 10, 11].includes(stop)
      ? -8
      : stop >= 3
        ? -2
        : 0;
    assert.equal(getPerStopSanityDrift(stop, true), expectedNightmare);
  }
});

test('Sanity penalties respect the per-stop band floor', () => {
  const fresh = createInitialSanity();
  const floored = applySanityPenalty({ ...fresh, value: 85 }, 20, 1);
  assert.equal(floored.value, 80);
  const midBand = applySanityPenalty({ ...fresh, value: 90 }, 20, 5);
  assert.equal(midBand.value, 70);
  const stop10Floor = applySanityPenalty({ ...fresh, value: 12 }, 20, 10);
  assert.equal(stop10Floor.value, 5);
});

test('Sanity tiers, heartbeat 82-118 BPM, and anxious breathing FOV respond properly', () => {
  assert.equal(getSanityTier(100), 'High');
  assert.equal(getSanityTier(55), 'Medium');
  assert.equal(getSanityTier(25), 'Low');
  assert.equal(getSanityTier(5), 'Critical');

  const hbHigh = getHeartbeatProfile(95, 1.0);
  const hbCrit = getHeartbeatProfile(5, 1.0);
  assert.ok(hbHigh.bpm >= 82 && hbHigh.bpm <= 118);
  assert.ok(hbCrit.bpm >= 82 && hbCrit.bpm <= 118);
  assert.ok(hbCrit.bpm > hbHigh.bpm);
  assert.ok(hbCrit.jitterAmount > hbHigh.jitterAmount);

  const fovHigh = getBreathingFov(64, 95, 1.0);
  const fovCrit = getBreathingFov(64, 5, 1.0);
  assert.ok(fovCrit < fovHigh);
});

test('Practice mode keeps sanity within safe High/Medium floor', () => {
  let san = createInitialSanity();
  san = advanceSanityForStop(san, 12, false, true);
  assert.ok(san.value >= 75);
});

test('Sanity glitch timers decay cleanly and trigger decoy glitches at random', () => {
  let san = triggerSanityGlitch(createInitialSanity(), 0.4, 0.8);
  assert.equal(san.glitchTimer, 0.4);
  san = tickSanityEffects(san, 0.5, () => 0.99);
  assert.equal(san.glitchTimer, 0);

  // Force decoy glitch expiration with rng below fireChance (0.14 for High tier)
  const primed = { ...san, decoyCooldown: 0.01 };
  const decoyed = tickSanityEffects(primed, 0.05, () => 0.05);
  assert.ok(decoyed.glitchTimer > 0);
});

/* ============================================================================
 * 4. 8 PRIORITY-RANKED ENDINGS & CONFLICT RESOLUTION
 * ========================================================================== */

function makeEndingInput(overrides: Partial<EndingEvaluationInput> = {}): EndingEvaluationInput {
  return {
    difficulty: 'standard',
    lineId: 'G',
    chapterId: 'full',
    finalSuspicion: 15,
    finalSuspicionBand: 'CALM',
    finalSanity: 6,
    finalSanityTier: 'Critical',
    trueFlags: 0,
    falsePositives: 0,
    safeHavenChoice: 'taken',
    restraintOutcome: 'held_still',
    falseStopDisembarks: 0,
    falseStopTrialsSurvived: 0,
    falseStopTrialCollapsed: false,
    photosTaken: 0,
    evpClipsRecorded: 0,
    tunerSignalsLocked: 0,
    ...overrides,
  };
}

test('Ending catalog defines 8 distinct priority-ranked endings (P1..P8)', () => {
  assert.equal(ENDING_CATALOG.length, 8);
  assert.deepEqual(
    ENDING_CATALOG.map((e) => e.priority),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(new Set(ENDING_CATALOG.map((e) => e.id)).size, 8);
});

test('Ending P1 (trial_collapsed) overrides every other condition including Nightmare and CALM', () => {
  const res = evaluateEnding(
    makeEndingInput({
      difficulty: 'nightmare',
      finalSuspicion: 0,
      falseStopTrialCollapsed: true,
      trueFlags: 5,
      photosTaken: 5,
    }),
  );
  assert.equal(res.endingId, 'trial_collapsed');
  assert.equal(res.priority, 1);
  assert.equal(res.code, 'END-01');
});

test('Ending P2 (nightmare_ghost) beats P3 (unseen_home) on flawless Nightmare clear', () => {
  const res = evaluateEnding(
    makeEndingInput({
      difficulty: 'nightmare',
      finalSuspicion: 18,
      falsePositives: 0,
      safeHavenChoice: 'taken',
      restraintOutcome: 'held_still',
      trueFlags: 2,
    }),
  );
  assert.equal(res.endingId, 'nightmare_ghost');
  assert.equal(res.priority, 2);
});

test('Ending P3 (unseen_home) triggers on CALM standard run with Shelter, Still Restraint, and >=1 true flag', () => {
  const res = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 20,
      safeHavenChoice: 'taken',
      restraintOutcome: 'held_still',
      trueFlags: 1,
      photosTaken: 4, // Even if Archivist eligible, P3 takes priority over P4
    }),
  );
  assert.equal(res.endingId, 'unseen_home');
  assert.equal(res.priority, 3);
});

test('Ending P4 (the_archivist) triggers with >=3 evidence items and >=2 true flags when suspicion < 50', () => {
  const res = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 35,
      finalSuspicionBand: 'UNEASY',
      trueFlags: 2,
      photosTaken: 1,
      evpClipsRecorded: 1,
      tunerSignalsLocked: 1,
    }),
  );
  assert.equal(res.endingId, 'the_archivist');
  assert.equal(res.priority, 4);
});

test('Ending P5 (hollow_passenger) triggers at Critical sanity <=2 with refused haven or failed restraint', () => {
  const res = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 42,
      finalSuspicionBand: 'UNEASY',
      finalSanity: 2,
      safeHavenChoice: 'refused',
    }),
  );
  assert.equal(res.endingId, 'hollow_passenger');
  assert.equal(res.priority, 5);
});

test('Ending P6 (past_the_last_stop) triggers at HUNTED suspicion >=75 or 2+ false stop exits', () => {
  const hunted = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 78,
      finalSuspicionBand: 'HUNTED',
    }),
  );
  assert.equal(hunted.endingId, 'past_the_last_stop');
  assert.equal(hunted.priority, 6);

  const doubleFalse = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 40,
      finalSuspicionBand: 'UNEASY',
      falseStopDisembarks: 2,
    }),
  );
  assert.equal(doubleFalse.endingId, 'past_the_last_stop');
});

test('Ending P7 (the_long_walk_up) triggers in WATCHED band, after Restraint slip, or surviving a False Stop Trial', () => {
  const watched = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 60,
      finalSuspicionBand: 'WATCHED',
    }),
  );
  assert.equal(watched.endingId, 'the_long_walk_up');
  assert.equal(watched.priority, 7);

  const trialSurvivor = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 30,
      finalSuspicionBand: 'UNEASY',
      falseStopDisembarks: 1,
      falseStopTrialsSurvived: 1,
    }),
  );
  assert.equal(trialSurvivor.endingId, 'the_long_walk_up');
});

test('Ending P8 (quiet_arrival) serves as clean default arrival when higher-priority criteria are unmet', () => {
  const res = evaluateEnding(
    makeEndingInput({
      finalSuspicion: 30,
      finalSuspicionBand: 'UNEASY',
      finalSanity: 7,
      trueFlags: 0,
      safeHavenChoice: 'taken',
      restraintOutcome: 'held_still',
    }),
  );
  assert.equal(res.endingId, 'quiet_arrival');
  assert.equal(res.priority, 8);
});

test('Practice mode evaluates to practice_complete unless player collapses a trial', () => {
  const practice = evaluateEnding(makeEndingInput({ difficulty: 'practice' }));
  assert.equal(practice.endingId, 'practice_complete');
  assert.equal(practice.code, 'PRAC');
});

/* ============================================================================
 * 5. 3-STAGE FALSE STOP TRIAL
 * ========================================================================== */

test('Stepping off at Stop 4 (Classon Av) or Stop 9 (Metropolitan Av) launches a real 3-stage Trial', () => {
  const base = createInitialGameState('standard', 'playing', 'G', 'full');

  const stop4 = attemptStepOffAtStop({ ...base, stopIndex: 3, sequencePos: 3, phase: 'dwelling' });
  assert.equal(stop4.phase, 'trial');
  assert.ok(stop4.activeTrial !== null);
  assert.equal(stop4.activeTrial?.stage, 1);
  assert.equal(stop4.activeTrial?.maxStrikes, 3); // Forgiving Stop 4

  const stop9 = attemptStepOffAtStop({ ...base, stopIndex: 8, sequencePos: 8, phase: 'dwelling' });
  assert.equal(stop9.phase, 'trial');
  assert.equal(stop9.activeTrial?.maxStrikes, 2); // Strict Stop 9 (Lying PA)
});

test('Cleanly passing all 3 Trial stages returns the player to Car B with falseStopTrialsSurvived incremented', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'full');
  state = { ...state, stopIndex: 8, sequencePos: 8, phase: 'dwelling' };
  state = attemptStepOffAtStop(state);
  assert.equal(state.phase, 'trial');
  assert.equal(state.activeTrial?.stage, 1);

  // Stage 1: choose safe count option
  state = answerTrialChoice(state, 's1_count');
  assert.equal(state.phase, 'trial');
  assert.equal(state.activeTrial?.stage, 2);
  assert.equal(state.activeTrial?.strikes, 0);

  // Stage 2: hold still without moving camera until holdProgress reaches 1
  state = setTrialHoldState(state, true);
  for (let i = 0; i < 80 && state.activeTrial?.stage === 2; i++) {
    state = stepGameState(state, 0.05, {
      lookingAtAnomalyTarget: null,
      angularSpeedRadPerSec: 0,
      restraintMoved: false,
      rng: () => 0.5,
    });
  }
  assert.equal(state.activeTrial?.stage, 3);

  // Stage 3: composed re-entry
  state = answerTrialChoice(state, 's3_composed');
  assert.equal(state.phase, 'dwelling');
  assert.equal(state.activeTrial, null);
  assert.equal(state.falseStopTrialsSurvived, 1);
  assert.equal(state.falseStopTrialCollapsed, false);
});

test('Accumulating maxStrikes on Stop 9 collapses the Trial directly into END-01 (Left on the Blank Platform)', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'full');
  state = { ...state, stopIndex: 8, sequencePos: 8, phase: 'dwelling' };
  state = attemptStepOffAtStop(state);
  assert.equal(state.activeTrial?.maxStrikes, 2);

  // Strike 1 in Stage 1
  state = answerTrialChoice(state, 's1_shout');
  assert.equal(state.phase, 'trial');
  assert.equal(state.activeTrial?.stage, 2);
  assert.equal(state.activeTrial?.strikes, 1);

  // Strike 2 in Stage 2 via camera movement slip -> collapses immediately!
  state = stepGameState(state, 0.05, {
    lookingAtAnomalyTarget: null,
    angularSpeedRadPerSec: 2,
    restraintMoved: true,
    rng: () => 0.5,
  });

  assert.equal(state.screen, 'ending');
  assert.equal(state.falseStopTrialCollapsed, true);
  assert.equal(state.endingReport?.endingId, 'trial_collapsed');
  assert.equal(state.endingReport?.code, 'END-01');
});

test('Choosing the fatal freeze option in Stage 3 collapses the Trial immediately even with 0 strikes', () => {
  const stop = ROUTE_STOPS[8];
  let trial = createTrialState(stop, 'G');
  trial = submitTrialChoice(trial, 's1_count', stop);
  assert.equal(trial.stage, 2);
  trial = setTrialHolding(trial, true);
  for (let i = 0; i < 80 && trial.stage === 2; i++) {
    trial = stepTrialState(trial, 0.05, stop, false);
  }
  assert.equal(trial.stage, 3);
  trial = submitTrialChoice(trial, 's3_freeze', stop);
  assert.equal(trial.status, 'collapsed');
  assert.equal(trial.active, false);
});

test('Trial Stage 1 timeout awards 1 strike and advances to Stage 2 if below maxStrikes', () => {
  const stop = ROUTE_STOPS[3]; // Forgiving Stop 4 (maxStrikes = 3)
  let trial = createTrialState(stop, 'G');
  for (let i = 0; i < 300 && trial.stage === 1; i++) {
    trial = stepTrialState(trial, 0.05, stop, false);
  }
  assert.equal(trial.stage, 2);
  assert.equal(trial.strikes, 1);
  assert.equal(trial.status, 'in_progress');
});

test('Forgiving Stop 4 survives 2 strikes across stages whereas strict Stop 9 collapses on 2nd strike', () => {
  const stop4 = ROUTE_STOPS[3];
  let t4 = createTrialState(stop4, 'G');
  t4 = submitTrialChoice(t4, 's1_shout', stop4); // 1 strike
  t4 = stepTrialState(t4, 0.05, stop4, true); // 2nd strike on Stage 2 slip
  assert.equal(t4.status, 'in_progress');
  assert.equal(t4.strikes, 2);

  const stop9 = ROUTE_STOPS[8];
  let t9 = createTrialState(stop9, 'G');
  t9 = submitTrialChoice(t9, 's1_shout', stop9); // 1 strike
  t9 = stepTrialState(t9, 0.05, stop9, true); // 2nd strike -> collapse
  assert.equal(t9.status, 'collapsed');
});

test('Stepping off at a normal intermediate stop does NOT trigger a False Stop Trial', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'full');
  state = { ...state, stopIndex: 1, sequencePos: 1, phase: 'dwelling' }; // Fulton St (real stop)
  const after = attemptStepOffAtStop(state);
  assert.equal(after.phase, 'dwelling');
  assert.equal(after.activeTrial, null);
  assert.equal(after.falseStopDisembarks, 0);
});

/* ============================================================================
 * 6. RADIO / PA FREQUENCY TUNER
 * ========================================================================== */

test('Radio Tuner clamps 88.0-108.0 MHz and locks channels accurately within +/-0.2 MHz', () => {
  assert.equal(clampFrequency(80.0), 88.0);
  assert.equal(clampFrequency(115.2), 108.0);
  assert.equal(clampFrequency(89.34), 89.3);

  const exact = evaluateTunerSignal(89.3, 'G', 2);
  assert.equal(exact.strength, 1);
  assert.equal(exact.lockedChannel?.id, 'ch_dispatch_g');

  const offFreq = evaluateTunerSignal(90.9, 'G', 2);
  assert.equal(offFreq.lockedChannel, null);
  assert.ok(offFreq.strength < 0.25);
});

test('Radio Tuner scopes line-specific dispatch frequencies to G, L, and 7 separately', () => {
  const gChannels = getActiveChannelsForContext('G', 2).map((c) => c.id);
  const lChannels = getActiveChannelsForContext('L', 2).map((c) => c.id);
  const sevenChannels = getActiveChannelsForContext('7', 2).map((c) => c.id);

  assert.ok(gChannels.includes('ch_dispatch_g') && !gChannels.includes('ch_dispatch_l'));
  assert.ok(lChannels.includes('ch_dispatch_l') && !lChannels.includes('ch_dispatch_7'));
  assert.ok(sevenChannels.includes('ch_dispatch_7') && !sevenChannels.includes('ch_dispatch_g'));
  assert.ok(TUNER_CHANNELS.length >= 7);
});

test('Locking a Radio Tuner signal logs it once without deduplication leaks or revealing anomalies', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'full');
  state = adjustTunerFrequency(state, 89.3);
  state = lockTunerSignal(state);
  assert.equal(state.tunerLogs.length, 1);
  assert.equal(state.tunerLogs[0].channelId, 'ch_dispatch_g');

  // Locking same frequency again does not duplicate
  const again = lockTunerSignal(state);
  assert.equal(again.tunerLogs.length, 1);

  // Locking with an active anomaly yields identical channel transcript (non-leaking)
  const withAnomaly = lockTunerSignal(
    adjustTunerFrequency(
      {
        ...createInitialGameState('standard', 'playing', 'G', 'full'),
        activeAnomalies: [
          {
            definition: ANOMALY_CATALOG.poster_changed,
            stopNumber: 1,
            spawnedAtSec: 1,
            flaggedByPlayer: false,
          },
        ],
      },
      89.3,
    ),
  );
  assert.equal(withAnomaly.tunerLogs[0].transcript, state.tunerLogs[0].transcript);
});

/* ============================================================================
 * 7. 13-CASE PSYCHOLOGICAL LOG
 * ========================================================================== */

test('13-Case Psychological Log defines CASE 01 through CASE 13 in strict order', () => {
  assert.equal(PSYCH_CASE_TEMPLATES.length, 13);
  assert.equal(PSYCH_CASE_TEMPLATES[0].code, 'CASE 01');
  assert.equal(PSYCH_CASE_TEMPLATES[12].code, 'CASE 13');
});

test('buildPsychCaseLog classifies unvisited, observed, flagged, and incident cases accurately', () => {
  const cases = buildPsychCaseLog({
    lineId: 'G',
    highestStopReached: 6,
    flagLog: [
      {
        id: 'f1',
        stopNumber: 3,
        stopName: 'Clinton-Washington Avs',
        targetId: 'poster_right',
        targetLabel: 'Wall Ad Poster',
        timestampSec: 40,
        note: 'Observed',
        _wasTrueAnomaly: true,
      },
    ],
    safeHavenChoice: 'refused',
    restraintOutcome: 'not_reached',
    falseStopIncidentStops: [4],
  });

  assert.equal(cases.length, 13);
  assert.equal(cases[0].status, 'observed'); // Stop 1
  assert.equal(cases[2].status, 'flagged'); // Stop 3
  assert.equal(cases[3].status, 'incident'); // Stop 4 false stop incident
  assert.equal(cases[5].status, 'incident'); // Stop 6 refused Safe Haven
  assert.equal(cases[6].status, 'unvisited'); // Stop 7 not yet reached
});

test('13-Case Psychological Log adapts station names to L and 7 lines', () => {
  const lCases = buildPsychCaseLog({
    lineId: 'L',
    highestStopReached: 13,
    flagLog: [],
    safeHavenChoice: 'taken',
    restraintOutcome: 'held_still',
    falseStopIncidentStops: [],
  });
  assert.equal(lCases[0].stopName, '8 Av');
  assert.equal(lCases[5].stopName, 'Bedford Av');
  assert.equal(lCases[12].stopName, 'DeKalb Av');
});

/* ============================================================================
 * 8. PERSISTENT ARCHIVE
 * ========================================================================== */

test('Persistent Archive serializes, deserializes, and recovers cleanly from invalid JSON', () => {
  const empty = createEmptyArchive();
  const serialized = serializeArchive(empty);
  assert.deepEqual(deserializeArchive(serialized), empty);
  assert.deepEqual(deserializeArchive('{corrupted-json'), empty);
  assert.deepEqual(deserializeArchive(null), empty);
});

test('recordRunInArchive tracks discovered endings (X/8), 13 psych cases, G/L/7 lines, best suspicion, and Nightmare unlock', () => {
  let arch = createEmptyArchive();

  arch = recordRunInArchive(arch, {
    lineId: 'G',
    chapterId: 'full',
    difficulty: 'standard',
    endingId: 'unseen_home',
    endingTitle: 'Unseen All the Way Home',
    finalSuspicion: 18,
    finalSanity: 5,
    trueFlags: 3,
    falsePositives: 0,
    durationSec: 310,
    highestStopReached: 13,
    tunerChannelIds: ['ch_dispatch_g', 'ch_phantom_pa'],
    achievements: ['Last Local (G): Reached Court Sq'],
    nowIso: '2026-11-21T01:00:00.000Z',
  });

  assert.deepEqual(arch.discoveredEndings, ['unseen_home']);
  assert.equal(arch.observedCases.length, 13);
  assert.deepEqual(arch.completedLines, ['G']);
  assert.equal(arch.bestSuspicionByLine.G, 18);
  assert.equal(arch.nightmareUnlocked, true);
  assert.equal(arch.totalRidesCompleted, 1);

  // Second run on G with lower suspicion updates bestSuspicionByLine without duplicating line/ending
  arch = recordRunInArchive(arch, {
    lineId: 'G',
    chapterId: 'full',
    difficulty: 'nightmare',
    endingId: 'nightmare_ghost',
    endingTitle: 'Ghost on the Local',
    finalSuspicion: 10,
    finalSanity: 4,
    trueFlags: 4,
    falsePositives: 0,
    durationSec: 250,
    highestStopReached: 13,
    tunerChannelIds: ['ch_dispatch_g'],
    achievements: ['Nightmare Express'],
    nowIso: '2026-11-21T02:00:00.000Z',
  });

  assert.equal(arch.discoveredEndings.length, 2);
  assert.equal(arch.completedLines.length, 1);
  assert.equal(arch.bestSuspicionByLine.G, 10);
  assert.equal(arch.runHistory.length, 2);
});

test('Collapsed trial run records END-01 in Archive without marking the line as cleared or unlocking Nightmare', () => {
  const arch = recordRunInArchive(createEmptyArchive(), {
    lineId: 'L',
    chapterId: 'full',
    difficulty: 'standard',
    endingId: 'trial_collapsed',
    endingTitle: 'Left on the Blank Platform',
    finalSuspicion: 55,
    finalSanity: 40,
    trueFlags: 1,
    falsePositives: 0,
    durationSec: 180,
    highestStopReached: 9,
    tunerChannelIds: [],
    achievements: [],
  });

  assert.deepEqual(arch.discoveredEndings, ['trial_collapsed']);
  assert.equal(arch.completedLines.length, 0);
  assert.equal(arch.nightmareUnlocked, false);
  assert.equal(arch.observedCases.length, 9);
});

/* ============================================================================
 * 9. INPUT, ANOMALIES, EVP NON-LEAK, POLAROID & FULL RIDE INTEGRATION
 * ========================================================================== */

test('Input controller enforces exact arrow speeds and zero look drift when paused', () => {
  const inp = createInitialInputState(1.0);
  const startYaw = inp.yaw;
  const startPitch = inp.pitch;

  handleKeyDown(inp, 'ArrowLeft', false);
  handleKeyDown(inp, 'ArrowUp', false);
  stepInput(inp, 0.05);
  assert.ok(Math.abs(inp.yaw - (startYaw + ARROW_YAW_RAD_PER_SEC * 0.05)) < 1e-6);
  assert.ok(Math.abs(inp.pitch - (startPitch + ARROW_PITCH_RAD_PER_SEC * 0.05)) < 1e-6);

  assert.equal(handleKeyDown(inp, 'KeyP', true).pauseToggle, false);
  assert.equal(handleKeyDown(inp, 'KeyP', false).pauseToggle, true);
  setInputPaused(inp, true);
  assert.equal(inp.heldKeys.size, 0);

  const pausedYaw = inp.yaw;
  const pausedPitch = inp.pitch;
  addMouseLookDelta(inp, 400, -300);
  handleKeyDown(inp, 'ArrowRight', false);
  stepInput(inp, 0.05);
  stepInput(inp, 0.05);
  assert.equal(inp.yaw, pausedYaw);
  assert.equal(inp.pitch, pausedPitch);
});

test('Anomalies catalog includes required entries and evaluates flags accurately', () => {
  assert.ok(ANOMALY_CATALOG.poster_changed);
  assert.ok(ANOMALY_CATALOG.map_stop_moved);
  assert.ok(ANOMALY_CATALOG.extra_passenger);
  assert.ok(ANOMALY_CATALOG.parent_face_frozen);

  const stop4Anomalies = selectAnomaliesForStop(4, 30, false, () => 0.3);
  assert.ok(stop4Anomalies.length >= 1);
  assert.equal(evaluatePlayerFlag(stop4Anomalies, 'led_sign').matched, true);
  assert.equal(evaluatePlayerFlag(stop4Anomalies, 'umbrella_seat').matched, false);
});

test('EVP clips never reveal whether an anomaly was active', () => {
  const base = createInitialGameState('standard', 'playing');
  const recording = { ...base, evpRecordingActive: true, evpRecordElapsed: 4, elapsedSec: 123.4 };
  const quietClip = finishEvpRecording(recording).evpClips[0];
  const hauntedClip = finishEvpRecording({
    ...recording,
    activeAnomalies: [
      {
        definition: ANOMALY_CATALOG.poster_changed,
        stopNumber: 1,
        spawnedAtSec: 100,
        flaggedByPlayer: false,
      },
    ],
  }).evpClips[0];
  assert.equal(hauntedClip.hasAnomalyResonance, quietClip.hasAnomalyResonance);
  assert.equal(hauntedClip.transcriptHint, quietClip.transcriptHint);
});

test('Polaroid photo capture stamps active line and stop caption cleanly', () => {
  const base = createInitialGameState('standard', 'playing', '7', 'full');
  const after = addPolaroidPhoto(base, 'data:image/jpeg;base64,test');
  assert.equal(after.photos.length, 1);
  assert.ok(after.photos[0].caption.includes('(7)'));
  assert.ok(after.photos[0].caption.includes('34 St-Hudson Yards'));
});

test('Full 13-stop G Train ride progresses through Blackout, Safe Haven, Lying PA, Restraint, and evaluates real priority Ending', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'full');
  const visitedStops = new Set<number>([1]);
  let sawBlackout = false;
  let sawRestraint = false;
  let sawLyingPa = false;
  let loggedOneTrueFlag = false;

  for (let tick = 0; tick < 25000 && state.screen === 'playing'; tick++) {
    if (state.safeHavenPromptOpen) {
      state = chooseSafeHaven(state, true);
    }

    if (state.maskPrompt) {
      const calm = state.maskPrompt.question.options.find((o) => o.isCalm);
      if (calm) {
        state = answerMaskPrompt(state, calm.id);
      }
    }

    if (!loggedOneTrueFlag && state.activeAnomalies.length > 0) {
      state = submitPlayerFlag(state, state.activeAnomalies[0].definition.targetId);
      loggedOneTrueFlag = true;
    }

    if (state.phase === 'restraint') {
      sawRestraint = true;
      state = { ...state, restraintHolding: true };
    }

    if (state.phase === 'blackout') {
      sawBlackout = true;
    }

    if (
      state.paFeed.some(
        (p) => p.text === 'This is Court Square. Last stop. Everybody off the train.',
      )
    ) {
      sawLyingPa = true;
    }

    state = stepGameState(state, 0.05, {
      lookingAtAnomalyTarget: null,
      angularSpeedRadPerSec: 0,
      restraintMoved: false,
      rng: () => 0.5,
    });
    visitedStops.add(state.stopIndex + 1);
  }

  assert.equal(state.screen, 'ending');
  assert.ok(state.endingReport !== null);
  assert.equal(visitedStops.size, 13);
  assert.equal(sawBlackout, true);
  assert.equal(sawRestraint, true);
  assert.equal(sawLyingPa, true);
  assert.equal(state.endingReport?.endingId, 'unseen_home');
  assert.equal(state.endingReport?.code, 'END-03');
  assert.equal(state.endingReport?.priority, 3);
  assert.equal(state.endingReport?.safeHavenChoice, 'taken');
  assert.equal(state.endingReport?.restraintOutcome, 'held_still');
});

test('Chapter III starts at Stop 8 (Broadway), plays the Lying PA at Stop 9, and completes at Stop 10', () => {
  let state = createInitialGameState('standard', 'playing', 'G', 'ch3');
  assert.equal(state.stopIndex, 7); // Broadway (Stop 8)
  let sawLyingPa = false;

  for (let tick = 0; tick < 8000 && state.screen === 'playing'; tick++) {
    if (state.maskPrompt) {
      const calm = state.maskPrompt.question.options.find((o) => o.isCalm);
      if (calm) state = answerMaskPrompt(state, calm.id);
    }
    if (
      state.paFeed.some(
        (p) => p.text === 'This is Court Square. Last stop. Everybody off the train.',
      )
    ) {
      sawLyingPa = true;
    }
    state = stepGameState(state, 0.05, {
      lookingAtAnomalyTarget: null,
      angularSpeedRadPerSec: 0,
      restraintMoved: false,
      rng: () => 0.5,
    });
  }

  assert.equal(sawLyingPa, true);
  assert.equal(state.screen, 'ending');
  assert.equal(state.endingReport?.chapterId, 'ch3');
});

test('Full 13-stop L Train and 7 Train rides complete with line-specific Lying PA announcements', () => {
  for (const [lineId, expectedLyingPa] of [
    ['L', 'This is Canarsie-Rockaway Pkwy. Last stop. Everybody off the train.'],
    ['7', 'This is Flushing-Main St. Last stop. Everybody off the train.'],
  ] as const) {
    let state = createInitialGameState('standard', 'playing', lineId, 'full');
    let sawLyingPa = false;

    for (let tick = 0; tick < 25000 && state.screen === 'playing'; tick++) {
      if (state.safeHavenPromptOpen) state = chooseSafeHaven(state, true);
      if (state.maskPrompt) {
        const calm = state.maskPrompt.question.options.find((o) => o.isCalm);
        if (calm) state = answerMaskPrompt(state, calm.id);
      }
      if (state.phase === 'restraint') {
        state = { ...state, restraintHolding: true };
      }
      if (state.paFeed.some((p) => p.text === expectedLyingPa)) {
        sawLyingPa = true;
      }
      state = stepGameState(state, 0.05, {
        lookingAtAnomalyTarget: null,
        angularSpeedRadPerSec: 0,
        restraintMoved: false,
        rng: () => 0.5,
      });
    }

    assert.equal(sawLyingPa, true, `${lineId} line should trigger its lying PA`);
    assert.equal(state.screen, 'ending');
    assert.equal(state.endingReport?.lineId, lineId);
  }
});
