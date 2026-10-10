/**
 * Soft puffs: dirt thrown up by wheels on the shoulders, and tyre smoke from slides. One particle
 * pool, one draw call.
 */
import { Vector3 } from 'three';
import type { Car } from '../sim/car';
import { Particles } from './particles';

/** Puffs per second per wheel: dirt at speed, smoke per metre/second of sideways slide. */
const DIRT_RATE = 0.9;
const SMOKE_RATE = 2.2;
/** Dry earth off the grass verges. */
const DIRT_COLOUR = [0.46, 0.4, 0.29] as const;
const SMOKE_COLOUR = [0.78, 0.78, 0.78] as const;

const velocity = new Vector3();

export class Dust {
  private readonly particles = new Particles({
    max: 900,
    additive: false,
    light: [1.6, 1.45, 1.3],
    hardness: 0.2,
  });
  /** Fractional puffs owed per car wheel, so low rates still emit. */
  private readonly owed = new Map<Car, Float32Array>();

  get mesh() {
    return this.particles.mesh;
  }

  addCar(car: Car): void {
    this.owed.set(car, new Float32Array(4));
  }

  /** After each physics step: emit from the wheels. */
  emit(car: Car, onSand: boolean, dt: number): void {
    const owed = this.owed.get(car);
    if (!owed) return;
    const speed = Math.abs(car.forwardSpeed);
    for (let i = 0; i < 4; i++) {
      if (car.wheelInContact[i] !== 1) continue;
      const slide = car.wheelSlide[i] ?? 0;
      const sand = onSand && speed > 4;
      const smoke = !onSand && car.wheelSkidding[i] === 1 && slide > 3;
      // Front wheels only throw dirt; smoke comes from the rear.
      if (!sand && !(smoke && i >= 2)) continue;
      const rate = sand ? DIRT_RATE * speed * (i >= 2 ? 1 : 0.4) : SMOKE_RATE * slide;
      let pending = (owed[i] ?? 0) + rate * dt;
      while (pending >= 1) {
        this.wheelPuff(car, i, sand);
        pending -= 1;
      }
      owed[i] = pending;
    }
  }

  /** Once per frame. */
  update(dt: number): void {
    this.particles.update(dt);
  }

  dispose(): void {
    this.particles.dispose();
  }

  private wheelPuff(car: Car, wheel: number, sand: boolean): void {
    const contact = car.wheelContact[wheel] as Vector3;
    // Thrown up and back, carrying some of the car's speed.
    velocity.copy(car.velocity).multiplyScalar(sand ? 0.25 : 0.12);
    const colour = sand ? DIRT_COLOUR : SMOKE_COLOUR;
    this.particles.emit(
      contact.x + (Math.random() - 0.5) * 0.3,
      contact.y + 0.15,
      contact.z + (Math.random() - 0.5) * 0.3,
      velocity.x + (Math.random() - 0.5) * 2.4,
      (sand ? 1.2 : 0.6) + Math.random() * 1.2,
      velocity.z + (Math.random() - 0.5) * 2.4,
      colour[0],
      colour[1],
      colour[2],
      sand ? 0.42 : 0.3,
      (sand ? 1.1 : 1.6) + Math.random() * 0.8,
      0.5,
      (sand ? 2.4 : 3.2) + Math.random() * 1.2,
      -0.6,
      2.2,
    );
  }
}
