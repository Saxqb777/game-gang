/**
 * Debug-only autopilot: drives a car along the track's racing line (pure pursuit, with braking
 * from the generated speed profile, or the car's own one). It exists so whole races can be tested without four humans;
 * it is not an AI opponent. Toggle it from the TV's debug overlay (backtick, then P).
 */
import { Vector3 } from 'three';
import type { DriveInput } from '../sim/input';
import type { Racer } from '../race/race';
import type { Track } from '../track/track';

/** Share of the racing line's speed the autopilot aims for. */
const SPEED_SHARE = 0.92;
/** Over the target by more than this (m/s): brake fully; between 0 and this: coast. */
const BRAKE_OVER = 3;
/** Lanes stay this far inside the asphalt edge (m). */
const LANE_MARGIN = 1.2;
const forward = new Vector3();
const toTarget = new Vector3();
const target = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);

/**
 * `speeds`: this car's own target speed per track station (`carSpeedProfile`); null drives to the
 * track's reference-car plan.
 */
export function autopilot(
  track: Track,
  racer: Racer,
  out: DriveInput,
  speeds: Float32Array | null = null,
): DriveInput {
  const { car } = racer;
  const speed = Math.max(0, car.forwardSpeed);
  const here = racer.projection.distance;

  // Pure pursuit on the racing line, shifted into this car's lane.
  const look = Math.min(30, Math.max(7, 5 + speed * 0.55));
  const index = track.indexAt(here + look);
  const aim = track.sample(index);
  const lane = ((racer.slot % 4) - 1.5) * 0.9;
  const lateral = Math.max(
    -(aim.sideL.road - LANE_MARGIN),
    Math.min(aim.sideR.road - LANE_MARGIN, aim.racingLine + lane),
  );
  track.lateralPoint(index, lateral, target);
  toTarget.copy(target).sub(car.position);
  toTarget.y = 0;
  forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion);
  forward.y = 0;
  forward.normalize();
  toTarget.normalize();
  // Positive = target is to the left.
  const angle = Math.atan2(forward.z * toTarget.x - forward.x * toTarget.z, forward.dot(toTarget));
  out.steer = Math.max(-1, Math.min(1, -angle * 2.4));

  // Speed: the slowest point of the line within the braking horizon.
  let slowest = Infinity;
  const horizon = Math.max(25, speed * 2.4);
  for (let d = 0; d <= horizon; d += 1) {
    const target = speeds
      ? (speeds[track.indexAt(here + d)] as number)
      : track.sampleAt(here + d).targetSpeed;
    slowest = Math.min(slowest, target);
  }
  const goal = SPEED_SHARE * slowest;
  if (speed > goal + BRAKE_OVER) {
    out.throttle = 0;
    out.brake = 1;
  } else if (speed > goal) {
    out.throttle = 0;
    out.brake = 0;
  } else {
    out.throttle = 1;
    out.brake = 0;
  }
  // Backing out of a wall: the stuck respawn handles real wedges, so just keep pushing forwards.
  out.handbrake = false;
  out.horn = false;
  return out;
}
