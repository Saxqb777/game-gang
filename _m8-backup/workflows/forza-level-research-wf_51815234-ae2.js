export const meta = {
  name: 'forza-level-research',
  description: 'Re-run 6 stalled research areas, then write and fact-check one report and build plan for the racing platform',
  phases: [
    { title: 'Research', detail: '6 researchers in parallel; notes saved to research_notes' },
    { title: 'Report', detail: 'Synthesize all 8 notes files into one prioritized report' },
    { title: 'Check', detail: 'Critic checks the report against the notes and the owner decisions; writer fixes issues' },
  ],
}

const SKILL = '/root/.claude/skills/synced/78043ea2-a10a-4c6c-ad7b-43bfa10fe181_f89e305e-7f34-4d08-aa17-ad32792a03ef/deep-research'
const NOTES = '/home/user/game-gang/research_notes/Forza level browser racing game'
const REPORT = '/home/user/game-gang/reports/Forza level browser racing game.md'
const FIRST = '\n\n**As a first step, you must read ' + SKILL + '/references/researcher.md for instructions on how to conduct research.**'

const PROJECT = [
  '- Current date is October 2026; prefer 2024-2026 sources and clearly mark anything older or superseded.',
  '- Project: "Gamer Gang", a phones-as-controllers TV party platform (AirConsole-style). Flagship game "Split Ways": a split-screen racing game, 1-4 players, in one canvas on a TV.',
  '- Stack: three.js r186 (npm three@0.186.1) WebGLRenderer with a custom per-viewport HDR pipeline (half-float MSAA target, mip-chain bloom, ACES composite, vignette, speed lines, dither), dynamic resolution, HDRI sky, fog chunks replaced via ShaderChunk; Rapier physics (rapier3d-compat 0.21) raycast vehicle with arcade assists; React 19 + Vite; phones send inputs over WebRTC data channels (~60 Hz); deployed on Vercel with a Neon Postgres database.',
  '- Target hardware: Chrome on a MacBook Air M1 (16 GB RAM) connected to a 4K 60 Hz TV; the public will use 1080p or 4K TVs at 60 Hz. Target is a locked 60 fps with automatic quality presets.',
  '- Owner decisions: proper racing game in the spirit of Forza Motorsport (no Mario Kart items); no desert/UAE/"Corniche" theme; tilt/gyro steering is removed (touch controls only); cars are fictional GTA-style brands built from free, commercially usable models; the product will be sold as a monthly subscription, so everything must be commercially usable.',
  '- Content starter kit: Speed Dreams 1.4 data (mostly Free Art License): 29 track layouts as XML segments (length, radius, arc, elevation, banking, width, kerbs/borders/barriers) and car specs (engine torque curves, gear ratios, tyres, aero, suspension, brakes); its 3D models are 2009-era low poly (~4-6k triangle cars) and its engine sounds are single short loops. It is a starting point, not a limit: recommend the best approach from any source.',
  '- First tracks to build: a ~3.3 km club circuit, a ~5.9 km fast Monza-style circuit, and a ~3.8 km mountain road.',
].join('\n')

const TOPICS = [
  {
    label: 'Rendering platform',
    file: 'rendering_platform_performance.md',
    prompt: 'Research the best rendering platform and performance strategy for a high-end three.js racing game running in a browser in 2026.\n\n' +
      'Objective: Decide between three.js WebGPURenderer (with TSL and node-based post-processing) and WebGLRenderer for this existing project, list the post-processing effects available for each and their cost, and establish realistic performance budgets for 1, 2 and 4 split-screen viewports on an Apple M1 driving a 4K TV at 60 fps, including upscaling strategy (render ~1080p-1440p internally, upscale to 4K).\n\n' +
      'Key questions:\n' +
      '- State of three.js WebGPURenderer + TSL as of r180-r186 and later (2025-2026): stability, feature parity with WebGLRenderer, automatic WebGL2 fallback, known gaps (MSAA, setViewport/setScissor multi-viewport rendering, shadows, render targets), migration effort from custom ShaderMaterial / onBeforeCompile / ShaderChunk code.\n' +
      '- WebGPU support on macOS in 2026: Chrome, Safari (which version enabled it by default), Firefox; Apple Silicon issues.\n' +
      '- Post-processing available per renderer (three/addons passes for WebGL vs TSL nodes for WebGPU: GTAO/SSAO, SSR, TRAA/TAA, SMAA, FXAA, bloom, motion blur, DOF, lens flare, SSGI if any) and typical GPU cost at 1080p.\n' +
      '- Budgets on an M1 GPU at 1080p internal resolution: draw calls, triangles, texture memory, shadow map sizes, number of post effects; scaling to 2 and 4 viewports; dynamic resolution and temporal upscaling (TRAA/FSR-like) to 4K output; measured benchmarks or anecdotes.\n' +
      '- Draw-call/CPU reduction: BatchedMesh, InstancedMesh, LOD, frustum/occlusion culling, WebGPU indirect draws, texture arrays, KTX2 compressed textures.\n' +
      '- Multi-viewport split-screen rendering patterns and per-viewport post-processing cost in WebGL vs WebGPU.\n\n' +
      'Suggested sources:\n- threejs.org docs/examples (webgpu_*), three.js forum, GitHub releases/migration guides r170-r186+\n- Chrome and WebKit release notes, caniuse/WebGPU status\n- Posts/talks by three.js maintainers (sunag, Mugen87, mrdoob), Apple GPU specs, WebGPU vs WebGL benchmark write-ups\n\n' +
      'Constraints:\n' + PROJECT,
  },
  {
    label: 'Car rendering + cameras',
    file: 'car_rendering_cameras.md',
    prompt: 'Research photoreal car rendering and racing camera design for a three.js racing game.\n\n' +
      'Objective: Concrete techniques, material settings and budgets for making cars look like Forza Motorsport / Gran Turismo in a browser (paint, glass, chrome, tyres, lights, reflections), where to get or how to upgrade car models (fictional GTA-style brands, commercially usable), and what makes racing cameras feel great.\n\n' +
      'Key questions:\n' +
      '- Car paint: MeshPhysicalMaterial settings (clearcoat, clearcoatRoughness, metalness, roughness, iridescence, sheen) for metallic, pearlescent and solid paints; metallic flake (flake normal maps, custom shader/TSL node); how multi-layer car paint in Forza/GT/Unreal/Unity HDRP works and what is feasible in three.js WebGL vs WebGPU TSL.\n' +
      '- Glass, chrome/rims, tyres (sidewall lettering via normal maps/decals), carbon fibre, brake discs.\n' +
      '- Reflections: HDRI + PMREM vs dynamic CubeCamera (cost, resolution, update frequency, round-robin, shared vs per-car), SSR, how commercial racing games do car reflections.\n' +
      '- Lights: headlights/taillights emissive + bloom, light cones, lens flares, brake lights.\n' +
      '- Car models: triangle counts for hero vs opponent cars, LODs, texture sizes; upgrading 4-6k triangle Speed Dreams models vs sourcing better free CC0/CC-BY fictional car models (name specific sources/models and their licences); livery/decal systems for our own brands and logos.\n' +
      '- Racing cameras: chase cam (spring arm, damping, FOV vs speed, look-ahead into corners, height), bumper/hood cam, cockpit cam, replay/TV cams, camera shake; published talks/articles on racing game cameras (Turn 10, Playground, Codemasters, Criterion).\n\n' +
      'Suggested sources:\n- three.js docs/examples (webgl_materials_car, MeshPhysicalMaterial, CubeCamera, PMREMGenerator), forum car paint threads\n- Unreal/Unity HDRP car paint docs\n- GDC/SIGGRAPH talks from racing studios; Sketchfab/Poly Haven licence pages\n\n' +
      'Constraints:\n' + PROJECT + '\n- Per-car costs multiply by up to 4 cars x 4 viewports.',
  },
  {
    label: 'Track environment',
    file: 'track_environment_lighting.md',
    prompt: 'Research how to build large, realistic outdoor race track environments in three.js at real-time frame rates.\n\n' +
      'Objective: Concrete techniques for terrain, road surfaces, kerbs, decals, run-off (grass, gravel traps), barriers/tyre walls/catch fences, grandstands and trackside props, vegetation, grass, distant mountains, sky/atmosphere, clouds, fog, time of day, and lighting/shadows for static track geometry, with budgets for a browser on an Apple M1.\n\n' +
      'Key questions:\n' +
      '- Terrain: heightmap vs track-aligned meshes, texture splatting (triplanar, macro + detail), breaking tiling (stochastic/hex tiling), blending road into terrain.\n' +
      '- Road: PBR asphalt with detail and macro variation, racing-line rubber, skid decals, painted lines, kerbs (rumble strips, sawtooth), optional wet roads.\n' +
      '- Vegetation at scale: InstancedMesh/BatchedMesh with LOD, octahedral impostors and existing three.js impostor libraries, alpha-to-coverage vs alpha test with MSAA, wind in vertex shaders, grass (instanced blades near camera, cards farther), realistic instance counts on an M1.\n' +
      '- Distant scenery: mountains (low-poly + baked textures, HDRI/skybox layers), atmospheric perspective; sky models (three Sky addon / SkyMesh for WebGPU, Preetham/Hosek/Bruneton), clouds, time of day.\n' +
      '- Shadows: three/addons CSM for WebGL, CSMShadowNode for WebGPU, map sizes, PCF/PCSS/VSM cost, contact shadows/ground AO under cars.\n' +
      '- Baked lighting: lightmaps/AO baked in Blender (Cycles) for static track geometry, light probes/irradiance volumes in three.js, shipping baked data efficiently.\n' +
      '- Lessons from Forza Motorsport, Assetto Corsa Competizione, Gran Turismo 7 track production (vegetation density, LOD distances, trackside detail) and from web open-world/terrain demos.\n' +
      '- A practical pipeline to turn Speed Dreams XML layouts (centre line from segments) into a modern track: procedural generation in code vs authoring in Blender (Blender CLI scripting) vs a hybrid.\n\n' +
      'Suggested sources:\n- three.js docs/examples/forum; open-source three.js terrain/grass/vegetation projects\n- GPU Gems, GDC/SIGGRAPH talks on vegetation, terrain, impostors; stochastic texturing and octahedral impostor papers\n- Blender baking and scripting guides; racing game developer interviews on track creation\n\n' +
      'Constraints:\n' + PROJECT,
  },
  {
    label: 'Assets + legal',
    file: 'assets_pipeline_legal.md',
    prompt: 'Research commercially usable asset sources and the web asset pipeline for a paid browser racing game, plus licensing and trademark risks.\n\n' +
      'Objective: Where to get high-quality assets (vegetation, rocks, terrain/road textures, HDRIs, trackside props, car models, engine/tyre/ambient sounds, UI fonts) usable in a subscription product; how to compress and stream them for the web; what the licences require; which trademark/IP risks to avoid.\n\n' +
      'Key questions:\n' +
      '- CC0 sources and what they offer for a race track: Poly Haven (trees/plants/rocks models, textures, HDRIs), ambientCG, other CC0 libraries; CC-BY sources (e.g., Sketchfab downloadable models) and attribution rules; good free fictional/unbranded car models usable commercially (name candidates); CC0/CC-BY engine recordings (freesound) and multi-layer engine sound packs (free or cheap) with game-friendly licences.\n' +
      '- Free Art License 1.3 (Speed Dreams 1.4 data): commercial use and modification requirements, share-alike scope (our code vs derived artwork/data), attribution format, compatibility with CC BY-SA; any Speed Dreams/TORCS data under GPL and implications for a web game; sounds in its shared data/sound folder with unclear provenance.\n' +
      '- Trademark/IP: real circuit names ("Forza" is a Microsoft trademark; Rudskogen circuit; Laguna Seca), real car shapes/trade dress without brand names (GTA-style fictional cars; AM General v. Activision; manufacturer licensing practice), how small studios name tracks/cars.\n' +
      '- Pipeline: glTF 2.0 + KTX2/Basis (UASTC vs ETC1S), meshopt vs Draco, gltf-transform recipes, texture budgets, download size targets (initial load vs streaming), caching (HTTP cache, service worker), hosting/bandwidth costs on Vercel vs alternatives (e.g., Cloudflare R2) for a subscription product.\n\n' +
      'Suggested sources:\n- polyhaven.com, ambientcg.com, sketchfab licence docs, freesound.org licence docs, creativecommons.org, artlibre.org (Free Art License text/FAQ)\n- gltf-transform and Khronos KTX/Basis docs, three.js loader docs\n- Vercel and Cloudflare pricing pages; legal analyses of trademarks/trade dress in video games\n\n' +
      'Constraints:\n' + PROJECT + '\n- This is not legal advice; note where answers depend on jurisdiction. The owner appears to be based in the UAE; the site is hosted on Vercel for a global audience.',
  },
  {
    label: 'Best web racers',
    file: 'state_of_the_art.md',
    prompt: 'Research the state of the art in browser-based driving/racing games and real-time 3D web showcases (2023-2026), plus phone-as-controller TV game platforms and how they make money.\n\n' +
      'Objective: Identify the best-looking web racing/driving experiences and the engines/techniques behind them (load sizes, frame rates where available) to benchmark what is achievable, and how phone-controller TV platforms monetise with subscriptions.\n\n' +
      'Key questions:\n' +
      '- Which web racing/driving games or demos look best today and what engine they use (three.js, Babylon.js, PlayCanvas, Unity WebGL/WebGPU, Godot web, Needle, custom WebGPU engines)? Check Slow Roads, Bruno Simon portfolio (2025), PlayCanvas and Babylon car demos, Polytrack, Madalin Stunt Cars, Drift Hunters, Unity 6 WebGPU demos, 2025-2026 WebGPU racing showcases.\n' +
      '- Their rendering, LOD, streaming and physics techniques, download sizes, performance on Apple Silicon.\n' +
      '- Developer talks/blog posts/postmortems.\n' +
      '- Phone-as-controller TV platforms (AirConsole, Jackbox, others): business models, subscription pricing (AirConsole Hero), what players pay for, how many games they offer, lessons for positioning a premium racing game; what makes reviewers and players call a party platform worth the money.\n\n' +
      'Suggested sources:\n- Project sites, dev blogs, GitHub, Chrome for Developers WebGPU case studies\n- Reddit, Hacker News, three.js forum showcase threads\n- AirConsole/Jackbox official pages and press coverage\n\n' +
      'Constraints:\n' + PROJECT,
  },
  {
    label: 'Handling + sound',
    file: 'handling_feel_audio.md',
    prompt: 'Research sim-lite car handling, driving assists, engine sound and HUD design for a browser racing game controlled by touch-screen phones.\n\n' +
      'Objective: Concrete models, parameters and algorithms for believable yet accessible handling with touch steering; how TORCS/Speed Dreams simulate cars so their car specs can be reused; engine audio approaches that sound like a real car (not synthesised buzzing); racing HUD conventions.\n\n' +
      'Key questions:\n' +
      '- Tyre models for real-time JavaScript at 60-240 Hz for up to 4 cars: Pacejka Magic Formula (typical coefficients), brush model, simplified slip curves, combined slip (friction circle/ellipse), load sensitivity; weight transfer, suspension, aero downforce, differentials.\n' +
      '- How TORCS/Speed Dreams simuv2 (and simuv2.1/simuv4) implement tyres, engine torque curves, gearbox, clutch, differentials, aero and suspension, and how car XML parameters (mu, stiffness, dynamic friction, Cx, front area, wing angles, torque curve points, gear ratios) map to physics so Speed Dreams 1.4 specs can be reused.\n' +
      '- Rapier DynamicRayCastVehicleController (rapier3d-compat 0.21): what it models and its limits for racing, vs a custom vehicle model applied as forces on a Rapier rigid body; fixed timestep and substepping.\n' +
      '- Assists for accessible sim-lite (Forza/GT style): ABS, traction control, stability control, steering assist/auto counter-steer, braking assist, racing-line overlay; filtering and mapping for touch steering (one-axis thumb drag or left/right buttons): dead zone, response curve, speed-sensitive steering, steering-rate limits.\n' +
      '- Engine sound: RPM/load-layered sample crossfading vs granular synthesis vs procedural Web Audio; how racing games build engine audio (on-load/off-load loops, gear shifts, turbo, backfire), tyre squeal, wind, kerb rumble; free/commercially usable multi-RPM engine recordings; recording your own car with a phone (technique, legality).\n' +
      '- Racing HUD conventions: tachometer/shift lights, gear incl. clear R, speed, lap/sector times, live delta, position, mini-map.\n\n' +
      'Suggested sources:\n- Pacejka; Marco Monster car physics tutorial; Brian Beckman "The Physics of Racing"; racing-sim developer blogs (Kunos, rFactor, BeamNG, Edy\'s Vehicle Physics)\n- TORCS/Speed Dreams source (simuv2/simuv2.1/simuv4) and docs\n- Rapier docs/source; GDC talks on racing physics/assists and engine sound design; Web Audio granular synthesis articles; freesound licences\n\n' +
      'Constraints:\n' + PROJECT + '\n- A fixed-step simulation exists; current handling is arcade (raycast vehicle with grip/yaw assists). Goal is "proper racing" like Forza Motorsport with assists on by default. Players could not find reverse (brake held at standstill reverses today).',
  },
]

phase('Research')
log('Researching 6 areas in parallel (UI and phone controller notes already done)')
const research = await parallel(TOPICS.map((t) => () =>
  agent(t.prompt + '\n\nSave your output notes to ' + NOTES + '/' + t.file + FIRST, {
    label: t.label,
    phase: 'Research',
    agentType: 'general-purpose',
  })))
const done = research.map((r, i) => (r ? TOPICS[i].label : null)).filter(Boolean)
const failed = TOPICS.filter((t, i) => !research[i]).map((t) => t.label)
log('Research finished: ' + done.length + '/6' + (failed.length ? ' (failed: ' + failed.join(', ') + ')' : ''))

phase('Report')
const QUESTION = 'How should we turn Gamer Gang (a phones-as-controllers TV party platform) and its flagship split-screen racing game into a premium, subscription-worthy product with Forza Motorsport-level visuals and proper sim-lite racing feel in the browser? Cover the rendering platform and performance budgets on an M1 driving a 4K TV at 60 fps, car rendering and cameras, track environments and lighting, commercially usable assets and the legal risks, state of the art on the web and platform business models, handling/assists/engine sound/HUD, the touch-only phone controller, and a premium TV/site UI. End with a prioritized, milestone-by-milestone build plan starting with the first 3 tracks.'
const OWNER = 'Owner decisions the report must respect (they override any researcher suggestion to the contrary): no Mario Kart items; no desert/UAE/"Corniche" theme (ignore any "coastal grand tour" suggestion); tilt/gyro steering removed, touch-only controls; fictional GTA-style car brands from free commercially usable models; Speed Dreams 1.4 data is a starter kit (track layouts, car specs), not a limit; target locked 60 fps on 1080p and 4K TVs with automatic quality presets; MacBook Air M1 16 GB on a 4K TV is the reference device; monthly subscription business. Write in plain, concise English with short paragraphs and bullets; avoid filler. Notes files in the folder: the 6 above plus phone_controller_ux.md and tv_platform_ui_design.md.'
const report = await agent('Read the notes in ' + NOTES + '/ and synthesize into a research report that answers: ' + QUESTION + '\n\n' + OWNER + '\n\nEarlier research in this conversation to build on: none\n\nSave your final report to this exact path: ' + REPORT + '\n\n**As a first step, you must read ' + SKILL + '/references/report-writer.md for instructions on how to write your research report.**', {
  label: 'Write report',
  phase: 'Report',
  agentType: 'general-purpose',
})

phase('Check')
const ISSUES = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['contradicts_owner_decision', 'unsupported_claim', 'missing_topic', 'wrong_or_outdated', 'unclear_plan'] },
          where: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['kind', 'where', 'problem', 'fix'],
      },
    },
  },
  required: ['issues'],
}
const review = await agent('You are a strict editor. Read the report at ' + REPORT + ' and every notes file in ' + NOTES + '/. Find real problems only: (1) anything contradicting these owner decisions: ' + OWNER + ' (2) claims in the report not supported by the notes, or numbers changed from the notes; (3) any of the 8 topics missing or thin; (4) claims the notes themselves flag as uncertain but the report states as fact; (5) a build plan that is vague, unordered, or not starting with the first 3 tracks. Return an empty list if the report is sound. Do not edit files.', {
  label: 'Check report',
  phase: 'Check',
  agentType: 'general-purpose',
  schema: ISSUES,
})
const issues = review && review.issues ? review.issues : []
log('Editor found ' + issues.length + ' issue(s)')
let fixed = null
if (issues.length) {
  fixed = await agent('Edit the report at ' + REPORT + ' in place to fix these issues found by an editor, using the notes in ' + NOTES + '/ as the source of truth. Keep the structure and style; change only what is needed. Issues:\n' + JSON.stringify(issues, null, 2) + '\n\nReturn a short list of what you changed.', {
    label: 'Fix report',
    phase: 'Check',
    agentType: 'general-purpose',
  })
}
return { researched: done, failed: failed, reportWriter: report, issues: issues, fixes: fixed }
