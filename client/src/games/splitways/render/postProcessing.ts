/**
 * HDR pipeline for one viewport at a time: the scene renders into a multisampled half-float target,
 * a small mip-chain bloom runs on it, and one composite pass writes the viewport's rectangle of the
 * canvas (bloom, golden-hour grade, ACES tone mapping, vignette, speed lines, sRGB, dither).
 * Viewports are drawn one after another, so they all share the same targets.
 */
import {
  BufferGeometry,
  CustomBlending,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  OneFactor,
  OrthographicCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { POST, RENDER } from '../config';
import type { Rect } from './viewports';

const BLOOM_LEVELS = 4;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** 13-tap downsample (Jimenez, "Next generation post processing in Call of Duty"). */
const DOWNSAMPLE = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
vec3 tap(vec2 offset) { return texture2D(tSource, vUv + texel * offset).rgb; }
void main() {
  vec3 c = tap(vec2(0.0)) * 0.125;
  c += (tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)) + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0))) * 0.125;
  c += (tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0)) + tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0))) * 0.03125;
  c += (tap(vec2(0.0, 2.0)) + tap(vec2(-2.0, 0.0)) + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, -2.0))) * 0.0625;
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
uniform sampler2D tSource;
uniform vec2 texel;
varying vec2 vUv;
vec3 tap(float x, float y) { return texture2D(tSource, vUv + texel * vec2(x, y)).rgb; }
void main() {
  vec3 c = tap(0.0, 0.0) * 4.0;
  c += (tap(-1.0, 0.0) + tap(1.0, 0.0) + tap(0.0, -1.0) + tap(0.0, 1.0)) * 2.0;
  c += tap(-1.0, -1.0) + tap(1.0, -1.0) + tap(-1.0, 1.0) + tap(1.0, 1.0);
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float bloomStrength;
uniform float exposure;
uniform vec3 tint;
uniform float saturation;
uniform float vignette;
uniform float speed;
uniform float speedVignette;
uniform float speedLines;
uniform float time;
uniform float aspect;
varying vec2 vUv;

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
float speedLineMask(float edge) {
  vec2 p = (vUv - vec2(0.5, 0.55)) * vec2(aspect, 1.0);
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
  vec3 color = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  color *= exposure * tint;
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(mix(vec3(grey), color, saturation), 0.0);
  color = acesFilmic(color);

  // 0 in the middle, 1 in the corners, whatever the viewport's shape.
  float edge = length(vUv - 0.5) * 1.41421356;
  color += speed * speedLines * speedLineMask(edge);
  color *= 1.0 - (vignette + speedVignette * speed) * smoothstep(0.4, 1.0, edge);

  color = toSrgb(clamp(color, 0.0, 1.0));
  color += (hash12(gl_FragCoord.xy + fract(time) * 97.0) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}`;

function fullScreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return geometry;
}

function target(samples = 0, depth = false): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples,
    depthBuffer: depth,
    stencilBuffer: false,
    resolveDepthBuffer: false,
  });
}

export class PostProcessing {
  private readonly sceneTarget = target(RENDER.msaaSamples, true);
  private readonly bloom: WebGLRenderTarget[] = [];
  private readonly quad: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly prefilter: ShaderMaterial;
  private readonly downsample: ShaderMaterial;
  private readonly upsample: ShaderMaterial;
  private readonly composite: ShaderMaterial;
  private width = 0;
  private height = 0;

  constructor(private readonly renderer: WebGLRenderer) {
    for (let i = 0; i < BLOOM_LEVELS; i++) this.bloom.push(target());
    const bloomUniforms = () => ({
      tSource: { value: null as Texture | null },
      texel: { value: new Vector2() },
      threshold: { value: POST.bloomThreshold },
      knee: { value: POST.bloomKnee },
    });
    this.prefilter = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: DOWNSAMPLE,
      uniforms: bloomUniforms(),
      defines: { PREFILTER: '' },
      depthTest: false,
      depthWrite: false,
    });
    this.downsample = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: DOWNSAMPLE,
      uniforms: bloomUniforms(),
      depthTest: false,
      depthWrite: false,
    });
    this.upsample = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: UPSAMPLE,
      uniforms: bloomUniforms(),
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const [tr, tg, tb] = POST.tint;
    this.composite = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: COMPOSITE,
      uniforms: {
        tScene: { value: this.sceneTarget.texture },
        tBloom: { value: this.bloom[0]?.texture ?? null },
        bloomStrength: { value: POST.bloomStrength },
        exposure: { value: POST.exposure },
        tint: { value: new Vector3(tr, tg, tb) },
        saturation: { value: POST.saturation },
        vignette: { value: POST.vignette },
        speed: { value: 0 },
        speedVignette: { value: POST.vignetteAtSpeed },
        speedLines: { value: POST.speedLinesOpacity },
        time: { value: 0 },
        aspect: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(fullScreenTriangle(), this.composite);
    this.quad.frustumCulled = false;
  }

  /** Pixel size of the 3D image for each viewport. Reallocates only when it changes. */
  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneTarget.setSize(w, h);
    this.bloom.forEach((level, i) => {
      level.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1)));
    });
  }

  /**
   * Renders `scene` and writes it into `rect` of the canvas (CSS pixels, top-left origin).
   * `speed` (0..1) drives the speed lines and the extra vignette.
   */
  render(
    scene: Scene,
    camera: Camera,
    rect: Rect,
    canvasHeight: number,
    speed: number,
    time: number,
  ): void {
    const renderer = this.renderer;
    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);
    this.renderBloom();

    // WebGL's origin is bottom-left; our rects are top-left like the DOM.
    const y = canvasHeight - rect.y - rect.height;
    renderer.setRenderTarget(null);
    renderer.setViewport(rect.x, y, rect.width, rect.height);
    renderer.setScissor(rect.x, y, rect.width, rect.height);
    const uniforms = this.composite.uniforms;
    (uniforms.speed as { value: number }).value = speed;
    (uniforms.time as { value: number }).value = time;
    (uniforms.aspect as { value: number }).value = rect.width / rect.height;
    this.draw(this.composite);
  }

  dispose(): void {
    this.sceneTarget.dispose();
    for (const level of this.bloom) level.dispose();
    this.quad.geometry.dispose();
    this.prefilter.dispose();
    this.downsample.dispose();
    this.upsample.dispose();
    this.composite.dispose();
  }

  private renderBloom(): void {
    const renderer = this.renderer;
    let source: WebGLRenderTarget = this.sceneTarget;
    for (let i = 0; i < this.bloom.length; i++) {
      const level = this.bloom[i] as WebGLRenderTarget;
      const material = i === 0 ? this.prefilter : this.downsample;
      setSource(material, source);
      renderer.setRenderTarget(level);
      this.draw(material);
      source = level;
    }
    for (let i = this.bloom.length - 1; i > 0; i--) {
      setSource(this.upsample, this.bloom[i] as WebGLRenderTarget);
      renderer.setRenderTarget(this.bloom[i - 1] as WebGLRenderTarget);
      this.draw(this.upsample);
    }
  }

  private draw(material: ShaderMaterial): void {
    this.quad.material = material;
    this.renderer.render(this.quad, this.quadCamera);
  }
}

function setSource(material: ShaderMaterial, source: WebGLRenderTarget): void {
  const uniforms = material.uniforms;
  (uniforms.tSource as { value: Texture | null }).value = source.texture;
  (uniforms.texel as { value: Vector2 }).value.set(1 / source.width, 1 / source.height);
}
