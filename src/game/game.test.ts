import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTE_STOPS, getLedDisplayText } from './route';
import {
  applySuspicionChange,
  createInitialSuspicion,
  getSuspicionBand,
} from './suspicion';
import {
  advanceSanityForStop,
  createInitialSanity,
  getBreathingFov,
  getHeartbeatProfile,
  getPerStopSanityDrift,
  getSanityTier,
  getStopSanityBand,
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
  answerMaskPrompt,
  attemptStepOffAtStop,
  chooseSafeHaven,
  createInitialGameState,
  stepGameState,
  submitPlayerFlag,
} from './state';

test('Route has all 13 NYC G Train stops in exact order with special segments', () => {
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

  // Stop 4: Classon Av false stop (forgiving)
  assert.equal(ROUTE_STOPS[3].isFalseStop, true);
  assert.equal(ROUTE_STOPS[3].isForgivingFalseStop, true);
  assert.equal(ROUTE_STOPS[3].ledOverride, 'CLASS ON AV');

  // Stop 6: Myrtle-Willoughby Avs Safe Haven + blackout after
  assert.equal(ROUTE_STOPS[5].kind, 'safe_haven');
  assert.equal(ROUTE_STOPS[5].blackoutAfter, true);

  // Stop 9: Metropolitan Av false stop + lying PA line
  assert.equal(ROUTE_STOPS[8].isFalseStop, true);
  assert.equal(
    ROUTE_STOPS[8].lyingPaLine,
    'This is Court Square. Last stop. Everybody off the train.',
  );

  // Stop 11: Greenpoint Av restraint
  assert.equal(ROUTE_STOPS[10].kind, 'restraint');

  // Stop 12: 21 St forced bait
  assert.equal(ROUTE_STOPS[11].kind, 'forced_bait');

  // Stop 13: Court Sq final stop with brighter dot
  assert.equal(ROUTE_STOPS[12].kind, 'final');
  assert.equal(ROUTE_STOPS[12].brighterDot, true);
  assert.equal(getLedDisplayText(ROUTE_STOPS[3], 'dwelling'), 'CLASS ON AV');
  assert.equal(getLedDisplayText(ROUTE_STOPS[5], 'blackout'), '');
});

test('Suspicion bands and scoring deltas match specification exactly', () => {
  assert.equal(getSuspicionBand(0), 'CALM');
  assert.equal(getSuspicionBand(24), 'CALM');
  assert.equal(getSuspicionBand(25), 'UNEASY');
  assert.equal(getSuspicionBand(49), 'UNEASY');
  assert.equal(getSuspicionBand(50), 'WATCHED');
  assert.equal(getSuspicionBand(74), 'WATCHED');
  assert.equal(getSuspicionBand(75), 'HUNTED');
  assert.equal(getSuspicionBand(100), 'HUNTED');

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

  // Clamps cleanly to 100 and never throws
  s = applySuspicionChange(s, 'false_positive', 8);
  s = applySuspicionChange(s, 'false_positive', 8);
  s = applySuspicionChange(s, 'false_positive', 8);
  assert.equal(s.value, 100);
});

test('Sanity per-stop ceilings, drift schedule, tiers, heartbeat, and breathing FOV', () => {
  assert.deepEqual(getStopSanityBand(1), { min: 80, max: 100 });
  assert.deepEqual(getStopSanityBand(3), { min: 80, max: 100 });
  assert.deepEqual(getStopSanityBand(4), { min: 50, max: 95 });
  assert.deepEqual(getStopSanityBand(6), { min: 50, max: 95 });
  assert.deepEqual(getStopSanityBand(7), { min: 30, max: 70 });
  assert.deepEqual(getStopSanityBand(9), { min: 30, max: 70 });
  assert.deepEqual(getStopSanityBand(10), { min: 5, max: 30 });
  assert.deepEqual(getStopSanityBand(11), { min: 0, max: 9 });
  assert.deepEqual(getStopSanityBand(13), { min: 0, max: 9 });

  // Drift is -5 at stops 4, 5, 7, 10, 11 and 0 elsewhere
  for (let stop = 1; stop <= 13; stop++) {
    const expected = [4, 5, 7, 10, 11].includes(stop) ? -5 : 0;
    assert.equal(getPerStopSanityDrift(stop, false), expected);
  }

  let san = createInitialSanity();
  assert.equal(san.value, 100);
  assert.equal(getSanityTier(100), 'High');
  assert.equal(getSanityTier(55), 'Medium');
  assert.equal(getSanityTier(25), 'Low');
  assert.equal(getSanityTier(5), 'Critical');

  san = advanceSanityForStop(san, 4);
  assert.ok(san.value >= 50 && san.value <= 95);
  san = advanceSanityForStop(san, 7);
  assert.ok(san.value >= 30 && san.value <= 70);
  san = advanceSanityForStop(san, 10);
  assert.ok(san.value >= 5 && san.value <= 30);
  san = advanceSanityForStop(san, 11);
  assert.ok(san.value >= 0 && san.value <= 9);

  const hbHigh = getHeartbeatProfile(95, 1.0);
  const hbCrit = getHeartbeatProfile(5, 1.0);
  assert.ok(hbHigh.bpm >= 82 && hbHigh.bpm <= 118);
  assert.ok(hbCrit.bpm >= 82 && hbCrit.bpm <= 118);
  assert.ok(hbCrit.bpm > hbHigh.bpm);

  // Anxious breathing narrows FOV at lower sanity
  const fovHigh = getBreathingFov(64, 95, 1.0);
  const fovCrit = getBreathingFov(64, 5, 1.0);
  assert.ok(fovCrit < fovHigh);
});

test('Input controller enforces exact arrow speeds and zero look drift when paused', () => {
  const inp = createInitialInputState(1.0);
  const startYaw = inp.yaw;
  const startPitch = inp.pitch;

  // Arrow keys apply yaw 1.8 rad/s and pitch 1.2 rad/s
  handleKeyDown(inp, 'ArrowLeft', false);
  handleKeyDown(inp, 'ArrowUp', false);
  stepInput(inp, 0.05);
  assert.ok(Math.abs(inp.yaw - (startYaw + ARROW_YAW_RAD_PER_SEC * 0.05)) < 1e-6);
  assert.ok(Math.abs(inp.pitch - (startPitch + ARROW_PITCH_RAD_PER_SEC * 0.05)) < 1e-6);

  // Repeat keydown on P is ignored
  const repeatToggle = handleKeyDown(inp, 'KeyP', true);
  assert.equal(repeatToggle.pauseToggle, false);

  // Fresh P toggles pause and clears all held keys
  const freshToggle = handleKeyDown(inp, 'KeyP', false);
  assert.equal(freshToggle.pauseToggle, true);
  setInputPaused(inp, true);
  assert.equal(inp.heldKeys.size, 0);

  // Attempting mouse deltas and key presses while paused causes ZERO drift
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
  const trueEval = evaluatePlayerFlag(stop4Anomalies, 'led_sign');
  assert.equal(trueEval.matched, true);
  const falseEval = evaluatePlayerFlag(stop4Anomalies, 'umbrella_seat');
  assert.equal(falseEval.matched, false);
});

test('Full 13-stop ride progresses through blackout, Safe Haven, false stops, restraint, and reaches Court Sq Ending Report', () => {
  let state = createInitialGameState('standard', 'playing');
  const visitedStops = new Set<number>([1]);
  let sawBlackout = false;
  let sawRestraint = false;
  let sawLyingPa = false;

  // Step through entire ride deterministically
  for (let tick = 0; tick < 25000 && state.screen === 'playing'; tick++) {
    // Handle Safe Haven choice at stop 6
    if (state.safeHavenPromptOpen) {
      state = chooseSafeHaven(state, true);
    }

    // Handle active mask prompts calmly
    if (state.maskPrompt) {
      const calm = state.maskPrompt.question.options.find((o) => o.isCalm);
      if (calm) {
        state = answerMaskPrompt(state, calm.id);
      }
    }

    // Hold still during Greenpoint Av restraint
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
  assert.equal(state.endingReport?.safeHavenChoice, 'taken');
  assert.equal(state.endingReport?.restraintOutcome, 'held_still');

  // Verify false-positive flag adds +20 suspicion and stepping off at Metropolitan Av triggers false stop penalty
  let testState = createInitialGameState('standard', 'playing');
  testState = { ...testState, stopIndex: 8, sequencePos: 8, phase: 'dwelling' };
  const afterFalseFlag = submitPlayerFlag(testState, 'umbrella_seat');
  assert.equal(afterFalseFlag.suspicion.value, 20);
  const afterFalseExit = attemptStepOffAtStop(testState);
  assert.equal(afterFalseExit.falseStopDisembarks, 1);
  assert.ok(afterFalseExit.suspicion.value > 0);
});
