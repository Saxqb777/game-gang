# Progress

Per milestone: what was built, how to test it on the Mac + phones, what was verified here.

## M0 - Skeleton

**Built**

- pnpm workspace: `shared` (protocol, zod), `server` (signaling API, local servers), `client`
  (Vite + React: `/tv`, `/pad`, `/`).
- API on Vercel + Neon: `/api/room`, `/api/signal`, `/api/laps`. In-memory Postgres locally when
  `DATABASE_URL` is empty.
- WebRTC from each phone to the TV: lossy input channel + reliable state channel. Auto-reconnect into
  the same slot.
- TV lobby: QR, room code, game card, 4 slots with connection dots and ready state.
- Pad: code entry, join (name, colour, steering mode), lobby with READY, settings sheet.
- `pnpm dev` prints the TV URL, phone URL and a QR. `pnpm build:vercel` builds the deployment.

**Test**

1. `corepack enable && pnpm install` (Node 20.19+), then `pnpm dev`. Allow incoming connections if
   macOS asks.
2. Mac: Chrome → http://localhost:4000/tv. Fullscreen: Ctrl+Cmd+F.
3. Phone on the same wifi: scan the QR. Accept the certificate warning once:
   - iPhone: Show Details → visit this website → Visit Website.
   - Android: Advanced → Proceed.
4. Name, colour, Tilt or Buttons, JOIN → your card appears on the TV.
5. Join a second phone, tap READY on one → its card turns green.
6. Wifi off for a few seconds → grey dot. Wifi on → back in the same slot.
7. Close a tab → grey dot at once, slot freed after 15 s.

**Verified here**: headless Chromium, TV + 2 pads through the real API. Pads connect in ~3 s, a
closed pad shows in ~0.3 s. Not verified: real phones, real Neon.

## M1 - Drive

**Built**

- Rapier raycast vehicle with arcade assists, fixed 60 Hz, interpolated.
- Chase camera (lag, speed FOV, impact shake), soft sun shadows, CC0 sports car with PBR paint,
  working wheels and brake lights.
- Pad: Tilt (gyro) or Buttons (150 ms ramp), GAS, BRAKE (hold at a standstill = reverse),
  HANDBRAKE, HORN, speed and position, rotate-your-phone prompt. Collisions buzz (Android).
- TV keys: WASD + Space drive, `K` add keyboard player, `Enter` ready, `Esc` lobby, `` ` `` debug
  overlay, `F` fullscreen.
- Every tunable in `config.ts`.
- Driven on a test plane, replaced by the real track in M3.

**Test**

1. Join as in M0, tap READY.
2. Phone sideways. Tilt: turn it like a wheel. Buttons: left thumb steers, right thumb GAS/BRAKE.
3. Try: full throttle, a hard turn, a brake tap mid-corner (tail steps out), HANDBRAKE + steer then
   counter-steer, BRAKE at a standstill (reverse).
4. `` ` `` on the Mac: fps and live inputs.
5. No phone: `K`, `Enter`, WASD + Space.

**Verified here**: GAS on a pad page moves the TV car, two-finger input works, keyboard drives, Esc
returns both screens to the lobby. 60 fps on the M1 is yours to confirm.

## M2 - Split screen

**Built**

- 1 player full screen, 2 top/bottom, 3-4 in a 2x2 grid. With 3, the 4th cell is a LIVE camera
  circling the pack.
- Cars collide; hard hits shake that camera and buzz that phone.
- Name tags over the other cars (hidden in your own view).
- Shadow map 2048 → 1024 with 3-4 players.

**Test**

1. Join with 2, 3, then 4 phones (or `K` for keyboard players), everyone READY.
2. Layout matches the count, each phone drives its own car, tags show.
3. Bump each other: shake + buzz.
4. `` ` `` with 4 players: fps (target 60) and draw calls.

**Verified here**: 4 and 3 pad pages, independent inputs, layouts and LIVE cell render.

## M3 - Track and race

**Built**

- Corniche Run: 1.2 km coastal loop. PBR asphalt and sand (Poly Haven, CC0), lane markings, kerbs,
  chequered line, start gantry with countdown lights, railings by the sea, jersey barriers, dunes.
- Race: 3 s countdown (cars held), 3 laps, 8 checkpoints in order, live positions, lap timer, WRONG
  WAY banner, respawn with a fade (flipped, stuck or off the track for 3 s).
- Finish: the rest get 30 s, then DNF. Podium with the top 3 cars and confetti, results table,
  all-time best laps (saved in Neon).
- Pad: position, lap and countdown; results screen with PLAY AGAIN (majority of phones → lobby).
- Debug: `` ` `` then `P` hands every car to the autopilot (test tool).

**Test**

1. Join 1-4 phones (or `K` keyboard players), everyone READY.
2. Countdown: 3 red lamps, then green and every phone buzzes. Gas before green does nothing.
3. Drive 3 laps. Check the lap counter, position, and WRONG WAY if you turn around.
4. Flip the car or wedge it against a wall for 3 s: fade, back on the track at the last checkpoint.
5. When the winner finishes, the rest have 30 s. Then the podium and results on the TV, your place
   and PLAY AGAIN on the phone.
6. The all-time board highlights names from this race.
7. PLAY AGAIN on more than half the phones → lobby.

**Verified here**

- Node tests: full 4-car, 3-lap race on autopilot (~40 s laps, ~2:10 race); skipped checkpoints
  don't count; cars sit on the road and the walls hold.
- Headless Chromium, TV + 2 pad pages: countdown, 3 laps, podium, results (2:04.55 / 2:06.02),
  leaderboard saved and shown, results on the pads, vote back to the lobby.
- Not verified: 60 fps on the M1, real phones.

## M4 - Look

**Built**

- Sky and light: CC0 HDRI sky, low late-afternoon sun (WSW), long soft shadows, haze that matches
  the sky.
- Post: HDR with 4x anti-aliasing, bloom, ACES, warm grade, vignette, speed lines from 115 km/h.
  Dynamic resolution keeps 60 fps.
- Sea with moving ripples, turquoise shallows and foam.
- Skid marks that stay for the race, tyre smoke, sand dust and ruts on the shoulders.
- Scenery: palms, street lamps, whitewashed city, glass skyline, grandstand with crowd, banners.
- HUD: minimap, speed bar, last lap time (gold, marked BEST).
- Debug: `N` moves every car to its next checkpoint, `R` pins the resolution.

**Test**

1. Race as in M3. The sun is behind you on the start straight and in your eyes on the inland
   straight.
2. Handbrake slide: black marks stay on the road, white smoke. Drive on the sand: dust and ruts.
3. Above ~115 km/h: thin speed lines at the edges.
4. With 4 players press `` ` ``: fps should read 60 and `render scale` 1.00. If the scale drops,
   send me the number.

**Verified here**

- Headless Chromium (software rendering): all 8 checkpoints, a handbrake spin, 1, 3 and 4-player
  layouts, the podium.
- Tests, lint, typecheck, production build.
- Not verified: frame rate on a real GPU (the M1).

## M5 - Feel

**Built**

- Sound on the TV: an engine per car with gear changes, tyre screech, wind, sand rumble, horn,
  crash thuds, countdown beeps, crowd at the finish and on the podium. Each car's sound sits on its
  viewport's side of the screen.
- "Sound is off" hint on the TV until someone clicks or presses a key there (browser rule).
- Pad: "Tap to enable wheel" when tilt is chosen but the gyro is silent (iPhone after a reload).
- Already there from M0-M1: haptics, wake lock, auto-reconnect, tilt/buttons.

**Test**

1. Open the TV page and click once (or press a key): the yellow "Sound is off" pill disappears.
2. Race: revs on the grid when you hold gas, beeps on each light, gear changes, screech when you
   slide, a thud when you hit something, horn button, applause at the finish.
3. iPhone in tilt mode: reload the pad page and rejoin the race. "Tap to enable wheel" appears;
   tap it and allow motion access.

**Verified here**

- Offline render of the sound (16 s preview sent in chat): engine pitch follows speed and gears,
  peak level 0.49 (no clipping).
- No errors with audio running in a headless race. Tilt overlay appears while the gyro is silent
  and falls back to buttons when there is no sensor.
- Not verified: how it sounds on the TV speakers, real iPhone motion prompt.

## M6 - Ship

**Built**

- README: setup, controls, troubleshooting, deploy steps.
- `pnpm start`: production build served from the Mac (TV on http :4000, phones on https :4443).

**Test**

1. `pnpm start`, then a full race as in M3-M5.
2. Deploy as in README → Deploy. Open `/tv` on the Vercel URL and join with phones, including one
   on mobile data (needs the TURN variables if it can't connect).

**Verified here**

- `pnpm start` serves the TV page, the https pad page, the API and the sky file.
- `pnpm check` passes (typecheck, lint, format, 31 tests). `pnpm build:vercel` output: static
  files plus one API function.
- Not verified: a real Vercel deployment and Neon database (needs your accounts).

## M7 - Items and speed tricks

**Built**

- Items mode (default) and Classic, picked in the lobby from the TV (`M`) or any phone.
- Mystery boxes and six items: nitro, oil slick, rocket, shield, shockwave, bounty drone. Odds
  depend on race position.
- Hits: spin-out, speed loss, camera shake, phone buzz. Shields block one hit.
- Drift boost (blue, orange, purple sparks), 4 boost pads, slipstream. Both modes.
- Phone: ITEM button with a spinning slot. TV: item slot in each HUD, SLIPSTREAM tag, new sounds.
- Lap records only from Classic races.

**Test**

1. Lobby: Items is on. Press `M` or tap Classic on a phone: TV and phones switch together.
2. Items race: drive through a row of **?** boxes. The slot spins on the TV and the phone, then
   shows the item. Tap ITEM (keyboard: `Q` for player 1, `Enter` for player 2).
3. Try each item: nitro flames, oil behind you, a rocket at the car ahead (it spins), a shield
   bubble that eats one hit, a shockwave ring, the drone (last place, 3+ players) at the leader.
4. Handbrake slide until the sparks go purple, then straighten. Drive over a blue pad after a
   corner. Sit behind a car on the long straight: SLIPSTREAM.
5. Classic: no boxes or ITEM button, and the finish saves lap records.

**Verified here**

- Headless Chromium: 4 phones in an items race with all six items, hits, shields, nitro, pads and
  the SLIPSTREAM tag; ITEM button states on the phone; mode switch from the TV key and a phone.
- Unit tests: odds, boxes, rocket homing and hit, shield, oil, pads, slipstream, drift boost, a full
  4-car 3-lap items race.
- Offline render of the new sounds (preview sent in chat).
- Not verified: feel with real phones, frame rate on the M1 with every effect on screen.

## M8 - Kestrel Pines, performance foundation, touch controller

**Built**

- Cleanup: items, item boxes, drift boost, boost pads and game modes removed; slipstream is drag
  only (D-3, D-4). Motion steering and its permission flow removed. The old coastal track retired.
- Trackgen v1: an original layout file plus a small override file become stations, corridor
  chunks, a physics mesh with a surface per triangle, terrain, placements and a racing line.
  `pnpm assets:track <folder>` checks a track folder.
- Track 1 **Kestrel Pines**: an original 3.36 km club circuit in a pine forest (D-1: nothing from
  Speed Dreams is used). 18 checkpoint gates, safe-point respawn, `MIN_LAP_MS` 45 s, no pit lane.
- Render path: per-view scratch targets copied into one HDR atlas, one post chain, DPR 1 canvas with
  an always-on upscale and sharpen pass, GPU-time dynamic resolution, High/Medium/Low presets by
  player count with session drops, shader precompile and warm-up frames.
- Profiling: debug overlay (fps, p50/p99, missed, GPU ms, preset, scale, draws, triangles), debug
  keys P, N, R, B, benchmarks `?bench=auto|matrix|soak` and `?bots=1`.
- Telemetry: the TV posts performance samples to `/api/telemetry` (no IPs, no names, 90 days);
  `pnpm telemetry:report`.
- Controller: Drag steer (default) and Buttons, feathered GAS, BRAKE·R with reverse arming,
  HANDBRAKE strip, HOLD · RESET, stuck hint, R chip on pad and TV.
- Track 1 dressing: CC0 asphalt, grass, gravel and forest floor textures, kerbs, tyre walls, armco,
  instanced pines, low sun from behind the grid.
- Docs: README, DECISIONS and ROADMAP rewritten for M8; `LICENCES.md` added.

**Test**

1. `pnpm start`, open `/tv`, join with phones in Drag steer and in Buttons; race 3 laps.
2. Feather GAS, reverse from a wall (hold BRAKE·R at a standstill), HOLD · RESET, handbrake strip.
3. Backtick, then `P` (autopilot), `N` (next gate), `R` (pin scale), `B` (benchmark).
4. `/tv?bench=auto`, then `K`, `Enter`: the results table appears, then the race.

**Verified here**

- Unit tests, the gate and `pnpm build:vercel` pass on the release build (counts under the cars
  update below).
- The M8 §2.9 integration acceptance (mixed controllers, lap records, reconnect, vote, perf smoke) on
  the merged build: **pending**.
- Not verified: the owner's M1 run (spec §5.5: `?bench=auto`, the 30-minute soak, real races at
  4K and 1080p on 1, 2 and 4 players): **pending**.

**Known issues and open owner items**

- A race is 3 laps of about 1:31 on the autopilot (about 4.5-5 min per race), possibly long for a
  party game (R-24). Laps are one number in `overrides.json`.
- Car feel was tuned from measurements, not yet by people with phones.
- The car sourcing task (original-design models, a `LICENCES.md` row per candidate, a real-silhouette
  check) was finished for the cars update below.

## Cars update - five cars, car select and paint

The car part of M12, pulled forward after M8 (owner, 2026-10-12). Released together with M8; Track
1 polish (M9) is a later update (owner, 2026-10-31).

**Built**

- Five debranded cars from invented makes: Dashwood Nightjar (default), Mudlark Scree, Brazen
  Haymaker, Briganti Zanna, Arvanta Sagitta. Built by `pnpm assets:cars` from the debranded sources
  into one GLB per car with three levels of detail and a shadow stand-in. The old CC0 car, its
  `assets:car` script and the placeholder cars are gone.
- Car select on the phone join screen and through "Change car" in the lobby: a car card with a
  pre-rendered thumbnail in the chosen paint, make and model, body and drive, five stat bars and the
  credit line. The TV lobby slots show each player's car.
- Paint: the eight player colours are the eight paints (D-C1). Same car allowed, same paint refused.
- Per-car handling on top of the M8 reference car (D-C3), real wheel positions and sizes (D-C4,
  D-C9), per-car autopilot speed profile.
- TV visuals: per-viewport LOD switching with a Low floor (D-C5), paint with clearcoat and flake,
  brake lamps, contact shadow, per-car camera framing, podium with the cars.
- Reconnect and reload keep car and paint, in the lobby and mid-race.
- Credits: the TV credits panel (key `C` in the lobby), the `/credits` page, a landing footer
  link, the phone card credit line, and the README, `LICENCES.md` and `assets/ASSETS.md` entries.
- Docs: DECISIONS (Cars section, D-C1 to D-C10), ROADMAP, README.

**Test**

1. Join with three phones: two pick the same car in different paints; try a taken paint (greyed out).
2. Reload a phone in the lobby and mid-race: it comes back with the same car and paint.
3. Race with four different cars (`?bots=1`, `K` four times, backtick, `P`).
4. Press `C` in the TV lobby, and open `/credits` on a phone.

**Verified here**

- `pnpm check`: 34 test files, 321 tests passed.
  The cars gate (brand and stale-word greps) and `pnpm build:vercel` pass.
- Balance (`race/balance.test.ts`, autopilot, Kestrel Pines, before the final balance pass): spread
  0.35% (limit 1.5%, target 1.0%).

  | Car      | Lap 1 (s) | Lap 2, flying (s) | Top speed (km/h) |
  | -------- | --------- | ----------------- | ---------------- |
  | Nightjar | 94.15     | 91.00             | 169              |
  | Scree    | 94.10     | 91.10             | 159              |
  | Haymaker | 93.77     | 90.78             | 177              |
  | Zanna    | 94.17     | 91.10             | 175              |
  | Sagitta  | 93.95     | 90.90             | 164              |

- The final balance and performance pass (C7) and the cars integration acceptance (four-car race,
  paint refusal, reconnect, podium, lap records, credits, perf smoke): **pending**.
- Not verified: the owner's M1 numbers with four different cars (Low, Medium, High and the soak).

**Known issues and open owner items**

- Distinctiveness reshapes are still open. The packager changed only the rims (Nightjar, Scree and
  Zanna get generated rims), the Nightjar's grille (slats) and rear lamp colour, and the plates. Not
  done (from the line-up plan):
  - Zanna: door-mounted mirrors, a low duct instead of the roof snorkel, new engine-cover louvres,
    a centre exhaust, a new tail-light graphic, its own front light signature, simpler front blades.
  - Nightjar: new headlamp outline with twin LED blades, removing the front fender blade, side-window
    and C-pillar outline, a segmented tail graphic, ducktail, diffuser and exhaust, new mirrors.
  - Haymaker: a new front (slim lamps or a light bar, slatted grille, trapezoid intake), an offset
    bonnet scoop, door mirrors, a new rear and quarter window, the missing left inner headlamp lens.
  - Sagitta: its own headlight signature, a finished rear (diffuser fins, light bar, wing), a side
    intake, a minimal cockpit, smaller wheels with a wider rear track.
  - Scree: split blade lamps and a real grille, a segmented rear bar, lower ducktail, its own wing,
    C-pillar and roof vent, an 8-10% narrower body, and the look that sets it apart from the
    Haymaker (taller, mudflaps, light pod).
- The owner signs off each car from its contact sheet (`/tools/thumbs?sheet=<id>`).
- Car licences: verified on the Sketchfab API at sourcing (2026-10-10); the re-check could not
  reach the API from the build machine, so the `LICENCES.md` rows say re-verify. The Sagitta's source
  is dedicated to CC0 while Sketchfab labelled it "Free Standard" (R-C3, Q2): the owner's call, and
  an archived copy of the page is still to be saved.
- Every car uses the same synthesised engine sound (per-car engines are M11).
