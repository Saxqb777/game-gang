export const meta = {
  name: 'm8-p2-trackgen',
  description: 'M8 package P2: trackgen v1 and Kestrel Pines data in its own worktree, three-lens adversarial review, fixes and pre-handoff merge',
  phases: [
    { title: 'Build', detail: 'Implement P2 (spec 2.4) in /home/user/m8-wt/p2' },
    { title: 'Review', detail: 'Correctness, spec completeness, geometry/physics maths' },
    { title: 'Fix', detail: 'Fix confirmed findings, pre-handoff merge, gate, smoke' },
  ],
}
const SCR = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
const SPEC = SCR + '/m8/M8-SPEC.md'
const WT = '/home/user/m8-wt/p2'
const BR = 'm8/p2-trackgen'
const COMMON = 'You are implementing milestone M8 of the Split Ways racing game (Gamer Gang, an AirConsole-style platform: TV page /tv, phones as controllers at /pad; three.js r186, Rapier, React/Vite). The full build spec is at ' + SPEC + ' (revision 3). Read sections 0, 1, 2.1, 2.2, 2.4 (your package), the section 3 contracts P2 touches, 4.1, 4.3, 4.4, 5 and Appendix C carefully; the spec is the source of truth. The owner-approved original layout is in ' + SCR + '/layouts/final/ (LAYOUT/ in the spec; read-only; DESIGN.md there explains every corner, run-off and the scenery intent). Copy the two JSON files byte for byte; never edit the layout to make a test pass. Owner decisions: no items, no drift boost or boost pads (slipstream stays as physics only), no tilt/gyro, no Corniche/desert theme, D-1 resolved (original layout; nothing from Speed Dreams is used or shipped: never read or port Speed Dreams or TORCS source code), one track only for now (Kestrel Pines). Target: MacBook Air M1, Chrome, 1080p/4K 60 Hz TVs, locked 60 fps, Forza-feel quality. Never push, never deploy, never touch /home/user/game-gang (the main checkout) or other packages\' worktrees (P3 and P4 are running in /home/user/m8-wt/p3 and /p4 right now), never use /tmp/claude-0/devctl.sh, never add Playwright to the repo. Commit locally only, ending commit messages with:\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01WpJVpc5YTKsB9puhzC7pTT\nNotes from P1 (merged into m8/integration): tracks.ts holds the kestrel-pines seam and the interim loop; FacetBuilder and seeded() are exported only to satisfy noUnusedLocals. Headless SwiftShader runs at 1-2 fps: the TV page takes 22-33 s to load (use about 150 s waits); at 1 fps the TV can treat phone input as stale, so race at small viewports (480x270 or 320x180) and enlarge only for screenshots. P1 reference browser scripts: /tmp/claude-0/e2e-p1/p1a.cjs and p1b.cjs.'

phase('Build')
const build = await agent(COMMON + '\n\nYour package: P2 Trackgen v1 and Track 1 data (spec 2.4). Setup: git -C /home/user/m8-wt/int worktree add -b ' + BR + ' ' + WT + ' m8/integration && cd ' + WT + ' && pnpm install --offline --frozen-lockfile. Do every P2 task with the tests it lists. Optional, only if cheap and inside your files: the art-direction asks tagged [P2-ask] in ' + SCR + '/m8/ART-DIRECTION.md (placement jitter, cap order, tunnel sections); skip them if they risk the schedule and say so. Keep the game fully playable on Kestrel Pines (lobby, 1-4 players, phones, keyboard players, respawn, results, lap records over the 45 s minimum). Run the M8 gate (sh /tmp/claude-0/m8-gate.sh in ' + WT + ') until it passes. Run the P2 browser acceptance checks (ports 4100/4543, nohup dev server from your worktree, every browser run under flock /tmp/claude-0/m8-browser.lock), save screenshots under /tmp/claude-0/e2e-p2/ including a few views of the track itself, stop your server, and commit on ' + BR + '. Return: what you did, the check-track output, gate output tail, browser results with screenshot paths, deviations from the spec with reasons, open issues for P5 (dressing) and P3 (perf).', { label: 'P2 build', phase: 'Build' })

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
  'CORRECTNESS AND REGRESSIONS: read the full diff (git -C ' + WT + ' diff m8/integration...' + BR + ') and the surrounding code. Find real bugs: runtime errors, Track API behaviour changes that break callers (race progress, checkpoints, minimap, respawn, autopilot, camera), per-wheel surface grip wiring, lap/position logic on the new track, performance traps (per-frame allocations, huge single meshes, missing dispose), tests weakened or deleted without replacement. Run pnpm check and the gate yourself.',
  'SPEC COMPLETENESS: compare the diff against every task and acceptance criterion in spec 2.4, the section 3 contracts it touches, 4.3/4.4, Appendix C targets and the shared-file regions in 2.2. Check the committed layout files are byte-identical (sha256sum against ' + SCR + '/layouts/final/). List anything missing, done differently without a stated reason, or touching files/regions P2 does not own.',
  'GEOMETRY AND PHYSICS MATHS: write throwaway Node/tsx scripts OUTSIDE the repo (in /tmp/claude-0/review-p2/) that import the generator from the worktree and inspect its output for Kestrel Pines: station spacing and continuity, heading/elevation/bank continuity across segment joins and the start/finish wrap, closure, corridor mesh watertightness at chunk seams (no cracks or T-junction gaps between chunks, kerbs, run-off and terrain blend), normal and winding direction, physics mesh vs visual surface mismatch (height and lateral), surface IDs on the right triangles, terrain heightfield not poking through the road or leaving cliffs at the shoulder, placements not intersecting the road, racing line staying inside the road. Report numbers.',
]
const reviews = await parallel(LENSES.map((l, i) => () =>
  agent('You are a strict reviewer for M8 package P2 (trackgen v1 and Kestrel Pines data). Spec: ' + SPEC + ' (sections 0, 2.1, 2.2, 2.4, 3, 4.3, 4.4, Appendix C). Worktree: ' + WT + ' (branch ' + BR + '). Do not edit files in the worktree and do not run browsers. Lens: ' + l + '\nThe builder\'s report:\n' + String(build).slice(0, 6000) + '\nReport only real, verified problems with evidence and a concrete fix. Empty list if clean.', { label: 'P2 review ' + (i + 1), phase: 'Review', schema: FIND })))
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log('P2 review findings: ' + findings.length)

phase('Fix')
const fix = await agent(COMMON + '\n\nYou own package P2 in ' + WT + ' (branch ' + BR + '). ' + (findings.length ? 'Reviewers found these issues. Verify each; fix the real ones inside P2 scope and explain any you reject:\n' + JSON.stringify(findings, null, 2) : 'Reviewers found no issues.') + '\n\nThen do the spec 2.1 pre-handoff merge: git merge m8/integration in your worktree (P3 or P4 may have merged by now; resolve conflicts per 2.2, keeping both sides), re-run the M8 gate until it passes, and run one smoke browser check under the browser lock (TV loads Kestrel Pines, a phone joins, a car drives, a respawn works, no pageerror; ports 4100/4543, stop your server afterwards). Commit. Return: fixes made, rejected issues with reasons, merge result, gate output tail, smoke result with screenshot paths.', { label: 'P2 fix', phase: 'Fix' })
return { build: build, findings: findings, fix: fix }