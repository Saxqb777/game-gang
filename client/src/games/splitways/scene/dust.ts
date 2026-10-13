/**
 * Soft puffs: beige dust from gravel, clippings from grass and tyre smoke from slides on the
 * road. One particle pool, one draw call.
 */
import { Vector3 } from 'three';
import type { Car } from '../sim/car';
import { SURFACE } from '../track/surfaces';
import { Particles } from './particles';

/**
 * Puffs per second per wheel per m/s of speed: gravel dust and grass clippings; tyre smoke per
 * m/s of sideways slide on asphalt and kerbs.
 */
const GRAVEL_RATE = 0.9;
const GRASS_RATE = 0.2;
const SMOKE_RATE = 2.2;
/** Colours (linear, before the particle light): beige gravel dust, green-brown clippings, grey smoke. */
const DUST_COLOUR = [0.55, 0.47, 0.36] as const;
const GRASS_COLOUR = [0.07, 0.09, 0.035] as const;
const SMOKE_COLOUR = [0.72, 0.72, 0.72] as const;

type Kind = 'dust' | 'grass' | 'smoke';

const velocity = new Vector3();

export class Dust {
  private readonly particles = new Particles({
    max: 900,
    additive: false,
    // Lit like the sunny side of the scene at this exposure.
    light: [1.25, 1.15, 1.02],
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

  /** After each physics step: emit from the wheels, by each wheel's ground surface. */
  emit(car: Car, dt: number): void {
    const owed = this.owed.get(car);
    if (!owed) return;
    const speed = Math.abs(car.forwardSpeed);
    for (let i = 0; i < 4; i++) {
      if (car.wheelInContact[i] !== 1) continue;
      const slide = car.wheelSlide[i] ?? 0;
      const surface = car.wheelSurface[i] ?? SURFACE.asphalt;
      let kind: Kind | null = null;
      let rate = 0;
      if (surface === SURFACE.gravel && speed > 4) {
        kind = 'dust';
        rate = GRAVEL_RATE * speed * (i >= 2 ? 1 : 0.4);
      } else if (surface === SURFACE.grass && speed > 6) {
        kind = 'grass';
        rate = GRASS_RATE * speed * (i >= 2 ? 1 : 0.3);
      } else if (car.wheelSkidding[i] === 1 && slide > 3 && i >= 2) {
        // Smoke comes from the rear tyres.
        kind = 'smoke';
        rate = SMOKE_RATE * slide;
      }
      if (!kind) continue;
      let pending = (owed[i] ?? 0) + rate * dt;
      while (pending >= 1) {
        this.wheelPuff(car, i, kind);
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

  private wheelPuff(car: Car, wheel: number, kind: Kind): void {
    const contact = car.wheelContact[wheel] as Vector3;
    const dirt = kind !== 'smoke';
    // Thrown up and back, carrying some of the car's speed. Clippings are few, small and fall fast.
    velocity.copy(car.velocity).multiplyScalar(dirt ? 0.25 : 0.12);
    const colour = kind === 'dust' ? DUST_COLOUR : kind === 'grass' ? GRASS_COLOUR : SMOKE_COLOUR;
    const grass = kind === 'grass';
    this.particles.emit(
      contact.x + (Math.random() - 0.5) * 0.3,
      contact.y + 0.15,
      contact.z + (Math.random() - 0.5) * 0.3,
      velocity.x + (Math.random() - 0.5) * 2.4,
      (dirt ? 1.2 : 0.6) + Math.random() * 1.2,
      velocity.z + (Math.random() - 0.5) * 2.4,
      colour[0],
      colour[1],
      colour[2],
      grass ? 0.7 : dirt ? 0.42 : 0.3,
      grass ? 0.7 + Math.random() * 0.3 : (dirt ? 1.1 : 1.6) + Math.random() * 0.8,
      grass ? 0.18 : 0.5,
      grass ? 0.1 : (dirt ? 2.4 : 3.2) + Math.random() * 1.2,
      // Clippings fall back down; dust and smoke drift up a little.
      grass ? 9 : -0.6,
      grass ? 1 : 2.2,
    );
  }
}
