/// <reference types="node" />
/**
 * Asset validator for the runtime car files (spec C2a.4, contract 3.9, budgets 4.4). Reads the GLB
 * JSON chunk itself (no WebGL): names, wheel positions and radii against CARS geometry, triangle
 * and mesh budgets per level, material names, images, credits, the debrand word scan and the
 * phone thumbnails.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAR_CREDITS, CAR_IDS, PLAYER_COLOURS, creditLine, type CarId } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import budgets from '../../../../scripts/cars/budgets.json';
import vocabulary from '../../../../scripts/cars/vocabulary.json';
import debrand from '../../../../scripts/debrand-words.json';
import { CARS } from '../config';

/**
 * Placeholder cars (built from the CC0 sports car) pass until the real cars land; C2b sets this
 * to false so any placeholder left fails.
 */
const ALLOW_PLACEHOLDERS = true;

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const CARS_DIR = join(REPO_ROOT, 'assets', 'cars');
const ASSETS_MD = readFileSync(join(REPO_ROOT, 'assets', 'ASSETS.md'), 'utf8');
/** Wheel hubs must sit within 5 mm of the configured geometry, radii within 3 mm (D-C4). */
const HUB_TOLERANCE = 0.005;
const RADIUS_TOLERANCE = 0.003;
const CORNERS = ['fl', 'fr', 'rl', 'rr'] as const;
const LOD1_NAMES = new Set(['paint', 'kit', 'glass', 'light_tail']);
const LOD2_NAMES = new Set(['paint', 'palette']);
const LOD0_NAME = new RegExp(
  `^(${Object.keys(vocabulary.families).join('|')})(_cutout)?(\\.\\d+)?$`,
);

interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
}
interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}
interface GltfMaterial {
  name?: string;
  alphaMode?: string;
  pbrMetallicRoughness?: {
    baseColorTexture?: { index: number };
    metallicRoughnessTexture?: { index: number };
  };
  normalTexture?: { index: number };
  occlusionTexture?: { index: number };
  emissiveTexture?: { index: number };
}
interface Gltf {
  asset: { copyright?: string; extras?: Record<string, unknown> };
  extensionsRequired?: string[];
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: GltfPrimitive[] }[];
  accessors: { count: number; min?: number[]; max?: number[] }[];
  materials: GltfMaterial[];
  textures?: { source: number }[];
  images?: { mimeType?: string; bufferView: number; name?: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

interface Car {
  bytes: Buffer;
  json: Gltf;
  bin: Buffer;
}

function readCar(id: CarId): Car {
  const bytes = readFileSync(join(CARS_DIR, id, `${id}.glb`));
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf;
  const binStart = 20 + jsonLength;
  const bin = bytes.subarray(binStart + 8, binStart + 8 + bytes.readUInt32LE(binStart));
  return { bytes, json, bin };
}

function child(json: Gltf, parent: GltfNode, name: string): GltfNode | undefined {
  return (parent.children ?? []).map((i) => json.nodes[i]).find((node) => node?.name === name);
}

/** Every primitive in a node's subtree. */
function primitivesUnder(json: Gltf, node: GltfNode | undefined): GltfPrimitive[] {
  if (!node) return [];
  const own = node.mesh !== undefined ? (json.meshes[node.mesh]?.primitives ?? []) : [];
  return [
    ...own,
    ...(node.children ?? []).flatMap((i) => {
      const next = json.nodes[i];
      return next ? primitivesUnder(json, next) : [];
    }),
  ];
}

function triangles(json: Gltf, primitives: GltfPrimitive[]): number {
  return primitives.reduce((sum, p) => {
    const accessor = json.accessors[p.indices ?? p.attributes.POSITION ?? -1];
    return sum + (accessor?.count ?? 0) / 3;
  }, 0);
}

function materialNames(json: Gltf, primitives: GltfPrimitive[]): string[] {
  return primitives.map((p) => (p.material === undefined ? '' : (json.materials[p.material]?.name ?? '')));
}

/** Width and height of a PNG or JPEG from its header. */
function imageSize(data: Buffer): { width: number; height: number } {
  if (data.readUInt32BE(0) === 0x89504e47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw new Error('Bad JPEG marker');
    const marker = data[offset + 1] ?? 0;
    const length = data.readUInt16BE(offset + 2);
    // Start-of-frame markers (baseline, progressive, ...), not DHT, JPG or DAC.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG without a frame header');
}

function imageBytes(car: Car, index: number): Buffer {
  const image = car.json.images?.[index];
  if (!image) throw new Error(`No image ${index}`);
  const view = car.json.bufferViews[image.bufferView];
  if (!view) throw new Error(`No buffer view for image ${index}`);
  const start = view.byteOffset ?? 0;
  return car.bin.subarray(start, start + view.byteLength);
}

/** Image indices a set of primitives' materials use. */
function imagesOf(json: Gltf, primitives: GltfPrimitive[]): Set<number> {
  const out = new Set<number>();
  for (const p of primitives) {
    const material = p.material === undefined ? undefined : json.materials[p.material];
    if (!material) continue;
    for (const info of [
      material.pbrMetallicRoughness?.baseColorTexture,
      material.pbrMetallicRoughness?.metallicRoughnessTexture,
      material.normalTexture,
      material.occlusionTexture,
      material.emissiveTexture,
    ]) {
      const source = info ? json.textures?.[info.index]?.source : undefined;
      if (source !== undefined) out.add(source);
    }
  }
  return out;
}

/** GPU estimate: RGBA8 with mipmaps. */
function gpuBytes(car: Car, images: Set<number>): number {
  let sum = 0;
  for (const index of images) {
    const { width, height } = imageSize(imageBytes(car, index));
    sum += (width * height * 4 * 4) / 3;
  }
  return sum;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function expectedHub(id: CarId, corner: (typeof CORNERS)[number]): [number, number, number] {
  const g = CARS[id].geometry;
  const front = corner.startsWith('f');
  const half = front ? g.halfTrackFront : g.halfTrackRear;
  return [
    corner.endsWith('l') ? half : -half,
    front ? g.radiusFront : g.radiusRear,
    front ? g.wheelbaseHalf : -g.wheelbaseHalf,
  ];
}

const thumbsPath = join(CARS_DIR, 'thumbs.json');
const thumbs = existsSync(thumbsPath)
  ? (JSON.parse(readFileSync(thumbsPath, 'utf8')) as Partial<Record<string, { glbSha256?: string }>>)
  : {};

describe('runtime car files', () => {
  for (const id of CAR_IDS) {
    describe(id, () => {
      it('exists', () => {
        expect(existsSync(join(CARS_DIR, id, `${id}.glb`))).toBe(true);
      });

      it('has the node tree of contract 3.9', () => {
        const { json } = readCar(id);
        const roots = json.scenes[json.scene ?? 0]?.nodes ?? [];
        expect(roots).toHaveLength(1);
        const root = json.nodes[roots[0] ?? -1];
        expect(root?.name).toBe(`car_${id}`);
        if (!root) return;
        expect(root.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
        expect(root.rotation).toBeUndefined();
        expect(root.scale).toBeUndefined();
        expect(root.matrix).toBeUndefined();
        const names = (root.children ?? []).map((i) => json.nodes[i]?.name);
        for (const name of ['body_lod0', 'body_lod1', 'body_lod2', 'shadow']) {
          expect(names).toContain(name);
        }
        for (const corner of CORNERS) {
          const wheel = child(json, root, `wheel_${corner}`);
          expect(wheel, `wheel_${corner}`).toBeDefined();
          if (!wheel) continue;
          expect(wheel.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
          expect(wheel.scale).toBeUndefined();
          expect(wheel.matrix).toBeUndefined();
          expect(child(json, wheel, `wheel_${corner}_lod0`)).toBeDefined();
          expect(child(json, wheel, `wheel_${corner}_lod1`)).toBeDefined();
        }
        for (const corner of ['fl', 'fr']) {
          const caliper = child(json, root, `caliper_${corner}`);
          if (caliper) expect(child(json, caliper, `caliper_${corner}_lod0`)).toBeDefined();
        }
        const allowed = new Set([
          'body_lod0',
          'body_lod1',
          'body_lod2',
          'shadow',
          ...CORNERS.map((c) => `wheel_${c}`),
          'caliper_fl',
          'caliper_fr',
        ]);
        for (const name of names) expect(allowed.has(name ?? '')).toBe(true);
      });

      it('puts every wheel at its configured hub and radius', () => {
        const { json } = readCar(id);
        const root = json.nodes[json.scenes[json.scene ?? 0]?.nodes[0] ?? -1];
        if (!root) throw new Error('no root');
        for (const corner of CORNERS) {
          const wheel = child(json, root, `wheel_${corner}`);
          if (!wheel) throw new Error(`no wheel_${corner}`);
          const hub = wheel.translation ?? [0, 0, 0];
          const want = expectedHub(id, corner);
          for (let axis = 0; axis < 3; axis++) {
            expect(Math.abs((hub[axis] ?? 0) - (want[axis] ?? 0)), `wheel_${corner} axis ${axis}`).toBeLessThanOrEqual(
              HUB_TOLERANCE,
            );
          }
          const min = [Infinity, Infinity, Infinity];
          const max = [-Infinity, -Infinity, -Infinity];
          for (const p of primitivesUnder(json, child(json, wheel, `wheel_${corner}_lod0`))) {
            const accessor = json.accessors[p.attributes.POSITION ?? -1];
            for (let axis = 0; axis < 3; axis++) {
              min[axis] = Math.min(min[axis] ?? 0, accessor?.min?.[axis] ?? Infinity);
              max[axis] = Math.max(max[axis] ?? 0, accessor?.max?.[axis] ?? -Infinity);
            }
          }
          const radius = Math.max((max[1] ?? 0) - (min[1] ?? 0), (max[2] ?? 0) - (min[2] ?? 0)) / 2;
          expect(Math.abs(radius - want[1]), `wheel_${corner} radius ${radius}`).toBeLessThanOrEqual(
            RADIUS_TOLERANCE,
          );
        }
      });

      it('keeps every level within its triangle, mesh and texture budgets', () => {
        const car = readCar(id);
        const { json } = car;
        const root = json.nodes[json.scenes[json.scene ?? 0]?.nodes[0] ?? -1];
        if (!root) throw new Error('no root');
        const wheels = CORNERS.map((c) => child(json, root, `wheel_${c}`));
        const calipers = ['fl', 'fr'].map((c) => child(json, root, `caliper_${c}`));
        const lod0 = [
          ...primitivesUnder(json, child(json, root, 'body_lod0')),
          ...wheels.flatMap((w, i) => (w ? primitivesUnder(json, child(json, w, `wheel_${CORNERS[i] ?? ''}_lod0`)) : [])),
          ...calipers.flatMap((c) => primitivesUnder(json, c)),
        ];
        const lod1 = [
          ...primitivesUnder(json, child(json, root, 'body_lod1')),
          ...wheels.flatMap((w, i) => (w ? primitivesUnder(json, child(json, w, `wheel_${CORNERS[i] ?? ''}_lod1`)) : [])),
        ];
        const lod2 = primitivesUnder(json, child(json, root, 'body_lod2'));
        const shadow = primitivesUnder(json, child(json, root, 'shadow'));
        expect(triangles(json, lod0)).toBeLessThanOrEqual(budgets.lod0.triangles);
        expect(lod0.length).toBeLessThanOrEqual(budgets.lod0.draws);
        expect(triangles(json, lod1)).toBeLessThanOrEqual(budgets.lod1.triangles);
        expect(lod1.length).toBeLessThanOrEqual(budgets.lod1.draws);
        expect(triangles(json, lod2)).toBeLessThanOrEqual(budgets.lod2.triangles);
        expect(lod2.length).toBeLessThanOrEqual(budgets.lod2.draws);
        expect(shadow).toHaveLength(1);
        expect(triangles(json, shadow)).toBeLessThanOrEqual(budgets.shadow.triangles);
        expect(Object.keys(shadow[0]?.attributes ?? {})).toEqual(['POSITION']);
        for (const p of [...lod0, ...lod1, ...lod2, ...shadow]) expect(p.mode ?? 4).toBe(4);
        expect(gpuBytes(car, imagesOf(json, lod0))).toBeLessThanOrEqual(budgets.lod0.gpuBytes);
        expect(gpuBytes(car, imagesOf(json, lod1))).toBeLessThanOrEqual(budgets.lod1.gpuBytes);
        expect(car.bytes.length).toBeLessThanOrEqual(budgets.fileBytes);
      });

      it('uses only the material names, alpha modes and extensions of contract 3.9', () => {
        const { json } = readCar(id);
        const root = json.nodes[json.scenes[json.scene ?? 0]?.nodes[0] ?? -1];
        if (!root) throw new Error('no root');
        const levelOf = (name: string): RegExp | Set<string> =>
          name.endsWith('_lod1') ? LOD1_NAMES : name.endsWith('_lod2') ? LOD2_NAMES : LOD0_NAME;
        const visit = (node: GltfNode, level: RegExp | Set<string> | null): void => {
          const here = node.name && /_lod[012]$/.test(node.name) ? levelOf(node.name) : level;
          if (node.mesh !== undefined) {
            const prims = json.meshes[node.mesh]?.primitives ?? [];
            for (const [i, name] of materialNames(json, prims).entries()) {
              const material = json.materials[prims[i]?.material ?? -1];
              const alpha = material?.alphaMode ?? 'OPAQUE';
              if (node.name === 'shadow') {
                expect(name).toBe('shadow');
              } else if (here instanceof Set) {
                expect(here.has(name), `${node.name ?? ''}: ${name}`).toBe(true);
                expect(alpha === 'MASK', `${name} alpha-tested outside LOD0`).toBe(false);
              } else if (here) {
                expect(here.test(name), `${node.name ?? ''}: ${name}`).toBe(true);
              }
              // glass is the only transparent material.
              if (alpha === 'BLEND') expect(name.replace(/\.\d+$/, '')).toBe('glass');
            }
          }
          for (const i of node.children ?? []) {
            const next = json.nodes[i];
            if (next) visit(next, here);
          }
        };
        visit(root, null);
        for (const name of json.extensionsRequired ?? []) expect(name).toBe('KHR_materials_clearcoat');
      });

      it('carries JPEG or PNG images of at most 2048 px', () => {
        const car = readCar(id);
        (car.json.images ?? []).forEach((image, index) => {
          expect(['image/jpeg', 'image/png']).toContain(image.mimeType);
          const { width, height } = imageSize(imageBytes(car, index));
          expect(Math.max(width, height)).toBeLessThanOrEqual(budgets.lod0.maxImagePx);
        });
      });

      it('credits its source and says how it was built', () => {
        const { json } = readCar(id);
        const extras = json.asset.extras ?? {};
        expect(extras.carId).toBe(id);
        expect(extras.builder).toBe('build-cars@1');
        expect(String(extras.sourceSha256)).toMatch(/^[0-9a-f]{64}$/);
        if (extras.placeholder === true) {
          expect(ALLOW_PLACEHOLDERS, 'placeholder car left in place').toBe(true);
          expect(json.asset.copyright).toBeTruthy();
          expect(ASSETS_MD).toContain(json.asset.copyright ?? '');
        } else {
          expect(json.asset.copyright).toBe(creditLine(id));
        }
      });

      it('names no real brand, place or author outside the asset block', () => {
        const { json } = readCar(id);
        const rest: Partial<Gltf> = { ...json };
        delete rest.asset;
        const text = JSON.stringify(rest);
        for (const word of debrand.words) {
          const pattern = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i');
          expect(pattern.test(text), `"${word}" in ${id}.glb`).toBe(false);
        }
      });

      it('has eight thumbnails rendered from this exact file', () => {
        const { bytes } = readCar(id);
        for (const colour of PLAYER_COLOURS) {
          const path = join(CARS_DIR, id, `thumb-${colour.id}.webp`);
          expect(existsSync(path), path).toBe(true);
          expect(statSync(path).size).toBeLessThanOrEqual(budgets.thumbBytes);
        }
        expect(thumbs[id]?.glbSha256).toBe(sha256(bytes));
      });
    });
  }

  it('lists every shipped car in assets/ASSETS.md once no placeholder remains', () => {
    const placeholders = CAR_IDS.filter((id) => readCar(id).json.asset.extras?.placeholder === true);
    if (placeholders.length) return;
    const rows = ASSETS_MD.split('\n');
    for (const id of CAR_IDS) {
      const row = rows.find((line) => line.includes(`assets/cars/${id}/${id}.glb`));
      expect(row, `ASSETS.md row for ${id}`).toBeDefined();
      const author = CAR_CREDITS[id].author.replace(/\s*\(.*\)$/, '');
      expect(row).toContain(author);
    }
  });

  it('keeps assets/cars within its total size budget', () => {
    let total = 0;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else total += statSync(path).size;
      }
    };
    walk(CARS_DIR);
    expect(total).toBeLessThanOrEqual(budgets.totalBytes);
  });
});
