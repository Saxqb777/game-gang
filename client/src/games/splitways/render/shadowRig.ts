/**
 * The sun and its shadows, per quality preset:
 *  - sun (high, medium): three's SunLight with two cascades that refit to each view camera inside
 *    every render() call, so near shadows are crisp and far ones still exist.
 *  - focus (low): one directional light whose shadow box (±extent) is re-aimed at the car being
 *    drawn before each view. One shadow pass per view instead of two keeps 4 views at 60 fps.
 * Changing the rig changes shader programs: only do it on the loading screen or in a benchmark,
 * then precompile again.
 */
import { DirectionalLight, Vector3, type Color, type Light, type Scene } from 'three';
import { SunLight } from 'three/examples/jsm/lights/SunLight.js';
import type { QualityPreset } from './quality';

export interface ShadowRig {
  /** SunLight (sun) or DirectionalLight (focus). */
  readonly light: Light;
  /** The focus rig re-aims its shadow box here; SunLight ignores it. */
  beforeView(focus: Vector3): void;
  /** Removes the light from the scene and frees its shadow map. */
  dispose(): void;
}

const SHADOW_BIAS = -0.0004;
const SHADOW_NORMAL_BIAS = 0.03;
/** SunLight sits this far from the origin; only its direction matters. */
const SUN_DISTANCE = 100;
/** The focus light's shadow camera starts this far up-sun of the car (m). */
const FOCUS_DISTANCE = 200;
const FOCUS_FAR = 400;

const lightRight = new Vector3();
const lightUp = new Vector3();
const snapped = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

/** `direction` points from the ground towards the sun. */
export function createShadowRig(
  scene: Scene,
  preset: QualityPreset,
  direction: Vector3,
  colour: Color,
  intensity: number,
): ShadowRig {
  const towardsSun = direction.clone().normalize();
  const shadow = preset.shadow;
  if (shadow.kind === 'sun') {
    const light = new SunLight(colour, intensity);
    light.position.copy(towardsSun).multiplyScalar(SUN_DISTANCE);
    light.castShadow = true;
    light.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
    light.shadow.camera.far = shadow.far;
    light.shadow.bias = SHADOW_BIAS;
    light.shadow.normalBias = SHADOW_NORMAL_BIAS;
    light.shadow.radius = preset.shadowRadius;
    scene.add(light);
    return {
      light,
      beforeView: () => undefined,
      dispose: () => {
        light.removeFromParent();
        light.dispose();
      },
    };
  }

  const light = new DirectionalLight(colour, intensity);
  light.castShadow = true;
  const { camera } = light.shadow;
  light.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
  camera.left = -shadow.extent;
  camera.right = shadow.extent;
  camera.top = shadow.extent;
  camera.bottom = -shadow.extent;
  camera.near = 1;
  camera.far = FOCUS_FAR;
  light.shadow.bias = SHADOW_BIAS;
  light.shadow.normalBias = SHADOW_NORMAL_BIAS;
  light.shadow.radius = preset.shadowRadius;
  scene.add(light, light.target);
  const texel = (shadow.extent * 2) / shadow.mapSize;
  lightRight.crossVectors(WORLD_UP, towardsSun).normalize();
  lightUp.crossVectors(towardsSun, lightRight).normalize();
  const right = lightRight.clone();
  const up = lightUp.clone();
  return {
    light,
    // three re-renders the shadow map on every render() call, so aiming it before each view keeps
    // shadows crisp near every car. Snapped to whole texels so edges don't shimmer as you drive.
    beforeView: (focus) => {
      const r = Math.round(focus.dot(right) / texel) * texel;
      const u = Math.round(focus.dot(up) / texel) * texel;
      const d = focus.dot(towardsSun);
      snapped.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(towardsSun, d);
      light.target.position.copy(snapped);
      light.position.copy(snapped).addScaledVector(towardsSun, FOCUS_DISTANCE);
      light.target.updateMatrixWorld();
      light.updateMatrixWorld();
    },
    dispose: () => {
      light.removeFromParent();
      light.target.removeFromParent();
      light.dispose();
    },
  };
}
