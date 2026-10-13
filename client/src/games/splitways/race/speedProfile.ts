/**
 * Per-car speed profile along the racing line: the reference plan's limits scaled by how this car
 * compares with the reference car (top speed, grip, braking and acceleration), plus its own engine
 * curve. The debug autopilot drives each car to its own profile, which is what the balance test
 * measures. Node-safe.
 */
import { BRAKES, CAR, CAR_DERIVE, ENGINE, RACING_LINE, TYRES } from '../config';
import type { CarSpec } from '../sim/carSpec';
import { speedProfile, type SpeedLimits } from '../track/gen/racingLine';
import type { Track } from '../track/track';

/** The limits this car's profile plans with (§3.8); `CAR_DERIVE.profile*` damp each ratio. */
export function carSpeedLimits(spec: CarSpec): SpeedLimits {
  const gripIndex =
    (spec.tyres.frontGrip / TYRES.frontGrip + spec.tyres.rearGrip / TYRES.rearGrip) / 2;
  const brakeRatio = spec.brakes.impulse / spec.mass / (BRAKES.impulse / CAR.mass);
  const accelRatio = spec.engine.force / spec.mass / (ENGINE.force / CAR.mass);
  return {
    vMax: RACING_LINE.vMax * (spec.engine.topSpeed / ENGINE.topSpeed) ** CAR_DERIVE.profileTopSpeed,
    lateralAccel: RACING_LINE.lateralAccel * gripIndex ** CAR_DERIVE.profileGrip,
    brakeDecel: RACING_LINE.brakeDecel * brakeRatio ** CAR_DERIVE.profileBrake,
    accelCap: RACING_LINE.accelCap * accelRatio ** CAR_DERIVE.profileAccel,
    force: spec.engine.force,
    topSpeed: spec.engine.topSpeed,
    curve: spec.engine.curve,
    mass: spec.mass,
  };
}

/** Target speed per track station (m/s) for this car; index it with `track.indexAt(distance)`. */
export function carSpeedProfile(track: Track, spec: CarSpec): Float32Array {
  const { lineCurvature, spacing } = track.definition;
  return speedProfile(lineCurvature, spacing, carSpeedLimits(spec));
}
