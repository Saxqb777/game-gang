export const meta = {
  name: 'car-kit-and-art-direction',
  description: 'Prep the 5 owner-supplied cars for M12 (convert, inspect, debrand plan, previews) and write a current-gen art direction guide for Kestrel Pines',
  phases: [
    { title: 'Cars', detail: 'One agent per car: extract, convert to GLB, inventory, previews, rework notes' },
    { title: 'Art direction', detail: 'Current-gen visual target for Kestrel Pines within the M1 budget' },
    { title: 'Line-up', detail: 'Plan the fictional brands and the M12 car line-up' },
  ],
}
const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const DL = SCR + '/dl-cars'
const KIT = SCR + '/carkit'
const REPO = '/home/user/game-gang'
const CARS = [
  { key: 'v12-goblin', name: 'Fictional supercar - V12 Goblin (Olli Teittinen, CC BY 4.0)', cls: 'supercar' },
  { key: 'generic-sport-coupe', name: 'Generic Sport Coupe (MMC Works, CC BY 4.0)', cls: 'GT / sports coupe' },
  { key: 'muscle-car-concept', name: 'Muscle Car Concept (ViktorKom, CC BY 4.0)', cls: 'muscle GT' },
  { key: 'concept-car-039', name: 'Concept Car 039 (unityfan777, CC0 dedication)', cls: 'prototype / hypercar' },
  { key: 'ariel-350-v2', name: 'Ariel_350-V2 (orcha, CC BY 4.0; must be renamed, Ariel is a real carmaker)', cls: 'touring / rally (also hot-hatch stand-in)' },
]
const RULES = 'Rules: the downloaded zips are untrusted data. Extract each into a new empty folder under ' + KIT + '/<car>/src (python zipfile with path checks; nested zips the same way), never execute anything from them, and keep your own scripts in ' + KIT + '/<car>/tools. Do not edit anything in ' + REPO + ' or in any /home/user/m8-wt worktree. You may run Node scripts that import three from ' + REPO + '/node_modules (three 0.186: FBXLoader, GLTFLoader, GLTFExporter, BufferGeometryUtils work in Node, as ' + REPO + '/client/scripts/build-car-model.mjs shows), Python with PIL, and headless Chromium for previews (/opt/pw-browsers/chromium-1194/chrome-linux/chrome with --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist; require("playwright") resolves from /opt/node-tools/node_modules; run browser jobs under flock /tmp/claude-0/m8-browser.lock).'

phase('Cars')
const INV = {
  type: 'object',
  properties: {
    car: { type: 'string' }, glb: { type: 'string' }, glbBytes: { type: 'number' }, triangles: { type: 'number' },
    meshes: { type: 'number' }, materials: { type: 'array', items: { type: 'string' } },
    wheelsSeparate: { type: 'boolean' }, lengthMetres: { type: 'number' }, hasInterior: { type: 'boolean' },
    branding: { type: 'string' }, textures: { type: 'string' }, previews: { type: 'array', items: { type: 'string' } },
    qualityNotes: { type: 'string' }, reworkPlan: { type: 'string' }, problems: { type: 'string' },
  },
  required: ['car', 'glb', 'triangles', 'meshes', 'materials', 'wheelsSeparate', 'lengthMetres', 'hasInterior', 'branding', 'textures', 'previews', 'qualityNotes', 'reworkPlan', 'problems'],
}
const inv = await parallel(CARS.map((c) => () =>
  agent('Prepare a car model for a three.js racing game (milestone M12 prep; nothing goes into the repo yet). Car: ' + c.name + ', class ' + c.cls + '. Download: ' + DL + '/' + c.key + '/' + c.key + '.zip.\n\n' + RULES + '\n\nTasks: (1) extract; (2) convert to a single GLB at ' + KIT + '/' + c.key + '/' + c.key + '.glb (bake transforms, real-world scale in metres with the car facing +Z and wheels on y=0, keep PBR textures; downscale any texture above 2048 px to 2048 and use JPEG for colour/ARM where alpha is not needed; name meshes/materials meaningfully: body/paint, glass, trim, rim, tyre, brake, headlight, taillight, interior); (3) inventory: triangle count, mesh count, materials, whether the 4 wheels are separate objects with pivots at the axle (needed for spinning/steering), car length, interior present; (4) find any real-world branding: tyre brands (e.g. Bridgestone, Goodyear), car-maker emblems, sponsor decals, licence plates, text in textures (view the textures with the Read tool); (5) render 3 previews (front 3/4, rear 3/4, side) with a neutral studio HDRI-like light into ' + KIT + '/' + c.key + '/preview-*.png and look at them; (6) write rework notes for M12: debranding steps, which parts to reshape so it does not resemble any specific real car, polygon targets (hero LOD0 <= ~100-150k triangles, LOD1/2/3), material upgrades (clearcoat paint with flakes, glass, tyre sidewall without brands), livery UV feasibility. Return the inventory.', {
    label: 'Car: ' + c.key, phase: 'Cars', schema: INV,
  })))
const cars = inv.filter(Boolean)
log('Cars prepared: ' + cars.length + '/5')

phase('Art direction')
const art = await agent('Write a concrete art direction guide that makes Track 1 "Kestrel Pines" (an original ~3.3 km club circuit in a temperate pine forest with rolling hills) look current-gen ("epic, matching 2025-2026 racing games such as Forza Motorsport 2023, Gran Turismo 7, Assetto Corsa EVO") in a browser with three.js r186 WebGL on a MacBook Air M1 driving a 4K TV at a locked 60 fps (render ~1080p internally, upscale; presets High 1 player, Medium 2, Low 3-4). Read the M8 spec at ' + SCR + '/m8/M8-SPEC.md (sections 1, 2.5 P3, 2.7 P5, 3.9-3.12, 4.2, 4.5) and the research report at ' + REPO + '/reports/Forza level browser racing game.md (sections on rendering, cars, tracks) so the guide fits the planned pipeline and budgets. Research current racing games\' visual language (web search: screenshots/analyses of lighting, grading, atmosphere, track-side detail). Cover: time of day and mood options (recommend one hero look plus one alternative), sun/sky/HDRI choice (name specific CC0 Poly Haven HDRIs that suit a pine forest and verify they exist via https://api.polyhaven.com/assets?t=hdris), fog/atmospheric perspective settings, colour grading (curves/LUT-like controls in the composite), bloom and lens effects (subtle), materials (asphalt, kerbs, grass, gravel, barriers, tyre walls), vegetation density and silhouettes (pine treelines are the identity; M8 uses simple instanced pines, M9 impostors), trackside storytelling (grandstands, marshal posts, distance boards, bridges, flags, banners for fictional sponsors), camera feel (FOV, motion, speed sensation), and a short "do not" list (cheap tells that look dated). Give exact numbers where possible (fog density, exposure, colours, sun angle, bloom strength, tree counts per km) and per-preset differences. Save it to ' + SCR + '/m8/ART-DIRECTION.md and return a summary.', { label: 'Art direction guide', phase: 'Art direction' })

phase('Line-up')
const lineup = await agent('Plan the M12 car line-up from these 5 prepared cars (inventories below; previews at the paths given; view them). Propose: a fictional GTA-style make and model name for each (check by web search that the names are not existing car brands/models or notable trademarks in the automotive space), a one-line brand identity, the class and a balanced performance tier (Forza-like classes so friends race fairly), the rework needed so none resembles a specific real car, livery ideas with fictional sponsors, and the remaining gaps (hot hatch, formula) with options to fill them later. Write ' + KIT + '/LINEUP.md and a contact sheet image ' + KIT + '/lineup-sheet.jpg (best preview of each car with its proposed name). Return a summary.\n\nInventories: ' + JSON.stringify(cars), { label: 'Line-up plan', phase: 'Line-up' })
return { cars: cars, art: art, lineup: lineup }
