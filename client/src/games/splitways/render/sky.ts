/**
 * Sky and image-based light from a CC0 Poly Haven HDRI (see assets/ASSETS.md). The picture is
 * rotated so its sun sits at LIGHTING.sunBearing, and the directional light is aimed at that same
 * spot, so shadows, reflections and the visible sun agree.
 */
import {
  Color,
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  Euler,
  HalfFloatType,
  PMREMGenerator,
  RGBAFormat,
  Vector3,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { LIGHTING } from '../config';

const HDRI_URL = '/hdri/syferfontein_18d_clear_puresky_2k.hdr';
/** Where the sun is in that file (equirect u, elevation), measured once from its pixels. */
const HDRI_SUN_U = 0.5999;
const HDRI_SUN_ELEVATION = (18.37 * Math.PI) / 180;
/** A dark smudge left by the sky edit near the horizon (u range, elevation range in degrees). */
const SMUDGE = { u0: 0.262, u1: 0.33, elevation0: -4, elevation1: 9 };
/** Below the horizon the file holds a mirrored sky; it fades to land over this many degrees. */
const GROUND_BLEND_DEG = 3;
/** The haze takes the sky colour this far above the horizon. */
const HAZE_ELEVATION_DEG = 2;
export const HAZE_BINS = 16;

export class Sky {
  /** Visible sky (half-float equirect). */
  readonly background: DataTexture;
  /** Pre-filtered sky for reflections and ambient light. */
  readonly environment: Texture;
  readonly rotation: Euler;
  /** Unit vector towards the sun, in world space. */
  readonly sunDirection = new Vector3();
  /**
   * Sky colour just above the horizon around the compass, in world space: bin i is centred on
   * atan2(z, x) = (i + 0.5) / HAZE_BINS * 2pi - pi. Distant things fade to these.
   */
  readonly hazeColours: Color[] = [];

  /** Downloads and decodes the HDRI. The GPU work happens in the constructor. */
  static loadTexture(): Promise<DataTexture> {
    return new HDRLoader().loadAsync(HDRI_URL);
  }

  constructor(renderer: WebGLRenderer, texture: DataTexture) {
    const { width, height } = texture.image;
    const data = texture.image.data as Uint16Array;
    paintOutSmudge(data, width, height);

    // Rotate the picture about the vertical so its sun lands on the configured bearing.
    const hdriAzimuth = (HDRI_SUN_U - 0.5) * Math.PI * 2;
    const bearing = (LIGHTING.sunBearing * Math.PI) / 180;
    const targetAzimuth = Math.atan2(-Math.cos(bearing), Math.sin(bearing));
    const turn = hdriAzimuth - targetAzimuth;
    this.rotation = new Euler(0, turn, 0);
    this.sunDirection
      .set(
        Math.cos(HDRI_SUN_ELEVATION) * Math.cos(hdriAzimuth),
        Math.sin(HDRI_SUN_ELEVATION),
        Math.cos(HDRI_SUN_ELEVATION) * Math.sin(hdriAzimuth),
      )
      .applyEuler(this.rotation)
      .normalize();
    this.measureHaze(data, width, height, turn);

    // Lighting copy: sand below the horizon instead of mirrored sky, and the sun capped so it
    // doesn't double up with the directional light.
    const lightData = data.slice();
    fillGround(lightData, width, height, LIGHTING.groundBounce);
    capBrightness(lightData, LIGHTING.skyLightCap);
    const lightTexture = new DataTexture(lightData, width, height, RGBAFormat, HalfFloatType);
    lightTexture.mapping = EquirectangularReflectionMapping;
    lightTexture.flipY = texture.flipY;
    lightTexture.needsUpdate = true;
    const pmrem = new PMREMGenerator(renderer);
    this.environment = pmrem.fromEquirectangular(lightTexture).texture;
    pmrem.dispose();
    lightTexture.dispose();

    // Visible copy: below the horizon each column continues its own horizon colour, the same
    // colour the haze fades to, so the edge of the land disappears.
    fillGround(data, width, height, null);
    capBrightness(data, LIGHTING.skyVisibleCap);
    texture.mapping = EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    this.background = texture;
  }

  apply(scene: Scene): void {
    scene.background = this.background;
    scene.backgroundRotation.copy(this.rotation);
    scene.environment = this.environment;
    scene.environmentRotation.copy(this.rotation);
    scene.environmentIntensity = LIGHTING.environmentIntensity;
  }

  dispose(): void {
    this.background.dispose();
    this.environment.dispose();
  }

  private measureHaze(data: Uint16Array, width: number, height: number, turn: number): void {
    const row = horizonRow(height);
    const span = Math.ceil(width / HAZE_BINS);
    for (let bin = 0; bin < HAZE_BINS; bin++) {
      // World azimuth of the bin centre, then where that is in the unrotated picture.
      const azimuth = ((bin + 0.5) / HAZE_BINS) * Math.PI * 2 - Math.PI;
      const u = ((((azimuth + turn) / (Math.PI * 2) + 0.5) % 1) + 1) % 1;
      const centre = Math.floor(u * width);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -span; k <= span; k++) {
        const i = (row * width + ((centre + k + width) % width)) * 4;
        r += DataUtils.fromHalfFloat(data[i] ?? 0);
        g += DataUtils.fromHalfFloat(data[i + 1] ?? 0);
        b += DataUtils.fromHalfFloat(data[i + 2] ?? 0);
      }
      const n = span * 2 + 1;
      this.hazeColours.push(new Color().setRGB(r / n, g / n, b / n));
    }
  }
}

function horizonRow(height: number): number {
  return Math.floor(height / 2 - (HAZE_ELEVATION_DEG / 180) * height);
}

/** Each row of the smudge becomes a straight blend between the clean sky on either side. */
function paintOutSmudge(data: Uint16Array, width: number, height: number): void {
  const x0 = Math.floor(SMUDGE.u0 * width);
  const x1 = Math.ceil(SMUDGE.u1 * width);
  const y0 = Math.floor(((90 - SMUDGE.elevation1) / 180) * height);
  const y1 = Math.ceil(((90 - SMUDGE.elevation0) / 180) * height);
  for (let y = y0; y <= y1; y++) {
    for (let c = 0; c < 3; c++) {
      const left = DataUtils.fromHalfFloat(data[(y * width + x0) * 4 + c] ?? 0);
      const right = DataUtils.fromHalfFloat(data[(y * width + x1) * 4 + c] ?? 0);
      for (let x = x0 + 1; x < x1; x++) {
        const t = (x - x0) / (x1 - x0);
        data[(y * width + x) * 4 + c] = DataUtils.toHalfFloat(left + (right - left) * t);
      }
    }
  }
}

/** Positive half floats sort like their bit patterns, so capping is an integer compare. */
function capBrightness(data: Uint16Array, cap: number): void {
  const max = DataUtils.toHalfFloat(cap);
  for (let i = 0; i < data.length; i++) {
    if ((data[i] ?? 0) > max) data[i] = max;
  }
}

/**
 * Replaces everything below the horizon (rows run from the zenith down), blending in over a few
 * degrees: with `colour`, or with null, each column's own colour just above the horizon.
 */
function fillGround(
  data: Uint16Array,
  width: number,
  height: number,
  colour: readonly [number, number, number] | null,
): void {
  const source = horizonRow(height);
  const flat = colour ? colour.map((c) => DataUtils.toHalfFloat(c)) : null;
  for (let y = Math.floor(height / 2); y < height; y++) {
    const depthDeg = ((y + 0.5) / height) * 180 - 90;
    const t = Math.min(1, depthDeg / GROUND_BLEND_DEG);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const s = (source * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const target = flat ? (flat[c] ?? 0) : (data[s + c] ?? 0);
        if (t >= 1) {
          // Fully replaced: copy the half-float bits, no conversion needed.
          data[i + c] = target;
        } else {
          const from = DataUtils.fromHalfFloat(data[i + c] ?? 0);
          const to = DataUtils.fromHalfFloat(target);
          data[i + c] = DataUtils.toHalfFloat(from + (to - from) * t);
        }
      }
    }
  }
}
