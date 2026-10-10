# M8 build spec: Track 1 "Kestrel Pines", performance foundation, minimum touch controller

Written 2026-10-10 against commit `a2933a9` (branch `claude/gracious-bell-2pgra5`, repo `/home/user/game-gang`).
Revision 2 (2026-10-10): reviewer issues resolved (merge procedure, worktrees, frame stats, render path,
telemetry, terrain and closure maths, controller scope, integration acceptance).
Revision 3 (2026-10-10): owner decision D-1 applied. Track 1 uses an original layout owned by the
project (§4.1, §4.3, Appendix C); the Speed Dreams XML importer is out of M8 and nothing from Speed
Dreams ships.
Line numbers marked `@a2933a9` refer to that commit. Line numbers drift after earlier packages land, so
always find code by the function or member name given next to the line number.

**Path shorthands used everywhere below**

| Shorthand | Path |
|---|---|
| `SW/` | `client/src/games/splitways/` |
| `PAD/` | `client/src/pad/` |
| `SD/` | `/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/sd-extract/usr/share/games/speed-dreams` (Speed Dreams 1.4 data reviewed for D-1 only; nothing from it is used; never execute anything in it) |
| `LAYOUT/` | `/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/layouts/final` (the owner-approved original Kestrel Pines layout files that P2 copies, §4.3; read-only) |
| `THREE/` | `node_modules/.pnpm/three@0.186.1/node_modules/three/` |
| `E2E/` | `/tmp/claude-0/e2e` (reference Playwright scripts, not part of the repo) |

---

## 0. Rules for every implementation agent

1. **Never push and never deploy.** No `git push`, no `vercel`, no Vercel or Neon MCP writes. Pushing
   `claude/gracious-bell-2pgra5` auto-deploys the public site. Commit locally on your own package branch
   only (§2.1). Use the commit attribution lines your own session tells you to use.
2. **No new npm dependencies** (runtime or dev). `pnpm-lock.yaml` must not change. In a new worktree,
   `pnpm install --offline --frozen-lockfile` works (tested: 2.7 s).
3. **Never copy `.env` into a worktree.** Without `DATABASE_URL` the local server uses in-memory PGlite, so no
   test data reaches the production Neon database.
4. **M14 (subscriptions) is on hold** until the owner says it is ready. Do not add, plan, stub or document
   billing, paywall or subscription work. Docs mention M14 only as "on hold".
5. **Code style.** TypeScript strict per `tsconfig.base.json` (`noUncheckedIndexedAccess`,
   `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` so type-only imports use `import type`).
   ESLint is typescript-eslint `strictTypeChecked` plus react-hooks 7. Prettier: printWidth 100, single
   quotes, trailing commas. Write concise comments that say why. Every tunable number goes in
   `SW/config.ts` with a one-line comment in the existing style. `SW/config.ts` must keep **zero imports**
   (the pad bundle imports it).
6. **Node-safe layers stay Node-safe.** `SW/track/**`, `SW/sim/**`, `SW/race/**` and `SW/input/**` may
   import three.js maths classes (`Vector3`, `MathUtils`, ...) but nothing that needs a DOM, a canvas or
   WebGL. Vitest runs them in Node.
7. **Keep runtime stations about 1 m apart.** Many constants count samples as metres (risk R-9).
8. **Verify before relying.** Check every three.js or Rapier behaviour you depend on in `node_modules`.
   Appendix A lists the facts already verified for this spec.
9. **Nothing from Speed Dreams is used** (decision D-1, §4.1). No SD track XML or layout numbers, cars,
   textures, models or sounds enter the repo or the game. Never open, read or port any Speed Dreams or
   TORCS source code, including the C++ files in
   `/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/sdsrc/`. The only
   Speed Dreams content in the repo is the licence-review record in `LICENCES.md` (§4.4), written from
   the evidence quoted in §4.1.
10. **Stay inside your package.** Edit only the files and regions your package owns (§2.2). If you find
    a bug elsewhere, note it in your final report; do not fix it.
11. **Finish line for every package:** the M8 gate (§2.1: `pnpm check`, `pnpm build` and the three
    §1.3 greps) green in your worktree, the package acceptance checks done, the pre-handoff merge of
    `m8/integration` done and re-checked (§2.1), one or more local commits on the package branch, and a
    short report listing what was done, the test results, screenshots taken (paths) and open issues.
    The greps are case-insensitive substring matches, so never write the retired words (for example
    "tilt", also inside "tilted" or "stilt") even in comments, test names or test data.
12. **Never work in the main checkout** `/home/user/game-gang`. It stays on `claude/gracious-bell-2pgra5`.
    Its `pnpm format:check` fails on the git-excluded `reports/` and `research_notes/` folders (Prettier
    does not read `.git/info/exclude`), and `/tmp/claude-0/devctl.sh` is hardcoded to it. Every package,
    and the orchestrator's merges, use the worktrees in §2.1.

---

## 1. Goal and done criteria

### 1.1 Goal
Ship Track 1, **Kestrel Pines**: an original 3.2-3.4 km club circuit in a temperate pine forest. It is
built by a new track generator (trackgen v1) from an original layout owned by the project (decision
D-1), on a new rendering foundation (DPR-1 canvas with upscale and sharpen, one shared HDR target and
one post chain, GPU-time dynamic resolution, automatic presets, shader precompilation, profiling
overlay, benchmark, telemetry). Replace tilt steering with a minimum touch controller (Drag steer and
Buttons, analog gas, visible reverse, Reset). Remove Items mode, the arcade speed tricks and the
Corniche Run theme.

"Kestrel Pines" was checked with a web search on 2026-10-10: no real circuit, raceway or motorsport
venue uses the name. The track id (slug) is `kestrel-pines`. Never use a real circuit name or "Forza".

### 1.2 Scope (owner-approved)
- **Cleanup.** Remove Items mode entirely: mystery boxes, items, the item HUD slot, the phone item
  button, item sounds and visuals, item tests. Remove the drift boost and boost pads. Keep slipstream
  as aero physics. Remove tilt/gyro steering and the iOS motion-permission flow. Retire the Corniche
  Run track and its desert, coastal and UAE theme (sea, city, palms, dunes). Remove the Items/Classic
  lobby switch. Lap records keep working.
- **Licence log.** A licence log in the repo (`LICENCES.md`, §4.4). It records the Speed Dreams 1.4
  data that was reviewed, the conflict found (a Free Art License (FAL) readme against the GPL header
  that every Speed Dreams track XML carries) and decision D-1: nothing from Speed Dreams is used or
  shipped (no tracks, cars or sounds, and never any Speed Dreams code). Track 1 uses an original layout
  owned by the project, shipped as separate data files that carry their own licence and credits
  fields. Every third-party asset gets a row before it is added.
- **Profiling.** An in-game overlay showing draw calls, triangles, GPU time
  (`EXT_disjoint_timer_query_webgl2` when available, otherwise CPU frame time), resolution scale and
  preset. A scripted fly-through benchmark at 1, 2 and 4 viewports. Telemetry (fps, GPU time,
  resolution, preset, viewport count, device info) sent to the existing Neon backend through a new
  API route.
- **Render path.** Canvas at devicePixelRatio 1, plus a final upscale-and-sharpen pass (RCAS style)
  that sharpens when the output is larger than the internal resolution (D-9). One shared HDR target
  for all viewports and a single post chain, with bloom and vignette clamped per viewport. Dynamic
  resolution driven by GPU time. Three automatic presets by player count (High for 1, Medium for 2, Low for 3-4), plus a
  short loading benchmark; drop one preset between races only. Shader precompilation on the loading
  screen.
- **Trackgen v1.** Read the project's own layout file (a typed, zod-validated segment list, §3.2) and
  a small JSON override file per track. Integrate a centre line with elevation and banking and
  distribute the closure error.
  Loft the corridor (road, run-off, kerbs, barriers) in 100-200 m chunks. A physics mesh from the same
  stations with a surface ID per triangle (asphalt, kerb, grass, gravel), used for grip, rumble and
  audio. A terrain heightfield blended into the corridor over a 10-30 m shoulder. Placement rules for
  trees, tyre walls, boards and marshal posts. A racing line and speed profile. A small script checks a
  track folder's layout files (validation only; there is no importer from Speed Dreams or any other
  format).
- **Track 1.** Temperate pine forest on an original layout (§4.3), checked against real circuits so
  that it replicates none. Sun shadows, blob AO under cars, CC0 asphalt, sawtooth kerbs with stripes,
  a track mask with an automatic rubber line, CC0 grass and gravel run-off, simple instanced pines, tyre walls
  and barriers, sky.
- **Controller.** "Drag steer" (default) and "Buttons". Shared steering processing on the TV. A tall
  GAS pedal with feathering, BRAKE·R with a visible reverse (ring, label, R chip on phone and TV), a
  stuck hint, a Reset action, a handbrake press strip. No item button. Pointer Events. Keyboard players
  keep working, with the same reverse and reset help as phone players.

**Out of scope** (later milestones, do not start them): tyre model and assists ladder (M11), engine
audio rework (M11), controller v2 (M11: 60 Hz binary input packets, the shorter 250 ms input failsafe,
the slide-from-GAS handbrake gesture), new car models, paint and chase-cam rewrite (M12), premium UI
(M13), subscriptions (M14, on hold), impostor forests and Blender bakes (M9 polish), more tracks
(later; owner wants one track for now), KTX2 textures (M9 polish), WebGPU, pause button, any Speed Dreams import or XML converter (dropped by D-1).
**Car sourcing** starts in M8 as a manual owner/art task (a candidate search, a licence-log row per
candidate, a real-silhouette check; it must finish before M12). No agent package does it; P6 records
it in `ROADMAP.md` and `PROGRESS.md` and lists it in its final report.

### 1.3 Done criteria (all must hold)
1. **Performance on the reference device** (MacBook Air M1 16 GB, Chrome, driving a 4K TV at 60 Hz,
   and again with a 1920×1080 60 Hz output at `devicePixelRatio` 1), measured by the owner (§5.5) and
   read back from telemetry. Each configuration must hold a locked 60 fps for a full race on Kestrel
   Pines: 4 players on Low, 2 on Medium, 1 on High. "Locked 60" is defined in §5.6.
2. **30-minute soak at 4 viewports on Low** (`?bench=soak`): frame-time p99 < 16.7 ms as defined in
   §5.6, and the preset never drops.
3. **No tilt code remains.** This grep returns nothing:
   `grep -rniE 'tilt|gyro|deviceorientation|requestPermission' client/src server/src shared/src`
4. **No items or arcade boosts remain.** This grep returns nothing:
   `grep -rnE "ITEM_|ItemKind|itemIcons|ItemVisuals|requestUse|spinOut|mystery|nitro|BOOSTS|placeBoostPads|driftLevel|GAME_MODES|GameMode\b" client/src shared/src server/src`
   (This intentionally does not match the steering `mode`.)
5. **No Corniche remains.** `grep -rni corniche client/src shared/src server/src` returns nothing.
6. **Repo checks.** `pnpm check` (typecheck, lint, format:check, tests) passes. `pnpm build` and
   `pnpm build:vercel` succeed.
7. **Lap records work on `kestrel-pines`.** A finished race posts best laps and the results screen
   shows the board. Checked by the integration acceptance (§2.9), together with pad reconnects, mixed
   controller modes and the play-again vote.
8. **Licences.** `LICENCES.md` exists with the sections of §4.4 (including the Speed Dreams review
   record of decision D-1), the Kestrel Pines track files carry the licence and credits fields of
   §4.3, `assets/ASSETS.md` lists every shipped asset with source and licence, and nothing from Speed
   Dreams ships (no tracks, cars or sounds).

---

## 2. Work packages

### 2.1 Order, branches, worktrees, ports, merging

```
            P1 Cleanup (alone)
                   |
      +------------+-------------+
      |            |             |
P2 Trackgen   P3 Render/perf  P4 Controller     (parallel, separate worktrees)
      |            |             |
      +-----+------+             |
            |                    |
      P5 Track 1 dressing + integration (needs P2 and P3 merged)
            |                    |
            +---------+----------+
                      |
        2.9 Integration acceptance (orchestrator, after P4 and P5 are merged)
                      |
              P6 Docs and licence log (last)
```

**Worktrees.** Nobody works in the main checkout `/home/user/game-gang` (rule 12). Every worktree lives
**outside** the repo directory, because a nested copy would be picked up by the vitest and ESLint globs.
After creating any worktree, run `pnpm install --offline --frozen-lockfile` in it (about 3 s).

| Worktree | Branch | Used by |
|---|---|---|
| `/home/user/m8-wt/int` | `m8/integration` | The orchestrator: every merge, the post-merge gate, §2.9 |
| `/home/user/m8-wt/p1` | `m8/p1-cleanup` | P1 |
| `/home/user/m8-wt/p2` | `m8/p2-trackgen` | P2 |
| `/home/user/m8-wt/p3` | `m8/p3-render` | P3 |
| `/home/user/m8-wt/p4` | `m8/p4-controller` | P4 |
| `/home/user/m8-wt/p5` | `m8/p5-track1` | P5 |
| `/home/user/m8-wt/p6` | `m8/p6-docs` | P6 |

**Branches.**
- The orchestrator creates the integration branch and its worktree once, from the main checkout's git
  directory (this does not change the main checkout's files):
  ```
  git -C /home/user/game-gang worktree add -b m8/integration /home/user/m8-wt/int a2933a9
  ```
- Each package worktree is created from `m8/integration` when the package starts, for example:
  ```
  git -C /home/user/m8-wt/int worktree add -b m8/p2-trackgen /home/user/m8-wt/p2 m8/integration
  ```
- P1 starts alone. P2, P3 and P4 start after P1 is merged. P5 starts after P2 and P3 are both merged.
  §2.9 runs after P4 and P5 are merged. P6 starts after §2.9 passes.

**The M8 gate** (run in a worktree root; the orchestrator saves it once as `/tmp/claude-0/m8-gate.sh`):
```sh
set -e
pnpm check
pnpm build
fail=0
grep -rniE 'tilt|gyro|deviceorientation|requestPermission' client/src server/src shared/src && fail=1
grep -rnE "ITEM_|ItemKind|itemIcons|ItemVisuals|requestUse|spinOut|mystery|nitro|BOOSTS|placeBoostPads|driftLevel|GAME_MODES|GameMode\b" client/src shared/src server/src && fail=1
grep -rni corniche client/src shared/src server/src && fail=1
[ "$fail" = 0 ] || { echo "M8 gate: retired words found (listed above)"; exit 1; }
echo "M8 gate: PASS"
```

**Merging.**
1. **Pre-handoff merge (package).** Before a package reports done, it runs
   `git merge m8/integration` in its own worktree, resolves any conflict following §2.2 (keep both
   sides' changes in their own regions), re-runs the M8 gate and one smoke browser check (the TV loads,
   a car drives, no `pageerror`), and commits the merge. This turns the orchestrator's merge into a
   fast, conflict-free one, and it surfaces clean-but-broken interactions inside the package that can
   still fix them.
2. **Orchestrator merge.** In `/home/user/m8-wt/int`: `git merge --no-ff m8/pN-...`, then
   `sh /tmp/claude-0/m8-gate.sh`.
3. **If the post-merge gate fails**, or a merge conflicts despite step 1: `git merge --abort` (conflict)
   or `git reset --hard ORIG_HEAD` (gate failure) in `/home/user/m8-wt/int`, and send the package back
   to its agent with the failure output. The package repeats step 1. The orchestrator never fixes
   package code itself.
- P2, P3 and P4 merge in whichever order they finish.
- If P4 merges after P5 has started, P5's pre-handoff merge (step 1) picks it up.
- **Nobody merges into `claude/gracious-bell-2pgra5` and nobody pushes.** The owner decides that after
  review. Until then the integration branch stays local.

**Dev servers and ports.** The server reads `PORT` and `HTTPS_PORT`
(`server/src/local/server.ts:32-33`). Start your own server in the background from your worktree root
and stop only your own:

| Who | HTTP | HTTPS |
|---|---|---|
| P1 | 4000 | 4443 |
| P2 | 4100 | 4543 |
| P3 | 4200 | 4643 |
| P4 | 4300 | 4743 |
| P5 | 4400 | 4843 |
| Orchestrator (§2.9, in `/home/user/m8-wt/int`) | 4000 | 4443 |

```
cd /home/user/m8-wt/pN && PORT=<http> HTTPS_PORT=<https> nohup pnpm dev > /tmp/claude-0/dev-pN.log 2>&1 & echo $! > /tmp/claude-0/dev-pN.pid
kill $(cat /tmp/claude-0/dev-pN.pid)    # stop; add `pkill -P <pid>` if child processes survive
```
- **Never use `/tmp/claude-0/devctl.sh`.** It `cd`s into the main checkout, and its `stop` kills every
  `server/src/(dev|prod).ts` process, including other agents' servers.
- P6 changes docs only and needs no server.

**Playwright.**
- Copy reference scripts from `E2E/` into your own folder, for example `/tmp/claude-0/e2e-p3/`, and
  replace ports 4000 and 4443 with yours.
- `require('playwright')` resolves to `/opt/node-tools/node_modules/playwright`.
- Launch Chromium from `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with the args
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Pads use `isMobile: true, hasTouch: true, ignoreHTTPSErrors: true` and the HTTPS port.
- **Serialise browser runs across packages.** The machine has 4 cores and SwiftShader is CPU-bound, so
  run every browser script under one shared lock:
  `flock /tmp/claude-0/m8-browser.lock node /tmp/claude-0/e2e-pN/<script>.cjs`.
- **Timing under load.** The loop clamps a frame to 0.1 s and runs at most 5 physics steps per frame
  (`loop.ts:35-39`), so at low frame rates simulated time runs slower than wall time. Write every
  timing check as polling with a generous timeout (about 3 to 5 times the nominal time). Where the
  nominal time itself is the point (for example the 2 s stuck hint), measure elapsed race time from
  the TV HUD lap timer, not from wall time.
- Never add Playwright to the repo.

### 2.2 Shared-file ownership map

These files are edited by more than one package. Each package may touch **only** the regions listed
for it. Insert new code at the stated anchor, and do not reformat or reorder code outside your
regions. "After P1" means the region exists only after P1 has landed. Anchors are chosen so that two
parallel packages never insert at the same spot; if an anchor is missing, stop and report it rather
than picking a nearby spot.

#### `SW/game.ts`

| Package | May edit |
|---|---|
| P1 | Anything (runs alone). |
| P2 | Nothing. The track loads through the `SW/track/tracks.ts` seam that P1 creates, and `buildTrackPhysics`, `Terrain` and `Track` keep their constructor and call signatures. |
| P3 | **Imports:** lines inside the `./render/*` import block (add, change, delete); new `./debug/*` imports directly after `import { DebugOverlay } from './debug/debugOverlay';`; the `'./config'` import line; the `@gamergang/shared` import block. Leave the `./loop` import line unchanged (the class stays `FixedStepLoop`). **Types:** `interface GameHooks` (adds `telemetry`) and the new exported `BenchMode` and `GameOptions`, placed directly after it. **Module constants block** (`const VIEWPORT_GAP` through `TAG_HIDE_DISTANCE`): delete `ANISOTROPY` (unused after P3), add P3 constants. **Class fields:** replace `sun` and the fps fields (keep `frames`, which `paintHud` uses), make `statusTimer` assignable, and add new fields at the end of the field list, directly before `static async create(`. **`create()`.** **Constructor** statements that build the renderer, sky/haze/fog, sun or shadows, the race (laps override), the loop, the autopilot default, and the `statusTimer` line (it moves into `start()`). **New methods** `prepare()`, `start()` and benchmark helpers, placed directly after the constructor's closing brace, before `handleInput(`. **`dispose()`:** the `loop.stop()` and `clearInterval(this.statusTimer)` lines and the render-object lines. **`onKey`. `layout()`. `render()`** (including the race-window logic of P3.6). **`showPodium()`** (only if the podium view setup needs a change; nobody else edits it). In `renderRace()`, only the `sun.focus` lines and the `renderer.renderView(...)` calls. **`paintDebug()`. `trackFps()`** (replace). |
| P4 | **Imports:** any number of new import lines directly after `import { KeyboardDriver } from './input/keyboard';`, including a separate `import { REVERSE, RESPAWN } from './config';` line (never edit P3's `'./config'` line). **`interface Driver`:** new fields directly after `keyboardSet: number \| null;` (`steerFilter`, `sentReverse`, `sentHint`, `sentResetReady`, `statusPushedAt`) and the matching properties directly after `keyboardSet,` in the drivers object literal. **`step()`:** only the per-driver input block between `mergeInputs(...)` and `this.race.holdInputs()`, plus one statement directly after `this.race.update(this.sim.dt);`. **`paintHud()`:** lines directly after `hud.setTag(...)`. **All of `sendRaceStatusTo()`**, and new private methods directly after it (only P4 appends after `sendRaceStatusTo()`). |
| P5 | **Imports:** new import lines directly after `import { WorldVisual } from './scene/world';` (`./scene/blobShadows`, `./track/surfaces`). **Class field:** one field directly after `private readonly dust = new Dust();` (the `BlobShadows`). **`create()`:** the `Terrain` and `WorldVisual.create` lines. **Constructor:** the `scene.add(...)` line and the blob-shadow creation. **`step()`:** the surface loop that today sets `driver.onSand` (after `slipstream.update`). **`renderRace()`:** the `audio.updateCar(...)` call. **`render()`:** one line for the blob-shadow update. **`dispose()`:** the world and blob lines. **`interface Driver`:** replace `onSand` with `surface: SurfaceId` and add `lastKerbShakeAt: number` next to it; the matching object-literal properties replace `onSand: false,`. |

#### `SW/config.ts`

| Package | May edit |
|---|---|
| P1 | `BOOSTS` → `SLIPSTREAM` (replaced in place), delete `ITEMS`, edit `RESPAWN`, and the `STEERING` rates in deg/s (P1.8). |
| P2 | Insert new blocks `SURFACES`, `TRACKGEN`, `RACING_LINE` immediately **before** `export const RACE = {`. |
| P3 | Rewrite `RENDER` in place. Insert `PRESETS`, `RESOLUTION`, `BENCH` immediately **after** the `RENDER` block (before `LIGHTING`). |
| P4 | Edit `BRAKES` in place (delete `reverseBelowSpeed`). Insert `STEER_INPUT`, `REVERSE` immediately **after** `INPUT` (before `CAMERA`). `STEERING` and `INPUT` stay as P1 left them. |
| P5 | Edit `LIGHTING` and `POST` in place. Insert `SCENERY` immediately **after** `POST` (before `AUDIO`). Edit `AUDIO.sand` (rename it to `surface`). |

#### `SW/sim/car.ts`

After P1 the `'../config'` import block reads, one name per line: `ASSISTS, BRAKES, CAR, DRIFT, ENGINE,
PHYSICS, RESPAWN, SLIPSTREAM, STEERING, TYRES, WHEELS`.

| Package | May edit |
|---|---|
| P1 | Removes boost and spin-out (P1.1). Converts `applySteering()` to the deg/s `STEERING` keys (P1.8). |
| P2 | `Collider` added to the `@dimforge/rapier3d-compat` import block. `SURFACES` added to the `'../config'` block on its own line between `STEERING` and `TYRES`. A new line `import { SURFACE, type SurfaceId } from '../track/surfaces';` directly after `import type { Rapier } from './rapier';`. The constructor parameter list and wheel setup loop, a new field directly after `readonly wheelSkidding = ...`, the `postPhysics()` wheel loop, `applyGrip()`, the rolling-resistance line in `addGroundAssists()`, and a new `dominantSurface` getter directly **after** the closing brace of `get speedKph()`. |
| P4 | `REVERSE` added to the `'../config'` block on its own line between `RESPAWN` and `SLIPSTREAM`. `applyDrive()`, and the `this.applyDrive(forwardSpeed)` call in `prePhysics()` (to pass `dt`). `placeAt()`. New fields directly after `draft = 0;`. A new `reverseState` getter directly **before** the doc comment of `get speedKph()` (`/** Speed in km/h for HUDs. */`). P2's and P4's getters are separated by the unchanged `speedKph` getter, so they merge cleanly. |

#### Other shared files

| File | Owners and regions |
|---|---|
| `SW/race/race.ts` | **P1:** `Racer` (add `stuckOnGasTime`, `resetReadyAt`), constructor (laps), new `requestRespawn`, stuck counting in `updateRespawn`. **P2:** `offTrack` expression, `teleport`, `skipToNextGate`, `insideGate`, `Racer.safeDistance` and its update. |
| `SW/track/noise.ts` (new) | **P1** creates it (P1.7). Stable through M8: P2 imports `fbm` from it and never moves or renames it. |
| `SW/track/terrain.ts` | **P1** (Corniche removal, noise moved to `noise.ts`), then **P2** (rewrite). |
| `SW/track/tracks.ts` | **P1** creates the interim seam, **P2** finalises it (§3.5). |
| `SW/scene/terrainVisual.ts` | **P1** (forest colours), then **P5** (rewrite). |
| `SW/hud/viewportHud.ts` | **P1:** removes the item slot. **P4:** adds `setGear` and `setHint`. |
| `SW/tv/stage.css` | **P1:** removes `.sw-hud-item*`. **P4:** inserts its rules directly after the `.sw-hud-tag` block. **P3:** appends a `.sw-bench` block at end of file. |
| `SW/tv/SplitWaysStage.tsx` | **P1**, then **P3** (prepare, telemetry, options). Nobody else. |
| `SW/debug/debugOverlay.ts` | **P1** (removes the item line), then **P3**. Nobody else. |
| `SW/scene/world.ts` | **P1** (sea and sand), **P3** (adds `setQuality` stub), **P5** (rewrite). |
| `SW/scene/carVisual.ts`, `SW/scene/podium.ts` | **P1** (none), **P3** (shadow proxy fix). P5 must not edit them. |
| `shared/src/protocol.ts` | **P1**, then **P4** (`raceSchema` fields `reverse`, `hint`, `resetReady`; `REVERSE_ARM_MS`). |
| `shared/src/api.ts` | **P1** (track id, `MIN_LAP_MS`), then **P3**: the telemetry block appended after the leaderboard schemas, and `MAX_PLAYERS` added to the existing `./protocol` import line. |
| `package.json` (root) | **P2:** inserts `"assets:track"` directly after `"assets:car"`. **P3:** inserts `"telemetry:report"` directly after `"db:migrate"`. |
| `client/src/tv/TvApp.tsx` | **P1** (KeyM removal, reset key hint), then **P3** (bots flag). |
| `assets/ASSETS.md` | **P1** (sand row), **P5** (asset rows), **P6** (final review). |
| `LICENCES.md` (new, repo root) | **P2** creates it with the Speed Dreams review section and the project-owned data section (§4.4). **P5** appends the CC0 asset section. **P6** reviews it (§2.8 step 5). |
| `eslint.config.js` | Only **P2**, and only if its `.mjs` track check script needs a glob change. |

### 2.3 P1: Cleanup (first, alone)

**Purpose.** Remove what the owner retired and leave a smaller game that still runs end to end:
- Items mode, drift boost and boost pads.
- The mode switch.
- Tilt and the iOS motion-permission flow.
- The Corniche theme.

Also add the seams the parallel packages need: a track seam, a reliable `reset` action, the stuck
policy and a laps override. The game keeps running on an **interim test loop**, the old M3 control
points renamed. P2 replaces it.

**Branch:** `m8/p1-cleanup`, worktree `/home/user/m8-wt/p1`, ports 4000/4443. **Must not touch:**
anything that belongs to P2-P5 work, meaning no trackgen, no render pipeline changes, no new controller
UI (the Buttons layout stays, minus the item and tilt parts), and no new assets.

**Files P1 owns** (create, edit or delete). Any file in the repo, but the expected set is:
- Delete: `SW/race/items.ts`, `SW/race/items.test.ts`, `SW/race/boosts.ts`,
  `SW/scene/itemVisuals.ts`, `SW/itemIcons.ts`, `SW/scene/sea.ts`, `SW/track/cornicheRun.ts`,
  `assets/textures/sand/*`.
- Create: `SW/race/slipstream.ts`, `SW/race/slipstream.test.ts`, `SW/track/tracks.ts`,
  `SW/track/noise.ts`.
- Edit: `SW/game.ts`, `SW/config.ts`, `SW/sim/car.ts`, `SW/race/race.ts`, `SW/race/race.test.ts`,
  `SW/track/trackPhysics.test.ts`, `SW/track/terrain.ts`, `SW/scene/terrainVisual.ts`,
  `SW/scene/trackVisual.ts`, `SW/scene/scenery.ts`, `SW/scene/sceneryModels.ts`, `SW/scene/world.ts`,
  `SW/scene/gantry.ts`, `SW/scene/dust.ts`, `SW/hud/viewportHud.ts`, `SW/tv/stage.css`,
  `SW/tv/SplitWaysStage.tsx`, `SW/audio/raceAudio.ts`, `SW/input/keyboard.ts`,
  `SW/debug/debugOverlay.ts`, `SW/pad/SplitWaysController.tsx`, `SW/pad/controller.css`,
  `SW/pad/steering.ts`, `SW/pad/steering.test.ts`, `client/src/games/registry.ts`,
  `client/src/hub/hub.ts`, `client/src/tv/TvApp.tsx`, `client/src/tv/Lobby.tsx`,
  `client/src/tv/tv.css`, `PAD/padStore.ts`, `PAD/PadApp.tsx`, `PAD/controllers.ts`,
  `PAD/profile.ts`, `PAD/device.ts`, `PAD/screens/JoinScreen.tsx`, `PAD/screens/LobbyScreen.tsx`,
  `PAD/pad.css`, `shared/src/protocol.ts`, `shared/src/api.ts`, `server/src/api/router.test.ts`,
  `server/src/db/store.test.ts`, `server/src/local/cert.ts` (comment),
  `server/src/local/server.ts` (comment), `assets/ASSETS.md`.

**Tasks.**

**P1.1 Slipstream: keep it, as aero drag only.**
- Create `SW/race/slipstream.ts` with
  `export class Slipstream { constructor(private readonly cars: readonly Car[]); update(dt: number, racing: boolean): void }`.
  It keeps one `draft` value per car in a private `number[]`.
- Copy the `slipstreamTarget` logic verbatim from `boosts.ts:183-202@a2933a9` (eased in over 0.6 s and
  out over 0.3 s), renaming the config keys.
- `update` behaviour: per car, `draft = racing ? target(...) : 0`, then `car.draft = draft`. Drop the
  old `car.spinTime === 0` condition.
- `SW/config.ts`: replace `BOOSTS` with
  `export const SLIPSTREAM = { range: 16, width: 1.8, minSpeed: 20, dragCut: 0.55 } as const;`, with
  comments taken from the old keys. **Delete `slipstreamPush`.** Decision D-3: slipstream is aero drag
  reduction only. At 50 m/s the old constant 1600 N push was 2.8 times the drag saving, which is a
  boost, not aero.
- Delete the `ITEMS` block.
- `SW/sim/car.ts`:
  - Import `SLIPSTREAM` instead of `BOOSTS`.
  - Delete `SPIN_DRAG`, the `boost` field, `spinTime`/`spinRate`/`spinStartYaw`/`spinElapsed`,
    `spinOut()`, `push()`, the spinning block at the top of `prePhysics`, the `spinning` argument and
    parameter of `addGroundAssists`, the spinning yaw/drag block after the impulses, `spinTime` and
    `boost` in `placeAt`, the boost impulse block, and the `if (spinning) return;` line with its comment.
  - Delete the draft push line (`impulse.addScaledVector(forward, BOOSTS.slipstreamPush * this.draft)`).
  - Keep the drag cut: `ENGINE.drag * (1 - SLIPSTREAM.dragCut * this.draft)`.
  - Fix the `draft` doc comment to "Set by Slipstream".
- Create `SW/race/slipstream.test.ts` with a flat world (copy `flatWorld()` from
  `SW/sim/car.test.ts:14-20`, no track):
  - (a) Front car at `{x:0, y:0.3, z:20, yaw:0}`, back car at `{x:0, y:0.3, z:11, yaw:0}`. Both at full
    throttle for 4 s with `Slipstream.update(dt, true)` every step. Expect the back car's max draft
    > 0.4 and the front car's draft < 0.05 throughout.
  - (b) After 6 s the drafting back car's `forwardSpeed` exceeds that of an identical solo car (a
    separate world, same inputs) by at least 0.1 m/s.
  - (c) `update(dt, false)` sets draft to 0.
- Delete `SW/race/boosts.ts`, `SW/race/items.ts`, `SW/race/items.test.ts`, `SW/scene/itemVisuals.ts`
  and `SW/itemIcons.ts`.

**P1.2 `SW/game.ts`.**
- Header doc: change "item presses" to "button actions".
- Imports: remove `ITEM_KINDS`, `GameMode`, `HapticPattern` (if `haptic()` goes), `Boosts`,
  `Items`/`Holder`, `ItemVisuals`, `CORNICHE_RUN`. Add `Slipstream` and `loadTrack1` from
  `./track/tracks`.
- Fields: `boosts` becomes `slipstream: Slipstream`. Delete `items`, `itemVisuals`, `debugItem`.
- `create()`: drop the `mode` parameter. Replace `new Track(CORNICHE_RUN)` with
  `const track = await loadTrack1();`. The constructor drops `mode` too.
- Constructor: `this.slipstream = new Slipstream(cars);`. Delete the `ItemVisuals` creation,
  `scene.add(itemVisuals.group)` and `wireItemEvents()`.
- `actions`:
  `{ reset: (index) => { const driver = this.drivers[index]; if (driver) this.race.requestRespawn(driver.racer); } }`.
- Delete `wireItemEvents()`, `haptic()` (only item events call it), the `KeyI` block and its doc
  line, the autopilot item-firing lines, `items?.update`, `itemVisuals.update/dispose`, the
  `setItem` lines in `paintHud` and the item fields in `sendRaceStatusTo` (also fix its doc comment).
- In `step()`: replace `takeItemPress` with `takeResetPress`, which calls
  `this.race.requestRespawn(driver.racer)`.
- Speed effect: `Math.max(speedEffect(car.speedKph), car.draft * 0.7)`.
- Delete `this.world.update(seconds)` (the sea was the only animated part) and delete
  `WorldVisual.update`.
- Do not touch `private mode: 'race' | 'podium'`. It is not the game mode.

**P1.3 HUD, CSS, audio, keyboard, debug, dust.**
- `SW/hud/viewportHud.ts`: delete the `ItemKind` and `itemIcons` imports, `CHARGES_TEXT`, the item
  slot fields and their creation, and `setItem()`. Keep `setTag()`.
- `SW/tv/stage.css`: delete the `.sw-hud-item` rules through `@keyframes sw-item-pop`
  (`153-206@a2933a9`). Keep `.sw-hud-tag`.
- `SW/audio/raceAudio.ts`: delete `pickup`, `use`, `explosion`, `blocked`, `boost`, `driftLevel`, the
  `ItemKind` import and `ITEMS` from the config import. Delete the helpers `out`, `tone` and `noise`
  if nothing else uses them (otherwise `noUnusedLocals` fails). Keep `updateCar`, including the draft
  wind.
- `SW/input/keyboard.ts`: rename `KeyMap.item` to `reset` (keys stay `KeyQ` for set 0 and
  `Enter`/`NumpadEnter` for set 1), `itemPresses` to `resetPresses`, `takeItemPress` to
  `takeResetPress`. Do not use `KeyR`: it is the debug resolution toggle.
- `SW/debug/debugOverlay.ts`: drop `I: give every car an item` from the help line.
- `SW/scene/dust.ts`: delete `trail()` and `burst()` (only `itemVisuals` used them) and fix the header
  comment. Keep `particles.ts`.

**P1.4 Remove the game-mode switch (Option A: remove everything).**
- `shared/src/protocol.ts`: delete `GAME_MODES`, `GameMode`, `MODE_IDS`, `ITEM_KINDS`, `ItemKind`,
  `gameModeSchema`, `itemKindSchema`, `modeSchema` (and its entry in `padMessageSchema`),
  `lobbySchema.mode`, and the `raceSchema` fields `item`, `charges`, `rolling`. Remove `'pickup'` and
  `'hit'` from `hapticSchema`. Change `actionSchema` to `action: z.enum(['reset'])` with the doc
  comment "A one-shot button press that must not get lost (reliable channel), e.g. reset a stuck car."
- `client/src/hub/hub.ts`: delete `HubState.mode`, the initial `mode`, `setMode`, the `'mode'` case
  and `mode:` in the lobby message. Keep the `'action'` case and `onAction`, and change its doc to
  "e.g. reset".
- `client/src/tv/TvApp.tsx`: delete the `KeyM` case, its import and the `<kbd>M</kbd> mode ·` hint. In
  the in-game key bar (`KeyHints`), add `<kbd>Q</kbd>/<kbd>Enter</kbd> reset ·` before the Esc hint when
  any local (keyboard) player is in the room (pass that flag in from `TvApp`).
- `client/src/tv/Lobby.tsx`: delete the game-modes chip block (`89-101@a2933a9`).
- `client/src/tv/tv.css`: delete `.game-modes` rules (`198-234@a2933a9`).
- `client/src/games/registry.ts`: delete `GameModeInfo`, `GameDescriptor.modes`, the modes array and
  the `GameMode` import. Set `subtitle: 'Kestrel Pines'`, `details: '3 laps · 1-4 players · touch controls'`
  and a forest gradient
  `art: 'linear-gradient(135deg, #2f6b3a 0%, #1d4a3a 45%, #0e2233 100%)'`.
- `PAD/padStore.ts`: delete `setMode` and the `GameMode` import. Keep `action()`.
- `PAD/PadApp.tsx`: delete the `onMode` prop.
- `PAD/screens/LobbyScreen.tsx`: delete the mode radios, the hint and the `onMode` prop.
- `PAD/pad.css`: delete `408-440@a2933a9` (the second, unscoped `.pad-modes` block and
  `.pad-game-card em`). This also fixes the steering picker styling that block was overriding.
- `PAD/device.ts`: remove `pickup` and `hit` from `HAPTICS`.
- `SW/tv/SplitWaysStage.tsx`:
  - Delete the `mode`/`classic` state, the `classic` parameter of `syncLeaderboard` and the
    `ResultsPanel` prop, and the "Items race" line.
  - Post laps unconditionally when credentials exist.
  - Use `TRACK_1.id` and `TRACK_1.name` from `../track/tracks`.
  - Filter laps with `MIN_LAP_MS` from `@gamergang/shared`.
  - The effect deps become `[hub]`.
  - `SplitWaysGame.create(container, players, hooks)`.

**P1.5 Reset (TV side), stuck policy, laps override.**
- `SW/race/race.ts`:
  - Add to `Racer`: `stuckOnGasTime: number` (s) and `resetReadyAt: number` (race-clock seconds,
    initially `-Infinity`).
  - Constructor: `constructor(readonly track: Track, cars: readonly Car[], laps: number = track.definition.laps)`
    and `this.totalLaps = laps`.
  - New public method `requestRespawn(racer: Racer): boolean`. It returns false unless
    `phase === 'racing' && racer.finishedMs === null && racer.respawn === 'none' && this.clock >= racer.resetReadyAt`.
    When allowed it sets `respawn = 'out'`, `respawnTimer = 0`, `stuckTime = 0`,
    `stuckOnGasTime = 0`, `resetReadyAt = clock + RESPAWN.resetCooldownSeconds`, and returns true. It
    reuses the existing fade, teleport and fade-in, so a reset can never gain distance.
  - In `updateRespawn`, while racing, not finished and `respawn === 'none'`:
    `racer.stuckOnGasTime = car.input.throttle > 0.3 && car.velocity.lengthSq() < 1 ? racer.stuckOnGasTime + dt : 0`.
    Otherwise set it to 0. Keep `stuckTime` as it is (gas or brake), compared against the new
    `RESPAWN.stuckSeconds`.
- `SW/config.ts` `RESPAWN`:
  - `stuckSeconds: 6`. Comment: manual Reset exists now, and the 2 s reverse hint needs time to work.
  - New `stuckHintSeconds: 2`: show "Hold BRAKE to reverse" after this long stuck on gas (P4 shows it).
  - New `resetCooldownSeconds: 3`.
- Tests in `SW/race/race.test.ts`:
  - **Reset guard.** False during the countdown. True once racing, after which the racer goes `'out'`,
    then `'in'` after 0.3 s, then `'none'`. A second call inside the cooldown is false; after the
    cooldown it is true. False once finished (set `finishedMs` to force it).
  - **Stuck on gas.** `stuckOnGasTime` grows only with throttle > 0.3 at low speed, and brake alone
    does not grow it.

**P1.6 Remove tilt and the iOS motion-permission flow.**
- `PAD/device.ts`: delete `TiltPermission`, `OrientationPermissionApi`, `orientationApi`,
  `tiltNeedsPrompt`, `requestTiltPermission`, `probeTiltSensor` (`4-49@a2933a9`). Fix the header.
  Keep `enterFullscreen`, `keepScreenAwake` (with its visibility re-acquire) and `vibrate`.
- `PAD/profile.ts`: add `export const STEERING_MODES = ['buttons'] as const;` and
  `export type SteeringMode = (typeof STEERING_MODES)[number];`. The default and every stored value map
  to `'buttons'`. P4 adds `'drag'`.
- `PAD/controllers.ts`: delete `onEnableTilt`.
- `PAD/PadApp.tsx`:
  - Delete the tilt imports, `tiltFallbackNote`, the `note` state, `verifyTilt`, and the `note` props
    on `JoinScreen` and `SettingsSheet`.
  - `submitJoin(next)` becomes `enterFullscreen(); keepScreenAwake(); commitProfile(next); store.join(next.name, next.colour); setEditing(false);`.
  - `changeMode` only commits the profile.
  - Delete `onEnableTilt` on `<Controller>`.
- `PAD/screens/JoinScreen.tsx`:
  - `ModePicker` renders one button per entry in `STEERING_MODES`, using a small
    `{ label, hint, icon }` table keyed by mode. `buttons` is "Buttons" / "Hold left / right arrows",
    with the existing arrow icon.
  - Delete the `note` prop.
  - Change the submit comment to "needs the tap for fullscreen".
- `PAD/screens/LobbyScreen.tsx` (`SettingsSheet`): delete the `note` prop.
- `SW/pad/SplitWaysController.tsx`:
  - Delete the tilt branch, `TiltSteering`, `TILT_SILENCE_MS`, `needsTap`, the enable overlay,
    `onEnableTilt`, the `Wheel` component and `wheelRef`, `ItemButton`, `itemsMode`, `itemIconRef`,
    `useItem`, `shownIcon` and the rolling-icon loop.
  - The Buttons layout remains the only layout: no item button, horn stays.
- `SW/pad/controller.css`: delete `.ctl--tilt`, the wheel and hub rules (`190-245@a2933a9`),
  `.ctl-drive-buttons--items`, the item block (`293-362@a2933a9`) and `.ctl-enable` (`488-531@a2933a9`).
- `SW/pad/steering.ts`: keep only `BUTTON_RAMP_S`, `BUTTON_RETURN_S` and `rampSteer`, and fix the
  header. `SW/pad/steering.test.ts`: delete the tilt tests and keep the ramp tests.
- Comments in `server/src/local/cert.ts:11` and `server/src/local/server.ts:39`: phones still get
  HTTPS because the Wake Lock API needs a secure context. Change only the wording.

**P1.7 Retire Corniche: theme and track.**
- **Track seam.** Create `SW/track/tracks.ts`:
  ```ts
  import type { TrackId } from '@gamergang/shared';
  import { Track } from './track';
  /** The one track M8 ships. P2 replaces the interim loop below with generated Kestrel Pines data. */
  export const TRACK_1 = { id: 'kestrel-pines', name: 'Kestrel Pines' } as const satisfies {
    id: TrackId;
    name: string;
  };
  /** Interim test loop (the M3 control points) until trackgen lands. */
  export function createPlaceholderTrack(): Track { /* new Track({ ...TRACK_1, points: [...], roadWidth: 14, shoulderWidth: 3.5, checkpointCount: 8, startDistance: 60, laps: 3 }) */ }
  // Not `async`: an async function without `await` fails @typescript-eslint/require-await.
  export function loadTrack1(): Promise<Track> { return Promise.resolve(createPlaceholderTrack()); }
  ```
  Move the 26 points from `cornicheRun.ts` here, then delete `cornicheRun.ts`.
- **Tests.** `SW/race/race.test.ts` and `SW/track/trackPhysics.test.ts` use `createPlaceholderTrack()`.
  Rename the describe blocks ("placeholder loop") and update the comments. Keep the bounds as they
  are; P2 rewrites both tests.
- **`shared/src/api.ts`.**
  - `export const TRACK_IDS = ['kestrel-pines'] as const;` and
    `export type TrackId = z.infer<typeof trackIdSchema>;`.
  - `export const MIN_LAP_MS = 45_000;` used by `postLapsRequestSchema` (`.min(MIN_LAP_MS)`), with the
    comment "A lap under 45 s or over 10 min is not a real Kestrel Pines lap". Update the other
    Corniche comments.
  - Server tests: replace `'corniche-run'` with `'kestrel-pines'` in `router.test.ts` and
    `store.test.ts`. Their lap values (57-61 s) already pass the new minimum.
  - Decision D-5: old `corniche-run` rows stay in the DB but are unreachable.
- **Sea.** Delete `SW/scene/sea.ts`. In `SW/scene/world.ts`, drop the sea and the sand texture:
  `WorldVisual` loads only the asphalt `PbrSet`, `update()` is removed, and the textures type becomes
  `{ asphalt: PbrSet }`.
- **Noise.** Create `SW/track/noise.ts` (Node-safe, no imports) and move `hash`, `valueNoise` and
  `fbm` from `terrain.ts` into it unchanged. Export `fbm(x: number, z: number, octaves: number): number`
  (and the other two if anything else needs them). `terrain.ts` and `terrainVisual.ts` import `fbm`
  from it. This is a stable seam (§3.7): P2 rewrites `terrain.ts` but keeps importing from here.
- **Terrain.** `SW/track/terrain.ts`:
  - Delete `SEA_LEVEL`, `CITY`, `COAST`, `coastZ`, and the beach, dune and city branches.
  - New natural height:
    `const growth = smoothstep(distance, edge + 10, edge + 160); natural = 0.3 + growth * fbm(x * 0.006, z * 0.006, 4) * 10;`.
  - Keep the blend.
  - Fix the comments: no coast, and `infield` is only a scenery hint.
- **Terrain visual.** `SW/scene/terrainVisual.ts`:
  - New signature `createTerrainVisual(terrain, bounds)`. Remove the sand `PbrSet` and the `SEA_LEVEL`
    skip.
  - Material: an untextured `MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })`.
  - Vertex colours vary between grass green `#3f5f2a` and needle brown `#5a4a32` using `fbm` from
    `../track/noise`.
- **Track visual.** `SW/scene/trackVisual.ts`:
  - Remove the dashed centre line, the seaside railing branch and the `Terrain` parameter:
    `createTrackVisual(track, textures: { asphalt: PbrSet }, anisotropy)`.
  - Shoulders use an untextured `MeshStandardMaterial({ color: 0x4a6b2f, roughness: 0.95 })`.
  - Keep the jersey barrier, edge lines, kerbs and start line.
- **Scenery.** `SW/scene/scenery.ts`: delete `addPalms`, `addLamps`, `addCity`, `addSkyline` and the
  `CITY`/`SEA_LEVEL` imports. Keep `seeded`, `Placement`, `clear`, `beside`, `instanced`,
  `addGrandstand` and `addBanners`, and drop the `coastZ` check in `addBanners`.
- **Scenery models.** `SW/scene/sceneryModels.ts`: delete `PALM_HEIGHT`, `palmGeometry`,
  `lampGeometries`, `facadeMaterial`, `lowRiseTexture` and `towerTexture`. Keep `FacetBuilder`,
  `blockGeometry`, `crowdTexture` and `bannerTexture`.
- **Gantry.** `SW/scene/gantry.ts`: the sign text becomes
  ``SPLIT WAYS  ·  ${track.definition.name.toUpperCase()}``.
- **Assets.** Delete `assets/textures/sand/`. In `assets/ASSETS.md`, delete the `sand_01` row and
  remove "building facades, water ripples" from the runtime-drawn textures row.

**P1.8 Steering rates in deg/s** (moved here from P4 so that P2 tunes the autopilot against the final
rates; P4 no longer touches `STEERING` or `applySteering()`).
- `SW/config.ts` `STEERING`: replace `turnRate: 3.4` / `returnRate: 5.5` (rad/s) with
  `turnRateDegPerS: 150` (road-wheel angle; the research range is 120-180) and `returnRateDegPerS: 240`,
  with one-line comments. Keep the speed-sensitive lock (`maxAngleLowSpeed`, `maxAngleHighSpeed`,
  `lowSpeed`, `highSpeed`) unchanged.
- `SW/sim/car.ts` `applySteering()`: `rate = (turningFurther ? STEERING.turnRateDegPerS : STEERING.returnRateDegPerS) * MathUtils.DEG2RAD`.
- This slows the wheel for every car, autopilot included. Acceptance 5 (a 4-car autopilot race on the
  interim loop) shows the autopilot copes. The owner tunes the values by feel later (R-13).

**Acceptance (P1).**
1. The M8 gate (§2.1) is green in `/home/user/m8-wt/p1`: `pnpm check`, `pnpm build` and the greps in
   §1.3 items 3, 4 and 5 for `client/src`, `shared/src` and `server/src`.
2. `slipstream.test.ts` and the new race tests pass, and all old tests (including `sim/car.test.ts`
   with the new steering rates) still pass.
3. Browser check, 1 pad (ports 4000/4443, server started from `/home/user/m8-wt/p1` with the nohup
   pattern in §2.1). Adapt `E2E/m1.cjs`:
   - The TV lobby shows no mode chips; the pad lobby has no mode radios. The steering picker shows
     only "Buttons".
   - The race starts; gas for 3 s moves the car (the overlay shows gas 1.00 and speed > 0).
   - The pad has no Reset UI yet (P4 adds it). On the TV keyboard, add a keyboard player and press `Q`
     (key set 0) during racing: the car fades and respawns. The in-game key bar shows the reset hint.
   - No `pageerror` on TV or pad. Take a TV screenshot: no sea, no palms, no city.
4. Browser check, 4 pads with autopilot. Adapt `E2E/m7show.cjs` and remove the `KeyI` presses: the race
   finishes, the results screen and podium appear, and no errors occur.

**Pitfalls (P1).**
- `noUnusedLocals` and `noUnusedParameters` turn every orphaned helper into an error: `raceAudio`
  `out`/`tone`/`noise`, `game.haptic`, `debugItem`, unused imports. Delete them in the same change.
- "mode" has three meanings. Remove only `GameMode`. Keep the steering `Profile.mode`/`SteeringMode`
  and `SplitWaysGame.mode` (`'race' | 'podium'`).
- Port the slipstream test before deleting `items.test.ts`.
- The `Record<GameAction, ...>` on `game.actions` must list `reset`, or typecheck fails.
- Do not delete `scene/particles.ts`. Dust uses it.
- Keep `DRIFT` in `config.ts`. It is handbrake physics, not the drift boost.
- Old cached pad bundles fail zod parsing against the new lobby message. Reload pads during testing.

### 2.4 P2: Trackgen v1 and Track 1 data (parallel)

**Purpose.**
- Commit the original Kestrel Pines layout and overrides (byte-identical copies of the two
  owner-approved JSON files, §4.3) and check them with zod schemas and a small check script.
- Generate the stations (centre line, elevation, banking, variable widths, surfaces), the corridor
  geometry in chunks, the physics mesh with per-triangle surfaces, the terrain heightfield, the
  placements and the racing line from that data.
- Refactor `Track` onto the generated data while keeping its API.
- Wire per-wheel surface grip into the car, and per-station limits and a safe respawn into the race.
- Switch the game to Kestrel Pines through the `tracks.ts` seam.

**Branch:** `m8/p2-trackgen`, worktree `/home/user/m8-wt/p2`, ports 4100/4543.

**Files P2 owns.**
- Create:
  - `LICENCES.md` (repo root).
  - `SW/track/surfaces.ts`.
  - `SW/track/gen/` with `layout.ts`, `overrides.ts`, `centreline.ts`, `closure.ts`,
    `elevation.ts`, `corridor.ts`, `racingLine.ts`, `placement.ts`, `generate.ts`, and the tests
    `layout.test.ts`, `generate.test.ts`, `corridor.test.ts`, `placement.test.ts`.
  - `SW/track/terrain.test.ts`, `SW/sim/surface.test.ts`.
  - `client/scripts/check-track.mjs`.
  - `assets/tracks/kestrel-pines/base.layout.json`, `overrides.json` (copies of the `LAYOUT/` files,
    §4.3; no `LICENCE.txt`).
- Edit:
  - `SW/track/track.ts`, `SW/track/tracks.ts`, `SW/track/trackGeometry.ts`, `SW/track/trackPhysics.ts`,
    `SW/track/trackPhysics.test.ts`, `SW/track/terrain.ts`.
  - `SW/sim/world.ts`, `SW/sim/simulation.ts`.
  - `SW/sim/car.ts` (P2 regions only, §2.2), `SW/race/race.ts` (P2 regions only), `SW/race/race.test.ts`.
  - `SW/debug/autopilot.ts`, `SW/config.ts` (P2 anchor only), root `package.json` (P2 anchor only).
  - `eslint.config.js` (only if needed for the build script).

**Must not touch:** `SW/game.ts`, `SW/scene/**`, `SW/render/**`, `SW/pad/**`, `SW/input/**`,
`SW/hud/**`, `SW/tv/**`, `shared/**`, `server/**`, P4's regions of `car.ts`, and `SW/track/noise.ts`
(import `fbm` from it; do not move or rename it).

**Tasks** (in this order; commit after each group).

**P2.1 Licence log first (before committing any track data).**
Create `LICENCES.md` in the format of §4.4, with two sections:
- **"Speed Dreams (reviewed, not used)"**: one row for the reviewed package
  `speed-dreams-data-1.4.0-7mdv2010.0`, quoting the §4.1 evidence verbatim:
  - the `g-track-2` readme: "Copyright © 2002 Eric Espie / Reworked © 2005 Bernhard Wymann / Copyleft:
    this work of art is free, you can redistribute it and/or modify it according to terms of the Free
    Art license.";
  - the conflicting header in `g-track-2.xml` lines 2-13 ("(C) 2000 C. Guionneau" plus GPLv2-or-later
    boilerplate in lines 10-13), the same TORCS template header that all 16 circuit and dirt track XMLs
    carry;
  - the SD data repository policy (README "License" section, verified online on 2026-10-10 at
    https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/README.md): "non-functional
    data is licensed under the Free Art License by default ... Please read their license files located
    in their respective directories".

  Decision column: decision D-1 (owner, 2026-10-10), not used. Used for, files in repo and credits:
  none. The row states that nothing from Speed Dreams ships: no tracks (including `g-track-2`,
  `ruudskogen` and `forza`), no cars and no sounds.
- **"Project-owned data"**: one row for `assets/tracks/kestrel-pines/base.layout.json` and
  `overrides.json`: an original layout by the Gamer Gang project, not derived from any existing track,
  with the licence and credits strings of §4.3 quoted verbatim.

Commit this alone first.

**P2.2 Data schema.**
- `SW/track/surfaces.ts` and `SW/track/gen/layout.ts` hold exactly the contracts of §3.1-3.2,
  including zod schemas `trackLayoutSchema` and `trackOverridesSchema` (zod is a client dependency).
  The committed Kestrel Pines files must parse unchanged: they use the top-level `name`, `null`
  vertical tangents and the `fence` barrier.
- `layout.test.ts` uses inline fixtures written for the test (a small closed loop of straights and
  arcs) plus the committed JSON for the parse check. Kestrel Pines' overrides use none of the patch
  features and its layout already closes, so the track data alone does not exercise this code. It must
  cover:
  - the committed `base.layout.json` and `overrides.json` parsing with the schemas unchanged;
  - the schemas rejecting a wrong `format`, an unknown surface or barrier name, and an arc with
    `arc <= 0`;
  - the override order of P2.4 step 1 on the fixture: global `roadWidth`, `kerbWidth` only where
    kerbWidth > 0, `runoffSurfaceRemap`, `runoffClamp`, `remove`, `insertAfter`, per-segment patches
    (side patches merge field by field) and `extraKerbs` spans;
  - an unknown segment name in any override being an error that names the segment;
  - closure on the fixture loop with deliberately wrong straight lengths and arc: it closes within
    0.05 m with the heading error under 1e-6 rad, and it throws for two closure straights under 20°
    apart.

**P2.3 Committed data and the track check script.**
- Copy `LAYOUT/base.layout.json` and `LAYOUT/overrides.json` byte for byte (`cp`) into
  `assets/tracks/kestrel-pines/`. Never re-serialise, reformat or edit them, and check both with
  `sha256sum` against §4.3. There is no `LICENCE.txt` for Kestrel Pines (decision D-2). These files are
  served at `/tracks/kestrel-pines/...` (Vite `publicDir` is `../assets`) and copied into every build.
  `assets/` is ignored by Prettier and ESLint.
- `client/scripts/check-track.mjs`, run with tsx so it can import the TS schemas and generator. Root
  script: `"assets:track": "tsx client/scripts/check-track.mjs"`.
- Usage:
  ```
  pnpm assets:track assets/tracks/kestrel-pines
  ```
- It reads `base.layout.json` and `overrides.json` from the given folder, validates them with
  `trackLayoutSchema` and `trackOverridesSchema`, and runs `generateTrack`.
- It prints segment count, horizontal length, net turn (must be ±360°), the plan closure gap before
  closure, the changes closure made (arc in degrees, straight lengths in metres), the minimum layout
  radius, the elevation range and any corridor warnings. Appendix C.3 lists the expected values.
- It exits non-zero on any schema, closure or generation error. It never writes a file and reads
  nothing but the two files.
- If tsx cannot import `.ts` from `.mjs`, rename the script to `.mts`, add `'client/scripts/**/*.mts'` to
  the Node-globals `files` list in `eslint.config.js`, and disable type-checked linting for it with the
  existing `disableTypeChecked` pattern.

**P2.4 Generator.** Implements `generateTrack(base: TrackLayout, overrides: TrackOverrides): GeneratedTrack`
(§3.3). Steps, each in its own module:

1. **Overrides** (`overrides.ts`). Apply in this order:
   1. `roadWidth`;
   2. `kerbWidth` (to every side with kerbWidth > 0);
   3. `runoffSurfaceRemap`;
   4. `runoffClamp`;
   5. `remove`;
   6. `insertAfter`;
   7. per-segment `segments` patches (side patches merge field by field);
   8. `extraKerbs` (kept as spans for step 6).

   Unknown segment names are an error naming the segment.
2. **Plan integration** (`centreline.ts`).
   - Integrate x, z and heading at 0.25 m steps.
   - Constant-radius arcs use the closed form. A spiral (`radiusStart != radiusEnd`) has curvature
     linear in arc length from `1/radiusStart` to `1/radiusEnd` (signed: + for left). Its length is
     `L = 2 * arc / (1/radiusStart + 1/radiusEnd)`.
   - Straight length is `length`.
   - Axes: start at the origin with heading 0 along +x of the layout's plan frame `(x, y)`, with
     heading counter-clockwise positive, so left turns add heading (the frame the Kestrel Pines file
     was designed in; Appendix C.1 headings use it). Our yaw (0 faces +Z) is
     `yaw = layoutHeading + PI/2`, and plan `(x, y)` maps to ours `(x, z) = (x, -y)`. Left turns
     become **positive** curvature (`Track` convention: + bends left).
3. **Closure** (`closure.ts`).
   1. Heading: let `err` = the total signed turned angle (+ = left) minus the nearer of ±2π (+2π for
      Kestrel Pines). Correct the arc named `closure.arc` by `arc -= err × (type === 'left' ? 1 : -1)`:
      a left arc adds positive heading and a right arc negative, while `arc` itself is always > 0.
      Throw if the corrected `arc` is ≤ 0. If `closure.arc` is null, require |err| < 1e-6, else throw.
      (Kestrel Pines uses "the Drop apex", a right-hander. Its layout already closes, so the
      correction only absorbs rounding.)
   2. Re-integrate.
   3. Position: solve the 2×2 system `ΔL1·d1 + ΔL2·d2 = -gap` for the two named straights. `d1` and
      `d2` are their unit directions after the heading fix. (Kestrel Pines: "the Ladder", heading
      105°, and "back straight", heading 220°, 115° apart.)
   4. Reject the result (throw with details) if the angle between d1 and d2 is under 20°, if any new
      straight is under 20 m, or if any change exceeds 50% of the original.
   5. Re-integrate. Spread any residual (must be < 0.05 m) linearly over arc length.
4. **Elevation and bank** (`elevation.ts`).
   - Per segment, a C1 cubic Hermite from start z to `zEnd`. Tangents are `tangentStart`/`tangentEnd`
     when given; otherwise each join takes the average of the adjacent segments' mean grades.
   - Bank and side widths interpolate linearly over each segment.
   - Then enforce vertical curvature limits on the closed loop, at 0.5 m spacing: crest radius
     ≥ `TRACKGEN.crestRadius` (416 m: `v² / (0.5 g)` with v = 52 m/s and g = 13) and sag radius
     ≥ `TRACKGEN.sagRadius` (208 m). Method: repeatedly apply periodic `[1, 2, 1] / 4` smoothing to y
     at the offending stations only, until none exceed the limit by more than 10% or 2000 passes have
     run (then throw).
   - Smoothing a periodic signal keeps closure. Also smooth bank with a 20 m moving average so bank
     never steps.
5. **Resample.** `count = round(L / TRACKGEN.spacing)` with `TRACKGEN.spacing = 1`, so the real
   spacing is `L / count` (about 1.000 m). Resample x, y, z, heading, curvature, bank and side widths
   at `i * spacing`. Station `count` is implicitly station 0, with no duplicated end station. Station 0
   is at `startOffset` (default 0, the start of `segments[0]`), so `startDistance = 0`.
6. **Corridor profile** (`corridor.ts` `corridorProfile(...)`, per station and side). The fields are
   `road` (half asphalt width), `kerb`, `kerbHeight`, `runoff`, `runoffSurface`, `barrier`, and
   `wall = road + kerb + runoff`, all from the resampled layout values.
   - Apply the `extraKerbs` spans.
   - Enforce `inside wall < 0.9 / |curvature|` by shrinking that side's run-off, and record a warning
     for it. (This changes only run-off, never `road`, so the racing line below is unaffected.)
7. **Centre.** Translate so the plan bounding box is centred on the origin. Keep y as is: the start
   line sits at the start segment's z, which is 0 for Kestrel Pines.
8. **Racing line and speed profile** (`racingLine.ts`). Needs the road half-widths from step 6.
   - Start with lateral offset 0. Run 600 iterations of elastic-band relaxation: move each lateral
     towards the value that puts the point at the midpoint of the points `±TRACKGEN... RACING_LINE.span`
     (8 stations) away. Clamp to `±(road - RACING_LINE.edgeMargin)` (margin 1.3 m).
   - Line curvature comes from the resulting points.
   - Speed: `v = min(RACING_LINE.vMax (51), sqrt(RACING_LINE.lateralAccel (15) / |k|))`. Then a
     backward pass with braking `RACING_LINE.brakeDecel (11 m/s²)` and a forward pass with
     `a = min(5, ENGINE.force * (1 - (v / ENGINE.topSpeed)²) / CAR.mass)`. Both passes are periodic
     (iterate twice around the loop).
9. **Tyre barriers** (`corridor.ts` `applyTyreBarriers(...)`). Needs the speed profile from step 8:
   where it drops by more than `TRACKGEN.tyreDropSpeed` (12 m/s) into a corner, the **outside** barrier
   from the braking point to apex + 40 m becomes `tyres`.
10. **Output** `GeneratedTrack` (§3.3). `generate.ts` runs steps 1-10 in this order.

All randomness goes through a seeded mulberry32. Use seed `hash32(id)` (FNV-1a over the track id).

**P2.5 `Track` refactor** (`SW/track/track.ts`, contract §3.4).
- The constructor takes a `GeneratedTrack` and builds `samples` from the stations:
  - `position = (x, y, z)`;
  - `tangent = (sin heading, 0, cos heading)`;
  - `right = tangent × UP`, horizontal, so `project` and `lateral` keep their meaning;
  - `distance = i * spacing`;
  - `curvature` copied as is (no re-smoothing);
  - plus `bank`, `grade`, `sideL`, `sideR`, `racingLine` and `targetSpeed`.
- Keep the public members and signatures of `wrap`, `ahead`, `sample`, `sampleAt`, `project`,
  `gridSpawns`, `spawnAt` and `minimumRadius`. `sampleAt` uses `round(wrap(d) / spacing)`.
- `halfRoad` is the median of road half-widths. `halfDrivable` is the median of `min(wall)` over
  both sides.
- Checkpoints get `halfWidthLeft = sideL.wall + 1.5` and `halfWidthRight = sideR.wall + 1.5`, and lose
  `halfWidth`.
- `spawnAt`: `y = position.y + crossSectionY(index, lateral) + 0.5`.
- `gridSpawns`: lateral `±0.45 × road` of that side.
- Add `side`, `crossSectionY`, `lateralPoint`, `surfaceAt`, `bounds`, `spacing` and
  `validateCorridor` exactly as in §3.4.
- Delete `TrackDefinition`, `CatmullRomCurve3`, `computeCurvature` and the "hairpin" comment.
- `SW/track/tracks.ts` becomes the final §3.5 version: `buildTrack(base, overrides)` (sync, validates
  with zod) and `loadTrack1()`, which fetches both JSON files from `TRACK_1.url` and calls
  `buildTrack`. Delete `createPlaceholderTrack` and the interim points.

**P2.6 Geometry and physics.**
- `SW/track/trackGeometry.ts`:
  - `buildStrip` now places vertices with `track.lateralPoint(i, lateral, out, lift)`, so legacy
    visuals follow banking until P5 replaces them.
  - Delete `drivableSurface`, `wallSegments`, `WALL_THICKNESS` and `WALL_SEGMENT`.
  - Keep `TrackProximity` and `WALL_HEIGHT`.
  - Export `corridorPhysicsMesh`, `wallHulls` and `corridorChunks` (implemented in `gen/corridor.ts`,
    re-exported here or imported from there; pick one place and document it).
- `corridorChunks(track, chunkLength = TRACKGEN.chunkLength /*150*/)` produces the visual bands of
  §3.6 per chunk:
  - All vertex positions come from `lateralPoint`. Lift only the edge `lines` (0.01 m) and the kerb
    teeth.
  - The kerb band carries a sawtooth on its top surface: every 0.5 m along the track a ridge
    0.02 m high across the kerb.
  - UVs are in metres: u = lateral, v = distance along the lap. Kerbs use u across 0..1.
  - Chunks share boundary rings, and the last chunk wraps to station 0 with v = `length`, as
    `buildStrip` already does.
  - Normals are computed per band from the geometry, smooth along the track.
  - Asphalt vertices carry the `racingLine` lateral of their station.
  - `tyreStacks`: one instance every 1.0 m along the wall face where `barrier === tyres`, two rows deep.
    `armcoPosts`: one every 4 m where `barrier === armco`. `skirt`: a 1.0 m vertical drop at the
    run-off outer edge on both sides.
- `corridorPhysicsMesh(track)` uses exactly the visual vertices of the asphalt, kerb, apron and run-off
  bands (no teeth, no lines), with one `SurfaceId` per triangle. Triangles wind CCW seen from above.
- `wallHulls(track)`: per side, every 4 stations, an 8-point convex hull. Its inner face runs along
  `lateralPoint(i, ±wall)` from 1.0 m below the wall foot to `WALL_HEIGHT` (2.6 m) above it. It is
  `TRACKGEN.wallThickness` (1 m) thick outward, and 0.6 m longer at each end so neighbours overlap.
  There is a collision wall at every station, whether or not a visible barrier exists.
- `SW/track/trackPhysics.ts`:
  - Split the physics triangles by surface into up to 4 trimesh colliders
    (`physics.addTrimesh`, which already sets `FIX_INTERNAL_EDGES`), and `physics.registerSurface` each.
  - Walls via `physics.addConvexHull(points, SURFACE_FRICTION.wall)`.
  - Floor: a box centred on the track bounds centre, half extents `(bounds size / 2 + 600, 1, ...)`,
    top 6 m below `bounds.minY`.
- `SW/sim/world.ts`: `registerSurface(collider, surface)` stores the handle in a
  `Map<number, SurfaceId>`. `surfaceOf(collider | null)` returns `SURFACE.asphalt` for null or unknown
  colliders, so the box planes in `car.test.ts` and `simulation.test.ts` stay asphalt.
- `SW/sim/simulation.ts`:
  `new Car(this.physics.rapier, this.physics.world, spawn, (c) => this.physics.surfaceOf(c))`.
- `SW/sim/car.ts` (P2 regions only, with the import anchors given in §2.2):
  - Optional fourth constructor parameter
    `surfaceOf: (collider: Collider | null) => SurfaceId = () => SURFACE.asphalt`.
  - `readonly wheelSurface = new Uint8Array(WHEEL_COUNT)`.
  - In `postPhysics`, for each wheel in contact:
    `wheelSurface[i] = surfaceOf(vehicle.wheelGroundObject(i))`. Keep the last value while airborne.
  - In `applyGrip`, set `setWheelFrictionSlip` for **all four** wheels every step: base grip (front
    `TYRES.frontGrip`, rear the existing handbrake-adjusted rear grip) times
    `SURFACES[name].grip`. Remove the one-off front setting from the constructor loop, but keep side
    stiffness as it is.
  - In `addGroundAssists`, extra rolling resistance
    `Σ over grounded wheels SURFACES[name].rolling / WHEEL_COUNT`, added to the existing rolling term.
  - `get dominantSurface(): SurfaceId` is the most common surface among wheels in contact (ties go to
    the higher id); asphalt when none are in contact.
- `SW/config.ts` (P2 anchor). These are starting values; the tests below gate them.
  ```ts
  export const SURFACES = {
    /** Grip multiplier on tyre friction, extra rolling resistance (N, whole car on it), rumble 0..1 (audio, camera). */
    asphalt: { grip: 1, rolling: 0, rumble: 0 },
    kerb: { grip: 0.95, rolling: 60, rumble: 0.7 },
    grass: { grip: 0.55, rolling: 1500, rumble: 0.3 },
    gravel: { grip: 0.45, rolling: 6000, rumble: 0.6 },
  } as const;
  export const TRACKGEN = { spacing: 1, chunkLength: 150, crestRadius: 416, sagRadius: 208,
    runoffMaxSlope: 0.035, runoffFall: 0.01, wallHeight: 2.6, wallThickness: 1, tyreDropSpeed: 12,
    terrainMargin: 380, terrainSpacing: 5, shoulderMin: 12, shoulderMax: 28, checkpointHalfLength: 3 } as const;
  export const RACING_LINE = { span: 8, iterations: 600, edgeMargin: 1.3, vMax: 51, lateralAccel: 15, brakeDecel: 11 } as const;
  ```
  `WALL_HEIGHT` in `trackGeometry.ts` re-exports `TRACKGEN.wallHeight`.

**P2.7 Race rules** (P2 regions of `race.ts`).
- `offTrack` becomes:
  `lateral < -(sideL.wall + 3) || lateral > sideR.wall + 3 || car.position.y < sample.y + crossSectionY(index, lateral) - 4`.
- `insideGate`: use the signed lateral against `-halfWidthLeft..halfWidthRight`.
- Add `safeDistance: number` to `Racer`, initialised to the projection distance. Update it each step
  when all of these hold: racing, `respawn === 'none'`, `groundedWheels === 4`,
  `|lateral| <= road of that side`, `forwardSpeed > 3` and `wrongWayTime === 0`.
- `teleport` base: `racer.safeDistance - 10` (or `startLine.distance - 10` before the first gate).
  The car spawns in its own lane:
  `lane = ((slot % 4) - 1.5) * 0.5 * road(local side)`.
  Keep the 8 m step-back occupancy search. `skipToNextGate` uses the same local lane width.

**P2.8 Terrain heightfield** (`SW/track/terrain.ts`, contract §3.7).
- `fbm` below is `fbm` from `./noise` (created by P1; import it, do not copy or move it). P2.9 uses
  the same function.
- Bounds: the track bounds plus `TRACKGEN.terrainMargin`. Spacing: `TRACKGEN.terrainSpacing`.
- Build the field by **station splatting**, not per-cell nearest queries. For every station i and side,
  visit the cells within `wall + shoulderMax + 5 m` of the station. Keep, per cell, the nearest station
  (plan distance), its signed lateral and the distance beyond that side's wall.
- Height per cell (`d` = distance inside the wall, `wall - |lateral|`, on the nearest station's side):
  - **Inside the corridor:** `centreY + crossSectionY(i, lateral) + inset(d)`, with
    `inset(d) = -0.05 - 0.35 * clamp(d / (2 * TRACKGEN.terrainSpacing), 0, 1)`: 0.4 m below the
    corridor surface deep inside, rising to 0.05 m below it at the wall foot over the last 10 m. Without
    this taper, the 5 m grid mixes -0.4 m inside vertices into the wall foot and misses it by up to
    0.27 m.
  - **From the wall out to `wall + 2 m`:** `centreY + crossSectionY(i, lateral) - 0.05`.
    `crossSectionY` continues the run-off slope past the wall (§3.4), so the field has no step at the
    wall foot.
  - **Beyond that:** smoothstep blend from `centreY + crossSectionY(i, ±(wall + 2)) - 0.05` to
    `natural(x, z)` over `S = shoulderMin + (shoulderMax - shoulderMin) * fbm(x * 0.01, z * 0.01, 2)`.
  - **Cells not reached:** `natural`.
- `natural(x, z) = meanTrackY + 14 * (fbm(x * 0.004, z * 0.004, 4) - 0.5) + 3 * (fbm(x * 0.02, z * 0.02, 2) - 0.5)`.
- Sight lines: within 60 m of the inside of any corner with radius < 200 m, natural is capped at
  `roadY + 2`.
- `wildness`: 0 out to `wall + 2 m`, rising to 1 at the end of the shoulder.
- `heightAt(x, z)`: linear interpolation on the **same triangle split the terrain mesh uses** (§3.7:
  each cell is cut along the diagonal from `(col, row + 1)` to `(col + 1, row)`), clamped at the edges,
  so props placed with it sit exactly on the rendered terrain. Bilinear interpolation would differ from
  the drawn triangles by up to `|h00 + h11 - h01 - h10| / 4` per cell. Keep `nearRoad()` (legacy) on top
  of `TrackProximity`.
- Budget: building the field for Kestrel Pines takes < 400 ms in Node. Log the time in the test, and
  assert < 2000 ms to allow for slow CI.

**P2.9 Placements** (`gen/placement.ts`, contract §3.8). Deterministic, seed from the track id.
- **Pines:**
  - Candidates on a jittered 7 m grid inside the terrain bounds.
  - Keep a candidate if its distance beyond the nearest wall is ≥ 8 m + 6 m × noise and ≤ 260 m, and
    `rng < density`, where `density = smoothstep(0.35, 0.65, fbm(x * 0.008, z * 0.008, 3))`, raised to
    1 inside 40 m of the wall.
  - Clear zones: 35 m around the start line on the right side (grandstand and gantry), and
    inside-of-corner sight-line cones (radius < 200 m: no trees within 25 m beyond the inside wall over
    the corner length).
  - `scale` is uniform 0.8-1.35 (1 = a 16 m tree). Cap 14,000 pines.
- **Distance boards** `board300/200/100`: before each braking zone whose speed drop is ≥ 15 m/s,
  2.5 m beyond the outside wall, yaw facing the oncoming cars.
- **Marshal posts:** every 300 ± 40 m, 4 m behind the wall on the outside of the nearest corner,
  never within 50 m of the start line.

Tyre walls are part of the corridor (`barrier = tyres`), not placements.

**P2.10 Autopilot** (`SW/debug/autopilot.ts`).
- Aim pure pursuit at `sampleAt(here + look)` offset by `racingLine + lane`, where
  `lane = ((slot % 4) - 1.5) * 0.9`, clamped to ±(road - 1.2).
- The speed target is `0.92 × min(targetSpeed over [here, here + max(25, 2.4 v)])`. Brake fully when
  more than 3 m/s over the target, coast when 0-3 m/s over, otherwise full throttle.
- It must finish laps on Kestrel Pines (tests below).

**P2.11 Tests** (all in Node and fast; keep the whole `pnpm test` under 90 s).
- `generate.test.ts`, using `buildTrack(baseJson, overridesJson)` with the committed JSON imported
  through relative paths:
  - Length is 3350-3370 m (within the 3.2-3.4 km of §1.1). The committed layout integrates to
    3358.9 m, and closure changes that only by rounding.
  - Closure: the gap between station `count-1` and station 0 is within 1.5 × spacing. The heading is
    continuous: with `Δh_i` = the neighbour heading difference wrapped to (-π, π],
    max |Δh_i| < `1.5 × spacing / R_layout`, where `R_layout` is the smallest
    `min(radiusStart, radiusEnd)` over the arc segments of the layout after overrides (30 m, the
    "Switchback apex"), so the limit is about 0.05 rad (an R30 corner alone turns about 0.033 rad per
    station). Take `R_layout` from the layout, not from `track.minimumRadius()`, so that a heading jump
    cannot loosen its own limit. At the seam (station `count-1` to 0, on the start straight)
    |Δh| < 1e-3.
  - Minimum radius: `track.minimumRadius()` is 28-45 m (the "Switchback apex" is R30, and T1
    Millrace at R40 is next).
  - Separate legs: stations more than 500 m apart along the lap (in both directions) are at least
    115 m apart in plan, centre to centre (the closest pair in the layout is 122.1 m: the Windhover
    exit and Kestrel approach at s ≈ 1454 m against the Drop at s ≈ 2048 m). Checking every 4th
    station is enough.
  - Spacing is within 1 ± 0.01 m.
  - Every station has a wall on both sides and wall > road.
  - `validateCorridor()` returns `[]`.
  - Max crest curvature ≤ 1.1 / 416; elevation range 20-24 m (the layout runs from -6.5 to +15.5 m;
    its Hermite profile spans about 22.1 m and already meets the crest and sag limits within 10%, so
    smoothing hardly changes it).
  - A known left turn ("Kestrel hold", R68) has curvature > 0.
  - Bank sign: in the middle of "the Hollow apex" (a right-hander, bank -0.04 in the file)
    `bank < 0` (left edge higher) and `crossSectionY(i, -road) > crossSectionY(i, +road)`.
  - Start line is station 0, with 230 m of straight behind it (|curvature| < 1e-3 over the last
    230 m; "grid straight" is 235 m).
  - 18 checkpoints.
  - Both committed files carry the licence and credits strings of §4.3, and `source.package` is
    `"original"`.
  - Generation is deterministic (two runs are equal).
- `corridor.test.ts`:
  - Physics `surfaceIds.length === indices.length / 3`.
  - No folded triangle (all physics normals have y > 0.7).
  - Chunk count = `ceil(count / 150)`.
  - Adjacent chunks share boundary vertex positions.
  - All four surfaces appear.
- `placement.test.ts`: deterministic count; no pine within 8 m beyond a wall; boards and marshal posts
  exist.
- `terrain.test.ts`:
  - At the wall foot of every 10th station, on both sides, `heightAt` is within 0.1 m of
    `centreY + crossSectionY(i, ±wall) - 0.05` (the inset taper keeps the worst case at a few cm).
  - Inside the corridor (a 1 m lateral grid at every 10th station, out to `wall - 0.5`), `heightAt` is
    at least 0.01 m below the corridor surface.
  - `heightAt` at a grid vertex equals the field value, and at a cell's centre equals the mean of the
    two corners on the split diagonal.
  - Build time is logged and < 2000 ms.
- `SW/sim/surface.test.ts` (flat-world style):
  - A plane registered as grass makes `car.wheelSurface` all 2 and `dominantSurface === SURFACE.grass`
    after 30 steps.
  - On grass the car's top speed after 8 s of full throttle is lower than on asphalt, and lateral grip
    is lower (max slip angle in a fixed full-lock turn is larger).
  - Coasting from 30 m/s on gravel stops within 140 m.
  - An unregistered plane is asphalt.
- `trackPhysics.test.ts` (rewritten for Kestrel Pines):
  - 4 grid cars grounded with |lateral| < road.
  - A full-lock drive into the wall stays within `wall + 0.5`.
  - A car placed with its wheels on a kerb station reads `SURFACE.kerb`.
- `race.test.ts`:
  - Kestrel Pines, 4 cars, autopilot. Step cap `60 * 900`. Bounds `55_000 < bestLapMs < 160_000`.
    Vitest timeout `120_000`. Decide the lap count once, measured with nothing else running on the
    machine (`pnpm vitest run <path>/race.test.ts` alone, not while other packages run tests or
    browsers): if the 3-lap run takes over 40 s there, use `new Race(track, cars, 2)` (P1's laps
    override) and keep everything else. Never decide it from a run under parallel load.
  - Keep the gate-skip test.
  - New safe-respawn test: after driving onto run-off and being reset, the car is placed behind its
    last safe point and on asphalt.

**Acceptance (P2).**
1. The M8 gate (§2.1) is green.
2. `pnpm assets:track assets/tracks/kestrel-pines` exits 0 and prints the Appendix C.3 values, and
   `sha256sum` of both committed files matches §4.3 (byte-identical copies of `LAYOUT/`).
3. All P2 tests pass.
4. Browser check (ports 4100/4543, under the browser lock in §2.1):
   - The TV loads Kestrel Pines (still with the P1 interim visuals; banking now shows in the road).
   - 1 pad with autopilot laps the track (debug overlay P) for 2 laps without the car being respawned
     more than once.
   - Driving onto grass and gravel visibly slows the car (overlay speed).
   - No console errors.
   - Screenshots: the grid, and a banked corner.
5. `LICENCES.md` has the Speed Dreams review section and the project-owned data row (P2.1),
   committed before the track data files. Check with `git log --follow` order.

**Pitfalls (P2).**
- Banking sign: our + raises the right edge, so left-handers bank positive (the Kestrel up to
  +0.10 rad) and right-handers negative (the Hollow -0.04 rad). The committed layout already follows
  this; nothing converts signs. Check it once on screen.
- Closure is mandatory. Every layout tweak breaks it. The committed layout already closes, and its
  closure handles only absorb rounding.
- Never edit the committed layout files to make a test pass. Fix the generator, or report the failure:
  the layout belongs to the owner, and any geometry change needs the originality check of §4.3
  re-run, which is outside the M8 packages.
- Index-as-metres constants (risk R-9) are fine at spacing ≈ 1.000 m. Do not go to 0.5 m.
- `FIX_INTERNAL_EDGES` works only within one collider. Wheel rays do not care about seams between
  surface colliders; check that the chassis does not snag at a kerb seam (drive over kerbs in the
  browser check).
- Rapier's ray-cast vehicle ignores collider friction for tyres (grip comes from `frictionSlip`).
  `surface.test.ts` proves the per-wheel path works.
- `Float32Array` precision is fine for ±600 m coordinates (about 6e-5 m).
- Grass and gravel run-off up to 30 m wide means `halfDrivable` is only nominal. Any remaining legacy
  caller (P1 visuals, gantry) may look odd until P5. That is expected.

### 2.5 P3: Render path, profiling, presets, telemetry (parallel)

**Purpose.**
- Replace the per-viewport post pipeline with one shared HDR atlas and one post chain.
- Render the canvas at DPR 1 with an RCAS-style upscale and sharpen.
- Add a GPU timer, a GPU-time resolution controller, three presets with a loading benchmark and
  between-race drops, SunLight shadows, and the car shadow-proxy fix.
- Add shader precompilation behind the loading screen, the profiling overlay, the fly-through and soak
  benchmarks, and the telemetry client, API route, table and report script.

**Branch:** `m8/p3-render`, worktree `/home/user/m8-wt/p3`, ports 4200/4643.

**Files P3 owns.**
- Create:
  - `SW/render/gpuTimer.ts`, `SW/render/resolution.ts` (replaces `dynamicResolution.ts`),
    `SW/render/quality.ts`, `SW/render/frameStats.ts`, `SW/render/shadowRig.ts` (replaces `sun.ts`).
  - `SW/render/frameStats.test.ts`, `SW/render/resolution.test.ts`, `SW/render/quality.test.ts`
    (Node-safe: no WebGL in these modules).
  - `SW/debug/benchmark.ts`, `SW/debug/benchFlags.ts`, `client/src/net/telemetry.ts`,
    `client/src/net/telemetry.test.ts`, `client/src/vite-env.d.ts`, `server/src/db/telemetryReport.ts`.
- Edit:
  - `SW/render/renderer.ts`, `SW/render/postProcessing.ts`, `SW/render/viewports.ts` (integer rects
    helper only).
  - `SW/loop.ts`, `SW/debug/debugOverlay.ts`, `SW/game.ts` (P3 regions only), `SW/config.ts`
    (P3 anchor only).
  - `SW/scene/carVisual.ts` and `SW/scene/podium.ts` (shadow proxy only), `SW/scene/world.ts`
    (add the `setQuality` stub only).
  - `SW/tv/SplitWaysStage.tsx`, `SW/tv/stage.css` (append only), `client/src/tv/TvApp.tsx`
    (bots flag only), `client/src/net/api.ts`, `client/vite.config.ts` (build id only).
  - `shared/src/api.ts` (append the telemetry block; add `MAX_PLAYERS` to the `./protocol` import line).
  - `server/src/api/router.ts`, `server/src/api/http.ts`, `server/src/db/store.ts`,
    `server/src/db/schema.ts`, `server/src/api/router.test.ts`, `server/src/db/store.test.ts`.
  - `scripts/build-vercel.mjs`, root `package.json` (P3 anchor only).
- Delete: `SW/render/dynamicResolution.ts`, `SW/render/sun.ts`.

**Must not touch:** `SW/track/**`, `SW/sim/**`, `SW/race/**`, `SW/pad/**`, `SW/input/**`,
`SW/hud/**`, the scene files other than those three small edits, `shared/src/protocol.ts`, and the P4
regions of `game.ts`.

**Tasks.**

**P3.1 Quality presets and session memory** (`SW/render/quality.ts`, contract §3.9).
- `PRESETS` table in `config.ts` (values in §3.9).
- `presetForPlayers(n)`: 1 → high, 2 → medium, 3-4 → low. Viewport count, including the 3-player
  overview cell, does not change this.
- Module-level session memory `{ playerCount, drops }`, mirrored to `sessionStorage` key
  `gamergang.splitways.quality` (every access in try/catch).
  - `startingPreset(n)` = `presetForPlayers(n)` lowered by `drops` steps, never below low.
  - `drops` resets to 0 when the player count changes.
  - `drops` counts only **effective** drops: it never increments while `startingPreset(n)` is already
    `low`, so a 3-4 player session on Low always reports `presetDrops = 0` unless the preset changed.
  - `recordRaceOutcome(n, o)` increments `drops` (subject to the rule above) when
    `o.atFloorShare > RESOLUTION.dropIfFloorShare (0.2)` or
    `o.missedShare > RESOLUTION.dropIfMissedShare (0.01)`.
  - `noteLoadingDrop(n)` increments `drops` once when the loading benchmark drops (subject to the rule
    above; the loading benchmark does not drop below Low either).
- Presets change **only** before a race starts (loading screen) or inside a benchmark, never during a
  race. Each race mounts a new `SplitWaysGame` and a new `WebGLRenderer` (`TvApp.tsx:85-91`), which
  is why the memory is module-level.

**P3.2 Frame stats and GPU timer.**
- `frameStats.ts` (contract §3.10): allocation-free and Node-safe.
  - Two accumulators: the **window** (cleared by `resetWindow()`) and the **total** (cleared by
    `resetTotal()`). Each holds three cumulative histograms (raw rAF delta, CPU ms, GPU ms) with
    0.1 ms buckets from 0 to 50 ms plus one overflow bucket, plus the counts, sums and maxima needed
    for `FrameWindow` (fps, averages, max, missed frames, scale avg/min, draw-call and triangle
    averages). Memory is fixed (about 12 KB), so whole races and 30-minute soaks give exact
    percentiles.
  - Every percentile in `snapshot()` / `snapshotTotal()` comes from the histograms (the bucket's upper
    edge; a percentile that lands in the overflow bucket reports that accumulator's maximum). There is
    no frame ring.
  - `record(rafMs, cpuMs, gpuMs, scale, drawCalls, triangles)` exactly as §3.10. A null `gpuMs` is not
    added to the GPU histogram; `gpuMsAvg/P95/P99` are null when no GPU sample was recorded.
  - A frame is **missed** when `rafMs > RESOLUTION.missedFactor (1.5) × intervalMs`, with
    `intervalMs = 1000 / Math.min(60, refreshHz())`.
  - Ignore deltas > `RESOLUTION.hiccupMs` (250 ms, tab switches): such frames are not recorded at all.
  - `setRefreshHz(hz)` / `refreshHz()`: the display refresh measured once by `measureRefreshHz()`
    (P3.3); 60 until set.
  - Unit tests (`frameStats.test.ts`): percentiles on synthetic data; **3600 frames whose slow CPU and
    GPU frames all come first** (outside any last-600 window) still produce the right p99; window and
    total reset independently; missed counting at refresh 60 and 50.
- `gpuTimer.ts`:
  - Wraps `EXT_disjoint_timer_query_webgl2` with a ring of 4 `WebGLQuery`.
  - Declare the extension interface locally: `TIME_ELAPSED_EXT = 0x88BF`, `GPU_DISJOINT_EXT = 0x8FBB`
    (TS 6.0.3 `lib.dom` lacks it). Cast `getExtension`'s result for `strictTypeChecked`.
  - `begin()`/`end()` wrap the whole frame. TIME_ELAPSED cannot nest, and three issues no queries
    itself.
  - `poll()` is non-blocking: it checks `QUERY_RESULT_AVAILABLE` and returns the newest result in ms,
    or null.
  - If `getParameter(GPU_DISJOINT_EXT)` is true, drop all pending results.
  - `supported` is false when the extension is missing, in which case every method is a no-op.

**P3.3 Resolution controller** (`resolution.ts`, contract §3.10). Replaces `dynamicResolution.ts`.
- **Frame interval:** `intervalMs = 1000 / Math.min(60, frameStats.refreshHz())`, so the budget is
  never shorter than 16.7 ms (never budget for more than 60 Hz). On a 50 Hz display it is 20 ms. Missed
  frames are measured against the same interval. (On a display above 60 Hz the loop still renders on
  every rAF; a 60 fps cap there is a follow-up, not needed on the reference device.)
- **Refresh measurement:** `measureRefreshHz(frames = 30)` (in `renderer.ts`, §3.11) runs `frames`
  empty rAF callbacks while the page is otherwise idle (the start of `prepare()`, before precompile),
  takes the median delta and snaps it to 30/50/60/75/90/100/120/144 Hz when within 4% (otherwise it
  rounds `1000 / median`). An idle page runs rAF at the display rate, so this measures the display, not
  the game. Never estimate refresh from in-game frames: a game held at 30 fps would read as a 30 Hz
  display and budget 33 ms. The pure snapping function `snapRefreshHz(medianDeltaMs)` lives in
  `frameStats.ts` and is unit-tested.
- GPU mode, with timer samples (median of the last `RESOLUTION.sampleWindow` = 8):
  - If the median > `dropAboveShare` (0.88) × interval and ≥ `minChangeMs` (250) have passed since the
    last change: `scale = max(minScale, quantise(scale * sqrt(target / median)))`, where target is
    `targetShare` (0.78) × interval, quantised **down** to `RESOLUTION.step` (0.05), and at least one
    step down.
  - If the median < `raiseBelowShare` (0.65) × interval continuously for `raiseAfterMs` (2000), raise
    by one step, up to 1.
- Fallback mode (no timer):
  - A missed frame is a rAF delta > `missedFactor` (1.5) × interval.
  - If ≥ `fallbackMissedPer60` (3) frames were missed in the last 60, drop one step (≥ 500 ms since the
    last change).
  - Raise one step after `fallbackRaiseAfterMs` (4000) with no missed frames.
- `enabled = false` (debug key R, and the loading benchmark) pins scale at 1.
- Exposes `atFloorShare` and `missedShare` since the last `resetStats()`.
- The scale never reallocates GPU memory: the renderer draws sub-rectangles of targets allocated at
  scale 1.
- Unit tests (`resolution.test.ts`): scripted GPU ms sequences give the expected steps and hysteresis;
  at refresh 120 the interval is still 16.7 ms and steady 60 fps frames (16.7 ms deltas) count as
  neither missed nor over budget.

**P3.4 Renderer and post pipeline rewrite** (`renderer.ts`, `postProcessing.ts`, contract §3.11).
- **Canvas.** Call `webgl.setPixelRatio(RENDER.canvasPixelRatio /*1*/)` always, and delete
  `maxPixelRatio`. The canvas size equals the CSS size, so layout rects (CSS px) are canvas px.
  Round rects to integers in `layout()`.
- **Atlas.**
  - `setLayout(rects)` computes `baseScale = min(1, sqrt(preset.maxInternalPixels / Σ rect area))`.
  - Tile i's **allocated** size is `ceil(rect_i × baseScale)`, rounded up to a multiple of 16. The
    rounding is for allocation only; it never sets the rendered size.
  - Tiles go in a 2-column grid with origins on multiples of 16 and ≥ `RENDER.tilePadding` (16 px) of
    padding between and around them.
  - Allocate the **atlas** (`HalfFloatType`, no MSAA, no depth) and the **LDR atlas** (RGBA8, same
    layout, no depth) to fit them. Allocate one **scene scratch** target (`HalfFloatType`,
    `samples = preset.msaa`, depth, `resolveDepthBuffer: false`, `storeMultisampledDepthBuffer: false`)
    the size of the largest tile.
  - Reallocate only in `setLayout` or `setPreset`.
  - Clear both atlases to 0 once after allocation, so the padding stays black.
- **Per view** (`renderView(index, scene, camera, speed)`):
  - The **rendered size** is `w_i = min(tileW_i, round(rect_i.width × baseScale × scale))` and
    `h_i = min(tileH_i, round(rect_i.height × baseScale × scale))`. At scale 1 on a 1920×1080 output
    with baseScale 1 that is exactly 1920×1080 (the tile is 1920×1088), so the aspect matches the chase
    camera's `rect.width / rect.height` and no pixel is resampled. Use `(w_i, h_i)` for the viewport
    and scissor, the copy, the bloom clamps and the composite transform.
  - Set `scratch.viewport.set(0, 0, w_i, h_i)`, `scratch.scissor.set(0, 0, w_i, h_i)` and
    `scratch.scissorTest = true` **on the target object**, then `setRenderTarget(scratch)`, `clear()`,
    `render(scene, camera)`. The shadow pass inside `render()` restores the target's own
    viewport/scissor (WebGLRenderer.js:2954-2960), and `renderer.setViewport` is ignored for targets.
  - Then copy the scratch region into atlas tile i: a fullscreen-triangle copy `ShaderMaterial`, with
    `atlas.viewport`/`scissor` = tile origin and size `(w_i, h_i)`, sampling
    `uv * vec2(w_i, h_i) / scratchSize`.
  - Record the tile's used rect `(w_i, h_i)` for the post passes.
  - Why a scratch target plus copy instead of rendering straight into the atlas: three resolves MSAA
    by blitting the **whole** target (`WebGLTextures.js:2342`) and then invalidates the multisampled
    colour attachment (`:2360`). Rendering several scissored views into one MSAA atlas would depend
    on blit-scissor behaviour on ANGLE/Metal. The copy costs about one internal-resolution pass in
    total and is safe everywhere (decision D-7).
- **Bloom** (`endFrame`, once per frame).
  - Prefilter, then `preset.bloomLevels - 1` downsamples and the matching additive upsamples over the
    atlas. Mip i is `atlas size >> (i + 1)`.
  - Every tap is clamped to its tile's used rect at that mip level, inset by half a texel. Pass
    `uTiles[4]` (uv min/max per tile for the current `(w_i, h_i)`) and `uTileCount`, and look the tile
    up by the fragment's position.
  - Fragments outside every tile write 0.
  - Limit each mip pass to the bounding box of the used tiles via the mip target's `viewport` and
    `scissor`.
- **Composite** (always into the LDR atlas).
  - One fullscreen pass into the LDR atlas, writing only the used tile rects (viewport/scissor per the
    bounding box; fragments outside tiles are skipped). Uniforms: `uTileXform[4]` (offset/scale into
    HDR atlas uv for the current `(w_i, h_i)`), `uSpeed[4]`, `uAspect[4]`, `uCount`.
  - Each fragment finds its tile, samples scene and bloom, and applies the grade, ACES, vignette and
    speed lines per viewport, exactly as today, then sRGB encoding and the existing dither (the dither
    happens here, before the 8-bit write). The LDR atlas holds display-ready values.
  - The canvas clear in `beginFrame` goes away.
- **Final pass: upscale + RCAS, always run, one program** (to the canvas).
  - For each canvas pixel, find its viewport from `uRects[4]` (canvas px, y-flipped for GL), map it
    into that viewport's LDR tile `(w_i, h_i)`, and fetch the centre and 4 neighbours bilinearly at
    ±1 **output** pixel spacing, clamped to the tile. Fragments outside all rects get the seam colour
    (0x050608, `RENDER.seamColour`).
  - Apply the RCAS sharpening math, ported into GLSL from `THREE/examples/jsm/tsl/display/SharpenNode.js`
    (MIT; TSL-only in r186, there is no GLSL version). The lobe is multiplied by
    `uSharpen = exp2(-preset.sharpness)`: `sharpness` is in stops, 0 = strongest, each +1 halves the
    strength (2 = 25%, not off). **Off** is `uSharpen = 0`, which makes the pass an exact copy.
  - Sharpening is on (`uSharpen > 0`) when any view is upscaled (`baseScale × scale < 1`) or
    `devicePixelRatio > RENDER.sharpenWhenDprAbove` (1.25; the browser then upscales the DPR-1 canvas).
    Otherwise it is off. `RenderStats.sharpening` reports it.
  - No colour conversion here (the LDR atlas is already display-ready); no second dither.
  - Because the composite and final pass always run, a 1080p TV at DPR 1 takes the same code path as a
    4K TV, and changing scale or toggling R never creates a new shader program.
- **`beginFrame(now, rafMs)`:** `gpuTimer.begin()`, `webgl.info.reset()`, resolution update with the
  last polled GPU ms and `intervalMs` (P3.3).
- **`endFrame(time, cpuMs)`:** bloom, composite, final pass, `gpuTimer.end()`, then
  `frameStats.record(rafMs, cpuMs, gpuMs, scale, info.render.calls, info.render.triangles)`. `cpuMs` is
  the **previous** frame's `loop.lastCpuMs`: the current callback's CPU time is not known until it
  returns.
- **`precompile(scene, camera)`:**
  - Bind the scratch target, then `await webgl.compileAsync(scene, camera)`. Program keys depend on
    the bound target (`WebGLPrograms.js:121, 177-183, 213`).
  - Then render `RENDER.warmupFrames` (3) full frames through the normal path (scratch, copy, bloom,
    composite, final pass), which compiles the shadow depth materials and every post program.
    `compileAsync` only covers scene materials. Render the first warm-up frame with the scale forced
    to `minScale` and the rest at scale 1, so both are exercised (they share programs; this is a
    guard).
  - Record `webgl.info.programs.length` as the baseline. The overlay shows "late" compiles as the
    current count minus the baseline.
- **`dispose()`:** dispose targets and materials, `webgl.dispose()`, then `webgl.forceContextLoss()`.
- `stats` getter (§3.11).

**P3.5 Shadows** (`shadowRig.ts`, contract §3.12).
- `createShadowRig(scene, preset, direction, colour, intensity)`.
- **SunLight rig** (presets with `shadow.kind === 'sun'`):
  - `import { SunLight } from 'three/examples/jsm/lights/SunLight.js'`.
  - `light.position.copy(direction).multiplyScalar(100)`. Direction is set by position; the light
    shines towards the origin and has no target.
  - `castShadow = true`, `shadow.mapSize.set(m, m)` (per cascade; the atlas is 2m × m),
    `shadow.camera.far = preset.shadow.far`, `bias = -0.0004`, `normalBias = 0.03`,
    `radius = preset.shadowRadius`. Add it to the scene. `beforeView()` is a no-op, because the
    cascades refit to the view camera inside every `render()`.
- **Focus rig** (`kind === 'focus'`, the Low preset): today's `Sun` logic, a `DirectionalLight` with a
  texel-snapped box of ±`extent` aimed by `beforeView(focus)`. Delete the `shadow.camera.layers` line.
- `game.ts` creates the rig after the sky (it needs `sky.sunDirection`) and calls
  `shadows.beforeView(root.position)` where `sun.focus(...)` is today (both the driver loop and the
  overview).
- **Car shadow proxy fix.**
  - Background: three culls shadow casters by the **view** camera's layers
    (`WebGLShadowMap.js:522`), so today's layer-1 proxy never casts.
  - In `carVisual.ts`: proxy material `new MeshBasicMaterial({ colorWrite: false, depthWrite: false })`,
    on the default layer (delete `layers.set`), `castShadow = true`. Model meshes keep
    `castShadow = false`.
  - Delete `SHADOW_PROXY_LAYER` and its uses in `sun.ts` and `podium.ts:75`.
  - Cost: one invisible draw per car per view.
- Changing light type or shadow settings changes shader programs. Only do it in `prepare()` or the
  benchmark, then precompile again.

**P3.6 `game.ts` integration** (P3 regions, §2.2).
- `create(container, players, hooks, options: GameOptions = { bench: null })`: compute
  `preset = startingPreset(players.length)` **before** `WorldVisual.create`, and pass
  `preset.anisotropy` instead of `ANISOTROPY` (then delete the `ANISOTROPY` constant).
- Constructor:
  - `new GameRenderer(canvas, preset)`.
  - The shadow rig replaces `Sun`.
  - `this.world.setQuality(preset)`.
  - `new Race(track, cars, options.bench === 'soak' ? 99 : undefined)`. 99 is the protocol's lap
    maximum (`raceSchema.lap`/`totalLaps` ≤ 99); 99 laps of about 95 s is about 2.6 h, far longer than
    the 30-minute soak.
  - `this.autopilotOn = options.bench === 'soak'`.
  - **Do not start the loop or the status timer.** Delete `this.loop.start()` and move the
    `statusTimer = setInterval(...)` line out of the constructor (the field becomes
    `private statusTimer: ReturnType<typeof setInterval> | null = null`). Until `start()`, pads get no
    race message, so they show the plain controller (the pad shows the countdown overlay only for a
    `race` message with phase `countdown`) instead of a frozen "3" during loading.
- New `async prepare(): Promise<void>`, placed with `start()` directly after the constructor:
  1. `frameStats.setRefreshHz(await measureRefreshHz())` (the page is idle: the loop is not running).
  2. `layout()`.
  3. `await renderer.precompile(scene, firstDriverCamera)`, with cameras snapped at the grid.
  4. **Loading benchmark:** set `resolution.enabled = false` (scale pinned to 1, so the measurement is
     not hidden by the controller), set `loop.stepping = false`, start the loop, and let it render the
     race views from the grid for `RESOLUTION.loadingBenchFrames` (90) frames, physics not stepping.
     If the timer GPU ms median > `loadingDropFactor` (1.5) × target (target = `targetShare` ×
     interval), or (no timer) > 10% of frames were missed: drop one preset (`noteLoadingDrop`; never
     below Low), apply it (`setPreset`, new rig, `world.setQuality`) and precompile again. Send a
     `loading-benchmark` telemetry sample either way.
  5. Restore `resolution.enabled = true`, call `resolution.resetStats()`, `frameStats.resetWindow()` and
     `frameStats.resetTotal()`.
  6. `start()`: `loop.stepping = true` (starting the loop if it is not running) and start the status
     timer (`setInterval(() => this.sendRaceStatus(), RACE_STATUS_INTERVAL_MS)`). `dispose()` clears
     the timer when it is set.
- `SplitWaysStage` awaits `prepare()` before `setStatus('running')`. Inputs arriving earlier are
  harmless because the race holds cars during the countdown.
- `layout()` calls `renderer.setLayout(rects)`: the driver rects, plus the overview cell when there are
  3 players, or one full rect on the podium. It keeps HUD placement and audio pan.
- `render()`/`renderRace()`: `renderer.beginFrame(now, loop.lastDeltaMs)`, then per view
  `shadows.beforeView(...)` and `renderer.renderView(i, scene, camera, speed)`, then
  `renderer.endFrame(this.clock, this.loop.lastCpuMs)`.
- **Race window** (in `render()`): on the first frame with `race.phase === 'racing'` (GO), call
  `frameStats.resetWindow()` and `resolution.resetStats()`. On the first frame with
  `race.phase === 'finished'` (before the podium and its compile hitch), take `frameStats.snapshot()`,
  send it as a `race` telemetry sample, and call
  `recordRaceOutcome(players.length, { atFloorShare, missedShare })` from the resolution controller.
  Skip the race sample and the outcome when a fly-through benchmark ran during this race (it reset the
  window) and in soak mode (soak windows use `resetWindow()`; the soak reports `soak-total` from
  `snapshotTotal()` instead).
- Podium: one view. Its programs compile when it appears; this is accepted because the race is over
  (record it in DECISIONS via P6).
- `onKey`: add `KeyB` (start benchmark auto). `KeyR` toggles `resolution.enabled` without calling
  `layout()`.
- `loop.ts`:
  - Expose `lastDeltaMs` (raw, unclamped rAF delta) and `lastCpuMs` (time spent inside the rAF
    callback: steps + render).
  - Add `stepping = true`. When false, `frame()` skips physics steps and does not accumulate time (so
    no catch-up burst when stepping resumes), but still renders. The loading benchmark and the
    fly-through use this.

**P3.7 Profiling overlay** (`debugOverlay.ts`).
- `DebugStats` becomes §3.13. Lines (frame and cpu percentiles are since GO, from the window):
  ```
  fps 60  frame p50 16.7 p99 17.1 ms  missed 0  cpu 4.2 ms  physics 0.41 ms/step
  gpu 9.8 ms (timer)            | or: gpu n/a (no timer) cpu frame 6.3 ms
  preset LOW (auto, drops 0)  scale 0.85 (auto, R toggles)  internal 816x459 x4 -> out 960x540  dpr 2.00  sharpen on
  draws 612  tris 1.9M  programs 48 (late 0)  viewports 4  refresh 60 Hz
  B benchmark  P autopilot  N next checkpoint  R resolution
  ```
- Keep the per-driver table.
- `pixelRatio` is removed (always 1).

**P3.8 Benchmark and soak** (`SW/debug/benchmark.ts`, `benchFlags.ts`).
- `readBenchFlags(search)` returns `{ bench: 'auto' | 'matrix' | 'soak' | null, bots: boolean }` from
  `?bench=` and `?bots=1`.
- **Fly-through** (`auto` and `matrix`):
  - Pause physics (`loop.stepping = false`).
  - For each run, `setLayout(viewportLayout(n, ...))`. If the preset differs, apply it and run
    precompile + warm-up.
  - N cameras: camera k starts at `startLine.distance + k * length / n` and moves along the track at
    `BENCH.cameraSpeed` (45 m/s). Position `sampleAt(d)` + `BENCH.cameraHeight` (2.3 m). Look at
    `sampleAt(d + BENCH.lookAhead (25 m))` + 0.9 m. FOV 62, near 0.1, far `preset.cameraFar`.
  - `BENCH.warmupSeconds` (3) of warm-up, then `frameStats.resetWindow()` and measure for
    `BENCH.measureSeconds` (20); the run's sample is `frameStats.snapshot()`.
  - `auto` runs `[1 high, 2 medium, 4 low]`. `matrix` runs all 9 combinations.
  - When done, restore the race layout and preset, set `loop.stepping = true`, show a results table in
    a `.sw-bench` `<pre>` (until any key), send the samples with `hooks.telemetry(samples)` (kind
    `flythrough`, scenario `fly-{n}-{preset}`; the client splits them into POSTs of at most
    `TELEMETRY_MAX_SAMPLES`, so `matrix` makes two), and log
    `console.info('[splitways-bench]', JSON.stringify(samples))`.
  - URL `?bench=auto|matrix` starts it automatically once `prepare()` finishes. Debug key B starts
    `auto`.
- **Soak** (`?bench=soak`):
  - Normal race with autopilot on and `laps = 99` (P3.6).
  - At GO also call `frameStats.resetTotal()`. Every `BENCH.soakWindowSeconds` (60), close a window into
    a `soak` sample (`snapshot()`, then `resetWindow()`). POST batched samples every
    `BENCH.soakPostEveryMinutes` (5).
  - After `BENCH.soakMinutes` (30), show a "SOAK DONE" summary over the whole run from
    `snapshotTotal()` (p99, missed, preset, drops) and send it as a final sample (scenario
    `soak-total`). Keep running until Esc.
  - Unsent samples go by `navigator.sendBeacon` on `pagehide`.
- **Bots** (`TvApp.tsx`): with `?bots=1`, `KeyK` first adds the two keyboard players, then
  `{ id: 'botplayer03', name: 'Bot 3' }` and `{ id: 'botplayer04', name: 'Bot 4' }` through
  `hub.addLocalPlayer`. Ids must match `/^[a-z0-9]{8,24}$/`. Bots have no key set: keyboard set index
  ≥ 2 resolves to `NEUTRAL_INPUT`. Show a bot hint in the lobby key bar only when the flag is on.

**P3.9 Telemetry: client, route, DB** (contract §3.14).
- **`shared/src/api.ts`:** append exactly the schema of §3.14, and add `MAX_PLAYERS` to the existing
  `./protocol` import line.
- **`client/src/net/telemetry.ts`** (Node-safe at import time; no DOM access outside functions):
  - `createTelemetryClient(hub)` returns
    `{ sendSamples(samples): void; flushBeacon(): void }`.
  - `sendSamples` splits the batch into chunks of at most `TELEMETRY_MAX_SAMPLES` (8) and posts each
    chunk as its own request.
  - Session: a random `[a-z0-9]{16}` created once per page load (module-level).
  - Device info once:
    - user agent;
    - GPU: `WEBGL_debug_renderer_info` unmasked renderer if available, else `gl.getParameter(gl.RENDERER)`,
      from a throwaway WebGL2 context, or pass the renderer's;
    - `navigator.hardwareConcurrency`;
    - `navigator.deviceMemory` (Chrome only, may be undefined, so null);
    - `screen.width` / `screen.height` × `devicePixelRatio` (device px; fractional at non-integer DPR
      until sanitised);
    - `devicePixelRatio`;
    - `refreshHz` (the measured value);
    - `timerQuery`.
  - Credentials come from `hub.roomCredentials()` **at send time** (the room can change after a
    404/403 recovery). If they are null, keep the batch and retry on the next send.
  - Send with `api.postTelemetry` (fetch, `keepalive: true`). Use `api.beaconTelemetry` (string body,
    i.e. text/plain) only on `pagehide`.
  - **Sanitiser** (exported pure functions `sanitiseSample(raw)` and `sanitiseDevice(raw)`, applied to
    everything before sending): `Math.round` every field the schema declares `.int()` (`durationMs`,
    `frames`, `missedFrames`, `screenWidth`, `screenHeight`, the internal/output sizes, `presetDrops`,
    `cores`, `viewports`); then clamp every number to its schema range; then turn NaN or Infinity into
    null for nullable fields and 0 otherwise. zod rejects fractional ints, NaN and Infinity, and one bad
    sample fails the whole request.
  - `build: import.meta.env.VITE_BUILD_ID ?? null`.
  - Unit test `client/src/net/telemetry.test.ts`: a sample built from a `FrameWindow` with fractional
    `durationMs` (for example 3 × 16.6667) and a device with DPR 1.5 and `screen.width` 1707 passes
    `postTelemetryRequestSchema.parse` after sanitising; NaN and Infinity become null/0; a 9-sample
    batch splits into chunks of 8 and 1 (test the pure chunking helper).
- **Build id.** `client/vite.config.ts` computes the id once and passes
  `define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) }`, where `buildId` is
  `process.env.VERCEL_GIT_COMMIT_SHA` (Vercel builds) or `git rev-parse --short=12 HEAD` (local
  `pnpm build`, `pnpm start`, `pnpm dev`; `execSync` in try/catch), sliced to 12 characters, else
  `'local'`. Vite's types reference Node's, so `node:child_process` typechecks in the config; verify
  it. `client/src/vite-env.d.ts` declares `interface ImportMetaEnv { readonly VITE_BUILD_ID?: string }`
  so the read is typed (not `any`). Vitest uses the root `vitest.config.ts`, where the value is
  undefined, so the client sends null there.
- **`GameHooks`** gets `telemetry(samples: TelemetrySample[]): void`. `SplitWaysStage` wires it to the
  client.
- **`client/src/net/api.ts`:** add `postTelemetry(body)`, which is
  `request(okSchema, '/api/telemetry', { method: 'POST', body: JSON.stringify(body), keepalive: true })`,
  and `beaconTelemetry(body): boolean`.
- **Server:**
  - `http.ts`: `readJsonBody(req, maxBytes = MAX_BODY_BYTES)`.
  - `schema.ts`: append the table and the two indexes (§3.14).
  - `store.ts`: `TelemetryStatus`, the constants and `postTelemetry` (SQL in §3.14, verified in
    PGlite by the mapper).
  - `router.ts`: case `'POST /api/telemetry'` parses with
    `readJsonBody(req, TELEMETRY_MAX_BODY_BYTES)`; `'rate-limited'` maps to 429; then
    `assertRoomOk`; then `200 {ok: true}`. There is **no GET**.
  - `scripts/build-vercel.mjs`: `API_ROUTES = ['room', 'signal', 'laps', 'telemetry']`. Without it
    production returns 404 while every local test passes.
- **Tests:**
  - `store.test.ts`: 'ok'; wrong key → 'forbidden'; unknown room → 'not-found'; room cap →
    'rate-limited' (inject small limits through an optional `createStore(sql, { telemetry: {...} })`
    options argument); a back-dated 91-day row is deleted on the next post.
  - `router.test.ts`:
    - valid → 200;
    - missing field / string `fpsAvg` / 9 samples (over `TELEMETRY_MAX_SAMPLES`) → 400;
    - wrong key → 403;
    - unknown room → 404;
    - a body just over 16 KiB (20 KB) → 413;
    - `GET /api/telemetry` → 404.
  - A guard test in `router.test.ts` reads `router.ts` and `scripts/build-vercel.mjs` as text and
    asserts every `case '<METHOD> /api/<name>'` name appears in `API_ROUTES`.
- **Report:** `server/src/db/telemetryReport.ts`, root script
  `"telemetry:report": "tsx server/src/db/telemetryReport.ts"`.
  - Loads `.env` like `migrate.ts`. Arguments: `--since 24h` (default) and `--session <id>`.
  - Prints one row per sample: time, session, build, kind, scenario, viewports, preset, fpsAvg, frame
    p99, cpu p99, gpu avg/p99, missed, scale avg/min, internal → output size, refresh Hz, gpu string.
  - Exits with a clear message if `DATABASE_URL` is missing. It only reads.

**Acceptance (P3).**
1. The M8 gate (§2.1) and `pnpm build:vercel` are green, and
   `.vercel/output/functions/api/telemetry.func` exists (as a symlink to `room.func`).
2. Unit tests pass: frameStats (percentiles on synthetic data, the 3600-frame whole-window case,
   refresh snapping), the resolution controller in both modes (scripted GPU ms sequences produce the
   expected step changes and hysteresis; 120 Hz budgets 16.7 ms), quality memory (drops, reset on
   player-count change, no drop counted on Low), the telemetry sanitiser and chunking, and the server
   tests.
3. Browser checks (SwiftShader, ports 4200/4643, under the browser lock in §2.1):
   - **(a) 4-viewport tiles.** 2 keyboard players + 2 bots (`?bots=1`), race loaded. Screenshot the
     TV. Four distinct views, 4 px dark seams, no view bleeding into another, and no black or garbage
     tile. Repeat with the debug key R toggled and once the overlay shows scale < 1.
   - **(b) Precompile.** The overlay shows `late 0` programs 10 s after GO, and still `late 0` 10 s
     after the overlay first shows scale < 1 (SwiftShader's fallback controller drops it on its own).
   - **(c) Benchmark.** `?bench=auto` completes all 3 runs. The page logs `[splitways-bench]` JSON
     with 3 samples. A `/api/telemetry` response is 200 (`page.on('response')`). Run `?bench=matrix`
     once: two `/api/telemetry` responses (8 + 1 samples), both 200.
   - **(d) Soak.** `?bench=soak&bots=1` with 4 players, shortened by temporarily setting
     `BENCH.soakMinutes` to 2 and the window to 20 s **in a local uncommitted edit**: summaries appear
     and telemetry posts succeed. Revert the edit.
   - **(e)** The 1-player view is full screen. A 3-player game shows the overview cell. The podium
     renders. A connected pad shows no countdown overlay until the TV loading overlay disappears.
   - **(f)** No `pageerror` and no WebGL errors in the console.
4. Draw calls at 4 viewports are not higher than before P3 plus 16 (the proxy draws). Compare the
   overlay before and after in the same scene.

**Pitfalls (P3).**
- Set viewport and scissor on the **render target** objects, never through
  `renderer.setViewport`/`setScissor`, for target passes.
- SunLight renders 2 cascades per `render()` call: 8 shadow passes at 4 viewports. That is why Low
  uses the focus rig.
- `installHaze` rewrites global `ShaderChunk`s. It must run before `precompile` (it already runs in the
  constructor).
- `compileAsync` does not build shadow depth or post materials, so the warm-up frames are required.
- Never derive the rendered size from the 16-px-rounded allocation, and never estimate the display
  refresh from in-game frame times.
- `EXT_disjoint_timer_query_webgl2` is probably absent on SwiftShader (the fallback path is tested
  there) and is unverified on the M1 (the owner run tells).
- zod rejects NaN, Infinity and fractional ints. Sanitise before sending.
- A new WebGL context per race: `forceContextLoss()` on dispose avoids the Chrome context limit.
- Do not import any `three/webgpu` or `three/tsl` module (that pulls the WebGPU build into the bundle).
  Port the RCAS math into GLSL.

### 2.6 P4: Controller (parallel)

**Purpose.** Replace the retired motion steering with Drag steer (default) and Buttons. Shared steering
processing on the TV: dead zone, curve, low-pass (the speed-sensitive lock and the deg/s rate limit
stay in `car.applySteering`, converted by P1). The new phone layout:
- GAS with feathering;
- BRAKE·R with a visible reverse (ring, label, R chip on phone and TV);
- the stuck hint, worded for the situation (and the same help for keyboard players on the TV);
- a "HOLD · RESET" long-press that shows when a reset is available;
- a HANDBRAKE press strip (direct press only; the slide-from-GAS gesture is M11);
- a small horn button.

**Branch:** `m8/p4-controller`, worktree `/home/user/m8-wt/p4`, ports 4300/4743.

**Files P4 owns.**
- Create: `SW/input/controls.ts`, `SW/input/controls.test.ts`, `SW/input/steerProcessor.ts`,
  `SW/input/steerProcessor.test.ts`, `SW/sim/reverse.test.ts`.
- Edit:
  - `SW/pad/SplitWaysController.tsx` (rewrite), `SW/pad/controller.css`, `SW/pad/steering.ts`,
    `SW/pad/steering.test.ts`, `SW/pad/inputSender.ts`.
  - `PAD/profile.ts`, `PAD/screens/JoinScreen.tsx`.
  - `shared/src/protocol.ts` (`raceSchema`, `REVERSE_ARM_MS`).
  - `SW/sim/car.ts` (P4 regions only), `SW/game.ts` (P4 regions only), `SW/config.ts` (P4 anchor
    only), `SW/hud/viewportHud.ts`, `SW/tv/stage.css` (P4 anchor only).

**Must not touch:** `SW/race/**` (P1 already added `stuckOnGasTime`, `resetReadyAt` and
`requestRespawn`), `SW/input/keyboard.ts`, `SW/debug/**`, `SW/render/**`, `SW/scene/**`, `SW/track/**`,
`shared/src/api.ts`, `server/**`, `STEERING`/`INPUT` in `config.ts`, `applySteering()` in `car.ts`,
and the P2/P3 regions.

**Tasks.**

**P4.1 Pure control maths** (`SW/input/controls.ts`, dependency-free: **no imports from three, sim,
render or config**, so the pad chunk stays three-free). Contract §3.15.
- `dragSteer(dxPx, viewportHeightPx, travelShare = DRAG.fullLockTravel)` returns
  `clamp(dx / (travelShare × h), -1, 1)`. It is linear and raw (unshaped).
- `shapeSteer(x, deadZone, gamma)`: 0 inside the dead zone, then
  `sign(x) × ((|x| - dz) / (1 - dz))^gamma`. Continuous, monotonic, ±1 at the ends.
- `featherThrottle(dyPx, pedalHeightPx, travelShare = DRAG.featherTravel)` returns
  `1 - clamp(dy / (travelShare × pedalHeight), 0, 1)`, quantised to 0.05, with values < 0.05 snapped
  to 0.
- Constants: `DRAG = { zoneShare: 0.45, fullLockTravel: 0.25, featherTravel: 0.3, edgeInsetPx: 24 }`.
  Decision: the **pad-only** constants live in `controls.ts`, and the TV processing constants in
  `config.ts` `STEER_INPUT` (`config.ts` has no imports, but keeping pad layout numbers next to the pad
  maths is clearer).
- `SW/pad/steering.ts`: keep `rampSteer`. Set `BUTTON_RAMP_S = 0.2` (spec 150-250 ms) and keep
  `BUTTON_RETURN_S = 0.1` (spec 80-120 ms). Update `steering.test.ts` for 0.2.

**P4.2 TV steering processor** (`SW/input/steerProcessor.ts`).
- `class SteerProcessor { value = 0; process(raw: number, dt: number): number; reset(): void }`.
- Shape: `shapeSteer(raw, STEER_INPUT.deadZone, STEER_INPUT.gamma)`.
- Low-pass: `alpha = 1 - exp(-dt / STEER_INPUT.lowPassSeconds)`.
- `config.ts` (P4 anchor):
  ```ts
  export const STEER_INPUT = {
    /** Shared steering processing on the TV for every input mode (pad drag, pad buttons, keyboard). */
    deadZone: 0.05, gamma: 1.5, lowPassSeconds: 0.04,
  } as const;
  export const REVERSE = {
    /** Hold brake (no gas) at a standstill this long to engage reverse; the pad ring fills meanwhile. */
    armSeconds: 0.35, standstillSpeed: 0.5, gasThreshold: 0.05, brakeThreshold: 0.5,
  } as const;
  ```
  - Delete `BRAKES.reverseBelowSpeed`; `REVERSE` replaces it.
  - `STEERING` (deg/s rates, P1.8) and `INPUT.staleAfterMs` (600 ms) stay unchanged. The shorter input
    failsafe belongs to M11's controller v2 with 60 Hz packets; with today's 100 ms heartbeat, 350 ms
    would cut gas and centre the wheel on ordinary phone wifi jitter.
- `game.ts` (P4 regions):
  - `Driver.steerFilter: SteerProcessor`.
  - In `step()`, right after `mergeInputs(...)`:
    `driver.car.input.steer = driver.steerFilter.process(driver.car.input.steer, this.sim.dt);`
    (before `race.holdInputs()`, so holds still override).
  - The autopilot path skips the processor (it `continue`s earlier).
  - Reset the filter when the racer's respawn is `'in'` with `respawnTimer < 0.05`.
- Keyboard ±1 goes through the same processor. Gamma does nothing on ±1, but the low-pass and the car's
  rate limit smooth it.

**P4.3 Explicit reverse** (`car.ts` P4 regions).
- Fields `reverseArm = 0` (s) and `inReverse = false`, plus
  `get reverseState(): 'off' | 'arming' | 'on'` (placed directly before the doc comment of
  `get speedKph()`, §2.2).
- `applyDrive(forwardSpeed, dt)`: change the call in `prePhysics()` from
  `this.applyDrive(forwardSpeed)` to `this.applyDrive(forwardSpeed, dt)`.
- Per step in `applyDrive`:
  - **When `inReverse`:** run the reverse engine (existing falloff) while `brake > 0.05` and
    `throttle < REVERSE.gasThreshold`. Leave reverse when `throttle >= gasThreshold` or `brake <= 0.05`.
  - **Otherwise,** if `brake > REVERSE.brakeThreshold`, `throttle < gasThreshold` and
    `forwardSpeed < REVERSE.standstillSpeed`: `reverseArm += dt`, apply normal brakes, and set
    `inReverse` once `reverseArm >= REVERSE.armSeconds`.
  - **Else** `reverseArm = 0`.
- Replace the strict `input.throttle === 0` test with `gasThreshold`.
- `applyDrive` keeps returning "reversing" (= `inReverse` this step) for `applyGrip`.
- `placeAt` resets both fields.
- `SW/sim/reverse.test.ts` (flat world):
  - Brake held at a standstill gives `'arming'` for the first 0.3 s, `'on'` after 0.36 s, and
    negative speed after 1.5 s.
  - Releasing brake gives `'off'`.
  - Gas 0.04 (feathering residue) does not block arming.
  - `car.test.ts` 'reverses when holding brake at a standstill' (3 s, -12 < v < -4) still passes.

**P4.4 Protocol and status push.**
- `shared/src/protocol.ts`:
  - `export const REVERSE_ARM_MS = 350;`.
  - `raceSchema` adds `reverse: z.enum(['off', 'arming', 'on'])`,
    `hint: z.enum(['reverse', 'release-gas']).nullable()` and `resetReady: z.boolean()`.
  - Document on `inputSchema`: steer is raw and linear (the TV applies dead zone, curve, low-pass, and
    the car applies lock and rate limit); throttle is analog in 0.05 steps.
  - The `REVERSE_ARM_MS` value must equal `REVERSE.armSeconds × 1000`; assert this in
    `reverse.test.ts`.
- **Hint rule** (one private method on the game, used for both the pad message and the TV HUD):
  `null` unless `racer.stuckOnGasTime >= RESPAWN.stuckHintSeconds && car.reverseState === 'off'`;
  then `'release-gas'` when `car.input.brake > REVERSE.brakeThreshold` (the player already holds brake
  but gas blocks arming, since `mergeInputs` takes gas and brake independently), else `'reverse'`.
- **Hint text** (TV HUD and pad banner):

  | Hint | Phone player (pad banner and TV HUD) | Keyboard set 0 (TV HUD) | Keyboard set 1 (TV HUD) |
  |---|---|---|---|
  | `reverse` | Hold BRAKE to reverse | Hold S to reverse | Hold ↓ to reverse |
  | `release-gas` | Let go of GAS · hold BRAKE to reverse | Let go of W · hold S to reverse | Let go of ↑ · hold ↓ to reverse |

  A driver uses the keyboard column when `driver.player.local` is true (by `keyboardSet`); everyone
  else uses the phone column.
- **Reset availability:** `resetReady = race.phase === 'racing' && racer.finishedMs === null &&
  racer.respawn === 'none' && race.clock >= racer.resetReadyAt` (read-only use of P1's `Racer` fields).
- `game.ts`:
  - `sendRaceStatusTo` adds `reverse: car.reverseState`, `hint` (the rule above) and `resetReady`.
    Import `REVERSE` and `RESPAWN` with a **separate** import line after the `KeyboardDriver` import;
    do not edit P3's `'./config'` line.
  - New private `pushStatusOnChange()`, called right after `this.race.update(...)`: per driver,
    compare `reverseState`, the hint and `resetReady` with the last sent values (`sentReverse`,
    `sentHint`, `sentResetReady`). On change, call `sendRaceStatusTo(i)`, throttled to at most one
    push per driver per 50 ms (`statusPushedAt`).
- `viewportHud.ts`:
  - `setGear(reverse: boolean)` shows an "R" chip next to the speed readout.
  - `setHint(text: string)` is a separate element in the lower middle, styled lower-priority than the
    WRONG WAY/FINISHED banner and hidden when empty.
  - `paintHud` calls `hud.setGear(car.reverseState === 'on')` and `hud.setHint(<text from the table>)`.
- `stage.css`: `.sw-hud-gear` (a white rounded chip with a bold R) and `.sw-hud-hint`, inserted after
  `.sw-hud-tag`.

**P4.5 Pad: profile and picker.**
- `PAD/profile.ts`: `STEERING_MODES = ['drag', 'buttons'] as const`, default `'drag'`, migration
  `mode: raw.mode === 'buttons' ? 'buttons' : 'drag'`, with the comment "any other stored value
  becomes drag". Do not name the retired mode anywhere (the gate greps for it). If you add a test, use
  an unknown stored value such as `'wheel'`.
- `JoinScreen` `ModePicker` table: `drag` → "Drag steer" / "Slide your left thumb" (icon: a thumb arc
  with arrows); `buttons` as before.

**P4.6 Pad: controller rewrite** (`SplitWaysController.tsx`, `controller.css`).
- **Layout,** landscape; percentages of the controller box:
  - Top strip, height 14%: left, the settings gear (existing); centre, `RaceHud`; right, from left to
    right, the HORN button, the R chip and the RESET button labelled **"HOLD · RESET"**.
  - Steer zone: x 0-45%, y 14-100%, starting at `max(env(safe-area-inset-left), 24px)` from the left
    edge (iOS back-swipe guard). In Buttons mode the zone holds the two existing arrows.
  - GAS: right-aligned, width 24%, height 62%, bottom-aligned.
  - BRAKE·R: directly left of GAS, width 18%, height 46%, bottom-aligned.
  - HANDBRAKE strip: directly above GAS, the same width, height 16%.
- **Pointer model.** Sticky roles: `Map<pointerId, Role>`, assigned at `pointerdown`.
  - **Hit-test geometrically**: at `pointerdown`, compare the point with the zone elements'
    `getBoundingClientRect()` rectangles (steer zone, arrows, GAS, BRAKE·R, HANDBRAKE, HORN, RESET).
    Never use `document.elementFromPoint` (today's `zoneAt`): overlays would swallow touches.
  - All decorative overlays have `pointer-events: none`: the ghost wheel, the idle label, the hint
    banner, the arming ring, the fill animations and the R chip.
  - Today's controller re-resolves zones on every move and drops pointers that leave a zone. Do not
    keep that.
  - Roles: `'steer' | 'left' | 'right' | 'gas' | 'brake' | 'handbrake' | 'horn' | 'reset' | 'none'`.
  - `setPointerCapture` on the root `<main>`. Keep `touch-action: none`, `user-select: none`,
    `-webkit-touch-callout: none`, and add `overscroll-behavior: none`.
  - Release on `pointerup`, `pointercancel` and `lostpointercapture`. Clear everything on
    `visibilitychange` (keep the existing safety).
- **Drag steer.**
  - The first pointer that lands in the steer zone gets `'steer'` and records `originX` and
    `travel = innerHeight` at pointerdown. Further pointers in the zone get `'none'`.
  - `steer = dragSteer(x - originX, travel)`, horizontal only. On release, steer = 0 (the TV
    low-pass smooths the return).
  - Ghost wheel: an absolutely positioned SVG (reuse the old wheel artwork from git history,
    `a2933a9:client/src/games/splitways/pad/SplitWaysController.tsx` `Wheel`) centred at the landing
    point. Rotated `shapeSteer(steer, 0.05, 1.5) × 120°` (the `STEER_INPUT` values, repeated for
    display only), written in the rAF tick through a ref, with no React re-render. Hidden when not
    steering. An idle label "Drag to steer" shows in the zone.
- **Buttons.** The `left`/`right` roles feed `rampSteer` in the tick, as today.
- **GAS.**
  - Records `originY`. `throttle = featherThrottle(y - originY, gasHeight)`.
  - The role stays gas even when the finger slides below or beside the pedal.
  - If the pointer moves into the BRAKE·R rect it becomes `'brake'`, and back into GAS becomes
    `'gas'` (with a new `originY`). This is the only role change after `pointerdown`.
  - A light fill shows the throttle level (CSS variable `--level`).
- **HANDBRAKE.** Direct press: a pointer that lands on the strip gets `'handbrake'` and sets
  `handbrake = true` while held. Gas from another finger is unaffected. A GAS pointer that slides up
  onto the strip stays gas (the slide gesture and throttle latch are M11).
- **BRAKE·R.**
  - `brake = 1`. Label "BRAKE · R".
  - When the TV's `race.reverse === 'arming'`: a ring (SVG circle `stroke-dashoffset` animated over
    `REVERSE_ARM_MS × 0.85` ms) fills on the pedal.
  - When `'on'`: the label reads "REVERSE", the pedal turns white-accented, the top-strip R chip lights
    up, and the pad vibrates 12 ms on the transition (Android only; guard `navigator.vibrate`).
  - When `'off'`: reset.
- **Hint.** `race.hint` shows a banner over the steer zone's bottom with the phone text from the P4.4
  table. It never blocks touches (`pointer-events: none`, geometric hit-testing).
- **RESET.**
  - Visible only while `race.phase === 'racing'`.
  - While `race.resetReady` is false the button is greyed out, a hold does nothing, and there is no
    vibration.
  - While true: hold for 600 ms with a fill animation, then `store.action('reset')` and an 8 ms
    vibration. Releasing earlier cancels.
  - The TV still enforces the guard and cooldown (P1); `resetReady` turns false within one status push
    after a reset, so a second hold inside the 3 s cooldown shows the greyed state.
- **HORN.** Hold = horn.
- **Countdown, finished and rotate overlays:** keep them.
- **InputSender** (`inputSender.ts`): a throttle change counts only when
  `|Δthrottle| >= 0.05`; compare quantised values. Steer threshold and rounding stay. Keep the 30 Hz
  maximum and the 100 ms heartbeat.

**Acceptance (P4).**
1. The M8 gate (§2.1) is green.
2. Unit tests pass:
   - `controls.test.ts`: `dragSteer` full lock at 25% height, sign and clamp; `shapeSteer` 0 inside
     the dead zone, continuous at its edge, monotonic, ±1; `featherThrottle` touch = 1, 30% travel = 0,
     0.05 quantisation.
   - `steerProcessor.test.ts`: a step input settles within 5τ; the dead zone holds; reset.
   - `reverse.test.ts`.
   - The updated `steering.test.ts`.
3. Browser checks (ports 4300/4743, under the browser lock, a pad context with touch, using CDP
   `Input.dispatchTouchEvent` like `E2E/m1.cjs`; TV debug overlay open). Timings below are nominal;
   poll for 3-5 times as long (§2.1):
   - **Drag.** touchStart at (20% w, 60% h) and move +25% of the height to the right: the overlay
     steer for the driver reaches > 0.95 (nominally within 0.3 s). Release: steer < 0.05. Screenshot
     the ghost wheel mid-drag.
   - **Buttons mode** (switch in settings): holding right ramps steer to 1 (nominally about 0.2 s).
   - **Gas feather.** Hold gas (throttle 1.00), slide down by 15% of the pedal height (about 0.5),
     then 30% (0.00).
   - **Handbrake:** a second finger on the HANDBRAKE strip while gas is held shows hb on the overlay
     and gas stays 1.00. **Gas to brake:** sliding left switches to brake.
   - **Reverse.** At a standstill, hold BRAKE·R: the pad label shows REVERSE and the R chip is lit;
     the TV HUD shows the R chip; speed goes negative.
   - **Hint.** Drive into a wall (or use the debug overlay N then steer into the barrier) and hold gas
     until the TV HUD lap timer has advanced 2.5 s: the TV shows "Hold BRAKE to reverse" and the pad
     shows the banner. Then also hold BRAKE: both switch to "Let go of GAS · hold BRAKE to reverse".
     In Buttons mode with the banner showing, a touch on the lower steer zone still ramps the steering.
   - **Reset.** Hold "HOLD · RESET" for 0.7 s: the TV fades and respawns the car. A second hold within
     3 s shows the greyed button and does nothing.
   - **Keyboard** (add a keyboard player with K in the lobby). WASD drives. At a standstill, holding S
     shows the TV R chip and negative speed.
     Held W against a wall shows "Hold S to reverse" on the TV. Q during racing respawns the car.
   - No `pageerror`.
4. The pad JS chunk does not contain three.js. In `client/dist/assets`, the chunk containing
   `SplitWaysController` does not contain the string `WebGLRenderer`.

**Pitfalls (P4).**
- **Double processing.** The pad sends raw linear steer. Only the TV shapes it. The ghost wheel uses
  `shapeSteer` purely for display.
- **Do not add a second rate limiter.** The car's road-wheel rate limit is the only one.
- Analog throttle and reverse: use thresholds, never `=== 0`.
- React hooks v7 rules: keep pointer and drag state in refs touched only in handlers and the rAF tick,
  never read `ref.current` during render.
- iPhone: no Vibration API (visual feedback only), no element fullscreen, and back-swipe from the left
  edge (hence the inset).
- `SW/input/controls.ts` must stay dependency-free, or three.js lands in the phone bundle.
- Never write the retired steering word in code, comments or tests (rule 11).

### 2.7 P5: Track 1 dressing and integration (needs P2 and P3)

**Purpose.**
- Make Kestrel Pines look like a temperate pine-forest club circuit on the new pipeline: chunked
  corridor meshes with CC0 materials, sawtooth striped kerbs, rubber line, grass and gravel run-off,
  armco and tyre walls, forest terrain, instanced pines, boards, marshal posts, grandstand, a far
  treeline, blob AO under cars, and lighting and fog retuned for the forest.
- Switch skids, dust and audio from `onSand` to surface IDs.
- Hit the draw-call and triangle budgets with the profiling tools.

**Branch:** `m8/p5-track1`, worktree `/home/user/m8-wt/p5`, ports 4400/4843. Start from
`m8/integration` after P2 and P3 are merged.

**Files P5 owns.**
- `SW/scene/world.ts`, `SW/scene/trackVisual.ts` (rewrite), `SW/scene/terrainVisual.ts` (rewrite),
  `SW/scene/scenery.ts`, `SW/scene/sceneryModels.ts`, `SW/scene/gantry.ts`, `SW/scene/skidMarks.ts`,
  `SW/scene/dust.ts`, `SW/scene/textures.ts` (if needed).
- New: `SW/scene/blobShadows.ts`, `SW/scene/forest.ts`.
- `SW/render/sky.ts` (constants only, if the sky changes).
- `SW/audio/raceAudio.ts` (surface parameter).
- `SW/game.ts` (P5 regions), `SW/config.ts` (P5 anchor).
- `assets/textures/**`, `assets/ASSETS.md`, `LICENCES.md` (append the CC0 section).

**Must not touch:** `SW/track/**` (consume P2's API; report bugs instead of editing), `SW/render/**`
except `sky.ts` constants, `SW/pad/**`, `SW/input/**`, `server/**`, `shared/**`.

**Tasks.**

**P5.1 Assets** (§4.2 lists exact names, URLs and sizes).
- Download into a fresh scratch folder (for example
  `/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad/m8-assets-dl/`).
  Never run anything from inside it.
- Process the ambientCG sets with Python PIL from a script kept **outside** the download folder, run
  with `python3 -I script.py <in> <out>`: **re-encode** `*_Color.jpg` and `*_NormalGL.jpg` as JPEG
  quality 90 (never copy them: the 1K originals are 1.4-2.5 MB each, and copied as-is they push
  `assets/` to about 16.6 MB, over the 14 MB budget; at q90 they are about 0.4-0.65 MB), and pack the
  ARM map (R = `*_AmbientOcclusion.jpg`, G = `*_Roughness.jpg`, B = 0; JPEG q90). Resize to 1024² if
  needed. Record the processing in `ASSETS.md`.
- Commit only the final 1k JPGs under `assets/textures/<kind>/` with Poly Haven-style names
  (`<base>_diff_1k.jpg`, `<base>_nor_gl_1k.jpg`, `<base>_arm_1k.jpg`), so `loadPbrSet` works unchanged.
- Delete `assets/textures/asphalt/asphalt_02_*` if nothing uses it after the switch.
- Update `assets/ASSETS.md` (one row per file set: source URL, author, licence CC0, what it is used
  for, and any processing). Append the CC0 section to `LICENCES.md`.

**P5.2 World and quality.**
- `WorldVisual.create(track, terrain, preset)` loads the asphalt, grass, gravel and forest-floor
  `PbrSet`s in parallel with `preset.anisotropy`. It builds the corridor, terrain, forest, gantry,
  scenery and treeline into one group.
- `setQuality(preset)` sets each pine mesh's `count`, using the instance buffers' pre-shuffled order,
  to `round(total × preset.vegetationDensity)`, and sets `castShadow = preset.pineShadows` on the
  pines. It never rebuilds geometry.
- Expose `stats` (chunk counts) for the overlay if useful.

**P5.3 Corridor visuals** (`trackVisual.ts` rewrite on `corridorChunks(track)`).
- One `Mesh` per band per chunk, `frustumCulled` with the chunk's bounding sphere. Merge bands that
  share a material per chunk. Materials:
  - **Asphalt:** `asphalt_track` `PbrSet`. Texture repeat via cloned textures, about 4 m tile. An
    `onBeforeCompile` "track mask" darkens albedo by about 18% and lowers roughness by about 0.12
    within ±1.1 m of the per-vertex `racingLine` attribute (smooth falloff, broken up by a
    world-space noise). Add a faint macro variation (low-frequency noise ±6% albedo).
    `customProgramCacheKey = () => 'sw-asphalt-mask-v1'`.
  - **Kerb:** P2's sawtooth geometry. Stripes from a 64×8 canvas texture, red `#c8102e` / white
    `#f2f2f2`, 1 m per colour, along v; roughness 0.6.
  - **Lines:** white, roughness 0.5, `polygonOffset`.
  - **Grass run-off:** `grass004` set, about 3 m tile.
  - **Gravel:** `gravel022` set, about 2 m tile.
  - **Apron:** the asphalt set with a lighter tint (0.85 grey multiplier) for paved run-off.
  - **Skirt:** forest-floor colour.
  - **Armco:** a W-beam look from a narrow canvas gradient, `metalness 0.8`, `roughness 0.35`. Posts
    as one `InstancedMesh` per chunk (or one for the whole track with per-chunk tiles; follow the
    culling rule below).
  - **Tyre stacks:** one `InstancedMesh` per chunk. The geometry is a low-poly stack of 3 tyres
    (`FacetBuilder`, ≤ 60 tris), dark rubber with alternating white and red paint on every other
    stack, done with instance colours.
- Start/finish: chequered strip and grid boxes (white lines) from `track.startLine` and `gridSpawns`.
- **Culling rule:** never create an `InstancedMesh` whose bounding sphere spans the whole track. Group
  instances per corridor chunk or per 200 m spatial tile, so main and shadow passes cull them.

**P5.4 Terrain and forest.**
- `terrainVisual.ts`:
  - Mesh from `terrain.field` in chunks of 64×64 cells (320 m), using shared-grid central-difference
    normals as today. Split every cell into the two triangles `heightAt` assumes (§3.7: along the
    diagonal from `(col, row + 1)` to `(col + 1, row)`), wound so the face normals point up, so props
    placed with `heightAt` neither float nor sink.
  - Material: a two-layer splat in `onBeforeCompile`. Grass (`grass004`) near the corridor, forest
    floor (`forest_leaves_04`) far away, blended by the `wildness` attribute with noise. That is
    6 texture fetches. `customProgramCacheKey = () => 'sw-terrain-splat-v1'`.
  - `receiveShadow` true, `castShadow` false.
- `forest.ts`:
  - Pine geometry: `FacetBuilder` (export it from `sceneryModels.ts`). A trunk plus 4 stacked cones,
    ≤ 120 triangles, vertex colours (dark green `#2b4a2a` to `#3e6a35`, trunk `#5a3d28`), 16 m tall
    at scale 1.
  - One `InstancedMesh` per 200 m tile from `placeTrackside(...)` pines. y = `terrain.heightAt`,
    random yaw, per-instance tint ±8% lightness through `instanceColor`. Shuffle the instance order
    within each tile so density thinning stays even.
- **Treeline ring:** one mesh around the terrain edge, a vertical jagged skirt 25-40 m tall and
  dark-green, 1 draw call, to hide the terrain edge.
- **Boards and marshal posts:**
  - Boards are instanced per kind with canvas-texture numbers (white board, black numerals).
  - Marshal posts use `blockGeometry` plus a small orange panel.
  - Grandstand on the **outside** (right) of the start straight, 6 m behind the wall (adapt
    `addGrandstand`). Banners on straights stay (fictional brands only).

**P5.5 Lighting, sky, fog.**
- Keep the CC0 HDRI `syferfontein_18d_clear_puresky_2k.hdr` and the `sky.ts` pipeline (decision D-8).
- `LIGHTING`:
  - `groundBounce` → forest floor, about `[0.10, 0.12, 0.07]`.
  - `fogDensity` → about 0.002, so the terrain edge fades. Tune by screenshot.
  - Update the comments: no sea, no dunes.
- `POST.tint`/`saturation`: slightly cooler and greener, tuned by eye. Keep exposure unless it looks
  wrong.

**P5.6 Blob AO** (`blobShadows.ts`).
- One `InstancedMesh` of soft radial-gradient quads (canvas texture), 1 per car, 4.4 × 2.2 m.
- Aligned to the car's yaw and lying on the road (y = average of the wheel contacts + 0.02).
- Opacity scaled by `groundedWheels / 4`. `depthWrite false`, `polygonOffset`, `transparent`, multiply
  look (black with alpha 0.55).
- `mesh.frustumCulled = false` (it is only one quad per car). three computes an `InstancedMesh`'s
  bounding sphere once, at the first culling test, and never updates it when instance matrices change
  (`Frustum.js:148-152`, `InstancedMesh.js:151-180`), so a culled blob mesh would vanish once the cars
  leave the grid.
- Added in the constructor; `update(cars, alpha)` in `render()`.

**P5.7 Surfaces in effects and audio.**
- `Driver.onSand` becomes `surface: SurfaceId` (from `car.dominantSurface`).
- `SkidMarks.update(car)`: per wheel, by `car.wheelSurface[i]`. Rubber colour on asphalt and kerb,
  dark-brown ruts on grass, grey-brown ruts on gravel.
- `Dust.emit(car, dt)`: dust on gravel (beige), clippings on grass (green-brown, fewer, small), smoke
  from slides on asphalt.
- `raceAudio.updateCar(index, throttle, horn, surface, draft)`: the existing sand noise becomes a
  surface noise scaled by `SURFACES[name].rumble` (rename `AUDIO.sand` to `AUDIO.surface`).
- Camera shake on kerbs: `driver.camera.addShake(0.05 × rumble)` while on kerb at > 10 m/s, at most
  every 0.2 s per driver (the `Driver.lastKerbShakeAt` field, §2.2).

**P5.8 Gantry** spans the local walls (`track.side(startIndex, ±1).wall + 1.6`) and keeps the name
text.

**P5.9 Profiling pass.** In the browser (SwiftShader, so counts matter, not ms), use the overlay to
check the budgets in §4.5 at 1 viewport High, 2 viewports Medium and 4 viewports Low (bots), at the
grid and mid-lap (debug N). Reduce chunk counts, merge materials or tighten shadow casters until they
hold. Then run `?bench=auto` once to make sure it completes on the dressed track.

**Acceptance (P5).**
1. The M8 gate (§2.1) is green. `pnpm start` (ports 4400/4843 via env) serves
   `/tracks/kestrel-pines/base.layout.json` (HTTP 200) and the textures.
2. Budgets in §4.5 hold (record the overlay numbers in the report).
3. Screenshots, from the TV, 1280×720 SwiftShader:
   - (a) the grid at 1 viewport;
   - (b) mid-lap at 1 viewport in a banked corner with kerbs;
   - (c) 2 viewports;
   - (d) 4 viewports (bots);
   - (e) the overview cell with 3 players;
   - (f) a gravel trap with dust;
   - (g) the podium.

   Check by eye: forest all around, no visible terrain edge, kerbs striped and following the curve,
   the rubber line visible, no z-fighting between run-off and terrain, no floating props, blob AO
   under cars, car shadows visible.
4. A 4-car autopilot race finishes, with no console errors.
5. `assets/` total size ≤ 14 MB (`du -sh assets`).

**Pitfalls (P5).**
- A new `onBeforeCompile` material needs a unique `customProgramCacheKey`, or materials with the same
  closure source share a program (`Material.js:544-546`).
- Instanced meshes with whole-track bounding spheres are never culled. Use per-tile groups.
- An `InstancedMesh` whose instances move (the blob AO) keeps its first bounding sphere: set
  `frustumCulled = false` or call `computeBoundingSphere()` after writing the matrices. Static
  per-tile instances (pines, tyre stacks, posts) are fine as they are.
- If run-off and terrain z-fight at long range (the terrain sits 0.05 m below the run-off near the
  walls), add `polygonOffset` to the corridor band materials; do not change P2's terrain numbers.
- Never write the retired words (rule 11), for example "tilted" in a scenery comment.
- Pines casting shadows into SunLight cascades multiply shadow cost. That is why Low turns them off.
- Do not change P2's corridor numbers to make visuals fit. Fix the visuals, or report the P2 bug.
- Use `track.lateralPoint` everywhere you place something relative to the road. Never use
  `position + right × lateral` with a flat y.

### 2.8 P6: Docs and licence log (last)

**Purpose.** Bring the docs in line with M8, and make sure the licence log and asset list are
complete and correct. P6 starts after the integration acceptance (§2.9) passes, so it can record its
results.

**Branch:** `m8/p6-docs`, worktree `/home/user/m8-wt/p6` (never the main checkout). No dev server.

**Files P6 owns:** `README.md`, `DECISIONS.md`, `ROADMAP.md`, `PROGRESS.md`, `LICENCES.md` (review and
fix), `assets/ASSETS.md` (review and fix). No code. P6 never edits the track data files.

**Tasks.**
1. **`README.md`:**
   - Track name and theme.
   - Remove Items/Classic, the motion steering mode, the iPhone motion access step, the M key, the I
     debug key and the speed-trick bullets (keep slipstream as drag reduction).
   - Controls: Drag steer, Buttons, GAS feathering, BRAKE·R reverse, the HANDBRAKE strip, "HOLD ·
     RESET", keyboard `Q`/`Enter` = reset, keyboard S/↓ held at a standstill = reverse.
   - Debug keys: \`, P, N, R, B.
   - Benchmark URLs (`?bench=auto|matrix|soak`, `?bots=1`).
   - Telemetry: what is collected, TV-only, no IP or names, `pnpm telemetry:report`.
   - `pnpm assets:track <track folder>` (checks a track folder's layout files; it converts and writes
     nothing).
   - `/api/telemetry` in the API list.
2. **`DECISIONS.md`.** It describes the current build, so rewrite the current-state sections, not just
   append. Historical milestone notes belong only in `PROGRESS.md`.
   - **Names:** Kestrel Pines = track (`kestrel-pines`). Remove "Corniche Run = track".
   - **Local dev:** phones use https because the Wake Lock API needs a secure context (no motion
     sensors any more).
   - **Pad:** Drag steer (default) and Buttons; TV-side processing (dead zone, curve, low-pass; lock
     and deg/s rate limit in the car); analog throttle in 0.05 steps; reverse arming (hold BRAKE·R at a
     standstill for 0.35 s, ring, R chip); the reset action with `resetReady`; the input failsafe stays
     600 ms in M8 (the 250 ms failsafe and the handbrake slide are M11). Remove the motion-steering and
     iOS motion-permission bullets.
   - **Track and race:** trackgen v1 (original layout file + overrides → stations, corridor chunks,
     per-triangle surfaces, terrain, placements, racing line), Kestrel Pines, per-station gates and
     safe-point respawn, `MIN_LAP_MS` 45 s (D-5), no pit lane (D-6). Remove the Corniche spline, "by the
     sea" and jersey-barrier text.
   - **Rendering / Look:** the M8 pipeline: atlas plus scratch copy (D-7), single post chain, DPR 1
     plus one always-on upscale + RCAS pass (sharpening off at 1:1), GPU-time resolution, presets and
     session drops, SunLight on High/Medium and the focus rig on Low, the fixed shadow proxy,
     precompile, the podium compile hitch accepted, refresh measured on an idle page, the HDRI kept
     (D-8). Remove sea, sand and dune text.
   - **Feel:** surface rumble (asphalt, kerb, grass, gravel) instead of sand rumble; remove the gyro
     silence bullet.
   - Replace "Items and speed tricks (M7)" with an M8 note: items, drift boost and pads removed;
     slipstream is drag-only (D-3); game modes removed (D-4); the action channel carries reset.
   - **Licences:** D-1 (owner, 2026-10-10: Track 1 uses an original layout owned by the project;
     nothing from Speed Dreams is used or shipped) and D-2 (track data packaging).
   - **Telemetry** and the "locked 60" pass definition (§5.6).
3. **`ROADMAP.md`** (23 lines today, no milestone list). Exact edit:
   - Insert directly after the intro line (`Out of scope for v1. ...`):
     ```
     ## Milestones

     - **M8:** Track 1 Kestrel Pines, the performance foundation (render path, presets, profiling,
       telemetry) and the minimum touch controller. Built; done once the owner's M1 run passes. See
       PROGRESS.md.
     - **M9:** Track 1 polish: visuals (impostor forests, baked light, KTX2 textures, grade), car
       feel and sound on Kestrel Pines, each pushed live when green, then the owner's playtest.
     - **M10:** Dropped for now (owner, 2026-10-10: one track only). More tracks come later through
       the generator.
     - **M11:** Feel: tyre model and assists ladder, controller v2 (60 Hz input, 250 ms failsafe,
       handbrake slide), HUD v2, engine audio v1.
     - **M12:** Cars and cameras: new car models with fictional brands, paint, chase-cam rewrite. Needs
       the car sourcing task (an owner/art task that started in M8) finished first.
     - **M13:** Premium TV and site UI.
     - **M14:** On hold until the owner says it is ready.
     - **M15 and after:** new tracks and car packs through the generator; the WebGPU gate.
     ```
     M14 gets that one line and nothing else: no description, plan, tiers or pricing (rule 4).
   - Under "Split Ways": replace the "More tracks (the track builder takes a list of spline control
     points ...)" bullet with "More tracks and cars (trackgen builds a track from a layout file plus a
     small override file, so a track is mostly content), unlockables."; replace the rubber band bullet
     with "Rubber band assist as an option (races are pure skill today)."; delete "Drift scoring, more
     items, battle mode.". Keep "AI opponents." and "Spectator mode, replays, ghost laps.".
4. **`PROGRESS.md`:** append an M8 entry (what landed, test counts, §2.9 integration results, known
   issues, the owner benchmark status). Add a line for the **car sourcing** owner/art task that starts
   in M8: a manual search for original-design models, a `LICENCES.md` row per candidate (CC0 or CC-BY
   with commercial use) before anything is used, and a real-silhouette check against real cars; it
   must finish before M12. Keep history.
5. **`LICENCES.md` and `assets/ASSETS.md`:** every file under `assets/` appears in `ASSETS.md` (the two
   Kestrel Pines files as original project data, licence as in §4.3); every third-party source appears
   in `LICENCES.md`; the Speed Dreams section records the reviewed data, the GPL/FAL conflict and
   D-1 (owner, 2026-10-10) with nothing from Speed Dreams shipped (§4.4); the Kestrel Pines files
   carry the licence and credits fields of §4.3, and no Speed Dreams credit or FAL notice is attached
   to anything shipped (Speed Dreams appears only in the `LICENCES.md` review record and the D-1 note
   in `DECISIONS.md`).
6. Run the §1.3 greps on `README.md` and on the current-state sections of `DECISIONS.md` and fix any
   stale mention. `PROGRESS.md` history may mention items, Corniche and motion steering as history.

**Acceptance (P6).** The M8 gate (§2.1; `format:check` covers the Markdown) and `pnpm build:vercel`
are green. The docs cross-check is done. The final report lists the open owner items (the M1 run in
§5.5, R-24 lap count, the car sourcing task).

### 2.9 Integration acceptance (orchestrator, after P4 and P5 are merged)

Run on `m8/integration` in `/home/user/m8-wt/int`, ports 4000/4443, under the browser lock (§2.1). No
package owns this; it checks the merged game end to end, which no single package can. Adapt
`E2E/m3full.cjs` (full race, results board, vote) and `E2E/m7show.cjs` (several pads, autopilot) into
`/tmp/claude-0/e2e-int/`. Fix nothing here: a failure goes back to the package that owns the code.

1. `sh /tmp/claude-0/m8-gate.sh` is green, and `pnpm build:vercel` is green with
   `.vercel/output/static/tracks/kestrel-pines/base.layout.json` and
   `.vercel/output/functions/api/telemetry.func` present.
2. **Mixed controllers.** A TV with 3 pads (pad A in Drag steer, pad B in Buttons, pad C starting in
   Drag and switched to Buttons in Settings mid-race) plus 1 keyboard player. Each pad drives its car
   briefly by touch (steer and gas show on the TV overlay), then autopilot (debug P) finishes a full
   race.
3. **Lap records.** `POST /api/laps` returns 200 (`page.on('response')`), `GET
   /api/laps?track=kestrel-pines` returns the posted entries, and `.sw-results-board` lists them.
4. **Reconnect.** Reload pad B mid-race: it rejoins as the same car (same slot and colour), its
   controller drives again, and the R chip and the stuck hint still update on it (hold BRAKE·R at a
   standstill; hold GAS against a wall).
5. **Vote.** On the results screen, the play-again vote returns everyone to the lobby.
6. **Perf smoke.** `?bench=auto` completes on the dressed track and its telemetry POST returns 200.
7. No `pageerror` on the TV or any pad during the whole run. Save screenshots of the race, the results
   board and a pad.

---

## 3. Contracts between packages

These are the binding interfaces. Signatures, names and units are exact. Doc comments may be
reworded. Packages built in parallel code against these so they fit at merge.

### 3.1 Surfaces and barriers (P2, `SW/track/surfaces.ts`)
```ts
export const SURFACE = { asphalt: 0, kerb: 1, grass: 2, gravel: 3 } as const;
export type SurfaceName = keyof typeof SURFACE;
export type SurfaceId = (typeof SURFACE)[SurfaceName];
/** Index = SurfaceId. */
export const SURFACE_NAMES: readonly SurfaceName[] = ['asphalt', 'kerb', 'grass', 'gravel'];

/** Visible barrier along the wall line; `none` still has an invisible collision wall.
 *  `fence` is a catch fence (Kestrel Pines: right side of the start straights); visuals treat it
 *  like `wall`. */
export const BARRIER = { none: 0, armco: 1, tyres: 2, wall: 3, fence: 4 } as const;
export type BarrierName = keyof typeof BARRIER;
export type BarrierId = (typeof BARRIER)[BarrierName];
```

### 3.2 Committed layout and overrides (P2, `SW/track/gen/layout.ts`; zod schemas mirror these)
```ts
/** One side of a segment, from the asphalt edge outwards. Widths in metres. */
export interface LayoutSideSpec {
  kerbWidth: number;          // 0 = no kerb
  kerbHeight: number;         // raise at the kerb's outer edge (m)
  runoffStart: number;        // run-off width at segment start (m), kerb (or asphalt) edge to wall
  runoffEnd: number;
  runoffSurface: SurfaceName; // asphalt = paved apron
  barrier: BarrierName;
}
export interface LayoutSegment {
  name: string;
  type: 'straight' | 'left' | 'right';
  length: number;             // straights (m); 0 for arcs
  radiusStart: number;        // arcs (m); 0 for straights
  radiusEnd: number;          // == radiusStart unless spiral
  arc: number;                // arcs: turned angle (rad, > 0); 0 for straights
  zEnd: number;               // elevation at segment end (m, absolute)
  tangentStart: number | null;// optional vertical tangent (rise/run)
  tangentEnd: number | null;
  bankStart: number;          // rad, + = right edge higher (a left-hander banked into the turn is +)
  bankEnd: number;
  roadWidth: number;          // full asphalt width (m)
  left: LayoutSideSpec;
  right: LayoutSideSpec;
}
export interface TrackLayout {
  format: 'splitways-layout@1';
  name: string;               // human-readable layout name; the game uses TrackOverrides.name
  licence: string;
  credits: string[];
  /** Provenance. An original layout has package 'original', empty file/readme/readmeLicence and a note
   *  (Kestrel Pines: "Original design, not derived from any existing track"). Third-party data would
   *  fill these, and needs its LICENCES.md row first (§4.4). The generator ignores this field. */
  source: { package: string; file: string; readme: string; readmeLicence: string; notes: string };
  startZ: number;             // elevation at the start of segments[0]
  segments: LayoutSegment[];  // driving order; start of segments[0] = start/finish line
}
export type SidePatch = Partial<LayoutSideSpec>;
export type SegmentPatch = Partial<Omit<LayoutSegment, 'name' | 'left' | 'right'>> & {
  left?: SidePatch;
  right?: SidePatch;
};
export interface TrackOverrides {
  format: 'splitways-overrides@1';
  id: TrackId;                // from @gamergang/shared
  name: string;
  laps: number;
  checkpointCount: number;
  licence: string;
  credits: string[];
  roadWidth?: number;
  kerbWidth?: number;         // applied where kerbWidth > 0
  runoffSurfaceRemap?: Partial<Record<SurfaceName, SurfaceName>>;
  runoffClamp?: { min: number; max: number };
  remove?: string[];
  insertAfter?: { after: string; segment: LayoutSegment }[];
  segments?: Record<string, SegmentPatch>;
  extraKerbs?: { segment: string; side: 'left' | 'right'; start: number; length: number; width?: number }[];
  closure: { straights: [string, string]; arc: string | null };
  startOffset?: number;       // m from the start of segments[0]; default 0
}
```

### 3.3 Generated stations (P2, `SW/track/gen/generate.ts`)
```ts
export interface StationSides {
  road: Float32Array;          // asphalt half width on this side (m, > 0)
  kerb: Float32Array;          // kerb width beyond the asphalt edge (m, >= 0)
  kerbHeight: Float32Array;
  runoff: Float32Array;        // run-off width beyond the kerb (m, >= 0)
  runoffSurface: Uint8Array;   // SurfaceId
  barrier: Uint8Array;         // BarrierId
}
export interface GeneratedTrack {
  id: TrackId;
  name: string;
  laps: number;
  checkpointCount: number;
  startDistance: number;       // arc length of the start line (m); 0 for Kestrel Pines
  length: number;              // horizontal lap length (m)
  spacing: number;             // length / count (~1.000 m)
  count: number;               // stations; station `count` is station 0
  x: Float32Array; y: Float32Array; z: Float32Array;
  heading: Float32Array;       // yaw (rad), tangent = (sin h, 0, cos h)
  curvature: Float32Array;     // plan curvature (1/m), + = bends left
  bank: Float32Array;          // rad, + = right edge higher
  left: StationSides;
  right: StationSides;
  racingLine: Float32Array;    // lateral offset of the racing line (m, + = right)
  speed: Float32Array;         // speed profile on the racing line (m/s)
  licence: string;
  credits: readonly string[];
}
export function generateTrack(base: TrackLayout, overrides: TrackOverrides): GeneratedTrack;
```

### 3.4 Track API (P2, `SW/track/track.ts`). Legacy members keep their meaning.
```ts
export interface StationSide {
  road: number; kerb: number; kerbHeight: number; runoff: number;
  runoffSurface: SurfaceId; barrier: BarrierId;
  wall: number;                // = road + kerb + runoff: lateral of the wall face (m, > 0)
}
export interface TrackSample {
  position: Vector3;           // centre line; y = road height at the centre
  tangent: Vector3;            // horizontal unit
  right: Vector3;              // horizontal unit, driver's right
  distance: number;            // i * spacing
  curvature: number;           // 1/m, + = bends left
  bank: number;                // rad, + = right edge higher
  grade: number;               // dy/ds
  sideL: StationSide;
  sideR: StationSide;
  racingLine: number;          // m, + = right
  targetSpeed: number;         // m/s
}
export interface Checkpoint {
  index: number; distance: number; sample: TrackSample;
  halfLength: number;          // 3
  halfWidthLeft: number;       // sideL.wall + 1.5
  halfWidthRight: number;      // sideR.wall + 1.5
  halfHeight: number;          // 6
}
export interface Projection { index: number; distance: number; lateral: number } // unchanged
export class Track {
  constructor(readonly definition: GeneratedTrack);
  readonly samples: TrackSample[];
  readonly length: number;
  readonly spacing: number;
  readonly checkpoints: Checkpoint[];
  readonly halfRoad: number;       // nominal: median asphalt half width (legacy callers)
  readonly halfDrivable: number;   // nominal: median of min(sideL.wall, sideR.wall)
  readonly bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  get startLine(): Checkpoint;
  wrap(distance: number): number;
  ahead(from: number, to: number): number;
  sample(index: number): TrackSample;                 // wraps
  sampleAt(distance: number): TrackSample;            // nearest station
  project(position: Vector3, hint: number, out: Projection, window?: number): Projection; // XZ, unchanged
  gridSpawns(count: number): Spawn[];
  spawnAt(distance: number, lateral: number): Spawn;  // y on the banked cross-section + 0.5
  minimumRadius(): number;
  side(index: number, side: -1 | 1): StationSide;     // -1 left, +1 right
  /** Height of the corridor surface at a plan lateral offset (+ right), relative to the centre point. */
  crossSectionY(index: number, lateral: number): number;
  /** Centre + right * lateral, at crossSectionY + lift. Use for every placement relative to the road. */
  lateralPoint(index: number, lateral: number, out: Vector3, lift?: number): Vector3;
  surfaceAt(index: number, lateral: number): SurfaceId;
  /** Problems found (empty = valid): inside wall >= 0.9 / |curvature|, wall <= road, NaNs. */
  validateCorridor(): string[];
}
```
**Cross-section** (exact). Let `s = sign(l)`, `a = |l|`, side profile `P = side(i, s)`, and
`t = tan(bank_i)`.
- `a <= P.road`: `y = l * t` (asphalt plane).
- `a <= P.road + P.kerb`: `y = l * t + P.kerbHeight * (a - P.road) / P.kerb` (kerb rises linearly).
- Beyond (run-off, and the same formula past the wall, for terrain reference):
  - `edge = P.road + P.kerb` and `yEdge = s * edge * t + P.kerbHeight`;
  - `slope = clamp(s * t, -TRACKGEN.runoffMaxSlope, TRACKGEN.runoffMaxSlope) - TRACKGEN.runoffFall`;
  - `y = yEdge + (a - edge) * slope`.

**`surfaceAt`:** asphalt within `road`; kerb within the kerb band; otherwise `runoffSurface`
(including beyond the wall).

### 3.5 Track seam (P1 creates, P2 finalises, `SW/track/tracks.ts`)
```ts
export const TRACK_1 = {
  id: 'kestrel-pines',
  name: 'Kestrel Pines',
  url: '/tracks/kestrel-pines/',     // base.layout.json, overrides.json (added by P2)
} as const;                          // id satisfies TrackId
/** Node-safe: validates both JSON values with zod and returns the Track. Used by tests with JSON imports. */
export function buildTrack(base: unknown, overrides: unknown): Track;   // P2
/** Browser: fetches both JSON files under TRACK_1.url, then buildTrack. P2's version may be `async`
 *  (it awaits the fetches); P1's interim version is a plain function returning Promise.resolve(...). */
export function loadTrack1(): Promise<Track>;
```
Tests import the data with relative JSON imports, for example from `SW/track/gen/generate.test.ts`:
`import base from '../../../../../../assets/tracks/kestrel-pines/base.layout.json';`.
`resolveJsonModule` is on. **Game code must never statically import the track JSON.** It is track
content with its own licence fields and must stay a separate file fetched at runtime (decision D-2).

### 3.6 Corridor geometry, physics, walls (P2; P5 consumes)
```ts
export type BandName = 'asphalt' | 'kerb' | 'grass' | 'gravel' | 'apron' | 'lines' | 'skirt' | 'armco';
export interface BandMesh {
  positions: Float32Array;     // xyz
  normals: Float32Array;       // xyz
  uvs: Float32Array;           // metres: u = lateral (kerb: 0..1 across), v = distance along the lap
  indices: Uint32Array;        // CCW from above (upward-facing bands)
  racingLine?: Float32Array;   // asphalt only: racing-line lateral (m) per vertex
}
export interface PropInstance { x: number; y: number; z: number; yaw: number }
export interface CorridorChunk {
  index: number;
  from: number;                // first station
  to: number;                  // one past the last station (shares its ring with the next chunk)
  centre: [number, number, number];
  radius: number;              // bounding sphere
  bands: Partial<Record<BandName, BandMesh>>;
  tyreStacks: PropInstance[];  // one per metre of tyre wall, 2 rows
  armcoPosts: PropInstance[];  // every 4 m of armco
}
export function corridorChunks(track: Track, chunkLength?: number): CorridorChunk[]; // default TRACKGEN.chunkLength
export interface PhysicsSurfaceMesh {
  positions: Float32Array; indices: Uint32Array;
  surfaceIds: Uint8Array;      // one per triangle
}
export function corridorPhysicsMesh(track: Track): PhysicsSurfaceMesh;
export function wallHulls(track: Track): Float32Array[]; // each: 8 points (24 floats)
// SW/sim/world.ts
//   registerSurface(collider: Collider, surface: SurfaceId): void
//   surfaceOf(collider: Collider | null): SurfaceId      // unknown/null -> SURFACE.asphalt
// SW/sim/car.ts
//   constructor(rapier, world, spawn, surfaceOf?: (c: Collider | null) => SurfaceId)
//   readonly wheelSurface: Uint8Array                    // per wheel, last ground surface
//   get dominantSurface(): SurfaceId
```

### 3.7 Terrain (P2, `SW/track/terrain.ts`)
```ts
export interface TerrainField {
  minX: number; minZ: number; spacing: number;
  cols: number; rows: number;        // vertices
  heights: Float32Array;             // index = row * cols + col; x = minX + col*spacing, z = minZ + row*spacing
  wildness: Float32Array;            // 0 at/inside the corridor edge -> 1 beyond the shoulder (splat weight)
}
export interface RoadProximity { distance: number; roadY: number; infield: boolean } // legacy, kept
export class Terrain {
  constructor(readonly track: Track);
  readonly field: TerrainField;
  heightAt(x: number, z: number): number;                       // linear on the cell's triangle (below), clamped
  nearRoad(x: number, z: number, reach?: number): RoadProximity; // legacy
}
// SW/track/noise.ts (P1 creates it; stable through M8, P2 imports it and never moves it)
export function fbm(x: number, z: number, octaves: number): number;
```
**Cell triangulation** (binding for `heightAt` and P5's terrain mesh). For cell `(col, row)` with
corner heights `h00 = (col, row)`, `h10 = (col + 1, row)`, `h01 = (col, row + 1)`,
`h11 = (col + 1, row + 1)` and local `fx, fz` in [0, 1]: the cell is split along the diagonal from
`(col, row + 1)` to `(col + 1, row)`. If `fx + fz <= 1`, `h = h00 + fx (h10 - h00) + fz (h01 - h00)`;
otherwise `h = h11 + (1 - fx)(h01 - h11) + (1 - fz)(h10 - h11)`. P5 builds the two triangles
`(00, 01, 10)` and `(01, 11, 10)` per cell, wound so the normals point up.

### 3.8 Placements (P2, `SW/track/gen/placement.ts`)
```ts
export type PlacementKind = 'pine' | 'board300' | 'board200' | 'board100' | 'marshal';
export interface Placement {
  kind: PlacementKind;
  x: number; z: number;        // y: caller uses terrain.heightAt (pines) or lateralPoint (near-road items)
  yaw: number;                 // local +Z faces the road for boards/posts
  scale: number;               // pines: 1 = 16 m tall
  station: number;
  side: -1 | 1;
}
export function placeTrackside(track: Track, terrain: Terrain): Placement[]; // deterministic
```

### 3.9 Quality presets (P3, `SW/render/quality.ts`; values in `config.ts` `PRESETS`)
```ts
export type PresetId = RenderPreset;                 // 'high' | 'medium' | 'low' from @gamergang/shared
export interface QualityPreset {
  id: PresetId;
  maxInternalPixels: number;   // cap on summed internal pixels of all viewports at scale 1
  minScale: number;            // dynamic-resolution floor (linear)
  msaa: 0 | 2 | 4;
  bloomLevels: 3 | 4;
  shadow: { kind: 'sun'; mapSize: 1024 | 2048; far: number } | { kind: 'focus'; mapSize: 1024 | 2048; extent: number };
  shadowRadius: number;
  anisotropy: number;
  sharpness: number;           // RCAS strength in stops: 0 = strongest, each +1 halves it (2 = 25%); off is a renderer uniform, not a preset value
  vegetationDensity: number;   // share of placed pines drawn, 0..1
  pineShadows: boolean;
  cameraFar: number;           // chase/overview camera far plane (m)
}
export interface RaceRenderOutcome { atFloorShare: number; missedShare: number }
export const PRESET_ORDER: readonly PresetId[];      // ['high', 'medium', 'low']
export function getPreset(id: PresetId): QualityPreset;
export function lowerPreset(id: PresetId): PresetId; // low stays low
export function presetForPlayers(count: number): PresetId;
export function startingPreset(count: number): PresetId;
export function recordRaceOutcome(count: number, outcome: RaceRenderOutcome): void;
export function noteLoadingDrop(count: number): void;
export function sessionDrops(): number;
```
`config.ts` (P3), starting values to be tuned by the owner's telemetry:

| | high | medium | low |
|---|---|---|---|
| maxInternalPixels | 2560×1440 | 1920×1080 | 1920×1080 |
| minScale | 0.6 | 0.6 | 0.7 |
| msaa | 4 | 4 | 2 |
| bloomLevels | 4 | 4 | 3 |
| shadow | sun, 2048/cascade, far 160 | sun, 1024/cascade, far 120 | focus, 1024, extent 34 |
| shadowRadius | 2.5 | 2.5 | 2 |
| anisotropy | 8 | 8 | 4 |
| sharpness (stops; strength 2^-s) | 0.3 (81%) | 0.35 (78%) | 0.4 (76%) |
| vegetationDensity | 1 | 0.75 | 0.5 |
| pineShadows | true | true | false |
| cameraFar | 2400 | 1800 | 1400 |

```ts
export const RENDER = { canvasPixelRatio: 1, sharpenWhenDprAbove: 1.25, tilePadding: 16, warmupFrames: 3, seamColour: 0x050608 } as const;
export const RESOLUTION = { targetShare: 0.78, dropAboveShare: 0.88, raiseBelowShare: 0.65, step: 0.05,
  minChangeMs: 250, raiseAfterMs: 2000, sampleWindow: 8, missedFactor: 1.5, fallbackMissedPer60: 3,
  fallbackRaiseAfterMs: 4000, hiccupMs: 250, loadingBenchFrames: 90, loadingDropFactor: 1.5,
  dropIfFloorShare: 0.2, dropIfMissedShare: 0.01 } as const;
export const BENCH = { warmupSeconds: 3, measureSeconds: 20, cameraSpeed: 45, cameraHeight: 2.3,
  lookAhead: 25, soakMinutes: 30, soakWindowSeconds: 60, soakPostEveryMinutes: 5 } as const;
```

### 3.10 Frame stats and resolution (P3)
This section and §3.11 are the binding versions; the P3 task text follows them.
```ts
export interface FrameWindow {
  frames: number; durationMs: number; fpsAvg: number;   // durationMs = sum of recorded rAF deltas (fractional)
  frameMsP50: number; frameMsP95: number; frameMsP99: number; frameMsMax: number; // raw rAF delta
  cpuMsP99: number;
  gpuMsAvg: number | null; gpuMsP95: number | null; gpuMsP99: number | null;     // null: no timer samples
  missedFrames: number;                      // rafMs > RESOLUTION.missedFactor * 1000 / min(60, refreshHz)
  scaleAvg: number; scaleMin: number; drawCallsAvg: number; trianglesAvg: number;
}
/** Two accumulators (window, total), each with three histograms (rAF, CPU, GPU): 0.1 ms buckets,
 *  0-50 ms, plus overflow. All percentiles come from the histograms. Frames with rafMs > hiccupMs are
 *  ignored. Allocation-free, Node-safe. */
export class FrameStats {
  record(rafMs: number, cpuMs: number, gpuMs: number | null, scale: number, drawCalls: number, triangles: number): void;
  snapshot(): FrameWindow;                   // since the last resetWindow()
  snapshotTotal(): FrameWindow;              // since the last resetTotal()
  resetWindow(): void;
  resetTotal(): void;
  setRefreshHz(hz: number): void;            // from measureRefreshHz()
  refreshHz(): number;                       // 60 until set
}
/** Snap a median rAF delta to 30/50/60/75/90/100/120/144 Hz within 4%, else round(1000 / ms). */
export function snapRefreshHz(medianDeltaMs: number): number;
export class ResolutionController {
  scale: number;                             // 1 = tile size at baseScale
  enabled: boolean;
  constructor(preset: QualityPreset);
  setPreset(preset: QualityPreset): void;
  /** Once per frame. Returns true when the scale changed. */
  update(now: number, gpuMs: number | null, rafMs: number, intervalMs: number): boolean;
  atFloorShare(): number;
  missedShare(): number;
  resetStats(): void;
}
export class GpuTimer {
  readonly supported: boolean;
  constructor(gl: WebGL2RenderingContext);
  begin(): void; end(): void;
  poll(): number | null;                     // newest finished result (ms), non-blocking
  dispose(): void;
}
```

### 3.11 Renderer (P3, `SW/render/renderer.ts`)
```ts
export interface RenderStats {
  preset: PresetId; drops: number; scale: number; minScale: number;
  internalWidth: number; internalHeight: number;   // viewport 0's rendered size this frame
  outputWidth: number; outputHeight: number;       // viewport 0's rect on the canvas
  viewports: number; drawCalls: number; triangles: number;
  programs: number; latePrograms: number;
  gpuMs: number | null; timing: 'timer-query' | 'none'; cpuMs: number;
  refreshHz: number; devicePixelRatio: number; sharpening: boolean;
  window: FrameWindow;
}
export class GameRenderer {
  readonly webgl: WebGLRenderer;
  readonly resolution: ResolutionController;
  readonly frameStats: FrameStats;
  readonly gpuTimer: GpuTimer;
  constructor(canvas: HTMLCanvasElement, preset: QualityPreset);
  get preset(): QualityPreset;
  setSize(cssWidth: number, cssHeight: number): void;
  setLayout(rects: readonly Rect[]): void;         // integer canvas px; (re)allocates atlas/scratch
  setPreset(preset: QualityPreset): void;          // loading screen / benchmark only
  beginFrame(now: number, rafMs: number): void;    // rafMs = loop.lastDeltaMs
  renderView(index: number, scene: Scene, camera: Camera, speed: number): void;
  endFrame(time: number, cpuMs: number): void;     // cpuMs = the previous frame's loop.lastCpuMs
  precompile(scene: Scene, camera: Camera): Promise<void>;
  get stats(): RenderStats;
  dispose(): void;
}
/** Median delta of `frames` empty rAF callbacks on an idle page, snapped with snapRefreshHz. */
export function measureRefreshHz(frames?: number): Promise<number>; // default 30
```
Every frame runs the same passes: scene views (scratch + copy), bloom, composite into the LDR atlas,
and the final upscale + RCAS pass (with `uSharpen = 0` when nothing is upscaled). Rendered sizes come
from `rect × baseScale × scale`, never from the 16-px-rounded allocation.

### 3.12 Shadows (P3, `SW/render/shadowRig.ts`)
```ts
export interface ShadowRig {
  readonly light: Light;               // SunLight (sun) or DirectionalLight (focus)
  beforeView(focus: Vector3): void;    // focus rig re-aims; SunLight no-op
  dispose(): void;                     // removes the light from the scene
}
export function createShadowRig(scene: Scene, preset: QualityPreset, direction: Vector3, colour: Color, intensity: number): ShadowRig;
// SW/scene/world.ts (P3 stub, P5 implements):  setQuality(preset: QualityPreset): void
```

### 3.13 Game options, hooks, overlay (P3)
```ts
export type BenchMode = 'auto' | 'matrix' | 'soak';
export interface GameOptions { bench: BenchMode | null }
export interface GameHooks {               // existing + telemetry
  send(playerId: string, message: TvMessage): void;
  rttMs(playerId: string): number | null;
  onResults(results: RaceResult[]): void;
  audio: AudioContext | null;
  telemetry(samples: TelemetrySample[]): void;
}
// SplitWaysGame
//   static create(container, players, hooks, options?: GameOptions): Promise<SplitWaysGame>
//   prepare(): Promise<void>               // measure refresh, precompile, warm-up, loading benchmark, then start()
//   (start() is private: it sets loop.stepping = true and starts the race-status timer)
export interface DebugStats { render: RenderStats; physicsMs: number; autopilot: boolean; viewports: number }
```

### 3.14 Telemetry (P3; appended to `shared/src/api.ts`, server and DB)
```ts
// POST /api/telemetry -> TV-only performance samples (host key required); no GET exists.
export const RENDER_PRESETS = ['high', 'medium', 'low'] as const;
export const renderPresetSchema = z.enum(RENDER_PRESETS);
export type RenderPreset = z.infer<typeof renderPresetSchema>;
export const TELEMETRY_KINDS = ['loading-benchmark', 'flythrough', 'race', 'soak'] as const;
export const TELEMETRY_MAX_SAMPLES = 8;   // per request; the client splits bigger batches (matrix = 9)
export const TELEMETRY_MAX_BODY_BYTES = 16 * 1024;
const telemetryMs = z.number().min(0).max(10_000);
const telemetryPx = z.number().int().min(1).max(16_384);
export const telemetryDeviceSchema = z.object({
  userAgent: z.string().max(512),
  gpu: z.string().max(256).nullable(),
  cores: z.number().int().min(1).max(256).nullable(),
  memoryGb: z.number().min(0).max(1024).nullable(),
  screenWidth: telemetryPx,
  screenHeight: telemetryPx,
  devicePixelRatio: z.number().min(0.25).max(8),
  refreshHz: z.number().min(1).max(500).nullable(),
  timerQuery: z.boolean(),
});
export const telemetrySampleSchema = z.object({
  kind: z.enum(TELEMETRY_KINDS),
  scenario: z.string().regex(/^[a-z0-9-]{1,32}$/),   // e.g. fly-4-low, race, soak-07, soak-total, loading
  track: trackIdSchema.nullable(),
  viewports: z.number().int().min(1).max(MAX_PLAYERS),
  preset: renderPresetSchema,
  durationMs: z.number().int().min(0).max(4 * 3_600_000),
  frames: z.number().int().min(0).max(10_000_000),
  fpsAvg: z.number().min(0).max(1000),
  frameMsP50: telemetryMs, frameMsP95: telemetryMs, frameMsP99: telemetryMs, frameMsMax: telemetryMs,
  cpuMsP99: telemetryMs,
  gpuMsAvg: telemetryMs.nullable(), gpuMsP95: telemetryMs.nullable(), gpuMsP99: telemetryMs.nullable(),
  missedFrames: z.number().int().min(0).max(10_000_000),
  internalWidth: telemetryPx, internalHeight: telemetryPx,
  outputWidth: telemetryPx, outputHeight: telemetryPx,
  scaleAvg: z.number().min(0).max(2), scaleMin: z.number().min(0).max(2),
  drawCallsAvg: z.number().min(0).max(100_000), trianglesAvg: z.number().min(0).max(100_000_000),
  presetDrops: z.number().int().min(0).max(10),
});
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;
export type TelemetryDevice = z.infer<typeof telemetryDeviceSchema>;
export const postTelemetryRequestSchema = z.object({
  room: roomCodeSchema,
  key: hostKeySchema,
  session: z.string().regex(/^[a-z0-9]{8,32}$/),
  build: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).nullable(),
  device: telemetryDeviceSchema,
  samples: z.array(telemetrySampleSchema).min(1).max(TELEMETRY_MAX_SAMPLES),
});
export type PostTelemetryRequest = z.infer<typeof postTelemetryRequestSchema>;
```
`MAX_PLAYERS` and `roomCodeSchema` come from `./protocol` (add `MAX_PLAYERS` to the existing import
line), and `hostKeySchema` and `trackIdSchema` already live in `api.ts`. zod 4.6.5 `z.object` strips
unknown keys and rejects NaN and Infinity (verified by the mapper), and `.int()` rejects fractions, so
the client's sanitiser (P3.9) rounds every int field and clamps every number before sending.

**DB** (`server/src/db/schema.ts`, appended to `SCHEMA`; no FK to rooms, like `laps`):
```sql
CREATE TABLE IF NOT EXISTS telemetry (id bigserial PRIMARY KEY, room text NOT NULL, session text NOT NULL,
  build text, kind text NOT NULL, scenario text NOT NULL, preset text NOT NULL, viewports smallint NOT NULL,
  fps_avg real NOT NULL, frame_ms_p99 real NOT NULL, gpu_ms_avg real, device jsonb NOT NULL,
  sample jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS telemetry_created_idx ON telemetry (created_at);
CREATE INDEX IF NOT EXISTS telemetry_room_idx ON telemetry (room, created_at);
```
**Store** (`server/src/db/store.ts`):
- `export type TelemetryStatus = RoomStatus | 'rate-limited';` and
  `postTelemetry(request: PostTelemetryRequest): Promise<TelemetryStatus>`.
- Constants: `TELEMETRY_RETENTION_DAYS = 90`, `TELEMETRY_ROOM_WINDOW_SECONDS = 600`,
  `TELEMETRY_ROOM_MAX_ROWS = 40`, `TELEMETRY_GLOBAL_MAX_ROWS_PER_HOUR = 2000`. These are overridable
  through an optional second `createStore` argument for tests.
- One batch: `[...CLEANUP, touch(room), retentionDelete, insert]`. The status is
  `roomStatus(results.at(-3), key)`. If it is `'ok'`, return `results.at(-1)?.length ? 'ok' : 'rate-limited'`.
- Never add the retention DELETE to `CLEANUP`, which runs on every signal poll.

Insert SQL (verified in PGlite by the mapper):
```sql
INSERT INTO telemetry (room, session, build, device, kind, scenario, preset, viewports, fps_avg, frame_ms_p99, gpu_ms_avg, sample)
SELECT $1, $3, $4, $5::jsonb, s->>'kind', s->>'scenario', s->>'preset', (s->>'viewports')::smallint,
       (s->>'fpsAvg')::real, (s->>'frameMsP99')::real, (s->>'gpuMsAvg')::real, s
FROM jsonb_array_elements($6::jsonb) AS s
WHERE EXISTS (SELECT 1 FROM rooms WHERE code = $1 AND host_key = $2)
  AND (SELECT count(*) FROM telemetry WHERE room = $1 AND created_at > now() - make_interval(secs => $7)) + jsonb_array_length($6::jsonb) <= $8
  AND (SELECT count(*) FROM telemetry WHERE created_at > now() - interval '1 hour') < $9
RETURNING 1 AS ok
```
Retention SQL: `DELETE FROM telemetry WHERE created_at < now() - make_interval(days => $1)`.

### 3.15 Controller (P4; P1 parts marked)
```ts
// SW/input/controls.ts (dependency-free)
export const DRAG = { zoneShare: 0.45, fullLockTravel: 0.25, featherTravel: 0.3, edgeInsetPx: 24 } as const;
export function dragSteer(dxPx: number, viewportHeightPx: number, travelShare?: number): number; // -1..1 raw linear
export function shapeSteer(x: number, deadZone: number, gamma: number): number;                // -1..1 shaped
export function featherThrottle(dyPx: number, pedalHeightPx: number, travelShare?: number): number; // 0..1 in 0.05 steps
// SW/input/steerProcessor.ts
export class SteerProcessor { value: number; process(raw: number, dt: number): number; reset(): void }
// SW/sim/car.ts (P4)
//   get reverseState(): 'off' | 'arming' | 'on'
//   private applyDrive(forwardSpeed: number, dt: number): boolean
// SW/sim/car.ts + SW/config.ts (P1): STEERING.turnRateDegPerS / returnRateDegPerS, converted in applySteering
// SW/race/race.ts (P1)
//   requestRespawn(racer: Racer): boolean;   Racer.stuckOnGasTime: number;   Racer.resetReadyAt: number
//   constructor(track, cars, laps = track.definition.laps)
// shared/src/protocol.ts
//   actionSchema: { type: 'action'; action: 'reset' }                        (P1)
//   raceSchema adds (P4):
//     reverse: 'off' | 'arming' | 'on'
//     hint: 'reverse' | 'release-gas' | null      // text per driver: P4.4 table
//     resetReady: boolean                          // racing, not finished, not respawning, cooldown over
//   export const REVERSE_ARM_MS = 350;                                       (P4)
//   inputSchema unchanged: steer raw linear -1..1; throttle 0..1 in 0.05 steps; brake 0..1
//   raceSchema.lap / totalLaps stay int 0..99 / 1..99 (the soak race uses 99 laps)
// SW/hud/viewportHud.ts (P4)
//   setGear(reverse: boolean): void;  setHint(text: string): void
```

### 3.16 P5-visible scene APIs
```ts
// SW/scene/world.ts
//   static create(track: Track, terrain: Terrain, preset: QualityPreset): Promise<WorldVisual>
//   readonly group: Group; readonly gantry: Gantry; setQuality(preset: QualityPreset): void; dispose(): void
// SW/scene/blobShadows.ts
export class BlobShadows { readonly mesh: InstancedMesh; constructor(count: number); update(cars: readonly Car[], alpha: number): void; dispose(): void }
// SW/scene/skidMarks.ts: update(car: Car): void          (reads car.wheelSurface)
// SW/scene/dust.ts:      emit(car: Car, dt: number): void (reads car.wheelSurface)
// SW/audio/raceAudio.ts: updateCar(index: number, throttle: number, horn: boolean, surface: SurfaceId, draft: number): void
```

---

## 4. Data and asset plan

### 4.1 Track base: an original layout, and decision D-1

**Decision D-1 (resolved by the owner on 2026-10-10).** Track 1, Kestrel Pines, uses an original
layout owned by the project. It is not derived from Speed Dreams or from any other track. Nothing from
Speed Dreams is used or shipped in M8: no tracks, cars, sounds, textures or models, and no code. §4.3
and Appendix C summarise the layout and its overrides.

**Why.** The owner's rule was "Speed Dreams data only where the Free Art License is confirmed". The
candidate base, `SD/tracks/circuit/g-track-2/g-track-2.xml` ("CG track 2", a fictional circuit), has
a per-directory readme that says FAL, but every Speed Dreams track XML carries a GPLv2-or-later
header. The licence of a Speed Dreams layout therefore cannot be confirmed as FAL.

**Licence evidence reviewed** on 2026-10-10 (P2.1 records it in `LICENCES.md`):

| Evidence | Says |
|---|---|
| `SD/tracks/circuit/g-track-2/readme.txt` (the per-directory licence file) | "Copyright © 2002 Eric Espie / Reworked © 2005 Bernhard Wymann / Copyleft: this work of art is free, you can redistribute it and/or modify it according to terms of the Free Art license." |
| `g-track-2.xml` lines 2-13 | Header "copyright : (C) 2000 C. Guionneau" plus GPLv2-or-later boilerplate. **Every** SD track XML carries the same TORCS template header (checked: all 16 circuit and dirt XMLs). |
| Speed Dreams data repo README "License" (verified online) | "non-functional data is licensed under the Free Art License by default ... some ... other assets are distributed under various free ... licenses. Please read their license files located in their respective directories." |
| Package | `speed-dreams-data-1.4.0-7mdv2010.0` (Mandriva RPM) |

**Reviewed and not used:**
- `g-track-2`, the candidate base (31 segments, 3185.8 m): the FAL readme against the GPL header.
- `ruudskogen`, a replica of the real Rudskogen circuit that does not close.
- `forza`, a Monza homage whose name the owner forbids.
- Every other Speed Dreams track: the same GPL header.
- All car and sound data.

**Consequences for M8.**
- There is no Speed Dreams importer: no XML parser, parser tests or conversion script (Appendix B is
  removed). `pnpm assets:track` only checks a track folder's own layout files (P2.3).
- The track files carry `source.package: "original"` and the project's own licence and credits
  (§4.3), with no FAL header and no `LICENCE.txt`.
- The earlier residual risk (the layout being held to be GPLv2+) no longer applies. What remains is
  resemblance to a real circuit, which the originality check in §4.3 covers (R-1).
- D-1 gates nothing: no merge waits on it.

**Decision D-2 (packaging).**
- Track data lives only in `assets/tracks/kestrel-pines/` (`base.layout.json`, `overrides.json`). It
  is fetched at runtime and never bundled into JS, so a track stays content (§3.5), and a later track
  under another licence can ship the same way.
- Each JSON carries top-level `licence` and `credits` fields (JSON has no comments). §4.3 gives the
  Kestrel Pines strings.
- There is no `LICENCE.txt` for Kestrel Pines. It is project-owned data, not a third-party work; its
  `LICENCES.md` row (§4.4) records where it came from.

### 4.2 CC0 assets (verified to exist on 2026-10-10)

All Poly Haven and ambientCG assets are CC0.

**Kept:**
- `assets/hdri/syferfontein_18d_clear_puresky_2k.hdr` (Poly Haven, CC0, already shipped, 4.19 MB).
  Decision D-8: keep this HDRI and the existing `sky.ts` measurements; the r186 `Sky` stays unused in M8.
- `assets/models/sports-car.glb` (CC0, unchanged).

**New:**

| Use | Asset | Source and files | Size |
|---|---|---|---|
| Asphalt (race tarmac) | Poly Haven `asphalt_track` (Dimitrios Savva), 2 m × 2 m | `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_track/asphalt_track_{diff,nor_gl,arm}_1k.jpg` | 0.86 + 0.83 + 0.53 MB |
| Forest floor (terrain far layer) | Poly Haven `forest_leaves_04` (Rob Tuytel), pine_forest collection, 1.5 m | `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_leaves_04/forest_leaves_04_{diff,nor_gl,arm}_1k.jpg` | 0.42 + 0.58 + 0.36 MB |
| Grass run-off and terrain near layer | ambientCG `Grass004`, 1.4 m | `https://ambientcg.com/get?file=Grass004_1K-JPG.zip` (zip 11.0 MB). **Re-encode** (JPEG q90, never copy) `*_Color.jpg` (1.99 MB) → `grass004_diff_1k.jpg` (about 0.48 MB) and `*_NormalGL.jpg` (2.34 MB) → `grass004_nor_gl_1k.jpg` (about 0.57 MB); pack `grass004_arm_1k.jpg` = R `*_AmbientOcclusion.jpg`, G `*_Roughness.jpg`, B 0 (q90) | about 1.4 MB |
| Gravel traps | ambientCG `Gravel022`, 1.5 m | `https://ambientcg.com/get?file=Gravel022_1K-JPG.zip` (zip 10.1 MB). Same processing: Color (1.42 MB) → about 0.40 MB, NormalGL (2.46 MB) → about 0.64 MB, ARM packed → `gravel022_*_1k.jpg` | about 1.4 MB |

**Folders:**
- `assets/textures/asphalt/asphalt_track_*`
- `assets/textures/forest/forest_leaves_04_*`
- `assets/textures/grass/grass004_*`
- `assets/textures/gravel/gravel022_*`

Delete `assets/textures/asphalt/asphalt_02_*` once unused (P5).

**Runtime-drawn (no files):** kerb stripes, armco gradient, board numerals, blob AO gradient, banners
(fictional brands), gantry sign. **No Speed Dreams files ship.**

**Processing (ambientCG sets):** a one-off PIL script outside the repo re-encodes the Color and
NormalGL maps and packs the ARM map, resizing to 1024² if needed and saving everything as JPEG
quality 90. Copied as-is, the four 1K Color/NormalGL originals alone are 8.1 MB and push `assets/` to
about 16.6 MB, over budget. Record the processing in `ASSETS.md`. ambientCG Roughness is linear;
`loadPbrSet` loads ARM and normal maps as linear and diffuse as sRGB. Poly Haven files ship as
downloaded.

### 4.3 Track 1 layout, overrides and licence fields

**Files.** `assets/tracks/kestrel-pines/base.layout.json` (`splitways-layout@1`) and `overrides.json`
(`splitways-overrides@1`) are byte-identical copies of the owner-approved `LAYOUT/base.layout.json` and
`LAYOUT/overrides.json`. Nobody edits, re-serialises or tunes them in M8 (P2.3, P2 pitfalls).

| File | Bytes | SHA-256 |
|---|---|---|
| `base.layout.json` | 27,548 | `436a614ee7abc8a56db7c1d4b0d97706d92c387bce6e05504361d62a55786879` |
| `overrides.json` | 374 | `d9adb61780eb9b3d8c389758a6bab94a9a0ca9a0ea88cce062f874316132d9f8` |

Together they are 27.9 KB, inside the 60 KB track JSON budget (§4.5).

**Licence and credits** (the same in both files):
- `licence`: `"Proprietary - (C) 2026 Gamer Gang project. All rights reserved."`
- `credits`: `["Original layout by the Gamer Gang project, 2026"]`
- `base.layout.json` also has `name` `"Kestrel Pines"` and
  `source: { "package": "original", "file": "", "readme": "", "readmeLicence": "", "notes": "Original design, not derived from any existing track" }`.

**The layout** (46 segments: 12 straights and 34 arc pieces; Appendix C.1 lists them all):
- 3358.9 m, counter-clockwise (net turn +360°), 3 laps. The file closes exactly: plan gap 0.0 m,
  heading error 0.0°, and the elevation returns to `startZ` 0.
- 12 corners, each built from spiral entry and exit pieces:
  - T1 Millrace: left 105°, R40.
  - The esses: Sawpit (right 44°, R125) and Woodcutter (left 44°, R130).
  - The Brow: left 50°, R180, with a blind crest at the summit.
  - Windhover: a right-left flick, 12° each way, peak curvature R340.
  - **The Kestrel** (signature): a descending left of 204°. It tightens from R140 to R68, holds R68 for
    84° on bank rising to 0.10 rad, then opens to R240.
  - Talon: right 17°, R240.
  - The Drop: right 55°, R70.
  - Beck bridge: a flat-out left kink of 12°, R420, at the lowest point.
  - The Hollow: right 69°, R48.
  - Larch kink: a flat-out right of 10°, R400.
  - The Switchback: a left hairpin of 140°, R30, opening to R110 onto the grid straight.
- Tightest radii: the Switchback R30 and T1 R40. Every other corner is R48 or wider.
- Elevation -6.5 to +15.5 m (a 22 m range). The steepest segment averages 5.7% (Fernside dive), and
  the Ladder climbs 14.3 m at 5.1%.
- Road 13-14 m wide (14 m on the start straights, at T1, and from the Hollow straight round to the
  line). Width steps between segments are at most 0.5 m. Bank stays within ±0.10 rad and is
  continuous across every join, and so are the run-off widths.
- Run-off: gravel with tyre walls outside the five slow corners (T1, the Kestrel, the Drop, the Hollow,
  the Switchback) and grass with armco everywhere else. The main and grid straights have paved aprons
  with a pit wall (`wall`) on the left and a catch fence (`fence`) on the right. Kerbs are 1.2 m wide
  and 0.04-0.06 m high, and `kerbHeight` is 0 wherever there is no kerb. No pit lane (D-6).
- Grid: 235 m of straight behind the line ("grid straight") and 275 m after it ("main straight").
  The longest straight is the Ladder (281 m).
- Separate legs stay at least 122 m apart (the Windhover exit and Kestrel approach against the Drop).
  The footprint is about 685 × 1016 m.

**Overrides.** A header and the closure only: `id` `"kestrel-pines"`, `name` `"Kestrel Pines"`,
`laps` 3, `checkpointCount` 18, the licence and credits above, and `closure` with the straights
"the Ladder" (heading 105°) and "back straight" (heading 220°), 115° apart, and the heading arc "the
Drop apex" (right, R70, 27°). The layout already closes, so these handles only absorb rounding.
Kestrel Pines uses none of the global, `remove`, `insertAfter`, `segments` or `extraKerbs` overrides.
The generator still implements them (§3.2, P2.4), and `layout.test.ts` covers them with fixtures.
Appendix C.2 has the file content.

**Originality.** The layout was checked against 196 outlines: about 125 real circuits (F1 GeoJSON,
the TUMFTM racetrack database, OpenStreetMap) plus the 29 Speed Dreams tracks. Two measures were used:
silhouette distance (Procrustes over shift, rotation, mirror and both directions) and turning-function
distance. No real circuit is closer than 0.200. The nearest is Mexico City at 0.203, and Brands Hatch
Indy is at 0.211; known copies score 0.02-0.08. `g-track-2` is at 0.217. Any change of geometry moves
the closure and the outline, so it needs this check re-run. That is an owner and design task outside
the M8 packages.

**Names.** Corner names come from birds of prey, the timber trade, and water and land. Dressing,
boards and signage must not use real-circuit corner names (for example Brands Hatch's Paddock,
Druids or Clearways) or mountain-circuit cues (Corkscrew, Skyline, Mountain Straight).

### 4.4 Licence log format (`LICENCES.md`, repo root)

Sections: "Speed Dreams (reviewed, not used)" (P2), "Project-owned data" (P2), "CC0 assets" (P5), and
"Fonts and other" (P6 copies the existing Chakra Petch OFL entry from `ASSETS.md`). One table row per
source:

| Checked | Source (path or URL, version) | Licence file and exact words | Conflicts or notes | Decision | Used for | Files in repo | Credits |
|---|---|---|---|---|---|---|---|

**Speed Dreams section** (P2.1 has the exact quotes). One row for the package
`speed-dreams-data-1.4.0-7mdv2010.0`, checked 2026-10-10. It records:
- **What was reviewed:** the track data (the candidate base `g-track-2`, plus `ruudskogen`, `forza`
  and the other circuit and dirt tracks), the car data and the sound data.
- **The licence words**, quoted verbatim: the `g-track-2` readme (FAL) and the SD data repository
  policy (data is FAL by default; the per-directory licence files govern).
- **The conflict:** every track XML carries a GPLv2-or-later TORCS template header (for `g-track-2`,
  "(C) 2000 C. Guionneau"), against the FAL readme, so FAL cannot be confirmed for any Speed Dreams
  track.
- **Decision:** D-1 (owner, 2026-10-10): not used. **Used for:** nothing. **Files in repo:** none.
  **Credits:** none. Nothing from Speed Dreams ships: no tracks, no cars and no sounds (and no
  textures, models or code).

**Project-owned data section.** One row for Kestrel Pines (`assets/tracks/kestrel-pines/`): an
original layout by the Gamer Gang project, not derived from any existing track, with the licence and
credits of §4.3.

Rules:
- Add the row **before** deriving from or adding the source.
- Quote licence words verbatim.
- Never list a source as used unless the decision column says it may be used.
- `ASSETS.md` keeps its per-file table, lists the two Kestrel Pines files as original project data,
  and links to `LICENCES.md` for the Speed Dreams review.

### 4.5 Size and performance budgets

**Assets:**
- `assets/` total ≤ 14 MB. Estimate: about 10.5 MB = 7.7 − 3.76 (sand and asphalt_02) + about 6.5 new
  (asphalt_track 2.2, forest_leaves_04 1.4, Grass004 and Gravel022 about 1.4 each after re-encoding).
- Track JSON ≤ 60 KB combined.
- GPU texture memory for the world ≤ 80 MB (about 5.6 MB per 1k RGBA8 texture with mips, 12 textures).

**Draw calls and triangles per frame,** counted by the overlay (all viewports and passes, including
shadows and post):

| Config | Draw calls | Triangles |
|---|---|---|
| 1 viewport, High | ≤ 700 | ≤ 2.5 M |
| 2 viewports, Medium | ≤ 900 | ≤ 3.5 M |
| 4 viewports, Low (bots) | ≤ 1100 | ≤ 3.5 M |

**Placement counts:** pines ≤ 14,000 placed (≤ 120 tris each). Corridor chunks: about 23 (3359 m / 150 m).
Terrain chunks: about 30 (320 m).

**Loading on the M1:** from Enter to GO ≤ 10 s, including precompile and the loading benchmark.
Measured by the owner.

**Frame targets on the M1** (research estimates): GPU ≤ 12-13 ms; main thread ≤ 8-10 ms including
physics.

---

## 5. Testing plan

### 5.1 Unit tests (Vitest, Node; `**/src/**/*.test.ts`)

| Package | Tests |
|---|---|
| P1 | `race/slipstream.test.ts` (new); `race/race.test.ts` (reset guard, stuck-on-gas, placeholder loop); `pad/steering.test.ts` (ramp only); server tests with `kestrel-pines`; existing `sim/car.test.ts` with the deg/s steering rates. |
| P2 | `track/gen/layout.test.ts`, `generate.test.ts`, `corridor.test.ts`, `placement.test.ts`; `track/terrain.test.ts`; `sim/surface.test.ts`; `track/trackPhysics.test.ts` and `race/race.test.ts` rewritten for Kestrel Pines. |
| P3 | `render/frameStats.test.ts` (histogram percentiles over whole windows, refresh snapping), `render/resolution.test.ts` (both modes, 120 Hz budget), `render/quality.test.ts` (effective drops only); `client/src/net/telemetry.test.ts` (sanitiser, chunking); `server/src/db/store.test.ts` and `server/src/api/router.test.ts` (telemetry and the API_ROUTES guard). |
| P4 | `input/controls.test.ts`, `input/steerProcessor.test.ts`, `sim/reverse.test.ts`, `pad/steering.test.ts`; existing `sim/car.test.ts` still passes. |
| P5 | No new unit tests required. Any pure helper you add (for example the instance shuffle) gets one. |

The whole `pnpm test` should stay under 90 s. The baseline is 25 s; `pnpm check` takes 64 s in total
(both measured in a clean worktree on an otherwise idle machine).

### 5.2 Commands each package must pass
- The M8 gate (§2.1): `pnpm check` (typecheck, lint, format:check, test), `pnpm build` and the three
  §1.3 greps, in the package's own worktree, before and after the pre-handoff merge.
- P3 and P6 also run `pnpm build:vercel` (no network needed).
- P2: `pnpm assets:track assets/tracks/kestrel-pines` (exits 0 and prints the Appendix C.3 values),
  and `sha256sum assets/tracks/kestrel-pines/*.json` matches §4.3 (the committed files are unchanged
  copies of `LAYOUT/`).
- P5: `pnpm start` (prod build plus server, port 4400 via env) serves the track JSON and textures.

### 5.3 Scripted benchmark (P3 builds it, P5 and the owner run it)
- `/tv?bench=auto`: add one keyboard player (K), press Enter. After loading, the fly-through runs
  1 viewport High, 2 Medium, 4 Low, each with 3 s warm-up and 20 s measurement, about 70 s in total.
  Then the results table appears, the 3 samples go out in one telemetry POST, and
  `console.info('[splitways-bench]', json)` is logged.
- `/tv?bench=matrix`: the same for all 9 viewport/preset combinations (about 3.5 min); the client
  sends the 9 samples as two POSTs (8 + 1, `TELEMETRY_MAX_SAMPLES`).
- `/tv?bench=soak&bots=1`: K four times (2 keyboard players + Bot 3 + Bot 4), Enter. Autopilot race
  with 99 laps (the protocol maximum, about 2.6 h); a 60 s window sample, POSTs every 5 min; "SOAK
  DONE" summary over the whole run after 30 min.
- Debug key B (overlay open) starts `auto` from any race.
- SwiftShader numbers are meaningless for performance. In CI-like checks, only assert completion,
  sample count, schema validity (200 response) and draw-call budgets.

### 5.4 Headless browser checks (Playwright + SwiftShader)
- Reference scripts: `E2E/m1.cjs` (one pad, CDP touch input), `E2E/m7show.cjs` (4 pads, autopilot,
  screenshots), `E2E/m3full.cjs` (full race).
- Each package copies the script it needs, changes the ports, removes item keys, and saves
  screenshots to `/tmp/claude-0/e2e-pN/`. Every run goes through the shared browser lock and uses
  polling timeouts, as described in §2.1.
- Per-package scenarios are in each package's Acceptance section.
- Checks common to every browser run:
  - No `pageerror` on TV or pads.
  - No console errors other than known benign ones (list any in the report).
  - The TV loading overlay disappears.
  - `.sw-canvas` exists.
- Tile correctness (P3, P5): with 4 viewports, sample pixel colours via a screenshot. Each quadrant
  centre is non-black and the 4 px seams are the seam colour (±8 per channel).

### 5.5 What the owner runs on the real M1 (after review, not by agents)
1. **Setup.**
   - Check out the reviewed branch, `pnpm install`.
   - Make sure `.env` has `DATABASE_URL` (Neon), then `pnpm db:migrate` (creates the telemetry table)
     and `pnpm start`.
   - TV: 4K at **60 Hz** (System Settings → Displays → refresh rate), Chrome full screen (press F on
     the TV page). Steps 2-4 run at 4K; step 5 repeats the key checks at 1080p.
   - MacBook on power, lid open or closed as normally used.
2. **Benchmark.** Open `http://localhost:4000/tv?bench=auto`, press K, Enter. Wait for the results
   table and photograph it. Optionally run `?bench=matrix`.
3. **Soak.** Open `http://localhost:4000/tv?bench=soak&bots=1`, press K ×4, Enter, and leave it for 30
   minutes. Photograph the "SOAK DONE" summary.
4. **Real races** with phones:
   - 1 player (High), 2 players (Medium), 4 players (Low): one full race each. Open the overlay
     (backtick) mid-race once to check preset, scale, GPU ms and missed.
   - Try both controller modes on an iPhone and on an Android phone: drag steer, buttons, gas
     feathering, reverse ring/label/R chip, the stuck hint, "HOLD · RESET", the handbrake strip.
5. **1080p output.** Switch the output to 1920×1080 at 60 Hz with `devicePixelRatio` 1 (a 1080p TV, or
   the 4K TV set to the 1920×1080 display mode, not a "looks like" scaled mode; the overlay must show
   `dpr 1.00` and `sharpen off` at scale 1). Run `?bench=auto` once and one full 4-player race. The
   same §5.6 pass definition applies.
6. **Read the results** with `pnpm telemetry:report --since 24h`, or ask the orchestrator to query
   Neon. Check the `device.timerQuery` field: if false, GPU ms are unavailable and the resolution
   controller ran in fallback mode. Check that `build` names the commit you ran.

### 5.6 Pass definition for "locked 60 fps" and "p99 < 16.7 ms"
Raw rAF deltas jitter around 16.7 ms even when no frame is missed, so p99 of raw deltas alone cannot
be the test.

**With a timer** (`timerQuery: true`), a window passes when:
- `gpuMsP99 < 16.7`;
- `cpuMsP99 < 16.7`;
- `missedFrames / frames < 0.5%` (missed = rAF delta > 1.5 × refresh interval);
- the preset stayed the expected one for the player count (`presetDrops = 0`; only effective drops
  count, so a session that starts on Low reports 0 unless the preset really changed).

**Without a timer:** `frameMsP99 < 18.0` (raw rAF), `missedFrames / frames < 0.5%`, and no drops.

The measured `refreshHz` must be 60. It is measured on an idle page during loading (P3.3), so it
reports the display, not the game's frame rate. If the TV runs at 50 or 30 Hz the run is invalid; fix
the display mode. The owner may tighten this definition. It is recorded in DECISIONS (P6).

---

## 6. Risks and fallbacks

| # | Risk | Mitigation and fallback |
|---|---|---|
| R-1 | **Licence conflict** (readme FAL vs GPL boilerplate in every SD XML) | Resolved by D-1 (owner, 2026-10-10): Track 1 uses an original layout owned by the project, nothing from Speed Dreams ships (no tracks, cars or sounds), and the review is recorded in `LICENCES.md` (§4.4). Remaining risk: resemblance to a real circuit. The layout was checked against 196 outlines with no real circuit under 0.200 (§4.3); any geometry change re-runs that check before it ships. |
| R-2 | **The M1 cannot hold 60 at 4 viewports on Low** | Lower `low.minScale` to 0.6, `msaa` to 0 (add FXAA from `THREE/examples/jsm/shaders/FXAAShader.js` in the composite as a follow-up), `bloomLevels` 3 → 2, `vegetationDensity` 0.5 → 0.3, shadow map 1024 → 512, `cameraFar` 1400 → 1000. Telemetry tells which knob matters. |
| R-3 | **`EXT_disjoint_timer_query_webgl2` missing on the M1** (Chrome on ANGLE Metal, unverified) | Fallback controller on missed vsync; pass definition without a timer (§5.6); telemetry records `timerQuery`. |
| R-4 | **Tile-based GPU cost** of breaking render passes per viewport (shadow passes in between, MSAA stores) | `storeMultisampledDepthBuffer: false`; the scratch target is only the size of the largest tile; Low uses the focus rig (one shadow pass per view) and MSAA 2. Possible follow-up: pre-render all shadow maps before the scene passes with `shadowMap.autoUpdate = false`. |
| R-5 | **Scissored MSAA resolve semantics** on ANGLE/Metal | Avoided by design (D-7): scratch target plus copy. |
| R-6 | **SunLight** doubles shadow passes per view and the cascade count is fixed at 2 | High and Medium only; Low uses the focus rig. Cap `shadow.camera.far` (160/120 m). Pines cast only on High/Medium. |
| R-7 | **Late shader compiles** (hitches at GO or when the scale first drops) | `compileAsync` with the HDR scratch bound, warm-up frames through the one always-on post path (D-9), overlay `late` count, presets fixed during races. The podium hitch is accepted. |
| R-8 | **Rapier tyre grip ignores collider friction** | Per-wheel `setWheelFrictionSlip` from `wheelGroundObject` surfaces, proven by `surface.test.ts`. If `wheelGroundObject` misbehaves, fall back to one `castRay` per wheel against the per-surface colliders (filter on the registered handles). |
| R-9 | **Index-as-metres constants** (`trackVisual` dashes and kerbs, `scenery` spacing, `project` window 40, `WALL_SEGMENT`) | Keep spacing at about 1.000 m. P5's rewrite removes most of them. |
| R-10 | **Crests launch cars; the autopilot crashes** on banking or crests | Crest and sag radius limits in the generator; the autopilot uses the speed profile × 0.92; the race test may use 2 laps; stuck respawn at 6 s plus safe-point respawn. |
| R-11 | **Wide run-off breaks gates and respawn** | Asymmetric per-station gates, `offTrack` against local walls, safe-point respawn (P2). |
| R-12 | **Stuck hint vs auto-respawn timing** | stuckSeconds 6 vs hint at 2 s; manual Reset with cooldown. |
| R-13 | **Double steering filtering** makes steering feel sluggish | The pad sends raw steer, the TV shapes once, and the car rate limit is the only rate limit. The owner tunes `STEER_INPUT`/`STEERING` by feel. |
| R-14 | **Merge conflicts, and clean merges that break** (`game.ts`, `config.ts`, `car.ts`; cross-package behaviour such as steering rates vs the autopilot) | The ownership map (§2.2) with non-adjacent anchors. Each package merges `m8/integration` into its own branch and re-runs the gate before handoff; the orchestrator re-runs the gate after every merge and resets the merge (`git reset --hard ORIG_HEAD`) on failure, returning the work to the package. The steering-rate change lives in P1 so P2 tunes against final values. §2.9 checks the merged game end to end. |
| R-15 | **Terrain build time at load** | Station splatting (< 400 ms in Node). If the browser is slow, move field building to a Worker (follow-up) or precompute it in the build script. |
| R-16 | **Draw calls explode** with chunking | Per-chunk merge per material; per-tile instancing; budgets enforced in P5 with the overlay; BatchedMesh (core r186, multi-draw) as a follow-up. |
| R-17 | **Removing the sea exposes the terrain edge** | Treeline ring, fog 0.002, terrain margin 380 m. |
| R-18 | **The production `/api/telemetry` returns 404** because the alias is missing | `API_ROUTES` updated plus a guard test. |
| R-19 | **Telemetry abuse or cost** | Host-key gated, room and global row caps, 90-day retention, no GET, no IP or names stored. |
| R-20 | **Old cached pad bundles fail zod parsing after protocol changes** | Reload pads (hashed assets). Expect it once in testing. |
| R-21 | **Slipstream feels too weak without the push** (D-3) | Raise `SLIPSTREAM.dragCut` towards 0.7. Do not reintroduce a constant push without an owner decision. |
| R-22 | **Banking sign wrong in the generator** | The convention is fixed in §3.2 (+ = right edge higher, so left-handers bank positive) and the committed layout follows it. Unit test on a known right-hander ("the Hollow apex") plus an on-screen check (P2 acceptance screenshot). |
| R-23 | **iOS:** no vibration, no element fullscreen, edge back-swipe | Visual feedback is primary; 24 px plus safe-area inset on the steer zone; the wake lock re-acquire stays. |
| R-24 | **3 laps × 3.36 km is about 5-5.5 min per race** (likely race laps of about 1:39-1:45), possibly long for a party game | Laps come from `overrides.json` (one number). Owner decision; flagged in the P6 report. |
| R-25 | **Parallel packages share 4 cores**, so SwiftShader runs slowly and simulated time lags wall time | Browser runs serialised with `flock`; timing checks poll with generous timeouts or use race-clock time; the race-test lap count is decided on an idle machine (§2.1, P2.11). |
| R-26 | **Telemetry rejected as a whole** (fractional ints, NaN, over 8 samples) | Client sanitiser (round, clamp, NaN → null/0) and chunking, with unit tests (P3.9). |

**Decisions recorded by this spec** (P6 copies them into `DECISIONS.md`):
- **D-1:** Track 1 uses an original layout owned by the project; nothing from Speed Dreams is used or
  shipped (resolved by the owner, 2026-10-10).
- **D-2:** packaging of the track data.
- **D-3:** slipstream is drag-only.
- **D-4:** game modes removed completely (Option A).
- **D-5:** `corniche-run` retired from `TRACK_IDS`; `MIN_LAP_MS` is 45 s.
- **D-6:** no pit lane in M8.
- **D-7:** scratch target plus copy into a shared HDR atlas.
- **D-8:** keep the existing HDRI.
- **D-9:** one post path for every frame: composite into an LDR atlas, then an always-on upscale + RCAS
  pass whose sharpening is a uniform (0 at 1:1), so 1080p and 4K share code and no program compiles
  mid-race.
- **D-10:** controller v2 items stay in M11: the input failsafe stays 600 ms and the handbrake is a
  direct press (no slide from GAS).

---

## Appendix A. Verified facts this spec relies on

**three r186** (`THREE/`):
- `examples/jsm/lights/SunLight.js` exists. It is a `Light` with no target that shines from its
  position towards the origin.
- `SunLightShadow.js` uses 2 fixed cascades (`_cascadeCount = 2`) in a 2×1 atlas. The default
  `mapSize` is 1024 per cascade. The cascade range is `min(shadow.camera.far (default 500), view.far)`
  with practical splits, texel snapping and a 10% fade.
- `updateMatrices(light, viewCamera)` refits the cascades to the **view** camera on every shadow
  render.
- Types exist in `@types/three` 0.186.0 (`examples/jsm/lights/SunLight.d.ts`, `SunLightShadow.d.ts`).
- `WebGLRenderer.compileAsync(scene, camera, targetScene?)` exists (`src/renderers/WebGLRenderer.js:1515`).
- The shadow pass culls casters with `object.layers.test(camera.layers)` using the **view** camera
  (`src/renderers/webgl/WebGLShadowMap.js:522`).
- `setRenderTarget(target)` copies `target.viewport`, `target.scissor` and `target.scissorTest` into
  GL state (`WebGLRenderer.js:2954-2960`, `3040-3042`).
- MSAA resolve blits the whole target (`src/renderers/webgl/WebGLTextures.js:2342`), then invalidates
  the multisampled colour attachment, and depth too when `storeMultisampledDepthBuffer === false`
  (`:2347-2360`).
- `RenderTarget` options `resolveDepthBuffer` and `storeMultisampledDepthBuffer` exist (both default
  true, `src/core/RenderTarget.js:65-68`).
- `examples/jsm/objects/Sky.js` (WebGL) has cloud uniforms (unused in M8).
- `examples/jsm/geometries/LoftGeometry.js` exists. It is not required: P2 lofts its own bands.
- No GLSL CAS/RCAS exists. `examples/jsm/tsl/display/SharpenNode.js` (RCAS, TSL-only) is the
  reference for the math. Its lobe is multiplied by `con = exp2(-sharpness)` (`:199`, `:215-218`), so
  sharpness 2 is 25% strength, not off (its doc comment says "2 = no sharpening"; the math says
  otherwise).
- `Frustum.intersectsObject` computes an `InstancedMesh`'s bounding sphere only when it is null
  (`src/math/Frustum.js:148-152`); `InstancedMesh.computeBoundingSphere` (`src/objects/InstancedMesh.js:151-180`)
  is never re-run automatically after `setMatrixAt`.
- `WebGLRenderer.compile`/`compileAsync` compile only the scene's materials; shadow depth and
  post-processing materials compile on first use.
- `EXT_disjoint_timer_query_webgl2` is used only by the WebGPU WebGL fallback
  (`src/renderers/webgl-fallback/utils/WebGLTimestampQueryPool.js:27`). `WebGLRenderer` issues no
  timer queries.

**Rapier 0.21:**
- `DynamicRayCastVehicleController.wheelGroundObject(i): Collider | null` (`dist/control/ray_cast_vehicle_controller.d.ts:276`).
- `setWheelFrictionSlip(i, v)` (`:212`) and `setWheelSideFrictionStiffness(i, v)` (`:224`).

**Repo:**
- Vite `publicDir: '../assets'` (`client/vite.config.ts`).
- Vitest includes `**/src/**/*.test.ts`.
- ESLint ignores `assets/**`, and `client/scripts/**/*.mjs` gets Node globals with type-checking
  disabled.
- The client tsconfig has `types: ["vite/client"]`, so `node:fs` cannot be imported in `client/src`.
  Use JSON imports in tests.
- `resolveJsonModule` is on. zod 4.6.5 is a client dependency.
- The server reads `PORT`/`HTTPS_PORT`.
- `hub.addLocalPlayer` caps at `MAX_PLAYERS`.
- Player ids match `/^[a-z0-9]{8,24}$/`.
- `pnpm install --offline --frozen-lockfile` works in a fresh worktree.
- Baseline `pnpm check` passes in a clean `git archive HEAD` copy or worktree: 40 tests, 64 s. In
  the main checkout `format:check` fails on the git-excluded `reports/` and `research_notes/` folders
  (listed in `.git/info/exclude`, which Prettier 3 does not read).
- ESLint has no `no-duplicate-imports` rule, so a second `import { ... } from './config';` line is
  legal (P4 uses one in `game.ts`).
- `async` functions without `await` fail `@typescript-eslint/require-await` (in `strictTypeChecked`).
- Vite's types (`vite/dist/node/index.d.ts`) reference Node's, so `client/vite.config.ts` can import
  `node:child_process`; Vitest uses the root `vitest.config.ts`, not the client Vite config.
- `nproc` = 4; `flock` is at `/usr/bin/flock`.
- The loop clamps a frame to 0.1 s and runs at most `PHYSICS.maxStepsPerFrame` (5) steps per frame
  (`SW/loop.ts:35-39`), so simulated time lags wall time below 12 fps.
- `raceSchema.lap`/`totalLaps` are ints ≤ 99 (`shared/src/protocol.ts`), and the pad parses every TV
  message with zod.
- `tsx` 4.23.15 is a root devDependency.

**Network check, 2026-10-10:**
- The Poly Haven API lists `asphalt_track`, `forest_leaves_04`, `sparse_grass`, `leafy_grass`,
  `gravel_stones` and `sandy_gravel` with the 1k file URLs and sizes above.
- The ambientCG API lists `Grass004` and `Gravel022` 1K-JPG zips.

## Appendix B. Removed: Speed Dreams XML rules

The Speed Dreams XML format rules for `sdXml.ts` were dropped with decision D-1 (§4.1). M8 has no
Speed Dreams importer. Layout conventions are in §3.2 (fields, units and signs) and P2.4 step 2 (plan
frame, spirals and axes).

## Appendix C. Kestrel Pines layout and overrides

### C.1 Layout segments (summary of `base.layout.json`)

The committed file is authoritative; this table is derived from it for reading and for the tests.
- `s` is the arc length from the start line (m).
- Headings are in the layout plan frame: degrees, 0 = +x, counter-clockwise positive (P2.4 step 2).
- Spiral lengths follow `L = 2·arc / (1/radiusStart + 1/radiusEnd)`.
- Turn is in degrees (the file stores radians).
- Grade is the mean over the segment.
- Bank is in rad (+ = right edge higher).
- The side columns give the run-off surface, its width in metres (start-end where it changes) and the
  barrier. "K" marks a 1.2 m kerb on that side.
- Every `tangentStart`/`tangentEnd` is `null`.

| # | Segment | Type | Start s (m) | Length (m) | Radius (m) | Turn (°) | Heading at start (°) | z end (m) | Grade | Road (m) | Bank (rad) | Left side | Right side |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | main straight | str | 0 | 275.0 | - | - | 0 | -3.2 | -1.2% | 14 | 0 | asphalt 16, wall | asphalt 14, fence |
| 2 | T1 Millrace entry | L | 275 | 20.3 | 400 to 40 | 16 | 0 | -3.4 | -1.0% | 14 | 0 to +0.04 | grass 16-8, armco K | gravel 14-28, tyres |
| 3 | T1 Millrace apex | L | 295 | 49.6 | 40 | 71 | 16 | -3.5 | -0.2% | 14 | +0.04 | grass 8, armco K | gravel 28, tyres |
| 4 | T1 Millrace exit | L | 345 | 22.2 | 40 to 300 | 18 | 87 | -3.4 | +0.5% | 14 | +0.04 to 0 | grass 8, armco K | gravel 28-20, tyres K |
| 5 | Brook run | str | 367 | 70.0 | - | - | 105 | -3.0 | +0.6% | 13.5 | 0 | grass 8-10, armco | grass 20-10, armco |
| 6 | Sawpit entry | R | 437 | 41.0 | 450 to 125 | 12 | 105 | -2.5 | +1.2% | 13 | 0 to -0.03 | grass 10-16, armco | grass 10-8, armco |
| 7 | Sawpit apex | R | 478 | 43.6 | 125 | 20 | 93 | -2.2 | +0.7% | 13 | -0.03 | grass 16, armco | grass 8, armco K |
| 8 | Sawpit exit | R | 522 | 41.0 | 125 to 450 | 12 | 73 | -1.8 | +1.0% | 13 | -0.03 to 0 | grass 16-14, armco K | grass 8, armco K |
| 9 | esses link | str | 563 | 46.0 | - | - | 61 | -1.2 | +1.3% | 13 | 0 | grass 14-10, armco | grass 8-10, armco |
| 10 | Woodcutter entry | L | 609 | 35.2 | 450 to 130 | 10 | 61 | -0.7 | +1.4% | 13 | 0 to +0.03 | grass 10-8, armco | grass 10-16, armco |
| 11 | Woodcutter apex | L | 644 | 54.5 | 130 | 24 | 71 | 0.1 | +1.5% | 13 | +0.03 | grass 8, armco K | grass 16, armco |
| 12 | Woodcutter exit | L | 698 | 35.2 | 130 to 450 | 10 | 95 | 0.6 | +1.4% | 13 | +0.03 to 0 | grass 8, armco K | grass 16-14, armco K |
| 13 | the Ladder | str | 734 | 280.8 | - | - | 105 | 14.9 | +5.1% | 13 | 0 | grass 8-10, armco | grass 14-10, armco |
| 14 | the Brow crest | L | 1014 | 58.3 | 450 to 180 | 13 | 105 | 15.5 | +1.0% | 13 | 0 to +0.03 | grass 10-8, armco | grass 10-24, armco |
| 15 | the Brow apex | L | 1073 | 75.4 | 180 | 24 | 118 | 15.3 | -0.3% | 13 | +0.03 | grass 8, armco K | grass 24, armco |
| 16 | the Brow exit | L | 1148 | 58.3 | 180 to 450 | 13 | 142 | 15.0 | -0.5% | 13 | +0.03 to 0 | grass 8, armco K | grass 24-18, armco K |
| 17 | Ridge top | str | 1206 | 34.0 | - | - | 155 | 15.1 | +0.3% | 13 | 0 | grass 8-10, armco | grass 18-10, armco |
| 18 | Windhover right in | R | 1240 | 55.5 | 1200 to 340 | 6 | 155 | 15.2 | +0.2% | 13 | 0 | grass 10-12, armco | grass 10-8, armco K |
| 19 | Windhover right out | R | 1296 | 55.5 | 340 to 1200 | 6 | 149 | 15.2 | +0.1% | 13 | 0 | grass 12, armco K | grass 8, armco K |
| 20 | Windhover left in | L | 1351 | 55.5 | 1200 to 340 | 6 | 143 | 15.2 | -0.1% | 13 | 0 | grass 12-8, armco K | grass 8-12, armco |
| 21 | Windhover left out | L | 1407 | 55.5 | 340 to 1200 | 6 | 149 | 15.0 | -0.4% | 13 | 0 | grass 8, armco K | grass 12, armco K |
| 22 | Kestrel approach | str | 1462 | 104.0 | - | - | 155 | 14.3 | -0.7% | 13 | 0 | grass 8-10, armco | grass 12-10, armco |
| 23 | Kestrel entry | L | 1566 | 74.5 | 450 to 140 | 20 | 155 | 13.8 | -0.7% | 13.5 | 0 to +0.05 | grass 10-8, armco | gravel 10-24, tyres |
| 24 | Kestrel tighten | L | 1641 | 111.8 | 140 to 68 | 70 | 175 | 9.9 | -3.5% | 13.5 | +0.05 to +0.1 | grass 8, armco K | gravel 24-28, tyres |
| 25 | Kestrel hold | L | 1753 | 99.7 | 68 | 84 | 245 | 5.4 | -4.5% | 13.5 | +0.1 | grass 8, armco K | gravel 28, tyres |
| 26 | Kestrel exit | L | 1852 | 55.5 | 68 to 240 | 30 | 329 | 3.7 | -3.1% | 13.5 | +0.1 to 0 | grass 8, armco K | gravel 28-20, tyres K |
| 27 | Talon | R | 1908 | 71.2 | 240 | 17 | 359 | 3.0 | -1.0% | 13 | 0 | grass 8-12, armco K | grass 20-8, armco K |
| 28 | Fernside | str | 1979 | 49.0 | - | - | 342 | 2.0 | -2.0% | 13 | 0 | grass 12-10, armco | grass 8-10, armco |
| 29 | the Drop entry | R | 2028 | 29.1 | 400 to 70 | 14 | 342 | 1.6 | -1.4% | 13 | 0 to -0.035 | gravel 10-22, tyres | grass 10-8, armco K |
| 30 | the Drop apex | R | 2057 | 33.0 | 70 | 27 | 328 | 0.8 | -2.4% | 13 | -0.035 | gravel 22, tyres | grass 8, armco K |
| 31 | the Drop exit | R | 2090 | 29.1 | 70 to 400 | 14 | 301 | 0.2 | -2.1% | 13 | -0.035 to 0 | gravel 22-16, tyres K | grass 8, armco K |
| 32 | Fernside dive | str | 2119 | 94.0 | - | - | 287 | -5.2 | -5.7% | 13 | 0 | grass 16-10, armco | grass 8-10, armco |
| 33 | Beck bridge in | L | 2213 | 68.7 | 1500 to 420 | 6 | 287 | -6.5 | -1.9% | 13 | 0 | grass 10-6, armco K | grass 10-6, armco |
| 34 | Beck bridge out | L | 2282 | 68.7 | 420 to 1500 | 6 | 293 | -6.3 | +0.3% | 13.5 | 0 | grass 6, armco K | grass 6-8, armco K |
| 35 | Hollow straight | str | 2351 | 126.3 | - | - | 299 | -5.1 | +1.0% | 14 | 0 | grass 6-10, armco | grass 8-10, armco |
| 36 | the Hollow entry | R | 2477 | 23.6 | 350 to 48 | 16 | 299 | -5.1 | +0.0% | 14 | 0 to -0.04 | gravel 10-26, tyres | grass 10-8, armco K |
| 37 | the Hollow apex | R | 2501 | 31.0 | 48 | 37 | 283 | -4.9 | +0.6% | 14 | -0.04 | gravel 26, tyres | grass 8, armco K |
| 38 | the Hollow exit | R | 2532 | 23.6 | 48 to 350 | 16 | 246 | -4.6 | +1.3% | 14 | -0.04 to 0 | gravel 26-18, tyres K | grass 8, armco K |
| 39 | Meadow run | str | 2555 | 100.0 | - | - | 230 | -4.0 | +0.6% | 14 | 0 | grass 18-10, armco | grass 8-10, armco |
| 40 | Larch kink in | R | 2655 | 52.4 | 1200 to 400 | 5 | 230 | -3.6 | +0.7% | 14 | 0 | grass 10-12, armco | grass 10-8, armco K |
| 41 | Larch kink out | R | 2708 | 52.4 | 400 to 1200 | 5 | 225 | -3.3 | +0.7% | 14 | 0 | grass 12, armco K | grass 8, armco K |
| 42 | back straight | str | 2760 | 265.0 | - | - | 220 | -1.6 | +0.6% | 14 | 0 | grass 12-10, armco | grass 8-10, armco |
| 43 | Switchback entry | L | 3025 | 17.1 | 300 to 30 | 18 | 220 | -1.3 | +1.8% | 14 | 0 to +0.05 | grass 10, armco K | gravel 10-28, tyres |
| 44 | Switchback apex | L | 3042 | 32.5 | 30 | 62 | 238 | -0.7 | +1.8% | 14 | +0.05 | grass 10, armco K | gravel 28, tyres |
| 45 | Switchback exit | L | 3075 | 49.4 | 30 to 110 | 60 | 300 | -0.2 | +1.0% | 14 | +0.05 to 0 | grass 10, armco K | gravel 28-18, tyres K |
| 46 | grid straight | str | 3124 | 235.0 | - | - | 0 | 0.0 | +0.1% | 14 | 0 | asphalt 10-16, wall | asphalt 18-14, fence |

Totals: 46 segments, 3358.9 m, net turn +360.0°, `startZ` 0, z back to 0 at the line.

### C.2 `overrides.json`

The committed file has this content (copied from `LAYOUT/overrides.json`; it has no trailing newline,
and the SHA-256 in §4.3 is the byte-level check):

```json
{
 "format": "splitways-overrides@1",
 "id": "kestrel-pines",
 "name": "Kestrel Pines",
 "laps": 3,
 "checkpointCount": 18,
 "licence": "Proprietary - (C) 2026 Gamer Gang project. All rights reserved.",
 "credits": [
  "Original layout by the Gamer Gang project, 2026"
 ],
 "closure": {
  "straights": [
   "the Ladder",
   "back straight"
  ],
  "arc": "the Drop apex"
 }
}
```

### C.3 Targets after closure

These match the `generate.test.ts` ranges (P2.11) and the `pnpm assets:track` printout (P2.3).

| Quantity | Expected | Test range or check |
|---|---|---|
| Segments | 46 | printout |
| Horizontal length | 3358.9 m | 3350-3370 m; printout within ±0.5 m |
| Net turn | +360° (counter-clockwise) | printout |
| Plan closure gap before closure | about 0.0 m | < 0.05 m; the closure changes to "the Ladder" and "back straight" (and to the arc of "the Drop apex") are rounding-sized |
| Minimum layout radius | 30 m ("Switchback apex"), then 40 m (T1) | `track.minimumRadius()` 28-45 m |
| Heading continuity | per station at most 1/30 rad (the R30 apex) | max \|Δh\| < 1.5 × spacing / 30 (about 0.05 rad); \|Δh\| < 1e-3 at the seam |
| Separate legs (> 500 m apart along the lap) | 122.1 m (s ≈ 1454 against 2048) | ≥ 115 m |
| Straight behind the start line | 235 m ("grid straight") | \|curvature\| < 1e-3 over the last 230 m |
| Elevation range | 22.1 m (-6.5 to +15.5 m in the file) | 20-24 m |
| Crest curvature | about 1.07 / 416 before smoothing (within the 10% tolerance) | ≤ 1.1 / 416 |
| Corridor warnings | none (the largest inside wall is 0.67 of the 0.9 / \|curvature\| limit, at the Switchback apex) | `validateCorridor()` returns `[]` |
| Checkpoints, laps | 18, 3 | 18 checkpoints |
