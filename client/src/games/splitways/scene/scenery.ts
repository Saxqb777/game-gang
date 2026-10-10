/**
 * Everything beside the track: a grandstand at the start and trackside banners. Each kind is one
 * instanced or merged mesh, a few draw calls per viewport in total.
 */
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type Color,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { bannerTexture, crowdTexture } from './sceneryModels';

/** mulberry32: small, fast, seeded. */
export function seeded(seed: number): () => number {
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

  constructor(
    private readonly track: Track,
    private readonly terrain: Terrain,
  ) {
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
