import {
  CanvasTexture,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';

/** A PBR texture set: colour, OpenGL normal map, and ARM (ambient occlusion, roughness, metalness). */
export interface PbrSet {
  map: Texture;
  normalMap: Texture;
  /** Feed as aoMap, roughnessMap and metalnessMap: three reads the R, G and B channels. */
  arm: Texture;
}

const loader = new TextureLoader();

async function load(url: string, colour: boolean, anisotropy: number): Promise<Texture> {
  const texture = await loader.loadAsync(url);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = colour ? SRGBColorSpace : LinearSRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Loads `<base>_diff_1k.jpg`, `<base>_nor_gl_1k.jpg` and `<base>_arm_1k.jpg`. */
export async function loadPbrSet(base: string, anisotropy: number): Promise<PbrSet> {
  const [map, normalMap, arm] = await Promise.all([
    load(`${base}_diff_1k.jpg`, true, anisotropy),
    load(`${base}_nor_gl_1k.jpg`, false, anisotropy),
    load(`${base}_arm_1k.jpg`, false, anisotropy),
  ]);
  return { map, normalMap, arm };
}

export function disposePbrSet(set: PbrSet): void {
  set.map.dispose();
  set.normalMap.dispose();
  set.arm.dispose();
}

/** Small procedural texture drawn on a canvas (kerb stripes, chequered line, signs). */
export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  anisotropy = 1,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}
