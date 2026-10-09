import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

const WIDTH = 512;
const HEIGHT = 128;
/** Size of the tag in the world (metres) and its height above the car's origin. */
const WORLD_WIDTH = 3.4;
export const NAME_TAG_HEIGHT = 2.4;

/**
 * Floating name above each car so you can tell opponents apart in split screen. Drawn on top of
 * everything (no depth test) so you can see who is behind a wall or right on your bumper.
 */
export function createNameTag(name: string, colourHex: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.font = '700 64px "Chakra Petch", system-ui, sans-serif';
  const label = name.toUpperCase();
  const textWidth = Math.min(ctx.measureText(label).width, WIDTH - 90);
  const pillWidth = textWidth + 80;
  const x = (WIDTH - pillWidth) / 2;
  ctx.fillStyle = 'rgba(6, 7, 10, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, 20, pillWidth, 88, 44);
  ctx.fill();
  ctx.fillStyle = colourHex;
  ctx.beginPath();
  ctx.roundRect(x + 14, 38, 14, 52, 7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 44, 66, WIDTH - 90);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }),
  );
  sprite.scale.set(WORLD_WIDTH, (WORLD_WIDTH * HEIGHT) / WIDTH, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function disposeNameTag(sprite: Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.dispose();
  sprite.removeFromParent();
}
