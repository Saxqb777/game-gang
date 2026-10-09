/**
 * Results ceremony: the top three cars turning slowly on their podium blocks under spotlights,
 * with confetti raining on the winner. Its own little scene, rendered full screen after the race.
 */
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SpotLight,
  Vector3,
  type Texture,
} from 'three';
import type { CarModelLibrary, CarVisual } from './carVisual';
import { canvasTexture } from './textures';

export interface PodiumEntry {
  place: 1 | 2 | 3;
  colourHex: string;
}

const BLOCK = { width: 5.4, depth: 6 };
const HEIGHTS: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 1, 3: 0.6 };
const X: Record<1 | 2 | 3, number> = { 1: 0, 2: -6, 3: 6 };
const CONFETTI = 700;

const dummy = new Object3D();
const matrix = new Matrix4();

export class Podium {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 16 / 9, 0.1, 400);
  private readonly cars: { visual: CarVisual; pivot: Group }[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly confetti: InstancedMesh;
  private readonly flakes: {
    position: Vector3;
    velocity: Vector3;
    spin: Vector3;
    angle: Vector3;
  }[] = [];
  private time = 0;

  constructor(
    models: CarModelLibrary,
    entries: readonly PodiumEntry[],
    environment: Texture | null,
  ) {
    const scene = this.scene;
    scene.background = new Color(0x07080d);
    scene.fog = new Fog(0x07080d, 30, 90);
    scene.environment = environment;
    scene.environmentIntensity = 0.7;
    scene.add(new HemisphereLight(0x9fb4ff, 0x1a1410, 0.6));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(-8, 18, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -6;
    key.shadow.radius = 3;
    scene.add(key);

    const floorMaterial = this.track(
      new MeshStandardMaterial({ color: 0x101218, roughness: 0.35, metalness: 0.4 }),
    );
    const floor = new Mesh(this.track(new PlaneGeometry(200, 200)), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    for (const entry of entries) {
      const height = HEIGHTS[entry.place];
      const numberTexture = this.track(
        canvasTexture(256, 256, (ctx) => {
          ctx.fillStyle = '#e9e6df';
          ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = entry.place === 1 ? '#c99a1a' : entry.place === 2 ? '#8f98a3' : '#a0623a';
          ctx.font = '700 190px "Chakra Petch", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(entry.place), 128, 140);
        }),
      );
      const plain = this.track(new MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.55 }));
      const front = this.track(new MeshStandardMaterial({ map: numberTexture, roughness: 0.55 }));
      // Box faces: +x, -x, +y, -y, +z (front, towards the camera), -z.
      const block = new Mesh(this.track(new BoxGeometry(BLOCK.width, height, BLOCK.depth)), [
        plain,
        plain,
        plain,
        plain,
        front,
        plain,
      ]);
      block.position.set(X[entry.place], height / 2, 0);
      block.castShadow = block.receiveShadow = true;
      scene.add(block);

      const pivot = new Group();
      pivot.position.set(X[entry.place], height, 0);
      const visual = models.create(entry.colourHex);
      visual.root.position.set(0, 0.03, 0);
      pivot.add(visual.root);
      scene.add(pivot);
      this.cars.push({ visual, pivot });

      const spot = new SpotLight(0xffffff, entry.place === 1 ? 320 : 200, 40, 0.42, 0.6);
      spot.position.set(X[entry.place], 14, 6);
      spot.target = pivot;
      scene.add(spot);
    }

    const flakeMaterial = this.track(
      new MeshStandardMaterial({ side: DoubleSide, roughness: 0.5, metalness: 0.3 }),
    );
    this.confetti = new InstancedMesh(
      this.track(new PlaneGeometry(0.12, 0.22)),
      flakeMaterial,
      CONFETTI,
    );
    const winner = entries.find((e) => e.place === 1);
    const palette = [
      winner?.colourHex ?? '#ffd60a',
      '#ffd60a',
      '#ffffff',
      '#ff4fb0',
      '#1fe0e6',
    ].map((hex) => new Color(hex));
    for (let i = 0; i < CONFETTI; i++) {
      const flake = {
        position: new Vector3(),
        velocity: new Vector3(),
        spin: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        angle: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      };
      this.resetFlake(flake, true);
      this.flakes.push(flake);
      this.confetti.setColorAt(i, palette[i % palette.length] as Color);
    }
    scene.add(this.confetti);

    this.camera.position.set(0, 6, 19);
    this.camera.lookAt(0, 2, 0);
  }

  update(dt: number, aspect: number): void {
    this.time += dt;
    for (let i = 0; i < this.cars.length; i++) {
      (this.cars[i] as (typeof this.cars)[number]).pivot.rotation.y = this.time * 0.45 + i * 2.1;
    }
    for (let i = 0; i < this.flakes.length; i++) {
      const flake = this.flakes[i] as (typeof this.flakes)[number];
      flake.velocity.y = Math.max(flake.velocity.y - dt * 3, -2.2);
      flake.position.addScaledVector(flake.velocity, dt);
      flake.position.x += Math.sin(this.time * 2 + i) * dt * 0.6;
      flake.angle.addScaledVector(flake.spin, dt);
      if (flake.position.y < 0) this.resetFlake(flake, false);
      dummy.position.copy(flake.position);
      dummy.rotation.set(flake.angle.x, flake.angle.y, flake.angle.z);
      dummy.updateMatrix();
      this.confetti.setMatrixAt(i, matrix.copy(dummy.matrix));
    }
    this.confetti.instanceMatrix.needsUpdate = true;

    const sway = Math.sin(this.time * 0.25) * 4;
    this.camera.position.set(sway, 5.5 + Math.sin(this.time * 0.4) * 0.4, 18.5);
    this.camera.lookAt(0, 2.2, 0);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    for (const { visual } of this.cars) visual.dispose();
    for (const item of this.disposables) item.dispose();
    this.confetti.dispose();
  }

  private resetFlake(flake: (typeof this.flakes)[number], scatter: boolean): void {
    // Confetti for the winner: it rains over the middle block.
    flake.position.set(
      (Math.random() - 0.5) * 7,
      scatter ? 2 + Math.random() * 12 : 12 + Math.random() * 4,
      (Math.random() - 0.5) * 5,
    );
    flake.velocity.set(
      (Math.random() - 0.5) * 1.5,
      -0.5 - Math.random(),
      (Math.random() - 0.5) * 1.5,
    );
  }

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }
}
