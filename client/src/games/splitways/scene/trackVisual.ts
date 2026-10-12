/**
 * Everything you see of the corridor, built from the generator's chunked bands (`corridorChunks`):
 * asphalt with a rubbered racing line and a paved apron, edge lines, striped sawtooth kerbs, mown
 * grass and raked gravel run-off, armco with posts, painted tyre walls, the pit wall and catch
 * fence, and the start line with its grid boxes. Each chunk (about 150 m) gets one mesh per
 * material, culled on the chunk's bounding sphere in the main and shadow passes.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  Quaternion,
  Sphere,
  Vector3,
  type CanvasTexture,
  type Material,
  type Texture,
} from 'three';
import { SCENERY } from '../config';
import { corridorChunks, type BandMesh, type CorridorChunk } from '../track/gen/corridor';
import { BARRIER, SURFACE } from '../track/surfaces';
import type { Track } from '../track/track';
import { linear, patchMaterial, pbrMaps } from './materials';
import { canvasTexture, type PbrSet } from './textures';

export interface TrackTextures {
  asphalt: PbrSet;
  grass: PbrSet;
  gravel: PbrSet;
}

export interface TrackVisual {
  group: Group;
  /** Corridor chunks and meshes, for the report. */
  stats: { chunks: number; meshes: number };
  dispose(): void;
}

/** Pit wall and catch-fence base: height and thickness (m). */
const WALL_HEIGHT = 1.1;
const WALL_THICKNESS = 0.35;
/** Catch fence: mesh top above the wall foot (m), and a post every this many stations. */
const FENCE_TOP = 3.8;
const FENCE_POST_EVERY = 4;
/** Contact grime: darkening at the foot of every barrier, fading out by this height (m). */
const GRIME_HEIGHT = 0.4;
const GRIME = 0.6;
/** Braking zones: the racing line loses more than this (m/s) over the next this many metres. */
const BRAKE_LOOKAHEAD = 30;
const BRAKE_DROP = 3;
/** Grid boxes drawn behind the line (a full grid even for one player). */
const GRID_SLOTS = 8;
const LINE_LIFT = 0.012;
/** Tyre walls: paint bands of this many stations, the pattern red, white, bare. */
const TYRE_BAND = 3;
const TYRE_PAINT = [new Color('#9e1f27'), new Color('#d6d4ce'), new Color('#161616')] as const;
/** Gravel traps: how far (m) the ragged grass edge reaches into the gravel. */
const GRAVEL_EDGE = 6;

const UP = new Vector3(0, 1, 0);
const tmp = new Vector3();
const tmp2 = new Vector3();
const matrix = new Matrix4();
const rotation = new Quaternion();
const unitScale = new Vector3(1, 1, 1);
const dummy = new Object3D();

/** Station of a corridor vertex (stations are 1 m apart; uv.y is distance along the lap). */
function stationOf(track: Track, v: number): number {
  const n = track.samples.length;
  return ((Math.round(v / track.spacing) % n) + n) % n;
}

function lateralOf(track: Track, station: number, x: number, z: number): number {
  const s = track.sample(station);
  return (x - s.position.x) * s.right.x + (z - s.position.z) * s.right.z;
}

function geometryOf(band: BandMesh, extras: Record<string, [Float32Array, number]> = {}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(band.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(band.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(band.uvs, 2));
  for (const [name, [array, size]] of Object.entries(extras)) {
    geometry.setAttribute(name, new BufferAttribute(array, size));
  }
  geometry.setIndex(new BufferAttribute(band.indices, 1));
  return geometry;
}

/** Concatenates bands into one. */
function concatBands(bands: readonly BandMesh[]): BandMesh {
  let vertices = 0;
  let indices = 0;
  for (const b of bands) {
    vertices += b.positions.length / 3;
    indices += b.indices.length;
  }
  const out: BandMesh = {
    positions: new Float32Array(vertices * 3),
    normals: new Float32Array(vertices * 3),
    uvs: new Float32Array(vertices * 2),
    indices: new Uint32Array(indices),
  };
  let v = 0;
  let k = 0;
  for (const b of bands) {
    out.positions.set(b.positions, v * 3);
    out.normals.set(b.normals, v * 3);
    out.uvs.set(b.uvs, v * 2);
    for (let i = 0; i < b.indices.length; i++) out.indices[k + i] = (b.indices[i] as number) + v;
    v += b.positions.length / 3;
    k += b.indices.length;
  }
  return out;
}

/** Per station: 1 where the racing line brakes hard for a corner, smoothed. */
function brakingWeights(track: Track): Float32Array {
  const n = track.samples.length;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const drop = track.sample(i).targetSpeed - track.sample(i + BRAKE_LOOKAHEAD).targetSpeed;
    raw[i] = drop > BRAKE_DROP ? 1 : 0;
  }
  const out = new Float32Array(n);
  const half = 8;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += raw[(i + k + n) % n] as number;
    out[i] = sum / (2 * half + 1);
  }
  return out;
}

/** Per station on one side: metres along the lap to the nearest station whose run-off isn't gravel (capped). */
function gravelEdgeDistance(track: Track, side: -1 | 1, cap: number): Float32Array {
  const n = track.samples.length;
  const out = new Float32Array(n).fill(cap);
  for (let i = 0; i < n; i++) {
    if (track.side(i, side).runoffSurface === SURFACE.gravel) continue;
    for (let k = -cap; k <= cap; k++) {
      const j = (i + k + n) % n;
      out[j] = Math.min(out[j] as number, Math.abs(k));
    }
  }
  return out;
}

/** Contact grime: darker at the foot, clean from GRIME_HEIGHT up. */
function grime(height: number): number {
  return GRIME + (1 - GRIME) * Math.min(1, Math.max(0, height / GRIME_HEIGHT));
}

/** Indexed triangles with normals, uvs and vertex colours. */
export class PropBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colours: number[] = [];
  readonly indices: number[] = [];

  vertex(p: Vector3, n: Vector3, u: number, v: number, c: number | Color): number {
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    if (typeof c === 'number') this.colours.push(c, c, c);
    else this.colours.push(c.r, c.g, c.b);
    return this.positions.length / 3 - 1;
  }

  /** a-b along the bottom (left to right seen from the front), c-d along the top. */
  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, d, a, d, c);
  }

  /** Appends a geometry, transformed; `shade(localY)` gives each vertex's colour. */
  geometry(source: BufferGeometry, transform: Matrix4, u: number, shade: (y: number) => number) {
    const base = this.positions.length / 3;
    const p = source.getAttribute('position');
    const n = source.getAttribute('normal');
    const rotate = new Matrix4().extractRotation(transform);
    for (let i = 0; i < p.count; i++) {
      tmp.fromBufferAttribute(p, i);
      const c = shade(tmp.y);
      tmp.applyMatrix4(transform);
      tmp2.fromBufferAttribute(n, i).applyMatrix4(rotate).normalize();
      this.positions.push(tmp.x, tmp.y, tmp.z);
      this.normals.push(tmp2.x, tmp2.y, tmp2.z);
      this.uvs.push(u, 0);
      this.colours.push(c, c, c);
    }
    const index = source.getIndex();
    if (index) for (let i = 0; i < index.count; i++) this.indices.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) this.indices.push(base + i);
  }

  get empty(): boolean {
    return this.indices.length === 0;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colours), 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

/** A tyre stack: three tyres on a pentagon with bulges and grooves, open top (60 triangles). */
export function tyreStackGeometry(): BufferGeometry {
  const sides = 5;
  // (height, radius, shade): the grooves between tyres are narrower and darker.
  const rings: [number, number, number][] = [
    [0, 0.31, GRIME],
    [0.125, 0.37, 0.85],
    [0.25, 0.3, 0.55],
    [0.375, 0.37, 1],
    [0.5, 0.3, 0.55],
    [0.625, 0.37, 1],
    [0.75, 0.31, 0.8],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  for (const [y, r, shade] of rings) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      normals.push(Math.cos(a), 0, Math.sin(a));
      colours.push(shade, shade, shade);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let k = 0; k < sides; k++) {
      const a = ring * sides + k;
      const b = ring * sides + ((k + 1) % sides);
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Galvanised W-beam across the rail height (u): two ridges, spray-stained at the bottom. */
function armcoTexture(): CanvasTexture {
  return canvasTexture(64, 4, (ctx) => {
    for (let x = 0; x < 64; x++) {
      const t = x / 63;
      const wave = 0.5 + 0.5 * Math.cos(t * Math.PI * 4);
      const spray = t < 0.3 ? 0.7 + t : 1;
      const l = (0.72 + 0.28 * wave) * spray;
      ctx.fillStyle = `rgb(${Math.round(0xae * l)},${Math.round(0xb3 * l)},${Math.round(0xb6 * l)})`;
      ctx.fillRect(x, 0, 1, 4);
    }
  });
}

/** Kerb paint: 1 m red, 1 m white along the lap (v in metres). */
function kerbTexture(anisotropy: number): CanvasTexture {
  const texture = canvasTexture(
    8,
    64,
    (ctx) => {
      ctx.fillStyle = '#b81c2b';
      ctx.fillRect(0, 0, 8, 32);
      ctx.fillStyle = '#e2e0da';
      ctx.fillRect(0, 32, 8, 32);
    },
    anisotropy,
  );
  texture.repeat.set(1, 0.5);
  return texture;
}

/** Chequered line: 0.5 m squares (uv in metres). */
function checkerTexture(anisotropy: number): CanvasTexture {
  const texture = canvasTexture(
    64,
    64,
    (ctx) => {
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#141414' : '#e6e4de';
          ctx.fillRect(x * 32, y * 32, 32, 32);
        }
      }
    },
    anisotropy,
  );
  texture.magFilter = NearestFilter;
  return texture;
}

/** Catch fence: a diamond wire mesh, mostly see-through. */
function fenceTexture(anisotropy: number): CanvasTexture {
  const texture = canvasTexture(
    32,
    32,
    (ctx) => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.strokeStyle = 'rgba(70,74,76,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(32, 32);
      ctx.moveTo(32, 0);
      ctx.lineTo(0, 32);
      ctx.stroke();
    },
    anisotropy,
  );
  texture.repeat.set(2, 2);
  return texture;
}

interface Materials {
  road: MeshStandardMaterial;
  lines: MeshStandardMaterial;
  kerb: MeshStandardMaterial;
  grass: MeshStandardMaterial;
  gravel: MeshStandardMaterial;
  armco: MeshStandardMaterial;
  tyres: MeshStandardMaterial;
  wall: MeshStandardMaterial;
  fence: MeshStandardMaterial;
  checker: MeshStandardMaterial;
}

/**
 * The terrain sits only 5 cm under the run-off at the wall foot: pull the corridor bands forward
 * in depth so they never z-fight with it at range (units scale with depth precision).
 */
const BAND_OFFSET = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 };

const f2 = (n: number) => n.toFixed(3);

function createMaterials(textures: TrackTextures, anisotropy: number, owned: Texture[]): Materials {
  const road = patchMaterial(
    new MeshStandardMaterial({
      ...pbrMaps(textures.asphalt, SCENERY.asphaltTile, owned),
      color: new Color().setScalar(SCENERY.asphaltAlbedo),
      roughness: 1,
      metalness: 0,
      ...BAND_OFFSET,
    }),
    {
      key: 'sw-asphalt-mask-v1',
      vertexHead: `attribute float racingLine;\nattribute vec4 roadInfo;\nvarying vec2 vRoadUv;\nvarying float vRacing;\nvarying vec4 vRoad;`,
      vertex: `vRoadUv = uv; vRacing = racingLine; vRoad = roadInfo;`,
      fragmentHead: `varying vec2 vRoadUv;\nvarying float vRacing;\nvarying vec4 vRoad;`,
      afterMap: /* glsl */ `
        // vRoad: x left half width, y right half width, z braking zone, w apron (paved run-off).
        float swLat = vRoadUv.x;
        float swWobble = (swNoise(vSwWorld.xz * 0.33) - 0.5) * 0.5;
        float swLine = abs(swLat - vRacing);
        float swRubber = (1.0 - smoothstep(0.45, ${f2(SCENERY.rubberHalfWidth)} + swWobble, swLine)) * (1.0 - vRoad.w);
        float swBrake = vRoad.z * (1.0 - smoothstep(0.8, 1.5 + swWobble, swLine)) * (1.0 - vRoad.w);
        float swEdge = min(swLat + vRoad.x, vRoad.y - swLat);
        float swDust = (1.0 - smoothstep(0.5, 1.05, swEdge)) * smoothstep(0.35, 0.5, swEdge) * (1.0 - vRoad.w);
        float swMacro = 1.0 + 0.12 * (swNoise(vSwWorld.xz * 0.04) - 0.5) + 0.06 * (swNoise(vSwWorld.xz * 0.17 + 17.0) - 0.5);
        // Resurfaced patches: road-aligned rectangles, about one per 400 m.
        vec2 swCell = floor(vec2(swLat / 4.0, vRoadUv.y / 15.0));
        float swPatch = step(0.965, swHash(swCell + 3.7)) * (1.0 - vRoad.w);
        diffuseColor.rgb *= mix(1.0, ${f2(SCENERY.apronAlbedo / SCENERY.asphaltAlbedo)}, vRoad.w) * swMacro
          * mix(1.0, ${f2(SCENERY.rubberAlbedo)}, swRubber) * mix(1.0, 0.92, swBrake)
          * mix(1.0, 1.1, swDust) * mix(1.0, 0.9, swPatch);`,
      afterRoughness: `roughnessFactor = clamp(roughnessFactor - ${f2(SCENERY.rubberRoughness)} * swRubber - 0.05 * swPatch + 0.05 * vRoad.w, 0.05, 1.0);`,
    },
  );
  road.normalScale.set(0.6, 0.6);

  const lines = patchMaterial(
    new MeshStandardMaterial({
      color: '#e4e2da',
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    }),
    {
      key: 'sw-lines-v1',
      afterMap: `diffuseColor.rgb *= mix(1.0, 0.85, smoothstep(0.55, 0.75, swNoise(vSwWorld.xz * 1.7)));`,
    },
  );

  const kerbMap = kerbTexture(anisotropy);
  owned.push(kerbMap);
  const kerb = patchMaterial(
    new MeshStandardMaterial({ map: kerbMap, roughness: 0.55, ...BAND_OFFSET }),
    {
      key: 'sw-kerb-v1',
      vertexHead: `attribute float apex;\nvarying vec2 vKerbUv;\nvarying float vApex;`,
      vertex: `vKerbUv = uv; vApex = apex;`,
      fragmentHead: `varying vec2 vKerbUv;\nvarying float vApex;`,
      afterMap: /* glsl */ `
        // Sawtooth: the back face of each 0.5 m ridge is a shade darker.
        diffuseColor.rgb *= mix(1.0, 0.82, step(0.5, fract(vKerbUv.y * 2.0)));
        // Rubber on the road-side 40% of apex kerbs, broken up by noise.
        float swN = swNoise(vSwWorld.xz * 1.3);
        float swRub = vApex * (1.0 - smoothstep(0.25, 0.45, vKerbUv.x + (swN - 0.5) * 0.2));
        diffuseColor.rgb *= mix(1.0, 0.72, swRub * (0.55 + 0.45 * swN));`,
    },
  );

  const grass = patchMaterial(
    new MeshStandardMaterial({
      ...pbrMaps(textures.grass, SCENERY.grassTile, owned),
      color: linear(SCENERY.grassColour),
      roughness: 1,
      metalness: 0,
      ...BAND_OFFSET,
    }),
    {
      key: 'sw-grass-v1',
      vertexHead: `varying vec2 vGrassUv;`,
      vertex: `vGrassUv = uv;`,
      fragmentHead: `varying vec2 vGrassUv;`,
      afterMap: /* glsl */ `
        // Mowing stripes 4.5 m wide, parallel to the track, then broad patches and dry spots.
        float swStripe = smoothstep(0.42, 0.58, abs(fract(vGrassUv.x / 9.0) * 2.0 - 1.0));
        diffuseColor.rgb *= mix(0.95, 1.05, swStripe) * (0.9 + 0.2 * swNoise(vSwWorld.xz * 0.033));
        diffuseColor.r *= 1.0 + 0.06 * smoothstep(0.6, 0.85, swNoise(vSwWorld.xz * 0.05 + 9.0));`,
    },
  );
  grass.normalScale.set(0.8, 0.8);

  const gravel = patchMaterial(
    new MeshStandardMaterial({
      ...pbrMaps(textures.gravel, SCENERY.gravelTile, owned),
      color: linear(SCENERY.gravelColour),
      roughness: 1,
      metalness: 0,
      ...BAND_OFFSET,
    }),
    {
      key: 'sw-gravel-v1',
      vertexHead: `attribute vec2 gravelInfo;\nvarying vec2 vGravelUv;\nvarying vec2 vGravel;`,
      vertex: `vGravelUv = uv; vGravel = gravelInfo;`,
      fragmentHead: `varying vec2 vGravelUv;\nvarying vec2 vGravel;`,
      afterMap: /* glsl */ `
        // vGravel: x metres along the lap to grass, y the wall's lateral. Dirt at the wall foot,
        // and a ragged, trampled edge where the trap meets the grass.
        float swN = swNoise(vSwWorld.xz * 0.7);
        float swToWall = vGravel.y - abs(vGravelUv.x);
        diffuseColor.rgb *= mix(0.85, 1.0, smoothstep(0.3, 1.5 + swN, swToWall));
        float swGrassy = 1.0 - smoothstep(0.0, 2.5, vGravel.x + (swN - 0.5) * 3.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.065, 0.025), swGrassy * 0.85);`,
    },
  );

  const armcoMap = armcoTexture();
  owned.push(armcoMap);
  const armco = new MeshStandardMaterial({
    map: armcoMap,
    vertexColors: true,
    metalness: 0.9,
    roughness: 0.42,
    side: DoubleSide,
    shadowSide: DoubleSide,
  });
  const tyres = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    side: DoubleSide,
    shadowSide: DoubleSide,
  });
  const wall = new MeshStandardMaterial({ color: '#c4c1b8', vertexColors: true, roughness: 0.85 });
  const fenceMap = fenceTexture(anisotropy);
  owned.push(fenceMap);
  const fence = new MeshStandardMaterial({
    map: fenceMap,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    roughness: 0.6,
    metalness: 0.5,
  });
  const checkerMap = checkerTexture(anisotropy);
  owned.push(checkerMap);
  const checker = new MeshStandardMaterial({
    map: checkerMap,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -12,
  });
  return { road, lines, kerb, grass, gravel, armco, tyres, wall, fence, checker };
}

/** Builds the corridor meshes. The PBR sets stay owned by the caller; the tiled clones don't. */
export function createTrackVisual(
  track: Track,
  textures: TrackTextures,
  anisotropy: number,
): TrackVisual {
  const group = new Group();
  group.name = 'track';
  const owned: Texture[] = [];
  const materials = createMaterials(textures, anisotropy, owned);
  const geometries: BufferGeometry[] = [];
  const braking = brakingWeights(track);
  const gravelEdge = {
    [-1]: gravelEdgeDistance(track, -1, GRAVEL_EDGE),
    [1]: gravelEdgeDistance(track, 1, GRAVEL_EDGE),
  };
  const tyreGeometry = tyreStackGeometry();
  geometries.push(tyreGeometry);
  let meshes = 0;

  const add = (geometry: BufferGeometry, material: Material, chunk: CorridorChunk | null) => {
    geometries.push(geometry);
    if (chunk) {
      // The chunk's sphere covers every band (and the barriers on its edge): they cull together.
      geometry.boundingSphere = new Sphere(new Vector3(...chunk.centre), chunk.radius + 4);
    } else {
      geometry.computeBoundingSphere();
    }
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes++;
    return mesh;
  };

  const chunks = corridorChunks(track);
  for (const chunk of chunks) {
    const { bands } = chunk;
    // Asphalt and the paved apron share one material: roadInfo.w tells them apart.
    const roadParts: { band: BandMesh; apron: boolean }[] = [];
    if (bands.asphalt) roadParts.push({ band: bands.asphalt, apron: false });
    if (bands.apron) roadParts.push({ band: bands.apron, apron: true });
    if (roadParts.length) {
      const merged = concatBands(roadParts.map((p) => p.band));
      const count = merged.positions.length / 3;
      const racing = new Float32Array(count);
      const info = new Float32Array(count * 4);
      let offset = 0;
      for (const { band, apron } of roadParts) {
        const n = band.positions.length / 3;
        for (let k = 0; k < n; k++) {
          const station = stationOf(track, band.uvs[k * 2 + 1] as number);
          const s = track.sample(station);
          racing[offset + k] = apron ? 1000 : (band.racingLine?.[k] ?? s.racingLine);
          info[(offset + k) * 4] = s.sideL.road;
          info[(offset + k) * 4 + 1] = s.sideR.road;
          info[(offset + k) * 4 + 2] = apron ? 0 : (braking[station] as number);
          info[(offset + k) * 4 + 3] = apron ? 1 : 0;
        }
        offset += n;
      }
      add(
        geometryOf(merged, { racingLine: [racing, 1], roadInfo: [info, 4] }),
        materials.road,
        chunk,
      );
    }
    if (bands.lines) add(geometryOf(bands.lines), materials.lines, chunk);
    if (bands.kerb) {
      const kerb = bands.kerb;
      const n = kerb.positions.length / 3;
      const apex = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const station = stationOf(track, kerb.uvs[k * 2 + 1] as number);
        const curvature = track.sample(station).curvature;
        const lateral = lateralOf(
          track,
          station,
          kerb.positions[k * 3] as number,
          kerb.positions[k * 3 + 2] as number,
        );
        const inside = curvature > 0 ? lateral < 0 : lateral > 0;
        const tight = Math.min(
          1,
          Math.max(0, (Math.abs(curvature) - 1 / 300) / (1 / 120 - 1 / 300)),
        );
        // Exit kerbs on the outside get run over too, less often.
        apex[k] = tight * (inside ? 1 : 0.45);
      }
      add(geometryOf(kerb, { apex: [apex, 1] }), materials.kerb, chunk);
    }
    // The skirt hangs below the run-off's outer edge, mostly under the terrain: it rides along
    // with the grass instead of costing a draw call of its own.
    const grassParts = [bands.grass, bands.skirt].filter((b): b is BandMesh => b !== undefined);
    if (grassParts.length) add(geometryOf(concatBands(grassParts)), materials.grass, chunk);
    if (bands.gravel) {
      const gravel = bands.gravel;
      const n = gravel.positions.length / 3;
      const info = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        const station = stationOf(track, gravel.uvs[k * 2 + 1] as number);
        const side = (gravel.uvs[k * 2] as number) < 0 ? -1 : 1;
        info[k * 2] = gravelEdge[side][station] as number;
        info[k * 2 + 1] = track.side(station, side).wall;
      }
      add(geometryOf(gravel, { gravelInfo: [info, 2] }), materials.gravel, chunk);
    }
    const armco = buildArmco(chunk);
    if (armco) add(armco, materials.armco, chunk).castShadow = true;
    const walls = buildWalls(track, chunk);
    if (walls.wall) add(walls.wall, materials.wall, chunk).castShadow = true;
    if (walls.fence) add(walls.fence, materials.fence, chunk).receiveShadow = false;
    if (chunk.tyreStacks.length) {
      const tyres = new InstancedMesh(tyreGeometry, materials.tyres, chunk.tyreStacks.length);
      const stations = tyreStations(track, chunk);
      chunk.tyreStacks.forEach((stack, i) => {
        const station = stations[i] ?? chunk.from;
        dummy.position.set(stack.x, stack.y - 0.03, stack.z);
        dummy.rotation.set(0, stack.yaw + station * 1.7, 0);
        dummy.updateMatrix();
        tyres.setMatrixAt(i, dummy.matrix);
        tyres.setColorAt(i, TYRE_PAINT[Math.floor(station / TYRE_BAND) % 3] as Color);
      });
      // Static per-chunk instances: the sphere from all of them is right for good.
      tyres.computeBoundingSphere();
      tyres.castShadow = true;
      tyres.receiveShadow = true;
      group.add(tyres);
      meshes++;
    }
  }

  const start = buildStart(track);
  add(start.checker, materials.checker, null);
  add(start.boxes, materials.lines, null);

  return {
    group,
    stats: { chunks: chunks.length, meshes },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of Object.values<Material>({ ...materials })) material.dispose();
      for (const texture of owned) texture.dispose();
      group.removeFromParent();
    },
  };
}

/** The station of each tyre stack, in the order `corridorChunks` pushes them (station, side, row). */
function tyreStations(track: Track, chunk: CorridorChunk): number[] {
  const stations: number[] = [];
  for (let i = chunk.from; i < chunk.to; i++) {
    for (const side of [-1, 1] as const) {
      if (track.side(i, side).barrier === BARRIER.tyres) stations.push(i, i);
    }
  }
  return stations;
}

/** The armco rail plus a post under each post placement, as one mesh. */
function buildArmco(chunk: CorridorChunk): BufferGeometry | null {
  const rail = chunk.bands.armco;
  if (!rail && chunk.armcoPosts.length === 0) return null;
  const builder = new PropBuilder();
  if (rail) {
    const n = rail.positions.length / 3;
    for (let k = 0; k < n; k++) {
      tmp.fromArray(rail.positions, k * 3);
      tmp2.fromArray(rail.normals, k * 3);
      builder.vertex(tmp, tmp2, rail.uvs[k * 2] as number, rail.uvs[k * 2 + 1] as number, 1);
    }
    for (const i of rail.indices) builder.indices.push(i);
  }
  const post = postGeometry();
  for (const p of chunk.armcoPosts) {
    rotation.setFromAxisAngle(UP, p.yaw);
    matrix.compose(tmp.set(p.x, p.y, p.z), rotation, unitScale);
    // Posts sample the dark, spray-stained bottom of the rail texture, with grime at the foot.
    builder.geometry(post, matrix, 0.05, (y) => grime(y + 0.25) * 0.85);
  }
  post.dispose();
  return builder.build();
}

/** An armco post (as a slim box): 0.75 m above the ground, 0.25 m below. */
function postGeometry(): BufferGeometry {
  const builder = new PropBuilder();
  const w = 0.06;
  const d = 0.05;
  const y0 = -0.25;
  const y1 = 0.75;
  const corners = [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ] as const;
  const normal = new Vector3();
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k] as readonly [number, number];
    const [bx, bz] = corners[(k + 1) % 4] as readonly [number, number];
    // Each side's midpoint points straight out of a box centred on the origin.
    normal.set(ax + bx, 0, az + bz).normalize();
    const a = builder.vertex(tmp.set(ax, y0, az), normal, 0, 0, 1);
    const b = builder.vertex(tmp.set(bx, y0, bz), normal, 0, 0, 1);
    const c = builder.vertex(tmp.set(ax, y1, az), normal, 0, 0, 1);
    const e = builder.vertex(tmp.set(bx, y1, bz), normal, 0, 0, 1);
    // Seen from outside, b is on the left.
    builder.quad(b, a, e, c);
  }
  const top = [0, 1, 2, 3].map((k) => {
    const [x, z] = corners[k] as readonly [number, number];
    return builder.vertex(tmp.set(x, y1, z), UP, 0, 0, 1);
  });
  const [t0, t1, t2, t3] = top as [number, number, number, number];
  builder.indices.push(t0, t3, t2, t0, t2, t1);
  return builder.build();
}

/** The pit wall and the catch fence's concrete base (with its posts), and the fence mesh. */
function buildWalls(
  track: Track,
  chunk: CorridorChunk,
): { wall: BufferGeometry | null; fence: BufferGeometry | null } {
  const wall = new PropBuilder();
  const fence = new PropBuilder();
  const face = new Vector3();
  const back = new Vector3();
  const grey = new Color(0.55, 0.57, 0.58);
  const solid = (b: number) => b === BARRIER.wall || b === BARRIER.fence;
  for (const side of [-1, 1] as const) {
    for (let i = chunk.from; i < chunk.to; i++) {
      const p0 = track.side(i, side);
      const p1 = track.side(i + 1, side);
      if (!solid(p0.barrier) || !solid(p1.barrier)) continue;
      const r0 = track.sample(i).right;
      // Normals: the road face looks back at the road, the back face away from it.
      face.copy(r0).multiplyScalar(-side);
      back.copy(r0).multiplyScalar(side);
      const heights = [-0.15, GRIME_HEIGHT, WALL_HEIGHT];
      const ring = (station: number, lateral: number, normal: Vector3) =>
        heights.map((h) =>
          wall.vertex(
            track.lateralPoint(station, lateral, tmp, h),
            normal,
            0,
            station,
            grime(Math.max(0, h)),
          ),
        );
      const lf0 = side * p0.wall;
      const lf1 = side * p1.wall;
      const lb0 = side * (p0.wall + WALL_THICKNESS);
      const lb1 = side * (p1.wall + WALL_THICKNESS);
      const f0 = ring(i, lf0, face);
      const f1 = ring(i + 1, lf1, face);
      const b0 = ring(i, lb0, back);
      const b1 = ring(i + 1, lb1, back);
      for (let h = 0; h < 2; h++) {
        // Facing +right the viewer's right hand points back down the lap, facing -right ahead.
        const [fl, fr] = side > 0 ? [f1, f0] : [f0, f1];
        const [bl, br] = side > 0 ? [b0, b1] : [b1, b0];
        wall.quad(fl[h] as number, fr[h] as number, fl[h + 1] as number, fr[h + 1] as number);
        wall.quad(bl[h] as number, br[h] as number, bl[h + 1] as number, br[h + 1] as number);
      }
      // Top: counter-clockwise from above.
      const t0 = wall.vertex(track.lateralPoint(i, lf0, tmp, WALL_HEIGHT), UP, 0, i, 1);
      const t1 = wall.vertex(track.lateralPoint(i + 1, lf1, tmp, WALL_HEIGHT), UP, 0, i, 1);
      const t2 = wall.vertex(track.lateralPoint(i, lb0, tmp, WALL_HEIGHT), UP, 0, i, 1);
      const t3 = wall.vertex(track.lateralPoint(i + 1, lb1, tmp, WALL_HEIGHT), UP, 0, i, 1);
      if (side > 0) wall.quad(t0, t2, t1, t3);
      else wall.quad(t2, t0, t3, t1);

      if (p0.barrier !== BARRIER.fence) continue;
      // Fence mesh above the wall, over the middle of its top; uv in metres.
      const lm0 = side * (p0.wall + WALL_THICKNESS * 0.5);
      const lm1 = side * (p1.wall + WALL_THICKNESS * 0.5);
      const span = FENCE_TOP - WALL_HEIGHT;
      const m0 = fence.vertex(track.lateralPoint(i, lm0, tmp, WALL_HEIGHT), face, 0, i, 1);
      const m1 = fence.vertex(track.lateralPoint(i + 1, lm1, tmp, WALL_HEIGHT), face, 0, i + 1, 1);
      const m2 = fence.vertex(track.lateralPoint(i, lm0, tmp, FENCE_TOP), face, span, i, 1);
      const m3 = fence.vertex(track.lateralPoint(i + 1, lm1, tmp, FENCE_TOP), face, span, i + 1, 1);
      fence.quad(m0, m1, m2, m3);
      if (i % FENCE_POST_EVERY !== 0) continue;
      // A steel post in the wall's mesh (grey vertex colour), both windings: it's 10 cm thick.
      const base = track.lateralPoint(i, lm0, new Vector3(), WALL_HEIGHT);
      const along = track.sample(i).tangent;
      const across = track.sample(i).right;
      const ids: [number, number][] = [];
      for (const [a, b] of [
        [-0.05, -0.05],
        [0.05, -0.05],
        [0.05, 0.05],
        [-0.05, 0.05],
      ] as const) {
        const n = new Vector3()
          .copy(along)
          .multiplyScalar(a)
          .addScaledVector(across, b)
          .normalize();
        const at = (h: number) =>
          tmp
            .copy(base)
            .addScaledVector(along, a)
            .addScaledVector(across, b)
            .setY(base.y + h);
        ids.push([wall.vertex(at(0), n, 0, i, grey), wall.vertex(at(span + 0.1), n, 0, i, grey)]);
      }
      for (let k = 0; k < 4; k++) {
        const [a0, a1] = ids[k] as [number, number];
        const [b0, b1] = ids[(k + 1) % 4] as [number, number];
        wall.indices.push(a0, b0, b1, a0, b1, a1, a0, b1, b0, a0, a1, b1);
      }
    }
  }
  return {
    wall: wall.empty ? null : wall.build(),
    fence: fence.empty ? null : fence.build(),
  };
}

/** The chequered start line and the grid boxes behind it. */
function buildStart(track: Track): { checker: BufferGeometry; boxes: BufferGeometry } {
  const checker = new PropBuilder();
  const i = track.indexAt(track.startLine.distance);
  const l0 = -track.side(i, -1).road;
  const r0 = track.side(i, 1).road;
  const l1 = -track.side(i + 1, -1).road;
  const r1 = track.side(i + 1, 1).road;
  // uv in metres: u across, v along. Left-back, right-back, left-front, right-front.
  const a = checker.vertex(track.lateralPoint(i, l0, tmp, LINE_LIFT), UP, l0, 0, 1);
  const b = checker.vertex(track.lateralPoint(i, r0, tmp, LINE_LIFT), UP, r0, 0, 1);
  const c = checker.vertex(track.lateralPoint(i + 1, l1, tmp, LINE_LIFT), UP, l1, 1, 1);
  const d = checker.vertex(track.lateralPoint(i + 1, r1, tmp, LINE_LIFT), UP, r1, 1, 1);
  checker.indices.push(a, b, d, a, d, c);

  const boxes = new PropBuilder();
  const corner = new Vector3();
  /** A flat rectangle between two laterals, `back0`..`back1` metres behind station `at`. */
  const rect = (at: number, la: number, lb: number, back0: number, back1: number) => {
    const t = track.sample(at).tangent;
    const p = (l: number, back: number) =>
      corner.copy(track.lateralPoint(at, l, tmp, LINE_LIFT)).addScaledVector(t, -back);
    const fl = boxes.vertex(p(la, back0), UP, 0, 0, 1);
    const fr = boxes.vertex(p(lb, back0), UP, 0, 0, 1);
    const bl = boxes.vertex(p(la, back1), UP, 0, 0, 1);
    const br = boxes.vertex(p(lb, back1), UP, 0, 0, 1);
    boxes.indices.push(bl, br, fr, bl, fr, fl);
  };
  const projection = { index: 0, distance: 0, lateral: 0 };
  for (const spawn of track.gridSpawns(GRID_SLOTS)) {
    track.project(tmp2.set(spawn.x, 0, spawn.z), -1, projection);
    const { index, lateral } = projection;
    // Front bar a little ahead of the car's nose, short side ticks running back from it.
    rect(index, lateral - 1.3, lateral + 1.3, -2.6, -2.4);
    rect(index, lateral - 1.3, lateral - 1.15, -2.4, -1.2);
    rect(index, lateral + 1.15, lateral + 1.3, -2.4, -1.2);
  }
  return { checker: checker.build(), boxes: boxes.build() };
}
