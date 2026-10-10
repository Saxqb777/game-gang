/**
 * Everything you see of the track itself: asphalt, grass shoulders, edge lines, kerbs on the
 * corners, concrete jersey barriers and the chequered start line. Each surface is one merged mesh,
 * so the whole track costs a handful of draw calls.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import type { Track } from '../track/track';
import { buildStrip, type Strip } from '../track/trackGeometry';
import { canvasTexture, type PbrSet } from './textures';

const ROAD_TILE = 5;
const MARKING_LIFT = 0.012;
const KERB_LIFT = 0.025;
/** Corners tighter than this radius (m) get kerbs. */
const KERB_RADIUS = 70;

function stripGeometry(strip: Strip): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(strip.positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(strip.uvs, 2));
  geometry.setIndex(new BufferAttribute(strip.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Accumulates quads (and other triangles) into one geometry. */
class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  /** Quad from four corners (a-b near edge, c-d far edge), counter-clockwise seen from its front. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, uv: [number, number, number, number]): void {
    const base = this.positions.length / 3;
    for (const p of [a, b, c, d]) this.positions.push(p.x, p.y, p.z);
    const [u0, v0, u1, v1] = uv;
    this.uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
    this.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

const p0 = new Vector3();
const p1 = new Vector3();
const p2 = new Vector3();
const p3 = new Vector3();

function along(track: Track, index: number, lateral: number, lift: number, out: Vector3): Vector3 {
  const s = track.sample(index);
  return out
    .copy(s.position)
    .addScaledVector(s.right, lateral)
    .setY(s.position.y + lift);
}

/** A thin band between two lateral offsets over [from, to) sample indices. */
function band(
  builder: MeshBuilder,
  track: Track,
  from: number,
  to: number,
  lat0: number,
  lat1: number,
  lift: number,
  vScale: number,
): void {
  for (let i = from; i < to; i++) {
    along(track, i, lat0, lift, p0);
    along(track, i, lat1, lift, p1);
    along(track, i + 1, lat0, lift, p2);
    along(track, i + 1, lat1, lift, p3);
    builder.quad(p0, p1, p2, p3, [0, i * vScale, 1, (i + 1) * vScale]);
  }
}

function markings(track: Track): BufferGeometry {
  const builder = new MeshBuilder();
  const n = track.samples.length;
  const edge = track.halfRoad - 0.35;
  // Solid edge lines; a circuit has no centre line.
  band(builder, track, 0, n, -edge - 0.1, -edge + 0.1, MARKING_LIFT, 0);
  band(builder, track, 0, n, edge - 0.1, edge + 0.1, MARKING_LIFT, 0);
  return builder.build();
}

/** Red and white kerbs on the inside of every tight corner, and the outside of the tightest. */
function kerbs(track: Track): BufferGeometry {
  const builder = new MeshBuilder();
  const n = track.samples.length;
  const inner = track.halfRoad - 0.15;
  const outer = track.halfRoad + 1.1;
  for (let i = 0; i < n; i++) {
    const curvature = track.sample(i).curvature;
    if (Math.abs(curvature) < 1 / KERB_RADIUS) continue;
    // Left turns (positive curvature) have their inside on the left (negative lateral).
    const side = curvature > 0 ? -1 : 1;
    band(builder, track, i, i + 1, side * inner, side * outer, KERB_LIFT, 0.5);
    if (Math.abs(curvature) > 1 / 30) {
      band(builder, track, i, i + 1, -side * outer, -side * inner, KERB_LIFT, 0.5);
    }
  }
  return builder.build();
}

function startLine(track: Track): BufferGeometry {
  const builder = new MeshBuilder();
  const start = track.startLine;
  const index = Math.round((start.distance / track.length) * track.samples.length);
  along(track, index - 1, -track.halfRoad, MARKING_LIFT * 1.5, p0);
  along(track, index - 1, track.halfRoad, MARKING_LIFT * 1.5, p1);
  along(track, index + 1, -track.halfRoad, MARKING_LIFT * 1.5, p2);
  along(track, index + 1, track.halfRoad, MARKING_LIFT * 1.5, p3);
  builder.quad(p0, p1, p2, p3, [0, 0, 14, 2]);
  return builder.build();
}

/** Concrete jersey barriers, extruded along both sides of the track. */
function barriers(track: Track): BufferGeometry {
  const concrete = new MeshBuilder();
  const n = track.samples.length;
  const base = track.halfDrivable + 0.3;
  // Jersey profile: (outward offset from the barrier's road face, height).
  const profile: [number, number][] = [
    [0, 0],
    [0.12, 0.14],
    [0.24, 0.82],
    [0.46, 0.82],
    [0.58, 0.14],
    [0.7, 0],
  ];
  const step = 2;
  for (let i = 0; i < n; i += step) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < profile.length - 1; k++) {
        const [o0, h0] = profile[k] as [number, number];
        const [o1, h1] = profile[k + 1] as [number, number];
        along(track, i, side * (base + o0), h0, p0);
        along(track, i, side * (base + o1), h1, p1);
        along(track, i + step, side * (base + o0), h0, p2);
        along(track, i + step, side * (base + o1), h1, p3);
        // Keep the faces pointing out of the barrier on both sides of the road.
        if (side > 0) concrete.quad(p0, p1, p2, p3, [0, 0, 1, 1]);
        else concrete.quad(p0, p2, p1, p3, [0, 0, 1, 1]);
      }
    }
  }
  return concrete.build();
}

export interface TrackVisual {
  group: Group;
  dispose(): void;
}

/** Builds the track meshes. The asphalt texture set is owned by the caller. */
export function createTrackVisual(
  track: Track,
  textures: { asphalt: PbrSet },
  anisotropy: number,
): TrackVisual {
  const { asphalt } = textures;
  const group = new Group();
  group.name = 'track';
  const materials: Material[] = [];
  const ownTextures: Texture[] = [];
  const add = (geometry: BufferGeometry, material: Material, shadows = true) => {
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = shadows;
    group.add(mesh);
    materials.push(material);
    return mesh;
  };

  const pbr = (set: PbrSet, colour: number) => {
    return new MeshStandardMaterial({
      color: colour,
      map: set.map,
      normalMap: set.normalMap,
      aoMap: set.arm,
      roughnessMap: set.arm,
      metalnessMap: set.arm,
      metalness: 1,
      roughness: 1,
    });
  };

  add(
    stripGeometry(buildStrip(track, -track.halfRoad, track.halfRoad, ROAD_TILE)),
    pbr(asphalt, 0x8a8a8a),
  );
  // Mown grass verges: untextured until the Track 1 dressing brings CC0 grass.
  const shoulderMaterial = new MeshStandardMaterial({ color: 0x4a6b2f, roughness: 0.95 });
  add(
    stripGeometry(buildStrip(track, -track.halfDrivable, -track.halfRoad, ROAD_TILE, -0.01)),
    shoulderMaterial,
  );
  add(
    stripGeometry(buildStrip(track, track.halfRoad, track.halfDrivable, ROAD_TILE, -0.01)),
    shoulderMaterial,
  );

  const paint = new MeshStandardMaterial({
    color: 0xf3f1ea,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  add(markings(track), paint);

  const kerbTexture = canvasTexture(
    64,
    128,
    (ctx) => {
      ctx.fillStyle = '#d8232a';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(0, 64, 64, 64);
    },
    anisotropy,
  );
  ownTextures.push(kerbTexture);
  add(
    kerbs(track),
    new MeshStandardMaterial({
      map: kerbTexture,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );

  const checker = canvasTexture(
    128,
    32,
    (ctx) => {
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
          ctx.fillRect(x * 16, y * 16, 16, 16);
        }
      }
    },
    anisotropy,
  );
  checker.repeat.set(1 / 8, 1 / 2);
  ownTextures.push(checker);
  add(
    startLine(track),
    new MeshStandardMaterial({
      map: checker,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );

  const concrete = add(
    barriers(track),
    new MeshStandardMaterial({ color: new Color(0xe4e2dc), roughness: 0.82 }),
  );
  concrete.castShadow = true;

  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) (object.geometry as BufferGeometry).dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of ownTextures) texture.dispose();
      group.removeFromParent();
    },
  };
}
