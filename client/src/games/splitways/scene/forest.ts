/**
 * The forest: low-poly instanced pines from the generator's placements, one instanced mesh per
 * 200 m tile so the main and shadow passes cull them, and a jagged treeline ring at the edge of
 * the land so the world never ends in view.
 *
 * Each tile lists its trees near the wall first, then the rest, each part shuffled. A preset draws
 * the first `round(total x vegetationDensity)`, so thinning takes the interior first and keeps the
 * treeline silhouette whole on every preset.
 */
import type { Euler } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Texture,
} from 'three';
import { SCENERY } from '../config';
import { fbm } from '../track/noise';
import { hash32, mulberry32, type Placement } from '../track/gen/placement';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';

/** Tiers of the pine at scale 1 (16 m tall): base, top and radius (m). */
const TIERS: readonly [number, number, number][] = [
  [3.0, 8.5, 3.0],
  [6.5, 11.5, 2.4],
  [9.5, 14.0, 1.7],
  [12.5, 16.0, 1.0],
];
/** Each tier's apex leans off the trunk by this much (m), in a fixed pattern. */
const APEX_OFFSETS: readonly [number, number][] = [
  [0.2, -0.1],
  [-0.15, 0.25],
  [0.3, 0.1],
  [-0.1, -0.2],
];
const RIM_POINTS = 12;
/** Star rim: alternate rim points sit in to this share of the radius. */
const RIM_INNER = 0.78;
/** Rims droop below the tier's base by this share of its height. */
const DROOP = 0.15;
const TRUNK_SIDES = 5;
const TRUNK = { bottom: -0.4, top: 13, radiusBottom: 0.24, radiusTop: 0.07 };
/** Pine palette (sRGB): tips, mid canopy, inner shade, lower and upper trunk. */
const TIP = new Color('#3f5a3c');
const MID = new Color('#2e4733');
const SHADE = new Color('#1d3024');
const BARK_LOW = new Color('#4a3b30');
const BARK_HIGH = new Color('#7a5236');
/** Pines sink this share of their scale into the ground so none float on a slope. */
const SINK = 0.3;
/** Most lean off vertical (rad). */
const MAX_LEAN = (2.5 * Math.PI) / 180;
/** Treeline ring: inset from the land's edge (m) and spacing of its spikes (m). */
const RING_INSET = 12;
const RING_STEP = 5;
const RING_BASE = new Color('#1f3326');
const RING_TOP = new Color('#2a4231');

const UP = new Vector3(0, 1, 0);

/** The pine: 4 star-rimmed tiers with drooping rims and dark undersides, and a trunk (106 triangles). */
export function pineGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const radial = new Vector3();
  const n = new Vector3();
  const pushVertex = (x: number, y: number, z: number, normal: Vector3, colour: Color) => {
    positions.push(x, y, z);
    normals.push(normal.x, normal.y, normal.z);
    colours.push(colour.r, colour.g, colour.b);
  };
  /** Spherised foliage normal: mostly out from the trunk, partly up (or down for undersides). */
  const foliage = (x: number, z: number, upShare: number) => {
    radial.set(x, 0, z);
    if (radial.lengthSq() < 1e-6) return n.copy(UP);
    radial.normalize();
    return n.copy(radial).multiplyScalar(0.65).addScaledVector(UP, upShare).normalize();
  };
  const tri = (
    a: [number, number, number, number],
    b: [number, number, number, number],
    c: [number, number, number, number],
    up: number,
    colours3: [Color, Color, Color],
  ) => {
    // Wind each triangle so it faces away from the trunk (sides) or downwards (undersides).
    const e1 = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const e2 = new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const face = new Vector3().crossVectors(e1, e2);
    const centre = new Vector3((a[0] + b[0] + c[0]) / 3, 0, (a[2] + b[2] + c[2]) / 3);
    const want = up < 0 ? -1 : 1;
    const outward = face.dot(centre) + face.y * want * 0.2;
    const order = outward >= 0 ? [a, b, c] : [a, c, b];
    const cols = outward >= 0 ? colours3 : [colours3[0], colours3[2], colours3[1]];
    order.forEach((p, k) => {
      const colour = (cols[k] as Color).clone().multiplyScalar(p[3]);
      pushVertex(p[0], p[1], p[2], foliage(p[0], p[2], up), colour);
    });
  };
  TIERS.forEach(([base, top, radius], t) => {
    const [ox, oz] = APEX_OFFSETS[t] as [number, number];
    // Lower tiers sit in the shade of the ones above.
    const shade = 0.78 + 0.22 * (t / (TIERS.length - 1));
    const apex: [number, number, number, number] = [ox, top, oz, shade];
    const under: [number, number, number, number] = [
      ox * 0.5,
      base + (top - base) * 0.12,
      oz * 0.5,
      shade,
    ];
    const droopY = base - DROOP * (top - base);
    const rim: [number, number, number, number][] = [];
    for (let k = 0; k < RIM_POINTS; k++) {
      const a = (k / RIM_POINTS) * Math.PI * 2 + t * 0.4;
      const r = radius * (k % 2 === 0 ? 1 : RIM_INNER);
      // Inner star points droop less: the tips hang lowest.
      const y = k % 2 === 0 ? droopY : base - DROOP * 0.4 * (top - base);
      rim.push([Math.cos(a) * r, y, Math.sin(a) * r, shade]);
    }
    for (let k = 0; k < RIM_POINTS; k++) {
      const p = rim[k] as [number, number, number, number];
      const q = rim[(k + 1) % RIM_POINTS] as [number, number, number, number];
      const tipP = k % 2 === 0 ? TIP : MID;
      const tipQ = (k + 1) % 2 === 0 ? TIP : MID;
      tri(apex, p, q, 0.35, [MID, tipP, tipQ]);
      tri(under, p, q, -0.4, [SHADE, SHADE, SHADE]);
    }
  });
  // Trunk: Scots-pine orange bark catching the low sun, grimy at the foot.
  for (let k = 0; k < TRUNK_SIDES; k++) {
    const a0 = (k / TRUNK_SIDES) * Math.PI * 2;
    const a1 = ((k + 1) / TRUNK_SIDES) * Math.PI * 2;
    const ring = (a: number, y: number, r: number) =>
      [Math.cos(a) * r, y, Math.sin(a) * r] as const;
    const b0 = ring(a0, TRUNK.bottom, TRUNK.radiusBottom);
    const b1 = ring(a1, TRUNK.bottom, TRUNK.radiusBottom);
    const t0 = ring(a0, TRUNK.top, TRUNK.radiusTop);
    const t1 = ring(a1, TRUNK.top, TRUNK.radiusTop);
    const low = BARK_LOW.clone().multiplyScalar(0.55);
    const n0 = new Vector3(Math.cos(a0), 0, Math.sin(a0));
    const n1 = new Vector3(Math.cos(a1), 0, Math.sin(a1));
    // Counter-clockwise seen from outside: angle grows clockwise seen from above in three's axes.
    const quad: [readonly [number, number, number], Vector3, Color][] = [
      [b0, n0, low],
      [t0, n0, BARK_HIGH],
      [b1, n1, low],
      [b1, n1, low],
      [t0, n0, BARK_HIGH],
      [t1, n1, BARK_HIGH],
    ];
    for (const [p, normal, colour] of quad) pushVertex(p[0], p[1], p[2], normal, colour);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  return geometry;
}

/**
 * Within-tile order: trees within `edgeBand` of the wall first, then the rest, each shuffled with
 * `rng` (Fisher-Yates). Returns indices into `beyond`.
 */
export function edgeFirstOrder(
  beyond: readonly number[],
  edgeBand: number,
  rng: () => number,
): number[] {
  const edge: number[] = [];
  const rest: number[] = [];
  beyond.forEach((b, i) => (b <= edgeBand ? edge : rest).push(i));
  for (const list of [edge, rest]) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = list[i] as number;
      list[i] = list[j] as number;
      list[j] = swap;
    }
  }
  return [...edge, ...rest];
}

interface Tile {
  mesh: InstancedMesh;
  total: number;
}

export class Forest {
  readonly group = new Group();
  readonly stats: { tiles: number; pines: number; drawn: number };
  private readonly tiles: Tile[] = [];
  private readonly pineMaterial: MeshStandardMaterial;
  private readonly ringMaterial: MeshStandardMaterial;
  private readonly geometries: BufferGeometry[] = [];

  /** `blocked(x, z)`: trackside buildings and clearings no tree may stand in. */
  constructor(
    track: Track,
    terrain: Terrain,
    placements: readonly Placement[],
    blocked: (x: number, z: number) => boolean,
  ) {
    this.pineMaterial = new MeshStandardMaterial({
      color: new Color().setRGB(...SCENERY.pineTint, LinearSRGBColorSpace),
      vertexColors: true,
      roughness: 0.85,
      metalness: 0,
    });
    this.ringMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    });
    const geometry = pineGeometry();
    this.geometries.push(geometry);
    const pines = placements.filter((p) => p.kind === 'pine' && !blocked(p.x, p.z));
    this.buildTiles(track, terrain, pines, geometry);
    this.group.add(this.buildRing(terrain));
    this.stats = { tiles: this.tiles.length, pines: pines.length, drawn: pines.length };
  }

  /**
   * Pines and the ring catch the sky light through their own copy of the environment at an
   * absolute strength; at the scene's level the shadow side of every treeline would go black.
   */
  setEnvironment(environment: Texture, rotation: Euler): void {
    for (const material of [this.pineMaterial, this.ringMaterial]) {
      material.envMap = environment;
      material.envMapRotation.copy(rotation);
      material.envMapIntensity = SCENERY.pineSkyLight;
      material.needsUpdate = true;
    }
  }

  /** Draws the first share of each tile's trees (no geometry rebuild), and sets their shadows. */
  setDensity(density: number, shadows: boolean): void {
    let drawn = 0;
    for (const tile of this.tiles) {
      tile.mesh.count = Math.round(tile.total * density);
      tile.mesh.castShadow = shadows;
      drawn += tile.mesh.count;
    }
    this.stats.drawn = drawn;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const tile of this.tiles) tile.mesh.dispose();
    this.pineMaterial.dispose();
    this.ringMaterial.dispose();
    this.group.removeFromParent();
  }

  private buildTiles(
    track: Track,
    terrain: Terrain,
    pines: readonly Placement[],
    geometry: BufferGeometry,
  ): void {
    const { minX, minZ } = terrain.field;
    const size = SCENERY.pineTile;
    const byTile = new Map<number, Placement[]>();
    for (const p of pines) {
      const key = Math.floor((p.x - minX) / size) * 4096 + Math.floor((p.z - minZ) / size);
      let list = byTile.get(key);
      if (!list) byTile.set(key, (list = []));
      list.push(p);
    }
    const rng = mulberry32(hash32(`${track.definition.id}:forest`));
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const lean = new Quaternion();
    const axis = new Vector3();
    const scale = new Vector3();
    const colour = new Color();
    for (const key of [...byTile.keys()].sort((a, b) => a - b)) {
      const list = byTile.get(key) as Placement[];
      const beyond = list.map((p) => {
        const s = track.sample(p.station);
        const lateral = (p.x - s.position.x) * s.right.x + (p.z - s.position.z) * s.right.z;
        return Math.abs(lateral) - track.side(p.station, p.side).wall;
      });
      const order = edgeFirstOrder(beyond, SCENERY.pineEdgeBand, rng);
      const mesh = new InstancedMesh(geometry, this.pineMaterial, list.length);
      order.forEach((index, i) => {
        const p = list[index] as Placement;
        // Every tree draws the same numbers, kept or remapped, so one rule change never reshuffles the forest.
        const r = Array.from({ length: 9 }, rng);
        let s = p.scale;
        if (
          (beyond[index] as number) <= SCENERY.pineEdgeBand &&
          (r[0] as number) < SCENERY.pineYoungShare
        ) {
          s *= 0.45 + 0.25 * (r[1] as number);
        } else if ((r[0] as number) > 1 - SCENERY.pineEmergentShare) {
          s *= 1.4 + 0.2 * (r[1] as number);
        }
        // Crowns a little wider than the tiers so neighbours overlap into a wall of forest.
        const wide = s * (1.0 + 0.35 * (r[2] as number));
        scale.set(wide, s * (0.85 + 0.4 * (r[3] as number)), wide);
        position.set(p.x, terrain.heightAt(p.x, p.z) - SINK * s, p.z);
        quaternion.setFromAxisAngle(UP, p.yaw);
        const leanAngle = (r[4] as number) * 2 * Math.PI;
        axis.set(Math.cos(leanAngle), 0, Math.sin(leanAngle));
        lean.setFromAxisAngle(axis, (r[5] as number) * MAX_LEAN);
        quaternion.premultiply(lean);
        mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
        // Lightness and hue jitter from yellower to bluer pines; a few sun-bleached olive ones.
        const light = 0.9 + 0.2 * (r[6] as number);
        const hue = (r[7] as number) * 2 - 1;
        colour.setRGB(light * (1 + 0.05 * hue), light, light * (1 - 0.06 * hue));
        if ((r[8] as number) < 0.04) colour.multiply(new Color(1.15, 1.05, 0.85));
        mesh.setColorAt(i, colour);
      });
      // From every instance, once: count only ever drops below this, so the sphere stays valid.
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.tiles.push({ mesh, total: list.length });
    }
  }

  /** A vertical, jagged skirt of distant forest along the land's edge: rolling, never straight. */
  private buildRing(terrain: Terrain): Mesh {
    const { minX, minZ, spacing, cols, rows } = terrain.field;
    const x0 = minX + RING_INSET;
    const z0 = minZ + RING_INSET;
    const x1 = minX + (cols - 1) * spacing - RING_INSET;
    const z1 = minZ + (rows - 1) * spacing - RING_INSET;
    const corners: [number, number][] = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const rng = mulberry32(hash32('treeline'));
    const positions: number[] = [];
    const normals: number[] = [];
    const colours: number[] = [];
    const inward = new Vector3();
    const normal = new Vector3();
    const colour = new Color();
    const push = (x: number, y: number, z: number, t: number) => {
      positions.push(x, y, z);
      inward.set(cx - x, 0, cz - z).normalize();
      normal.copy(inward).multiplyScalar(0.6).addScaledVector(UP, 0.4).normalize();
      normals.push(normal.x, normal.y, normal.z);
      colour.lerpColors(RING_BASE, RING_TOP, t);
      colours.push(colour.r, colour.g, colour.b);
    };
    const height = (x: number, z: number) =>
      SCENERY.ringHeightMin +
      (SCENERY.ringHeightMax - SCENERY.ringHeightMin) * fbm(x * 0.02, z * 0.02, 2) +
      SCENERY.ringRoll * (fbm(x * 0.0017 + 5, z * 0.0017 - 3, 2) * 2 - 1);
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c] as [number, number];
      const [bx, bz] = corners[(c + 1) % 4] as [number, number];
      const length = Math.hypot(bx - ax, bz - az);
      let d = 0;
      let px = ax;
      let pz = az;
      while (d < length) {
        const step = Math.min(length - d, RING_STEP + (rng() * 2 - 1) * 2);
        d += step;
        const qx = ax + ((bx - ax) * d) / length;
        const qz = az + ((bz - az) * d) / length;
        const gp = terrain.heightAt(px, pz);
        const gq = terrain.heightAt(qx, qz);
        const hp = Math.max(8, height(px, pz));
        const hq = Math.max(8, height(qx, qz));
        const mx = (px + qx) / 2;
        const mz = (pz + qz) / 2;
        const spike = Math.max(hp, hq) * (0.6 + 0.4 * rng());
        const valley = 0.55;
        // The skirt from below the ground to the valley line, and one spike on top.
        const quad: [number, number, number, number][] = [
          [px, gp - 4, pz, 0],
          [qx, gq - 4, qz, 0],
          [px, gp + hp * valley, pz, 0.6],
          [qx, gq - 4, qz, 0],
          [qx, gq + hq * valley, qz, 0.6],
          [px, gp + hp * valley, pz, 0.6],
          [px, gp + hp * valley, pz, 0.6],
          [qx, gq + hq * valley, qz, 0.6],
          [mx, (gp + gq) / 2 + spike, mz, 1],
        ];
        for (const [x, y, z, t] of quad) push(x, y, z, t);
        px = qx;
        pz = qz;
      }
    }
    // Wind every triangle to face the land, so lighting never flips between neighbours.
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (let t = 0; t < positions.length; t += 9) {
      a.fromArray(positions, t);
      b.fromArray(positions, t + 3);
      c.fromArray(positions, t + 6);
      b.sub(a);
      c.sub(a);
      inward.set(cx - a.x, 0, cz - a.z);
      if (b.cross(c).dot(inward) >= 0) continue;
      for (const stream of [positions, normals, colours]) {
        for (let k = 0; k < 3; k++) {
          const swap = stream[t + 3 + k] as number;
          stream[t + 3 + k] = stream[t + 6 + k] as number;
          stream[t + 6 + k] = swap;
        }
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeBoundingSphere();
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, this.ringMaterial);
    mesh.name = 'treeline';
    return mesh;
  }
}
