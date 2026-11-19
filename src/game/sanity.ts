/**
 * Sanity System (0–100)
 * Starts at 100 and drifts down across the 13-stop ride under tightening per-stop ceilings.
 * Four tiers: High, Medium, Low, Critical.
 * Drives heartbeat (82–118 bpm + jitter), anxious breathing FOV narrowing, and screen glitches.
 * Never reveals whether an anomaly flag was right or wrong.
 */

export type SanityTier = 'High' | 'Medium' | 'Low' | 'Critical';

export interface StopSanityBand {
  min: number;
  max: number;
}

export interface SanityState {
  value: number;
  tier: SanityTier;
  glitchTimer: number;
  glitchIntensity: number;
  decoyCooldown: number;
}

/** Stops where sanity drifts by -5 (all other stops drift by 0) */
export const SANITY_DRIFT_STOPS = new Set<number>([4, 5, 7, 10, 11]);

/**
 * Per-stop sanity bounds from the brief:
 * - Stops 1–3: 80–100
 * - Stops 4–6: 50–95
 * - Stops 7–9: 30–70
 * - Stop 10:   5–30
 * - Stops 11–13: 0–9
 */
export function getStopSanityBand(stopNumber: number): StopSanityBand {
  if (stopNumber <= 3) return { min: 80, max: 100 };
  if (stopNumber <= 6) return { min: 50, max: 95 };
  if (stopNumber <= 9) return { min: 30, max: 70 };
  if (stopNumber === 10) return { min: 5, max: 30 };
  return { min: 0, max: 9 };
}

export function getPerStopSanityDrift(stopNumber: number, nightmare = false): number {
  if (SANITY_DRIFT_STOPS.has(stopNumber)) {
    return nightmare ? -8 : -5;
  }
  return nightmare && stopNumber >= 3 ? -2 : 0;
}

export function getSanityTier(value: number): SanityTier {
  const v = Math.max(0, Math.min(100, value));
  if (v >= 70) return 'High';
  if (v >= 40) return 'Medium';
  if (v >= 15) return 'Low';
  return 'Critical';
}

export function createInitialSanity(): SanityState {
  return {
    value: 100,
    tier: 'High',
    glitchTimer: 0,
    glitchIntensity: 0,
    decoyCooldown: 14,
  };
}

/**
 * Applies stop transition drift and clamps sanity into the stop's ceiling/floor band.
 * Carefully holds the player's place inside the band on zero-drift stops unless the ceiling drops below current value.
 */
export function advanceSanityForStop(
  state: SanityState,
  stopNumber: number,
  nightmare = false,
  practiceMode = false,
): SanityState {
  if (practiceMode) {
    const practiceVal = Math.max(82, state.value - (stopNumber === 4 ? 4 : 0));
    return {
      ...state,
      value: practiceVal,
      tier: getSanityTier(practiceVal),
    };
  }

  const band = getStopSanityBand(stopNumber);
  const drift = getPerStopSanityDrift(stopNumber, nightmare);
  const drifted = state.value + drift;
  const clamped = Math.max(band.min, Math.min(band.max, Math.round(drifted)));

  return {
    ...state,
    value: clamped,
    tier: getSanityTier(clamped),
  };
}

export function applySanityPenalty(state: SanityState, amount: number, stopNumber: number): SanityState {
  const band = getStopSanityBand(stopNumber);
  const next = Math.max(Math.min(band.min, 0), Math.min(band.max, Math.round(state.value - Math.abs(amount))));
  // Keep within 0..ceiling
  const safeVal = Math.max(0, Math.min(band.max, next));
  return {
    ...state,
    value: safeVal,
    tier: getSanityTier(safeVal),
  };
}

/**
 * Heartbeat BPM by tier (82–118 bpm) with deterministic-friendly jitter parameter.
 */
export function getHeartbeatProfile(
  sanityValue: number,
  timeSec: number,
): {
  bpm: number;
  baseBpm: number;
  jitterAmount: number;
  tier: SanityTier;
} {
  const tier = getSanityTier(sanityValue);
  let baseBpm = 82;
  let jitterAmount = 1.5;

  switch (tier) {
    case 'High':
      baseBpm = 82 + ((100 - Math.max(70, sanityValue)) / 30) * 8; // 82..90
      jitterAmount = 1.5;
      break;
    case 'Medium':
      baseBpm = 90 + ((70 - Math.max(40, sanityValue)) / 30) * 10; // 90..100
      jitterAmount = 3.5;
      break;
    case 'Low':
      baseBpm = 100 + ((40 - Math.max(15, sanityValue)) / 25) * 10; // 100..110
      jitterAmount = 6.0;
      break;
    case 'Critical':
      baseBpm = 110 + ((15 - Math.max(0, sanityValue)) / 15) * 8; // 110..118
      jitterAmount = 9.0;
      break;
  }

  // Smooth organic jitter without jumping violently every millisecond
  const jitter =
    Math.sin(timeSec * 1.7) * jitterAmount * 0.6 +
    Math.sin(timeSec * 4.3) * jitterAmount * 0.4;
  const bpm = Math.max(82, Math.min(118, Math.round(baseBpm + jitter)));

  return { bpm, baseBpm, jitterAmount, tier };
}

/**
 * Anxious breathing slightly narrows the camera field of view as sanity falls.
 * Base FOV is 64 deg; narrows by up to ~6.5 deg in Critical tier with rhythmic breathing.
 */
export function getBreathingFov(baseFov: number, sanityValue: number, timeSec: number): number {
  const tier = getSanityTier(sanityValue);
  let breathRate = 0.25; // Hz
  let narrowBase = 0;
  let narrowAmp = 0.2;

  switch (tier) {
    case 'High':
      breathRate = 0.22;
      narrowBase = 0;
      narrowAmp = 0.15;
      break;
    case 'Medium':
      breathRate = 0.34;
      narrowBase = 1.2;
      narrowAmp = 0.45;
      break;
    case 'Low':
      breathRate = 0.48;
      narrowBase = 3.0;
      narrowAmp = 0.85;
      break;
    case 'Critical':
      breathRate = 0.66;
      narrowBase = 5.0;
      narrowAmp = 1.4;
      break;
  }

  const cycle = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2 * breathRate);
  return baseFov - (narrowBase + cycle * narrowAmp);
}

/**
 * Trigger a screen glitch (used when critical anomalies appear OR on random decoys).
 * Never correlates with flag correctness.
 */
export function triggerSanityGlitch(
  state: SanityState,
  durationSec: number,
  intensity: number,
): SanityState {
  return {
    ...state,
    glitchTimer: Math.max(state.glitchTimer, durationSec),
    glitchIntensity: Math.max(state.glitchIntensity, Math.min(1, intensity)),
  };
}

/**
 * Steps glitch timers & schedules random decoy glitches so glitches are never proof of an anomaly.
 */
export function tickSanityEffects(
  state: SanityState,
  dt: number,
  rng: () => number = Math.random,
): SanityState {
  let glitchTimer = Math.max(0, state.glitchTimer - dt);
  let glitchIntensity = glitchTimer > 0 ? state.glitchIntensity : 0;
  let decoyCooldown = state.decoyCooldown - dt;

  // Ambient screen glitches at Low and Critical, plus occasional decoy glitches at any tier after stop 1
  if (decoyCooldown <= 0) {
    const tier = state.tier;
    const fireChance =
      tier === 'Critical' ? 0.85 : tier === 'Low' ? 0.65 : tier === 'Medium' ? 0.32 : 0.14;
    if (rng() < fireChance) {
      const dur = tier === 'Critical' ? 0.55 : tier === 'Low' ? 0.4 : 0.24;
      const amp = tier === 'Critical' ? 0.92 : tier === 'Low' ? 0.65 : 0.32;
      glitchTimer = Math.max(glitchTimer, dur);
      glitchIntensity = Math.max(glitchIntensity, amp);
    }
    const nextMin = tier === 'Critical' ? 5 : tier === 'Low' ? 8 : 13;
    const nextSpan = tier === 'Critical' ? 6 : 11;
    decoyCooldown = nextMin + rng() * nextSpan;
  }

  return {
    ...state,
    glitchTimer,
    glitchIntensity,
    decoyCooldown,
  };
}
