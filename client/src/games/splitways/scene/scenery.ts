/**
 * Everything beside the track: palms, street lamps, the low-rise city, a distant skyline, a
 * grandstand at the start and trackside banners. Each kind is one instanced or merged mesh, about
 * ten draw calls per viewport in total. Placement is seeded, so every race looks the same.
 */
import {
  BoxGeometry,
  Color,
  DoubleSide,
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
import { CITY, SEA_LEVEL, type Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import {
  bannerTexture,
  blockGeometry,
  crowdTexture,
  facadeMaterial,
  lampGeometries,
  lowRiseTexture,
  palmGeometry,
  towerTexture,
} from './sceneryModels';

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
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly random = seeded(20251009);

  constructor(
    private readonly track: Track,
    private readonly terrain: Terrain,
  ) {
    this.addPalms();
    this.addLamps();
    this.addCity();
    this.addSkyline();
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
    this.geometries.push(geometry);
    this.materials.push(material);
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

  private addPalms(): void {
    const { track, random } = this;
    const placements: Placement[] = [];
    const n = track.samples.length;
    for (let i = 0; i < n; i += 15 + Math.floor(random() * 4)) {
      for (const side of [-1, 1]) {
        const lateral = side * (track.halfDrivable + 4.5 + random() * 2.5);
        const { x, z } = this.beside(i, lateral);
        const coastal = z > 95 && z < this.terrain.coastZ(x) - 12;
        const city = x < CITY.x + 30;
        const boulevard = z < -40 && side < 0 && x > -80 && x < 170;
        if (!(coastal || city || boulevard) || !this.clear(x, z, 3.5)) continue;
        const y = this.terrain.heightAt(x, z);
        if (y < SEA_LEVEL + 0.4) continue;
        const scale = 0.85 + random() * 0.4;
        const shade = 0.85 + random() * 0.3;
        placements.push({
          x,
          y: y - 0.2,
          z,
          yaw: random() * Math.PI * 2,
          sx: scale,
          sy: scale,
          sz: scale,
          tint: new Color(shade, shade, shade),
        });
      }
    }
    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      side: DoubleSide,
    });
    this.instanced(palmGeometry(), material, placements, true);
  }

  private addLamps(): void {
    const { track } = this;
    const placements: Placement[] = [];
    for (let i = 0; i < track.samples.length; i += 36) {
      const s = track.sample(i);
      const straight = Math.abs(s.curvature) < 1 / 250;
      if (!straight) continue;
      const lateral = track.halfDrivable + 1.6;
      const { x, z, yaw } = this.beside(i, lateral);
      if (!this.clear(x, z, 1)) continue;
      placements.push({ x, y: this.terrain.heightAt(x, z), z, yaw, sx: 1, sy: 1, sz: 1 });
    }
    const { pole, head } = lampGeometries();
    this.instanced(
      pole,
      new MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.45 }),
      placements,
      true,
    );
    this.instanced(
      head,
      new MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 2.2 }),
      placements,
      false,
    );
  }

  /** Whitewashed blocks: west of the track (where the dunes flatten) and in the infield's west. */
  private addCity(): void {
    const { random, terrain } = this;
    const placements: Placement[] = [];
    const tints = [
      new Color(1, 1, 1),
      new Color(1, 0.96, 0.88),
      new Color(0.95, 0.9, 0.82),
      new Color(0.98, 0.98, 0.95),
    ];
    const tryBlock = (x: number, z: number, margin: number) => {
      const w = 14 + random() * 12;
      const d = 14 + random() * 12;
      const floors = 2 + Math.floor(random() * 5);
      if (!this.clear(x, z, margin + Math.max(w, d) / 2)) return;
      if (z > terrain.coastZ(x) - 45) return;
      let y = Infinity;
      for (const [cx, cz] of [
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x - w / 2, z + d / 2],
        [x + w / 2, z + d / 2],
      ] as const) {
        y = Math.min(y, terrain.heightAt(cx, cz));
      }
      placements.push({
        x,
        y: y - 0.4,
        z,
        yaw: (Math.floor(random() * 4) * Math.PI) / 2 + (random() - 0.5) * 0.1,
        sx: w,
        sy: floors * 3.3 + 0.6,
        sz: d,
        tint: tints[Math.floor(random() * tints.length)],
      });
    };
    for (let x = CITY.x - 30; x > -600; x -= 34) {
      for (let z = -280; z < 240; z += 34)
        tryBlock(x + (random() - 0.5) * 8, z + (random() - 0.5) * 8, 12);
    }
    for (let x = -160; x < -50; x += 30) {
      for (let z = 30; z < 110; z += 30) {
        if (terrain.nearRoad(x, z).infield)
          tryBlock(x + (random() - 0.5) * 6, z + (random() - 0.5) * 6, 14);
      }
    }
    const map = lowRiseTexture();
    this.textures.push(map);
    this.instanced(blockGeometry(), facadeMaterial(map, 3.4, 3.3, 0.8, 0), placements, true);
  }

  /** Glass towers on the horizon to the north-west, softened by the haze. */
  private addSkyline(): void {
    const { random } = this;
    const placements: Placement[] = [];
    for (let i = 0; i < 26; i++) {
      const bearing = ((265 + random() * 85) * Math.PI) / 180;
      const distance = 780 + random() * 380;
      const footprint = 24 + random() * 18;
      placements.push({
        x: 20 + Math.sin(bearing) * distance,
        y: -2,
        z: 15 - Math.cos(bearing) * distance,
        yaw: random() * Math.PI,
        sx: footprint,
        sy: 70 + random() * random() * 190,
        sz: footprint * (0.7 + random() * 0.5),
      });
    }
    const map = towerTexture();
    this.textures.push(map);
    this.instanced(blockGeometry(), facadeMaterial(map, 1.6, 3.6, 0.22, 0.55), placements, false);
  }

  /** Covered stand on the infield side of the start straight, facing the grid. */
  private addGrandstand(): void {
    const { track } = this;
    const length = 64;
    const centre = track.startLine.distance + 55;
    const index = Math.round(((centre % track.length) + track.length) % track.length);
    const s = track.sample(index);
    const offset = track.halfDrivable + 9;
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
      this.geometries.push(geometry);
      this.materials.push(material);
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
        // Not along the sea: the railings there are for the view.
        if (side > 0 && z > this.terrain.coastZ(x) - 60) continue;
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
