export const meta = {
  name: 'm8-understand-design',
  description: 'Map the code M8 touches, then write and adversarially review the M8 build spec',
  phases: [
    { title: 'Map', detail: '6 readers map subsystems affected by M8' },
    { title: 'Spec', detail: 'Architect writes the M8 build spec' },
    { title: 'Critique', detail: 'Two critics attack the spec; architect revises' },
  ],
}

const REPO = '/home/user/game-gang'
const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const SPEC = SCR + '/m8/M8-SPEC.md'
const REPORT = REPO + '/reports/Forza level browser racing game.md'
const SD = SCR + '/sd-extract/usr/share/games/speed-dreams'

const M8 = [
  'M8 scope (owner-approved): Track 1 club circuit (~3.3 km, temperate pine forest) plus the performance foundation and the minimum touch controller.',
  '- Cleanup (owner decisions): remove Items mode entirely (mystery boxes, items, item HUD slot, item phone button, item sounds/visuals, item tests), remove the arcade speed tricks drift boost and boost pads (owner approved), KEEP slipstream as aero physics; remove tilt/gyro steering and the iOS motion-permission flow; retire the Corniche Run track and its desert/coastal/UAE theme (sea, city, palms, dunes). The Items/Classic lobby mode switch becomes pointless; remove or generalise it. Lap records keep working.',
  '- Licence log: before deriving from any Speed Dreams 1.4 track/car, read its readme licence and record it in a licence log file in the repo; only derive from confirmed Free Art License sources; ship derived track data as separate files with an FAL header and credits; never port Speed Dreams code (GPL) and never ship Speed Dreams sounds.',
  '- Profiling: in-game overlay with draw calls, triangles, GPU time (EXT_disjoint_timer_query_webgl2 when available, else CPU frame time), resolution scale and preset; a scripted fly-through benchmark at 1, 2 and 4 viewports; telemetry (fps, GPU time, resolution, preset, viewport count, device info) sent to the existing Neon backend through a new API route.',
  '- Render path: canvas at devicePixelRatio 1 with an upscale-and-sharpen pass (CAS/RCAS style) when the output is larger than the internal resolution (4K TVs); render all viewports into one shared HDR target with scissored regions and run a single post chain (bloom/vignette clamped per viewport); dynamic resolution driven by GPU time instead of the lowFps trigger; three automatic presets High (1 player), Medium (2), Low (3-4) chosen by player count plus a short loading benchmark, drop one preset between races only; shader precompilation (compileAsync) on the loading screen.',
  '- Trackgen v1: parse a Speed Dreams XML layout into a typed definition; integrate a centre line sampled every 0.5-1 m with elevation and banking; distribute closure error; small JSON override file per track (width, elevation, kerbs, layout tweaks, name); loft the corridor (road, run-off, kerbs, barriers) in 100-200 m chunks; physics mesh from the same stations with a surface ID per triangle (asphalt, kerb, grass, gravel) used for grip/rumble/audio; terrain heightfield blended into the corridor over a 10-30 m shoulder; placement rules for trees, tyre walls, boards, marshal posts; racing line and speed profile. A build-time script converts the XML into committed track data.',
  '- Track 1: a temperate pine-forest club circuit, starting from a Speed Dreams layout but changed enough not to replicate any real circuit (Rudskogen is a real Norwegian circuit; g-track-2 is a fictional ~3.2 km FAL circuit and a likely better base). Sun shadows (r186 SunLight if it exists in node_modules, else CSM/DirectionalLight), blob AO under cars, CC0 asphalt, sawtooth kerbs with stripes, a track mask with an automatic rubber line, CC0 grass/gravel run-off, simple instanced pines (full impostor vegetation is M9), tyre walls/barriers, sky (CC0 HDRI or r186 Sky with clouds). Original track name (no real circuit names, never "Forza").',
  '- Controller (minimum to replace tilt): "Drag steer" default (left ~45% zone, thumb landing point = centre, horizontal only, auto-centre on release, full lock at ~25% of screen height of travel, 4-6% dead zone, gamma 1.3-1.8 curve, ghost wheel under thumb) and "Buttons" (two big arrows ramping 0->full in 150-250 ms, back in 80-120 ms). Shared processing on the TV for every mode: dead zone and curve, speed-sensitive lock, steering-rate limit 120-180 deg/s, 30-50 ms low-pass. GAS pedal tall bottom-right (touch = 100%, sliding down feathers throttle); BRAKE . R just inside it; reverse stays hold-brake-at-standstill but visible: a ring fills over 300-400 ms at standstill, label flips to REVERSE, an R chip lights on phone and TV; after 2 s stuck while holding gas show "Hold BRAKE to reverse"; a Reset action for stuck players. No item button. Handbrake stays available. Pointer Events with setPointerCapture and touch-action:none. Keyboard players keep working.',
  '- Done when: 4 players race Track 1 at 60 fps on Low, 2 on Medium, 1 on High on the M1 at 4K (the owner will run the benchmark on the real device; telemetry lets us read results), p99 frame time < 16.7 ms over a 30-minute soak, no tilt code remains; all repo checks pass (pnpm check: typecheck, lint, format, tests) and the production build works.',
  'Out of scope for M8 (later milestones): real tyre model and assists ladder (M11), engine audio rework (M11), new car models/paint/chase-cam rewrite (M12), premium UI redesign (M13), subscriptions (M14, on hold), impostor forests and Blender bakes (M9), mountain terrain (M10).',
  'Owner decisions: proper racing game (no items), no desert/UAE/Corniche theme, touch-only controls, fictional car brands, locked 60 fps on 1080p and 4K TVs with automatic presets, MacBook Air M1 16 GB + 4K TV is the reference device, everything commercially usable. Speed Dreams data is a starter kit, not a limit.',
].join('\n')

const READERS = [
  { key: 'track', label: 'Map: track, physics, race', focus: 'client/src/games/splitways/track/*, sim/* (world, simulation, car only where it touches the track/surfaces), race/race.ts and tests, and how game.ts builds the track. Explain the Track API (samples, checkpoints, project, spawnAt, sampleAt, curvature), how the physics trimesh and walls are built, how respawn/checkpoints/laps/race order depend on the track, what is Corniche-specific, and exactly what a trackgen must output to replace cornicheRun.ts (types, invariants, sampling density, closed loop). Also read the Speed Dreams XML format for tracks under ' + SD + '/tracks/circuit/g-track-2 and ruudskogen (data only; do not execute anything there) and the parser sketch at ' + SCR + '/tools/sd_tracks.py, and list XML fields useful for trackgen (segments, z, banking, widths, sides/borders/barriers, pits, surfaces).' },
  { key: 'scene', label: 'Map: scene and visuals', focus: 'client/src/games/splitways/scene/* (except itemVisuals), render/sky.ts, render/haze.ts, track/terrain.ts, scene/terrainVisual.ts, scene/scenery.ts, scene/sceneryModels.ts, scene/sea.ts, scene/trackVisual.ts, scene/gantry.ts, scene/podium.ts, assets/ and assets/ASSETS.md. Classify each piece as Corniche/desert-specific (to delete), reusable as-is, or reusable with changes for a pine-forest club circuit. Explain asset loading, textures, how scenery placement uses the track, draw-call strategy (instancing/merging), shadows setup, sky/HDRI/fog setup.' },
  { key: 'render', label: 'Map: render pipeline and perf', focus: 'client/src/games/splitways/render/* (renderer.ts, postProcessing.ts, chaseCamera.ts, any resolution controller), the render loop and viewport layout in game.ts, debug/debugOverlay.ts, config.ts render settings, loop.ts. Explain exactly how per-viewport HDR rendering, MSAA, bloom, composite and dynamic resolution work today and what must change for: one shared HDR target with scissored viewports and a single post chain, DPR-1 canvas plus upscale-and-sharpen at 4K, GPU-time-driven resolution (check whether three r186 exposes timer queries: renderer.info, WebGLRenderer timestamp queries, EXT_disjoint_timer_query_webgl2), presets, compileAsync precompile. Check node_modules/three (version 0.186) for: examples/jsm/lights/SunLight.js, examples/jsm/geometries/LoftGeometry.js, CSM addon, FXAA/SMAA shaders, any CAS/sharpen shader, BatchedMesh. Report file paths that exist.' },
  { key: 'cleanup', label: 'Map: items and boosts removal', focus: 'Everything related to Items mode, mystery boxes, item kinds, item visuals, item HUD slot, item phone button, item sounds, drift boost, boost pads, game modes (GAME_MODES, mode switch in lobby/TV/pad, hub setMode, mode protocol messages), the action channel, and Classic-only lap records: client/src/games/splitways/race/items.ts, boosts.ts, items.test.ts, scene/itemVisuals.ts, itemIcons.ts, hud/viewportHud.ts, audio/raceAudio.ts, game.ts, tv/SplitWaysStage.tsx, tv/stage.css, pad files, client/src/hub/hub.ts, client/src/tv/*, client/src/pad/*, shared/src/protocol.ts, client/src/games/registry.ts, config.ts, input/keyboard.ts, sim/car.ts (boost/draft hooks), README/DECISIONS/PROGRESS/ROADMAP mentions. Produce an exact removal list (file -> what to delete/keep), noting slipstream (draft) must stay and that the generic action channel could be reused for a Reset action.' },
  { key: 'pad', label: 'Map: phone controller and input', focus: 'client/src/pad/* (PadApp, padStore, device, profile, screens), client/src/games/splitways/pad/* (SplitWaysController.tsx, controller.css, steering.ts and tests), client/src/pad/controllers.ts, client/src/net/padTransport.ts, hostTransport.ts, rtc.ts, shared/src/protocol.ts input messages, the input handling in game.ts and input/keyboard.ts, and how the TV applies input to cars (sim/car.ts input fields). Explain the current tilt/buttons modes, the iOS motion permission flow, input message format and send rate, heartbeat/coast rules, haptics, wake lock, reverse logic, and what must change for Drag steer + Buttons, analog GAS, BRAKE . R with reverse ring and R chip (phone and TV), Reset action, TV-side steering processing (dead zone, curve, speed-sensitive lock, rate limit, low-pass).' },
  { key: 'server', label: 'Map: server and telemetry', focus: 'server/src/* (api/router.ts, vercel.ts, local/server.ts, db/store.ts, db/schema.ts, db/neon.ts, db/pglite.ts, migrate.ts, env.ts) and shared/src/api.ts, plus scripts/build-vercel.mjs. Explain how to add a POST /api/telemetry route and a telemetry table (schema, validation with zod, rate limiting/size limits, retention), how routes are registered for Vercel (function aliases list in build-vercel.mjs), how tests cover the router/store, and how the client would send telemetry (fetch, sendBeacon).' },
]

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    subsystem: { type: 'string' },
    files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, role: { type: 'string' } }, required: ['path', 'role'] } },
    keyApis: { type: 'array', items: { type: 'string' } },
    m8Changes: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, where: { type: 'string' }, notes: { type: 'string' } }, required: ['what', 'where'] } },
    facts: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['subsystem', 'files', 'keyApis', 'm8Changes', 'facts', 'risks'],
}

phase('Map')
const maps = await parallel(READERS.map((r) => () =>
  agent('You are mapping part of the codebase at ' + REPO + ' (a three.js r186 + Rapier split-screen racing game with phone controllers) to prepare milestone M8. Read the code; do not edit any files and do not run the dev server.\n\nYour area: ' + r.focus + '\n\nM8 context:\n' + M8 + '\n\nReturn a precise map: files and their roles, key APIs/types (with signatures), the concrete changes M8 needs in your area (file and symbol level), verified facts (cite file:line), and risks. Be exact; other engineers will build from this without re-reading everything.', {
    label: r.label, phase: 'Map', schema: MAP_SCHEMA,
  })))
const okMaps = maps.filter(Boolean)
log('Mapped ' + okMaps.length + '/6 areas')

phase('Spec')
const ctx = JSON.stringify(okMaps)
const SPEC_BRIEF = 'Write the M8 build spec as a Markdown file at ' + SPEC + ' (create the folder). It will be handed to separate implementation agents, so it must be self-contained, exact and unambiguous.\n\nRequired sections:\n1. Goal and done-criteria (from the scope below).\n2. Work packages, in this order and with explicit dependencies: P1 Cleanup (first, alone); then P2 Trackgen + Track 1 data, P3 Render path + profiling + presets + telemetry, P4 Controller, which run in parallel in separate git worktrees; then P5 Track 1 dressing and integration (needs P2+P3); then P6 Docs/licence log. For each package: purpose, exact files it OWNS (creates/edits), files it must NOT touch (to avoid merge conflicts; if two packages must edit the same file, e.g. game.ts or config.ts, assign minimal clearly separated edits and say exactly which functions/sections each may touch), step-by-step tasks, acceptance tests (unit tests to add, commands that must pass, manual/browser checks), and pitfalls.\n3. Contracts between packages as TypeScript types/interfaces (e.g. the trackgen output and the new Track API, surface IDs, the preset object, the telemetry payload, the controller input message and Reset action), so packages built in parallel fit together at merge.\n4. Data and asset plan: which Speed Dreams layout to base Track 1 on (verify licence from its readme), the override JSON, CC0 assets to download (exact Poly Haven/ambientCG asset names and resolutions; verify they exist), where they go, licence log format, ASSETS.md updates, size budget.\n5. Testing plan: unit tests, the scripted benchmark, headless browser checks with Playwright + SwiftShader (scripts exist in /tmp/claude-0/e2e for reference; dev server via /tmp/claude-0/devctl.sh start|stop on ports 4000/4443), and what the owner must run on the real M1.\n6. Risks and fallbacks.\n\nRules: implementation agents must not push to git or deploy (pushing the branch auto-deploys the public site); they commit locally on their own branch. Keep code style consistent with the repo (TypeScript strict, ESLint, Prettier, concise comments, config values in config.ts). Verify technical facts against node_modules/three 0.186 and the code before relying on them.\n\nInputs: the codebase maps below (JSON), the research report at ' + REPORT + ' (read lines 7-59 rendering, 117-181 tracks, 339-396 controller, 443-499 build plan/M8), and the Speed Dreams data at ' + SD + ' (read-only data; never execute anything there).\n\nM8 scope:\n' + M8 + '\n\nCodebase maps:\n' + ctx + '\n\nReturn a short summary of the spec when done.'
const spec1 = await agent(SPEC_BRIEF, { label: 'Architect: write spec', phase: 'Spec' })

phase('Critique')
const CRIT_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      section: { type: 'string' },
      problem: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['severity', 'section', 'problem', 'fix'] } },
  },
  required: ['issues'],
}
const LENSES = [
  'FEASIBILITY AND CORRECTNESS: check every technical claim against the real code and node_modules/three 0.186 (APIs that do not exist, wrong file paths, wrong assumptions about how the code works, contracts that will not compile, steps that cannot work in WebGL2 or Rapier, asset names that do not exist). Also check the parallel packages cannot conflict at merge: file ownership must be disjoint or precisely partitioned.',
  'COMPLETENESS AND PRODUCT: check the spec covers every M8 scope item and done-criterion, respects the owner decisions, has testable acceptance criteria for each package, leaves the game fully playable after each merge (lobby, 1-4 players, phones, keyboard players, results, lap records, deploy build), and does not drift into later milestones. Flag vague steps an implementer could get wrong.',
]
const critiques = await parallel(LENSES.map((lens, i) => () =>
  agent('You are a skeptical senior reviewer. Read the M8 spec at ' + SPEC + ' and verify it against the codebase at ' + REPO + ' (read code as needed; do not edit files). Lens: ' + lens + '\n\nM8 scope for reference:\n' + M8 + '\n\nReport only real problems with concrete fixes. Return an empty list if none.', {
    label: 'Critic ' + (i + 1), phase: 'Critique', schema: CRIT_SCHEMA,
  })))
const issues = critiques.filter(Boolean).flatMap((c) => c.issues)
log('Critics raised ' + issues.length + ' issue(s): ' + issues.filter((x) => x.severity === 'blocker').length + ' blockers, ' + issues.filter((x) => x.severity === 'major').length + ' major')
let revised = null
if (issues.length) {
  revised = await agent('Revise the M8 spec at ' + SPEC + ' in place to resolve these reviewer issues. Verify each against the code before changing; if an issue is wrong, leave the spec and say why. Keep the spec self-contained. Issues:\n' + JSON.stringify(issues, null, 2) + '\n\nReturn: a list of changes made and any issues rejected with reasons.', { label: 'Architect: revise', phase: 'Critique' })
}
return { maps: okMaps.map((m) => m.subsystem), specSummary: spec1, issues: issues, revision: revised }
