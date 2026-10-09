import type { TempContactForceEvent } from '@dimforge/rapier3d-compat';
import { PHYSICS } from '../config';
import { Car, type Spawn } from './car';
import type { PhysicsWorld } from './world';

export interface Impact {
  car: Car;
  /** The other car, or null when the car hit scenery. */
  other: Car | null;
  /** Contact force in newtons. */
  force: number;
}

/** Steps all cars through one fixed physics tick and reports collisions. */
export class Simulation {
  readonly cars: Car[] = [];
  private readonly carByCollider = new Map<number, Car>();
  private readonly pendingImpacts: Impact[] = [];
  /** Wall-clock time of the last step in ms, for the debug overlay. */
  lastStepMs = 0;
  readonly dt = 1 / PHYSICS.stepHz;

  constructor(readonly physics: PhysicsWorld) {}

  addCar(spawn: Spawn): Car {
    const car = new Car(this.physics.rapier, this.physics.world, spawn);
    this.cars.push(car);
    this.carByCollider.set(car.collider.handle, car);
    return car;
  }

  removeCar(car: Car): void {
    const index = this.cars.indexOf(car);
    if (index === -1) return;
    this.cars.splice(index, 1);
    this.carByCollider.delete(car.collider.handle);
    car.dispose();
  }

  step(): void {
    const started = performance.now();
    for (const car of this.cars) car.prePhysics(this.dt);
    this.physics.world.step(this.physics.events);
    for (const car of this.cars) car.postPhysics();
    this.physics.events.drainContactForceEvents(this.collectImpact);
    this.lastStepMs = performance.now() - started;
  }

  private readonly collectImpact = (event: TempContactForceEvent): void => {
    const a = this.carByCollider.get(event.collider1());
    const b = this.carByCollider.get(event.collider2());
    const force = event.totalForceMagnitude();
    // Collisions are rare events, so a small object per impact is fine.
    if (a) this.pendingImpacts.push({ car: a, other: b ?? null, force });
    if (b) this.pendingImpacts.push({ car: b, other: a ?? null, force });
  };

  /** Hands over (and clears) the collisions since the last call. */
  drainImpacts(handle: (impact: Impact) => void): void {
    for (const impact of this.pendingImpacts) handle(impact);
    this.pendingImpacts.length = 0;
  }

  dispose(): void {
    for (const car of [...this.cars]) this.removeCar(car);
    this.physics.dispose();
  }
}
