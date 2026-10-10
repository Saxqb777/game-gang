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
  BRAKES,
  CAR,
  DRIFT,
  ENGINE,
  PHYSICS,
  RESPAWN,
  SLIPSTREAM,
  STEERING,
  TYRES,
  WHEELS,
} from '../config';
import { NEUTRAL_INPUT, copyInput, type DriveInput } from './input';
import type { Rapier } from './rapier';

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

  // Per-wheel state for visuals, skid marks and sound.
  readonly wheelSpin = new Float32Array(WHEEL_COUNT);
  readonly wheelSuspension = new Float32Array(WHEEL_COUNT);
  readonly wheelInContact = new Uint8Array(WHEEL_COUNT);
  /** Sideways sliding speed at each tyre contact (m/s). */
  readonly wheelSlide = new Float32Array(WHEEL_COUNT);
  readonly wheelContact = Array.from({ length: WHEEL_COUNT }, () => new Vector3());
  readonly wheelSkidding = new Uint8Array(WHEEL_COUNT);

  /** Wheel hub positions relative to the car origin when the suspension is at rest under load. */
  static readonly wheelOffsets: readonly Vector3[] = [
    new Vector3(WHEELS.halfTrack, WHEELS.centreHeight, WHEELS.wheelbaseHalf),
    new Vector3(-WHEELS.halfTrack, WHEELS.centreHeight, WHEELS.wheelbaseHalf),
    new Vector3(WHEELS.halfTrack, WHEELS.centreHeight, -WHEELS.wheelbaseHalf),
    new Vector3(-WHEELS.halfTrack, WHEELS.centreHeight, -WHEELS.wheelbaseHalf),
  ];
  /** Height of the suspension mount above the car origin. Wheel centre = mount - suspension length. */
  static readonly mountHeight =
    WHEELS.centreHeight +
    WHEELS.suspensionRestLength -
    // Static sag: springs compress by g / (4 * stiffness) under the car's own weight.
    PHYSICS.gravity / (4 * WHEELS.suspensionStiffness);

  constructor(
    rapier: Rapier,
    private readonly world: World,
    spawn: Spawn,
  ) {
    const yawQuat = tmpQuat.setFromAxisAngle(WORLD_UP, spawn.yaw);
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setRotation({ x: yawQuat.x, y: yawQuat.y, z: yawQuat.z, w: yawQuat.w })
        .setAdditionalMassProperties(
          CAR.mass,
          { x: 0, y: CAR.centreOfMassHeight, z: CAR.centreOfMassForward },
          { x: CAR.inertia.pitch, y: CAR.inertia.yaw, z: CAR.inertia.roll },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.cuboid(
        CAR.chassisHalfExtents.x,
        CAR.chassisHalfExtents.y,
        CAR.chassisHalfExtents.z,
      )
        .setTranslation(0, CAR.chassisCentreHeight, 0)
        .setDensity(0)
        .setRestitution(CAR.bodyRestitution)
        .setFriction(CAR.bodyFriction)
        .setActiveEvents(rapier.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(CAR.mass * 25),
      this.body,
    );

    this.vehicle = world.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const offset = Car.wheelOffsets[i] as Vector3;
      this.vehicle.addWheel(
        { x: offset.x, y: Car.mountHeight, z: offset.z },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        WHEELS.suspensionRestLength,
        WHEELS.radius,
      );
      this.vehicle.setWheelSuspensionStiffness(i, WHEELS.suspensionStiffness);
      this.vehicle.setWheelSuspensionCompression(i, WHEELS.suspensionCompression);
      this.vehicle.setWheelSuspensionRelaxation(i, WHEELS.suspensionRelaxation);
      this.vehicle.setWheelMaxSuspensionForce(i, WHEELS.maxSuspensionForce);
      this.vehicle.setWheelMaxSuspensionTravel(i, WHEELS.maxSuspensionTravel);
      this.vehicle.setWheelFrictionSlip(i, i < 2 ? TYRES.frontGrip : TYRES.rearGrip);
      this.vehicle.setWheelSideFrictionStiffness(i, TYRES.sideStiffness);
    }
    this.readPose();
    this.prevPosition.copy(this.position);
    this.prevQuaternion.copy(this.quaternion);
  }

  /** Speed in km/h for HUDs. */
  get speedKph(): number {
    return Math.abs(this.forwardSpeed) * 3.6;
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
    const reversing = this.applyDrive(forwardSpeed);
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
      scratch.crossVectors(up, WORLD_UP).multiplyScalar(ASSISTS.airLevelling);
      torque.add(scratch);
      const yawRate = angularVelocity.dot(WORLD_UP);
      scratch
        .copy(angularVelocity)
        .addScaledVector(WORLD_UP, -yawRate)
        .multiplyScalar(-ASSISTS.airDamping);
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

  /** Engine, brakes and reverse. Returns true while reversing. */
  private applyDrive(forwardSpeed: number): boolean {
    const { input, vehicle } = this;
    let engine = 0;
    let brake = 0;
    let reversing = false;
    if (input.throttle > 0) {
      const falloff = forwardSpeed > 0 ? Math.max(0, 1 - (forwardSpeed / ENGINE.topSpeed) ** 2) : 1;
      engine = input.throttle * ENGINE.force * falloff;
    }
    if (input.brake > 0) {
      if (input.throttle === 0 && forwardSpeed < BRAKES.reverseBelowSpeed) {
        reversing = true;
        const falloff =
          forwardSpeed < 0 ? Math.max(0, 1 - (-forwardSpeed / ENGINE.reverseTopSpeed) ** 2) : 1;
        engine = -input.brake * ENGINE.reverseForce * falloff;
      } else {
        brake = input.brake * BRAKES.impulse;
      }
    }
    const frontEngine = (engine * ENGINE.frontShare) / 2;
    const rearEngine = (engine * (1 - ENGINE.frontShare)) / 2;
    const frontBrake = brake * BRAKES.frontBias * 2;
    let rearBrake = brake * (1 - BRAKES.frontBias) * 2;
    if (input.handbrake) rearBrake = Math.max(rearBrake, DRIFT.handbrakeImpulse);
    for (const i of FRONT_WHEELS) {
      vehicle.setWheelEngineForce(i, frontEngine);
      vehicle.setWheelBrake(i, frontBrake);
    }
    for (const i of REAR_WHEELS) {
      vehicle.setWheelEngineForce(i, input.handbrake ? 0 : rearEngine);
      vehicle.setWheelBrake(i, rearBrake);
    }
    return reversing;
  }

  private applyGrip(absForwardSpeed: number, reversing: boolean): void {
    const { input, vehicle } = this;
    let rearGrip: number = TYRES.rearGrip;
    let rearSide: number = TYRES.sideStiffness;
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
    for (const i of REAR_WHEELS) {
      vehicle.setWheelFrictionSlip(i, rearGrip);
      vehicle.setWheelSideFrictionStiffness(i, rearSide);
    }
  }

  private addGroundAssists(
    dt: number,
    speed: number,
    forwardSpeed: number,
    lateralSpeed: number,
    grounded: number,
  ): void {
    const contactShare = grounded / WHEEL_COUNT;

    // Downforce: grip grows with speed.
    impulse.addScaledVector(up, -ASSISTS.downforce * speed * speed * contactShare);

    // Air drag and rolling resistance, against the direction of travel.
    if (speed > 0.05) {
      // Slipstream is pure aero: the car in front takes some of the air drag.
      const drag = ENGINE.drag * (1 - SLIPSTREAM.dragCut * this.draft);
      const resistance = drag * speed * speed + ENGINE.rollingResistance * Math.min(1, speed / 2);
      impulse.addScaledVector(velocity, -resistance / speed);
    }

    // Anti-roll and pitch damping keep the body flat in hard corners and under braking.
    const rollRate = angularVelocity.dot(forward);
    torque.addScaledVector(
      forward,
      ASSISTS.antiRoll * right.y - ASSISTS.antiRollDamping * rollRate,
    );
    torque.addScaledVector(right, -ASSISTS.antiPitchDamping * angularVelocity.dot(right));

    // Yaw limiter: each step removes a share of any spin faster than the limit, so spins stay recoverable.
    const yawRate = angularVelocity.dot(up);
    const excess = Math.abs(yawRate) - ASSISTS.maxYawRate;
    if (excess > 0) {
      torque.addScaledVector(
        up,
        (-Math.sign(yawRate) * excess * CAR.inertia.yaw * ASSISTS.yawLimitStrength) / dt,
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
        torque.addScaledVector(up, -slideSide * over * strength * CAR.inertia.yaw * 4);
      }
    }
  }
}
