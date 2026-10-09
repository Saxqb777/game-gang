/**
 * The M1/M2 driving sandbox: a big flat grey plane with a few ramps and blocks to play with.
 * Pure data plus the physics builder, so it also runs headless.
 */
import type { Spawn } from '../sim/car';
import { SURFACE_FRICTION, type PhysicsWorld } from '../sim/world';

export interface Ramp {
  x: number;
  z: number;
  yaw: number;
  width: number;
  length: number;
  height: number;
}

export interface Block {
  x: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  depth: number;
}

export const TEST_PLANE = {
  /** Side length of the square ground (m). Invisible walls stop cars at the edge. */
  size: 700,
  ramps: [
    { x: 0, z: 90, yaw: 0, width: 9, length: 16, height: 2.4 },
    { x: -70, z: 10, yaw: -Math.PI / 2, width: 9, length: 12, height: 1.6 },
    { x: 80, z: -60, yaw: Math.PI * 0.75, width: 10, length: 20, height: 3.2 },
  ] satisfies Ramp[],
  blocks: [
    { x: 30, z: 40, yaw: 0.3, width: 4, height: 1.2, depth: 4 },
    { x: 38, z: 46, yaw: -0.2, width: 3, height: 0.9, depth: 3 },
    { x: -40, z: 70, yaw: 0.8, width: 6, height: 1.5, depth: 2 },
    { x: -30, z: -50, yaw: 0, width: 2, height: 2, depth: 18 },
  ] satisfies Block[],
};

/** Grid spawn: two rows of two, facing +Z. */
export const TEST_PLANE_SPAWNS: readonly Spawn[] = [
  { x: 3, y: 0.4, z: 0, yaw: 0 },
  { x: -3, y: 0.4, z: 0, yaw: 0 },
  { x: 3, y: 0.4, z: -9, yaw: 0 },
  { x: -3, y: 0.4, z: -9, yaw: 0 },
];

/** The 6 corners of a wedge: flat at the -Z end, rising to `height` at the +Z end. */
export function rampPoints(ramp: Ramp): Float32Array {
  const hw = ramp.width / 2;
  const hl = ramp.length / 2;
  const local: [number, number, number][] = [
    [-hw, 0, -hl],
    [hw, 0, -hl],
    [-hw, 0, hl],
    [hw, 0, hl],
    [-hw, ramp.height, hl],
    [hw, ramp.height, hl],
  ];
  const cos = Math.cos(ramp.yaw);
  const sin = Math.sin(ramp.yaw);
  const out = new Float32Array(local.length * 3);
  local.forEach(([x, y, z], i) => {
    out[i * 3] = ramp.x + x * cos + z * sin;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = ramp.z - x * sin + z * cos;
  });
  return out;
}

export function buildTestPlanePhysics(physics: PhysicsWorld): void {
  const half = TEST_PLANE.size / 2;
  physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: half, y: 0.5, z: half });
  // Boundary walls.
  const wall = { thickness: 1, height: 4 };
  physics.addBox(
    { x: 0, y: wall.height / 2, z: half + 0.5 },
    { x: half, y: wall.height / 2, z: 0.5 },
    0,
    SURFACE_FRICTION.wall,
  );
  physics.addBox(
    { x: 0, y: wall.height / 2, z: -half - 0.5 },
    { x: half, y: wall.height / 2, z: 0.5 },
    0,
    SURFACE_FRICTION.wall,
  );
  physics.addBox(
    { x: half + 0.5, y: wall.height / 2, z: 0 },
    { x: 0.5, y: wall.height / 2, z: half },
    0,
    SURFACE_FRICTION.wall,
  );
  physics.addBox(
    { x: -half - 0.5, y: wall.height / 2, z: 0 },
    { x: 0.5, y: wall.height / 2, z: half },
    0,
    SURFACE_FRICTION.wall,
  );
  for (const ramp of TEST_PLANE.ramps) physics.addConvexHull(rampPoints(ramp));
  for (const block of TEST_PLANE.blocks) {
    physics.addBox(
      { x: block.x, y: block.height / 2, z: block.z },
      { x: block.width / 2, y: block.height / 2, z: block.depth / 2 },
      block.yaw,
      SURFACE_FRICTION.wall,
    );
  }
}
