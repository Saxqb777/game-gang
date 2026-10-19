/**
 * Placeholder cars (spec C2a.3): the CC0 sports car (assets/models/sports-car.glb) fitted to each
 * car's configured geometry, so every package can work with per-car files before the real cars
 * land. The body is scaled per axis to the configured length, width and height; each wheel is
 * scaled to its configured radius and moved to its configured hub. Materials are factor-only.
 */
import { parseGlb } from './glb.mjs';
import { CORNERS } from './classify.mjs';
import { meshBounds } from './mesh.mjs';
import { sourceFromParsed } from './source.mjs';

/** The credit placeholders carry in asset.copyright (also the assets/ASSETS.md placeholder row). */
export const PLACEHOLDER_CREDIT =
  'Placeholder derived from "Sports" in the Free Low Poly Vehicles Pack by Raphael Gonçalves (Rgsdev), CC0.';

/** The CC0 model's one material name outside the vocabulary: its white accents. */
const RENAME = { accent: 'chrome' };

function hubOf(geometry, corner) {
  const front = corner[0] === 'f';
  const left = corner[1] === 'l';
  const halfTrack = front ? geometry.halfTrackFront : geometry.halfTrackRear;
  const radius = front ? geometry.radiusFront : geometry.radiusRear;
  return [
    left ? halfTrack : -halfTrack,
    radius,
    front ? geometry.wheelbaseHalf : -geometry.wheelbaseHalf,
  ];
}

export async function loadPlaceholderSource(bytes, geometry) {
  const source = sourceFromParsed(await parseGlb(bytes), {
    renameMaterial: (name) => RENAME[name] ?? name,
  });
  // Source reference points: hubs, radii, ground, axle midpoint, body box.
  const radii = {};
  for (const corner of CORNERS) {
    const meshes = source.parts.filter((p) => p.group === `wheel_${corner}`).map((p) => p.mesh);
    const { min, max } = meshBounds(meshes);
    radii[corner] = Math.max(max[1] - min[1], max[2] - min[2]) / 2;
  }
  const hubs = source.wheelOrigins;
  const ground = CORNERS.reduce((sum, c) => sum + hubs[c][1] - radii[c], 0) / 4;
  const axleMid = (hubs.fl[2] + hubs.fr[2] + hubs.rl[2] + hubs.rr[2]) / 4;
  const body = meshBounds(source.parts.filter((p) => p.group === 'body').map((p) => p.mesh));
  const centreX = (body.min[0] + body.max[0]) / 2;
  const scale = [
    geometry.width / (body.max[0] - body.min[0]),
    geometry.height / (body.max[1] - ground),
    geometry.length / (body.max[2] - body.min[2]),
  ];
  const origin = [centreX, ground, axleMid];
  for (const part of source.parts) {
    const p = part.mesh.positions;
    if (part.group === 'body') {
      for (let i = 0; i < p.length; i += 3) {
        for (let axis = 0; axis < 3; axis++)
          p[i + axis] = (p[i + axis] - origin[axis]) * scale[axis];
      }
      // Per-axis scaling skews normals: recompute them from the new shape's directions.
      const n = part.mesh.normals;
      for (let i = 0; i < n.length; i += 3) {
        const x = n[i] / scale[0];
        const y = n[i + 1] / scale[1];
        const z = n[i + 2] / scale[2];
        const length = Math.hypot(x, y, z) || 1;
        n[i] = x / length;
        n[i + 1] = y / length;
        n[i + 2] = z / length;
      }
    } else {
      const corner = part.group.slice(-2);
      const from = hubs[corner];
      const to = hubOf(geometry, corner);
      const k = (corner[0] === 'f' ? geometry.radiusFront : geometry.radiusRear) / radii[corner];
      for (let i = 0; i < p.length; i += 3) {
        for (let axis = 0; axis < 3; axis++)
          p[i + axis] = (p[i + axis] - from[axis]) * k + to[axis];
      }
    }
  }
  for (const corner of CORNERS) source.wheelOrigins[corner] = hubOf(geometry, corner);
  return source;
}
