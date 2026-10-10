export const meta = {
  name: 'car-sourcing',
  description: 'Find free, commercially usable, original-design car models for fictional GTA-style brands, verify licence and real-car risk, shortlist',
  phases: [
    { title: 'Search', detail: '4 searchers across Sketchfab (CC0, CC-BY), other libraries, and extra queries' },
    { title: 'Verify', detail: 'Adversarial licence + replica + quality check per candidate' },
    { title: 'Shortlist', detail: 'Rank, download thumbnails, write shortlist JSON' },
  ],
}

const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const OUT = SCR + '/cars'
const CRITERIA = [
  'We need car 3D models for a paid subscription browser racing game (three.js, glTF) with fictional GTA-style brands.',
  'Hard requirements:',
  '- Licence allows commercial use in a paid product: CC0, CC-BY 4.0 (credit), or CC-BY-SA (acceptable but note share-alike on the model). Reject NC, ND, editorial, "personal use only", unknown or missing licences, and anything marked as ripped from a game.',
  '- Downloadable for free.',
  '- NOT a replica of a real production or race car (e.g., no Ferrari, Porsche, Lamborghini, Nissan GT-R, BMW, Mercedes, Audi, Ford, Toyota, Honda, McLaren, Bugatti, Koenigsegg, Chevrolet, Dodge, Tesla shapes). Original/concept designs, or generic designs that do not copy one specific real car. Rename/de-badge is NOT enough if the body copies a real car.',
  '- NOT AI-generated (reject models tagged createdwithai, ai, meshy, tripo, luma, or with AI-like topology/names).',
  '- Realistic or high-quality semi-realistic style (no toy/voxel/low-poly cartoon), ideally 20k-200k triangles, PBR textures or clean materials, separate wheels preferred, roughly correct scale.',
  '- Useful classes for a racing game: GT/sports coupe, supercar, hatchback/hot hatch, muscle/grand tourer, prototype/Le Mans style, touring/rally car, open-wheel/formula.',
  'Sketchfab public API works without login for search: https://api.sketchfab.com/v3/search?type=models&q=QUERY&downloadable=true&count=24 and https://api.sketchfab.com/v3/models?q=QUERY&downloadable=true&license=cc0 (license values: cc0, by, by-sa). Model details: https://api.sketchfab.com/v3/models/UID (includes license, faceCount, vertexCount, tags, categories, thumbnails, description, user). Downloads need login (the owner will download the final picks), so do not try to download models.',
  'Do not execute any downloaded content. Use curl or the WebFetch tool for HTTP.',
].join('\n')

const CAND = {
  type: 'object',
  properties: {
    candidates: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, url: { type: 'string' }, source: { type: 'string' }, author: { type: 'string' },
      licence: { type: 'string' }, triangles: { type: 'number' }, carClass: { type: 'string' },
      thumbnail: { type: 'string' }, notes: { type: 'string' },
    }, required: ['name', 'url', 'source', 'author', 'licence', 'carClass', 'thumbnail', 'notes'] } },
  },
  required: ['candidates'],
}

const SEARCHERS = [
  { label: 'Sketchfab CC0', task: 'Search Sketchfab for downloadable CC0 cars. Use many queries: car, sports car, race car, racing car, concept car, supercar, hypercar, gt car, gt3, coupe, hatchback, hot hatch, muscle car, le mans, lmp, prototype race car, rally car, touring car, formula car, open wheel, vehicle, futuristic car (only if realistic). Page through results (cursor) until quality runs out. Check each promising model via the model details API.' },
  { label: 'Sketchfab CC-BY', task: 'Search Sketchfab for downloadable CC-BY (license=by) and CC-BY-SA cars with the same broad query list (car, sports car, race car, concept car, supercar, gt car, coupe, hatchback, muscle car, le mans prototype, rally car, touring car, formula car, generic car, fictional car, original car design). Prefer staff picks and high like counts. Check each promising model via the model details API.' },
  { label: 'Other libraries', task: 'Search other free sources for realistic original car models with commercial-use licences: Poly Pizza, OpenGameArt, itch.io (CC0 vehicle packs), Kenney and Quaternius (only if not toy-like), BlendSwap (CC0/CC-BY), Khronos glTF-Sample-Assets (e.g., CarConcept, ToyCar; check licence and realism), Fab.com free assets (check the Fab licence terms for commercial use in a web game and redistribution of the glTF to browsers), CGTrader free and TurboSquid free (check their royalty-free licence terms for real-time web games), Free3D (check licence). Report each candidate with its exact licence terms.' },
  { label: 'Sketchfab designers', task: 'Find Sketchfab designers who publish original-design (concept) cars under CC0 or CC-BY, and list their best downloadable models. Search queries like "original design car", "concept car design", "my own car design", "fictional car", "car concept", "vehicle design", "speedform", plus Blender car modelers known for concept work. Check each model via the details API.' },
]

phase('Search')
const found = await parallel(SEARCHERS.map((s) => () =>
  agent(CRITERIA + '\n\nYour search: ' + s.task + '\n\nReturn up to 25 candidates that plausibly meet ALL hard requirements, with the exact licence string, triangle count if known, class, a thumbnail image URL (Sketchfab: the largest thumbnails.images url), and notes on realism, wheels, textures and any real-car resemblance risk.', {
    label: s.label, phase: 'Search', schema: CAND,
  })))
const all = found.filter(Boolean).flatMap((f) => f.candidates)
const seen = new Set()
const unique = all.filter((c) => { const k = (c.url || c.name).toLowerCase().replace(/\/$/, ''); if (seen.has(k)) return false; seen.add(k); return true })
log('Found ' + all.length + ' candidates, ' + unique.length + ' unique')

const VERDICT = {
  type: 'object',
  properties: {
    keep: { type: 'boolean' },
    licenceVerified: { type: 'string' },
    commercialOk: { type: 'boolean' },
    realCarReplica: { type: 'string' },
    aiGenerated: { type: 'boolean' },
    triangles: { type: 'number' },
    quality: { type: 'number' },
    carClass: { type: 'string' },
    reasons: { type: 'string' },
  },
  required: ['keep', 'licenceVerified', 'commercialOk', 'realCarReplica', 'aiGenerated', 'quality', 'carClass', 'reasons'],
}

phase('Verify')
const verified = await parallel(unique.map((c, i) => () =>
  agent(CRITERIA + '\n\nAdversarially verify this candidate. Default to keep=false if anything is uncertain. Fetch its page or API details yourself (for Sketchfab use https://api.sketchfab.com/v3/models/UID where UID is the id in the URL). Check: (1) the exact current licence and that commercial use is allowed; (2) whether the body copies a specific real car (look at the name, tags, description and the thumbnail image; download the thumbnail to a scratch file and view it with the Read tool if you can) and name the car if so; (3) AI-generated signs; (4) triangle count and texture/material quality; quality score 1-10 for a realistic racing game.\n\nCandidate: ' + JSON.stringify(c), {
    label: 'Verify ' + (i + 1) + ': ' + String(c.name).slice(0, 30), phase: 'Verify', schema: VERDICT,
  }).then((v) => (v ? Object.assign({}, c, { verdict: v }) : null))))
const kept = verified.filter(Boolean).filter((c) => c.verdict.keep && c.verdict.commercialOk && !c.verdict.aiGenerated)
log('Verified: ' + kept.length + ' of ' + unique.length + ' pass')

phase('Shortlist')
const shortlist = await agent('Make the final car shortlist for the owner. Candidates that passed verification (JSON): ' + JSON.stringify(kept) + '\n\nTasks:\n1. Rank them for a realistic racing game line-up of 4-6 base bodies across classes (GT/sports coupe, supercar, hot hatch, muscle/GT, prototype, touring/rally, formula). Prefer quality, original design, clean licence (CC0 > CC-BY > CC-BY-SA), sensible triangle counts.\n2. Create ' + OUT + ' and download each shortlisted thumbnail image to ' + OUT + '/thumbs/NN.jpg (or png).\n3. Write ' + OUT + '/shortlist.json: an array of {rank, name, url, author, licence, attribution (exact credit line), triangles, carClass, quality, thumb (local path), why, risks}.\n4. Also list rejected-but-close candidates with the reason in ' + OUT + '/rejected.json.\nReturn a short summary: how many per class, the top picks, and any classes with no usable model.', { label: 'Build shortlist', phase: 'Shortlist' })
return { found: all.length, unique: unique.length, passed: kept.length, summary: shortlist }
