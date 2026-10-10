# Rendering Platform and Performance Strategy for "Split Ways" (three.js, M1 to 4K TV, 1-4 viewports, October 2026)

Source notes: "local source" means I read the code in the project's installed `node_modules/three` (three@0.186.1). The GitHub links point at the matching r186 files. Anything older than 2024 is marked [OLDER].

## 1. State of three.js WebGPURenderer + TSL (r180-r186+) vs WebGLRenderer

### Takeaway
In r186, WebGPURenderer works, has a full TSL post-processing stack and falls back to WebGL2 automatically. It is still behind WebGLRenderer in three areas: CPU cost per draw call, multi-viewport rendering with RenderPipeline (a fix is milestoned for r187), and maturity. Moving Split Ways means rewriting the custom HDR pipeline and every ShaderMaterial, onBeforeCompile and ShaderChunk use in TSL. The main thing WebGPU would buy is TAAU/TRAA/GTAO/SSR/SSGI with motion vectors, which the WebGL addons do not have.

### Cited Findings
**Status and fallback**
- WebGPURenderer falls back to WebGL2 when WebGPU is unavailable. A migration guide updated September 24, 2026 (written against r186, which it dates to September 8, 2026) says the official manual still calls WebGLRenderer "the recommended choice for pure WebGL 2 applications" and calls WebGPURenderer experimental. This is secondary: I could not fetch the manual page itself. — [Utsubo migration guide (Sep 2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide); [Utsubo "What's new in three.js 2026"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r186 was released around September 8-9, 2026. It focused on WebGPU work: a native Gaussian splat renderer in WebGPU/TSL, `Object3D.dispose()` and `intersectsFrustum()`. — [Radiance Fields](https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186); [CGWorld](https://cgworld.jp/flashnews/01-202610-Threejs-r186.html)
- Breaking changes by release:
  - r171 (Nov 29, 2024): `three/webgpu` entry point usable without extra build config.
  - r181: `renderAsync()` and `computeAsync()` deprecated; use `render()` and `compute()`.
  - r182: `colorBufferType` renamed to `outputBufferType`.
  - r183: `PostProcessing` renamed to `RenderPipeline`; `Clock` deprecated; `WebGLCubeRenderTarget` stops working with WebGPURenderer; shadow bias changed.
  - r185: premultiplied alpha changes.
  - r186: `PCFSoftShadowMap` removed for WebGPURenderer (`PCFShadowMap` is now soft); `viewportResolution` replaced by `screenSize`; `SunLight` added.
  - In r186, `render()` on an uninitialized renderer throws.
  - Source for all of the above: [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

**Unsupported features and migration effort**
- `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` do not work on either WebGPURenderer backend. A ShaderMaterial logs "is not compatible" and the mesh does not render. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- `EffectComposer` and pmndrs/postprocessing do not run on WebGPURenderer. Post-processing has to be rebuilt as a TSL `RenderPipeline` node graph. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- Other porting pitfalls:
  - Node materials do the output color conversion themselves, so colors can look brighter after porting.
  - WebGPU needs a secure context, so plain-HTTP staging always falls back to WebGL2.
  - `renderer.isWebGPURenderer` is true on both backends, so it does not tell you which backend is active.
  - Adding `WebGLRenderer` next to `three/webgpu` grew a minified bundle from 792 KB to 1,155 KB (220 to 307 KB gzipped).
  - Source: [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- In this repo, six files use `ShaderMaterial`, `onBeforeCompile` or `ShaderChunk` (about 26 matches): `render/postProcessing.ts` (12), `render/haze.ts` (5), `scene/itemVisuals.ts` (4), `scene/particles.ts` (3), `scene/sea.ts` (1), `scene/sceneryModels.ts` (1). All are under `client/src/games/splitways/`. — local repo grep (Oct 9, 2026)
- r186 ships `examples/jsm/tsl/WebGLNodesHandler.js`, which runs TSL node materials inside the classic WebGLRenderer. Its listed limitations:
  - no VSM shadows
  - no MRT
  - no transmission
  - "WebGPU postprocessing stack not supported"
  - no storage textures
  - fog and environment do not update automatically
  - Source: local source, [WebGLNodesHandler.js r186](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/WebGLNodesHandler.js)

**MSAA, viewports, render targets** (from local source)
- WebGPURenderer supports MSAA. `antialias: true` gives 4 samples by default and `samples` can be set. Render targets use their own `samples`. A `PassNode` takes `renderer.samples` unless overridden. — [Renderer.js r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js); [PassNode.js r186](https://github.com/mrdoob/three.js/blob/r186/src/nodes/display/PassNode.js)
- TRAA and TAAU both state: "MSAA must be disabled when TRAA [TAAU] is in use." — [TRAANode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/TRAANode.js); [TAAUNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/TAAUNode.js)
- WebGPURenderer has `setViewport`, `setScissor` and `setScissorTest`. The `webgpu_multiple_elements` example uses the classic per-view scissor pattern. — [Renderer.js r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js); [webgpu_multiple_elements](https://threejs.org/examples/webgpu_multiple_elements.html)
- Known multi-viewport bugs on the WebGPU backend:
  - **Forum report, June 26, 2026, r184:** `RenderPipeline` ignores `setViewport`/`setScissor` on the WebGPU backend.
    - Cause 1: render contexts are cached per attachment state, so a second pipeline drawing to the canvas overwrites the first one's viewport.
    - Cause 2: the viewport is skipped when it equals the full screen size.
    - The reporter says the WebGL backend got a similar fix (#32883) but WebGPU did not. No maintainer reply.
    - Source: [three.js forum thread 92444](https://discourse.threejs.org/t/renderpipeline-does-not-support-split-screen-multiple-viewports-with-webgpu-backend/92444)
  - **Issue #34671 (r185):** render-target viewport/scissor is compared against the canvas size, not the target size. Closed Sep 28, 2026 via PR #34692, milestone r187. — [GitHub #34671](https://github.com/mrdoob/three.js/issues/34671)
  - **Issue #30450:** WebGPU `setScissor` rejects negative coordinates where WebGL accepts them. — [GitHub #30450](https://github.com/mrdoob/three.js/issues/30450)
- Compute on the WebGL2 backend is emulated with transform feedback. Storage textures, workgroup shared memory and indirect dispatch/draw are WebGPU-backend only. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

**Performance compared with WebGLRenderer**
- **Many-mesh benchmark, May 29-30, 2026:** three.js r183, Chrome 148, RTX 4090 Laptop, 4,000 separate meshes, about 8M triangles. The "same on both backends" claim refers to WebGPURenderer's WebGPU and WebGL2 backends. Gap widens at about 9k meshes. Suspected cause: per-object UBO and bind-group churn (GitHub #30560). The only reply was from a community member (manthrax): use WebGL unless you need WebGPU-only features. — [three.js forum thread 91904](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904)

  | Renderer | CPU per frame | Cold first frame |
  |---|---|---|
  | WebGLRenderer | 4.5 ms | 32 ms |
  | WebGPURenderer, WebGPU backend | 9.7 ms | 167 ms |
  | WebGPURenderer, `forceWebGL` | 10.3 ms | 344 ms |

- In January 2026, Mugen87 (maintainer) said the r182 WebGPU performance regressions were fixed on dev and r183 should be "noticeably" faster. The same thread reports harder-looking shadows and a different shadow bias on WebGPU (suggested starting bias -0.0005). — [three.js forum thread 89322](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322)
- donmccurdy (Sep 3, 2025): "the cost of sending 10,000 draw calls to the GPU is significant regardless of the API". He recommends BatchedMesh or merged geometry on either renderer. — [three.js forum thread 86635](https://discourse.threejs.org/t/understanding-about-webgpurenderer/86635/5)
- Other reports of WebGPURenderer running slower than WebGL:
  - 20,000 non-instanced cubes: about 4x lower fps.
  - Forced WebGL backend was "5-10x worse" than plain WebGLRenderer in one report.
  - Sources: [forum: Why WebGPURenderer performance significantly lower (Feb 2025)](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629); [GitHub #31055](https://github.com/mrdoob/three.js/issues/31055); [GitHub #33821 (material init slow)](https://github.com/mrdoob/three.js/issues/33821)

### Inferences
- **Recommendation: stay on WebGLRenderer r186 for the next milestone. Run a time-boxed WebGPURenderer spike behind a flag; do not migrate now.**
  - The current custom per-viewport HDR pipeline already uses the same pattern the WebGPU backend still has bugs with (per-viewport `setViewport`/`setScissor` plus a post chain).
  - CPU cost per draw on WebGPURenderer was about 2x WebGL as recently as r183.
  - Six files would need a TSL rewrite.
- **Decision gate to re-check at r187/r188:**
  - #34671 and the forum 92444 multi-viewport issue are fixed in a release.
  - A 4-viewport Split Ways scene on the M1 shows CPU render time no worse than WebGL.
  - TAAU gives clearly better 4K output than the current MSAA + bilinear path.
  - If all three hold, migrate. TAAU, velocity MRT, SSGI and SSR denoise are the features that justify the port for a "Forza-level" look.
- The WebGL2-fallback promise only holds if no WebGPU-only features are used (compute with storage textures, indirect draws). Treat the fallback as a safety net, not a second target.

### Gaps
- I could not fetch the official three.js manual page for WebGPURenderer (404 at both URLs tried). The "experimental" wording comes from a secondary guide.
- I found no confirmation that the June 2026 RenderPipeline multi-viewport issue (forum 92444) is fixed in r186 or r187. Only #34671 is confirmed closed for r187.
- The status of GitHub #30560 (per-object UBO overhead) in r186 is unknown. I found no r184-r186 re-benchmark of the many-mesh gap.

## 2. WebGPU support on macOS in 2026 (Chrome, Safari, Firefox, Apple Silicon)

### Takeaway
All three major macOS browsers ship WebGPU on Apple Silicon by default as of October 2026:
- Chrome since 113 (2023, still current).
- Safari since 26 (September 2025).
- Firefox since 145 on macOS 26, and on all macOS versions since 147 (January 2026).

Global support is about 87%. The 1080p/4K TV audience will mostly be on Chrome or Edge on laptops, or on TV and stick browsers, where WebGPU support is far less certain. That makes the WebGL2 fallback, or staying on WebGL, essential.

### Cited Findings
- **Chrome/Edge:** WebGPU on Windows, macOS and ChromeOS since 113. Linux since 144 (Intel Gen12+) and 147 (NVIDIA on Wayland). Android 12+ since 121. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- **Safari 26:** WebKit announced WebGPU "now shipping in Safari 26 beta for macOS, iOS, iPadOS, and visionOS" (June 9, 2025). WebKit says WebGPU "supersedes WebGL on macOS, iOS, iPadOS, and visionOS" and maps better to Metal, with validation streamlined toward "closer to native application performance". — [WebKit blog, WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- Safari 26 shipped with WebGPU on by default in September 2025. — [Cinevva news (Sep 15, 2025)](https://app.cinevva.com/news/2025-09-15-safari-webgpu); [Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- **Firefox 145** (Nov 11, 2025): "The WebGPU DOM API ... is now available on macOS 26 (Tahoe) on Apple Silicon." — [Firefox 145 release notes](https://www.firefox.com/en-US/firefox/145.0/releasenotes/)
- **Firefox 147** (Jan 13, 2026): "WebGPU support is now enabled for devices with Apple Silicon processors on all supported macOS versions." Intel Macs, Linux and Android are not yet enabled in stable Firefox. — [Firefox 147 release notes](https://www.firefox.com/firefox/147.0/releasenotes/); [Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- caniuse puts global WebGPU support at about 87% (August 2026 data, as quoted by a secondary source). — [Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- An [OLDER, 2022] Intel-Mac report: UnrealBloomPass ran at about 20 fps in Safari until "WebGL via Metal" was turned off. The same example ran at a stable 60 fps on an M1 Air. — [three.js forum 42606](https://discourse.threejs.org/t/unrealbloompass-poor-performance-on-macos-safari-with-intel/42606)

### Inferences
- On the target machine (Chrome on an M1), both WebGL2 (ANGLE on Metal) and WebGPU (Dawn on Metal) are available, so the choice can rest on three.js maturity and features, not browser support.
- For public 4K/1080p TV setups (smart-TV browsers, Fire TV, Chromecast/Google TV, older Intel Macs, Linux mini PCs), WebGL2 remains the dependable baseline.

### Gaps
- I found no Apple Silicon-specific WebGPU driver bug reports affecting three.js in 2025-2026. That does not mean there are none.
- One result said Safari 26 WebGPU needs macOS Tahoe. I did not verify whether Safari 26 on macOS Sonoma or Sequoia also enables WebGPU.

## 3. Post-processing available per renderer and typical cost

### Takeaway
The TSL/WebGPU stack in r186 is much richer:
- TRAA and TAAU (temporal upscaling), FSR1, GTAO with temporal filtering, SSR (including stochastic GGX plus denoise), SSGI, screen-space shadows, motion blur from real velocity buffers, DOF, lens flare, god rays, LUT, SMAA and FXAA.
- MRT lets one scene pass output color, normals, emissive and velocity together.

The WebGL addons have bloom, GTAO, SSAO, SSR, SMAA, FXAA, SSAA, Bokeh and LUT. Their TAA has no reprojection, and there are no motion vectors. GTAO and SSR re-render the whole scene with override materials, which multiplies draw calls per viewport. I found no published millisecond costs for M1; the numbers below are sample counts and resolution defaults read from the source.

### Cited Findings
- **TSL display nodes in three@0.186.1** (`examples/jsm/tsl/display/`):
  - Bloom, GTAO, SSAO, SSR, SSGI, SSS (screen-space shadows)
  - TRAA, TAAU, FSR1, SMAA, FXAA, SSAA pass
  - MotionBlur, DepthOfField, Lensflare, Godrays, Lut3D, ChromaticAberration, Outline
  - Denoise, RecurrentDenoise, TemporalReproject, Sharpen
  - Gaussian, box, hash and radial blurs; OIT pass
  - Source: local source; [three.js r186 tsl/display directory](https://github.com/mrdoob/three.js/tree/r186/examples/jsm/tsl/display)
- **Official WebGPU examples** include: postprocessing_ao, bloom, bloom_emissive, bloom_selective, dof, fxaa, smaa, ssaa, ssgi, ssr, ssr_denoise, sss, traa, motion_blur, lensflare, godrays, 3dlut; upscaling_fsr1 and upscaling_taau; shadowmap_csm, shadow_contact, mesh_batch, struct_drawindirect, occlusion, camera_array, multiple_elements, loader_texture_ktx2, textures_2d-array_compressed. — [threejs.org examples index (files.json)](https://threejs.org/examples/files.json)
- **WebGL addon passes in r186** (`examples/jsm/postprocessing/`): UnrealBloomPass, BloomPass, GTAOPass, SSAOPass, SAOPass, SSRPass, SMAAPass, FXAAPass, SSAARenderPass, TAARenderPass, BokehPass, LUTPass, OutlinePass, AfterimagePass, FilmPass, OutputPass. — local source; [three.js r186 postprocessing directory](https://github.com/mrdoob/three.js/tree/r186/examples/jsm/postprocessing)
- **WebGL TAARenderPass** only accumulates jittered samples "when there is no motion in the scene"; "This effect uses no reprojection so it is no TRAA implementation". SSAARenderPass "re-renders the scene once for each sample". — [TAARenderPass.js r186](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/TAARenderPass.js); [SSAARenderPass.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/SSAARenderPass.js)
- **WebGL GTAOPass, SSRPass and SAOPass** re-render the scene with `scene.overrideMaterial` into a normal target (SSRPass also does a metalness pass), unless a G-buffer is supplied through `GTAOPass.setGBuffer()`. GTAOPass "provides better quality than SSAOPass but is also more expensive". — local source, [GTAOPass.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js); [SSRPass.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/SSRPass.js)
- **TSL node cost parameters (defaults in r186 source):**
  - **GTAO:** `resolutionScale = 1`, 16 samples, temporal filtering off by default. The docs example uses a separate normal/depth pre-pass. — [GTAONode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/GTAONode.js); [GTAONode docs](https://threejs.org/docs/pages/GTAONode.html)
  - **SSAO:** `resolutionScale = 0.5`, 16 samples. — [SSAONode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/SSAONode.js)
  - **SSR:** `resolutionScale = 1`, `quality = 0.5`.
    - With `reflectNonMetals=false`, non-metals are discarded "for a noticeable performance gain".
    - `stochastic=true` gives GGX rays but "expects a temporal/spatial denoiser".
    - Source: [SSRNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/SSRNode.js)
  - **SSGI:** samples per pixel = sliceCount × stepCount × 2, temporal filtering on by default. Recommended presets with temporal filtering: Low 1×12, Medium 2×8, High 3×16 (24, 32 and 96 samples per pixel). — [SSGINode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/SSGINode.js)
  - **Bloom:** 5-mip chain. Selective bloom via an MRT `emissive` output. — [BloomNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/BloomNode.js)
  - **Motion blur:** 16 samples by default, using the velocity MRT. — [MotionBlur.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/MotionBlur.js)
  - **Lens flare:** works from the bloom output, `downSampleRatio = 4`. — [LensflareNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/LensflareNode.js)
  - **SMAA:** "1x Medium" preset; "better results than FXAA but is also more expensive". — [SMAANode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/SMAANode.js)
  - **SSS (screen-space shadows):** one directional light only. Becomes "computationally very expensive" if the maximum shadow length goes above about 1 m. — [SSSNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/SSSNode.js)
- A 2026 TSL demo (rainy cyberpunk alley) runs GTAO, bloom, lens flare and a reduced-scale ground reflection at half resolution, and turns GTAO off on mobile. — [ektogamat/threejs-conference](https://github.com/ektogamat/threejs-conference)
- Each post pass's cost scales with resolution, so 4K makes every pass much more expensive. — [three.js forum 52074](https://discourse.threejs.org/t/performance-drops-at-higher-resolutions/52074)

### Inferences
These are relative costs at 1080p internal resolution on an M1. They are ranked from sample counts and passes, not measured. Measure with GPU timestamp queries before committing.

| Cost | Effects |
|---|---|
| Very cheap | Vignette, dither, LUT, chromatic aberration, FXAA, speed lines (single full-screen taps) |
| Cheap | Bloom (5 mips, mostly at low resolution), lens flare (quarter resolution) |
| Moderate | SMAA (3 passes), motion blur (16 taps), TRAA/TAAU (needs a velocity MRT on every draw), DOF |
| Expensive | GTAO at full resolution (16 samples). Use `resolutionScale` 0.5 plus temporal filtering. |
| Very expensive | SSR (full resolution; stochastic needs a denoiser), SSGI (24-96 samples per pixel) |

- **Suggested M1 preset ladder:**
  - **"TV-High", 1 viewport:** HDR, bloom, TAAU or TRAA, motion blur, half-resolution GTAO, SSR restricted to metals or wet track at half resolution.
  - **"Medium", 2 viewports:** drop SSR; GTAO at half resolution or baked AO.
  - **"Low", 4 viewports:** bloom plus FXAA or SMAA, no SSAO/SSR/SSGI. Bake AO into vertex colors or lightmaps.
- **Do not plan on SSGI on an M1 at 60 fps with 2-4 viewports.** Bake GI (lightmaps or light probes) for static track geometry instead. Racing tracks are static, so baked lighting gives most of the "Forza look" at almost no runtime cost.

### Gaps
- I found no published millisecond timings for any three.js pass (WebGL or TSL) on Apple M1 at 1080p or 4K.
- I found no data on whether Apple's tile-based GPU keeps MSAA resolve on-chip through Chrome/ANGLE (WebGL) or Dawn (WebGPU). That affects whether MSAA is cheap on the M1.

## 4. Performance budgets on M1 at 1080p internal resolution, scaling to 2 and 4 viewports, upscaling to 4K

### Takeaway
The M1's 8-core GPU (about 2.6 TFLOPS FP32, 68 GB/s shared LPDDR4X) has roughly a quarter of the per-pixel budget at native 4K that it has at 1080p. Native 4K with heavy post-processing at 60 fps is not realistic. Render internally at about 1080p (scaling up to about 1440p for one viewport when there is headroom), with dynamic resolution, and upscale to 4K:
- **WebGL:** spatial upscale (bilinear, or FSR1-style EASU+RCAS ported to GLSL).
- **WebGPU:** r186's TAAU, which does anti-aliasing and upscaling in one pass.

Total pixels stay constant across 1, 2 and 4 viewports. What grows with viewport count is CPU and draw-call cost, shadow-map renders and per-pass overhead.

### Cited Findings
- M1 8-core GPU: about 2.6 TFLOPS FP32. — [Notebookcheck M1 comparison](https://www.notebookcheck.net/M2-10-Core-GPU-vs-M1-7-Core-GPU-vs-M1-8-Core-GPU_11368_10560_10552.247598.0.html); [gpu-monkey FP32](https://www.gpu-monkey.com/en/benchmark-apple_m1_8_core_gpu-fp32)
- 128-bit LPDDR4X, 68 GB/s, shared with the CPU. — [technical.city M1 8-core GPU](https://technical.city/en/gpu/Apple-M1-8-Core-GPU)
- Notebookcheck's 1080p game results for the M1: Armajet medium about 29 fps, World of Tanks Blitz ultra 39.6 fps, Wild Rift ultra 60 fps. These are mostly mobile or older titles; there are no modern AAA 1080p numbers. — [Notebookcheck](https://www.notebookcheck.net/M1-8-Core-GPU-vs-M1-Max-24-Core-GPU_10552_10967.247598.0.html)
- **TAAU (r186):**
  - Accumulates jittered samples and reprojects history with motion vectors.
  - Inputs come from a lower-resolution pass (`PassNode.setResolutionScale`), resolved with a 9-tap Blackman-Harris filter. Described as "an alternative to FSR2/3 that does anti-aliasing and upscaling in a single pass".
  - Requires MSAA off.
  - The official example renders the scene at `resolutionScale: 0.5` with `mrt({ output, velocity })` and offers a choice between Bilinear and TAAU.
  - Sources: [TAAUNode.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/TAAUNode.js); [webgpu_upscaling_taau](https://threejs.org/examples/webgpu_upscaling_taau.html)
- **FSR1 node (r186):** EASU (12 taps) plus RCAS (5 taps). "Only use FSR 1 if your application is fragment-shader bound ... FSR 1 should always be used with an anti-aliased source image." — [FSR1Node.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/FSR1Node.js); [webgpu_upscaling_fsr1](https://threejs.org/examples/webgpu_upscaling_fsr1.html)
- **Many-mesh CPU cost:** on a high-end Windows laptop (r183), 4,000 meshes cost 4.5 ms per frame of CPU in WebGLRenderer, about 1.1 µs per mesh, and 9.7 ms in WebGPURenderer, about 2.4 µs per mesh. — [three.js forum 91904](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904)
- **Current project settings:** dynamic resolution `{ minScale: 0.6, step: 0.1, lowFps: 55, recoverSeconds: 5 }`, `setPixelRatio(min(dpr, RENDER.maxPixelRatio))`, and per-viewport scissor post in `render/postProcessing.ts`. — local repo (`client/src/games/splitways/config.ts`, `render/renderer.ts`)

### Inferences
These budgets are my estimates, built from the hardware figures above. They are not measured.

**Per-pixel arithmetic at 60 fps**
- 2.6 TFLOPS / 60 is about 43 GFLOP per frame (theoretical). That is about 20.8k FLOP per pixel at 1080p, 11.7k at 1440p and 5.2k at 4K.
- Bandwidth is about 1.1 GB per frame, shared with the CPU. One RGBA16F 1080p target is about 16.6 MB, so each full-screen HDR pass at 1080p moves about 33 MB (read plus write). The same pass at 4K moves about 133 MB.
- Ten full-screen HDR passes at 1080p use about 30% of the frame's bandwidth. At 4K they would exceed it once overdraw and texturing are added.

**Budget table** (target 60 fps; keep GPU at 12-13 ms to absorb spikes; keep the main thread at 8-10 ms or less, including Rapier, game logic and draw submission)

| Item | 1 viewport | 2 viewports | 4 viewports |
|---|---|---|---|
| Internal resolution (total) | 1440p to 1080p dynamic (scale 0.75-1.0 of 1440p) | 1080p total, two halves | 1080p total (4 × 960×540), floor about 0.7 |
| Draw calls per viewport (incl. shadow pass) | 600-1,000 | 400-600 | 250-400 |
| Draw calls per frame | about 1,000 | about 1,200 | about 1,500 max (WebGL); lower on WebGPURenderer until the per-draw overhead improves |
| Visible triangles per viewport | 1.5-3M | 1-2M | 0.5-1M (4-6M per frame total) |
| Hero car (player) | 150-300k tris at LOD0 | same | LOD1 about 60-100k |
| Opponent cars | LOD chain 60k / 20k / 5k | same | same |
| Shadow maps | sun CSM: 2 cascades at 2048² + 1 at 1024², or a single 4096² fitted to the near track | 1 shared map + per-viewport near cascade at 1024² | one shared 2048-4096² sun map for the whole track section; skip per-viewport cascades; contact shadows or blob AO under cars |
| Post effects | about 6-8 (HDR, bloom, TAAU/TRAA, motion blur, half-res GTAO, grade/vignette, optional SSR on metals) | about 5 (no SSR) | about 3-4 (bloom, AA, grade/vignette/dither) |
| Texture memory (GPU) | under 1-1.5 GB, all KTX2 (ETC1S for albedo of props, UASTC for normal maps and the hero car) | same | same |

**Why viewport count still matters at constant pixels**
- Each extra viewport re-runs culling and draw submission. On the WebGPU backend, an `ArrayCamera` draws every object that is visible in any sub-view into every sub-view (see question 6).
- Each viewport may need its own shadow cascade.
- Each viewport's post chain has fixed costs (bloom mips, pass setup) that do not shrink with viewport size.

**Recommended composite**
- Render all viewports into one shared full-screen HDR target (scissored regions with a 2-4 px gutter, or clamp UVs to each viewport rect).
- Run one full-screen post chain instead of N per-viewport chains. Bloom, vignette and speed lines must use per-viewport UV rects so they do not bleed across seams.
- This should save the most at 4 viewports.

**Upscaling to 4K**
- macOS on a 4K TV usually runs HiDPI "looks like 1920×1080" with `devicePixelRatio` = 2. Rendering the canvas at DPR 1 (1080p backing store) and letting the browser compositor scale it up is effectively free bilinear upscaling.
- **WebGL:** add a cheap GLSL EASU+RCAS (FSR1) or CAS sharpening as the final 4K pass. AMD FidelityFX FSR1 is MIT-licensed, which suits a commercial product (verify the license file).
- **WebGPU:** use TAAU at `resolutionScale` 0.5-0.75 of 4K output (that is, 1080p-1620p internal).
- **Dynamic resolution:** keep the current controller, but drive it from GPU time (WebGPU timestamp queries, or `EXT_disjoint_timer_query_webgl2` where available) rather than fps. The current lowFps=55 trigger reacts only after frames have already been missed.

### Gaps
- I found no measured three.js racing or 4K benchmarks on an M1 (any renderer), and no published per-pass ms costs. The budget table is an estimate and needs an on-device profiling pass. Suggested scene: the existing track with 1, 2 and 4 viewports, logging `renderer.info` draws and triangles plus GPU timer queries.
- `EXT_disjoint_timer_query_webgl2` availability in Chrome on macOS was not verified.
- I found no source on browser compositor scaling quality or cost for a DPR-1 canvas on a 4K HiDPI display.

## 5. Draw-call / CPU reduction techniques

### Takeaway
Draw count is the main CPU cost on both renderers, and WebGPURenderer currently pays roughly twice as much per draw. Use InstancedMesh for repeated trackside props, BatchedMesh for unique static scenery, a per-track chunk system with LOD and frustum culling, KTX2 textures and texture arrays to cut material and state changes. GPU-driven indirect draws and compute culling only work on the WebGPU backend.

### Cited Findings
- **BatchedMesh on WebGL** uses the `WEBGL_multi_draw` extension (`renderMultiDraw`), so a whole batch is one API call. — local source, [WebGLIndexedBufferRenderer.js r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLIndexedBufferRenderer.js)
- **BatchedMesh on the WebGPU backend** loops `drawIndexed()` once per sub-geometry inside the same pipeline and bind group, using `firstInstance` as the index. There are no state changes between sub-draws, but it is not a single multi-draw call. — local source, [WebGPUBackend.js r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPUBackend.js)
- The WebGPU backend supports `drawIndexedIndirect` (examples: `webgpu_struct_drawindirect`) and indirect compute dispatch. Indirect draws are WebGPU-backend only. — local source; [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide); [threejs.org examples index](https://threejs.org/examples/files.json)
- WebGPU occlusion queries exist (`webgpu_occlusion` example). They "can not be recorded into render bundles" (backend warning). — local source; [threejs.org examples index](https://threejs.org/examples/files.json)
- Both renderers have KTX2 and compressed array-texture examples (`webgpu_loader_texture_ktx2`, `webgpu_textures_2d-array_compressed`). — [threejs.org examples index](https://threejs.org/examples/files.json)
- r186 adds `ClusteredLightsNode` (many dynamic lights, for example headlights and night races) and `TileShadowNode` / CSM shadow nodes for WebGPURenderer. — local source, [three.js r186 tsl/lighting and tsl/shadows](https://github.com/mrdoob/three.js/tree/r186/examples/jsm/tsl)
- donmccurdy: batching and instancing matter more than which API you use; recommends BatchedMesh or a merged BufferGeometry. — [three.js forum 86635](https://discourse.threejs.org/t/understanding-about-webgpurenderer/86635/5)
- A per-object uniform buffer and bind group per mesh is the suspected source of WebGPURenderer's per-draw CPU cost. — [three.js forum 91904](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904); [forum 77629](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629)

### Inferences
- **Track content pipeline:**
  - Split each track into chunks of about 100-200 m along the spline.
  - Per chunk: one merged or BatchedMesh draw for static road, kerbs and barriers per material, and InstancedMesh for trees, cones, fences, lights and crowds.
  - Add distance LOD (tri-planar or impostor billboards for far trees and grandstands) and per-viewport frustum culling of chunks with a precomputed potentially-visible-set (PVS) along the spline.
  - A 5.9 km Monza-style track would be about 30-60 chunks. Only about 5-10 are visible per viewport.
- **Materials:** a shared atlas or texture array per material class (asphalt, kerb, concrete, foliage) lets BatchedMesh merge more objects. Use KTX2 everywhere to stay within the texture budget on 16 GB unified memory (shared by the CPU, the GPU and the browser).
- **Shaders:** precompile (`renderer.compile` / `compileAsync`) during the loading screen. The WebGPU path has a 5-10x worse cold first frame (forum 91904), which would otherwise hitch at race start.

### Gaps
- I found no published numbers comparing BatchedMesh draw throughput between the two renderers on Apple Silicon.
- `WEBGL_multi_draw` availability in Chrome/ANGLE on macOS was not verified.

## 6. Multi-viewport split-screen rendering patterns and per-viewport post cost (WebGL vs WebGPU)

### Takeaway
On WebGL, the proven pattern is per-view `setViewport` plus `setScissor` plus render, and that is what Split Ways does today. On WebGPURenderer the same pattern exists, but RenderPipeline with multiple viewports had open bugs as of r184/r185 (one fix lands in r187). WebGPURenderer also offers `ArrayCamera`, which renders all sub-viewports in one render pass with a single scene traversal. That saves CPU, but every object visible in any sub-view is drawn in all sub-views. Cutting post-processing from N chains to one shared full-screen chain is the biggest saving available on either renderer.

### Cited Findings
- The `webgpu_camera_array` example says: "Array cameras allow to render the scene with multiple sub cameras but with a single render call." Each sub-camera has a `viewport` Vector4. — [webgpu_camera_array](https://threejs.org/examples/webgpu_camera_array.html)
- In the r186 WebGPU backend, for an ArrayCamera, each render object loops over the sub-cameras, calls `pass.setViewport()`, binds a per-camera index bind group and draws. Render bundles cannot set a viewport. — local source, [WebGPUBackend.js r186](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPUBackend.js)
- Frustum culling for an ArrayCamera uses `FrustumArray.intersectsObject`, which returns true if the object intersects any sub-camera frustum. — local source, [FrustumArray.js r186](https://github.com/mrdoob/three.js/blob/r186/src/math/FrustumArray.js)
- The classic per-view scissor pattern is shown for WebGPU in `webgpu_multiple_elements`. — [webgpu_multiple_elements](https://threejs.org/examples/webgpu_multiple_elements.html)
- RenderPipeline ignores per-view viewport/scissor on the WebGPU backend (r184, June 2026). Render-target viewport/scissor bug fixed for r187. Negative scissor coordinates are rejected. — [forum 92444](https://discourse.threejs.org/t/renderpipeline-does-not-support-split-screen-multiple-viewports-with-webgpu-backend/92444); [GitHub #34671](https://github.com/mrdoob/three.js/issues/34671); [GitHub #30450](https://github.com/mrdoob/three.js/issues/30450)
- The WebGL composer has a long-standing [OLDER, 2014] issue with viewport/scissor in EffectComposer. Split Ways sidesteps it with its own per-viewport pipeline. — [GitHub #5979](https://github.com/mrdoob/three.js/issues/5979)

### Inferences
- **ArrayCamera trade-off for a racing game:**
  - Opponents and track chunks near a player are often visible in several views, so the union-cull overdraw cost is moderate.
  - Rear-facing geometry for one player can be ahead of another player. Union culling then sends it through the vertex stage for all views; the GPU clips it, but the vertex cost remains.
  - With 4 players spread around a 5.9 km track, per-viewport culling (classic loop) will usually submit fewer triangles. ArrayCamera will submit fewer CPU-side traversals.
  - Prototype both.
- **Temporal effects with ArrayCamera are unverified.** TRAA, TAAU and motion blur take a single `camera`, and velocity uses previous-frame matrices. With split screen, each viewport needs its own jitter, history and reprojection.
- **Safest WebGPU split-screen design today:** render each viewport's scene pass into its own `PassNode`/render target (sized to the viewport), run temporal AA and upscaling per viewport, then composite into the canvas with a final full-screen node. This avoids the canvas viewport/scissor bugs entirely.
- **WebGL (current stack):** move from "post chain per viewport" to:
  1. Per-viewport scene render into scissored regions of one shared MSAA HDR target.
  2. A single bloom mip chain over the whole target, with per-viewport UV clamping.
  3. A single ACES/vignette/speed-lines/dither composite that reads a small uniform array of viewport rects.

  This keeps the scene draw cost at N× but makes post-processing cost about 1× instead of N×.

### Gaps
- I found no official three.js example of split-screen with RenderPipeline, nor of TRAA/TAAU with an ArrayCamera.
- I found no measurements comparing ArrayCamera with classic per-viewport loops in a game-like scene.
