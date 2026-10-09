import { PerspectiveCamera, Vector3 } from 'three';

const centre = new Vector3();
const target = new Vector3();

/**
 * "TV broadcast" camera for the free cell of a 3-player split: hangs high above the pack and
 * slowly circles it, so the empty quarter of the screen shows the whole race.
 */
export class OverviewCamera {
  readonly camera = new PerspectiveCamera(45, 1, 1, 3000);
  /** Point the camera looks at (centre of the pack), for aiming the sun's shadow. */
  readonly focus = new Vector3();
  private readonly smoothedCentre = new Vector3();
  private angle = 0;
  private initialised = false;

  update(dt: number, positions: readonly Vector3[], aspect: number): void {
    if (positions.length === 0) return;
    centre.set(0, 0, 0);
    for (const p of positions) centre.add(p);
    centre.divideScalar(positions.length);
    let spread = 0;
    for (const p of positions) spread = Math.max(spread, p.distanceTo(centre));

    if (!this.initialised) {
      this.smoothedCentre.copy(centre);
      this.initialised = true;
    } else {
      this.smoothedCentre.lerp(centre, 1 - Math.exp(-dt * 2));
    }
    this.angle += dt * 0.08;
    const distance = 45 + spread * 1.2;
    target.copy(this.smoothedCentre);
    this.camera.position.set(
      target.x + Math.sin(this.angle) * distance,
      target.y + 28 + spread * 0.6,
      target.z + Math.cos(this.angle) * distance,
    );
    this.camera.lookAt(target);
    this.focus.copy(target);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
