import type { Collider, EventQueue, World } from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { PHYSICS } from '../config';
import { loadRapier, type Rapier } from './rapier';

/** Friction for static scenery. Walls are slippery so cars slide along them instead of sticking. */
export const SURFACE_FRICTION = { ground: 0.9, wall: 0.05 } as const;

const tmpQuat = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);

/** The Rapier world plus helpers for building static scenery. */
export class PhysicsWorld {
  readonly world: World;
  readonly events: EventQueue;
  /** Every static collider created through the helpers, by handle (used to tell walls from cars). */
  readonly staticColliders = new Set<number>();

  private constructor(readonly rapier: Rapier) {
    this.world = new rapier.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    this.world.timestep = 1 / PHYSICS.stepHz;
    this.events = new rapier.EventQueue(true);
  }

  static async create(): Promise<PhysicsWorld> {
    return new PhysicsWorld(await loadRapier());
  }

  /** Axis-aligned (optionally yawed) static box. `y` is the box centre. */
  addBox(
    centre: { x: number; y: number; z: number },
    half: { x: number; y: number; z: number },
    yaw = 0,
    friction: number = SURFACE_FRICTION.ground,
  ): Collider {
    const rotation = tmpQuat.setFromAxisAngle(AXIS_Y, yaw);
    return this.track(
      this.rapier.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(centre.x, centre.y, centre.z)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
        .setFriction(friction)
        .setFrictionCombineRule(this.rapier.CoefficientCombineRule.Min),
    );
  }

  addConvexHull(points: Float32Array, friction: number = SURFACE_FRICTION.ground): Collider {
    const desc = this.rapier.ColliderDesc.convexHull(points);
    if (!desc) throw new Error('Degenerate convex hull');
    return this.track(desc.setFriction(friction));
  }

  /** Static triangle mesh (the track surface). Internal edges are fixed so wheels don't catch on seams. */
  addTrimesh(
    vertices: Float32Array,
    indices: Uint32Array,
    friction: number = SURFACE_FRICTION.ground,
  ): Collider {
    return this.track(
      this.rapier.ColliderDesc.trimesh(
        vertices,
        indices,
        this.rapier.TriMeshFlags.FIX_INTERNAL_EDGES,
      ).setFriction(friction),
    );
  }

  dispose(): void {
    this.events.free();
    this.world.free();
  }

  private track(desc: ReturnType<Rapier['ColliderDesc']['cuboid']>): Collider {
    const collider = this.world.createCollider(desc);
    this.staticColliders.add(collider.handle);
    return collider;
  }
}
