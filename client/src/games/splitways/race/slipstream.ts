/**
 * Slipstream: tucked in close behind another car, you punch a smaller hole in the air. It only cuts
 * air drag (the car applies `draft` to its drag), so it helps you close a gap but never pushes you
 * past what the engine could do in clean air. Pure logic, so it runs in tests.
 */
import { Vector3 } from 'three';
import { SLIPSTREAM } from '../config';
import type { Car } from '../sim/car';

const delta = new Vector3();
const forward = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);

export class Slipstream {
  /** Eased slipstream strength per car, 0..1. */
  private readonly drafts: number[];

  constructor(private readonly cars: readonly Car[]) {
    this.drafts = cars.map(() => 0);
  }

  /** After each physics step. Sets every car's draft for the next one; none outside racing. */
  update(dt: number, racing: boolean): void {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i] as Car;
      const draft = racing ? this.target(i, car, dt, this.drafts[i] ?? 0) : 0;
      this.drafts[i] = draft;
      car.draft = draft;
    }
  }

  /** Strength of the slipstream from the best car ahead, eased in and out. */
  private target(index: number, car: Car, dt: number, current: number): number {
    let target = 0;
    if (car.forwardSpeed > SLIPSTREAM.minSpeed) {
      forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion);
      for (let j = 0; j < this.cars.length; j++) {
        if (j === index) continue;
        const other = this.cars[j] as Car;
        delta.subVectors(other.position, car.position);
        const along = delta.dot(forward);
        if (along < 2 || along > SLIPSTREAM.range) continue;
        const sideways = Math.sqrt(Math.max(0, delta.lengthSq() - along * along));
        if (sideways > SLIPSTREAM.width) continue;
        target = Math.max(target, 1 - (along - 2) / (SLIPSTREAM.range - 2));
      }
    }
    // Builds up over ~0.6 s, drops away over ~0.3 s.
    const rate = target > current ? dt / 0.6 : dt / 0.3;
    return current + Math.max(-rate, Math.min(rate, target - current));
  }
}
