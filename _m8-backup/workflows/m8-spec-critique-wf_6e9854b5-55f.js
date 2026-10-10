export const meta = {
  name: 'm8-spec-critique',
  description: 'Adversarially review the existing M8 build spec from three lenses, then revise it in place',
  phases: [
    { title: 'Critique', detail: 'Three critics: feasibility, completeness/product, merge safety' },
    { title: 'Revise', detail: 'Architect resolves verified issues in the spec' },
  ],
}

const REPO = '/home/user/game-gang'
const SPEC = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/m8/M8-SPEC.md'
const DECISIONS = 'Owner decisions: proper racing game (no Mario Kart items; drift boost and boost pads removed, slipstream kept as physics); no desert/UAE/Corniche theme; tilt/gyro steering removed (touch controls only: Drag steer default, Buttons alternative); fictional car brands; locked 60 fps on 1080p and 4K TVs with automatic presets (High 1 player, Medium 2, Low 3-4); MacBook Air M1 16 GB + 4K TV is the reference device; everything commercially usable (Speed Dreams data only where Free Art License is confirmed; never port Speed Dreams code or ship its sounds); M14 subscriptions are ON HOLD (nothing in M8 may plan or build billing). Out of scope for M8: tyre model/assists ladder (M11), engine audio rework (M11), new car models/paint/chase-cam rewrite (M12), premium UI redesign (M13), impostor forests and Blender bakes (M9), mountain terrain (M10).'

const CRIT_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      section: { type: 'string' },
      problem: { type: 'string' },
      evidence: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['severity', 'section', 'problem', 'evidence', 'fix'] } },
  },
  required: ['issues'],
}
const LENSES = [
  { label: 'Critic: feasibility', lens: 'FEASIBILITY AND CORRECTNESS. Check every technical claim and contract against the real code in ' + REPO + ' and node_modules/three (0.186.1) and @dimforge/rapier3d-compat 0.21: APIs or addons that do not exist, wrong file paths or symbols, TypeScript contracts that will not compile or do not match current types, steps impossible in WebGL2/Chrome/Rapier, wrong assumptions about current behaviour, asset names/URLs that do not exist (spot-check Poly Haven/ambientCG API URLs with curl), maths errors in trackgen (Speed Dreams XML rules, closure distribution, banking), and performance claims the plan depends on.' },
  { label: 'Critic: completeness', lens: 'COMPLETENESS AND PRODUCT. Check that the spec covers every M8 scope item and done-criterion; respects the owner decisions; gives each package testable acceptance criteria; keeps the game fully playable after every merge (lobby, 1-4 players, phones, keyboard players, results, lap records, reconnects, Vercel build); does not drift into later milestones or M14; and flag vague steps an implementer could get wrong or that leave UX broken (e.g., phone controller onboarding, reverse visibility, Reset, keyboard parity, TV R chip).' },
  { label: 'Critic: merge safety', lens: 'PARALLEL BUILD AND MERGE SAFETY. P2, P3 and P4 run in parallel git worktrees after P1, then merge, then P5. Check file ownership is disjoint or precisely partitioned (especially game.ts, config.ts, protocol.ts, hub.ts, viewportHud.ts, stage.css, package.json, pnpm-lock.yaml, ASSETS.md, tests), that each package compiles and passes tests on its own branch against the P1 base, that contracts let them integrate without rework, that worktree setup (pnpm install, ports, dev server, Playwright) is workable, and that the merge order and conflict-resolution instructions are concrete.' },
]

phase('Critique')
const crits = await parallel(LENSES.map((l) => () =>
  agent('You are a skeptical senior reviewer. Read the M8 build spec at ' + SPEC + ' (long; read all of it) and verify it against the codebase at ' + REPO + '. Read code as needed; do not edit any files. Lens: ' + l.lens + '\n\n' + DECISIONS + '\n\nReport only real problems, each with concrete evidence (file:line, command output, or quoted spec text) and a concrete fix. Return an empty list if the spec is sound for your lens.', {
    label: l.label, phase: 'Critique', schema: CRIT_SCHEMA,
  })))
const issues = crits.filter(Boolean).flatMap((c) => c.issues)
log('Issues: ' + issues.length + ' (' + issues.filter((x) => x.severity === 'blocker').length + ' blockers, ' + issues.filter((x) => x.severity === 'major').length + ' major)')

phase('Revise')
let revision = null
if (issues.length) {
  revision = await agent('You own the M8 build spec at ' + SPEC + '. Revise it in place to resolve these reviewer issues. Verify each issue against the code first; if an issue is wrong, keep the spec and record why. Keep the spec self-contained and consistent (update contracts, ownership map, tasks and tests together). Do not edit any other files.\n\n' + DECISIONS + '\n\nIssues:\n' + JSON.stringify(issues, null, 2) + '\n\nReturn: changes made, issues rejected with reasons, and any open questions that need the owner.', { label: 'Architect: revise', phase: 'Revise' })
}
return { issues: issues, revision: revision }
