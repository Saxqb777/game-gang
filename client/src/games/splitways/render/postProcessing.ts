/**
 * The post chain for every viewport at once. Each view's HDR image sits in its own tile of one
 * shared half-float atlas (renderer.ts), so a frame runs one chain, not one per view:
 *  1. copy:      the view's scratch render -> its atlas tile (exact texel copy, MSAA already resolved)
 *  2. bloom:     prefilter + downsamples + additive upsamples over the whole atlas, every tap clamped
 *                to its own tile so no view bleeds into another
 *  3. composite: bloom, grade, ACES, vignette and speed lines per view, sRGB and dither -> LDR atlas
 *  4. final:     each canvas pixel finds its view, upscales from the LDR tile and sharpens (RCAS) ->
 *                the canvas; outside every view it writes the seam colour
 * Every frame runs the same passes and programs; scale and sharpening are uniforms, so changing
 * resolution never compiles a shader mid-race.
 */
import {
  BufferGeometry,
  Color,
  CustomBlending,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  OneFactor,
  OrthographicCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { POST, RENDER } from '../config';

/** Most views in one frame: 4 players, or 3 plus the overview cell. */
export const MAX_VIEWS = 4;

/** One view's tile in the atlases, in atlas pixels with GL's bottom-left origin. */
export interface Tile {
  x: number;
  y: number;
  /** Allocated size (a multiple of 16). */
  width: number;
  height: number;
}

/** What the post chain needs to know about the views drawn this frame. */
export interface FrameViews {
  count: number;
  tiles: readonly Tile[];
  /** Rendered size of each view this frame (<= its tile). */
  usedWidth: Float32Array;
  usedHeight: Float32Array;
  /** Each view's rectangle on the canvas: x, y from the bottom-left (GL), width, height. */
  canvasRects: readonly Vector4[];
  speed: Float32Array;
  canvasWidth: number;
  canvasHeight: number;
  /** RCAS lobe multiplier: exp2(-sharpness), or 0 for an exact copy. */
  sharpen: number;
  time: number;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COPY = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 uOrigin;
void main() {
  gl_FragColor = texelFetch(tSource, ivec2(gl_FragCoord.xy - uOrigin), 0);
}`;

/** Tile lookup and clamping shared by the bloom passes. Tiles are in atlas uv (same at every mip). */
const BLOOM_COMMON = /* glsl */ `
uniform sampler2D tSource;
uniform vec4 uTiles[${MAX_VIEWS}];
uniform int uTileCount;
uniform vec2 uTargetSize;
uniform vec2 uSourceTexel;

// The tile under this fragment, grown by one target texel so edge texels keep their bloom.
int findTile(vec2 uv) {
  vec2 grow = 1.0 / uTargetSize;
  for (int i = 0; i < ${MAX_VIEWS}; i++) {
    if (i >= uTileCount) break;
    vec4 t = uTiles[i];
    if (all(greaterThanEqual(uv, t.xy - grow)) && all(lessThanEqual(uv, t.zw + grow))) return i;
  }
  return -1;
}

vec2 tileLo;
vec2 tileHi;
vec3 tap(vec2 uv, vec2 offset) {
  return texture2D(tSource, clamp(uv + uSourceTexel * offset, tileLo, tileHi)).rgb;
}

bool beginTile(vec2 uv) {
  int tile = findTile(uv);
  if (tile < 0) return false;
  vec4 t = uTiles[tile];
  // Half a source texel inside the used rect, so bilinear taps never read a neighbour.
  tileLo = t.xy + 0.5 * uSourceTexel;
  tileHi = max(t.zw - 0.5 * uSourceTexel, tileLo);
  return true;
}`;

/** 13-tap downsample (Jimenez, "Next generation post processing in Call of Duty"). */
const DOWNSAMPLE = /* glsl */ `
${BLOOM_COMMON}
uniform float threshold;
uniform float knee;
void main() {
  vec2 uv = gl_FragCoord.xy / uTargetSize;
  if (!beginTile(uv)) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 c = tap(uv, vec2(0.0)) * 0.125;
  c += (tap(uv, vec2(-1.0, 1.0)) + tap(uv, vec2(1.0, 1.0)) + tap(uv, vec2(-1.0, -1.0)) + tap(uv, vec2(1.0, -1.0))) * 0.125;
  c += (tap(uv, vec2(-2.0, 2.0)) + tap(uv, vec2(2.0, 2.0)) + tap(uv, vec2(-2.0, -2.0)) + tap(uv, vec2(2.0, -2.0))) * 0.03125;
  c += (tap(uv, vec2(0.0, 2.0)) + tap(uv, vec2(-2.0, 0.0)) + tap(uv, vec2(2.0, 0.0)) + tap(uv, vec2(0.0, -2.0))) * 0.0625;
#ifdef PREFILTER
  float bright = max(c.r, max(c.g, c.b));
  float soft = clamp(bright - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  c *= max(soft, bright - threshold) / max(bright, 1e-4);
#endif
  gl_FragColor = vec4(c, 1.0);
}`;

/** 3x3 tent upsample, added on top of the next larger level. */
const UPSAMPLE = /* glsl */ `
${BLOOM_COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / uTargetSize;
  if (!beginTile(uv)) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 c = tap(uv, vec2(0.0)) * 4.0;
  c += (tap(uv, vec2(-1.0, 0.0)) + tap(uv, vec2(1.0, 0.0)) + tap(uv, vec2(0.0, -1.0)) + tap(uv, vec2(0.0, 1.0))) * 2.0;
  c += tap(uv, vec2(-1.0, -1.0)) + tap(uv, vec2(1.0, -1.0)) + tap(uv, vec2(-1.0, 1.0)) + tap(uv, vec2(1.0, 1.0));
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uAtlasSize;
uniform vec2 uBloomTexel;
// Per view: xy = tile origin, zw = used size, both in atlas uv.
uniform vec4 uTileXform[${MAX_VIEWS}];
uniform float uSpeed[${MAX_VIEWS}];
uniform float uAspect[${MAX_VIEWS}];
uniform int uCount;
uniform float bloomStrength;
uniform float exposure;
uniform vec3 tint;
uniform float saturation;
uniform float vignette;
uniform float speedVignette;
uniform float speedLines;
uniform float time;

// ACES filmic (Hill's fit), same curve as three.js ACESFilmicToneMapping.
vec3 rrtAndOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 inputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 outputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602));
  color = rrtAndOdtFit(inputMat * (color / 0.6));
  return clamp(outputMat * color, 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Thin streaks radiating from just above the centre, only near the edges, re-rolled 18 times a second.
float speedLineMask(vec2 local, float edge, float aspect) {
  vec2 p = (local - vec2(0.5, 0.55)) * vec2(aspect, 1.0);
  float angle = atan(p.y, p.x) * 0.15915494 + 0.5;
  float slots = 120.0;
  float slot = floor(angle * slots);
  float across = abs(fract(angle * slots) - 0.5) * 2.0;
  float frame = floor(time * 18.0);
  float lit = step(0.82, hash12(vec2(slot, frame)));
  float start = 0.5 + 0.3 * hash12(vec2(slot + 17.0, frame));
  float along = smoothstep(start, start + 0.25, edge);
  float width = 0.25 + 0.35 * hash12(vec2(frame, slot));
  return lit * along * (1.0 - smoothstep(0.0, width, across));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uAtlasSize;
  int view = -1;
  for (int i = 0; i < ${MAX_VIEWS}; i++) {
    if (i >= uCount) break;
    vec4 x = uTileXform[i];
    if (all(greaterThanEqual(uv, x.xy)) && all(lessThan(uv, x.xy + x.zw))) {
      view = i;
      break;
    }
  }
  if (view < 0) discard;
  vec4 xform = uTileXform[view];
  float speed = uSpeed[view];
  vec2 local = (uv - xform.xy) / xform.zw;

  vec2 bloomLo = xform.xy + 0.5 * uBloomTexel;
  vec2 bloomHi = max(xform.xy + xform.zw - 0.5 * uBloomTexel, bloomLo);
  vec3 color = texelFetch(tScene, ivec2(gl_FragCoord.xy), 0).rgb
    + texture2D(tBloom, clamp(uv, bloomLo, bloomHi)).rgb * bloomStrength;
  color *= exposure * tint;
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(mix(vec3(grey), color, saturation), 0.0);
  color = acesFilmic(color);

  // 0 in the middle, 1 in the corners, whatever the viewport's shape.
  float edge = length(local - 0.5) * 1.41421356;
  color += speed * speedLines * speedLineMask(local, edge, uAspect[view]);
  color *= 1.0 - (vignette + speedVignette * speed) * smoothstep(0.4, 1.0, edge);

  // Display-ready from here on: the final pass only resamples. Dither before the 8-bit write.
  color = toSrgb(clamp(color, 0.0, 1.0));
  color += (hash12(gl_FragCoord.xy + fract(time) * 97.0) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}`;

/**
 * Upscale + RCAS (robust contrast-adaptive sharpening), ported to GLSL from three's SharpenNode
 * (MIT; itself from AMD FidelityFX FSR 1). Taps are bilinear at one *output* pixel spacing and
 * clamped to the view's tile, so the sharpening follows the screen, not the internal resolution.
 */
const FINAL = /* glsl */ `
uniform sampler2D tLdr;
uniform vec2 uLdrSize;
// Per view: canvas rect (x, y from the bottom, width, height) and LDR tile (origin, used size), px.
uniform vec4 uRects[${MAX_VIEWS}];
uniform vec4 uTiles[${MAX_VIEWS}];
uniform int uCount;
uniform float uSharpen;
uniform vec3 uSeam;

vec2 lo;
vec2 hi;
vec3 fetch(vec2 texel) {
  return texture2D(tLdr, clamp(texel, lo, hi) / uLdrSize).rgb;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  int view = -1;
  for (int i = 0; i < ${MAX_VIEWS}; i++) {
    if (i >= uCount) break;
    vec4 r = uRects[i];
    if (all(greaterThanEqual(p, r.xy)) && all(lessThan(p, r.xy + r.zw))) {
      view = i;
      break;
    }
  }
  if (view < 0) {
    gl_FragColor = vec4(uSeam, 1.0);
    return;
  }
  vec4 rect = uRects[view];
  vec4 tile = uTiles[view];
  vec2 stride = tile.zw / rect.zw;
  vec2 centre = tile.xy + (p - rect.xy) * stride;
  lo = tile.xy + 0.5;
  hi = max(tile.xy + tile.zw - 0.5, lo);
  vec3 e = fetch(centre);
  if (uSharpen <= 0.0) {
    // At 1:1 the centre lands on a texel centre: an exact copy.
    gl_FragColor = vec4(e, 1.0);
    return;
  }
  vec3 b = fetch(centre + vec2(0.0, -stride.y));
  vec3 d = fetch(centre + vec2(-stride.x, 0.0));
  vec3 f = fetch(centre + vec2(stride.x, 0.0));
  vec3 h = fetch(centre + vec2(0.0, stride.y));

  // Luma times 2, for the noise attenuation.
  float bL = b.g + 0.5 * (b.b + b.r);
  float dL = d.g + 0.5 * (d.b + d.r);
  float eL = e.g + 0.5 * (e.b + e.r);
  float fL = f.g + 0.5 * (f.b + f.r);
  float hL = h.g + 0.5 * (h.b + h.r);

  // Lobe limited by how much sharpening the local contrast can take without ringing.
  const float RCAS_LIMIT = 0.25 - 1.0 / 16.0;
  vec3 mn4 = min(min(b, d), min(f, h));
  vec3 mx4 = max(max(b, d), max(f, h));
  vec3 hitMin = min(mn4, e) / max(4.0 * mx4, vec3(1e-5));
  vec3 hitMax = (1.0 - max(mx4, e)) / min(4.0 * mn4 - 4.0, vec3(-1e-5));
  vec3 lobeRGB = max(-hitMin, hitMax);
  float lobe = max(-RCAS_LIMIT, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * uSharpen;

  // Sharpen less where the neighbourhood is noise rather than an edge.
  float nz = 0.25 * (bL + dL + fL + hL) - eL;
  float range = max(max(max(bL, dL), max(fL, hL)), eL) - min(min(min(bL, dL), min(fL, hL)), eL);
  lobe *= 1.0 - 0.5 * clamp(abs(nz) / max(range, 1.0 / 65536.0), 0.0, 1.0);

  vec3 result = ((b + d + f + h) * lobe + e) / (4.0 * lobe + 1.0);
  gl_FragColor = vec4(result, 1.0);
}`;

function fullScreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return geometry;
}

function pass(
  fragmentShader: string,
  uniforms: Record<string, IUniform>,
  extra: ConstructorParameters<typeof ShaderMaterial>[0] = {},
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });
}

function vec4s(): Vector4[] {
  return Array.from({ length: MAX_VIEWS }, () => new Vector4());
}

function bloomUniforms(): Record<string, IUniform> {
  return {
    tSource: { value: null },
    uTiles: { value: vec4s() },
    uTileCount: { value: 0 },
    uTargetSize: { value: new Vector2(1, 1) },
    uSourceTexel: { value: new Vector2(1, 1) },
    threshold: { value: POST.bloomThreshold },
    knee: { value: POST.bloomKnee },
  };
}

// Uniform accessors: the materials are built in this file, so every name exists.
const texture = (m: ShaderMaterial, name: string) => m.uniforms[name] as IUniform<Texture | null>;
const scalar = (m: ShaderMaterial, name: string) => m.uniforms[name] as IUniform<number>;
const vec2 = (m: ShaderMaterial, name: string) => (m.uniforms[name] as IUniform<Vector2>).value;
const vec4List = (m: ShaderMaterial, name: string) =>
  (m.uniforms[name] as IUniform<Vector4[]>).value;

export class PostChain {
  private readonly bloom: WebGLRenderTarget[] = [];
  private readonly quad: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly copyMaterial: ShaderMaterial;
  private readonly prefilter: ShaderMaterial;
  private readonly downsample: ShaderMaterial;
  private readonly upsample: ShaderMaterial;
  private readonly composite: ShaderMaterial;
  private readonly final: ShaderMaterial;
  /** Atlas-uv rects of the used tiles (origin, size), shared by the bloom and composite passes. */
  private readonly tileUv = vec4s();
  private readonly speeds = new Array<number>(MAX_VIEWS).fill(0);
  private readonly aspects = new Array<number>(MAX_VIEWS).fill(1);

  constructor(private readonly renderer: WebGLRenderer) {
    this.copyMaterial = pass(COPY, { tSource: { value: null }, uOrigin: { value: new Vector2() } });
    this.prefilter = pass(DOWNSAMPLE, bloomUniforms(), { defines: { PREFILTER: '' } });
    this.downsample = pass(DOWNSAMPLE, bloomUniforms());
    this.upsample = pass(UPSAMPLE, bloomUniforms(), {
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const [tr, tg, tb] = POST.tint;
    this.composite = pass(COMPOSITE, {
      tScene: { value: null },
      tBloom: { value: null },
      uAtlasSize: { value: new Vector2(1, 1) },
      uBloomTexel: { value: new Vector2(1, 1) },
      uTileXform: { value: this.tileUv },
      uSpeed: { value: this.speeds },
      uAspect: { value: this.aspects },
      uCount: { value: 0 },
      bloomStrength: { value: POST.bloomStrength },
      exposure: { value: POST.exposure },
      tint: { value: new Vector3(tr, tg, tb) },
      saturation: { value: POST.saturation },
      vignette: { value: POST.vignette },
      speedVignette: { value: POST.vignetteAtSpeed },
      speedLines: { value: POST.speedLinesOpacity },
      time: { value: 0 },
    });
    const seam = new Color(RENDER.seamColour);
    this.final = pass(FINAL, {
      tLdr: { value: null },
      uLdrSize: { value: new Vector2(1, 1) },
      uRects: { value: vec4s() },
      uTiles: { value: vec4s() },
      uCount: { value: 0 },
      uSharpen: { value: 0 },
      // The seam as display values: nothing converts colours after this pass.
      uSeam: { value: new Vector3(seam.r, seam.g, seam.b) },
    });
    this.quad = new Mesh(fullScreenTriangle(), this.copyMaterial);
    this.quad.frustumCulled = false;
  }

  /** Bloom mips for an atlas of this size: mip i is the atlas size >> (i + 1). */
  setAtlasSize(width: number, height: number, levels: number): void {
    while (this.bloom.length > levels) this.bloom.pop()?.dispose();
    while (this.bloom.length < levels) {
      this.bloom.push(
        new WebGLRenderTarget(1, 1, {
          type: HalfFloatType,
          depthBuffer: false,
          stencilBuffer: false,
        }),
      );
    }
    this.bloom.forEach((mip, i) => {
      mip.setSize(Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1)));
    });
  }

  /** Copies the (w, h) bottom-left corner of the scratch render into an atlas tile at (x, y). */
  copy(
    source: WebGLRenderTarget,
    atlas: WebGLRenderTarget,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    texture(this.copyMaterial, 'tSource').value = source.texture;
    vec2(this.copyMaterial, 'uOrigin').set(x, y);
    setBox(atlas, x, y, w, h);
    this.renderer.setRenderTarget(atlas);
    this.draw(this.copyMaterial);
  }

  /** Bloom, composite and the final upscale for this frame's views. */
  render(atlas: WebGLRenderTarget, ldr: WebGLRenderTarget, views: FrameViews): void {
    const count = Math.min(views.count, MAX_VIEWS);
    if (count === 0) return;
    const aw = atlas.width;
    const ah = atlas.height;
    // Used tile rects in atlas uv, and their bounding box in atlas pixels.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < count; i++) {
      const tile = views.tiles[i] as Tile;
      const w = views.usedWidth[i] ?? 1;
      const h = views.usedHeight[i] ?? 1;
      (this.tileUv[i] as Vector4).set(tile.x / aw, tile.y / ah, w / aw, h / ah);
      this.speeds[i] = views.speed[i] ?? 0;
      this.aspects[i] = w / h;
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + w);
      maxY = Math.max(maxY, tile.y + h);
    }

    this.renderBloom(atlas, count, minX / aw, minY / ah, maxX / aw, maxY / ah);

    // Composite into the LDR atlas, only inside the used tiles.
    const composite = this.composite;
    const bloom0 = this.bloom[0];
    texture(composite, 'tScene').value = atlas.texture;
    texture(composite, 'tBloom').value = bloom0?.texture ?? null;
    scalar(composite, 'bloomStrength').value = bloom0 ? POST.bloomStrength : 0;
    vec2(composite, 'uAtlasSize').set(aw, ah);
    if (bloom0) vec2(composite, 'uBloomTexel').set(1 / bloom0.width, 1 / bloom0.height);
    scalar(composite, 'uCount').value = count;
    scalar(composite, 'time').value = views.time;
    setBox(ldr, minX, minY, maxX - minX, maxY - minY);
    this.renderer.setRenderTarget(ldr);
    this.draw(composite);

    // Upscale + sharpen to the canvas.
    const final = this.final;
    texture(final, 'tLdr').value = ldr.texture;
    vec2(final, 'uLdrSize').set(ldr.width, ldr.height);
    const rects = vec4List(final, 'uRects');
    const tiles = vec4List(final, 'uTiles');
    for (let i = 0; i < count; i++) {
      (rects[i] as Vector4).copy(views.canvasRects[i] as Vector4);
      const tile = views.tiles[i] as Tile;
      (tiles[i] as Vector4).set(tile.x, tile.y, views.usedWidth[i] ?? 1, views.usedHeight[i] ?? 1);
    }
    scalar(final, 'uCount').value = count;
    scalar(final, 'uSharpen').value = views.sharpen;
    const renderer = this.renderer;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, views.canvasWidth, views.canvasHeight);
    renderer.setScissor(0, 0, views.canvasWidth, views.canvasHeight);
    renderer.setScissorTest(false);
    this.draw(final);
  }

  dispose(): void {
    for (const mip of this.bloom) mip.dispose();
    this.bloom.length = 0;
    this.quad.geometry.dispose();
    for (const material of [
      this.copyMaterial,
      this.prefilter,
      this.downsample,
      this.upsample,
      this.composite,
      this.final,
    ]) {
      material.dispose();
    }
  }

  /** Bloom over the atlas, each mip pass limited to the bounding box of the used tiles. */
  private renderBloom(
    atlas: WebGLRenderTarget,
    count: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ): void {
    const levels = this.bloom.length;
    let source: WebGLRenderTarget = atlas;
    for (let i = 0; i < levels; i++) {
      const target = this.bloom[i] as WebGLRenderTarget;
      const material = i === 0 ? this.prefilter : this.downsample;
      this.bloomPass(material, source, target, count, u0, v0, u1, v1);
      source = target;
    }
    for (let i = levels - 1; i > 0; i--) {
      const from = this.bloom[i] as WebGLRenderTarget;
      const into = this.bloom[i - 1] as WebGLRenderTarget;
      this.bloomPass(this.upsample, from, into, count, u0, v0, u1, v1);
    }
  }

  private bloomPass(
    material: ShaderMaterial,
    source: WebGLRenderTarget,
    target: WebGLRenderTarget,
    count: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ): void {
    texture(material, 'tSource').value = source.texture;
    vec2(material, 'uSourceTexel').set(1 / source.width, 1 / source.height);
    vec2(material, 'uTargetSize').set(target.width, target.height);
    scalar(material, 'uTileCount').value = count;
    const tiles = vec4List(material, 'uTiles');
    for (let i = 0; i < count; i++) {
      const t = this.tileUv[i] as Vector4;
      (tiles[i] as Vector4).set(t.x, t.y, t.x + t.z, t.y + t.w);
    }
    // One target texel of margin around the used tiles' bounding box.
    const x0 = Math.max(0, Math.floor(u0 * target.width) - 1);
    const y0 = Math.max(0, Math.floor(v0 * target.height) - 1);
    const x1 = Math.min(target.width, Math.ceil(u1 * target.width) + 1);
    const y1 = Math.min(target.height, Math.ceil(v1 * target.height) + 1);
    setBox(target, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    this.renderer.setRenderTarget(target);
    this.draw(material);
  }

  private draw(material: ShaderMaterial): void {
    this.quad.material = material;
    this.renderer.render(this.quad, this.quadCamera);
  }
}

/** Viewport and scissor of a target pass (renderer.setViewport is ignored for targets). */
function setBox(target: WebGLRenderTarget, x: number, y: number, w: number, h: number): void {
  target.viewport.set(x, y, w, h);
  target.scissor.set(x, y, w, h);
  target.scissorTest = true;
}
