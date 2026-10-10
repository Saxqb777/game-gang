/**
 * Everything beside the track: an interim pine forest (until the Track 1 dressing replaces it), a
 * grandstand at the start and trackside banners. Each kind is one instanced or merged mesh, so the
 * scenery costs a handful of draw calls per viewport. Placement is seeded, so every race looks the
 * same.
 */
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm } from '../track/noise';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { bannerTexture, crowdTexture, pineGeometry } from './sceneryModels';

/** Interim forest: candidate spacing (m), how far out it reaches, and the tile size for culling. */
const PINE_SPACING = 15;
const PINE_REACH = 230;
const PINE_TILE = 200;
/** Pines keep this far back from the barriers (m), and from the grandstand. */
const PINE_ROAD_GAP = 7;
const GRANDSTAND_CENTRE_AHEAD = 55;

/** mulberry32: small, fast, seeded. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  tint?: Color;
}

const dummy = new Object3D();

export class Scenery {
  readonly group = new Group();
  // Sets: several instanced meshes may share one geometry and material.
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly textures: Texture[] = [];
  private readonly random = seeded(20251009);

  constructor(
    private readonly track: Track,
    private readonly terrain: Terrain,
  ) {
    this.addPines();
    this.addGrandstand();
    this.addBanners();
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.group.removeFromParent();
  }

  /** Far enough from every part of the road (m beyond the drivable edge). */
  private clear(x: number, z: number, margin: number): boolean {
    return (
      this.terrain.nearRoad(x, z, this.track.halfDrivable + margin + 2).distance >
      this.track.halfDrivable + margin
    );
  }

  /** Point beside sample `index`, `lateral` metres to the right (negative: left). */
  private beside(index: number, lateral: number): { x: number; z: number; yaw: number } {
    const s = this.track.sample(index);
    return {
      x: s.position.x + s.right.x * lateral,
      z: s.position.z + s.right.z * lateral,
      // Local +Z faces back towards the road.
      yaw: Math.atan2(-s.right.x * Math.sign(lateral), -s.right.z * Math.sign(lateral)),
    };
  }

  private instanced(
    geometry: BufferGeometry,
    material: Material,
    placements: readonly Placement[],
    shadows: boolean,
  ): InstancedMesh {
    this.geometries.add(geometry);
    this.materials.add(material);
    const mesh = new InstancedMesh(geometry, material, placements.length);
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (p.tint) mesh.setColorAt(i, p.tint);
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Pines scattered on a jittered grid around the circuit, in clumps with clearings between them,
   * thinning out into the hills. One instanced mesh per tile so off-screen tiles are culled.
   */
  private addPines(): void {
    const { track, terrain, random } = this;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.position.x);
      maxX = Math.max(maxX, s.position.x);
      minZ = Math.min(minZ, s.position.z);
      maxZ = Math.max(maxZ, s.position.z);
    }
    const stand = this.grandstandFrame();
    const tiles = new Map<string, Placement[]>();
    for (let gx = minX - PINE_REACH; gx <= maxX + PINE_REACH; gx += PINE_SPACING) {
      for (let gz = minZ - PINE_REACH; gz <= maxZ + PINE_REACH; gz += PINE_SPACING) {
        const x = gx + (random() - 0.5) * PINE_SPACING * 0.9;
        const z = gz + (random() - 0.5) * PINE_SPACING * 0.9;
        const scale = 0.75 + random() * 0.55;
        const yaw = random() * Math.PI * 2;
        const shade = 0.8 + random() * 0.4;
        const keep = random();
        const { distance } = terrain.nearRoad(x, z, PINE_REACH);
        const gap = distance - track.halfDrivable;
        if (gap < PINE_ROAD_GAP || gap >= PINE_REACH - 2) continue;
        // Clumps and clearings, and fewer trees the further out you look.
        const clump = fbm(x * 0.011 + 40, z * 0.011 - 12, 3);
        const thinning = 1 - 0.55 * Math.min(1, gap / PINE_REACH);
        if (clump < 0.4 || keep > thinning) continue;
        if (stand.covers(x, z)) continue;
        const key = `${Math.floor(x / PINE_TILE)},${Math.floor(z / PINE_TILE)}`;
        let tile = tiles.get(key);
        if (!tile) tiles.set(key, (tile = []));
        tile.push({
          x,
          y: terrain.heightAt(x, z) - 0.3,
          z,
          yaw,
          sx: scale,
          sy: scale * (0.9 + keep * 0.2),
          sz: scale,
          tint: new Color(shade, shade, shade),
        });
      }
    }
    const geometry = pineGeometry();
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    for (const placements of tiles.values()) this.instanced(geometry, material, placements, true);
  }

  /** Where the grandstand stands: the start straight's infield side, ahead of the line. */
  private grandstandFrame(): {
    index: number;
    offset: number;
    covers(x: number, z: number): boolean;
  } {
    const { track } = this;
    const centre = track.startLine.distance + GRANDSTAND_CENTRE_AHEAD;
    const index = Math.round(((centre % track.length) + track.length) % track.length);
    const offset = track.halfDrivable + 9;
    const s = track.sample(index);
    return {
      index,
      offset,
      covers: (x, z) => {
        const dx = x - s.position.x;
        const dz = z - s.position.z;
        const ahead = dx * s.tangent.x + dz * s.tangent.z;
        const lateral = dx * s.right.x + dz * s.right.z;
        // The stand (64 m long, ~14 m deep with its roof) plus room for the crowns.
        return Math.abs(ahead) < 40 && lateral < -offset + 8 && lateral > -offset - 22;
      },
    };
  }

  /** Covered stand on the infield side of the start straight, facing the grid. */
  private addGrandstand(): void {
    const { track } = this;
    const length = 64;
    const { index, offset } = this.grandstandFrame();
    const s = track.sample(index);
    const group = new Group();
    const x = s.position.x - s.right.x * offset;
    const z = s.position.z - s.right.z * offset;
    group.position.set(x, this.terrain.heightAt(x, z) - 0.2, z);
    // Local +Z points at the road (the stand is on its left), local +X runs along it.
    group.rotation.y = Math.atan2(s.right.x, s.right.z);

    const tiers = 7;
    const depth = 1.5;
    const rise = 0.75;
    const concrete: BufferGeometry[] = [];
    const crowd: BufferGeometry[] = [];
    for (let t = 0; t < tiers; t++) {
      const step = new BoxGeometry(length, rise * (t + 1), depth);
      step.translate(0, (rise * (t + 1)) / 2, -t * depth);
      concrete.push(step);
      // Spectators sit on every step: a strip of crowd facing the track.
      const people = new PlaneGeometry(length, 0.9);
      people.translate(0, rise * (t + 1) + 0.45, -t * depth + 0.2);
      const uv = people.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (length / 8));
      crowd.push(people);
    }
    const back = new BoxGeometry(length, rise * tiers + 4.2, 0.4);
    back.translate(0, (rise * tiers + 4.2) / 2, -tiers * depth + 0.4);
    concrete.push(back);
    for (let p = 0; p <= 4; p++) {
      const pillar = new BoxGeometry(0.4, rise * tiers + 4, 0.4);
      pillar.translate(
        -length / 2 + (p * length) / 4,
        (rise * tiers + 4) / 2,
        -tiers * depth + 0.8,
      );
      concrete.push(pillar);
    }
    const roof = new BoxGeometry(length + 2, 0.3, tiers * depth + 3);
    roof.rotateX(-0.08);
    roof.translate(0, rise * tiers + 4.4, (-tiers * depth) / 2 + 0.6);

    const crowdMap = crowdTexture();
    this.textures.push(crowdMap);
    const parts: [BufferGeometry, Material][] = [
      [mergeGeometries(concrete), new MeshStandardMaterial({ color: 0xc9c3b6, roughness: 0.9 })],
      [mergeGeometries(crowd), new MeshStandardMaterial({ map: crowdMap, roughness: 0.9 })],
      [roof, new MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5, metalness: 0.3 })],
    ];
    for (const g of [...concrete, ...crowd]) g.dispose();
    for (const [geometry, material] of parts) {
      this.geometries.add(geometry);
      this.materials.add(material);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.group.add(group);
  }

  /** Advertising boards behind the barriers on the straights, facing the cars. */
  private addBanners(): void {
    const { track } = this;
    const placements: Placement[] = [];
    for (let i = 0; i < track.samples.length; i += 22) {
      const s = track.sample(i);
      if (Math.abs(s.curvature) > 1 / 300) continue;
      for (const side of [-1, 1]) {
        const { x, z, yaw } = this.beside(i, side * (track.halfDrivable + 1.4));
        if (!this.clear(x, z, 0.8)) continue;
        placements.push({ x, y: this.terrain.heightAt(x, z) + 0.15, z, yaw, sx: 1, sy: 1, sz: 1 });
      }
    }
    const board = new BoxGeometry(9, 1.3, 0.12);
    board.translate(0, 0.65, 0);
    const map = bannerTexture();
    this.textures.push(map);
    this.instanced(board, new MeshStandardMaterial({ map, roughness: 0.6 }), placements, true);
  }
}
