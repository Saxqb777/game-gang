# Cars update build spec: five debranded cars, car select with paint, per-car handling

Written 2026-10-12 against `m8/integration` at `c5b9911` (worktree `/home/user/m8-wt/int`, the merged M8
code without P5 dressing). The cars update starts only after M8 is finished on `m8/integration` (P5 and
P6 merged, M8 §2.9 passed). Line numbers marked `@c5b9911` drift after that, so always find code by the
function or member name given next to the line number.

This update pulls the "new car models with fictional brands, paint" part of M12 forward. The rest of
M12 (liveries and sponsors, class kits, chase-cam rewrite) stays in M12.

**Path shorthands used everywhere below**

| Shorthand | Path |
|---|---|
| `SW/` | `client/src/games/splitways/` |
| `PAD/` | `client/src/pad/` |
| `SCR/` | `/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad` |
| `KIT/` | `SCR/carkit` (the five converted, not yet debranded cars, their previews, `tools/` and `LINEUP.md`; read-only) |
| `V2/` | `SCR/cars-v2` (the debranded cars, produced in parallel by the art track; read-only; does not exist yet on 2026-10-12) |
| `THREE/` | `node_modules/.pnpm/three@0.186.1/node_modules/three/` |
| `E2E/` | `/tmp/claude-0/e2e` (reference Playwright scripts, not part of the repo) |

---

## 0. Rules for every implementation agent

1. **Never push and never deploy.** No `git push`, no `vercel`, no Vercel or Neon MCP writes. Commit locally
   on your own package branch only (§2.1), with the attribution lines your own session gives you.
2. **No new npm dependencies** (runtime or dev). `pnpm-lock.yaml` must not change. In a new worktree,
   `pnpm install --offline --frozen-lockfile` works. Everything this spec needs ships inside `three`
   0.186.1 (GLTFLoader, GLTFExporter, `libs/meshopt_simplifier.module.js`, `libs/fflate.module.js`) or is
   a system tool already on the machine (ImageMagick `convert` with WebP, Appendix A).
3. **Never copy `.env` into a worktree.** Without `DATABASE_URL` the local server uses in-memory PGlite.
4. **M14 (subscriptions) is on hold.** Do not add, plan, stub or document billing work.
5. **Code style** as in M8 §0.5: TypeScript strict, typescript-eslint `strictTypeChecked`, Prettier
   (printWidth 100, single quotes, trailing commas), comments that say why. Every tunable number goes in
   `SW/config.ts` with a one-line comment. `SW/config.ts` keeps **zero imports** (the pad bundle imports
   it). `shared/src/*` stays dependency-free apart from `zod`.
6. **Node-safe layers stay Node-safe** (`SW/track/**`, `SW/sim/**`, `SW/race/**`, `SW/input/**`,
   `SW/debug/autopilot.ts`, `shared/src/**`): three.js maths classes only, no DOM, canvas or WebGL.
7. **Downloads are untrusted.** Never execute anything from `SCR/dl-cars/` or any download folder. Run
   Python with `-I`, keep your scripts outside download folders, and pass data paths as arguments.
   `KIT/` and `V2/` hold our own converted models: parse them as data (GLB JSON and binary chunks), never
   run tools from inside them. The `KIT/*/tools/*.mjs` scripts are reference reading only.
8. **Fictional brands only.** No real car make, model, logo, plate design, tyre brand or sponsor in code,
   comments, tests, test data, UI text, file names, GLB node, mesh, material or image names, or
   metadata. The only place the original model titles and authors may appear in code is
   `shared/src/carCredits.ts` (CC BY attribution, §3.2); docs (`README.md`, `LICENCES.md`,
   `assets/ASSETS.md`) carry them too. The gate greps for real brand words (§2.1), case-insensitive and
   word-bounded, so never write them anywhere else, not even to say what was removed. The word list
   itself lives in `client/scripts/debrand-words.json`, outside the grepped folders.
9. **No real circuit names, and never "Forza"** (as in M8).
10. **Stay inside your package.** Edit only the files and regions your package owns (§2.2). Report bugs
    elsewhere; do not fix them.
11. **Never work in the main checkout** `/home/user/game-gang` or in any `/home/user/m8-wt/*` worktree.
    Use the worktrees of §2.1.
12. **Finish line for every package:** the cars gate (§2.1) green in your worktree, the package
    acceptance done, the pre-handoff merge of `cars/integration` done and re-checked, local commits on
    the package branch, and a short report (what was done, test results, screenshot paths, open issues).

---

## 1. Goal and done criteria

### 1.1 Goal
Replace the single CC0 placeholder car with **five debranded cars under invented makes**, chosen per
player on the phone, painted in the player's colour, each with a light handling character, all within
about 1.5% of each other's lap time on Kestrel Pines, and still a locked 60 fps with four different cars
in four viewports on the MacBook Air M1.

| Id | Make and model | Body, drive | Source model (licence) |
|---|---|---|---|
| `nightjar` | Dashwood Nightjar | GT coupe, RWD (front-mid engine). Default car | "Generic Sport Coupé Car" by MMC Works (CC BY 4.0) |
| `scree` | Mudlark Scree | Rally coupe, AWD | "Ariel_350-V2" by orcha (CC BY 4.0) |
| `haymaker` | Brazen Haymaker | Muscle restomod, RWD | "Muscle Car Concept" by ViktorKom (CC BY 4.0) |
| `zanna` | Briganti Zanna | Supercar, RWD (mid engine) | "Fictional supercar - V12 Goblin" by Olli Teittinen (CC BY 4.0) |
| `sagitta` | Arvanta Sagitta | Electric hypercar concept, AWD | "FREE Concept Car 039" by unityfan777 (CC0 dedication; see R-C3) |

Names, taglines and the per-car rework lists come from `KIT/LINEUP.md` §3 (owner-approved line-up plan).
The picker order is the table order: Nightjar first (the recommended default for new players).

### 1.2 Scope (owner decisions applied)
- **Cars as runtime assets.** A repo script (`pnpm assets:cars`) turns each debranded car from `V2/` into
  one runtime GLB with three levels of detail and a shadow stand-in (§3.9), plus pre-rendered phone
  thumbnails (§3.13). The game loads only the cars that are in the race.
- **Car select replaces colour select** on the phone join screen and in the lobby (through "Change car",
  which reopens the join screen as today's "Change name / colour" does). The phone shows a 3D-free car
  card: a pre-rendered thumbnail in the chosen paint, make and model, body and drive, five stat bars and
  the CC BY credit line.
- **Paint.** The eight player colours become the eight paints (decision D-C1). Players may pick the same
  car, never the same paint. The paint colour stays the player's identity colour in the HUD, minimap,
  name tag, TV lobby, results and pad accent, exactly as today.
- **Per-car handling** as small data-driven differences on top of the M8 reference car: mass, power
  (peak force and the shape of its fall-off), top speed, front/rear grip, drive split, brakes, downforce
  and inertia, plus each car's real wheel positions, wheel radii and body size. Pure skill: no items, no
  boosts, no class kits.
- **Balance.** Every car's flying-lap time on Kestrel Pines, driven by the debug autopilot at each car's
  own limits, is within 1.5% of the fastest car (tuning target 1.0%), checked by a unit test.
- **Credits.** CC BY attribution for every car: a TV credits screen, a `/credits` page, the credit line
  on the phone car card, `README.md`, `LICENCES.md` and `assets/ASSETS.md`.
- **Reconnect.** A pad that reconnects or reloads (auto-rejoin) keeps its car and paint, in the lobby and
  mid-race. The TV is the source of truth.

**Out of scope** (do not start): liveries and sponsor decals (`LINEUP.md` §4), class kits and PR classes
(`LINEUP.md` §2), per-car engine sounds (M11 engine audio), the hot hatch and open-wheel gaps, a garage
or tuning screen, per-car lap records or leaderboards (no API or DB change), KTX2, Draco or meshopt
compression (M9), the chase-cam rewrite (M12), AI opponents, new tracks.

### 1.3 Done criteria (all must hold)
1. **Five shipped cars.** `assets/cars/<id>/<id>.glb` exists for all five ids, built from `V2/` by
   `pnpm assets:cars`, and passes the asset validator (§5.1, `SW/cars/assets.test.ts`). The placeholder
   car `assets/models/sports-car.glb`, its `assets:car` script and the placeholder builds are gone.
2. **Debranded.** For every car, every "must do" item of `LINEUP.md` §3 "Rework, legal" and every
   "Rework, distinctiveness" item is present in the rendered close-up sheet (§4.6), checked by C2b and
   signed off by the owner. The gate's brand grep and the validator's metadata scan are clean.
3. **Car select and paint** work on the phone join screen and through "Change car" in the lobby, in
   landscape (844×390) and portrait (390×844). Same car allowed, same paint refused (a taken paint is
   disabled on the phone and refused by the TV).
4. **Reconnect keeps car and paint**: unit tests (§5.1) and the integration acceptance (§2.11 steps 4-5).
5. **Balance:** `SW/race/balance.test.ts` passes: all five cars finish two solo laps with no respawn, and
   (slowest flying lap − fastest) / fastest ≤ 1.5%. C7's final table is at or under 1.0%.
6. **Performance on the reference device** (owner, §5.5): M8 done criteria 1 and 2 still hold with four
   different cars on track (4 players on Low, 2 on Medium, 1 on High; the 30-minute soak with four
   different bot cars), and the per-frame car budgets of §4.4 hold in the overlay.
7. **Credits:** the TV credits screen (key C in the lobby), `/credits`, the phone car card, `README.md`
   (Credits section), `LICENCES.md` (car models section) and `assets/ASSETS.md` (one row per shipped car
   file) carry the attribution of §4.5; `client/src/credits/credits.test.ts` and the asset validator
   prove they agree.
8. **Repo checks:** the cars gate (§2.1) passes, `pnpm build:vercel` succeeds and
   `.vercel/output/static/cars/<id>/<id>.glb` plus the 40 thumbnails are present.
9. **Nothing else regresses:** lap records post and show on `kestrel-pines`, mixed controllers, the
   play-again vote and the M8 benchmark modes still work (§2.11).

### 1.4 Decisions recorded by this spec (C6 copies them into `DECISIONS.md`)
- **D-C1 Paint = identity colour.** The paint list is the eight `PLAYER_COLOURS`. `colour: ColourId`
  stays on the wire and in the hub with its uniqueness rule; it now means "paint", and its UI hex stays
  the identity colour for HUD, minimap, name tag and lobby. Each colour gets a car-paint finish (deeper
  tone, metalness, roughness, clearcoat) in `SW/config.ts` `PAINTS`. Alternative (not chosen, open
  question Q1): free paints including white, black and silver, plus a separate auto-assigned identity
  colour.
- **D-C2 One class.** All five cars race in one field with equal lap times (±1.5% max, 1.0% target).
  `LINEUP.md`'s fictional spec sheets (kW, 0-100, PR classes) are not shown or modelled.
- **D-C3 Reference car.** The M8 car blocks (`CAR`, `WHEELS`, `TYRES`, `ENGINE`, `BRAKES`) stay as the
  reference car: the track generator plans Kestrel Pines' speed profile and tyre walls with it, so the
  generated track does not change. Every real car is the reference plus the per-car values in `CARS`.
- **D-C4 Geometry in config, checked against the model.** Wheel hubs, radii and body size per car live
  in `CARS.<id>.geometry` (physics reads them); the validator checks the GLB's wheel nodes against them
  (±5 mm).
- **D-C5 Own LOD switching.** Three levels per car, chosen per viewport by projected size with
  hysteresis, with a per-preset floor (Low never draws LOD0). No `THREE.LOD`.
- **D-C6 Asset format.** GLB with JPEG/PNG textures, no compression extensions, one file per car with all
  LODs. KTX2 stays an M9 item.
- **D-C7 Thumbnails.** Pre-rendered WebP per car and paint (5 × 8), rendered by a dev-only studio page
  with the game's own car and paint code, so the phone never loads three.js.
- **D-C8 Credits source.** `shared/src/carCredits.ts` is the one code source of car attribution.
- **D-C9 Real size.** Cars keep their real-world size; physics supports per-car wheel radius and
  wheelbase, so `LINEUP.md`'s "scale the Nightjar ×0.935" note is not applied.
- **D-C10 Keyboard and bot players** get cars in the fixed order `nightjar, scree, haymaker, zanna`
  (by local player index), so a `?bots=1` soak runs four different cars.

---

## 2. Work packages

### 2.1 Order, branches, worktrees, ports, merging, gate

```
                     C1 Foundation (alone)
                            |
     +----------------+-----+-----------+------------------+
     |                |                 |                  |
C2a Asset pipeline  C3 Handling   C4 Car select      C6 Credits and docs
 + placeholders     and balance   (pad, TV lobby)     (code part)
     |                |                 |                  |
C5 TV car visuals     |                 |                  |
 (needs C2a)          |                 |                  |
     |                |                 |                  |
C2b Real cars (needs C5 and the V2/ delivery)              |
     |                |                 |                  |
     +-------+--------+                 |                  |
             |                          |                  |
   C7 Balance and performance pass (needs C2b, C3, C5)     |
             |                          |                  |
             +------------+-------------+------------------+
                          |
        §2.11 Integration acceptance (orchestrator)
                          |
                C6 finish: docs review (last)
```

**Base.** The orchestrator creates the integration branch from the final M8 integration commit (after
P5 and P6 are merged and M8 §2.9 passed), never from `c5b9911` if M8 has moved on:
```
git -C /home/user/game-gang worktree add -b cars/integration /home/user/cars-wt/int m8/integration
cd /home/user/cars-wt/int && pnpm install --offline --frozen-lockfile
```
Each package worktree is created from `cars/integration` when the package starts, for example
`git -C /home/user/cars-wt/int worktree add -b cars/c3-handling /home/user/cars-wt/c3 cars/integration`.

| Worktree | Branch | Ports (HTTP / HTTPS) | Used by |
|---|---|---|---|
| `/home/user/cars-wt/int` | `cars/integration` | 5000 / 5443 | Orchestrator: merges, gate, §2.11 |
| `/home/user/cars-wt/c1` | `cars/c1-foundation` | 5000 / 5443 | C1 (alone, before the orchestrator needs the ports) |
| `/home/user/cars-wt/c2` | `cars/c2-assets` | 5100 / 5543 | C2a, then C2b on the same branch |
| `/home/user/cars-wt/c3` | `cars/c3-handling` | 5200 / 5643 | C3 |
| `/home/user/cars-wt/c4` | `cars/c4-select` | 5300 / 5743 | C4 |
| `/home/user/cars-wt/c5` | `cars/c5-visuals` | 5400 / 5843 | C5 |
| `/home/user/cars-wt/c6` | `cars/c6-credits` | 5500 / 5943 | C6 |
| `/home/user/cars-wt/c7` | `cars/c7-balance` | 5600 / 6043 | C7 |

Start and stop only your own server, as in M8 §2.1:
```
cd /home/user/cars-wt/cN && PORT=<http> HTTPS_PORT=<https> nohup pnpm dev > /tmp/claude-0/dev-cN.log 2>&1 & echo $! > /tmp/claude-0/dev-cN.pid
kill $(cat /tmp/claude-0/dev-cN.pid)
```
Never use `/tmp/claude-0/devctl.sh`. M8's ports 4000-4843 may still be in use by M8 agents.

**C2b waits for `V2/`.** C2b starts when `V2/` holds all five cars (or the owner says to ship a subset,
Q7). Until then the game runs on the placeholder builds from C2a, which are CC0 and never ship in a
release (done criterion 1).

**The cars gate** (the orchestrator saves it once as `/tmp/claude-0/cars-gate.sh`; run in a worktree
root):
```sh
set -e
pnpm check
pnpm build
fail=0
grep -rniE 'tilt|gyro|deviceorientation|requestPermission' client/src server/src shared/src && fail=1
grep -rnE "ITEM_|ItemKind|itemIcons|ItemVisuals|requestUse|spinOut|mystery|nitro|BOOSTS|placeBoostPads|driftLevel|GAME_MODES|GameMode\b" client/src shared/src server/src && fail=1
grep -rni corniche client/src shared/src server/src && fail=1
grep -rniE '\b(goblin|ariel|strix|supra|bmw|michelin|bridgestone|potenza|brembo|streamside|pagani|zonda|lamborghini|koenigsegg|ferrari|porsche|ford|capri|mustang|challenger|cuda|mopar|corvette|aston|jaguar|toyota|nissan|datsun|celica|renault|bbs|gti|carplay|spotify|forza)\b' client/src shared/src server/src --exclude=carCredits.ts && fail=1
[ "$fail" = 0 ] || { echo "Cars gate: forbidden words found (listed above)"; exit 1; }
echo "Cars gate: PASS"
```
The grep was run against `c5b9911` and finds nothing today (it would hit "Apple" in an existing
telemetry test and a CSS font stack, which is why "apple" is only in the validator's GLB scan, not in
the code grep). C2, C6 and C7 also run `pnpm build:vercel`.

**Merging** works exactly as M8 §2.1 "Merging": a pre-handoff `git merge cars/integration` in the
package worktree plus the gate and one smoke browser check; the orchestrator merges with
`git merge --no-ff`, runs the gate, and on failure resets (`git reset --hard ORIG_HEAD`) and sends the
work back. The orchestrator never fixes package code. Nobody merges into `claude/gracious-bell-2pgra5`.

**Playwright** as M8 §2.1: copy scripts from `E2E/` into `/tmp/claude-0/e2e-cN/`, change the ports,
launch Chromium from `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with
`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, pads with
`isMobile: true, hasTouch: true, ignoreHTTPSErrors: true` on the HTTPS port, and every run under the
shared lock `flock /tmp/claude-0/cars-browser.lock node /tmp/claude-0/e2e-cN/<script>.cjs`. Poll with
generous timeouts. Never add Playwright to the repo.

### 2.2 Shared-file ownership map

Each package touches only the regions listed. Insert new code at the stated anchor; do not reformat or
reorder code outside your regions. If an anchor is missing, stop and report.

#### `SW/game.ts`

| Package | May edit |
|---|---|
| C1 | `interface GamePlayer` (add `car: CarId` directly after `colour: ColourId;`), `interface RaceResult` (same), the `@gamergang/shared` import block, the `CarModelLibrary.load()` line in `create()`, the `models.create(...)` line in the constructor's drivers map, and the `results` and `entries` maps in `showPodium()`. |
| C3 | The `track.gridSpawns(...).map(...)` line in the constructor (cars get their spec); `interface Driver`: one field `speeds: Float32Array;` directly after `steerFilter: SteerProcessor;`, and the matching property directly after `steerFilter: new SteerProcessor(),`; in `step()`, only the `autopilot(...)` call. New imports directly after `import { autopilot } from './debug/autopilot';`. |
| C5 | Imports inside the `./scene/*` block and the `./render/quality` block; `create()` lines after C1's change that load the models; in the constructor, the statements that create `visual`, `tag`, `camera:` and the `hud:` property (framing and tag height only; the HUD colour stays); `prepare()` and `applyPreset()` lines around `renderer.precompile(...)`; in `renderRace()`, new LOD-selection statements directly before each `this.renderer.renderView(` call (the per-driver one and the overview one); `showPodium()`'s `new Podium(...)` line; `dispose()` model lines; `onKey` (debug key V); `paintDebug()`. |
| C7 | Nothing (values only, in `SW/config.ts`). |

#### `SW/config.ts`

| Package | May edit |
|---|---|
| C1 | Insert `CARS` and `PAINTS` (§3.6, §4.2, §4.3) immediately **before** `export const ASSISTS = {`. Doc comments of `CAR`, `WHEELS`, `TYRES`, `ENGINE`, `BRAKES`: add "Reference car (D-C3)" wording only; no value changes. |
| C3 | Handling fields inside `CARS` entries (never `geometry`). Insert `CAR_DERIVE` (§3.6) immediately **before** `export const ASSISTS = {` (that is, after C1's `PAINTS`). |
| C5 | `PRESETS`: add `carLodFloor` to each preset (last key of each). Insert `CAR_LOD` (§3.12) immediately **before** `export const BENCH = {`. `CAMERA`: add the framing keys of §3.11 as the last keys. Values inside `PAINTS`. |
| C2b | `geometry` inside `CARS` entries (measured values, §3.10). |
| C7 | Values only: `CARS` handling fields, `CAR_LOD`, `PAINTS`, `CAR_DERIVE`. |

#### Other shared files

| File | Owners and regions |
|---|---|
| `shared/src/cars.ts`, `shared/src/carCredits.ts` (new) | **C1** creates both. **C3** and **C7** may edit `CAR_INFO.*.stats` values only. **C6** may edit `carCredits.ts` wording after re-verifying licences (§4.5). |
| `shared/src/protocol.ts`, `shared/src/index.ts` | **C1** only. |
| `client/src/hub/hub.ts`, `hub.test.ts` | **C1** only (car field, rules, local player cars, tests). |
| `SW/sim/car.ts`, `SW/sim/simulation.ts`, `SW/sim/carSpec.ts` (new) | **C1** creates `carSpec.ts` (types, `REFERENCE_SPEC`, `resolveCarSpec` returning the reference for every id). **C3** owns all three afterwards. |
| `SW/track/gen/racingLine.ts`, `SW/track/gen/generate.ts`, `SW/track/track.ts` | **C3**: the `speedProfile` extraction and `lineCurvature` (§3.8). Nothing else changes. |
| `SW/debug/autopilot.ts` | **C3**. |
| `SW/scene/carVisual.ts`, `SW/scene/podium.ts` | **C1** reshapes the API only (§3.11, loading the old model for every id). **C5** rewrites them. |
| `SW/scene/nameTag.ts`, `SW/render/chaseCamera.ts`, `SW/scene/blobShadows.ts` (from M8 P5), `SW/render/quality.ts`, `SW/render/quality.test.ts`, `SW/debug/debugOverlay.ts` | **C5**. |
| `SW/tv/SplitWaysStage.tsx` | **C1** (players map adds `car`), then **C5** (results list shows the car name). |
| `PAD/**`, `client/src/tv/Lobby.tsx`, `client/src/tv/tv.css` | **C4**. |
| `client/src/tv/TvApp.tsx`, `client/src/main.tsx`, `client/src/landing/**`, `client/src/credits/**` (new) | **C6**. |
| `client/scripts/build-cars.mjs`, `client/scripts/cars/**` (new), `client/scripts/debrand-words.json` (new), `assets/cars/**`, `SW/cars/assets.test.ts` (new), `client/src/tools/thumbs/**` (new, dev-only route registered by C2 in `client/src/main.tsx` through one line, see C2a.6) | **C2**. |
| `package.json` (root) | **C2** replaces `"assets:car"` with `"assets:cars"` (C2a adds `assets:cars` directly after `assets:car`; C2b deletes `assets:car`). |
| `assets/ASSETS.md` | **C2** (car rows; C2b removes the sports car row), then **C6** (final review). |
| `LICENCES.md`, `README.md`, `DECISIONS.md`, `ROADMAP.md`, `PROGRESS.md` | **C6** only. |

`client/src/main.tsx` is shared by C2 (one dev-only route line) and C6 (the `/credits` route): C2 inserts
its line directly after `if (path === '/pad') return <PadApp />;`, C6 inserts directly **before**
`if (path === '/tv') return <TvApp />;`. The two anchors are two lines apart, so they merge cleanly.

---

### 2.3 C1: Foundation (first, alone)

**Purpose.** Add the car id to every place a player travels (wire, hub, game), the per-car config and
spec types, and the visual API shape, while the game still looks and drives exactly as M8 (every car is
the reference car with the old model). After C1, C2a, C3, C4 and C6 run in parallel.

**Files.** Create `shared/src/cars.ts`, `shared/src/carCredits.ts`, `shared/src/cars.test.ts`,
`SW/sim/carSpec.ts`, `SW/sim/carSpec.test.ts`. Edit `shared/src/protocol.ts`, `shared/src/index.ts`,
`client/src/hub/hub.ts`, `client/src/hub/hub.test.ts`, `SW/config.ts`, `SW/game.ts` (C1 regions),
`SW/scene/carVisual.ts`, `SW/scene/podium.ts`, `SW/tv/SplitWaysStage.tsx`, and the pad files only as far
as needed to compile (`PAD/padStore.ts`: pass the TV's `car` through untouched; no UI).

**Tasks.**
- **C1.1 Catalogue.** `shared/src/cars.ts` exactly as §3.1, and `shared/src/carCredits.ts` exactly as
  §3.2 (texts from §4.5). Export both from `shared/src/index.ts`. `shared/src/cars.test.ts`: ids unique,
  `CAR_INFO` and `CAR_CREDITS` have exactly the ids of `CAR_IDS`, stats are integers 1..10,
  `DEFAULT_CAR_ID` and every `LOCAL_CAR_ORDER` entry are valid ids, the five makes and models match
  §1.1.
- **C1.2 Protocol** (§3.3): `car` on `join` (optional), `joined`, `lobbyPlayerSchema` and
  `standingSchema`. Update the `joinSchema` doc comment (it already says the TV "keeps that player's
  name, colour and car").
- **C1.3 Hub** (§3.4) with tests: a new phone seat takes `message.car ?? DEFAULT_CAR_ID`; a lobby edit
  may change the car; `rejoin` and a car in the race keep the TV's car; `joined` and the lobby message
  carry `car`; `addLocalPlayer` assigns `LOCAL_CAR_ORDER[localIndex % 5]` where `localIndex` counts the
  local players already seated. Extend the existing test "gives a pad that reloads mid-race its own
  seat, car and colour back" to assert `car`, and add: "keeps the car of a pad that reloads in the
  lobby", "ignores a different car in a rejoin", "gives a join without a car (an old pad) the default
  car", "lets a lobby edit change the car but never mid-race", "lets two seats share a car but not a
  paint", "gives keyboard players and bots the fixed car order".
- **C1.4 Config.** Insert `CARS` with the geometry targets of §4.1 and the starting handling values of
  §4.2, and `PAINTS` with §4.3, at the C1 anchor. Add a Node test in `SW/sim/carSpec.test.ts` that
  `Object.keys(CARS)` equals `CAR_IDS` and `Object.keys(PAINTS)` equals the `PLAYER_COLOURS` ids (both in
  order).
- **C1.5 `SW/sim/carSpec.ts`** with the types of §3.6, `REFERENCE_SPEC` built from the M8 blocks (exact
  current numbers, including `WHEELS.centreHeight` 0.32 and the symmetric wheelbase), and
  `resolveCarSpec(id)` that returns `REFERENCE_SPEC` for every id in C1 (C3 replaces the body). Test:
  every field of `REFERENCE_SPEC` equals the M8 constant it comes from.
- **C1.6 Game plumbing.** `GamePlayer.car`, `RaceResult.car`; `SplitWaysStage` passes `car`;
  `showPodium()` fills `car` in results; `broadcast({ type: 'results' })` carries it (standing schema).
- **C1.7 Visual API shape** (§3.11): `CarModelLibrary.load(carIds)` and `create(carId, paint)`, still
  loading `/models/sports-car.glb` once and using it for every id with today's material remap;
  `PodiumEntry` becomes `{ place, car, paint }`.

**Acceptance.** Gate green. Browser (ports 5000/5443): TV plus one pad join and race as in M8; the pad's
`lobby` messages carry `car: 'nightjar'` (log them from the pad console); the race looks and drives as
before; no `pageerror`.

---

### 2.4 C2a: Asset pipeline and placeholder cars (after C1)

**Purpose.** A reproducible packager from a debranded source GLB to the runtime GLB of §3.9, a validator
test, the thumbnail studio, and **placeholder** runtime GLBs for all five ids so C3, C4 and C5 can work
before `V2/` lands.

**Files.** Create `client/scripts/build-cars.mjs`, `client/scripts/cars/*.mjs` (helpers: GLB read/write,
classify, merge, simplify, atlas, images), `client/scripts/debrand-words.json`, `assets/cars/<id>/<id>.glb`
(placeholders), `assets/cars/<id>/thumb-<colour>.webp` (placeholders), `assets/cars/thumbs.json`,
`SW/cars/assets.test.ts`, `client/src/tools/thumbs/ThumbStudio.tsx` and `thumbs.css`. Edit `package.json`
(script), `client/src/main.tsx` (one line), `assets/ASSETS.md` (placeholder rows).

**Tasks.**
- **C2a.1 Packager CLI.** `pnpm assets:cars <V2 folder> [--only <id>] [--check] [--placeholder]`:
  - Reads the five source GLBs through the folder map of §3.10 and writes `assets/cars/<id>/<id>.glb`.
  - `--check` rebuilds in memory and fails if the result differs from the committed file, or if any
    budget of §4.4 is broken. It prints the per-car report (tris and draws per LOD, file size, texture
    sizes, measured hub positions and radii next to `CARS.<id>.geometry`).
  - Node only, using `three` (GLTFLoader with images stripped from the JSON before parsing,
    GLTFExporter, `BufferGeometryUtils`, `MeshoptSimplifier` from `three/examples/jsm/libs/meshopt_simplifier.module.js`)
    and ImageMagick `convert` called with `execFileSync` for every image decode, resize and encode. It
    checks for `convert` with WebP and JPEG support first and fails with an install hint
    ("brew install imagemagick" on macOS).
  - Images are injected after export, as `KIT/*/tools/inject.mjs` does (read it as reference).
  - **Deterministic**: same input and config, byte-identical output (fixed simplifier options, sorted
    names, no timestamps). The input file's SHA-256 goes into `asset.extras.sourceSha256`.
- **C2a.2 Pipeline steps** (the contract is §3.9, the input rules §3.10):
  1. Parse, check axes (front wheels at +Z, left wheels at +X, ground near y = 0), find the hub centres
     (wheel node origin, or the bounding-box centre of its meshes when the origin is off by more than 2
     mm), re-centre to the axle midpoint and the ground.
  2. Classify meshes: under `wheel_xx` → that wheel (spins); `caliper_xx` or `brake_xx` → that corner's
     caliper (front: steers, rear: merged into the body); everything else → body. Map every material
     name through the vocabulary of §3.10; an unknown name fails with the list of unknown names.
  3. **LOD0**: merge per (group, material). If the body is over the LOD0 budget, simplify the hidden
     classes first (`interior`, `chassis`, `engine`), then the rest
     (`MeshoptSimplifier.simplifyWithAttributes` with normal and UV weights, border lock on). LOD0
     images are capped at 2048 px.
  4. **Kit atlas** for LOD1: every textured LOD0 material except `paint` and `glass` packs into one
     1024² atlas (base colour, ORM, normal, emissive; missing maps become neutral cells); factor-only
     materials become 8×8 px solid cells in the same atlas with their factors baked in. Source UVs must
     lie in [-0.01, 1.01] per material (else fail and name the material: the art track must fix tiling
     UVs). Cell area is proportional to the material's surface area, at least 32×32 px.
  5. **LOD1** = simplified meshes remapped into the kit: body meshes `paint`, `kit`, `glass`,
     `light_tail`; wheels one `kit` mesh each; calipers dropped; budgets of §4.4.
  6. **LOD2** = `paint` plus `palette` (a 64×64 PNG with one averaged colour per source material),
     wheels baked in at rest, simplified to the LOD2 budget.
  7. **Shadow** = LOD2 positions only, simplified to ≤ 2,500 triangles, material `shadow`.
  8. Write the GLB with the node and material names of §3.9 and `asset.copyright` set to the credit line
     of §4.5.
- **C2a.3 Placeholder mode.** `--placeholder` builds all five ids from `assets/models/sports-car.glb`
  (CC0): the body scaled per axis to `CARS.<id>.geometry` length, width and height, the wheels placed at
  the config hubs and scaled to the config radii, materials named per §3.9 (factor-only), all three LODs
  and the shadow mesh. The asset validator accepts placeholders (`asset.extras.placeholder: true`)
  except in C2b and later, where the test fails if any placeholder remains.
- **C2a.4 Validator** `SW/cars/assets.test.ts` (Node, reads files with `node:fs`, parses the GLB JSON
  chunk itself, no WebGL): for each id, the file exists; root and node names per §3.9; every wheel node's
  translation matches `CARS.<id>.geometry` within 5 mm and every wheel's radius within 3 mm (from its
  LOD0 mesh bounds); triangles and mesh counts per LOD within §4.4; material names in the allowed set;
  images are `image/jpeg` or `image/png` and none is larger than 2048 px; file size within §4.4;
  `asset.copyright` equals the credit line from `CAR_CREDITS` (placeholders: the CC0 sports car credit
  from `assets/ASSETS.md`); once no placeholder remains, `assets/ASSETS.md` has a row naming each car
  file and its author; the JSON with `asset` removed matches no
  word in `client/scripts/debrand-words.json` (word-bounded, case-insensitive; the list adds `apple`,
  `amazon`, `google`, `deviantart`, `empire state`, `new york` and the source authors' handles to the
  gate's list); eight thumbnails exist per car, each ≤ 40 KB; `thumbs.json[id].glbSha256` equals the
  GLB's SHA-256 (so a rebuilt GLB without fresh thumbnails fails).
- **C2a.5 Thumbnail studio** (dev only). `client/src/tools/thumbs/ThumbStudio.tsx` at `/tools/thumbs`,
  registered only when `import.meta.env.DEV`. It loads every car with the game's own `CarModelLibrary`
  and paint code, renders each car in each paint (512×288, transparent background, a fixed 3/4 front
  camera, the game's HDRI as environment, LOD0) and offers one "Download all" button that zips the 40
  WebP files plus `thumbs.json` with `fflate` (from `three/examples/jsm/libs/fflate.module.js`, no new
  dependency) via `canvas.toBlob('image/webp', 0.82)`. `pnpm assets:cars --thumbs <zip>` unpacks and
  checks it into `assets/cars/`. Agents drive the button with Playwright (SwiftShader renders it
  correctly); a person can use any desktop Chrome. Until C5 merges, the studio renders through C1's
  interim library, so the C2a thumbnails are placeholders too; C2b re-renders them with C5's code.
- **C2a.6 Route line** in `client/src/main.tsx` directly after `if (path === '/pad') return <PadApp />;`:
  `if (import.meta.env.DEV && path === '/tools/thumbs') return <ThumbStudio />;` with a lazy import, so
  production bundles drop it (check `pnpm build` output has no `ThumbStudio` chunk).
- **C2a.7 Docs rows.** `assets/ASSETS.md`: one row "`assets/cars/*` (placeholders)", derived from the
  CC0 sports car, made by this project, CC0.

**Acceptance.** Gate and `pnpm build:vercel` green; `.vercel/output/static/cars/nightjar/nightjar.glb`
present; `pnpm assets:cars --placeholder --check` passes (byte-identical); the studio zip round-trips;
screenshots of `/tools/thumbs` and of a race with four placeholder cars of visibly different sizes.
**Additionally run the packager on `KIT/`** (the not yet debranded models) into `/tmp/claude-0/cars-kit-out/`
only, to prove the real-model path end to end; report each car's numbers. Never copy those outputs into
any worktree.

---

### 2.5 C3: Handling and balance (after C1)

**Purpose.** Make every car its own physics spec (geometry plus small handling differences), give the
autopilot each car's own speed profile, and prove balance with a unit test.

**Files.** Edit `SW/sim/car.ts`, `SW/sim/simulation.ts`, `SW/sim/carSpec.ts`, `SW/sim/carSpec.test.ts`,
`SW/sim/car.test.ts` (only to pass the reference spec where it builds cars, if needed),
`SW/track/gen/racingLine.ts`, `SW/track/gen/generate.ts`, `SW/track/track.ts`, `SW/debug/autopilot.ts`,
`SW/config.ts` (C3 regions), `SW/game.ts` (C3 regions), `shared/src/cars.ts` (stats values). Create
`SW/race/speedProfile.ts`, `SW/race/speedProfile.test.ts`, `SW/sim/cars.test.ts`,
`SW/race/balance.test.ts`, `client/scripts/balance-cars.ts` (optional tuning printout run with `tsx`).

**Tasks.**
- **C3.1 `resolveCarSpec(id)`** derives the full `CarSpec` (§3.6) from `CARS.<id>` and the reference:
  wheel offsets and radii from `geometry`; collider and inertia from body size and mass with the
  `CAR_DERIVE` ratios; brake impulse, downforce, rolling resistance, reverse force and the assist
  torques scaled by `mass / CAR.mass`; per-car factors on top. `REFERENCE_SPEC` stays byte-for-byte the
  M8 car.
- **C3.2 `Car` takes a spec.** `new Car(rapier, world, spawn, surfaceOf, spec = REFERENCE_SPEC)`;
  `Simulation.addCar(spawn, spec = REFERENCE_SPEC)`. Every read of `CAR`, `WHEELS` (except suspension
  settings), `TYRES`, `ENGINE` (except `drag` × spec factor), `BRAKES` and the mass-scaled `ASSISTS`
  terms goes through `this.spec`. `Car.wheelOffsets` and `Car.mountHeight` become instance members
  (`wheelOffsets: readonly Vector3[]`, `mountHeights: Float32Array` per wheel, since front and rear radii
  differ). The engine fall-off becomes `1 - (v / topSpeed) ** curve`. Per-wheel radius goes to
  `addWheel`. Suspension stiffness and damping stay global (Rapier scales suspension force by chassis
  mass; the static-sag formula in `car.ts` already relies on it; C3 confirms it with the settle test).
  **The existing `car.test.ts`, `reverse.test.ts`, `surface.test.ts`, `simulation.test.ts`,
  `slipstream.test.ts` and `race.test.ts` must pass unchanged** with the default reference spec.
- **C3.3 Per-car speed profile** (§3.8). Move the two speed passes out of `buildRacingLine()` into an
  exported pure `speedProfile(curvature, spacing, limits)`; `buildRacingLine` calls it with the reference
  limits and also returns the line's own `curvature`; the generator stores it as
  `GeneratedTrack.lineCurvature`. Test: the reference limits reproduce today's `speed` array exactly
  (`toEqual` on the Float32Array) and the Kestrel Pines tyre walls are unchanged. `SW/race/speedProfile.ts`:
  `carSpeedProfile(track, spec): Float32Array` with the limits derived as in §3.8.
- **C3.4 Autopilot.** `autopilot(track, racer, out, speeds: Float32Array | null = null)`: with
  `speeds` it reads `speeds[track.indexAt(here + d)]` instead of `track.sampleAt(here + d).targetSpeed`;
  nothing else changes (same line, same `SPEED_SHARE`). `game.ts` computes `driver.speeds` once per
  driver and passes it (debug P and the soak).
- **C3.5 Per-car feel tests** `SW/sim/cars.test.ts`, for every id on the flat world of `car.test.ts`:
  settles level with all four wheels down and the origin within ±5 cm of the ground; 0-100 km/h in
  2.8-4.6 s; top speed within 165-205 km/h and within 4% of the spec's planned top speed; 100-0 km/h
  braking distance within ±12% of the reference car's; a full-lock turn at 60 km/h and a handbrake turn
  at 70 km/h stay upright (`upDot > 0.5`) and end with yaw rate under `ASSISTS.maxYawRate`; the collider
  fits inside the body bounds of `geometry`. Ordering test: the `CAR_INFO` Speed bars rank cars in the
  measured top-speed order and the Acceleration bars in the measured 0-100 order (cars within 1% of each
  other may share a bar value).
- **C3.6 Balance test** `SW/race/balance.test.ts` (§5.6): for each id, a fresh world with Kestrel Pines
  physics, one car on grid slot 0, `new Race(track, [car], 2)`, autopilot with that car's profile; record
  each lap. Assert: both laps complete, no respawn, lap 2 (flying) recorded. Assert
  `(max - min) / min ≤ 0.015` over the five flying laps. Print one table line per car
  (`console.info('[balance]', id, lap1, lap2, topKph)`). Budget: ≤ 15 s in Node; if slower, run the cars
  with `describe.concurrent` off and report the time.
- **C3.7 Initial tune.** Starting values are §4.2. Tune with **only** `force` and `frontGrip`/`rearGrip`
  (±4% from the starting value) until the test passes on the geometry of §4.1. Do not flatten the
  characters (keep the §4.2 orderings: Haymaker and Zanna fastest on top speed, Scree slowest; Scree and
  Sagitta best traction). C7 re-tunes on the final geometry.

**Acceptance.** Gate green with the new tests; the balance table in the report; `pnpm test` total still
under 90 s (report the time). Browser: `/tv?bots=1`, K four times (two keyboard players, Bot 3, Bot 4,
which get four different cars), Enter, debug P: the autopilot race finishes; screenshot.

---

### 2.6 C4: Car select on the phone, TV lobby slots, reconnect (after C1)

**Purpose.** The player chooses car and paint on the phone; the choice survives reconnects and reloads;
the TV lobby shows each player's car.

**Files.** Edit `PAD/profile.ts`, `PAD/profile.test.ts`, `PAD/padStore.ts`, `PAD/padStore.test.ts`,
`PAD/PadApp.tsx`, `PAD/screens/JoinScreen.tsx`, `PAD/screens/LobbyScreen.tsx`,
`PAD/screens/ResultsScreen.tsx`, `PAD/pad.css`, `client/src/tv/Lobby.tsx`, `client/src/tv/tv.css`.
Create `PAD/screens/CarPicker.tsx`, `PAD/cars.ts` (thumbnail URL helper).

**Tasks.**
- **C4.1 Profile and seat** (§3.5). `Profile` gains `car: CarId` (fallback `DEFAULT_CAR_ID`); `Seat`
  inherits it. `loadSeat` keeps a seat whose `car` is missing or invalid and fills `DEFAULT_CAR_ID` (a
  seat saved by the M8 build must still auto-rejoin after the update ships). Tests: invalid car →
  default; old seat without car → still returned, with the default car.
- **C4.2 Pad store.** `join(profile: Profile)` (name, colour, car, mode); `joinRequest` carries `car`;
  on `joined` the TV's `colour` and `car` win and are saved to the seat; `setMode` saves the seat with
  the TV's colour and car. Tests (extend `padStore.test.ts`): "remembers the seat with the car and paint
  the TV gave"; "rejoins on its own after a reload with the same car and paint"; "claims the same car
  again after a plain link reconnect"; "keeps a steering change without losing the car"; "an edit
  changes the car and the TV's answer is saved".
- **C4.3 Car picker** `CarPicker.tsx` (§3.13 for images): a car card with previous/next arrow buttons,
  horizontal swipe (Pointer Events, 40 px threshold) and five dots; the thumbnail
  `/cars/<id>/thumb-<colour>.webp` (the current paint; `loading="lazy"`, fixed 16:9 box so nothing
  jumps); make and model (`CAR_INFO`), body and drive line, five labelled stat bars, the credit line in
  small text (`creditLine(id)` from `carCredits.ts`). If other players in the lobby picked this car,
  a small "Also: Sara, Ben" line. Buttons have `aria-label`s; the card is a `role="group"` with a
  live region announcing the car name.
- **C4.4 Join screen.** "Car colour" becomes "Paint" (same eight swatches, same taken logic) and the car
  picker joins the form; submit sends the profile with `car`. Layout:
  - Landscape (≥ 600 px wide): three columns `[name, steering] [car card] [paint, Join]`; everything
    fits in 844×390 without scrolling; the Join button is fully visible.
  - Portrait: one column `[name] [car card] [paint] [steering] [Join]`, scrolling allowed, Join sticky
    at the bottom.
- **C4.5 Lobby screen.** Under the game card, a "Your car" card (thumbnail, model name) with a
  "Change car" button that opens the join screen in edit mode (the same `editing` path as today);
  the settings sheet's "Change name / colour" becomes "Change name / car". The player list shows each
  player's model name next to the name.
- **C4.6 Results screen.** Each standing shows the car model under the name (from `standing.car`).
- **C4.7 TV lobby slots** (`Lobby.tsx`): each occupied slot shows the car thumbnail in the player's
  paint (right side, 16:9, about 120 px wide at 1080p) and the model name under the player name. Empty
  slots unchanged.
- **C4.8 Old clients.** A pad that never sends `car` (cached M8 bundle) still joins (TV gives the
  default) and its UI ignores the extra fields (zod strips unknown keys). No test needed beyond C1's hub
  test; mention it in the report.

**Acceptance** (Playwright, ports 5300/5743; adapt `E2E/m7lobby.cjs` and `E2E/m3full.cjs`):
1. Pad A (Drag): name "Sara", picks Haymaker and red, joins. Pad B: picks Haymaker; red is disabled;
   picks blue, joins. The TV lobby shows two Haymaker thumbnails in red and blue. Screenshot TV and
   both pads (landscape 844×390), plus pad B's join screen in portrait 390×844.
2. Pad B taps "Change car", switches to Scree, saves: the TV slot shows Scree in blue.
3. Reload pad B in the lobby: it rejoins without a tap as Scree, blue.
4. Both ready; race starts; the TV debug overlay (backtick) lists `haymaker` and `scree` for the right
   players (C5 adds the car id to the overlay; until C5 merges, read the `lobby` message on the pad).
5. Reload pad A mid-race: same seat, same car and paint on the TV, controller drives again.
6. No `pageerror` on TV or pads.

---

### 2.7 C5: TV car visuals, LODs, paint, podium (after C2a)

**Purpose.** Draw the runtime GLBs of §3.9 with their own materials, per-player paint and brake lights,
LOD switching per viewport, the GLB's shadow stand-in, per-car framing, and keep shader precompile and
budgets intact.

**Files.** Rewrite `SW/scene/carVisual.ts`, edit `SW/scene/podium.ts`, `SW/scene/nameTag.ts`,
`SW/render/chaseCamera.ts`, `SW/scene/blobShadows.ts`, `SW/render/quality.ts`,
`SW/render/quality.test.ts`, `SW/debug/debugOverlay.ts`, `SW/tv/SplitWaysStage.tsx` (results list),
`SW/config.ts` and `SW/game.ts` (C5 regions). Create `SW/scene/carLod.ts` and `SW/scene/carLod.test.ts`
(the pure LOD chooser).

**Tasks.**
- **C5.1 Library** (§3.11). `CarModelLibrary.load(carIds)` fetches the unique ids in parallel from
  `/cars/<id>/<id>.glb`, splits each into its LOD groups, wheels, calipers and shadow mesh, and keeps one
  template per car. Shared per car model: all geometries, all materials except `paint` and
  `light_tail`. Per instance (`create(carId, paint)`): a clone of the template's `paint` material with
  `PAINTS[paint]` applied (colour, metalness, roughness, clearcoat, clearcoat roughness; its maps stay,
  §3.9 says they are greyscale) and a clone of `light_tail`. `dispose()` frees geometries, materials and
  textures of every template.
- **C5.2 Visual.** `CarVisual` keeps today's interpolation, wheel spin (per-wheel radius from the spec),
  steering on front pivots, suspension travel (`car.mountHeights[i] - car.wheelSuspension[i]`), the
  rear-wheel lock on handbrake, and brake lights (`light_tail.emissiveIntensity`). Front calipers sit on
  the steering pivot but outside the spinning node. The old hand-made materials and the merged
  silhouette go.
- **C5.3 Shadow stand-in.** The GLB's `shadow` mesh replaces `mergedSilhouette()`: shared geometry per
  car model, one `MeshBasicMaterial({ colorWrite: false, depthWrite: false })`, `castShadow = true`, on
  the default layer (M8 Appendix A: shadow casters are culled by the view camera's layers). All other car
  meshes `castShadow = false`, `receiveShadow = true`.
- **C5.4 LOD selection** (§3.12). Pure `chooseLod(previous, diameterPx, floor)` in `SW/scene/carLod.ts`
  with hysteresis; `CarVisual.selectLod(camera, viewHeightPx, floor, viewIndex)` computes the projected
  bounding-sphere diameter and keeps one remembered level per view index. In `renderRace()`, directly
  before each `renderer.renderView(...)`, select the level of every car for that view's camera and output
  height (`rect.height`). Preset floors from `PRESETS.*.carLodFloor`. Tests in `carLod.test.ts`:
  thresholds, hysteresis both ways, the floor, and that a car exactly on a threshold does not flip every
  frame.
- **C5.5 Precompile.** In `prepare()` and `applyPreset()`, before `renderer.precompile(...)`, show every
  LOD at or above the preset floor on every car (`visual.showAllForCompile(floor)`), and restore after.
  Overlay `late` stays 0 from GO through the first lap at all three presets (Low then never uploads
  LOD0 textures; §4.4).
- **C5.6 Podium.** `Podium` takes `{ place, car, paint }`, creates visuals with `create(car, paint)` and
  selects their LOD with the same rule for its own camera and full-screen height, with the race preset's
  floor. Confetti uses the winner's identity colour (unchanged).
- **C5.7 Framing.** `ChaseCamera` takes a framing from the spec (§3.11 and `CAMERA` framing keys);
  `createNameTag` is positioned at `spec.geometry.height + NAME_TAG_CLEARANCE`; blob shadows scale each
  instance to the car's length and width.
- **C5.8 Results list** in `SplitWaysStage.tsx`: the model name under each player's name.
- **C5.9 Debug overlay.** One line per car: id, current LOD in that player's own view, and paint. Debug
  key **V** (overlay open) hides or shows every car visual (and its shadow stand-in), so a person can
  read the cars' share of draw calls and triangles as the difference.
- **C5.10 Paint tuning.** Adjust `PAINTS` finishes so each paint reads as the identity colour under the
  Kestrel Pines light (side-by-side screenshot of all eight paints on the Nightjar placeholder, then on
  a real car in C2b).

**Acceptance** (ports 5400/5843; placeholders until C2b): screenshots of 1 viewport High (own car LOD0),
2 viewports Medium, 4 viewports Low with four different cars (LOD1 own, LOD2 far), the podium and the
overlay with key V on and off at 4 viewports Low; record draw calls and triangles with and without cars
at the start line and after 30 s of autopilot. Overlay `late` = 0 after GO. No `pageerror`.

---

### 2.8 C6: Credits and docs (code part after C1; docs review last)

**Purpose.** Attribution where players and readers see it, the licence log, and the docs.

**Files.** Create `client/src/credits/Credits.tsx`, `client/src/credits/credits.css`,
`client/src/credits/credits.ts` (the non-car asset credits, mirroring `assets/ASSETS.md`),
`client/src/credits/credits.test.ts`. Edit `client/src/main.tsx` (route), `client/src/tv/TvApp.tsx`
(key C), `client/src/landing/Landing.tsx` (footer link), `LICENCES.md`, `README.md`, `DECISIONS.md`,
`ROADMAP.md`, `PROGRESS.md`, and `shared/src/carCredits.ts` wording only if a licence re-check demands
it.

**Tasks.**
- **C6.1 `Credits` component**: sections Cars (five entries from `CAR_CREDITS`: our make and model, then
  "Based on <title> by <author>", licence name linked to its URL, source link, "Modified: …"), Track
  (the Kestrel Pines credit from the track files), Textures and sky (Poly Haven entries), Font (Chakra
  Petch, OFL), Sound (synthesised), Libraries (three.js MIT, Rapier Apache-2.0, React MIT, zod MIT).
  Readable at 3 m on a TV (≥ 24 px body text at 1080p) and on a phone.
- **C6.2 `/credits`** route (C6 anchor in `main.tsx`), and a "Credits" link in the landing page footer.
- **C6.3 TV credits screen.** In the TV lobby, key **C** toggles a full-screen credits panel (Escape
  closes); the lobby key hint line gains "· <kbd>C</kbd> credits". Ignored outside the lobby phase.
- **C6.4 Licence log.** `LICENCES.md` gains the section "Car models (CC BY 4.0 and CC0)" with one row
  per source in the M8 §4.4 table format (§4.5 gives the content). The "exact words" column quotes the
  licence as published: re-fetch each model's licence from the Sketchfab API
  (`https://api.sketchfab.com/v3/models/<uid>`, fields `license.label` and `license.url`; read-only
  GETs) on the day and quote them; for the Sagitta also quote the title and the description sentence
  that dedicates it to CC0, plus the current label, and record the conflict (R-C3). If the network is
  unavailable, quote `SCR/cars/shortlist.json` and mark the row "re-verify". Remove the placeholder row
  when C2b lands.
- **C6.5 README** "Credits" section (one line per car, as §4.5) and links to `/credits`,
  `LICENCES.md` and `assets/ASSETS.md`; "Scripts" section documents `pnpm assets:cars` (with the
  ImageMagick requirement) and the thumbnail studio.
- **C6.6 Consistency test** `credits.test.ts` (Node): every `CAR_CREDITS` entry's author, title and
  licence appear in `LICENCES.md` and in `README.md` (the `assets/ASSETS.md` rows are checked by C2's
  validator once the real cars land); every CC BY entry has a
  licence URL, a source URL and a non-empty "modified" text.
- **C6.7 Docs (finish, last).** After §2.11 passes: `DECISIONS.md` (D-C1 to D-C10, a "Cars" section),
  `ROADMAP.md` (M12 now lists only liveries, class kits and the chase-cam rewrite), `PROGRESS.md` (the
  update and its results, the balance table, the owner's M1 numbers when available), and a final review
  of `assets/ASSETS.md` against the files in `assets/cars/`.

**Acceptance.** Screenshots of `/credits` (desktop and phone), the TV credits panel, the landing footer.
Gate green.

---

### 2.9 C2b: Real cars (after C5 merged and `V2/` delivered)

**Purpose.** Ship the five debranded cars.

**Tasks.**
- **C2b.1 Intake check** per car (§3.10, §4.6): read any notes in `V2/<folder>/`; run the packager in
  `--check`-free mode to `/tmp/claude-0/cars-v2-out/`; render the close-up sheet (§4.6) with the studio;
  tick every `LINEUP.md` §3 "Rework, legal" and "Rework, distinctiveness" item. A missing legal item
  blocks that car: report it to the orchestrator and the owner, and do not commit that car. A missing
  distinctiveness item is reported too and needs the owner's go-ahead.
- **C2b.2 Geometry.** Update `CARS.<id>.geometry` to the measured values the packager prints (hubs,
  radii, body size). Report the change per car next to the §4.1 targets.
- **C2b.3 Build and commit** the five runtime GLBs (one commit; avoid committing intermediate versions,
  each is several MB of git history), the 40 thumbnails rendered from the real cars with C5's code, and
  `thumbs.json`. Delete `assets/models/sports-car.glb`, `client/scripts/build-car-model.mjs`, the
  `assets:car` script and the `--placeholder` mode. Turn on the validator's "no placeholder" rule.
- **C2b.4 `assets/ASSETS.md`**: one row per car file and one for the thumbnails (§4.5 wording), remove
  the sports car and placeholder rows.

**Acceptance.** Validator and `pnpm assets:cars <V2> --check` green; gate and `pnpm build:vercel` green;
the five close-up sheets and a 4-car race screenshot in the report; per-car report table (tris and
draws per LOD, file size, GPU texture estimate).

---

### 2.10 C7: Balance and performance pass (after C2b, C3 and C5)

**Purpose.** Final tuning on the real cars and the real geometry.

**Tasks.**
- **C7.1 Balance.** Re-run `balance.test.ts`; tune `force` and grip within ±4% of the C3 values until the
  spread is ≤ 1.0%; keep the character orderings of §4.2; update the stat bars only if the ordering test
  demands it. Record the final table (lap 1, lap 2, top speed, 0-100) in the report.
- **C7.2 LOD and budgets.** With four different real cars at 4 viewports Low, 2 Medium and 1 High
  (`?bots=1` for four cars, debug P), read the overlay with key V on and off at the start and after 30 s
  and 2 min of racing; adjust `CAR_LOD` thresholds so the §4.4 per-frame budgets hold with margin and
  LOD changes are not visible at normal play distance (look for popping in a 60 s screen recording of a
  four-car pack; screenshots before and after a switch).
- **C7.3 Paint check** on every real car in all eight paints (contact sheet), adjusting `PAINTS` only.
- **C7.4 `?bench=auto`** completes with four different cars on the grid and its telemetry POST returns
  200.

**Acceptance.** All of the above in the report with screenshot paths; gate green.

---

### 2.11 Integration acceptance (orchestrator, after C7, C4 and the C6 code part are merged)

Run on `cars/integration` in `/home/user/cars-wt/int`, ports 5000/5443, under the browser lock. Fix
nothing here: failures go back to the owning package.
1. `sh /tmp/claude-0/cars-gate.sh` and `pnpm build:vercel` green; `.vercel/output/static/cars/` holds
   five GLBs and 40 thumbnails; no `sports-car.glb`.
2. **Mixed field.** Three pads (A Drag, B Buttons, C Drag) plus one keyboard player: A picks Zanna/red,
   B picks Zanna/blue (same car), C picks Sagitta/yellow; the keyboard player has Nightjar (D-C10). TV
   lobby slots show the right thumbnails. Each pad drives briefly by touch, then autopilot (debug P)
   finishes a full race.
3. **Paint refused.** A fourth pad trying a taken paint sees it disabled; a crafted `join` with a taken
   paint (sent from the pad console) gets the first free paint from the TV, and the pad shows it.
4. **Reconnect in the lobby.** Reload pad B before the race: it rejoins without a tap as Zanna/blue.
5. **Reconnect mid-race.** Reload pad C mid-race: same slot, Sagitta/yellow on the TV, the controller
   drives, the R chip and the stuck hint still update.
6. **Results and podium** show the right cars and paints; lap records post (`POST /api/laps` 200) and the
   board lists them; the play-again vote returns everyone to the lobby with cars and paints kept.
7. **Credits.** Key C in the lobby shows the credits panel; `/credits` loads.
8. **Perf smoke.** `?bench=auto` completes; telemetry POST 200.
9. No `pageerror` on the TV or any pad. Screenshots of the lobby, the race at 4 viewports, the podium,
   the results board, and a pad join screen.

---

## 3. Contracts between packages

Signatures, names and units are exact; doc comments may be reworded.

### 3.1 Car ids and catalogue (C1, `shared/src/cars.ts`)
```ts
import { z } from 'zod';

/** Picker order; the first is the default car. */
export const CAR_IDS = ['nightjar', 'scree', 'haymaker', 'zanna', 'sagitta'] as const;
export type CarId = (typeof CAR_IDS)[number];
export const carIdSchema = z.enum(CAR_IDS);
export const DEFAULT_CAR_ID: CarId = 'nightjar';
/** Cars for TV keyboard players and bots, by local player index (D-C10). */
export const LOCAL_CAR_ORDER: readonly CarId[] = ['nightjar', 'scree', 'haymaker', 'zanna'];

export interface CarStats {
  /** 1..10, relative within this line-up (all cars have equal lap times). */
  speed: number;
  acceleration: number;
  handling: number;
  braking: number;
  /** How forgiving the car is at the limit. */
  ease: number;
}

export interface CarInfo {
  make: string; // "Dashwood"
  model: string; // "Nightjar"
  body: string; // "GT coupe"
  drive: 'RWD' | 'AWD';
  tagline: string; // the make's tagline from LINEUP.md §3
  stats: CarStats;
}

export const CAR_INFO: Record<CarId, CarInfo>;
/** "Dashwood Nightjar" */
export function carName(id: CarId): string;
```

### 3.2 Car credits (C1, `shared/src/carCredits.ts`; the only code file with source titles)
```ts
import type { CarId } from './cars';

export interface CarCredit {
  title: string; // the source model's title, verbatim
  author: string; // as the author presents themselves, e.g. "MMC Works (mmcworks)"
  sourceUrl: string;
  licence: 'CC BY 4.0' | 'CC0 1.0';
  licenceUrl: string;
  /** What we changed (CC BY asks us to say so). */
  modified: string;
}
export const CAR_CREDITS: Record<CarId, CarCredit>;
/** One line for small print: "Based on "<title>" by <author>, <licence>, modified." */
export function creditLine(id: CarId): string;
```

### 3.3 Protocol (C1, `shared/src/protocol.ts`)
- `joinSchema`: add `car: carIdSchema.optional()` after `colour`. Optional so a cached M8 pad still
  joins.
- `joinedSchema`: add `car: carIdSchema` after `colour`.
- `lobbyPlayerSchema`: add `car: carIdSchema` after `colour`.
- `standingSchema`: add `car: carIdSchema` after `colour`.
- `colour` keeps its name and meaning on the wire: the player's paint and identity colour (D-C1).
- `parseJson`'s 4096-byte cap is unaffected (a lobby message grows by about 80 bytes).

### 3.4 Hub (C1, `client/src/hub/hub.ts`)
- `HubPlayer.car: CarId` (directly after `colour`).
- `handleJoin`:
  - Existing seat, `rejoin` or `locked` (in the race): keep `existing.car` and `existing.colour`; only
    `connected` changes (as today).
  - Existing seat, plain edit in the lobby: `car = message.car ?? existing.car`; colour as today
    (`isColourFree` or keep the old one); name as today.
  - New seat: `car = message.car ?? DEFAULT_CAR_ID`; colour as today (requested if free, else first
    free).
  - `joined` carries `car`.
- `addLocalPlayer(id, name)`: `car = LOCAL_CAR_ORDER[localCount % LOCAL_CAR_ORDER.length]` where
  `localCount` is the number of local players already seated.
- `lobbyMessage()` includes `car` for every player.
- No car uniqueness rule: cars may repeat, colours (paints) may not.

### 3.5 Pad profile, seat and store (C4)
```ts
export interface Profile { name: string; colour: ColourId; car: CarId; mode: SteeringMode; }
export interface Seat extends Profile { room: string; seatKey: string; }
// padStore
join(profile: Profile): void;          // replaces join(name, colour, mode)
private joinRequest: { name: string; colour: ColourId; car: CarId; rejoin?: boolean } | null;
```
On `joined`: `joinRequest = { name, colour: message.colour, car: message.car, rejoin: true }` and the
seat is saved with them. A seat without a valid `car` loads with `DEFAULT_CAR_ID`. Storage keys stay
`gamergang.pad.profile` and `gamergang.pad.seat`.

### 3.6 Per-car config and spec (C1 creates, C3 completes; `SW/config.ts`, `SW/sim/carSpec.ts`)
`SW/config.ts` (zero imports; keys are plain strings, a test ties them to `CAR_IDS` and the colour ids):
```ts
export const CARS = {
  nightjar: {
    /** Measured from the runtime model (pnpm assets:cars prints it; the asset test checks it). */
    geometry: {
      wheelbaseHalf: 1.471, // hub z = +-wheelbaseHalf from the axle midpoint (m)
      halfTrackFront: 0.836, halfTrackRear: 0.838, // hub x = +-halfTrack (m)
      radiusFront: 0.378, radiusRear: 0.378, // tyre radius; hub height above the ground at rest
      length: 4.73, width: 2.01, height: 1.35, // body without mirrors (m)
    },
    /** Handling (reference car = 1 for every factor). */
    mass: 1400,          // kg
    comHeight: 0.28,     // centre of mass above the ground (m)
    comForward: -0.05,   // centre of mass ahead of the axle midpoint (m)
    force: 12_400,       // peak engine force at a standstill (N)
    topSpeed: 52,        // where the engine runs out of push (m/s)
    curve: 2,            // fall-off exponent: force * (1 - (v / topSpeed) ** curve); lower fades earlier
    frontShare: 0.3,     // share of engine force on the front wheels
    frontGrip: 1.9, rearGrip: 1.82,
    brake: 1,            // x reference braking deceleration
    downforce: 1,        // x reference downforce per kg
    drag: 1,             // x reference air drag
    inertia: 1,          // x derived inertia (snappier < 1)
  },
  // scree, haymaker, zanna, sagitta: §4.1 and §4.2
} as const;

export const PAINTS = {
  red: { hex: 0xb3121a, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 },
  // orange, yellow, lime, cyan, blue, purple, pink: §4.3
} as const;
```
`CAR_DERIVE` (C3): collider ratios (`colliderHalfWidth: 0.46` of body width, `colliderHalfLength: 0.49`
of length, `colliderHalfHeight: 0.27` of height, `colliderCentreHeight: 0.55` of height), the inertia
reference dimensions (4.4 × 1.84 m), and the autopilot limit factors of §3.8.

`SW/sim/carSpec.ts` (Node-safe):
```ts
export interface WheelSpec { x: number; z: number; radius: number; }
export interface CarSpec {
  id: CarId | 'reference';
  mass: number;
  inertia: { pitch: number; yaw: number; roll: number };
  com: { height: number; forward: number };
  chassis: { halfExtents: { x: number; y: number; z: number }; centreHeight: number };
  wheels: readonly [WheelSpec, WheelSpec, WheelSpec, WheelSpec]; // FL, FR, RL, RR
  engine: { force: number; topSpeed: number; curve: number; frontShare: number;
            reverseForce: number; reverseTopSpeed: number; drag: number; rollingResistance: number };
  tyres: { frontGrip: number; rearGrip: number; sideStiffness: number };
  brakes: { impulse: number; frontBias: number; handbrakeImpulse: number };
  /** mass / CAR.mass: scales downforce and the anti-roll, pitch and air-levelling torques. */
  massScale: number;
  downforce: number; // ASSISTS.downforce * massScale * factor
  geometry: CarGeometry; // the config block, for visuals (framing, tag height, blob size)
}
export interface CarGeometry {
  wheelbaseHalf: number; halfTrackFront: number; halfTrackRear: number;
  radiusFront: number; radiusRear: number; length: number; width: number; height: number;
}
export const REFERENCE_SPEC: CarSpec;   // the M8 car exactly (C1)
export function resolveCarSpec(id: CarId): CarSpec;
```

### 3.7 `Car` changes (C3, `SW/sim/car.ts`)
- Constructor: `(rapier, world, spawn, surfaceOf = () => SURFACE.asphalt, spec: CarSpec = REFERENCE_SPEC)`;
  `readonly spec: CarSpec`.
- Static `wheelOffsets` and `mountHeight` become `readonly wheelOffsets: readonly Vector3[]` and
  `readonly mountHeights: Float32Array` (per wheel). C5's visual reads them from the car.
- `Simulation.addCar(spawn: Spawn, spec: CarSpec = REFERENCE_SPEC): Car`.
- Everything else public on `Car` keeps its name and meaning.

### 3.8 Speed profile and autopilot (C3)
`SW/track/gen/racingLine.ts`:
```ts
export interface SpeedLimits {
  vMax: number; lateralAccel: number; brakeDecel: number; accelCap: number;
  force: number; topSpeed: number; curve: number; mass: number;
}
export const REFERENCE_LIMITS: SpeedLimits; // RACING_LINE + ENGINE + CAR (curve 2)
export function speedProfile(curvature: Float32Array, spacing: number, limits: SpeedLimits): Float32Array;
// RacingLine gains `curvature: Float32Array` (the line's own plan curvature, 1/m).
```
`GeneratedTrack.lineCurvature: Float32Array` (added next to `speed`). `SW/race/speedProfile.ts`:
`carSpeedProfile(track: Track, spec: CarSpec): Float32Array` with
- `vMax = RACING_LINE.vMax * spec.engine.topSpeed / ENGINE.topSpeed`
- `lateralAccel = RACING_LINE.lateralAccel * gripIndex`, `gripIndex = (frontGrip / TYRES.frontGrip + rearGrip / TYRES.rearGrip) / 2`
- `brakeDecel = RACING_LINE.brakeDecel * (spec.brakes.impulse / spec.mass) / (BRAKES.impulse / CAR.mass)`
- `accelCap = RACING_LINE.accelCap * (spec.engine.force / spec.mass) / (ENGINE.force / CAR.mass)`
- `force`, `topSpeed`, `curve`, `mass` from the spec.
The derivation factors live in `CAR_DERIVE` so C7 can damp them for all cars at once. The autopilot
signature is `autopilot(track, racer, out, speeds: Float32Array | null = null)`.

### 3.9 Runtime GLB (C2 writes, C5 reads, the validator checks)
Car space: metres, +Y up, +Z forward, +X to the car's left; origin on the ground (y = 0 where the tyres
touch at rest), on the centre line (x = 0), at the axle midpoint (z = 0). The root has no transform.
```
car_<id>                       root
├─ body_lod0                   static meshes; LOD0 materials (vocabulary of §3.10); rear calipers merged here
├─ body_lod1                   meshes named and materialled paint, kit, glass, light_tail (glass and light_tail optional)
├─ body_lod2                   meshes paint, palette; wheels baked in at rest
├─ wheel_fl                    node at the hub centre, identity rotation; spins about its X axis
│  ├─ wheel_fl_lod0            LOD0 meshes (rim, tyre, disc), centred on the hub
│  └─ wheel_fl_lod1            one mesh, material kit
├─ wheel_fr, wheel_rl, wheel_rr  (same)
├─ caliper_fl                  node at the hub centre; steers, never spins; child caliper_fl_lod0 (LOD0 only)
├─ caliper_fr                  (same)
└─ shadow                      one mesh, position attribute only, material shadow
```
- Material names: LOD0 any of the vocabulary; LOD1 exactly `paint`, `kit`, `glass`, `light_tail` (the
  LOD1 `light_tail` samples the kit atlas; it is a separate material only so its emissive can change per
  car); LOD2
  exactly `paint`, `palette`; `shadow`. `paint` is the only material the TV recolours; its
  `baseColorTexture`, if any, is greyscale (mean saturation < 0.05, mean luminance > 0.6; the packager
  checks). `light_tail` holds every rear lamp lens (its emissive is scaled per car for brake lights).
- `glass` is the only transparent material; `cutout` (alpha-tested) is allowed in LOD0 only.
- Images: `image/jpeg` (colour, ORM, emissive) or `image/png` (normal maps may be JPEG q92 if smaller;
  palette is PNG); LOD0 ≤ 2048 px, kit 1024², palette 64². No `extensionsRequired` other than
  `KHR_materials_clearcoat` (optional to the loader anyway).
- `asset.copyright`: the credit line; `asset.extras`: `{ carId, sourceSha256, builder: 'build-cars@1',
  placeholder?: true }`.
- Thumbnails: `assets/cars/<id>/thumb-<colourId>.webp`, 512×288, transparent background, ≤ 40 KB.
  `assets/cars/thumbs.json`: `{ "<id>": { "glbSha256": "<hex>" } }`.
- Served at `/cars/<id>/<id>.glb` and `/cars/<id>/thumb-<colourId>.webp` (Vite `publicDir` is
  `assets/`).

### 3.10 Input from `V2/` (what C2 accepts; the art track delivers to this)
- One folder per car; the folder name maps to the id: `v12-goblin` or `zanna` → `zanna`;
  `generic-sport-coupe` or `nightjar` → `nightjar`; `muscle-car-concept` or `haymaker` → `haymaker`;
  `concept-car-039` or `sagitta` → `sagitta`; `ariel-350-v2` or `scree` → `scree`. One `.glb` per
  folder (for the Sagitta only the build with the generic tyre, never the original-tyre file).
- Structure as in `KIT/`: wheel nodes `wheel_fl|wheel_fr|wheel_rl|wheel_rr` holding rim, tyre and
  optionally disc meshes; optional `caliper_xx` or `brake_xx` nodes; everything else is body (nested
  groups such as `body`, `interior`, `chassis` are fine). Units metres, +Y up, +Z forward, +X left,
  wheels standing on y = 0.
- Material vocabulary (input names, case-insensitive, an optional `.2`/`_cutout`-style suffix allowed):
  `paint`; `trim`, `body_trim`, `blackout`, `rubber`, `grille`, `plate`, `mirror`, `chrome`, `metal`,
  `accent_red` → trim family; `interior`, `interior_panel`, `screen` → interior family; `chassis`,
  `engine`, `fluid`, `filter` → chassis family; `glass`, `glass_tinted`, `headlight_lens`, `lens` →
  glass; `headlight`, `indicator`, `turnlight`, `reverse_light` → light_head; `taillight` → light_tail;
  `rim`, `tyre`, `tyre_tread`, `brake`, `caliper` → wheel family; names ending in `_cutout` → cutout.
  Anything else fails the build with a list.
- No brand text anywhere (images, geometry, names, metadata); paint material colour-free; no author
  file paths in metadata; tyre sidewalls blank or the fictional "Kerbwell" with an invented size code;
  plates use the Split Ways design (`LINEUP.md` §4 rules).
- Triangle count any; the packager reduces LOD0 to budget.

### 3.11 Visual API (C1 shape, C5 implementation; `SW/scene/carVisual.ts`)
```ts
export class CarModelLibrary {
  static load(carIds: readonly CarId[]): Promise<CarModelLibrary>;
  create(carId: CarId, paint: ColourId): CarVisual;
  dispose(): void;
}
export class CarVisual {
  readonly root: Group;
  readonly carId: CarId;
  lod: 0 | 1 | 2;
  update(car: Car, alpha: number, dt: number): void;
  selectLod(camera: PerspectiveCamera, viewHeightPx: number, floor: 0 | 1, viewIndex: number): void;
  showAllForCompile(floor: 0 | 1): () => void; // returns the restore function
  dispose(): void;
}
export interface PodiumEntry { place: 1 | 2 | 3; car: CarId; paint: ColourId; }
```
`ChaseCamera` gains `constructor(framing?: { distance: number; height: number; lookHeight: number })`;
the framing comes from the spec: `distance = CAMERA.distance + (length - 4.4) * CAMERA.distancePerMetre`,
`height = CAMERA.height + (height - 1.3) * CAMERA.heightPerMetre`, `lookHeight` likewise (C5 adds
`distancePerMetre: 0.6`, `heightPerMetre: 0.8` to `CAMERA`). `createNameTag` keeps its signature;
`NAME_TAG_HEIGHT` becomes `NAME_TAG_CLEARANCE = 1.05` above the car's body height.

### 3.12 LOD selection and presets (C5)
```ts
export const CAR_LOD = {
  /** Projected bounding-sphere diameter (output px) at or above which a car draws LOD0, LOD1. */
  lod0MinPx: 520,
  lod1MinPx: 110,
  /** A car changes level only once it is this share past a threshold, so it never flickers. */
  hysteresis: 0.12,
} as const;
// PRESETS.high.carLodFloor = 0, medium = 0, low = 1; QualityPreset gains carLodFloor: 0 | 1.
export function chooseLod(previous: 0 | 1 | 2, diameterPx: number, floor: 0 | 1): 0 | 1 | 2;
```
Diameter: `2 * r / (2 * d * tan(fov / 2)) * viewHeightPx`, `r` = half the car's bounding-box diagonal,
`d` = camera-to-car-centre distance. The overview camera and the podium use the same rule.

### 3.13 Thumbnails on the phone (C4)
`PAD/cars.ts`: `thumbUrl(car: CarId, colour: ColourId): string` → `/cars/${car}/thumb-${colour}.webp`.
No three.js import anywhere under `PAD/` (check `pnpm build` output: the pad chunk does not include
three; the M8 bundle split already keeps three in the TV chunk).

---

## 4. Data and asset plan

### 4.1 Geometry targets (C1 enters them; C2b replaces them with measured values)
Measured from `KIT/` reports (`tools/report.json`, `LINEUP.md` §2.4) and re-centred on the axle
midpoint; rework changes noted in `LINEUP.md` §3 are applied as targets.

| Id | wheelbaseHalf | halfTrack F / R | radius F / R | length × width × height | Note |
|---|---|---|---|---|---|
| nightjar | 1.471 | 0.836 / 0.838 | 0.378 / 0.378 | 4.73 × 2.01 × 1.35 | Real size kept (D-C9) |
| scree | 1.153 | 0.830 / 0.860 | 0.349 / 0.349 | 3.96 × 2.00 × 1.34 | Body narrowed to about 2.0 m; tracks follow (source 0.902 / 0.934) |
| haymaker | 1.524 | 0.829 / 0.889 | 0.364 / 0.364 | 4.77 × 2.17 × 1.40 | Wide rear tyres (0.42 m) |
| zanna | 1.370 | 0.833 / 0.945 | 0.357 / 0.376 | 4.79 × 2.05 × 1.21 | Staggered wheels; width without mirrors |
| sagitta | 1.255 | 0.826 / 0.826 | 0.375 / 0.375 | 4.65 × 2.00 × 1.10 | Wheels shrunk from 0.437 and rear track widened to the front's |
| reference (M8) | 1.288 | 0.79 / 0.79 | 0.354 / 0.354 | 4.4 box | Planner car only |

### 4.2 Handling starting values (C1 enters them; C3 and C7 tune)
Every factor is 1 on the reference car. Force per kg is quoted against the reference's 8.85 N/kg.

| Id | Character | mass | force (N/kg) | topSpeed m/s (km/h) | curve | frontShare | grip F / R | brake | downforce | inertia | comForward |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nightjar | All-rounder, stable | 1400 | 12,400 (8.86) | 52.0 (187) | 2.0 | 0.30 | 1.90 / 1.82 | 1.00 | 1.00 | 1.00 | -0.05 |
| scree | Agile, short of breath | 1200 | 11,250 (9.38) | 49.0 (176) | 1.6 | 0.50 | 1.98 / 1.92 | 1.00 | 0.95 | 0.90 | 0.00 |
| haymaker | Big shove, lazy turn-in, drifts | 1500 | 14,000 (9.33) | 54.5 (196) | 2.4 | 0.20 | 1.84 / 1.70 | 0.95 | 0.95 | 1.10 | +0.05 |
| zanna | Fast on straights, snappy | 1350 | 12,900 (9.56) | 54.0 (194) | 2.2 | 0.25 | 1.92 / 1.76 | 1.05 | 1.05 | 0.90 | -0.15 |
| sagitta | Brutal launch, fades early, planted | 1450 | 13,900 (9.59) | 50.5 (182) | 1.5 | 0.45 | 1.90 / 1.86 | 1.05 | 1.15 | 1.00 | -0.08 |

`comHeight` starts at 0.28 for all (the reference value); C3 may raise the Scree and Haymaker to 0.30 and
lower the Sagitta to 0.26. Stat bars (start; the ordering test may force changes):

| Id | Speed | Acceleration | Handling | Braking | Ease |
|---|---|---|---|---|---|
| nightjar | 6 | 6 | 6 | 6 | 9 |
| scree | 4 | 7 | 9 | 6 | 8 |
| haymaker | 9 | 7 | 4 | 5 | 5 |
| zanna | 8 | 8 | 6 | 7 | 4 |
| sagitta | 5 | 9 | 7 | 7 | 6 |

### 4.3 Paints (C1 enters them; C5 and C7 tune)
Identity (UI) colours stay `PLAYER_COLOURS.hex`. Car paint is a deeper tone so it does not glow under
ACES and bloom.

| Colour id | UI | Paint hex | metalness | roughness | clearcoat |
|---|---|---|---|---|---|
| red (Inferno) | #ff3b3b | #b3121a | 0.6 | 0.32 | 1 |
| orange (Blaze) | #ff8a1f | #d9560f | 0.5 | 0.34 | 1 |
| yellow (Taxi) | #ffd60a | #e8b90c | 0.2 | 0.38 | 1 |
| lime (Venom) | #9cff2e | #6fc219 | 0.45 | 0.36 | 1 |
| cyan (Lagoon) | #1fe0e6 | #11a9b5 | 0.55 | 0.32 | 1 |
| blue (Electric) | #2f7bff | #1746c9 | 0.6 | 0.30 | 1 |
| purple (Ultra) | #9b5cff | #5a2bb8 | 0.6 | 0.30 | 1 |
| pink (Flamingo) | #ff4fb0 | #d22a86 | 0.5 | 0.34 | 1 |

All with `clearcoatRoughness: 0.05`.

### 4.4 Budgets
**Per car (validator and `--check`):**

| Level | Triangles | Meshes (draw calls) | Textures |
|---|---|---|---|
| LOD0 body + wheels + calipers | ≤ 90,000 | ≤ 18 | ≤ 2048 px each; GPU ≤ 48 MB per car |
| LOD1 | ≤ 24,000 | ≤ 8 (paint, kit, glass, light_tail, 4 wheels) | kit 1024² × 4 maps: GPU ≤ 23 MB |
| LOD2 | ≤ 4,000 | ≤ 2 (paint, palette) | palette 64² |
| Shadow stand-in | ≤ 2,500 | 1 per shadow pass, plus 1 colour-less draw per view | none |
| GLB file | ≤ 6 MB | | |
| Thumbnails | | | 8 × ≤ 40 KB |

`assets/cars/` total ≤ 32 MB. GPU estimate: about 5.6 MB per 1024² RGBA8 texture with mips, 22 MB per
2048². Textures upload on first use, so a Low race (floor LOD1) never uploads LOD0 maps: four different
cars cost ≤ 92 MB on Low; 1 player High ≤ 71 MB; Medium ≤ 142 MB.

**Per frame, cars only** (overlay with key V on minus off; all viewports and passes):

| Config | Car draw calls | Car triangles |
|---|---|---|
| 1 viewport, High | ≤ 60 | ≤ 250,000 |
| 2 viewports, Medium | ≤ 90 | ≤ 350,000 |
| 4 viewports, Low, 4 different cars | ≤ 160 | ≤ 500,000 |

The M8 totals (M8 §4.5: ≤ 700 / 900 / 1100 draw calls, ≤ 2.5 M / 3.5 M / 3.5 M triangles) still hold
with the cars in. For comparison, the M8 car draws about 14 calls per car per view, so four cars in
four views today cost about 240 calls; the new budget is lower.

**Loading:** Enter to GO ≤ 10 s on the M1 (M8 budget) with four different cars on a warm cache; the
first, cold load of four cars (≤ 24 MB) is reported, not gated (R-C6).

### 4.5 Credit lines (C1 `carCredits.ts`, C6 docs)
From `SCR/cars/shortlist.json` (licences verified on the Sketchfab API on 2026-10-10; C6 re-verifies).

| Id | Credit |
|---|---|
| zanna | Briganti Zanna is based on "Fictional supercar - V12 Goblin" by Olli Teittinen (ollitei), https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified: renamed, reshaped, debranded, re-materialed, reduced to three levels of detail. |
| nightjar | Dashwood Nightjar is based on "Generic Sport Coupé Car" by MMC Works (mmcworks), https://sketchfab.com/3d-models/generic-sport-coupe-car-820a13c4831c41959ce75e6c2014e882, CC BY 4.0. Modified: same list. |
| haymaker | Brazen Haymaker is based on "Muscle Car Concept" by ViktorKom, https://sketchfab.com/3d-models/muscle-car-concept-aa5dbdc7d492478ababfd4d385b8339f, CC BY 4.0. Modified: same list, hidden parts removed. |
| sagitta | Arvanta Sagitta is based on "FREE Concept Car 039 - public domain (CC0)" by unityfan777 (Unity Fan YouTube channel), https://sketchfab.com/3d-models/free-concept-car-039-public-domain-cc0-f17b9d37e0e34f15b4c2e417a98f5ed6, dedicated to the public domain (CC0 1.0); credited as a courtesy. Modified: same list. |
| scree | Mudlark Scree is based on "Ariel_350-V2" by orcha (gandoplyas), https://sketchfab.com/3d-models/ariel-350-v2-7a9a44bcf152405792424408bb573482, CC BY 4.0. Modified: same list. |

`LICENCES.md` row per source: Checked (date of the re-check), Source (URL, title, author, upload uid),
Licence file and exact words (§2.8 C6.4), Conflicts or notes (Sagitta: label vs dedication, R-C3; all:
"CC BY grants no trademark rights; the models were debranded"), Decision ("Used, modified"), Used for
(the car id and name), Files in repo (`assets/cars/<id>/<id>.glb`, its eight thumbnails), Credits (the
line above). Note under the table: our modifications are (C) 2026 the Gamer Gang project; the original
works stay under their licences.

`assets/ASSETS.md` rows: `assets/cars/<id>/<id>.glb` | "<Make Model> (car <n> of 5), three levels of
detail" | the credit line, "converted by `pnpm assets:cars`, source SHA-256 <first 8>...<last 5>" |
CC BY 4.0 (or CC0). One row `assets/cars/*/thumb-*.webp` | "Car picker thumbnails, rendered from the
car files" | made for this project from the files above | same licence as each car.

### 4.6 Debrand and distinctiveness check (C2b, owner sign-off)
The thumbnail studio has a second mode, `/tools/thumbs?sheet=<id>`, that renders a 3×3 contact sheet at
1024×576 per tile: front, rear, both sides, 3/4 front and rear, a wheel close-up (sidewall readable), the
cockpit through the windscreen, and the plate area. C2b saves the sheets to
`/tmp/claude-0/e2e-c2/sheets/<id>.png` and fills a checklist per car: every `LINEUP.md` §3 "Rework,
legal" item (plates, sidewall text, emblems and scripts, screens, caliper wordmarks, centre caps,
metadata) and every "Rework, distinctiveness" item. The owner signs off from the sheets before C2b's
commit is merged.

---

## 5. Testing plan

### 5.1 Unit tests (Vitest, Node)

| Package | Tests |
|---|---|
| C1 | `shared/src/cars.test.ts`; `SW/sim/carSpec.test.ts` (reference spec equals the M8 constants; `CARS` and `PAINTS` keys); `client/src/hub/hub.test.ts` (C1.3 list); every existing test unchanged and green. |
| C2 | `SW/cars/assets.test.ts` (validator, C2a.4); C2b turns on "no placeholders". |
| C3 | `SW/race/speedProfile.test.ts` (reference reproduces `speed`, monotone in grip and top speed); `SW/sim/cars.test.ts` (C3.5); `SW/race/balance.test.ts` (C3.6); existing car, reverse, surface, simulation, slipstream and race tests unchanged. |
| C4 | `PAD/profile.test.ts` and `PAD/padStore.test.ts` (C4.1, C4.2). |
| C5 | `SW/scene/carLod.test.ts`; `SW/render/quality.test.ts` (each preset has `carLodFloor`, Low is 1). |
| C6 | `client/src/credits/credits.test.ts` (C6.6). |

`pnpm test` stays under 90 s in total (M8 baseline 25 s; the balance test is the biggest addition,
budget 15 s).

### 5.2 Commands
- The cars gate (§2.1) in every package, before and after the pre-handoff merge.
- C2, C6, C7: `pnpm build:vercel`. C2: `pnpm assets:cars <V2> --check` (C2b) or
  `pnpm assets:cars --placeholder --check` (C2a).
- C3, C7: the balance table (`pnpm vitest run client/src/games/splitways/race/balance.test.ts`).

### 5.3 Headless browser checks
Per-package acceptance sections, plus for every run: no `pageerror`, the TV loading overlay goes away,
`.sw-canvas` exists, no console errors other than known benign ones (list them). SwiftShader frame
rates mean nothing; only budgets (draw calls, triangles from the overlay), completion and correctness
are checked headlessly.

### 5.4 Benchmarks
The M8 modes are unchanged: `?bench=auto`, `?bench=matrix`, `?bench=soak&bots=1`. With `bots=1`, K four
times gives two keyboard players and two bots with four different cars (D-C10), so the soak exercises
four car models.

### 5.5 What the owner runs on the real M1 (after review)
1. M8 §5.5 setup (4K TV at 60 Hz, Chrome full screen, `pnpm start`).
2. `?bench=auto` (K, Enter); photograph the table.
3. `?bench=soak&bots=1` (K ×4, Enter) for 30 minutes; photograph "SOAK DONE". Four different cars.
4. Real races with phones: 1 player in the Zanna (High), 2 players (Medium), 4 players with four
   different cars (Low). Once per race open the overlay (backtick): preset, scale, GPU ms, draw calls,
   then press V twice and note the car share. Check the phone join screen on an iPhone and an Android
   phone in both orientations, the car swipe, a taken paint, "Change car", and a phone reload in the lobby
   and mid-race.
5. Repeat step 3's key checks at 1080p as M8 §5.5 step 5.
6. Look at each car close up on the podium and in the five contact sheets (§4.6) and sign off the
   debrand.
7. Telemetry via `pnpm telemetry:report --since 24h`. Pass definition: M8 §5.6, unchanged.

### 5.6 Balance definition
Solo car on grid slot 0, Kestrel Pines, two laps, autopilot at `SPEED_SHARE` 0.92 of the car's own
profile (§3.8). The flying lap is lap 2. Pass: all five finish both laps with zero respawns and
`(slowest − fastest) / fastest ≤ 1.5%`; target ≤ 1.0%. The test is deterministic on one machine; across
machines Rapier's WASM build may differ in the last digits, which the margin between 1.0% and 1.5%
absorbs. Human balance is the owner's play test (Q3).

---

## 6. Risks and fallbacks

| # | Risk | Mitigation and fallback |
|---|---|---|
| R-C1 | **`V2/` is late or a car misses a legal rework item** | C2a placeholders keep every other package moving. A car with a missing legal item is not committed (C2b.1); the owner decides between waiting and shipping four cars (Q7). The picker and hub tolerate a shorter `CAR_IDS` list (no index assumptions beyond `CAR_IDS[0]`). |
| R-C2 | **Brand residue survives in textures** (plates, sidewalls, screens, caliper wordmarks) | Only visual checks can find it: the §4.6 contact sheets with the readable wheel and plate tiles, and the owner's sign-off. Metadata and names are covered by the gate grep and the validator scan. |
| R-C3 | **Sagitta licence label conflict**: the title and description dedicate it to CC0 (since 2020), while Sketchfab's current label is "Free Standard" | Quote both verbatim in `LICENCES.md`, archive the description (a Wayback Machine snapshot URL in the row), and credit the author anyway. A CC0 dedication cannot be revoked, but this is the owner's call (Q2); fallback: ship four cars until a replacement hypercar is found. |
| R-C4 | **Simplifier damage** (hard-surface shading breaks, gaps, flipped normals at LOD1/LOD2) | Attribute-weighted simplification with border lock; LOD1 and LOD2 only appear at ≤ 520 px and ≤ 110 px; C5 and C7 screenshot both levels side by side; per-part target ratios in the packager (exterior keeps more than interior). Fallback: the art track supplies hand-made LOD1 meshes as `*_lod1` nodes, which the packager uses instead. |
| R-C5 | **Texture atlas fails on tiling UVs** | The packager fails with the material name; the art track bakes those materials (they are mostly tyre treads and grilles). Fallback: keep that material as its own LOD1 slot (one more draw call), within the 8-draw budget only if the car has no `glass` at LOD1. |
| R-C6 | **Download size and first load** (≤ 24 MB for four cars, cold) | Only race cars load; files are cached by the browser between races; report cold and warm load times. Fallback: drop LOD0 texture size to 1024 (halves the files) or split LOD0 into its own file loaded only for High and the podium. |
| R-C7 | **GPU memory with four different cars** | Lazy texture upload plus the Low floor (§4.4). Fallback: the kit atlas at 512² on Low. KTX2 in M9 cuts it four to six times. |
| R-C8 | **Per-car physics breaks the M8 tests or the track** | The reference spec reproduces the M8 car exactly and the track planner keeps using it (D-C3); C3's speed-profile test proves the generated track and tyre walls are unchanged. |
| R-C9 | **Autopilot balance is not human balance** (a snappy car is fast for the bot, hard for people) | Ease bar on the card; owner play test (Q3); C7 can damp the derived limits in `CAR_DERIVE` for all cars at once. |
| R-C10 | **Different collider sizes change contact fairness** (the 3.96 m Scree vs the 4.79 m Zanna) | Accepted (party game; differences are under 1 m). Fallback: one shared collider length of 4.5 m for all cars. |
| R-C11 | **Shader compile hitches** from new materials (clearcoat, emissive, cutout) | `showAllForCompile(floor)` before every precompile; overlay `late` = 0 after GO is part of C5's acceptance; the podium hitch on Low (LOD1 already compiled) is gone, on High it stays accepted as in M8 R-7. |
| R-C12 | **Old cached pads or seats** after the deploy | `car` is optional on `join`; seats without `car` load with the default; zod strips unknown fields on old pads. Tested in C1 and C4. |
| R-C13 | **Thumbnails drift from the models** | `thumbs.json` pins each GLB's SHA-256; the validator fails when a GLB changes without new thumbnails. |
| R-C14 | **Join screen too crowded on small phones** (landscape 390 px tall) | Three-column landscape layout with fixed-size card; portrait scrolls with a sticky Join; acceptance screenshots at 844×390 and 390×844. Fallback: a two-step join (driver, then garage). |
| R-C15 | **ImageMagick missing on a machine that rebuilds the cars** | The packager checks first and prints the install hint; only `assets:cars` needs it, never the game or the tests. |
| R-C16 | **Same-car confusion in split screen** (two Zannas) | Paint is unique by rule, name tags and HUD keep the identity colour. |
| R-C17 | **Git history growth** (five GLBs, about 25 MB) | Commit the real GLBs once (C2b) and again only if C7 must change them. |

---

## 7. Open questions for the owner

1. **Q1 Paint = identity colour (D-C1)?** It keeps the eight bright colours as paints. Do you also want
   white, black, silver or gunmetal paints? That needs a separate, automatic identity colour for HUD,
   minimap and name tags.
2. **Q2 Sagitta licence:** accept the CC0 dedication in the title and description despite Sketchfab's
   current "Free Standard" label (evidence archived), or hold the Sagitta back?
3. **Q3 Balance target:** 1.5% max with a 1.0% tuning target on the autopilot. `LINEUP.md` aimed at
   ±0.3 s (about 0.4%) for a class system later. Keep 1.5% for now?
4. **Q4 Engine sounds:** today every car sounds like the same synthesised V8. A per-car pulse count
   (V12, V8, I4, electric whine) is small work; now or in M11?
5. **Q5 Lap records per car:** keep one board per track (no API change), or add the car to lap records
   later?
6. **Q6 Keyboard and bot cars:** a fixed order is fine for testing; do you want a TV key to change a
   keyboard player's car?
7. **Q7 Partial delivery:** if one car misses a legal rework item, ship four cars or wait?
8. **Q8 "Zanna"** is close in sound to a famous supercar name; `LINEUP.md` suggests "Morso" as the
   fallback. Keep Zanna?
9. **Q9 First-load size** of up to about 24 MB for four cars over home internet: acceptable, or should
   LOD0 textures go down to 1024 now?
10. **Q10 Stat bars on the phone:** show all five bars, or only Speed, Handling and Ease for a party
    audience?

---

## Appendix A. Verified facts this spec relies on

**Code at `c5b9911`:**
- `SW/sim/car.ts` reads the single car from config: mass and inertia (lines 143-148), collider
  (152-165), static `wheelOffsets` (119-124) and `mountHeight` (126-130), wheels with one radius
  (170-185), engine fall-off `1 - (v / ENGINE.topSpeed) ** 2` and `frontShare` (381-389), grip
  (404-427), assists using `CAR.inertia.yaw` (465-487).
- `SW/config.ts`: `CAR` 15-30, `WHEELS` 32-49, `TYRES` 51-57, `ENGINE` 59-72, `BRAKES` 74-79, `DRIFT`
  93-105, `ASSISTS` 107-123, `RACING_LINE` 175-187, `PRESETS` 288-329.
- The track planner uses the single car: `SW/track/gen/racingLine.ts` 99-118 (`ENGINE.force`,
  `ENGINE.topSpeed`, `CAR.mass`), and `applyTyreBarriers(brakingZones(line.speed), ...)`
  (`generate.ts:148`) places tyre walls from that profile. `TrackSample.curvature` is the centre line's,
  not the racing line's.
- Other single-car readers: `carVisual.ts:198` (`WHEELS.radius`), `carVisual.ts:203`
  (`Car.mountHeight`), `chaseCamera.ts` (`ENGINE.topSpeed` for the speed FOV), `game.ts:145`
  (`IMPACT_THRESHOLD = CAR.mass * 40`), `nameTag.ts:7` (`NAME_TAG_HEIGHT`), and (after P5)
  `SCENERY.blobLength/blobWidth` in `blobShadows.ts`.
- `carVisual.ts` remaps GLB materials by name to hand-made shared materials (161-177) and builds the
  shadow stand-in by merging every mesh (`mergedSilhouette`, 25-41); it loads one fixed URL (22).
- The autopilot reads `track.sampleAt(here + d).targetSpeed` (`autopilot.ts:117-122`) with
  `SPEED_SHARE = 0.92`.
- The colour flows: `PLAYER_COLOURS` (`protocol.ts:29-38`) → `join.colour` → hub
  `isColourFree`/`firstFreeColour` (`hub.ts:396-403`) → `joined.colour` and `lobbyPlayer.colour` → pad
  accent (`PadApp.tsx:141`, `LobbyScreen`, `ResultsScreen`), TV lobby slot (`Lobby.tsx:27`), game paint
  (`game.ts:299`), name tag (300), HUD (311), minimap (`carColours`, 333), debug overlay (1012), podium
  (861), results (`SplitWaysStage.tsx:54`).
- Seat logic: the hub keeps name and colour on `rejoin` or while the car is in the race
  (`hub.ts:260-266`); the pad saves the TV's colour with the seat key on `joined`
  (`padStore.ts:166-176`) and rejoins from the stored seat after a reload (`padStore.ts:68-88`,
  `profile.ts:76-93`).
- The `joinSchema` doc comment already promises that a rejoin keeps "name, colour and car"
  (`protocol.ts:83-86`).
- Grid rows are 9 m apart with 3 m stagger (`track.ts` `gridSpawns`), enough for a 4.8 m car.
- Vite `publicDir` is `../assets` (`client/vite.config.ts`); `scripts/build-vercel.mjs` copies
  `client/dist` to `.vercel/output/static`, so `assets/cars/**` is served at `/cars/**`.
- `assets/` is in `.prettierignore` and ESLint ignores; `client/scripts/**/*.mjs` is linted.
- Vitest includes `**/src/**/*.test.ts` only, so tests live under `src/`.
- The gate's brand grep finds nothing in `client/src`, `shared/src`, `server/src` at `c5b9911`;
  "apple" would hit `client/src/net/telemetry.test.ts:45` and `client/src/styles/global.css:13`, so it
  is only in the GLB scan list.

**three r186 (`THREE/`):**
- `examples/jsm/libs/meshopt_simplifier.module.js` exports `MeshoptSimplifier` (meshoptimizer 1.1) with
  `ready`, `simplify`, `simplifyWithAttributes`, `simplifySloppy`, `simplifyPrune`.
- `examples/jsm/libs/fflate.module.js` exists (zip in the browser).
- `GLTFLoader` supports `KHR_materials_clearcoat`, `EXT_texture_webp` and `EXT_meshopt_compression`
  (constants at `loaders/GLTFLoader.js:633-650`); we use none of the compression extensions.
- `GLTFExporter` writes GLB from geometry and materials; the carkit tools inject image bytes afterwards
  (`KIT/v12-goblin/tools/inject.mjs`).
- `WebGLRenderer.projectObject` updates `THREE.LOD` per camera (`src/renderers/WebGLRenderer.js:1872`);
  we do not use it because thresholds need the viewport height (D-C5). Invisible objects are not
  traversed, so hidden LOD groups cost nothing.
- Shadow casters are culled with the view camera's layers (M8 Appendix A), which is why the shadow
  stand-in stays on the default layer and draws once, colour-less, in the main pass.

**Machine:**
- ImageMagick `convert` at `/usr/bin/convert` reads and writes WebP (libwebp 1.3.2) and JPEG.
- Python 3 with PIL 12.3 (only for ad hoc checks with `-I`; the repo pipeline is Node).
- Playwright at `/opt/node-tools/node_modules/playwright`; Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

**Source models (`KIT/`):** node trees differ per car (wheel nodes are always `wheel_fl|fr|rl|rr`;
calipers are `caliper_xx` in two cars and `brake_xx` in three; the body is either a `body` group or
loose meshes). Mesh counts 19-39, materials 10-22, triangles 66k-301k; the Haymaker uses two 4096
atlases plus three alpha-cutout materials; the Sagitta's `body_color_supra` material name and the
Scree's `strix-r4` root name must not survive (the packager renames everything per §3.9).
