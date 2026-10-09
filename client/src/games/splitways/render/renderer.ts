import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';
import { RENDER } from '../config';
import type { Rect } from './viewports';

const SEAM_COLOUR = 0x050608;

/**
 * One WebGL renderer for every viewport: each player's view is drawn into its own scissored
 * rectangle of a single canvas, from one shared scene.
 */
export class GameRenderer {
  readonly webgl: WebGLRenderer;
  width = 1;
  height = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = PCFShadowMap;
    // Draw-call and triangle counts are summed over all viewports for the debug overlay.
    this.webgl.info.autoReset = false;
    this.webgl.setScissorTest(true);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
    this.webgl.setSize(this.width, this.height, false);
  }

  beginFrame(): void {
    this.webgl.info.reset();
    this.webgl.setScissor(0, 0, this.width, this.height);
    this.webgl.setViewport(0, 0, this.width, this.height);
    // three.js leaves the scene background as the clear colour; the seams between viewports stay dark.
    this.webgl.setClearColor(SEAM_COLOUR, 1);
    this.webgl.clear();
  }

  renderView(scene: Scene, camera: Camera, rect: Rect): void {
    // WebGL's origin is bottom-left; our rects are top-left like the DOM.
    const y = this.height - rect.y - rect.height;
    this.webgl.setViewport(rect.x, y, rect.width, rect.height);
    this.webgl.setScissor(rect.x, y, rect.width, rect.height);
    this.webgl.render(scene, camera);
  }

  dispose(): void {
    this.webgl.dispose();
  }
}
