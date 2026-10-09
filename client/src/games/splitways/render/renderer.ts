import {
  NoToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';
import { RENDER } from '../config';
import { DynamicResolution } from './dynamicResolution';
import { PostProcessing } from './postProcessing';
import type { Rect } from './viewports';

const SEAM_COLOUR = 0x050608;

/**
 * One WebGL renderer for every viewport. Each view renders through the HDR post pipeline into its
 * own rectangle of a single canvas. Anti-aliasing happens in the pipeline, so the canvas has none.
 */
export class GameRenderer {
  readonly webgl: WebGLRenderer;
  readonly post: PostProcessing;
  readonly resolution = new DynamicResolution();
  width = 1;
  height = 1;
  private viewWidth = 1;
  private viewHeight = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({
      canvas,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.webgl.outputColorSpace = SRGBColorSpace;
    // Tone mapping happens in the composite pass.
    this.webgl.toneMapping = NoToneMapping;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = PCFShadowMap;
    this.webgl.autoClear = false;
    // Draw-call and triangle counts are summed over all viewports for the debug overlay.
    this.webgl.info.autoReset = false;
    this.webgl.setScissorTest(true);
    this.post = new PostProcessing(this.webgl);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
    this.webgl.setSize(this.width, this.height, false);
    this.applyViewSize();
  }

  /** Every viewport in a layout has this size (CSS pixels). */
  setViewSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.applyViewSize();
  }

  get renderScale(): number {
    return this.webgl.getPixelRatio() * this.resolution.scale;
  }

  beginFrame(now: number): void {
    if (this.resolution.update(now)) this.applyViewSize();
    this.webgl.info.reset();
    this.webgl.setRenderTarget(null);
    this.webgl.setScissor(0, 0, this.width, this.height);
    this.webgl.setViewport(0, 0, this.width, this.height);
    // The dark seams between viewports.
    this.webgl.setClearColor(SEAM_COLOUR, 1);
    this.webgl.clear();
  }

  /** `speed` (0..1) drives speed lines and vignette; `time` animates them. */
  renderView(scene: Scene, camera: Camera, rect: Rect, speed: number, time: number): void {
    this.post.render(scene, camera, rect, this.height, speed, time);
  }

  dispose(): void {
    this.post.dispose();
    this.webgl.dispose();
  }

  private applyViewSize(): void {
    const scale = this.renderScale;
    this.post.setSize(this.viewWidth * scale, this.viewHeight * scale);
  }
}
