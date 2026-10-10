import { STEER_INPUT } from '../config';
import { shapeSteer } from './controls';

/**
 * TV-side steering processing, the same for every input device: dead zone, response curve, then a
 * short low-pass. Pads send raw linear steer and never shape it themselves (no double processing).
 * The speed-sensitive lock and the road-wheel rate limit stay in `Car.applySteering`; this adds no
 * second rate limiter.
 */
export class SteerProcessor {
  /** The processed steer last returned, -1..1. */
  value = 0;

  /** Feed one physics step of raw steer (-1..1); returns the processed value. */
  process(raw: number, dt: number): number {
    const target = shapeSteer(raw, STEER_INPUT.deadZone, STEER_INPUT.gamma);
    const alpha = 1 - Math.exp(-dt / STEER_INPUT.lowPassSeconds);
    this.value += (target - this.value) * alpha;
    // Snap the exponential tail so a released wheel really reads 0 (the HUD and tests check it).
    if (Math.abs(this.value - target) < 1e-4) this.value = target;
    return this.value;
  }

  /** Back to centre at once (after a respawn teleport). */
  reset(): void {
    this.value = 0;
  }
}
