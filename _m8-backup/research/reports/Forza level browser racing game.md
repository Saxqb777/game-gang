# Make Split Ways Worth a Monthly Pass

Forza-level looks and sim-lite feel look achievable in the browser on a MacBook Air M1 driving a 4K TV at a locked 60 fps, but only if the build follows a strict recipe, and every budget here is an estimate until M8 profiling proves it on the device. Render at about 1080p internally and upscale. Stay on three.js WebGLRenderer r186 until WebGPU's split-screen bugs and per-draw overhead are fixed. Bake most of the lighting. Spend detail where a racing camera actually looks: car paint and reflections, road and kerbs, tree lines. The feel comes from replacing Rapier's raycast-vehicle friction with a per-wheel tyre model built from Speed Dreams' open formulas and car specs, plus assists that are on by default and a floating drag-steer touch controller that players can use without looking at the phone. The business case rests on two facts from phone-controller platforms: the host pays and one subscription unlocks the room for everyone, and subscribers spend about half their playtime in one favourite game. So one excellent racer with a monthly content drop beats a wide catalogue. The biggest risks are not about rendering. No free, realistic, original-design car model was found, so free models will need in-house rework. The main (2018) AirConsole Hero review criticised frustrating free-movement touch games, along with clones and lag. Legal hygiene (no real names, Free Art License share-alike on Speed Dreams data, no Speed Dreams sounds) has to be built in from the start. Free party gaming on TVs is spreading, so the paid product must win on depth, visual quality and polish. The build plan ships three original tracks first: a 3.3 km club circuit, a 5.9 km fast autodrome and a 3.8 km mountain road. Each one introduces one major system: the track generator and performance foundation, then vegetation and the lighting bake, then elevation terrain. Feel, cars, the premium UI and the paywall come after that.

> Scope note: every owner decision is applied throughout. That means no item pickups, no desert, UAE or "Corniche" theme, touch-only controls, fictional car brands built from free commercially usable models, Speed Dreams 1.4 data used as a starter kit only, a locked 60 fps with automatic presets on 1080p and 4K TVs, the M1 Air 16 GB plus 4K TV as the reference device, and a monthly subscription. Where a researcher suggested otherwise, the suggestion has been dropped.

## Render near 1080p, upscale to 4K, and stay on WebGL for now

The reference device sets hard limits. The M1's 8-core GPU delivers about **2.6 TFLOPS** ([Notebookcheck](https://www.notebookcheck.net/M2-10-Core-GPU-vs-M1-7-Core-GPU-vs-M1-8-Core-GPU_11368_10560_10552.247598.0.html)) and has **68 GB/s** of memory bandwidth, shared with the CPU ([technical.city](https://technical.city/en/gpu/Apple-M1-8-Core-GPU)). By our arithmetic, 60 fps leaves about **20.8k FLOP per pixel at 1080p but only 5.2k at native 4K**. One full-screen half-float pass moves about 33 MB at 1080p versus 133 MB at 4K, out of roughly 1.1 GB of bandwidth per frame. Every post pass scales with resolution ([three.js forum](https://discourse.threejs.org/t/performance-drops-at-higher-resolutions/52074)). Native 4K with Forza-style post-processing is not realistic on this machine.

### Resolution strategy
- Render internally at about 1080p. One player can rise to 1440p when there is headroom. Two and four players share 1080p in total (4 × 960×540 at four players).
- macOS usually drives a 4K TV in a HiDPI "looks like 1920×1080" mode with `devicePixelRatio` 2. This comes from forum reports, not Apple documentation ([MacRumors](https://forums.macrumors.com/threads/4k-monitor.2079449)). Render the canvas at DPR 1 so the browser compositor upscales it for free.
- Add a cheap FSR1-style EASU+RCAS or CAS sharpening pass. The r186 FSR1 node uses 12 + 5 taps and needs an anti-aliased input ([FSR1Node.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/FSR1Node.js)).
- HTML UI renders at native 4K, so menu and HUD text stays crisp over a 1080p-class 3D image.
- **1080p and 4K TVs share one budget.** A 1080p TV simply skips the upscale pass.

### Why not WebGPU yet
- **About twice the CPU cost per draw.** With 4,000 meshes, WebGLRenderer took 4.5 ms per frame and WebGPURenderer 9.7 ms. The cold first frame took 32 ms versus 167 ms (r183 benchmark, [three.js forum](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904)).
- **Split screen is the weak spot.** As of June 2026, `RenderPipeline` ignored per-viewport `setViewport`/`setScissor` on the WebGPU backend ([three.js forum](https://discourse.threejs.org/t/renderpipeline-does-not-support-split-screen-multiple-viewports-with-webgpu-backend/92444)). A related render-target bug is only fixed for r187 ([#34671](https://github.com/mrdoob/three.js/issues/34671)).
- **The port is real work.** `ShaderMaterial`, `onBeforeCompile` and `EffectComposer` do not run on WebGPURenderer ([Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)). After the M8 cleanup removes items (`scene/itemVisuals.ts`) and the Corniche sea (`scene/sea.ts`), four Split Ways files (about 21 call sites) would need a TSL rewrite: `postProcessing.ts`, `haze.ts`, `particles.ts` and `sceneryModels.ts` (repo grep).
- **What WebGPU would buy:** TAAU/TRAA with motion vectors, SSGI and denoised SSR ([r186 TSL display nodes](https://github.com/mrdoob/three.js/tree/r186/examples/jsm/tsl/display)). The WebGL TAA pass has no reprojection, so it only helps when nothing moves ([TAARenderPass.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/TAARenderPass.js)).
- **Browser support is not the blocker.** Safari 26 ([WebKit](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)) and Firefox 147 ([Firefox](https://www.firefox.com/firefox/147.0/releasenotes/)) now ship WebGPU on Apple Silicon, as Chrome already does.

**Decision:** stay on WebGLRenderer r186. Run a time-boxed WebGPU spike behind a flag. Migrate only when all three hold: the multi-viewport fixes ship in a release, a 4-viewport scene costs no more CPU than WebGL on the M1, and TAAU looks clearly better at 4K than MSAA plus upscaling.

### Frame budget
These are estimates to verify on the device. Targets: GPU at most 12–13 ms, main thread at most 8–10 ms including physics.

| Item | 1 viewport | 2 viewports | 4 viewports |
|---|---|---|---|
| Internal resolution | 1080p–1440p, dynamic | 1080p total | 4 × 960×540, floor ~0.7 |
| Draw calls per frame | ~1,000 | ~1,200 | ≤ ~1,500 |
| Visible triangles per viewport | 1.5–3M | 1–2M | 0.5–1M |
| Shadows | 2 cascades (2048² near, 1024² far) | 1024² per cascade | One shared map or per-car box; blob AO |
| Post effects | ~6–8 | ~5 | 3–4 (bloom, AA, grade) |
| GPU texture memory | < 1–1.5 GB, all KTX2 | same | same |

### Cut the per-viewport costs
- Render every viewport into one shared HDR target with scissored regions, then run a single post chain over it, clamping bloom and vignette UVs to each viewport. Post cost drops from N× to about 1×.
- Split tracks into 100–200 m chunks. Merge static geometry per material with `BatchedMesh`, which draws a whole batch in one `WEBGL_multi_draw` call ([three.js source](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLIndexedBufferRenderer.js)), and instance repeated props. Batching matters more than the choice of graphics API ([three.js forum, donmccurdy](https://discourse.threejs.org/t/understanding-about-webgpurenderer/86635/5)).
- Ship every texture as KTX2. Precompile shaders on the loading screen so the race start doesn't hitch.

### Automatic quality presets
Slow Roads, the best-documented web driving game, targets 60 fps, yet **only 52% of its players got above 55 fps**. It uses telemetry to point players to its settings ([web.dev](https://web.dev/case-studies/slow-roads)). Split Ways should do the same thing automatically.

| Preset | Used for | On | Off |
|---|---|---|---|
| High | 1 player | HDR, bloom, MSAA, half-res GTAO, 2-cascade sun shadows, baked reflection probes plus a time-sliced live reflection for own car, near-track grass | SSR, SSGI |
| Medium | 2 players | HDR, bloom, MSAA, baked AO, 1024² cascades, baked reflection probes | GTAO, live reflections |
| Low | 3–4 players | Bloom, FXAA/SMAA, per-car shadow box, blob AO, baked probes | Grass, AO passes |

- Choose the starting preset from the player count plus a short benchmark during loading. Keep the existing dynamic-resolution controller running inside each preset.
- Drive dynamic resolution from GPU time instead of fps. The current trigger (`lowFps: 55` in `client/src/games/splitways/config.ts`) only reacts after frames have already been missed.
- When resolution hits its floor, drop one preset between races, never during one.
- Send fps, GPU time, resolution and preset to the existing Neon backend, and tune the presets from real hardware.
- The Air has no fan, so a short test proves nothing. Soak-test four viewports at 4K for at least 30 minutes.

**Gap:** no one has published per-pass millisecond costs for three.js on an M1. Every number above stays an estimate until the first profiling pass.

## Paint, reflections and a car-relative camera sell the cars

### Car paint and materials
Build on `MeshPhysicalMaterial`. The official three.js car example uses clearcoat 1.0 with clearcoatRoughness 0.03 and ACES tone mapping ([three.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_car.html)).

- **Metallic paint:** metalness 0.6–0.85, roughness 0.30–0.45, clearcoat 1, clearcoatRoughness 0.02–0.04.
- **Flakes:** put a flake normal map on the base layer (the official example uses normalScale 0.15, [three.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_physical_clearcoat.html)) and keep the clear coat smooth.
- **Orange peel:** a very weak `clearcoatNormalMap`, which perturbs only the coat ([PR #17079](https://github.com/mrdoob/three.js/pull/17079)).
- **Fade flakes with distance.** Real flakes are far smaller than a pixel, so at range they shimmer or average out to flat.
- **Colour flop:** add a view-angle colour shift through `onBeforeCompile`, as the 2025 three.js car-paint demo does with Voronoi flakes and noise-based orange peel ([GitHub](https://github.com/Faraz-Portfolio/demo-2025-car-paint)). This keeps the project's custom fog chunks working.
- **TSL is an option:** r186 can run node materials inside WebGLRenderer ([webgl_tsl_clearcoat](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_tsl_clearcoat.html)). It is new, so test it against the HDR pipeline before relying on it.
- **Glass: never use `transmission`.** For every camera that sees a transmissive object, r186 renders an extra opaque pass into a per-camera target ([WebGLRenderer.js](https://github.com/mrdoob/three.js/blob/dev/src/renderers/WebGLRenderer.js)). At four viewports that is up to four extra scene renders. Use dark clearcoated glass, or alpha glass for bumper cams.
- **Other surfaces:**
  - Chrome: metalness 1, roughness 0.02–0.08.
  - Rims: roughness 0.2–0.35.
  - Brake discs: anisotropy plus an emissive heat glow driven by brake temperature.
  - Tyres: roughness 0.85–0.95 with near-black albedo, and our own fictional tyre brand in a shared sidewall atlas.

### Reflections: layer them
Forza Motorsport 7 kept dynamic cube maps for Xbox One X and PC to "seat the cars in the world" ([GamingBolt](https://gamingbolt.com/forza-motorsport-7-features-dynamic-cube-mapping-exclusively-on-xbox-one-x)). The 2023 game uses ray tracing ([GamingBolt](https://gamingbolt.com/forza-motorsport-graphics-analysis-a-new-visual-benchmark-for-racing-games)). Even there, lowering its cube-map setting "notably" raises frame rates ([OC3D](https://overclock3d.net/reviews/software/forza-motorsport-pc-performance-review-and-optimisation-guide/4/)). A naive per-car, per-frame cube update would mean 24 extra scene renders a frame at four cars, which is impossible here.

- **Base layer (every preset):** the HDRI environment (PMREM), plus a fake asphalt lower hemisphere so sills reflect road instead of sky. It is the fallback wherever no probe covers the car.
- **Baked probes (every preset, including Low):** reflection probes baked along the track spline every 75–150 m when the track loads (`PMREMGenerator.fromScene`, 256 px by default, [three.js](https://github.com/mrdoob/three.js/blob/dev/src/extras/PMREMGenerator.js)). Each car blends between its nearest probes. Zero per-frame cost, so the 3–4-player Low preset keeps them.
- **High (1 player) only:** one time-sliced live cube for the player's own car; other cars keep the baked probes. It renders one face per frame at 128–256 px and refreshes every 100 ms.
- **Skip SSR in split screen.** It misses off-screen content, which is most of what a car body reflects.
- **Diffuse light:** r186's `LightProbeGridWebGL` bakes an irradiance grid on the GPU, so cars darken in tunnels and under trees ([three.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/lighting/LightProbeGridWebGL.js)).

### Lights
- Make car lights emissive values above 1.0 that feed the HDR bloom, not real lights. Suggested values: brake lights at 6–10 ramping in over ~50 ms, tail lights at 1.5–2.5.
- Add a glow sprite with a minimum on-screen size so distant cars stay readable.
- Draw lens flares in the composite pass. The stock `Lensflare` addon copies from the framebuffer ([three.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Lensflare.js)), which likely clashes with the multisampled HDR target. That clash is untested.

### Model budgets and liveries
| LOD | Distance | Triangles | Draw calls |
|---|---|---|---|
| 0 | Own car, or < 15 m | 40–80k | ≤ 8–10 |
| 1 | 15–60 m | 12–20k | 4–6 |
| 2 | 60–150 m | 3–6k | 2–3 |
| 3 | > 150 m | < 1k | 1 |

- Choose LODs per viewport, using the distance to that viewport's camera.
- Do not upgrade the 4–6k-triangle Speed Dreams meshes. Use their dimensions and specs only.
- **Liveries:** give each body a non-overlapping livery UV set. At runtime, composite a 2048² texture per car from our own SVG layers (stripes, numbers, fictional sponsors) and read it under the clear coat. This avoids `DecalGeometry`, whose projections distort around corners ([three.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/DecalGeometry.js)).

### Cameras
Smooth the camera in the car's own frame, never in world space. Browser projects measured world-space lag leaving the camera **about 4 m too far back at 120 km/h** ([GitHub](https://github.com/ashciraulo/500/pull/20)) and **about 9 m at 220 km/h** ([GitHub](https://github.com/Noisemaker111/jgengine/pull/1802)).

- **Chase cam starting values** (to tune by playtest):
  - Distance 5.5–6.5 m, rising to 6.5–7.5 m at top speed. Height 1.6–2.0 m.
  - Vertical FOV 55–60°, rising by 8–15° at top speed over 0.3–0.5 s (slow enough to avoid motion sickness on a big TV).
  - Critically damped springs set by half-life ([Allen Chou](https://allenchou.net/2015/04/game-math-precise-control-over-numeric-springing)) on yaw, height and distance.
  - Look-ahead toward the track spline 20–40 m ahead. Having the spline is a big advantage over generic look-ahead.
- **Shake:** Eiserloh's "trauma" model, where shake = trauma² × Perlin noise, decaying over about a second ([Game Developer](https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math)). Feed it from kerbs, impacts and very high speed, and mirror it with phone haptics.
- **Other cameras:** a bumper cam (FOV 65–75°) for pro players. Defer the cockpit cam, since it needs interiors and roughly doubles LOD0 cost.
- **TV replay cams:** camera nodes every 150–300 m and at each apex, fed by car transforms recorded at 30–60 Hz.

## Generate the drivable corridor, bake the light, dress the edges

### One source of truth: a trackgen in the repo
GT7 spends at least six months per track and takes up to 80,000 photos per circuit ([GTPlanet](https://gtplanet.net/how-gran-turismo-is-made)). We cannot scan. The achievable "Forza-like" bar is: a generated corridor, plus real or synthetic terrain, plus CC0 PBR textures, plus a good lighting bake.

1. **Parse** a Speed Dreams XML layout into a typed track definition. The format gives segments, radii, elevation, banking, kerbs and barriers ([TORCS track manual](https://torcs.sourceforge.net/api/track_manual.html)).
2. **Integrate** a centre line sampled every 0.5–1 m, with banking and elevation. Distribute the closure error around the lap.
3. **Override, don't edit.** Changes to width, elevation, kerbs or layout go in a small JSON file, so the Speed Dreams data stays a starter kit rather than a ceiling.
4. **Loft the corridor** (road, run-off, kerbs, barriers) in 100–200 m chunks, using r186's new `LoftGeometry` ([three.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/geometries/LoftGeometry.js)) or the existing `trackGeometry.ts`.
5. **Emit the physics mesh from the same stations,** with a surface ID per triangle for grip, rumble, audio and haptics. TORCS warns that hand-editing the road mesh breaks physics alignment ([TORCS](https://torcs.sourceforge.net/api/track_manual.html)).
6. **Generate terrain:** a heightfield blended into the corridor edge over a 10–30 m shoulder, plus placement rules for trees, tyre walls, boards and marshal posts.
7. **Dress and bake in Blender (headless):** grandstands, pit buildings and lightmaps only. Never edit the corridor in Blender.
8. **Package** with gltf-transform and KTX2, plus a track manifest (sky, fog, sun and shadow settings).

Once the generator exists, a new track is a JSON override, a placement-rule tune and an overnight bake: days, not months. **The generator is the main engineering investment and the engine of a monthly content cadence.**

### Road, kerbs and terrain
- **Road:** track-space UVs (u across, v along the lap), a CC0 asphalt detail set, a macro variation texture, and an RGBA "track mask" (rubber line, paint, marbles, wetness).
  - At 0.5 m per texel a 5.9 km lap is about 11,800 texels long, above the 8,192 limit. Fold the mask into rows or split it per chunk.
  - Generate the rubber line automatically from the racing line.
- **Kerbs:** loft them from the XML `curb` borders. Use real sawtooth geometry and stripes from a 1D texture so they follow curvature exactly.
- **Terrain splats:**
  - Four layers cost 8 texture fetches per pixel, and a 2026 browser study judged a fifth layer not worth it ([Cinevva](https://app.cinevva.com/blog/2026-02-25-open-world-browser-part-05-budgeting-the-pretty)).
  - Start anti-tiling with a cheap macro variation texture.
  - Use triplanar mapping only on steep slopes, and hex tiling only on grass and gravel. Combining hex tiling with triplanar can reach **27 fetches per map** ([cprimozic](https://cprimozic.net/blog/tools-and-techniques-for-procedural-gamedev/)).

### Vegetation where the camera looks
At 55–85 m/s, anything within 10 m of the camera flashes by. What sells the scene is tree lines and bush belts 20–300 m out, plus believable ground at the track edge.

- **Trees:**
  - `InstancedMesh2` with BVH culling and per-instance LOD, plus octahedral impostors beyond about 100 m. A 2025 demo ran **200k trees** this way, with no fps figure given ([three.js forum](https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735)).
  - The impostor library is MIT-licensed but marked work-in-progress ([GitHub](https://github.com/agargaro/octahedral-impostor)).
- **Grass:** instanced clump quads within 0–25 m (0–12 m at four players). A commercial WebGPU grass system reports a locked 60 fps at 1440p on an M1 Mac ([three.js forum](https://discourse.threejs.org/t/migrating-my-grass-system-to-webgpu-and-making-a-robust-grass-plugin/92893)).
- **Leaf edges:** with the MSAA target, use alpha-to-coverage with sharpened alpha ([Golus](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f)).
- **Per-track targets** (estimates, at one viewport):
  - 5–30k trees, mostly impostors.
  - 20–50k instanced props.
  - Fewer than 300 static draw calls after batching.
  - Fewer than 60 vegetation draw calls per viewport.

### Sky, shadows and baked light
- **Sky:**
  - r186's `Sky` is an analytic Preetham sky that now includes procedural clouds ([Sky.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/objects/Sky.js)).
  - Use a CC0 HDRI for fixed-time-of-day hero races.
  - Defer the takram Bruneton atmosphere. It is beta, needs the pmndrs post stack, and its post-process mode supports only Lambert shading ([README](https://unpkg.com/@takram/three-atmosphere@0.13.2/README.md)).
  - Tint the fog toward the sun to get atmospheric perspective cheaply ([Inigo Quilez](https://iquilezles.org/articles/fog/)).
- **Shadows:**
  - Use r186's `SunLight`: 2 cascades at 1024² by default, wired into the core shaders ([SunLight.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/lights/SunLight.js)). `PCFSoftShadowMap` is deprecated in r186 ([constants.js](https://github.com/mrdoob/three.js/blob/r186/src/constants.js)).
  - Cascades re-render for every viewport. Limit shadow casters to cars, near trees and props, and keep the shadow range to 150–250 m.
  - In a browser study on Intel integrated graphics, three 1024² cascades stayed under 2 ms ([Cinevva](https://app.cinevva.com/blog/2026-02-25-open-world-browser-part-05-budgeting-the-pretty)).
  - Put a blob AO quad under every car.
- **Baked light:**
  - Ship 2–3 fixed time-of-day presets per track (for example morning, golden hour, overcast), each baked in Blender Cycles into a second UV set.
  - Encode them as KTX2 UASTC HDR, which r186's loader supports ([KTX2Loader.js](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/KTX2Loader.js)).
  - A 5.9 km corridor 60 m wide needs only about two 1024² lightmap pages at 0.5 m per texel.
  - Live time of day can come later through an AO-only bake.
- **Detail priority at racing speed:**
  1. Road and kerbs.
  2. The first barrier line.
  3. Corner and distance boards.
  4. Tree lines and grandstands.
  5. Everything else.

  Automate LODs as Forza did: Turn 10 aimed to auto-generate 90%+ of its track LODs ([Simplygon](https://simplygon.com/posts/5f1e97cd-b9e9-4746-b669-d6d6e893b662)).

## Free assets cover the world; cars, engines and names need care

### What free sources cover
- **Environment:** fully covered by CC0.
  - Poly Haven has 521 models, 997 HDRIs and 867 textures, all CC0 and usable "in a product you sell" ([Poly Haven](https://polyhaven.com/license)). That includes pine, fir, shrub, rock and cliff sets ([API](https://api.polyhaven.com/assets?t=models)). Its terms ban scraping, so use the API.
  - ambientCG adds 2,014 CC0 materials, including 78 asphalt sets ([ambientCG](https://docs.ambientcg.com/license/); [API](https://ambientcg.com/api/v2/full_json?type=Material&q=road&limit=30)).
- **Cars (owner decision: free models, fictional brands):** this is the hard part.
  - CC0 packs such as Kenney's Car Kit are stylised ([itch.io](https://kenney-assets.itch.io/car-kit)).
  - Khronos' "CarConcept" is CC BY 4.0 but carries Khronos logos that must be removed ([Khronos](https://github.khronos.org/glTF-Assets/model/CarConcept)).
  - CC-BY Sketchfab models need a credit line ([Sketchfab](https://help.sketchfab.com/en/articles/16152215-crediting-users-for-3d-model-downloads)).
  - The research found **no verified free, realistic, original-design car with LODs**, and most realistic free models are real, trademarked cars.
  - So budget in-house art time per car: reshape away from any real silhouette, remove badges, split the materials, add a livery UV set and generate LODs.
  - Reject any model of a real car even when it is CC-BY. CC BY 4.0 says "trademark rights are not licensed" ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en)).
- **Engine and tyre sound:**
  - CC0 Freesound recordings, such as the V8, V10 and V12 fly-bys that Speed Dreams credits ([SoundCredits](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/data/data/sound/SoundCredits.txt)), need cutting into steady loops.
  - The Sonniss GDC bundles are royalty-free with no attribution, but ban AI training ([Sonniss](https://sonniss.com/gameaudiogdc/)).
  - Paid loop packs have contradictory licence wording ([itch.io](https://magicsoundeffects.itch.io/car-engines-vol-2)). Get written confirmation before buying.
- **Fonts:** OFL fonts are fine in a paid product if the licence text ships with them. Subsetting counts as modification, which affects Reserved Font Names ([OFL FAQ](https://openfontlicense.org/ofl-faq/)).

### Speed Dreams: use the data, not the code or sounds
- **Free Art License 1.3** allows commercial use. Copies and modified versions must keep the licence, name the authors, say where the originals are, and stay under FAL or a compatible licence ([FAL 1.3](https://artlibre.org/licence/lal/en/)). Creative Commons lists FAL 1.3 as BY-SA 4.0-compatible ([CC](https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/)).
- **Do not assume every 1.4 file is FAL.** The README says some assets carry other licences, kept in their own directories ([README](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/README.md)). The licence of each of the 29 track layouts and the car setups in the 1.4 kit is unverified, some data may be GPL "functional data", and it is unknown whether some SD tracks copy real circuits. Check each track's or car's licence file before deriving from it, and record it in the licence log.
- **Ship derived data separately:** track JSON and car spec files as separate files under an FAL header, never baked into proprietary bundles. That keeps our own code and art outside the share-alike. This is our reading of FAL §3–4; no court has tested it.
- **Do not port Speed Dreams code.** It is GPLv2-or-later ([README](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/README.md)). Translating the physics into TypeScript would put the browser client under the GPL. Re-implement from the published equations instead.
- **Do not ship any Speed Dreams sound.** Many files are named after real cars ("ferrarif355.wav", "mclarenf1.wav") and have no documented provenance ([repo listing](https://forge.a-lec.org/api/v1/repos/speed-dreams/speed-dreams-data/contents/data/data/sound)).

### Names, shapes and jurisdictions
| Risk | Rule |
|---|---|
| "Forza" is a Microsoft game trademark ([CIPO](https://ised-isde.canada.ca/cipo/trademark-search/1956936)) | Never in the product name, store copy, ads or public URLs. Keep "Forza level" as an internal label only. |
| Circuits license their likeness (Laguna Seca is licensed to Forza, GT and iRacing, [WeatherTech](https://weathertechraceway.com/blogs/news/weathertech-raceway-laguna-seca-accelerates-global-brand-growth-through-expanded-licensing-agreements)) | Invented names and changed layouts. Do not reproduce Rudskogen's 3.254 km, 14-turn layout ([Wikipedia](https://en.wikipedia.org/wiki/Rudskogen)) or Monza's corners. |
| Car shapes | US courts protected realistic Humvees under the Rogers test ([Finnegan](https://www.finnegan.com/en/insights/blogs/incontestable/in-legal-warfare-over-humvee-trademarks-the-first-amendment-goes-beyond-the-call-of-duty-in-dismissing-am-generals-claims.html)), but *Jack Daniel's* narrowed that defence ([Wikipedia](https://en.wikipedia.org/wiki/Jack_Daniel%27s_Properties,_Inc._v._VIP_Products_LLC)), and it is US-only. Ferrari's GTA IV claim relied on EU registered designs ([IBA](https://www.ibanet.org/ip-july-2021-3d-object-video-games-ip)). Blend features from several cars; never copy an iconic silhouette. |
| Logos inside downloaded assets | Strip them all and use fictional sponsors and tyre brands. |
| Global audience | Assume the strictest regime (EU designs, UAE trademark law). Run one clearance search of brand, car and track names in the UAE, US, EU and UK before launch. |

Placeholder track names from the research ("Brackenridge Club Circuit", "Valdoro Autodromo", "Kestrel Pass") are fine for development, pending that search.

### Shipping and hosting
- **Meshes:** glTF with meshopt, which is gltf-transform's default and decodes faster than Draco ([gltf-transform](https://gltf-transform.dev/cli)).
- **Textures:** KTX2, with ETC1S for colour and UASTC for normal and roughness maps. In Khronos' lamp example, GPU memory fell from 96 MB to 21 MB ([Khronos](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)).
- **Download targets:** at most ~15–20 MB before the lobby, 30–60 MB per track streamed while players join, and at most ~250 MB in total for v1. These are our targets, informed by CrazyGames' 50 MB initial-download cap ([CrazyGames](https://docs.crazygames.com/requirements/technical)).
- **Caching:** content-hashed URLs with `max-age=31536000, immutable` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)), plus a service worker that pre-caches the next track.
- **Hosting:**
  - Vercel Hobby is "for personal, non-commercial use". Pro is $20/month with 1 TB included, then from $0.15/GB ([Vercel](https://vercel.com/pricing)).
  - Cloudflare R2 egress is free ([Cloudflare](https://developers.cloudflare.com/r2/pricing/)), and its terms allow large files served from R2 ([Cloudflare](https://blog.cloudflare.com/updated-tos/)).
  - At 100k monthly TV hosts each downloading ~150 MB, Vercel bandwidth alone would run roughly $2,100–4,900/month by our arithmetic. **Keep the app and API on Vercel Pro and serve `/assets` from R2.**

## Web rivals win on handling; party platforms win on one great game

### The visual bar on the web
- **three.js on WebGPU and TSL sets the 2025–2026 bar.** Bruno Simon's portfolio "automatically runs on WebGPU when available" ([Awwwards](https://www.awwwards.com/brunos-portfolio-case-study.html)).
  - "threejspunk" (September 2026) is a full WebGPU/TSL racing game with rain, reflections and multiplayer.
  - Players called it "beautiful" with "great handling" but "repetitive" ([three.js forum](https://discourse.threejs.org/t/free-game-cyberpunk-inspired-game-realistic-graphics/94779)).
- **Unity 6.6 made WebGPU web builds production-supported** in September 2026 ([Cinevva](https://app.cinevva.com/news/2026-09-01-unity-6-6-webgpu-production)). That makes it a credible rival engine, but not a reason to switch from three.js and React.
- **The most-played web racers win on instant play and handling, not looks.** Examples are Madalin Stunt Cars 2 on Unity WebGL ([CrazyGames](https://www.crazygames.com/es/game/madalin-stunt-cars-2)) and PolyTrack on three.js plus Ammo.js ([itch.io](https://itch.io/t/3293744/how-did-you-do-this)).
- **Where Split Ways can stand out:** none of these ships four-player couch split screen with phone controllers at a locked 60 fps on an ordinary laptop. The threejspunk feedback is a warning: looks without variety get called repetitive.

### How phone-controller platforms make money
- **AirConsole Hero:**
  - The free tier is a weekly selection of games, "2 players maximum, with ad breaks" ([Microsoft Store](https://microsoft.com/store/p/airconsole/9nblggh4wk46)). The ads are AirConsole's own Hero promos.
  - "Only one AirConsole Hero player needed per session."
  - A July 2026 App Store snapshot lists Hero Monthly at **$7.99** ([App Pricing Lab](https://apppricinglab.com/iap/apple/1017688554)).
- **Developer payouts:** AirConsole splits each subscriber's revenue by the games they played, and says a subscriber typically spends **about half their playtime in one favourite game** ([AirConsole](https://developers2.airconsole.com/airconsole-hero-and-revenue)).
- **Exclusive content rules:** Hero content may add variety or convenience, never a "mechanical advantage" ([AirConsole](https://developers.airconsole.com/hero-exclusive-content)).
- **Jackbox:** sells annual $29.99 packs ([Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack)), is now on Netflix, and is launching a free, ad-supported smart-TV service ([CloudDosage](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/)). Party gaming on the TV is becoming free.
- **Why platforms disappoint:** the main AirConsole Hero review praised its few standout games but criticised clones, "frustrating" free-movement games on touchscreens, and lag. It recommended Jackbox instead ([CGMagazine, 2018](https://www.cgmagonline.com/reviews/air-console-hero-review/)).

### What this means for Gamer Gang
- **The host pays; guests join free.** The main promise is "One pass unlocks the whole room."
- **The flagship is the product.** Subscribers concentrate on one game, so Split Ways quality drives retention more than catalogue size does.
- **Monthly subscription, monthly drops.** A monthly plan needs something new every month: a track, a car pack or a championship. The track generator makes that affordable.
- **Free tier:** Track 1 with up to two players at full visual quality. The visuals are the advertisement, so don't degrade them.
- **Paid tier:**
  - All tracks and cars, three- and four-player split screen.
  - Championships, ghosts and leaderboards (lap posting already exists).
  - The livery editor, and every new drop.
  - Cosmetics belong to the subscriber; content unlocks for the whole room. No paid performance.
- **Price:** start at about $6.99/month and test against $7.99. Benchmarks are Apple Arcade at $6.99 ([Apple](https://www.apple.com/apple-arcade/)), AirConsole Hero at $7.99 (in a July 2026 App Store snapshot; official price unconfirmed), and Game Pass Essential at $9.99 ([GamesBeat](https://gamesbeat.com/xbox-upgrades-game-pass-tiers-and-raises-the-ultimate-price/)).
- **Trial:** about 3–4 weeks, so it spans at least two game nights. In mobile data, trials of 17–32 days convert **42.5%** versus 25.5% for trials of 4 days or less ([SaaStr on RevenueCat](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)). That is mobile, all-category data, so test it.
- **Checkout:** never type card details on the TV. Show "Scan to subscribe" with a QR code that opens checkout on the phone.

## A real tyre model replaces the grip hacks

### Why the current car feels "on rails, then sliding"
- **Rapier's vehicle controller** is a port of Bullet's `btRaycastVehicle` ([Rapier docs](https://rapier.rs/docs/user_guides/javascript/vehicle_controller/)).
  - It has no wheel-spin state, no slip ratio and no slip-angle force curve.
  - Its lateral grip is a constraint that cancels sideways velocity until a friction cap, then saturates ([Rapier source](https://github.com/dimforge/rapier/blob/master/src/control/ray_cast_vehicle_controller.rs)).
- **The current build compensates** with gravity set to 13 instead of 9.81, a yaw limiter and slide alignment. That gives about **2.6 g of peak cornering grip** (`DECISIONS.md`). These are arcade fixes, not sim-lite.

### The model
- **Keep Rapier** (0.21.0, September 2026, [npm](https://www.npmjs.com/package/@dimforge/rapier3d-compat)) for the chassis, collisions and suspension raycasts.
- **Zero its friction** (`frictionSlip` 0, untested) and apply our own tyre forces with `addForceAtPoint` ([Rapier API](https://unpkg.com/@dimforge/rapier3d-compat@0.21.0/dist/dynamics/rigid_body.d.ts)).
- **Per wheel, per substep:**
  1. Spring-damper load Fz.
  2. Integrate wheel spin from drive, brake and tyre torque, clamped so it never oscillates through zero.
  3. Compute slip ratio and slip angle, normalise them by their peaks, and combine them.
  4. Apply one simplified Magic Formula with load-sensitive grip.
- **Speed Dreams publishes the mapping** from its car XML to this curve ([simuv5 wheel.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/wheel.cpp)):
  - C = 2 − (2/π)·asin(dynamic friction), B = stiffness / C, E = elasticity factor.
  - Grip falls with load between factors of 1.6 and 0.8.
  - For the starter-kit car ([sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)), the curve peaks near 0.16 combined slip by our calculation.
- **Timing:**
  - Rapier at 120 Hz with 2–4 tyre substeps (240–480 Hz). Speed Dreams runs its physics at 500 Hz ([raceman.h](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/interfaces/raceman.h)).
  - Interpolate rendering between physics states, and cap catch-up at four steps.
  - Four cars × four wheels × 480 Hz is about 7,700 tyre evaluations a second, which should be light work for V8. That is an estimate: neither the tyre loop nor Rapier at 120 Hz with four cars on a track mesh has been benchmarked on an M1, so profiling must measure both.
- **Drivetrain:** each Speed Dreams car reduces to about a 25-number JSON spec covering torque curve, gears, final drive, mass, weight split, aero and springs ([engine.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/engine.cpp); [aero.cpp](https://forge.a-lec.org/speed-dreams/speed-dreams-code/src/branch/main/src/modules/simu/simuv5/aero.cpp)). Treat the kit as a start: add classes and tune specs beyond it.
- **Slipstream:** keep it, and model it as real drag reduction behind another car, as Speed Dreams does.
- **What to leave out:** tyre temperature, wear and camber thrust. Keep load sensitivity, because it is what makes weight transfer change the car's balance.
- **Return gravity to 9.81** once real grip exists.

### Assists, on by default
Shipping sims build assists as small controllers on top of the real tyre model:
- Gran Turismo 7 has countersteer assistance and braking-based stability management ([GT7 manual](https://gran-turismo.com/us/gt7/manual/drivingoption/03)).
- Forza Motorsport offers braking, throttle, steering, traction, stability and shifting assists ([GGRecon](https://www.ggrecon.com/guides/forza-motorsport-difficulty-settings-drivatar-driving-assists)), plus configurable audio cues for blind players ([Windows Central](https://windowscentral.com/gaming/forza-motorsport-2023-is-taking-accessibility-seriously-with-blind-driving-assists)).

Each assist and how to build it:
- **ABS:** per wheel, hold brake slip near the curve's peak.
- **Traction control:** a PI controller trims engine torque when driven-wheel slip exceeds the peak. This mirrors Speed Dreams' TCL multiplier.
- **Stability control:** compare yaw rate against a reference, and brake individual wheels to correct oversteer or understeer.
- **Steering assist:** a speed-sensitive lock from 35° at walking pace down to 4–6° at 250 km/h, so the front tyres never pass peak slip angle (Edy's "ESP" definition, [Edy](https://vehiclephysics.repositoryhosting.com/trac/vehiclephysics_edys-vehicle-physics/wiki/CarSettings?format=txt)).
- **Counter-steer:** catch slides automatically, and blend out as the player corrects.
- **Racing line:** the generator computes a minimum-curvature line and speed profile (v = √(μg/κ), with forward and backward passes). The same data drives the braking assist, the braking-zone overlay and the rubber-line texture.

One assist ladder, chosen per player in the lobby. It merges the car assists above with the steering levels in the controller section below (the old Off / Assist / Autopilot):

| Level | Steering and throttle | ABS | TC | Stability | Steering cap | Counter-steer | Line |
|---|---|---|---|---|---|---|---|
| Autopilot | TV steers along the racing line and accelerates; the player only brakes (old "Autopilot", plus the old "Assist" auto-accelerate) | on | on | on | n/a | on | braking zones |
| Assisted (default) | Player steers and drives, with wall avoidance (old "Assist") | on | on | on | on | on | braking zones |
| Pro | Player, raw input (old "Off") | on | off | off | off | off | off |
| Sim | Player, raw input (old "Off") | off | off | off | off | off | off |

Treat Autopilot as the handicap level. Asphalt's evidence is about steering autopilot, not ABS, TC or stability control, which on a real tyre model can make novices faster.

Show small ABS and TC lights on the HUD when they act, so players learn what the assists are doing. Gears are automatic for everyone in the party product.

### Engine sound
- **The standard method** is RPM-tagged loops, crossfaded and pitch-shifted, split into on-load and off-load layers ([Designing Sound](https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/); [Audiokinetic](https://audiokinetic.com/loop-based-car-engine-design-with-wwise-part-1)).
- **Google's browser racer used only three files** and warned that wide pitch-shifting "will sound very synthetic" ([web.dev](https://web.dev/case-studies/racer-sound)).
- **Per car, v1:**
  - 4–6 RPM layers cut from steady segments of CC0 recordings, plus idle and a limiter loop. The CC0 files Speed Dreams credits are fly-bys and revs, not steady-RPM holds, and no free source has on-load/off-load layers.
  - Keep pitch shifts within about ±15% and use equal-power crossfades. That is about 24 voices for four cars, which is cheap in Web Audio.
- **Full sets later:** 6–10 on-load and 6–10 off-load loops spaced 1,000–1,500 rpm apart is the target, but only after a sourcing step: written licence confirmation for a paid loop pack, or our own recordings (steady holds of about 10 s every 500–1,000 rpm, on load and coasting).
- **Extra layers:**
  - Shift dip and clunk, turbo whine and blow-off, off-throttle crackle.
  - Tyre squeal mapped to combined slip.
  - Kerb rumble triggered by surface ID, wind ∝ v², and impacts from Rapier contacts.
- **Split-screen mix:** keep each player's own car prominent, and duck and low-pass the other cars.
- **Later upgrade:** RPM-synchronous granular playback in an AudioWorklet, which is what the REV and AudioMotors tools do offline.

### HUD
- **Rev bar** with shift LEDs from green (~85% of the limiter) to a flashing upshift point computed from the torque curve. Sim tools let players set those thresholds ([Race Element](https://overtake.gg/downloads/race-element.50578/updates?page=4)).
- **The gear numeral is the biggest glyph,** turning red near redline as CleanHUD does ([RaceDepartment](https://www.racedepartment.com/downloads/cleanhud.9403/)). Show **R as white on red**, plus N.
- **Speed, position, lap,** and a delta bar (green when ahead, red when behind).
- **At three or four players,** use one shared minimap where the quadrants meet.
- **Keep it compact and near the car,** which is what Forza players ask for ([Forza forums](https://forums.forza.net/t/simplified-hud/608259)). Apply the TV text sizes from the UI section below.

## Floating drag-steer replaces tilt

### Steering
- **No shipped mobile racer relies on one touch scheme.** GRID Autosport offers arrow buttons and a floating wheel that "appears when you hold down on the left side of the screen" ([Feral](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)).
- **AirConsole's guideline is blunt:** "Do not use d-pads and virtual joysticks", because fingers slip off targets unnoticed ([AirConsole](https://developers.airconsole.com/smartphones-as-controllers)).
- **Microsoft recommends a relative stick** wherever input has to change gradually ([Microsoft TAK guide](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)).

Default, **"Drag steer"**:
- The left ~45% of the screen is the steering zone. Wherever the thumb lands becomes centre.
- Only horizontal travel counts; releasing the thumb auto-centres.
- Full lock at roughly a quarter of screen height of travel (tune between 22% and 30%), a 4–6% dead zone, and a response curve (gamma 1.3–1.8).
- Show a ghost wheel under the thumb, rotating with the steer value.

Alternative, **"Buttons"** (keep the name returning players know):
- Two large arrows that ramp steering from 0 to full over 150–250 ms and back to centre in 80–120 ms.
- Ramping avoids the "binary" feel reviewers disliked in Real Racing 3 ([Game Informer](https://gameinformer.com/games/real_racing_3/b/ios/archive/2013/02/28/real-racing-3-preview.aspx)).

Shared processing, done on the TV for every mode:
1. Dead zone and response curve.
2. Speed-sensitive lock.
3. Steering-rate limit of 120–180°/s. The starter-kit car specifies 120°/s ([sc-cavallo-360.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/src/branch/main/data/cars/models/sc-cavallo-360/sc-cavallo-360.xml)).
4. A 30–50 ms low-pass filter, so network jitter never becomes steering noise.

Per-player assist level:
- One ladder, shared with the car assists: **Autopilot**, **Assisted** (default), **Pro** or **Sim** (see the table in the assists section above).
- Asphalt players using TouchDrive, its steering autopilot, end up slower ([TouchTapPlay](https://www.touchtapplay.com/asphalt-9-controls-settings-guide/)), so Autopilot doubles as a natural handicap for mixed-skill parties.

### Pedals, reverse and the rest
- **Right thumb:** GAS is the tallest pedal at bottom-right (≥ 22% of width, 55–65% of height). BRAKE · R sits just inside it, along the thumb's natural arc.
  - A touch gives 100%, so digital play works. Sliding down from the touch point feathers throttle.
- **Reverse:** keep "hold brake to reverse", the Forza Horizon convention ([Gamezo](https://gamezo.gg/forza-horizon-5-controls/)), but make it impossible to miss:
  - A ring fills on the pedal over 300–400 ms at standstill.
  - The label flips to REVERSE, and an R chip lights on both the phone and the TV.
  - After 2 s stuck while holding gas, show "Hold BRAKE to reverse".
  - Add a Reset action for players who are truly stuck.
- **Handbrake:** touch screens allow only two inputs at once (one per thumb) ([Microsoft](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)), so make it a single gesture: slide up off GAS onto a handbrake strip while throttle stays latched.
- **No item button.** That removes a control and frees the upper-right zone.
- **Pause:** a top-left icon that needs a 0.5 s hold, so a stray thumb cannot pause a four-player race.
- **Phone screen content:** during the race, the phone shows only the player's colour band, control state and connection quality. Everything players read while driving belongs on the TV.

### Feedback and the web platform
- **Haptics are Android-only.**
  - Chrome blocks `navigator.vibrate` until the user has tapped the page ([Chromium](https://codereview.chromium.org/2778693004)).
  - iOS Safari still has no Vibration API ([caniuse](https://caniuse.com/vibration)).
  - The hidden-switch haptic trick was reportedly cut back in iOS 26.5, according to the library vendor ([haptics-web](https://haptics-web.vercel.app/)).
  - So visual feedback (pedal fills, knob, R chip, collision edge glow) is the primary channel on every phone.
- **iPhone:**
  - It has no element fullscreen and no orientation lock ([caniuse](https://caniuse.com/fullscreen); [GitHub](https://github.com/moamoamorte/x-76/issues/56)).
  - In iOS 26, sites added to the Home Screen open as web apps by default ([Michael Tsai](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/)). Show a one-time "Add to Home Screen" card and a "Rotate your phone" overlay.
  - Wake Lock works in Safari from iOS 16.4 ([caniuse](https://caniuse.com/wake-lock)), but in home-screen web apps only from about iOS 18.4; 16.4–18.4 failed in standalone mode ([Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock)). Keep re-requesting the lock when the page becomes visible again (already implemented), and show "Tap to resume" as a backstop if the page was hidden.
- **Input handling:** use Pointer Events with `setPointerCapture` and `touch-action: none` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)), never `click`.
- **Network:**
  - Today the pad sends at most 30 updates/s plus a 100 ms heartbeat, and the TV coasts a car after 600 ms (`DECISIONS.md`).
  - Move to 60 Hz binary snapshots of 12–16 bytes on the existing unordered, no-retransmit channel. Include a sequence number and counters for one-off actions.
  - Zero a player's inputs after 250 ms of silence.
  - Send nothing large on the same connection during a race. Large reliable messages can delay small ones on the sending side ([Pion](https://pion.ly/blog/sctp-interleaving)).
- **Reconnects:** hold the player's slot for 60–120 s. Pause, or let the car coast while showing "P2 reconnecting…", which matches Microsoft's "pause gameplay where possible" advice.

## A quiet platform frame, in-engine art, and no gradients

### 10-foot basics the current UI breaks
- **Canvas:** use a fixed 1920×1080 CSS stage, scaled uniformly to the window.
- **Safe area:** keep text and QR codes at least 96 px from the sides and 60 px from the top and bottom, and let the 3D scene bleed to the edges ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/layout); [Microsoft](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)).
- **Type:** body text 29–32 px, **nothing under 23–24 px** ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/typography)), and no light weights. The current `tv.css` labels are 0.8–1.15vw, about 15–22 px.
- **Focus:** input comes from phones, but the TV still needs a focus state everyone on the couch can see. Scale the focused item to about 1.05–1.1, give it a brand-colour outline and a lift shadow, and play a short tick. Leave Apple-style spacing (about 40 px horizontal, about 100 px vertical) so focused items can grow without overlapping ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)). Show which player has control, for example "Host is choosing…" in that player's colour.
- **Density:** about one decision per screen. A TV should show about as much information as a phone, not a desktop ([Microsoft](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)).
- **Colour:** keep colours within RGB 16–235. Player colours must differ in lightness as well as hue, and each player is also identified by a race number.

### Remove the "AI slop" tells
The current UI uses textbook tells listed by designers ([925studios](https://www.925studios.co/blog/ai-slop-design-tells); [avoid-ai-design](https://github.com/funboy322/avoid-ai-design); [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)): orange and purple glow washes, frosted `backdrop-filter` panels, gradient "art" on game cards, uppercase tracked micro-labels, and one techno font (Chakra Petch) for everything. Write these rules into a `DESIGN.md`:
1. **No CSS gradient as content.** Every game, track and result image is an in-engine render. Forza's menu posters are "captured render[s] from the game" ([We Are Royale](https://weareroyale.com/case-studies/forza-motorsport/)).
2. **No glass panels.** Use solid surfaces.
3. **Two typefaces.** A characterful display face used only at large sizes (race numbers, positions, room code), and a highly legible text face with tabular numerals for lap times. A custom numeral set is a cheap, ownable racing asset.
4. **One brand colour,** used for a signature "ribbon" for selection, progress and track maps, in the spirit of Forza's gold ribbon.
5. **Vary corner radii by hierarchy.** Write specific copy ("Scan to join, no app needed"). Use sentence-case labels.

**Art direction:** a race-weekend broadcast look, with a timing tower, start lights, number boards, livery stripes and tabular numerals. Build it from full-colour daylight renders of the temperate tracks, which avoids the near-black-plus-neon "gaming template" look. The coastal option in the research is excluded by the owner's decision.

### Screens
- **Lobby:** build it around the join.
  - A huge room code styled as a number plate, a large QR code and a short URL, the Jackbox pattern ([Jackbox](https://www.jackboxgames.com/how-to-play)).
  - When a phone joins, that player's car rolls onto a grid slot in the live 3D scene with their colour, number and name, plus a rev or chime.
  - Show who is host.
- **Track picker:** a short row of large in-engine posters. The focused one plays a slow loop, with "3 laps · ~4 min · 1–4 players" and the track drawn as a ribbon.
- **Results:** the existing 3D podium, then a timing table, then a one-tap Rematch / Next track vote on the phones.
- **Attract mode:** a cinematic flythrough with the join code still visible.

### Motion and sound
- **Motion:**
  - Animate only `transform` and `opacity` over the game canvas. Large blurs are the most common performance killer ([Motion](https://motion.dev/blog/web-animation-performance-tier-list)).
  - Use Motion for React transitions. Use GSAP, free since April 2025 ([Webflow](https://webflow.com/blog/gsap-becomes-free)), only for scripted podium and boot sequences, never over live gameplay.
  - Render the 3D lobby on demand with low DPR ([R3F docs](https://r3f.docs.pmnd.rs/advanced/scaling-performance)) and reuse the game's renderer, so it also warms up shaders.
- **Sound:**
  - Nintendo's HOME menu uses "rhythmic sound effects with no background music" and keeps its design resources under 200 KB ([Nintendo Wire](https://nintendowire.com/news/2018/08/22/nintendo-talks-about-the-design-of-the-switchs-os-at-cedec-2018/)).
  - Build one sound kit: a 1–3 s sonic logo, focus and select ticks, join notes pitched per slot so a full lobby plays a chord, start-light beeps, and a podium sting. Test them on both TV and phone speakers ([IRPR](https://sounddesign.irpr.agency/guides/how-to-design-a-sonic-logo/)).

### Website and pricing page
- **Hero:** real footage of a race on a TV with phones in hand, and the line "Your TV is the console. Your phones are the controllers."
- **How it works:** three real screenshots (open on the big screen, scan the code, race) and the line "No app. No console. No download."
- **Pricing:** one monthly plan plus the free tier, with "Cancel anytime" next to the button and "One pass unlocks the whole room".
- **FAQ:** "Does everyone need to subscribe?" (no), devices, Wi-Fi, cancellation and progress. Apple Arcade's page follows this pattern ([Apple](https://www.apple.com/apple-arcade/)).
- **Credits page:** a `/licenses` page for FAL, CC-BY, OFL and Copernicus credits.
- **Trust:** never fabricate reviews or player counts.

## Build plan: three tracks first, then the paywall

**Priority logic:**
- Measurement and the track generator come first, because everything else is tested on them.
- The three tracks follow the track notes' order of work: the generator with the club circuit, then vegetation and the bake with the autodrome, then elevation terrain with the mountain road. Three tracks is the minimum worth charging for.
- Feel comes next, built and playtested on all three tracks. Touch control and handling are the biggest product risk, so they get their own milestone and the strictest playtest gate. M8 already ships the minimum touch controller, because tilt has to go.
- Cars follow, once the handling they are tuned for exists.
- The UI and the paywall come last, wrapped around a product that already earns them.

Each track milestone introduces one major system. M8 also carries the cleanup and the minimum touch controller that the owner's decisions require.

| # | Milestone | Main new system | Gate to pass |
|---|---|---|---|
| M8 | Track 1: club circuit (3.3 km) | Trackgen and the performance foundation (profiling, presets), plus the minimum touch controller | 4 players on Low, 2 on Medium and 1 on High at a locked 60 fps on the M1 at 4K |
| M9 | Track 2: fast autodrome (5.9 km) | Vegetation and impostors, Blender bake | Impostor forest at 60 fps on Low |
| M10 | Track 3: mountain road (3.8 km) | Elevation terrain, triplanar, backdrop | Crests and cliffs at 60 fps |
| M11 | Feel | Tyre model, assists, controller v2, HUD, engine audio | First-timers finish without help |
| M12 | Cars and cameras | Car sourcing, fictional brands, paint, LODs, probes, chase cam | Legal checklist passed; car budget held |
| M13 | Premium TV and site UI | Design system, lobby, posters, sound kit | 10-foot rules met at 60 fps |
| M14 | Subscription and launch | Billing, free tier, R2, licences, clearance | End-to-end paid session on real phones |
| M15+ | Monthly live content | New track or car pack each month | Drop shipped every month |

### M8: Track 1, club circuit, and the performance foundation
- **Clean up for the owner's decisions:**
  - Remove tilt and the iOS motion-permission flow.
  - Retire items mode (mystery boxes). Keep slipstream as aero physics.
  - Retire the Corniche Run track and theme.
- **Recommendation, needs owner approval:** also remove the M7 arcade speed tricks (drift boost, boost pads). They run in both modes, so retiring items does not remove them. The owner banned only Mario Kart items; this is a sim-lite suggestion, not an owner decision.
- **Licence check for Speed Dreams data:**
  - Before deriving from any SD 1.4 track or car, read the licence file in its directory and record it in a licence log. Start the log here and use it for every asset after.
  - Flag anything GPL or unclear before using it.
- **Profiling:**
  - In-game overlay showing draws, triangles and GPU time.
  - A scripted fly-through at 1, 2 and 4 viewports.
  - Telemetry to Neon.
- **Render path:**
  - DPR-1 canvas with an upscale-and-sharpen pass at 4K.
  - Shared HDR target with one post chain.
  - GPU-time-driven dynamic resolution and three automatic presets.
  - Shader precompilation.
- **Trackgen v1:**
  - Speed Dreams XML to centre line, corridor chunks, physics mesh with surface IDs, terrain shoulder blend and placement rules.
  - Racing line and speed profile.
- **Track 1:**
  - A temperate pine-forest club circuit.
  - The layout starts from a Speed Dreams layout but is changed enough not to replicate any real circuit.
  - `SunLight` shadows, blob AO, CC0 asphalt, kerbs and the track mask.
  - Derived track data is shipped under FAL, and only from sources the licence check confirmed as FAL.
- **Controller (minimum to replace tilt):**
  - Drag steer and Buttons.
  - The GAS and BRAKE · R pedals, the reverse ring, and Reset.
- **Start car sourcing:** an art task that runs alongside M8–M11 (see M12).
- **Done when:**
  - Four players race Track 1 at 60 fps on Low, two players on Medium and one player on High, on the M1 driving a 4K TV.
  - p99 frame time stays under 16.7 ms through a 30-minute soak.
  - No tilt code remains.

### M9: Track 2, fast autodrome, with vegetation and baked light
- **Vegetation:**
  - `InstancedMesh2` trees with LODs and octahedral impostors.
  - Card bushes, grass near the edges, alpha-to-coverage.
- **Blender headless bake:**
  - Second UV set, Cycles AO and irradiance for 2–3 fixed time-of-day presets, KTX2 HDR.
  - `LightProbeGridWebGL` baked during the countdown.
  - Backport the bake to Track 1.
- **Track 2:**
  - A parkland autodrome with long tree-lined straights, chicanes and a banked curve, borrowing the archetype but not Monza's layout or names.
  - Modular grandstands, crowd cards, instanced tyre walls, catch fences that fade with distance.
  - Folded track-mask atlas.
- **Done when:**
  - Four players hold 60 fps on Low with the impostor forest.
  - The track download is at most 60 MB.
  - The bake runs overnight unattended.

### M10: Track 3, mountain road
- **Terrain:**
  - Real elevation from Copernicus GLO-30, which requires its prescribed credit ([licence](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf)). Commercial use in a subscription product is unverified until the full licence is read, so synthetic erosion terrain stays the fallback.
  - Triplanar rock on slopes, hex tiling on grass and gravel.
  - A baked backdrop mountain ring beyond 2 km, with atmospheric-perspective fog.
- **Track 3:**
  - An alpine-style pass with conifers and rock, and no real pass names.
  - The current chase cam pre-raises before blind crests, using the spline. The M12 rewrite keeps this.
- **Done when:**
  - All presets hold 60 fps.
  - There is no camera clipping on crests.
  - The three tracks feel distinct in the playtest.

### M11: Feel (handling, assists, controller, HUD, audio)
- **Physics:**
  - Custom tyre model on the Rapier chassis at 120 Hz with substeps.
  - Gravity back to 9.81.
  - Car specs as JSON from the starter kit.
- **Assists:** the assist ladder (Autopilot, Assisted, Pro, Sim), the braking-zone line, and ABS/TC lights.
- **Controller v2:**
  - 60 Hz binary input packets with a 250 ms failsafe.
  - The handbrake slide gesture.
  - Android haptics vocabulary, the iPhone Add to Home Screen card, and a 10-second "try it" view.
  - A mirror-layout toggle and a controls-size setting.
- **HUD v2:** TV-legible sizes, white-on-red R, shift LEDs, delta bar, shared minimap.
- **Engine audio v1:** 4–6 RPM layers per car, cut from steady segments of CC0 recordings, plus tyre and kerb layers. Full on- and off-load sets wait for a sourcing step: written licence confirmation for a paid pack, or our own recordings.
- **Done when:**
  - In playtests, at least 80% of first-time players finish a 3-lap race without help.
  - No one stays stuck for more than 5 s without a prompt.
  - Testers rate drag steer more precise than Buttons.
  - Competent players lap slower on Autopilot than when they steer themselves (Assisted, Pro or Sim), so Autopilot acts as a handicap. ABS, TC and stability control are not expected to slow anyone down.
  - Rapier at 120 Hz plus the tyre loop for four cars, measured on the M1, fits the 8–10 ms main-thread budget.

### M12: Cars and cameras
- **Car sourcing (starts in M8, must finish before M12):**
  - A manual Sketchfab and Fab search for realistic, original-design models. The research found no verified usable one.
  - A candidate list, with a licence check per model (CC0 or CC-BY, commercial use allowed) recorded in the licence log.
  - A real-silhouette check: reject any model of a real car, or one too close to an iconic shape.
  - If too few candidates pass, take it to the owner: model the missing bodies in-house, or relax the free-model rule.
- **Car line-up:**
  - 4–6 base bodies across classes (chosen from hatch, coupé, GT, supercar, muscle and prototype) under invented GTA-style makes. Reshape them into variants (bumpers, wings) to reach 6–8 cars.
  - Built from the sourced CC0 or CC-BY models, reshaped, de-badged and given livery UVs.
  - LOD0–3 via gltf-transform simplification.
  - A licence log entry for every asset.
- **Materials and lights:**
  - Paint presets with flakes and orange peel, glass, tyre atlas, brake glow.
  - Emissive light ladder.
  - Livery compositor with numbers and fictional sponsors.
- **Reflections:** baked probes along the spline on every preset; the time-sliced live cube on High.
- **Cameras:**
  - Chase cam rewrite with car-frame springs, FOV vs speed, spline look-ahead, the crest pre-raise from M10, and trauma shake.
  - Bumper cam.
  - Replay recording and TV cams.
- **Done when:**
  - Every car passes the legal checklist (no real-car silhouette, no badges, licence logged).
  - Four cars in four viewports stay within about 160 car draw calls.
  - No camera lag at 200+ km/h.

### M13: Premium TV and site UI
- **Design system:** `DESIGN.md`, two typefaces, brand colour, player colour set, the 1920×1080 stage.
- **Screens:**
  - Live 3D grid lobby.
  - In-engine poster picker.
  - Podium and timing-table results.
  - Attract mode.
  - A pad skin that matches.
- **Sound kit and sonic logo.**
- **Landing page.**
- **Done when:**
  - No text is under 24 px at 1080p and every element sits inside the safe area.
  - Every focusable element has a focus state readable from the couch (about 1.05–1.1 scale, brand-colour outline), focused items never overlap their neighbours, and each screen shows which player has control.
  - There are no `backdrop-filter` panels or CSS gradient art.
  - The UI animates at 60 fps over the scene.

### M14: Subscription and launch
- **Billing:**
  - A monthly plan with a 3–4-week trial.
  - Checkout via "Scan to subscribe" on the phone.
  - The host's subscription unlocks the room.
- **Tiers:**
  - Free: Track 1 with up to 2 players.
  - Paid: all tracks and cars, 3–4 players, championships, ghosts and liveries.
- **Hosting:** Vercel Pro for the app and API; assets on R2 with hashed immutable URLs; a service worker that pre-caches the next track.
- **Legal:** the `/licenses` page and in-game credits; a clearance search of brand, car and track names in the UAE, US, EU and UK.
- **Presets:** retune them from telemetry, and test 1080p TVs and other laptops.
- **Done when:** a real household completes join, race, subscribe and rematch on their own phones without help.

### M15 and after: monthly live content and upgrades
- **Monthly drops:** one new track every month or two through the generator, alternating with car packs and championships.
- **WebGPU gate** at r187/r188, using the three tests above. Passing it unlocks TAAU and richer post effects.
- **Later features:** night races (clustered lights), wet roads, granular engine audio, our own engine recordings, and a cockpit cam for single-player.

## Conclusion

The research changes where the hard problems are. Rendering on an M1 at 4K has a budget plan: render near 1080p, bake the light, run one post chain, and use automatic presets. Every number in it is still an estimate (there are no published three.js per-pass timings on an M1, and the shadow costs come from Intel integrated GPUs), so M8 profiling must prove it. The real constraints are content throughput and input quality. A monthly subscription only works if something new ships every month. The single most valuable asset is therefore the track centre line, because the one spline feeds the visual corridor, the physics mesh, surface IDs for audio and haptics, the racing line, the assists, the minimap, the replay cameras and the rubber-line texture. Build the generator well and a track takes days; build it badly and every track is a hand-made project that drifts out of sync with the physics.

The owner's free-car-model decision moves cost from purchasing to in-house art time. Expect cars, not tracks, to be the slowest content to produce. Touch-only control is the biggest product risk: free-movement games on touchscreens are where the main AirConsole Hero review said the platform fell short, so it has to be the best-tested part of the game. The point of difference against free TV party games is premium visuals at a locked 60 fps in four-player split screen, plus the depth of a monthly content drop. WebGPU is an upgrade path, not a prerequisite, so the team can ship premium visuals now on WebGL and adopt TAAU later without blocking the roadmap.
