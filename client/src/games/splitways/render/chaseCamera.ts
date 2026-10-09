import { MathUtils, PerspectiveCamera, Vector3, type Quaternion } from 'three';
import { CAMERA, ENGINE } from '../config';

const LOCAL_FORWARD = new Vector3(0, 0, 1);
const carForward = new Vector3();
const travel = new Vector3();
const desiredHeading = new Vector3();
const desiredOffset = new Vector3();
const lookAt = new Vector3();

/** Frame-rate independent smoothing factor for exponential follow. */
function damp(stiffness: number, dt: number): number {
  return 1 - Math.exp(-stiffness * dt);
}

/**
 * Third-person chase camera: sits behind the car, lags a little in rotation so corners feel
 * dynamic, swings towards the direction of travel in slides, and widens its FOV with speed.
 */
export class ChaseCamera {
  readonly camera = new PerspectiveCamera(CAMERA.baseFov, 1, 0.1, 3000);
  private readonly heading = new Vector3(0, 0, 1);
  private readonly offset = new Vector3();
  private smoothedHeight = 0;
  private initialised = false;
  /** 0..1, set on impacts and decays by itself. */
  private shake = 0;
  private shakeTime = 0;

  addShake(amount: number): void {
    this.shake = Math.min(1, Math.max(this.shake, amount));
  }

  /** Jump straight to the resting position (spawn, respawn). */
  snap(): void {
    this.initialised = false;
  }

  update(
    dt: number,
    carPosition: Vector3,
    carQuaternion: Quaternion,
    velocity: Vector3,
    aspect: number,
  ): void {
    carForward.copy(LOCAL_FORWARD).applyQuaternion(carQuaternion);
    carForward.y = 0;
    if (carForward.lengthSq() < 1e-6) carForward.copy(this.heading);
    carForward.normalize();

    travel.set(velocity.x, 0, velocity.z);
    const speed = travel.length();
    desiredHeading.copy(carForward);
    if (speed > 3 && travel.dot(carForward) > 0) {
      travel.divideScalar(speed);
      desiredHeading
        .lerp(travel, CAMERA.velocityHeadingBlend * Math.min(1, (speed - 3) / 10))
        .normalize();
    }

    const speed01 = Math.min(1, speed / ENGINE.topSpeed);
    const distance = CAMERA.distance + speed01 * 1.6;
    if (!this.initialised) {
      this.heading.copy(desiredHeading);
      this.smoothedHeight = carPosition.y;
    } else {
      this.heading.lerp(desiredHeading, damp(CAMERA.followStiffness * 0.6, dt)).normalize();
      this.smoothedHeight +=
        (carPosition.y - this.smoothedHeight) * damp(CAMERA.followStiffness, dt);
    }
    desiredOffset.copy(this.heading).multiplyScalar(-distance);
    desiredOffset.y = CAMERA.height - speed01 * 0.25;
    if (!this.initialised) this.offset.copy(desiredOffset);
    else this.offset.lerp(desiredOffset, damp(CAMERA.followStiffness, dt));
    this.initialised = true;

    const camera = this.camera;
    camera.position.set(carPosition.x, this.smoothedHeight, carPosition.z).add(this.offset);
    camera.position.y = Math.max(camera.position.y, carPosition.y + 0.6);

    if (this.shake > 0.001) {
      this.shakeTime += dt;
      const amplitude = this.shake * this.shake * 0.35;
      camera.position.x += Math.sin(this.shakeTime * 71) * amplitude;
      camera.position.y += Math.sin(this.shakeTime * 53 + 1.3) * amplitude * 0.7;
      camera.position.z += Math.sin(this.shakeTime * 61 + 2.1) * amplitude;
      this.shake *= Math.exp(-dt * 6);
    }

    lookAt
      .set(carPosition.x, this.smoothedHeight + CAMERA.lookHeight, carPosition.z)
      .addScaledVector(this.heading, CAMERA.lookAhead);
    camera.lookAt(lookAt);

    // Wider FOV with speed; but never let a very wide viewport turn into a fish-eye.
    const fov = CAMERA.baseFov + CAMERA.speedFov * speed01 * speed01;
    const maxVertical = MathUtils.radToDeg(
      2 * Math.atan(Math.tan(MathUtils.degToRad(CAMERA.maxHorizontalFov) / 2) / aspect),
    );
    camera.fov = Math.min(fov, maxVertical);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
}
