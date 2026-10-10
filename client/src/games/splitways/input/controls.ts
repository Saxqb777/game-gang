/**
 * Pure touch-control maths shared by the pad (gestures) and the TV (steering processing).
 * Deliberately dependency-free: the phone bundle imports this file, and anything it pulled in
 * (three.js, the sim, config) would land in the pad chunk.
 */

/**
 * Pad layout and gesture constants (pad-only, so they live next to the pad maths rather than in
 * config.ts). Shares are of the controller height unless stated.
 */
export const DRAG = {
  /** Width of the steer zone as a share of the controller width. */
  zoneShare: 0.45,
  /** Horizontal drag for full lock, as a share of the screen height (thumb travel, not pixels). */
  fullLockTravel: 0.25,
  /** Sliding down the GAS pedal by this share of its height lifts off completely. */
  featherTravel: 0.3,
  /** The steer zone starts this far in from the left edge (iOS back-swipe guard, px). */
  edgeInsetPx: 24,
} as const;

/** Throttle is sent in steps of this size, so tiny thumb wobbles are not news. */
const THROTTLE_STEP = 0.05;
const THROTTLE_STEPS = Math.round(1 / THROTTLE_STEP);

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Drag steer: horizontal thumb travel from where it landed to a raw, linear -1..1 (right positive).
 * Full lock is `travelShare` of the viewport height either side.
 */
export function dragSteer(
  dxPx: number,
  viewportHeightPx: number,
  travelShare: number = DRAG.fullLockTravel,
): number {
  const travel = travelShare * viewportHeightPx;
  if (!(travel > 0)) return 0;
  return clamp(dxPx / travel, -1, 1);
}

/**
 * Steering response curve: 0 inside the dead zone, then a power curve rescaled so it starts at 0
 * at the dead-zone edge (continuous) and reaches ±1 at full input. Gamma above 1 gives finer
 * control around the centre.
 */
export function shapeSteer(x: number, deadZone: number, gamma: number): number {
  const magnitude = Math.min(1, Math.abs(x));
  if (magnitude <= deadZone) return 0;
  const t = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(x) * t ** gamma;
}

/**
 * GAS feathering: full throttle where the thumb lands, easing off as it slides down the pedal and
 * fully off after `travelShare` of the pedal height. Quantised to 0.05 so the wire only carries
 * meaningful changes; anything under one step is off.
 */
export function featherThrottle(
  dyPx: number,
  pedalHeightPx: number,
  travelShare: number = DRAG.featherTravel,
): number {
  const travel = travelShare * pedalHeightPx;
  if (!(travel > 0)) return 1;
  const raw = 1 - clamp(dyPx / travel, 0, 1);
  return raw < THROTTLE_STEP ? 0 : quantiseThrottle(raw);
}

/** Throttle on the 0.05 grid the wire uses. Dividing by the step count keeps 0.35 exact. */
export function quantiseThrottle(value: number): number {
  return Math.round(clamp(value, 0, 1) * THROTTLE_STEPS) / THROTTLE_STEPS;
}

/**
 * Stuck-on-gas help, worded per device: the phone's pedals, or the TV key set a keyboard player
 * drives with (0 = WASD, 1 = arrows). The TV picks the hint; both sides show the text.
 */
export const STUCK_HINTS = {
  reverse: {
    pad: 'Hold BRAKE to reverse',
    keys: ['Hold S to reverse', 'Hold ↓ to reverse'],
  },
  'release-gas': {
    pad: 'Let go of GAS · hold BRAKE to reverse',
    keys: ['Let go of W · hold S to reverse', 'Let go of ↑ · hold ↓ to reverse'],
  },
} as const;

export type StuckHint = keyof typeof STUCK_HINTS;
