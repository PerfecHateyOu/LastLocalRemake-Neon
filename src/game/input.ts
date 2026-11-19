/**
 * Input Controller — Pure logic for Look (Pointer Lock + Arrow Keys), Move (WASD + Mobile Stick),
 * and strict Pause hygiene:
 * - Clears all held keys immediately on pause
 * - Ignores key repeats (event.repeat)
 * - Resumes only on a fresh key press
 * - Guarantees zero look drift while paused
 */

export const ARROW_YAW_RAD_PER_SEC = 1.8;
export const ARROW_PITCH_RAD_PER_SEC = 1.2;
export const MOVE_SPEED_MPS = 1.85;

/** Seated/aisle playable bounds inside Car B (meters) */
export const CAR_BOUNDS = {
  minX: -0.78,
  maxX: 0.78,
  minZ: -5.4,
  maxZ: 3.4,
  baseEyeY: 1.18, // Seated child eye level looking down the aisle
} as const;

export const MAX_PITCH_RAD = 0.85;
export const MIN_PITCH_RAD = -0.62;
export const MAX_YAW_RAD = Math.PI * 0.92;

export interface InputState {
  paused: boolean;
  /** Keys currently held down (cleared completely on pause) */
  heldKeys: Set<string>;
  /** Pending pointer-lock mouse movement deltas */
  mouseDeltaX: number;
  mouseDeltaY: number;
  /** Mobile virtual stick (-1..1) */
  mobileMoveX: number;
  mobileMoveY: number;
  /** Mobile touch look deltas */
  touchDeltaX: number;
  touchDeltaY: number;
  /** Camera orientation (radians) — 0 looks straight down aisle (-Z) */
  yaw: number;
  pitch: number;
  /** Player position inside Car B */
  posX: number;
  posZ: number;
  /** Recent angular speed (rad/s) for detecting sudden head snaps */
  angularSpeedRadPerSec: number;
  /** Sensitivity multiplier from Settings (0.4..2.0) */
  sensitivity: number;
}

export function createInitialInputState(sensitivity = 1.0): InputState {
  return {
    paused: false,
    heldKeys: new Set<string>(),
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    mobileMoveX: 0,
    mobileMoveY: 0,
    touchDeltaX: 0,
    touchDeltaY: 0,
    yaw: 0.04,
    pitch: -0.02,
    posX: 0.44, // Seated slightly right-of-center looking down aisle; Mom & Dad clearly visible on left bench
    posZ: 2.65,
    angularSpeedRadPerSec: 0,
    sensitivity,
  };
}

export function clearHeldInputs(state: InputState): void {
  state.heldKeys.clear();
  state.mouseDeltaX = 0;
  state.mouseDeltaY = 0;
  state.touchDeltaX = 0;
  state.touchDeltaY = 0;
  state.mobileMoveX = 0;
  state.mobileMoveY = 0;
  state.angularSpeedRadPerSec = 0;
}

export function setInputPaused(state: InputState, paused: boolean): void {
  state.paused = paused;
  clearHeldInputs(state);
}

/**
 * Handles keydown with strict repeat rejection.
 * Returns true if this was a fresh pause toggle ('KeyP' or 'Escape').
 */
export function handleKeyDown(
  state: InputState,
  code: string,
  repeat: boolean,
): { pauseToggle: boolean } {
  if (repeat) {
    return { pauseToggle: false };
  }

  if (code === 'KeyP' || code === 'Escape') {
    return { pauseToggle: true };
  }

  if (state.paused) {
    // Do not accept movement/look keys while paused
    return { pauseToggle: false };
  }

  state.heldKeys.add(code);
  return { pauseToggle: false };
}

export function handleKeyUp(state: InputState, code: string): void {
  state.heldKeys.delete(code);
}

export function addMouseLookDelta(state: InputState, dx: number, dy: number): void {
  if (state.paused) return;
  state.mouseDeltaX += dx;
  state.mouseDeltaY += dy;
}

export function addTouchLookDelta(state: InputState, dx: number, dy: number): void {
  if (state.paused) return;
  state.touchDeltaX += dx;
  state.touchDeltaY += dy;
}

export function setMobileMoveStick(state: InputState, x: number, y: number): void {
  if (state.paused) {
    state.mobileMoveX = 0;
    state.mobileMoveY = 0;
    return;
  }
  state.mobileMoveX = Math.max(-1, Math.min(1, x));
  state.mobileMoveY = Math.max(-1, Math.min(1, y));
}

/**
 * Advances camera look and aisle position by dt seconds.
 * When paused, performs NO mutation at all — guaranteeing zero look drift.
 */
export function stepInput(
  state: InputState,
  dt: number,
  options?: { restraintLocked?: boolean; modalOpen?: boolean },
): { movedDuringRestraint: boolean } {
  if (state.paused || dt <= 0) {
    state.mouseDeltaX = 0;
    state.mouseDeltaY = 0;
    state.touchDeltaX = 0;
    state.touchDeltaY = 0;
    state.angularSpeedRadPerSec = 0;
    return { movedDuringRestraint: false };
  }

  const clampedDt = Math.min(dt, 0.05);
  const modalOpen = Boolean(options?.modalOpen);
  const prevYaw = state.yaw;
  const prevPitch = state.pitch;

  let dYaw = 0;
  let dPitch = 0;

  if (!modalOpen) {
    // Arrow keys: exact specification yaw 1.8 rad/s, pitch 1.2 rad/s
    if (state.heldKeys.has('ArrowLeft')) dYaw += ARROW_YAW_RAD_PER_SEC * clampedDt;
    if (state.heldKeys.has('ArrowRight')) dYaw -= ARROW_YAW_RAD_PER_SEC * clampedDt;
    if (state.heldKeys.has('ArrowUp')) dPitch += ARROW_PITCH_RAD_PER_SEC * clampedDt;
    if (state.heldKeys.has('ArrowDown')) dPitch -= ARROW_PITCH_RAD_PER_SEC * clampedDt;

    // Mouse pointer-lock & touch look
    const mouseScale = 0.0022 * state.sensitivity;
    const touchScale = 0.0042 * state.sensitivity;
    dYaw -= state.mouseDeltaX * mouseScale + state.touchDeltaX * touchScale;
    dPitch -= state.mouseDeltaY * mouseScale + state.touchDeltaY * touchScale;
  }

  state.mouseDeltaX = 0;
  state.mouseDeltaY = 0;
  state.touchDeltaX = 0;
  state.touchDeltaY = 0;

  const restraintLocked = Boolean(options?.restraintLocked);
  let movedDuringRestraint = false;

  if (restraintLocked) {
    // During Greenpoint Av restraint, trying to look sharply or walk registers movement
    if (Math.abs(dYaw) > 0.035 || Math.abs(dPitch) > 0.035) {
      movedDuringRestraint = true;
    }
    // Heavily damp look movement while held in place
    state.yaw = clampAngle(state.yaw + dYaw * 0.25, -MAX_YAW_RAD, MAX_YAW_RAD);
    state.pitch = clampAngle(state.pitch + dPitch * 0.25, MIN_PITCH_RAD, MAX_PITCH_RAD);
  } else {
    state.yaw = clampAngle(state.yaw + dYaw, -MAX_YAW_RAD, MAX_YAW_RAD);
    state.pitch = clampAngle(state.pitch + dPitch, MIN_PITCH_RAD, MAX_PITCH_RAD);
  }

  // Movement (WASD + mobile joystick)
  let forwardInput = 0;
  let strafeInput = 0;
  if (!modalOpen) {
    if (state.heldKeys.has('KeyW')) forwardInput += 1;
    if (state.heldKeys.has('KeyS')) forwardInput -= 1;
    if (state.heldKeys.has('KeyD')) strafeInput += 1;
    if (state.heldKeys.has('KeyA')) strafeInput -= 1;
    forwardInput += state.mobileMoveY;
    strafeInput += state.mobileMoveX;
  }

  const moveLen = Math.hypot(forwardInput, strafeInput);
  if (moveLen > 0.01) {
    if (restraintLocked) {
      movedDuringRestraint = true;
    } else {
      const norm = moveLen > 1 ? 1 / moveLen : 1;
      const fwd = forwardInput * norm;
      const str = strafeInput * norm;

      // Forward direction for yaw (0 looks toward -Z)
      const sinY = Math.sin(state.yaw);
      const cosY = Math.cos(state.yaw);
      const vx = (-sinY * fwd + cosY * str) * MOVE_SPEED_MPS * clampedDt;
      const vz = (-cosY * fwd - sinY * str) * MOVE_SPEED_MPS * clampedDt;

      state.posX = Math.max(CAR_BOUNDS.minX, Math.min(CAR_BOUNDS.maxX, state.posX + vx));
      state.posZ = Math.max(CAR_BOUNDS.minZ, Math.min(CAR_BOUNDS.maxZ, state.posZ + vz));
    }
  }

  const angDelta = Math.hypot(state.yaw - prevYaw, state.pitch - prevPitch);
  state.angularSpeedRadPerSec = angDelta / clampedDt;

  return { movedDuringRestraint };
}

function clampAngle(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
