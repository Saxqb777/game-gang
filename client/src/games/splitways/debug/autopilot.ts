/**
 * Debug-only autopilot: drives a car around the track centre line (pure pursuit + braking for
 * upcoming corners). It exists so whole races can be tested without four humans; it is not an AI
 * opponent. Toggle it from the TV's debug overlay (backtick, then P).
 */
import { Vector3 } from 'three';
import type { DriveInput } from '../sim/input';
import type { Racer } from '../race/race';
import type { Track } from '../track/track';

/** Cornering grip the autopilot plans with (m/s^2); a bit below the car's limit. */
const PLANNED_GRIP = 15;
const forward = new Vector3();
const toTarget = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);

export function autopilot(track: Track, racer: Racer, out: DriveInput): DriveInput {
  const { car } = racer;
  const speed = Math.max(0, car.forwardSpeed);
  const lane = ((racer.slot % 4) - 1.5) * 1.8;
  const here = racer.projection.distance;

  const look = Math.min(30, Math.max(7, 5 + speed * 0.55));
  const target = track.sampleAt(here + look);
  toTarget.copy(target.position).addScaledVector(target.right, lane).sub(car.position);
  toTarget.y = 0;
  forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion);
  forward.y = 0;
  forward.normalize();
  toTarget.normalize();
  // Positive = target is to the left.
  const angle = Math.atan2(forward.z * toTarget.x - forward.x * toTarget.z, forward.dot(toTarget));
  out.steer = Math.max(-1, Math.min(1, -angle * 2.4));

  let worstCurvature = 0;
  const horizon = Math.max(25, speed * 2.4);
  for (let d = 0; d < horizon; d += 3) {
    worstCurvature = Math.max(worstCurvature, Math.abs(track.sampleAt(here + d).curvature));
  }
  const safeSpeed = Math.sqrt(PLANNED_GRIP / Math.max(worstCurvature, 1e-4));
  if (speed > safeSpeed + 3) {
    out.throttle = 0;
    out.brake = 1;
  } else if (speed > safeSpeed) {
    out.throttle = 0.25;
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
