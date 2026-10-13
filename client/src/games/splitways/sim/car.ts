/**
 * One car: a Rapier rigid body driven by Rapier's ray-cast vehicle controller, plus the arcade
 * assists that make it feel heavy but grippy (downforce, anti-roll, yaw limiting, slide alignment)
 * and the drift tricks (handbrake and brake-induced oversteer). No rendering here, so it runs in
 * Node for the tuning tests too.
 */
import type {
  Collider,
  DynamicRayCastVehicleController,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import { MathUtils, Quaternion, Vector3 } from 'three';
import {
  ASSISTS,
  CAR,
  DRIFT,
  PHYSICS,
  RESPAWN,
  REVERSE,
  SLIPSTREAM,
  STEERING,
  SURFACES,
  WHEELS,
} from '../config';
import { REFERENCE_SPEC, type CarSpec, type WheelSpec } from './carSpec';
import { NEUTRAL_INPUT, copyInput, type DriveInput } from './input';
import type { Rapier } from './rapier';
import { SURFACE, SURFACE_NAMES, type SurfaceId } from '../track/surfaces';

export const WHEEL_COUNT = 4;
/** Wheel order used everywhere: front left, front right, rear left, rear right. */
export const FRONT_WHEELS = [0, 1] as const;
export const REAR_WHEELS = [2, 3] as const;

const WORLD_UP = new Vector3(0, 1, 0);
const LOCAL_FORWARD = new Vector3(0, 0, 1);
const LOCAL_RIGHT = new Vector3(-1, 0, 0);
const LOCAL_UP = new Vector3(0, 1, 0);

/** Lateral sliding speed (m/s) at a tyre contact above which it counts as skidding. */
const SKID_SLIDE_SPEED = 2.2;

/** Suspension mount above the car origin for a hub that sits `centreHeight` up at rest. */
function mountHeightFor(centreHeight: number): number {
  return (
    centreHeight +
    WHEELS.suspensionRestLength -
    // Static sag: springs compress by g / (4 * stiffness) under the car's own weight. Rapier scales
    // the spring force by the chassis mass, so the sag is the same for every car.
    PHYSICS.gravity / (4 * WHEELS.suspensionStiffness)
  );
}

export interface Spawn {
  x: number;
  y: number;
  z: number;
  /** Heading in radians; 0 faces +Z. */
  yaw: number;
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

// Scratch objects so the per-step code never allocates.
const tmpQuat = new Quaternion();
const tmpVec = { x: 0, y: 0, z: 0 };
const tmpVec2 = { x: 0, y: 0, z: 0 };
const tmpRot = { x: 0, y: 0, z: 0, w: 1 };
const forward = new Vector3();
const right = new Vector3();
const up = new Vector3();
const velocity = new Vector3();
const angularVelocity = new Vector3();
const impulse = new Vector3();
const torque = new Vector3();
const scratch = new Vector3();
const contactPoint = new Vector3();
const pointVelocity = new Vector3();
const wheelSide = new Vector3();

export class Car {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly vehicle: DynamicRayCastVehicleController;

  /** Controls applied on the next physics step. */
  readonly input: DriveInput = copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT);

  // Pose after the latest physics step, and the one before (the renderer interpolates between them).
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();
  readonly prevPosition = new Vector3();
  readonly prevQuaternion = new Quaternion();

  readonly velocity = new Vector3();
  /** Signed speed along the car's nose (m/s). Negative when reversing. */
  forwardSpeed = 0;
  /** Angle between where the car points and where it is going (rad). Big = sliding. */
  slipAngle = 0;
  /** Current front wheel angle (rad). Positive = left. */
  steerAngle = 0;
  groundedWheels = 0;
  /** Seconds the car has been upside down or on its side. */
  flippedTime = 0;
  /** Slipstream strength this step, 0..1. Set by Slipstream. */
  draft = 0;
  /** Seconds brake has been held at a standstill towards engaging reverse (0 when not arming). */
  reverseArm = 0;
  /** In reverse gear: brake drives the car backwards until gas or a brake release. */
  inReverse = false;

  // Per-wheel state for visuals, skid marks and sound.
  readonly wheelSpin = new Float32Array(WHEEL_COUNT);
  readonly wheelSuspension = new Float32Array(WHEEL_COUNT);
  readonly wheelInContact = new Uint8Array(WHEEL_COUNT);
  /** Sideways sliding speed at each tyre contact (m/s). */
  readonly wheelSlide = new Float32Array(WHEEL_COUNT);
  readonly wheelContact = Array.from({ length: WHEEL_COUNT }, () => new Vector3());
  readonly wheelSkidding = new Uint8Array(WHEEL_COUNT);
  /** Ground surface under each wheel (SurfaceId); keeps the last value while the wheel is in the air. */
  readonly wheelSurface = new Uint8Array(WHEEL_COUNT);

  /**
   * Suspension mount height of the reference car only. The scene still reads it until its per-car
   * rewrite (C5) switches to `mountHeights`; physics never uses it.
   */
  static readonly mountHeight = mountHeightFor(WHEELS.centreHeight);

  /** Wheel hub positions relative to the car origin when the suspension is at rest under load (FL, FR, RL, RR). */
  readonly wheelOffsets: readonly Vector3[];
  /** Height of each wheel's suspension mount above the car origin. Wheel centre = mount - suspension length. */
  readonly mountHeights: Float32Array;

  constructor(
    rapier: Rapier,
    private readonly world: World,
    spawn: Spawn,
    private readonly surfaceOf: (collider: Collider | null) => SurfaceId = () => SURFACE.asphalt,
    readonly spec: CarSpec = REFERENCE_SPEC,
  ) {
    this.wheelOffsets = spec.wheels.map((w) => new Vector3(w.x, w.centreHeight, w.z));
    this.mountHeights = Float32Array.from(spec.wheels, (w) => mountHeightFor(w.centreHeight));
    const yawQuat = tmpQuat.setFromAxisAngle(WORLD_UP, spawn.yaw);
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setRotation({ x: yawQuat.x, y: yawQuat.y, z: yawQuat.z, w: yawQuat.w })
        .setAdditionalMassProperties(
          spec.mass,
          { x: 0, y: spec.com.height, z: spec.com.forward },
          { x: spec.inertia.pitch, y: spec.inertia.yaw, z: spec.inertia.roll },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.cuboid(
        spec.chassis.halfExtents.x,
        spec.chassis.halfExtents.y,
        spec.chassis.halfExtents.z,
      )
        .setTranslation(0, spec.chassis.centreHeight, 0)
        .setDensity(0)
        .setRestitution(CAR.bodyRestitution)
        .setFriction(CAR.bodyFriction)
        .setActiveEvents(rapier.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(spec.mass * 25),
      this.body,
    );

    this.vehicle = world.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const offset = this.wheelOffsets[i] as Vector3;
      this.vehicle.addWheel(
        { x: offset.x, y: this.mountHeights[i] as number, z: offset.z },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        WHEELS.suspensionRestLength,
        (spec.wheels[i] as WheelSpec).radius,
      );
      this.vehicle.setWheelSuspensionStiffness(i, WHEELS.suspensionStiffness);
      this.vehicle.setWheelSuspensionCompression(i, WHEELS.suspensionCompression);
      this.vehicle.setWheelSuspensionRelaxation(i, WHEELS.suspensionRelaxation);
      this.vehicle.setWheelMaxSuspensionForce(i, WHEELS.maxSuspensionForce);
      this.vehicle.setWheelMaxSuspensionTravel(i, WHEELS.maxSuspensionTravel);
      this.vehicle.setWheelSideFrictionStiffness(i, spec.tyres.sideStiffness);
    }
    this.readPose();
    this.prevPosition.copy(this.position);
    this.prevQuaternion.copy(this.quaternion);
  }

  /** Reverse gear for the HUD and the pad: arming while brake is held at a standstill, then on. */
  get reverseState(): 'off' | 'arming' | 'on' {
    if (this.inReverse) return 'on';
    return this.reverseArm > 0 ? 'arming' : 'off';
  }

  /** Speed in km/h for HUDs. */
  get speedKph(): number {
    return Math.abs(this.forwardSpeed) * 3.6;
  }

  /** The most common surface under the wheels in contact (ties go to the higher id); asphalt when airborne. */
  get dominantSurface(): SurfaceId {
    let best: SurfaceId = SURFACE.asphalt;
    let bestCount = 0;
    for (let surface = SURFACE_NAMES.length - 1; surface >= 0; surface--) {
      let count = 0;
      for (let i = 0; i < WHEEL_COUNT; i++) {
        if (this.wheelInContact[i] && this.wheelSurface[i] === surface) count++;
      }
      if (count > bestCount) {
        best = surface as SurfaceId;
        bestCount = count;
      }
    }
    return best;
  }

  /** Applies controls and assists. Call before `world.step()`. */
  prePhysics(dt: number): void {
    const { body, vehicle } = this;
    body.rotation(tmpRot);
    tmpQuat.set(tmpRot.x, tmpRot.y, tmpRot.z, tmpRot.w);
    forward.copy(LOCAL_FORWARD).applyQuaternion(tmpQuat);
    right.copy(LOCAL_RIGHT).applyQuaternion(tmpQuat);
    up.copy(LOCAL_UP).applyQuaternion(tmpQuat);
    body.linvel(tmpVec);
    velocity.set(tmpVec.x, tmpVec.y, tmpVec.z);
    body.angvel(tmpVec);
    angularVelocity.set(tmpVec.x, tmpVec.y, tmpVec.z);

    const forwardSpeed = velocity.dot(forward);
    const lateralSpeed = velocity.dot(right);
    const speed = velocity.length();

    this.applySteering(dt, Math.abs(forwardSpeed));
    const reversing = this.applyDrive(forwardSpeed, dt);
    this.applyGrip(Math.abs(forwardSpeed), reversing);

    vehicle.updateVehicle(dt);

    let grounded = 0;
    for (let i = 0; i < WHEEL_COUNT; i++) if (vehicle.wheelIsInContact(i)) grounded++;
    this.groundedWheels = grounded;

    impulse.set(0, 0, 0);
    torque.set(0, 0, 0);
    if (grounded > 0) {
      this.addGroundAssists(dt, speed, forwardSpeed, lateralSpeed, grounded);
    } else {
      // Airborne: rotate the car's up axis back towards the sky so jumps land on the wheels.
      scratch.crossVectors(up, WORLD_UP).multiplyScalar(ASSISTS.airLevelling * this.spec.massScale);
      torque.add(scratch);
      const yawRate = angularVelocity.dot(WORLD_UP);
      scratch
        .copy(angularVelocity)
        .addScaledVector(WORLD_UP, -yawRate)
        .multiplyScalar(-ASSISTS.airDamping * this.spec.massScale);
      torque.add(scratch);
    }
    body.applyImpulse(impulse.multiplyScalar(dt), true);
    body.applyTorqueImpulse(torque.multiplyScalar(dt), true);

    this.flippedTime = up.y < RESPAWN.flippedUpDot ? this.flippedTime + dt : 0;
  }

  /** Reads the new pose and per-wheel state. Call after `world.step()`. */
  postPhysics(): void {
    this.prevPosition.copy(this.position);
    this.prevQuaternion.copy(this.quaternion);
    this.readPose();

    const { vehicle, body } = this;
    forward.copy(LOCAL_FORWARD).applyQuaternion(this.quaternion);
    right.copy(LOCAL_RIGHT).applyQuaternion(this.quaternion);
    body.linvel(tmpVec);
    this.velocity.set(tmpVec.x, tmpVec.y, tmpVec.z);
    this.forwardSpeed = this.velocity.dot(forward);
    const lateral = this.velocity.dot(right);
    this.slipAngle =
      this.velocity.lengthSq() > 4
        ? Math.atan2(lateral, Math.max(Math.abs(this.forwardSpeed), 0.5))
        : 0;

    for (let i = 0; i < WHEEL_COUNT; i++) {
      this.wheelSpin[i] = vehicle.wheelRotation(i) ?? 0;
      this.wheelSuspension[i] = vehicle.wheelSuspensionLength(i) ?? WHEELS.suspensionRestLength;
      const inContact = vehicle.wheelIsInContact(i);
      this.wheelInContact[i] = inContact ? 1 : 0;
      if (inContact) this.wheelSurface[i] = this.surfaceOf(vehicle.wheelGroundObject(i));
      let slide = 0;
      if (inContact) {
        vehicle.wheelContactPoint(i, tmpVec);
        contactPoint.set(tmpVec.x, tmpVec.y, tmpVec.z);
        (this.wheelContact[i] as Vector3).copy(contactPoint);
        body.velocityAtPoint(tmpVec, tmpVec2);
        pointVelocity.set(tmpVec2.x, tmpVec2.y, tmpVec2.z);
        const steer = i < 2 ? this.steerAngle : 0;
        wheelSide.copy(right).applyAxisAngle(WORLD_UP, steer);
        slide = Math.abs(pointVelocity.dot(wheelSide));
      }
      this.wheelSlide[i] = slide;
      const lockedRear = i >= 2 && this.input.handbrake && Math.abs(this.forwardSpeed) > 4;
      this.wheelSkidding[i] = inContact && (slide > SKID_SLIDE_SPEED || lockedRear) ? 1 : 0;
    }
  }

  /** Teleports the car (respawn, grid placement) with no leftover motion or interpolation smear. */
  placeAt(spawn: Spawn): void {
    const yawQuat = tmpQuat.setFromAxisAngle(WORLD_UP, spawn.yaw);
    this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
    this.body.setRotation({ x: yawQuat.x, y: yawQuat.y, z: yawQuat.z, w: yawQuat.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steerAngle = 0;
    this.flippedTime = 0;
    this.draft = 0;
    this.reverseArm = 0;
    this.inReverse = false;
    this.readPose();
    this.prevPosition.copy(this.position);
    this.prevQuaternion.copy(this.quaternion);
    this.velocity.set(0, 0, 0);
    this.forwardSpeed = 0;
  }

  dispose(): void {
    this.world.removeVehicleController(this.vehicle);
    this.world.removeRigidBody(this.body);
  }

  private readPose(): void {
    this.body.translation(tmpVec);
    this.position.set(tmpVec.x, tmpVec.y, tmpVec.z);
    this.body.rotation(tmpRot);
    this.quaternion.set(tmpRot.x, tmpRot.y, tmpRot.z, tmpRot.w);
  }

  private applySteering(dt: number, absForwardSpeed: number): void {
    const blend = MathUtils.smoothstep(absForwardSpeed, STEERING.lowSpeed, STEERING.highSpeed);
    const maxAngle = MathUtils.lerp(STEERING.maxAngleLowSpeed, STEERING.maxAngleHighSpeed, blend);
    // Input +1 is right; a positive wheel angle turns left around the up axis.
    const target = -this.input.steer * maxAngle;
    const turningFurther =
      Math.abs(target) > Math.abs(this.steerAngle) && target * this.steerAngle >= 0;
    const rate =
      (turningFurther ? STEERING.turnRateDegPerS : STEERING.returnRateDegPerS) * MathUtils.DEG2RAD;
    this.steerAngle = approach(this.steerAngle, target, rate * dt);
    for (const i of FRONT_WHEELS) this.vehicle.setWheelSteering(i, this.steerAngle);
  }

  /**
   * Engine, brakes and reverse. Reverse is an explicit gear: hold brake (no gas) at a standstill for
   * `REVERSE.armSeconds` to engage it, then brake drives backwards until gas or a brake release.
   * Thresholds rather than `=== 0`, because pad throttle is analog. Returns true while in reverse.
   */
  private applyDrive(forwardSpeed: number, dt: number): boolean {
    const { input, vehicle } = this;
    const { engine: spec, brakes } = this.spec;
    const gas = input.throttle >= REVERSE.gasThreshold;
    if (this.inReverse) {
      if (gas || input.brake <= REVERSE.releaseBrake) this.inReverse = false;
    } else if (
      input.brake > REVERSE.brakeThreshold &&
      !gas &&
      forwardSpeed < REVERSE.standstillSpeed
    ) {
      this.reverseArm += dt;
      if (this.reverseArm >= REVERSE.armSeconds) this.inReverse = true;
    } else {
      this.reverseArm = 0;
    }
    if (this.inReverse) this.reverseArm = 0;

    let engine = 0;
    let brake = 0;
    if (this.inReverse) {
      const falloff =
        forwardSpeed < 0 ? Math.max(0, 1 - (-forwardSpeed / spec.reverseTopSpeed) ** 2) : 1;
      engine = -input.brake * spec.reverseForce * falloff;
    } else {
      if (input.throttle > 0) {
        const falloff =
          forwardSpeed > 0 ? Math.max(0, 1 - (forwardSpeed / spec.topSpeed) ** spec.curve) : 1;
        engine = input.throttle * spec.force * falloff;
      }
      if (input.brake > 0) brake = input.brake * brakes.impulse;
    }
    const frontEngine = (engine * spec.frontShare) / 2;
    const rearEngine = (engine * (1 - spec.frontShare)) / 2;
    const frontBrake = brake * brakes.frontBias * 2;
    let rearBrake = brake * (1 - brakes.frontBias) * 2;
    if (input.handbrake) rearBrake = Math.max(rearBrake, brakes.handbrakeImpulse);
    for (const i of FRONT_WHEELS) {
      vehicle.setWheelEngineForce(i, frontEngine);
      vehicle.setWheelBrake(i, frontBrake);
    }
    for (const i of REAR_WHEELS) {
      vehicle.setWheelEngineForce(i, input.handbrake ? 0 : rearEngine);
      vehicle.setWheelBrake(i, rearBrake);
    }
    return this.inReverse;
  }

  private applyGrip(absForwardSpeed: number, reversing: boolean): void {
    const { input, vehicle } = this;
    const { tyres } = this.spec;
    let rearGrip = tyres.rearGrip;
    let rearSide = tyres.sideStiffness;
    if (input.handbrake) {
      rearGrip *= DRIFT.handbrakeRearGrip;
      rearSide *= DRIFT.handbrakeRearSide;
    } else if (
      !reversing &&
      input.brake > 0 &&
      Math.abs(input.steer) > DRIFT.brakeOversteerMinSteer &&
      absForwardSpeed > DRIFT.brakeOversteerMinSpeed
    ) {
      // Weight shifts onto the nose under braking: the tail goes light and swings out.
      rearSide *= MathUtils.lerp(1, DRIFT.brakeOversteerRearSide, Math.min(1, input.brake));
    }
    // Tyre grip times the grip of whatever each wheel is rolling on, set every step.
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const base = i < 2 ? tyres.frontGrip : rearGrip;
      const surface = SURFACES[SURFACE_NAMES[this.wheelSurface[i] as number] ?? 'asphalt'];
      vehicle.setWheelFrictionSlip(i, base * surface.grip);
    }
    for (const i of REAR_WHEELS) vehicle.setWheelSideFrictionStiffness(i, rearSide);
  }

  private addGroundAssists(
    dt: number,
    speed: number,
    forwardSpeed: number,
    lateralSpeed: number,
    grounded: number,
  ): void {
    const contactShare = grounded / WHEEL_COUNT;
    const { spec } = this;
    const massScale = spec.massScale;

    // Downforce: grip grows with speed.
    impulse.addScaledVector(up, -spec.downforce * speed * speed * contactShare);

    // Air drag and rolling resistance, against the direction of travel.
    if (speed > 0.05) {
      // Slipstream is pure aero: the car in front takes some of the air drag.
      const drag = spec.engine.drag * (1 - SLIPSTREAM.dragCut * this.draft);
      // Grass and gravel drag at the wheels on top of the tyres' own rolling resistance.
      let surfaceRolling = 0;
      for (let i = 0; i < WHEEL_COUNT; i++) {
        if (!this.wheelInContact[i]) continue;
        const surface = SURFACES[SURFACE_NAMES[this.wheelSurface[i] as number] ?? 'asphalt'];
        surfaceRolling += surface.rolling / WHEEL_COUNT;
      }
      // Rolling resistance pushes back in proportion to weight, so it scales with mass like the tyres'.
      const rolling =
        (spec.engine.rollingResistance + surfaceRolling * massScale) * Math.min(1, speed / 2);
      const resistance = drag * speed * speed + rolling;
      impulse.addScaledVector(velocity, -resistance / speed);
    }

    // Anti-roll and pitch damping keep the body flat in hard corners and under braking.
    const rollRate = angularVelocity.dot(forward);
    torque.addScaledVector(
      forward,
      (ASSISTS.antiRoll * right.y - ASSISTS.antiRollDamping * rollRate) * massScale,
    );
    torque.addScaledVector(
      right,
      -ASSISTS.antiPitchDamping * massScale * angularVelocity.dot(right),
    );

    // Yaw limiter: each step removes a share of any spin faster than the limit, so spins stay recoverable.
    const yawRate = angularVelocity.dot(up);
    const excess = Math.abs(yawRate) - ASSISTS.maxYawRate;
    if (excess > 0) {
      torque.addScaledVector(
        up,
        (-Math.sign(yawRate) * excess * spec.inertia.yaw * ASSISTS.yawLimitStrength) / dt,
      );
    }

    // Slide alignment: when the car travels sideways, ease its nose towards the direction of travel.
    // Steering into the slide (counter-steer) strengthens it, so catching a drift feels natural.
    if (!this.input.handbrake && speed > 4 && forwardSpeed > 0) {
      const slip = Math.atan2(lateralSpeed, forwardSpeed);
      const over = Math.abs(slip) - ASSISTS.slideAlignStart;
      if (over > 0) {
        const slideSide = Math.sign(slip); // +1 = travelling to the car's right
        const counterSteer = Math.max(0, this.input.steer * slideSide);
        const strength = ASSISTS.slideAlignStrength * (1 + DRIFT.counterSteerAssist * counterSteer);
        // Yawing right is a negative rotation around up.
        torque.addScaledVector(up, -slideSide * over * strength * spec.inertia.yaw * 4);
      }
    }
  }
}
