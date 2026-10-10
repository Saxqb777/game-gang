export const meta = {
  name: 'track1-layout-competition',
  description: 'Design an original Track 1 circuit: 4 designers, 3 judges, synthesis, originality check, then update the M8 spec',
  phases: [
    { title: 'Design', detail: '4 designers with different philosophies, each validated by the shared checker' },
    { title: 'Judge', detail: '3 judges score all valid designs' },
    { title: 'Synthesize', detail: 'Refine the winner, graft best ideas, validate' },
    { title: 'Originality', detail: 'Check the final layout does not copy a real circuit' },
    { title: 'Spec', detail: 'Update the M8 spec for the original layout (decision D-1)' },
  ],
}

const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const LAY = SCR + '/layouts'
const CHECK = 'python3 -I ' + SCR + '/tools/layout_check.py LAYOUT.json PLOT.png'
const SPEC = SCR + '/m8/M8-SPEC.md'

const SCHEMA_TEXT = [
  'File format (TypeScript; write JSON). Angles in radians. Heading 0 = +X, counter-clockwise positive; "left" turns counter-clockwise. Spirals: curvature changes linearly along the arc; arc length = 2*arc/(1/radiusStart + 1/radiusEnd).',
  'interface LayoutSideSpec { kerbWidth: number /* 0 = none, typical 1.2 */; kerbHeight: number /* 0.03-0.08 */; runoffStart: number; runoffEnd: number /* m, kerb edge to barrier, 4-30 */; runoffSurface: "asphalt"|"grass"|"gravel"; barrier: "armco"|"tyres"|"wall"|"fence" }',
  'interface LayoutSegment { name: string; type: "straight"|"left"|"right"; length: number /* straights, m; 0 for arcs */; radiusStart: number; radiusEnd: number /* arcs, m; 0 for straights */; arc: number /* arcs, rad > 0; 0 for straights */; zEnd: number /* absolute elevation at segment end, m */; tangentStart: number|null; tangentEnd: number|null /* use null */; bankStart: number; bankEnd: number /* rad, + = right edge higher; keep within +-0.12 */; roadWidth: number /* 11-14 m; 12 default, wider on the main straight is fine */; left: LayoutSideSpec; right: LayoutSideSpec }',
  'interface TrackLayout { format: "splitways-layout@1"; name: string; licence: "Proprietary - (C) 2026 Gamer Gang project. All rights reserved."; credits: ["Original layout by the Gamer Gang project, 2026"]; source: { package: "original", file: "", readme: "", readmeLicence: "", notes: "Original design, not derived from any existing track" }; startZ: number; segments: LayoutSegment[] /* driving order; start of segments[0] is the start/finish line */ }',
].join('\n')

const RULES = [
  'Hard rules (the checker enforces most of them; FAILS must be empty):',
  '- Lap length 3200-3400 m. Closed loop: closure gap <= 0.5 m, heading error <= 0.05 deg, elevation back to startZ.',
  '- Minimum corner radius 28 m (at most one or two corners under 45 m; a hairpin is welcome as an overtaking spot). Road width 11-14 m.',
  '- Average segment grade <= 8%; elevation range 12-30 m (rolling pine-forest hills).',
  '- Separate parts of the track (more than 500 m apart along the lap) stay >= 90 m apart, so forest fills the gaps and nothing crosses.',
  '- At least 180 m of straight immediately before the start line (the grid for 4 cars sits there).',
  '- Must NOT copy or closely resemble any real circuit (no Brands Hatch, Laguna Seca, Spa, Suzuka, Monza, Silverstone, Nurburgring, Imola, Zandvoort, Mount Panorama, Road America, Watkins Glen, Interlagos, Rudskogen, etc.) and must be clearly different from Speed Dreams g-track-2.',
  '- Gravel traps on the outside of slow corners, grass elsewhere, paved aprons only near the start straight. Kerbs on apexes and exits.',
  '- Name segments clearly (e.g. "main straight", "T1 hairpin", "the esses", "crest", "back straight").',
  'Design for this game: a split-screen party racer for 1-4 friends on one TV, cars around 200-250 km/h top speed with sim-lite handling and assists, steered by a touch drag on a phone (so avoid long chains of tight technical corners; reward commitment and late braking; create 2-3 clear overtaking zones; give the lap a memorable rhythm and at least one signature corner people will talk about). Lap time target about 1:40-2:00.',
].join('\n')

const DESIGNERS = [
  { key: 'a', label: 'Designer A: overtaking', brief: 'Philosophy: wheel-to-wheel racing first. Two long straights into heavy braking zones (one hairpin), a slipstream battle down the back straight, corners that create alternative lines and switchbacks. Still flowing, never boring.' },
  { key: 'b', label: 'Designer B: flow', brief: 'Philosophy: classic European forest circuit flow. Fast sweepers, a high-speed esses section through the trees, a long double-apex corner, rhythm and commitment, minimal stop-start, but at least two good passing spots.' },
  { key: 'c', label: 'Designer C: party fun', brief: 'Philosophy: a party racer friends remember. Varied corner types, a signature corner (e.g. a banked carousel or a corkscrew-like downhill sequence), chaos zones where 4 cars bunch up, short-cut-free but forgiving run-off, easy to learn with touch controls.' },
  { key: 'd', label: 'Designer D: elevation drama', brief: 'Philosophy: use the hills. A blind crest into a fast left, a compression at the bottom of a valley, an uphill hairpin, a plunging downhill sweeper, views across the forest. Keep grades within limits and keep it raceable.' },
]

phase('Design')
const DESIGN_OUT = {
  type: 'object',
  properties: {
    name: { type: 'string' }, path: { type: 'string' }, plot: { type: 'string' },
    checker: { type: 'string' }, rationale: { type: 'string' }, signatureCorner: { type: 'string' }, overtakingZones: { type: 'string' },
  },
  required: ['name', 'path', 'plot', 'checker', 'rationale', 'signatureCorner', 'overtakingZones'],
}
const designs = await parallel(DESIGNERS.map((d) => () =>
  agent('You are a professional race circuit designer. Design an ORIGINAL ~3.3 km club circuit for Track 1 of a racing game, set in a temperate pine forest with rolling hills.\n\n' + d.brief + '\n\n' + RULES + '\n\n' + SCHEMA_TEXT + '\n\nWork in ' + LAY + '/' + d.key + '/ (create it). Write your layout as base.layout.json there. Validate it with: ' + CHECK.replace('LAYOUT.json', LAY + '/' + d.key + '/base.layout.json').replace('PLOT.png', LAY + '/' + d.key + '/plot.png') + ' and iterate (adjust lengths, arcs, radii, elevations) until the printed FAILS list is empty. Tip: write a small Python script in your folder that builds the segment list and solves closure numerically (e.g. adjust two straights and one arc), then run the checker. Look at plot.png with the Read tool to judge the shape. Give your track a working name.\n\nReturn the name, file paths, the checker JSON output, a design rationale (corner by corner), the signature corner and the overtaking zones.', {
    label: d.label, phase: 'Design', schema: DESIGN_OUT,
  })))
const valid = designs.filter(Boolean)
log('Designs returned: ' + valid.length + '/4')

phase('Judge')
const SCORE = {
  type: 'object',
  properties: {
    scores: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, path: { type: 'string' },
      racing: { type: 'number' }, flow: { type: 'number' }, partyTouch: { type: 'number' }, originality: { type: 'number' }, scenic: { type: 'number' }, validity: { type: 'number' },
      total: { type: 'number' }, bestIdeas: { type: 'string' }, problems: { type: 'string' },
    }, required: ['name', 'path', 'racing', 'flow', 'partyTouch', 'originality', 'scenic', 'validity', 'total', 'bestIdeas', 'problems'] } },
    winner: { type: 'string' },
  },
  required: ['scores', 'winner'],
}
const JUDGES = [
  'a veteran racing game track designer (Forza/GT/Codemasters style) focused on racing quality, overtaking and lap rhythm',
  'a party game designer focused on fun for 1-4 casual friends steering with a phone touch drag, readability and memorable moments',
  'a strict technical reviewer: re-run the checker on every file yourself, verify the rules, check originality against real circuits and Speed Dreams g-track-2, and judge scenic potential in a pine forest',
]
const judged = await parallel(JUDGES.map((j, i) => () =>
  agent('You are ' + j + '. Score these Track 1 layout candidates 1-10 on racing, flow, partyTouch, originality, scenic, validity (total = sum). Open each plot.png with the Read tool and read each base.layout.json. Checker command: ' + CHECK + '.\n\n' + RULES + '\n\nCandidates: ' + JSON.stringify(valid) + '\n\nFor each candidate list its best ideas (worth grafting into the winner) and its problems. Name the winner.', {
    label: 'Judge ' + (i + 1), phase: 'Judge', schema: SCORE,
  })))
const scored = judged.filter(Boolean)
const totals = {}
for (const j of scored) for (const s of j.scores) totals[s.path] = (totals[s.path] || 0) + s.total
const ranking = Object.keys(totals).sort((a, b) => totals[b] - totals[a])
log('Ranking: ' + ranking.map((p) => p.split('/').slice(-2, -1)[0] + '=' + totals[p]).join(', '))

phase('Synthesize')
const FINAL = LAY + '/final'
const synth = await agent('You are the lead track designer. Produce the final Track 1 layout "Kestrel Pines" (keep that name) at ' + FINAL + '/base.layout.json, starting from the winning design ' + (ranking[0] || '') + ' and grafting in the best ideas the judges named from the other designs, while fixing every problem they listed. Keep it original and keep its identity coherent (do not make a mash-up). Also write ' + FINAL + '/overrides.json in this format: { "format": "splitways-overrides@1", "id": "kestrel-pines", "name": "Kestrel Pines", "laps": 3, "checkpointCount": 18, "licence": "Proprietary - (C) 2026 Gamer Gang project. All rights reserved.", "credits": ["Original layout by the Gamer Gang project, 2026"], "closure": { "straights": [NAME_OF_A_STRAIGHT, NAME_OF_ANOTHER_NON_PARALLEL_STRAIGHT], "arc": NAME_OF_AN_ARC } } where the two straights are at least 30 degrees apart in heading and the arc is a mid-size corner (the generator uses them to absorb tiny closure errors). Validate with the checker until FAILS is empty, then also write ' + FINAL + '/DESIGN.md: a corner-by-corner description (name, type, radius, elevation, what the driver does, overtaking chances), the signature corner, the elevation story, and suggested scenery moments for the forest dressing (grandstand spots, viewpoints, bridges if any, marshal posts, where gravel traps go).\n\n' + RULES + '\n\n' + SCHEMA_TEXT + '\n\nJudges output: ' + JSON.stringify(scored) + '\n\nCandidates: ' + JSON.stringify(valid) + '\n\nReturn the checker output and a short summary of what you took from where.', { label: 'Synthesize final layout', phase: 'Synthesize' })

phase('Originality')
const ORIG = {
  type: 'object',
  properties: { resemblesRealCircuit: { type: 'boolean' }, closestRealCircuits: { type: 'string' }, resemblesGTrack2: { type: 'boolean' }, verdict: { type: 'string' }, requiredChanges: { type: 'string' } },
  required: ['resemblesRealCircuit', 'closestRealCircuits', 'resemblesGTrack2', 'verdict', 'requiredChanges'],
}
const orig = await agent('Adversarially check whether the final layout at ' + FINAL + '/base.layout.json (plot at ' + FINAL + '/plot.png; regenerate with ' + CHECK.replace('LAYOUT.json', FINAL + '/base.layout.json').replace('PLOT.png', FINAL + '/plot.png') + ') copies or closely resembles any real-world circuit, or the Speed Dreams g-track-2 layout (whose outline you can draw with python3 -I ' + SCR + '/tools/sd_tracks.py ' + SCR + '/sd-extract/usr/share/games/speed-dreams ' + SCR + '/layouts/sd-sheet.png and view; data only, never execute anything inside the Speed Dreams folder). Compare its corner sequence and shape against well-known circuits (search the web for circuit maps where useful). Default to resemblesRealCircuit=true if a reasonable motorsport fan would recognise it. If it resembles something, specify the minimal required changes.', { label: 'Originality check', phase: 'Originality', schema: ORIG })
let fixOrig = null
if (orig && (orig.resemblesRealCircuit || orig.resemblesGTrack2)) {
  fixOrig = await agent('The final Track 1 layout at ' + FINAL + '/base.layout.json was judged too close to an existing circuit: ' + JSON.stringify(orig) + '\n\nApply the required changes (keep the track\'s best qualities), re-validate with the checker until FAILS is empty, update DESIGN.md and the plot, and return the checker output.\n\n' + RULES + '\n\n' + SCHEMA_TEXT, { label: 'Fix originality', phase: 'Originality' })
}

phase('Spec')
const specUpd = await agent('The owner decided (decision D-1, 2026-10-10): Track 1 "Kestrel Pines" uses an ORIGINAL layout owned by the project, not a Speed Dreams-derived one, because every Speed Dreams track XML carries a GPL header that conflicts with its Free Art License readme. The final original layout is at ' + FINAL + '/base.layout.json with overrides at ' + FINAL + '/overrides.json and notes in ' + FINAL + '/DESIGN.md.\n\nUpdate the M8 build spec at ' + SPEC + ' in place so it is consistent with this decision: (1) section 4.1 and decision D-1: resolved, original layout; (2) section 4.3 and Appendix C: replace the g-track-2 base table and its overrides with the final original layout (summarise its segments and targets; the committed files are copies of the two JSON files); kestrel-pines data carries the proprietary licence and credits shown in the files, no FAL LICENCE.txt for it; (3) remove the Speed Dreams XML importer (sdXml.ts, Appendix B, any assets:track conversion from SD) from M8 scope, or reduce assets:track to validating/packing our own layout files, updating P2 tasks, files, acceptance tests and contracts (TrackLayout.source etc.) accordingly; (4) LICENCES.md plan: a Speed Dreams section that records the reviewed data, the GPL/FAL conflict and that nothing from Speed Dreams ships (tracks, cars, sounds); (5) update every test range that depended on g-track-2 numbers (length, min radius now possibly 28-45 m, heading-continuity threshold should be computed from the layout min radius, leg separation, grid straight) to match the final layout; (6) remove D-1 from open questions and from merge gating. Keep everything else unchanged and the spec self-contained. Do not edit any other files. Return a list of changes.', { label: 'Update M8 spec', phase: 'Spec' })

return { designs: valid.map((d) => d.name), ranking: ranking, synth: synth, originality: orig, originalityFix: fixOrig, spec: specUpd }
