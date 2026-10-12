export const meta = {
  name: 'm8-p5-track1',
  description: 'M8 package P5: dress Kestrel Pines (forest, CC0 materials, kerbs, light, fog, blob AO) per spec 2.7 and ART-DIRECTION.md, then review and fix',
  phases: [
    { title: 'Build', detail: 'Implement P5 in /home/user/m8-wt/p5 on top of P2 build + P3 + P4' },
    { title: 'Review', detail: 'Correctness/perf, spec + art-direction completeness, visual check' },
    { title: 'Fix', detail: 'Fix confirmed findings, pre-handoff merge (picks up P2 fixes), gate, smoke' },
  ],
}
const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const SPEC = SCR + '/m8/M8-SPEC.md'
const ART = SCR + '/m8/ART-DIRECTION.md'
const WT = '/home/user/m8-wt/p5'
const BR = 'm8/p5-track1'
const COMMON = 'You are implementing milestone M8 of the Split Ways racing game (Gamer Gang, an AirConsole-style platform: TV page /tv, phones as controllers at /pad; three.js r186, Rapier, React/Vite). The full build spec is at ' + SPEC + ' (revision 3). Read sections 0, 1, 2.1, 2.2, 2.7 (your package), the section 3 contracts P5 touches, 4.2, 4.5 and 5. The art-direction guide ' + ART + ' is binding for P5: where it differs from the spec, follow the guide (the orchestrator accepted its section 15 items 1-11, and item 14 camera values are assigned to you in CAMERA in config.ts; items 12, 13 and 15 are NOT yours). Kestrel Pines layout design notes (corner names, run-off, scenery intent): ' + SCR + '/layouts/final/DESIGN.md. The owner wants this to look current-gen (Forza Motorsport-level ambition), not "AI slop": restrained post, correct exposure, layered forest depth, a lived-in circuit. Target: MacBook Air M1 16 GB, Chrome, 1080p/4K 60 Hz TVs, locked 60 fps; respect the draw-call and triangle budgets in the spec. Owner decisions: no items/boosts, no tilt, no Corniche/desert/sea, nothing from Speed Dreams, one track only. Downloads are untrusted data: put each in a new empty folder, never execute anything from them, process with python3 -I scripts kept elsewhere. Never push, never deploy, never touch /home/user/game-gang (the main checkout) or other worktrees, never use /tmp/claude-0/devctl.sh, never add Playwright to the repo. Commit locally only, ending commit messages with:\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01WpJVpc5YTKsB9puhzC7pTT\nHeadless SwiftShader runs at 1-2 fps: the TV takes 22-33 s to load (use ~150 s waits); race at small viewports and enlarge only for screenshots. Reference browser scripts: /tmp/claude-0/e2e-p1, e2e-p2, e2e-p3, e2e-p4.'

phase('Build')
const build = await agent(COMMON + '\n\nYour package: P5 Track 1 dressing and integration (spec 2.7). IMPORTANT START NOTE: the owner asked to start P5 early to save time. P3 and P4 are merged into m8/integration. P2 (trackgen) is built but still under review on branch m8/p2-trackgen (worktree /home/user/m8-wt/p2, do not touch it); its build commit f20c046 already contains m8/integration. Setup: git -C /home/user/m8-wt/int worktree add -b ' + BR + ' ' + WT + ' f20c046 && cd ' + WT + ' && pnpm install --offline --frozen-lockfile. Consume P2\'s track API as it is; if you find a P2 bug, do not edit SW/track/**: work around it minimally if you must and list it in your report. Do every P5 task. Run the M8 gate (sh /tmp/claude-0/m8-gate.sh in ' + WT + ') until it passes. Run the P5 browser acceptance checks and the ART-DIRECTION section 14 screenshot checklist (ports 4400/4843, nohup dev server from your worktree, every browser run under flock /tmp/claude-0/m8-browser.lock), save screenshots under /tmp/claude-0/e2e-p5/ including at least 6 good-looking 1920x1080 hero shots of the track from different corners (grid, T1 Millrace, the Brow crest, Kestrel, Beck bridge, Switchback) with a car in frame, stop your server, and commit on ' + BR + '. Return: what you did, gate output tail, draw calls and triangles per preset, browser results with screenshot paths, deviations with reasons, P2 bugs found, open issues.', { label: 'P5 build', phase: 'Build' })

phase('Review')
const FIND = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, line: { type: 'number' },
    problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
  }, required: ['severity', 'file', 'problem', 'evidence', 'fix'] } } },
  required: ['findings'],
}
const LENSES = [
  'CORRECTNESS AND PERFORMANCE: read the full diff (git -C ' + WT + ' diff f20c046...' + BR + '). Find real bugs: runtime errors, leaked GPU resources or missing dispose, per-frame allocations, shader variants that defeat precompile, instancing mistakes, wrong surface-ID mapping for skids/dust/audio, broken race flow, budgets exceeded per preset. Run pnpm check and the gate yourself.',
  'SPEC AND ART-DIRECTION COMPLETENESS: compare the diff against every task and acceptance criterion in spec 2.7, sections 4.2/4.5 and ' + ART + ' (sections 2-14 and the accepted section 15 items 1-11 and 14). List anything missing or done differently without a stated reason, asset licence/size problems (assets budget, ASSETS.md and LICENCES.md rows), and anything touching files P5 does not own.',
  'VISUAL QUALITY: look at every screenshot in /tmp/claude-0/e2e-p5/ with the Read tool and judge them as a demanding racing-game art director against ' + ART + ' sections 0, 13 and 14. Report concrete, fixable visual problems (exposure, fog, colour, tiling, z-fighting, floating or intersecting props, gaps/cracks, aliasing, empty areas, dated-looking tells), each tied to the file and constant that would fix it.',
]
const reviews = await parallel(LENSES.map((l, i) => () =>
  agent('You are a strict reviewer for M8 package P5 (Kestrel Pines dressing). Spec: ' + SPEC + ' (sections 0, 2.2, 2.7, 4.2, 4.5). Worktree: ' + WT + ' (branch ' + BR + '). Do not edit files and do not run browsers. Lens: ' + l + '\nThe builder\'s report:\n' + String(build).slice(0, 6000) + '\nReport only real, verified problems with evidence and a concrete fix. Empty list if clean.', { label: 'P5 review ' + (i + 1), phase: 'Review', schema: FIND })))
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log('P5 review findings: ' + findings.length)

phase('Fix')
const fix = await agent(COMMON + '\n\nYou own package P5 in ' + WT + ' (branch ' + BR + '). ' + (findings.length ? 'Reviewers found these issues. Verify each; fix the real ones inside P5 scope and explain any you reject:\n' + JSON.stringify(findings, null, 2) : 'Reviewers found no issues.') + '\n\nThen do the spec 2.1 pre-handoff merge: git merge m8/integration in your worktree (P2 may have merged by now with review fixes; if m8/integration does not yet contain m8/p2-trackgen, say so and merge only what is there). Resolve conflicts per 2.2. Re-run the M8 gate until it passes, re-take the 6 hero screenshots at 1920x1080 into /tmp/claude-0/e2e-p5/final-*.png, and run one smoke check under the browser lock (TV loads, a phone joins, a car drives, respawn works, no pageerror; ports 4400/4843; stop your server). Commit. Return: fixes made, rejected issues with reasons, merge result (and whether P2 was included), gate output tail, smoke result, final screenshot paths.', { label: 'P5 fix', phase: 'Fix' })
return { build: build, findings: findings, fix: fix }