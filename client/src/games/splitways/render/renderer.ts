/**
 * One WebGL renderer for every viewport. The canvas runs at devicePixelRatio 1; each view renders
 * at its own internal resolution into a scratch target, is copied into its tile of one shared HDR
 * atlas, and a single post chain (postProcessing.ts) blooms, grades and upscales all of them.
 *
 * Why a scratch target plus a copy instead of rendering straight into the atlas: three resolves
 * MSAA by blitting the whole target, so several scissored views in one multisampled atlas would
 * depend on blit-scissor behaviour that differs between drivers. The copy costs about one
 * internal-resolution pass in total and is safe everywhere (decision D-7).
 */
import {
  HalfFloatType,
  NoToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  UnsignedByteType,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';
import { RENDER } from '../config';
import { FrameStats, frameIntervalMs, snapRefreshHz, type FrameWindow } from './frameStats';
import { GpuTimer } from './gpuTimer';
import { MAX_VIEWS, PostChain, type FrameViews, type Tile } from './postProcessing';
import { sessionDrops, type PresetId, type QualityPreset } from './quality';
import { ResolutionController } from './resolution';
import type { Rect } from './viewports';

export interface RenderStats {
  preset: PresetId;
  drops: number;
  scale: number;
  minScale: number;
  /** Viewport 0's rendered size this frame. */
  internalWidth: number;
  internalHeight: number;
  /** Viewport 0's rect on the canvas. */
  outputWidth: number;
  outputHeight: number;
  viewports: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  latePrograms: number;
  gpuMs: number | null;
  timing: 'timer-query' | 'none';
  cpuMs: number;
  refreshHz: number;
  devicePixelRatio: number;
  sharpening: boolean;
  window: FrameWindow;
}

/** Allocation granularity of atlas tiles (px). */
const TILE_ALIGN = 16;

const alignUp = (n: number) => Math.ceil(n / TILE_ALIGN) * TILE_ALIGN;

function sceneTarget(width: number, height: number, samples: number): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    samples,
    depthBuffer: true,
    stencilBuffer: false,
    // Depth is only needed while drawing: never resolve or keep it (cheaper on tile GPUs).
    resolveDepthBuffer: false,
    storeMultisampledDepthBuffer: false,
  });
}

function atlasTarget(type: typeof HalfFloatType | typeof UnsignedByteType): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, { type, depthBuffer: false, stencilBuffer: false });
}

/** The GPU's name for telemetry: the unmasked renderer string where the browser allows it. */
function gpuName(gl: WebGL2RenderingContext): string | null {
  try {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const name: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return typeof name === 'string' && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export class GameRenderer {
  readonly webgl: WebGLRenderer;
  /** For telemetry, read once. */
  readonly gpuName: string | null;
  readonly resolution: ResolutionController;
  readonly frameStats = new FrameStats();
  readonly gpuTimer: GpuTimer;
  private currentPreset: QualityPreset;
  private readonly post: PostChain;
  /** Where each view is drawn (MSAA, depth): the size of the largest tile. */
  private scratch: WebGLRenderTarget;
  /** Every view's HDR image, one tile each, black padding between them. */
  private readonly atlas = atlasTarget(HalfFloatType);
  /** The composited, display-ready views in the same layout. */
  private readonly ldr = atlasTarget(UnsignedByteType);
  private width = 1;
  private height = 1;
  /** Layout rects in canvas px (top-left origin), and the same in GL coordinates. */
  private rects: Rect[] = [];
  private readonly canvasRects = Array.from({ length: MAX_VIEWS }, () => new Vector4());
  private tiles: Tile[] = [];
  private baseScale = 1;
  private readonly usedWidth = new Float32Array(MAX_VIEWS);
  private readonly usedHeight = new Float32Array(MAX_VIEWS);
  private readonly speeds = new Float32Array(MAX_VIEWS);
  private readonly views: FrameViews;
  private rafMs = 0;
  /** This frame's new GPU timer result (null if none arrived), and the last one seen. */
  private newGpuMs: number | null = null;
  private lastGpuMs: number | null = null;
  private lastCpuMs = 0;
  private lastDrawCalls = 0;
  private lastTriangles = 0;
  private sharpening = false;
  private programBaseline = 0;

  constructor(canvas: HTMLCanvasElement, preset: QualityPreset) {
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
    // Draw-call and triangle counts are summed over the whole frame for the overlay.
    this.webgl.info.autoReset = false;
    this.webgl.setPixelRatio(RENDER.canvasPixelRatio);
    this.currentPreset = preset;
    this.resolution = new ResolutionController(preset);
    const gl = this.webgl.getContext() as WebGL2RenderingContext;
    this.gpuTimer = new GpuTimer(gl);
    this.gpuName = gpuName(gl);
    this.post = new PostChain(this.webgl);
    this.scratch = sceneTarget(1, 1, preset.msaa);
    this.views = {
      count: 0,
      tiles: this.tiles,
      usedWidth: this.usedWidth,
      usedHeight: this.usedHeight,
      canvasRects: this.canvasRects,
      speed: this.speeds,
      canvasWidth: 1,
      canvasHeight: 1,
      sharpen: 0,
      time: 0,
    };
  }

  get preset(): QualityPreset {
    return this.currentPreset;
  }

  /** The GPU timer result that arrived this frame (null if none did). */
  get frameGpuMs(): number | null {
    return this.newGpuMs;
  }

  /** The canvas matches its CSS size (devicePixelRatio 1), so layout rects are canvas pixels. */
  setSize(cssWidth: number, cssHeight: number): void {
    const width = Math.max(1, Math.round(cssWidth));
    const height = Math.max(1, Math.round(cssHeight));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.webgl.setPixelRatio(RENDER.canvasPixelRatio);
    this.webgl.setSize(width, height, false);
  }

  /**
   * The views of the coming frames, as integer canvas rects. Allocates the atlases and scratch
   * target at scale 1 (dynamic resolution only ever draws sub-rectangles of them).
   */
  setLayout(rects: readonly Rect[]): void {
    this.rects = rects.slice(0, MAX_VIEWS).map((r) => ({ ...r }));
    this.rects.forEach((r, i) => {
      // GL's origin is bottom-left; the rects are top-left like the DOM.
      (this.canvasRects[i] as Vector4).set(r.x, this.height - r.y - r.height, r.width, r.height);
    });
    this.allocate();
  }

  /** Loading screen and benchmark only: MSAA, bloom and the scale range change with the preset. */
  setPreset(preset: QualityPreset): void {
    const msaaChanged = preset.msaa !== this.currentPreset.msaa;
    this.currentPreset = preset;
    this.resolution.setPreset(preset);
    if (msaaChanged) {
      this.scratch.dispose();
      this.scratch = sceneTarget(1, 1, preset.msaa);
    }
    this.allocate();
  }

  beginFrame(now: number, rafMs: number): void {
    this.rafMs = rafMs;
    this.newGpuMs = this.gpuTimer.poll();
    if (this.newGpuMs !== null) this.lastGpuMs = this.newGpuMs;
    this.gpuTimer.begin();
    this.webgl.info.reset();
    const intervalMs = frameIntervalMs(this.frameStats.refreshHz());
    this.resolution.update(now, this.newGpuMs, rafMs, intervalMs);
  }

  /** Draws one view into its atlas tile. `speed` (0..1) drives speed lines and vignette. */
  renderView(index: number, scene: Scene, camera: Camera, speed: number): void {
    const rect = this.rects[index];
    const tile = this.tiles[index];
    if (!rect || !tile) return;
    // Rendered size from the rect, never from the 16-px-rounded allocation, so the aspect matches
    // the camera's and an unscaled view is exactly 1:1.
    const s = this.baseScale * this.resolution.scale;
    const w = Math.max(1, Math.min(tile.width, Math.round(rect.width * s)));
    const h = Math.max(1, Math.min(tile.height, Math.round(rect.height * s)));
    const webgl = this.webgl;
    const scratch = this.scratch;
    // Viewport and scissor live on the target: the shadow pass inside render() restores them.
    scratch.viewport.set(0, 0, w, h);
    scratch.scissor.set(0, 0, w, h);
    scratch.scissorTest = true;
    webgl.setRenderTarget(scratch);
    webgl.setClearColor(0x000000, 1);
    webgl.clear(true, true, false);
    webgl.render(scene, camera);
    this.post.copy(scratch, this.atlas, tile.x, tile.y, w, h);
    this.usedWidth[index] = w;
    this.usedHeight[index] = h;
    this.speeds[index] = speed;
  }

  /** Post chain, then frame bookkeeping. `cpuMs` is the previous frame's loop CPU time. */
  endFrame(time: number, cpuMs: number): void {
    this.runPost(time);
    this.gpuTimer.end();
    const info = this.webgl.info.render;
    this.lastDrawCalls = info.calls;
    this.lastTriangles = info.triangles;
    this.lastCpuMs = cpuMs;
    this.frameStats.record(
      this.rafMs,
      cpuMs,
      this.newGpuMs,
      this.resolution.scale,
      info.calls,
      info.triangles,
    );
  }

  /**
   * Compiles every scene material against the scratch target (program keys depend on the bound
   * target), then renders a few full frames so the shadow-depth and post programs compile too.
   * The first warm-up frame runs at the floor scale, the rest at 1, so both paths are exercised.
   */
  async precompile(scene: Scene, camera: Camera): Promise<void> {
    this.webgl.setRenderTarget(this.scratch);
    await this.webgl.compileAsync(scene, camera);
    const scale = this.resolution.scale;
    for (let frame = 0; frame < RENDER.warmupFrames; frame++) {
      this.resolution.scale = frame === 0 ? this.currentPreset.minScale : 1;
      this.webgl.info.reset();
      for (let i = 0; i < this.rects.length; i++) this.renderView(i, scene, camera, 0.5);
      this.runPost(0);
    }
    this.resolution.scale = scale;
    this.programBaseline = this.programCount();
  }

  get stats(): RenderStats {
    const rect = this.rects[0];
    return {
      preset: this.currentPreset.id,
      drops: sessionDrops(),
      scale: this.resolution.scale,
      minScale: this.currentPreset.minScale,
      internalWidth: this.usedWidth[0] ?? 0,
      internalHeight: this.usedHeight[0] ?? 0,
      outputWidth: rect?.width ?? 0,
      outputHeight: rect?.height ?? 0,
      viewports: this.rects.length,
      drawCalls: this.lastDrawCalls,
      triangles: this.lastTriangles,
      programs: this.programCount(),
      latePrograms: Math.max(0, this.programCount() - this.programBaseline),
      gpuMs: this.lastGpuMs,
      timing: this.gpuTimer.supported ? 'timer-query' : 'none',
      cpuMs: this.lastCpuMs,
      refreshHz: this.frameStats.refreshHz(),
      devicePixelRatio: window.devicePixelRatio,
      sharpening: this.sharpening,
      window: this.frameStats.snapshot(),
    };
  }

  dispose(): void {
    this.gpuTimer.dispose();
    this.post.dispose();
    this.scratch.dispose();
    this.atlas.dispose();
    this.ldr.dispose();
    this.webgl.dispose();
    // A new context per race: losing this one now keeps Chrome under its context limit.
    this.webgl.forceContextLoss();
  }

  private programCount(): number {
    return this.webgl.info.programs?.length ?? 0;
  }

  private runPost(time: number): void {
    const count = this.rects.length;
    // Sharpen when any view is upscaled, or when the browser upscales the DPR-1 canvas.
    let upscaled = window.devicePixelRatio > RENDER.sharpenWhenDprAbove;
    for (let i = 0; i < count; i++) {
      const rect = this.rects[i] as Rect;
      if ((this.usedWidth[i] ?? 0) < rect.width || (this.usedHeight[i] ?? 0) < rect.height) {
        upscaled = true;
      }
    }
    this.sharpening = upscaled;
    const views = this.views;
    views.count = count;
    views.canvasWidth = this.width;
    views.canvasHeight = this.height;
    views.sharpen = upscaled ? Math.pow(2, -this.currentPreset.sharpness) : 0;
    views.time = time;
    this.post.render(this.atlas, this.ldr, views);
  }

  /**
   * Tiles in a 2-column grid (1 column if that would exceed the GPU's texture size), origins on
   * multiples of 16 with 16 px of black padding around each, sized for every view at scale 1.
   */
  private allocate(): void {
    const rects = this.rects;
    let area = 0;
    for (const r of rects) area += r.width * r.height;
    let baseScale =
      area > 0 ? Math.min(1, Math.sqrt(this.currentPreset.maxInternalPixels / area)) : 1;
    const maxSize = this.webgl.capabilities.maxTextureSize;
    const pad = RENDER.tilePadding;
    let tiles: Tile[] = [];
    let atlasWidth = 0;
    let atlasHeight = 0;
    const fits = () => atlasWidth <= maxSize && atlasHeight <= maxSize;
    for (let attempt = 0; attempt < 8; attempt++) {
      for (const columns of [2, 1]) {
        tiles = rects.map((r) => ({
          x: 0,
          y: 0,
          width: alignUp(Math.ceil(r.width * baseScale)),
          height: alignUp(Math.ceil(r.height * baseScale)),
        }));
        const colWidth = [0, 0];
        const rowHeight: number[] = [];
        tiles.forEach((t, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          colWidth[col] = Math.max(colWidth[col] ?? 0, t.width);
          rowHeight[row] = Math.max(rowHeight[row] ?? 0, t.height);
        });
        tiles.forEach((t, i) => {
          const row = Math.floor(i / columns);
          t.x = pad + (i % columns === 1 ? (colWidth[0] ?? 0) + pad : 0);
          t.y = pad;
          for (let r = 0; r < row; r++) t.y += (rowHeight[r] ?? 0) + pad;
        });
        atlasWidth = pad;
        for (let c = 0; c < columns; c++) atlasWidth += (colWidth[c] ?? 0) + pad;
        atlasHeight = pad;
        for (const h of rowHeight) atlasHeight += h + pad;
        if (fits()) break;
      }
      if (fits()) break;
      baseScale *= 0.9;
    }
    this.baseScale = baseScale;
    this.tiles = tiles;
    this.views.tiles = tiles;

    let scratchWidth = 1;
    let scratchHeight = 1;
    for (const t of tiles) {
      scratchWidth = Math.max(scratchWidth, t.width);
      scratchHeight = Math.max(scratchHeight, t.height);
    }
    if (this.scratch.width !== scratchWidth || this.scratch.height !== scratchHeight) {
      this.scratch.setSize(scratchWidth, scratchHeight);
    }
    this.post.setAtlasSize(atlasWidth, atlasHeight, this.currentPreset.bloomLevels);
    for (const target of [this.atlas, this.ldr]) {
      if (target.width === atlasWidth && target.height === atlasHeight) continue;
      target.setSize(atlasWidth, atlasHeight);
      // Black padding, once: the views only ever write inside their own tiles.
      target.viewport.set(0, 0, atlasWidth, atlasHeight);
      target.scissor.set(0, 0, atlasWidth, atlasHeight);
      target.scissorTest = false;
      this.webgl.setRenderTarget(target);
      this.webgl.setClearColor(0x000000, 0);
      this.webgl.clear(true, false, false);
    }
    // Until the first frame draws them, assume scale 1.
    tiles.forEach((t, i) => {
      const r = rects[i] as Rect;
      this.usedWidth[i] = Math.min(t.width, Math.max(1, Math.round(r.width * baseScale)));
      this.usedHeight[i] = Math.min(t.height, Math.max(1, Math.round(r.height * baseScale)));
    });
  }
}

/** Median delta of `frames` empty rAF callbacks on an idle page, snapped with snapRefreshHz. */
export function measureRefreshHz(frames = 30): Promise<number> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = -1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const sorted = [...deltas].sort((a, b) => a - b);
      resolve(sorted.length > 0 ? snapRefreshHz(sorted[sorted.length >> 1] ?? 0) : 60);
    };
    const tick = (now: number) => {
      if (done) return;
      if (last >= 0) deltas.push(now - last);
      last = now;
      if (deltas.length >= frames) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // A hidden tab gets no animation frames; never hold the loading screen hostage.
    setTimeout(finish, Math.max(2000, frames * 100));
  });
}
