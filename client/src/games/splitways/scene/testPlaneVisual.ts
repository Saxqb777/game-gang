import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { TEST_PLANE, rampPoints } from '../track/testPlane';

/** Metres covered by one repeat of the grid texture. */
const TILE_METRES = 10;

function gridTexture(maxAnisotropy: number): CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#8b9099';
  ctx.fillRect(0, 0, size, size);
  const perMetre = size / TILE_METRES;
  ctx.strokeStyle = 'rgba(40, 44, 52, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < TILE_METRES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * perMetre, 0);
    ctx.lineTo(i * perMetre, size);
    ctx.moveTo(0, i * perMetre);
    ctx.lineTo(size, i * perMetre);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(25, 28, 34, 0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.repeat.set(TEST_PLANE.size / TILE_METRES, TEST_PLANE.size / TILE_METRES);
  return texture;
}

/** The grey grid plane, ramps and blocks. */
export function createTestPlaneVisual(maxAnisotropy: number): Group {
  const group = new Group();
  const ground = new Mesh(
    new PlaneGeometry(TEST_PLANE.size, TEST_PLANE.size),
    new MeshStandardMaterial({ map: gridTexture(maxAnisotropy), roughness: 0.92, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const rampMaterial = new MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.55 });
  for (const ramp of TEST_PLANE.ramps) {
    const p = rampPoints(ramp);
    // Corner order from rampPoints: 0..3 base, 4..5 top edge at the high end.
    const faces = [0, 2, 4, 0, 4, 1, 1, 4, 5, 1, 5, 3, 0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4];
    const positions = new Float32Array(faces.length * 3);
    faces.forEach((corner, i) => {
      positions[i * 3] = p[corner * 3] ?? 0;
      positions[i * 3 + 1] = p[corner * 3 + 1] ?? 0;
      positions[i * 3 + 2] = p[corner * 3 + 2] ?? 0;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, rampMaterial);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  const blockMaterial = new MeshStandardMaterial({ color: 0xe6e8ee, roughness: 0.6 });
  for (const block of TEST_PLANE.blocks) {
    const mesh = new Mesh(new BoxGeometry(block.width, block.height, block.depth), blockMaterial);
    mesh.position.set(block.x, block.height / 2, block.z);
    mesh.rotation.y = block.yaw;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
