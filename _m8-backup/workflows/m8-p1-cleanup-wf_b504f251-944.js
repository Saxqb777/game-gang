export const meta = {
  name: 'm8-p1-cleanup',
  description: 'M8 package P1: remove items/boosts/tilt/Corniche per the spec, then adversarial review and fixes',
  phases: [
    { title: 'Build', detail: 'Implement P1 in its own worktree' },
    { title: 'Review', detail: 'Two reviewers: correctness/regressions and spec completeness' },
    { title: 'Fix', detail: 'Fix confirmed findings, re-run the gate' },
  ],
}
const SPEC = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/m8/M8-SPEC.md'
const WT = '/home/user/m8-wt/p1'
const COMMON = 'You are implementing milestone M8 of the Split Ways racing game. The full build spec is at ' + SPEC + ' (read sections 0, 1, 2.1, 2.2 and your package section carefully; the spec is the source of truth). Owner decisions: no items, no drift boost or boost pads (slipstream stays), no tilt/gyro, no Corniche/desert theme, M14 subscriptions on hold, Track 1 "Kestrel Pines" uses an original layout (decision D-1 resolved: original, not Speed Dreams-derived; other agents are updating spec sections 4.1/4.3/Appendix C for that right now, which does not affect P1). Never push, never deploy, never touch /home/user/game-gang (the main checkout) or other worktrees. Commit locally only, ending commit messages with:\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01WpJVpc5YTKsB9puhzC7pTT'

phase('Build')
const build = await agent(COMMON + '\n\nYour package: P1 Cleanup (spec section 2.3). Setup: git -C /home/user/m8-wt/int worktree add -b m8/p1-cleanup ' + WT + ' m8/integration && cd ' + WT + ' && pnpm install --offline --frozen-lockfile. Do every P1 task, add/adjust tests, keep the game fully playable (lobby, 1-4 players, phones, keyboard players, results, lap records). Run the M8 gate (sh /tmp/claude-0/m8-gate.sh in ' + WT + ') until it passes, run the P1 browser acceptance check from the spec (ports 4000/4443, nohup server from your worktree, flock /tmp/claude-0/m8-browser.lock for browser runs, never devctl.sh), save screenshots under /tmp/claude-0/e2e-p1/, and commit on m8/p1-cleanup. Return: what you did, gate output tail, browser check results with screenshot paths, open issues.', { label: 'P1 build', phase: 'Build' })

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
  'CORRECTNESS AND REGRESSIONS: read the full diff (git -C ' + WT + ' diff m8/integration...m8/p1-cleanup) and the surrounding code. Find bugs the cleanup introduced: broken imports/dead references, runtime errors, broken lobby/ready flow, broken keyboard players, broken phone controller (buttons mode must still work end to end), results/lap records/leaderboard posting, reconnect, slipstream still working, HUD/audio still fine, tests weakened or deleted without replacement. Run the tests and the gate yourself.',
  'SPEC COMPLETENESS: compare the diff against every task and acceptance criterion in spec section 2.3 and the shared-file regions in 2.2. List anything missing, done differently, or touching files/regions P1 does not own; check the three retired-word greps; check docs/tests that still mention removed features within P1 scope.',
]
const reviews = await parallel(LENSES.map((l, i) => () =>
  agent('You are a strict code reviewer for M8 package P1 (cleanup). Spec: ' + SPEC + ' (sections 0, 2.1, 2.2, 2.3). Worktree: ' + WT + ' (branch m8/p1-cleanup). Do not edit files. Lens: ' + l + '\nReport only real, verified problems with evidence and a concrete fix. Empty list if clean.', { label: 'P1 review ' + (i + 1), phase: 'Review', schema: FIND })))
const findings = reviews.filter(Boolean).flatMap((r) => r.findings)
log('P1 review findings: ' + findings.length)

phase('Fix')
let fix = null
if (findings.length) {
  fix = await agent(COMMON + '\n\nYou own package P1 in ' + WT + ' (branch m8/p1-cleanup). Reviewers found these issues. Verify each; fix the real ones (stay inside P1 scope), explain any you reject. Re-run the M8 gate until it passes and repeat the browser smoke check (TV loads, a phone joins in Buttons mode, a car drives, no pageerror) under the browser lock. Commit. Issues:\n' + JSON.stringify(findings, null, 2) + '\n\nReturn: fixes made, rejected issues with reasons, gate output tail.', { label: 'P1 fix', phase: 'Fix' })
}
return { build: build, findings: findings, fix: fix }
