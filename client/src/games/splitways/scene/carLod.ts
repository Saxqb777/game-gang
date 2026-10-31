/**
 * Picks a car's level of detail from its projected size (D-C5, spec 3.12). Pure and Node-safe, so
 * the thresholds, the hysteresis and the per-preset floor are unit-tested without a renderer.
 */
import { CAR_LOD } from '../config';

export type CarLod = 0 | 1 | 2;

/** The size where level `boundary` and level `boundary + 1` meet (output px). */
function threshold(boundary: 0 | 1): number {
  return boundary === 0 ? CAR_LOD.lod0MinPx : CAR_LOD.lod1MinPx;
}

/**
 * The level to draw now, given the level drawn last frame in this view. A car only steps to a more
 * detailed level once it is `hysteresis` past the threshold, and back only once it is the same share
 * below it, so a car sitting on a threshold never flips every frame. `floor` is the most detailed
 * level the preset allows.
 */
export function chooseLod(previous: CarLod, diameterPx: number, floor: 0 | 1): CarLod {
  const up = 1 + CAR_LOD.hysteresis;
  const down = 1 - CAR_LOD.hysteresis;
  let level: CarLod = previous;
  if (level > 0 && diameterPx >= threshold((level - 1) as 0 | 1) * up) {
    level = diameterPx >= threshold(0) * up ? 0 : 1;
  } else if (level < 2 && diameterPx < threshold(level as 0 | 1) * down) {
    level = diameterPx < threshold(1) * down ? 2 : 1;
  }
  return Math.max(level, floor) as CarLod;
}

/**
 * Projected bounding-sphere diameter in output pixels: `radius` is half the car's bounding-box
 * diagonal, `distance` the camera-to-car-centre distance, `fovDeg` the vertical field of view.
 */
export function projectedDiameterPx(
  radius: number,
  distance: number,
  fovDeg: number,
  viewHeightPx: number,
): number {
  const halfFov = (fovDeg * Math.PI) / 360;
  return ((2 * radius) / (2 * Math.max(distance, 1e-3) * Math.tan(halfFov))) * viewHeightPx;
}
