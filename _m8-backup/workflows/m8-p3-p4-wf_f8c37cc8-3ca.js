export const meta = {
  name: 'm8-p3-p4',
  description: 'M8 packages P3 (render/perf/presets/telemetry) and P4 (controller) in parallel worktrees, each with adversarial review and fixes',
  phases: [
    { title: 'Build', detail: 'P3 and P4 implement their spec sections in their own worktrees' },
    { title: 'Review', detail: 'Two reviewers per package: correctness/regressions and spec completeness' },
    { title: 'Fix', detail: 'Fix confirmed findings, pre-handoff merge, re-run the gate' },
  ],
}
const SPEC = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/m8/M8-SPEC.md'
const RULES = 'Owner decisions: no items, no drift boost or boost pads (slipstream stays as physics only), no tilt/gyro, no Corniche/desert theme, M14 subscriptions on hold, Track 1 "Kestrel Pines" uses an original layout (D-1 resolved; P2 handles it, not you). Target hardware: MacBook Air M1 16 GB, Chrome, 1080p and 4K 60 Hz TVs, locked 60 fps. The owner wants a current-gen, Forza-feel product, not "AI slop": quality matters, but stay inside your package scope and file ownership (spec 2.2). Never push, never deploy, never touch /home/user/game-gang (the main checkout) or other packages\' worktrees, never use /tmp/claude-0/devctl.sh, never add Playwright to the repo, never print secrets. Commit locally only, ending commit messages with:\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01WpJVpc5YTKsB9puhzC7pTT'
const P1NOTES = 'Notes from P1 (already merged into m8/integration): FacetBuilder (sceneryModels.ts) and seeded() (scenery.ts) are exported only to satisfy noUnusedLocals; leave them. Headless SwiftShader runs at 1-2 fps: the TV page takes 22-33 s to load (use about 150 s waits), at 1 fps the TV can treat phone input as stale (600 ms), so race tests at small viewports (480x270 or 320x180) and enlarge only for screenshots. P1 reference browser scripts are in /tmp/claude-0/e2e-p1/ (p1a.cjs, p1b.cjs) and can be copied and adapted.'
const PKGS = [
  { key: 'p3', name: 'P3 Render path, profiling, presets, telemetry', section: '2.5', branch: 'm8/p3-render', wt: '/home/user/m8-wt/p3', http: 4200, https: 4643,
    extra: 'Telemetry: write the schema/migration and store code so it works locally and on Neon (do not connect to any remote database; the orchestrator runs the production migration at deploy time) and say in your report exactly which migration must run in production and how.' },
  { key: 'p4', name: 'P4 Controller', section: '2.6', branch: 'm8/p4-controller', wt: '/home/user/m8-wt/p4', http: 4300, https: 4743,
    extra: 'Owner wants a much better phone controller than today: touch only, Drag steer is the default, Buttons is the alternative, a clear reverse (BRAKE·R with ring, label and R chip on phone and TV), reset reachable, haptics where the spec says. Make it feel like a premium console controller on a phone: big targets, readable at a glance, no clutter.' },
]
const common = (p) => 'You are implementing milestone M8 of the Split Ways racing game (Gamer Gang, an AirConsole-style platform: TV page /tv, phone controllers /pad). The full build spec is at ' + SPEC + '. Read sections 0, 1, 2.1, 2.2, your package section ' + p.section + ', and the contracts in section 3 that your package touches; the spec is the source of truth. ' + RULES + '\n' + P1NOTES

const FIND = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, line: { type: 'number' },
    problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
  }, required: ['severity', 'file', 'problem', 'evidence', 'fix'] } } },
  required: ['findings'],
}

const results = await pipeline(
  PKGS,
  (p) => agent(common(p) + '\n\nYour package: ' + p.name + ' (spec section ' + p.section + '). Setup: git -C /home/user/m8-wt/int worktree add -b ' + p.branch + ' ' + p.wt + ' m8/integration && cd ' + p.wt + ' && pnpm install --offline --frozen-lockfile. Do every task in your section, with the tests it lists, and keep the game fully playable (lobby, 1-4 players, phones, keyboard players, results, lap records). ' + p.extra + ' Run the M8 gate (sh /tmp/claude-0/m8-gate.sh in ' + p.wt + ') until it passes. Run your section\'s browser acceptance checks (ports ' + p.http + '/' + p.https + ', nohup dev server from your worktree, every browser run under flock /tmp/claude-0/m8-browser.lock), save screenshots under /tmp/claude-0/e2e-' + p.key + '/, stop your server, and commit on ' + p.branch + '. Return: what you did, gate output tail, browser check results with screenshot paths, deviations from the spec with reasons, open issues.', { label: p.key.toUpperCase() + ' build', phase: 'Build' }),
  async (build, p) => {
    const lenses = [
      'CORRECTNESS AND REGRESSIONS: read the full diff (git -C ' + p.wt + ' diff m8/integration...' + p.branch + ') and the surrounding code. Find real bugs: runtime errors, broken lobby/race/results flow, broken keyboard players or phone controller, performance traps (per-frame allocations, shader recompiles, leaked GPU resources, missing dispose), wrong maths, tests weakened or deleted without replacement. Run pnpm check and the gate yourself.',
      'SPEC COMPLETENESS: compare the diff against every task and acceptance criterion in spec section ' + p.section + ', the contracts in section 3 it touches, and the shared-file regions in 2.2. List anything missing, done differently without a stated reason, or touching files/regions this package does not own.',
    ]
    const reviews = await parallel(lenses.map((l, i) => () => agent('You are a strict code reviewer for M8 package ' + p.name + '. Spec: ' + SPEC + ' (sections 0, 2.1, 2.2, ' + p.section + ', 3). Worktree: ' + p.wt + ' (branch ' + p.branch + '). Do not edit files and do not run browsers. Lens: ' + l + '\nThe builder\'s report:\n' + String(build).slice(0, 6000) + '\nReport only real, verified problems with evidence and a concrete fix. Empty list if clean.', { label: p.key.toUpperCase() + ' review ' + (i + 1), phase: 'Review', schema: FIND })))
    const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
    log(p.key.toUpperCase() + ' review findings: ' + findings.length)
    const fix = await agent(common(p) + '\n\nYou own package ' + p.name + ' in ' + p.wt + ' (branch ' + p.branch + '). ' + (findings.length ? 'Reviewers found these issues. Verify each; fix the real ones inside your scope and explain any you reject:\n' + JSON.stringify(findings, null, 2) : 'Reviewers found no issues.') + '\n\nThen do the spec 2.1 pre-handoff merge: git merge m8/integration in your worktree (resolve conflicts per 2.2, keeping both sides), re-run the M8 gate until it passes, and run one smoke browser check under the browser lock (TV loads, a phone joins, a car drives, no pageerror; ports ' + p.http + '/' + p.https + ', stop your server afterwards). Commit. Return: fixes made, rejected issues with reasons, merge result, gate output tail, smoke result.', { label: p.key.toUpperCase() + ' fix', phase: 'Fix' })
    return { pkg: p.key, build: build, findings: findings, fix: fix }
  },
)
return results