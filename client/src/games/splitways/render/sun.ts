import { DirectionalLight, Vector3, type Color, type Scene } from 'three';
import { RENDER } from '../config';

const lightRight = new Vector3();
const lightUp = new Vector3();
const snapped = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

/**
 * The sun: one directional light whose shadow covers a tight box around whichever car is being
 * rendered. three.js re-renders the shadow map on every render call, so aiming it before each
 * viewport keeps shadows crisp near every car without a huge shadow map.
 */
export class Sun {
  readonly light: DirectionalLight;
  /** Unit vector from the ground towards the sun. */
  readonly direction: Vector3;

  constructor(scene: Scene, direction: Vector3, colour: Color, intensity: number) {
    this.direction = direction.clone().normalize();
    this.light = new DirectionalLight(colour, intensity);
    this.light.castShadow = true;
    const shadow = this.light.shadow;
    shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    const extent = RENDER.shadowExtent;
    shadow.camera.left = -extent;
    shadow.camera.right = extent;
    shadow.camera.top = extent;
    shadow.camera.bottom = -extent;
    shadow.camera.near = 1;
    shadow.camera.far = 400;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.03;
    // Soft edges (PCF radius in texels).
    shadow.radius = 2.5;
    scene.add(this.light, this.light.target);
  }

  /** Centre the shadow on `target`, snapped to whole shadow texels so edges don't shimmer as you drive. */
  focus(target: Vector3): void {
    const texel = (RENDER.shadowExtent * 2) / RENDER.shadowMapSize;
    lightRight.crossVectors(WORLD_UP, this.direction).normalize();
    lightUp.crossVectors(this.direction, lightRight).normalize();
    const r = Math.round(target.dot(lightRight) / texel) * texel;
    const u = Math.round(target.dot(lightUp) / texel) * texel;
    const d = target.dot(this.direction);
    snapped
      .copy(lightRight)
      .multiplyScalar(r)
      .addScaledVector(lightUp, u)
      .addScaledVector(this.direction, d);
    this.light.target.position.copy(snapped);
    this.light.position.copy(snapped).addScaledVector(this.direction, 200);
    this.light.target.updateMatrixWorld();
    this.light.updateMatrixWorld();
  }
}
