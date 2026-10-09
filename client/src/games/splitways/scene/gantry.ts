import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Track } from '../track/track';
import { canvasTexture } from './textures';

const HEIGHT = 7.2;
const LAMP_COUNT = 3;

/**
 * Start/finish gantry over the line, with the countdown lights: red lamps come on one per second,
 * then all turn green.
 */
export class Gantry {
  readonly group = new Group();
  private readonly lamps: MeshStandardMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  constructor(track: Track) {
    const start = track.startLine.sample;
    this.group.position.copy(start.position);
    this.group.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
    const span = track.halfDrivable + 1.6;

    const steel = this.material(
      new MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.75, roughness: 0.35 }),
    );
    const pillar = this.geometry(new BoxGeometry(0.8, HEIGHT + 1, 0.8));
    for (const side of [-1, 1]) {
      const mesh = new Mesh(pillar, steel);
      mesh.position.set(side * span, (HEIGHT + 1) / 2, 0);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
    const beam = new Mesh(this.geometry(new BoxGeometry(span * 2 + 0.8, 1.6, 0.9)), steel);
    beam.position.y = HEIGHT;
    beam.castShadow = true;
    this.group.add(beam);

    const sign = canvasTexture(1024, 128, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
      gradient.addColorStop(0, '#ff8a1f');
      gradient.addColorStop(0.5, '#ff3b6b');
      gradient.addColorStop(1, '#7b2ff7');
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 118, 1024, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 72px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPLIT WAYS  ·  CORNICHE RUN', 512, 60);
    });
    const signMaterial = this.material(
      new MeshStandardMaterial({
        map: sign,
        emissive: 0xffffff,
        emissiveMap: sign,
        emissiveIntensity: 0.6,
      }),
    );
    // Facing the cars as they arrive (they drive towards +Z in the gantry's frame).
    for (const facing of [Math.PI, 0]) {
      const panel = new Mesh(
        this.geometry(new PlaneGeometry(span * 2 - 1, (span * 2 - 1) / 8)),
        signMaterial,
      );
      panel.position.set(0, HEIGHT, facing === 0 ? 0.46 : -0.46);
      panel.rotation.y = facing;
      this.group.add(panel);
    }

    const housing = this.geometry(new BoxGeometry(1.1, 1.1, 0.5));
    for (let i = 0; i < LAMP_COUNT; i++) {
      const lamp = this.material(
        new MeshStandardMaterial({ color: 0x150404, emissive: 0x000000, roughness: 0.25 }),
      );
      this.lamps.push(lamp);
      const mesh = new Mesh(housing, lamp);
      mesh.position.set((i - (LAMP_COUNT - 1) / 2) * 1.5, HEIGHT - 1.5, -0.2);
      this.group.add(mesh);
    }
  }

  /** `lit` red lamps (0..3), or all green once the race is on. */
  setLights(lit: number, green: boolean): void {
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i] as MeshStandardMaterial;
      const on = green || i < lit;
      lamp.emissive.setHex(green ? 0x22ff66 : on ? 0xff1a1a : 0x000000);
      lamp.emissiveIntensity = on ? 2 : 0;
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) {
      if (material instanceof MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    }
    this.group.removeFromParent();
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
