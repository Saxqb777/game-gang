/** Explicit reverse gear: arm by holding brake at a standstill, then brake drives backwards. */
import { REVERSE_ARM_MS } from '@gamergang/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { REVERSE } from '../config';
import type { Car } from './car';
import type { DriveInput } from './input';
import { Simulation } from './simulation';
import { PhysicsWorld } from './world';

const STEP = 1 / 60;

async function flatWorld(): Promise<{ sim: Simulation; car: Car }> {
  const physics = await PhysicsWorld.create();
  physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 2000, y: 0.5, z: 2000 });
  const sim = new Simulation(physics);
  const car = sim.addCar({ x: 0, y: 0.3, z: 0, yaw: 0 });
  return { sim, car };
}

function setInput(car: Car, input: Partial<DriveInput>): void {
  Object.assign(
    car.input,
    { steer: 0, throttle: 0, brake: 0, handbrake: false, horn: false },
    input,
  );
}

/** Steps the sim for `seconds` with the given input; returns the reverse state after each step. */
function hold(sim: Simulation, car: Car, input: Partial<DriveInput>, seconds: number): string[] {
  setInput(car, input);
  const states: string[] = [];
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    sim.step();
    states.push(car.reverseState);
  }
  return states;
}

describe('reverse gear', () => {
  let sim: Simulation;
  let car: Car;

  beforeEach(async () => {
    ({ sim, car } = await flatWorld());
    hold(sim, car, {}, 1.5); // settle on the suspension
  });

  it('the pad ring timing matches the TV arming time', () => {
    expect(REVERSE_ARM_MS).toBe(REVERSE.armSeconds * 1000);
  });

  it('arms for the first 0.3 s, is on after 0.36 s and drives backwards after 1.5 s', () => {
    expect(car.reverseState).toBe('off');
    const arming = hold(sim, car, { brake: 1 }, 0.3);
    expect(arming.every((state) => state === 'arming')).toBe(true);
    // Still standing: arming brakes normally, it does not creep.
    expect(Math.abs(car.forwardSpeed)).toBeLessThan(0.2);
    hold(sim, car, { brake: 1 }, 0.06);
    expect(car.reverseState).toBe('on');
    hold(sim, car, { brake: 1 }, 1.5 - 0.36);
    expect(car.forwardSpeed).toBeLessThan(-0.5);
  });

  it('releasing brake leaves reverse (and cancels arming)', () => {
    hold(sim, car, { brake: 1 }, 1);
    expect(car.reverseState).toBe('on');
    hold(sim, car, {}, STEP);
    expect(car.reverseState).toBe('off');
    hold(sim, car, { brake: 1 }, 0.2);
    expect(car.reverseState).toBe('arming');
    hold(sim, car, {}, STEP);
    expect(car.reverseState).toBe('off');
  });

  it('gas leaves reverse', () => {
    hold(sim, car, { brake: 1 }, 1);
    expect(car.reverseState).toBe('on');
    hold(sim, car, { brake: 1, throttle: 0.5 }, STEP);
    expect(car.reverseState).toBe('off');
  });

  it('feathering residue (gas 0.04) does not block arming', () => {
    hold(sim, car, { brake: 1, throttle: 0.04 }, 0.5);
    expect(car.reverseState).toBe('on');
  });

  it('real gas blocks arming', () => {
    const states = hold(sim, car, { brake: 1, throttle: REVERSE.gasThreshold }, 1);
    expect(states.every((state) => state === 'off')).toBe(true);
  });

  it('a light brake does not arm', () => {
    const states = hold(sim, car, { brake: REVERSE.brakeThreshold }, 1);
    expect(states.every((state) => state === 'off')).toBe(true);
  });

  it('braking while rolling forwards does not arm until the car has stopped', () => {
    hold(sim, car, { throttle: 1 }, 2);
    expect(car.forwardSpeed).toBeGreaterThan(5);
    setInput(car, { brake: 1 });
    sim.step();
    expect(car.reverseState).toBe('off');
    hold(sim, car, { brake: 1 }, 4);
    expect(car.reverseState).toBe('on');
  });

  it('placeAt clears the gear', () => {
    hold(sim, car, { brake: 1 }, 1);
    expect(car.reverseState).toBe('on');
    car.placeAt({ x: 0, y: 0.3, z: 0, yaw: 0 });
    expect(car.reverseState).toBe('off');
    expect(car.reverseArm).toBe(0);
  });
});
