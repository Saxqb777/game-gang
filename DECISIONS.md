# Decisions

Where the build differs from the brief, and why. This file describes the current build; what each
milestone changed is in `PROGRESS.md`. Tunable values live in `client/src/games/splitways/config.ts`.

## Names

- Gamer Gang = platform (lobby, pads, slots). Split Ways = game (`client/src/games/splitways/`).
  Kestrel Pines = track (id `kestrel-pines`).
- The brief's `client/src/game/config.ts` is `client/src/games/splitways/config.ts`.
- Never a real circuit name, a real corner name or "Forza". "Kestrel Pines" was checked on
  2026-10-10: no real circuit or venue uses it.

## Transport

- Vercel + Neon, no game server. The TV browser hosts the game.
- WebRTC data channels, pre-negotiated (no `ondatachannel` wait):
  - `input`: unordered, no retransmits. The TV drops inputs older than the newest `t`.
  - `state`: reliable, ordered. Also carries the pad's `action` messages (reset), because a lost
    press would be a lost reset.
- Signaling over `/api/room` and `/api/signal`, with Neon as the mailbox.
  - The pad makes the offer.
  - Offer/answer go out after ICE gathering (max 1 s); late candidates trickle.
  - Each handshake attempt has a session id; stale messages are ignored.
- Polling: pads every 500 ms during a handshake only. The TV every 500 ms during a handshake, otherwise
  1 s in the lobby and 2 s in a race (to see new pads and keep the room alive).
- Keepalive: ping every 1 s. 5 s of silence = dead link; the pad re-handshakes with the same id and
  gets its slot back. A `bye` beacon on tab close frees the slot right away.
- Pad id is random per tab (sessionStorage), so a reload keeps the same car. Two tabs = two players.
- STUN: Google. TURN: optional `TURN_URL` / `TURN_USER` / `TURN_PASS`, handed out by the API, never
  in the bundle.
- Fallback if WebRTC fails on real phones: Ably or PartyKit behind `HostTransportPort` /
  `PadTransport`. Not needed so far, but only verified headless.

## API and database

- One Vercel function for all `/api/*` (symlinked `.func` dirs), so one warm instance. Routes:
  `/api/room`, `/api/signal`, `/api/laps`, `/api/telemetry`.
- Build Output API (`scripts/build-vercel.mjs`): esbuild bundles the API and `shared` into one CJS file.
- Neon over HTTP. Each request is one transaction: cleanup, room touch, statement.
- Expiry without cron: every call deletes rooms idle for 10 min and signals older than 2 min.
- Tables are created on first use. `pnpm db:migrate` does it up front.
- Extra column `rooms.host_key`: a secret only the TV has. Required to read the TV inbox, answer as
  the TV, post laps or post telemetry, so guessing a room code is not enough to hijack it.
- Room codes use consonants only, so they never spell words.
- Empty `DATABASE_URL` → PGlite (in-memory Postgres), same SQL. Tests and local dev without `.env`
  use it, so test data never reaches Neon.
- zod validates every API request and every data channel message.

## Local dev

- `pnpm dev`: http://localhost:4000 for the TV, https://LAN-IP:4443 for phones. Phones use https
  because the Wake Lock API needs a secure page. The LAN port uses a self-signed cert (cached per
  LAN IP, accepted once per phone). HMR works on both.
- LAN IP: `en0` first, then any private IPv4.
- Node 20.19+ (Vite 8). Vercel runs Node 22.

## Protocol additions

- `ready { ready }` so players can un-ready.
- `join` can be re-sent (rename, recolour, after a reconnect).
- `lobby` adds `slot`, `connected`, `inGame`, `votes`, `votesNeeded`.
- New messages: `results`, `ping` / `pong` (keepalive and round trip time), `action` (pad → TV,
  `reset` only).
- Split Ways race status to each pad (position, lap, speed, `reverse`, `hint`, `resetReady`) at
  5 Hz, and pushed at once when `reverse`, `hint` or `resetReady` change (at most every 50 ms).
- `kicked` only for `full`.
- Players who join mid-race wait in the lobby for the next one.

## Pad

- Two modes: **Drag steer** (default) and **Buttons**. Saved in localStorage, switchable from the
  settings button at any time, also mid-race. Pointer Events, touch only.
  - Drag steer: the thumb's horizontal travel from where it landed, full lock at 25% of the screen
    height. Overdragging moves the origin, so coming back steers at once. A ghost wheel shows it.
  - Buttons: the arrows ramp steering to full lock in 0.2 s and back in 0.1 s.
- The pad sends raw steering. The TV processes every mode the same way (pad drag, pad buttons,
  keyboard): dead zone 0.05, response curve (gamma 1.5), 0.04 s low-pass. Steering lock and the
  deg/s rate limit stay in the car.
- GAS is analog: sliding down the pedal feathers it (30% of the pedal height = off). Throttle goes
  out in 0.05 steps, so thumb wobble is not news.
- Reverse is explicit: hold BRAKE·R (no gas) at a standstill for 0.35 s. The pad fills a ring, the
  label turns to REVERSE and an R chip lights on the pad and the TV HUD. Letting go of the brake
  leaves reverse. Keyboard players do the same with S or ↓.
- Stuck help: gas held for 2 s without moving shows "Hold BRAKE to reverse" (or "Let go of GAS ·
  hold BRAKE to reverse" while both are held) on the pad and the TV. Keyboard players see the key
  names instead.
- Reset: "HOLD · RESET" for 0.6 s sends `action: reset`. The TV answers with `resetReady`, so the
  button greys out during the 3 s cooldown and outside racing. Keyboard: `Q` (WASD set), `Enter`
  (arrows set).
- Handbrake: a press strip next to the pedals.
- The input failsafe stays 600 ms in M8: after that long without input the TV coasts the car. The
  250 ms failsafe, 60 Hz binary input and the slide-from-GAS handbrake are M11 (D-10).
- Inputs go out on change (max 30/s) plus a 100 ms heartbeat, because the input channel is lossy.

## Car and physics

- Model: "Sports" from Rgsdev's CC0 Free Low Poly Vehicles Pack. The source is FBX only, so
  `pnpm assets:car` converts it: hash check, scaled to 4.6 m, wheels centred on their axles, material
  groups merged (220 → 14 draw calls), 66 KB GLB. Materials are replaced at runtime (clearcoat paint
  per player).
- Axes: +Y up, cars face +Z, right is -X. Steer +1 = right.
- Rapier raycast vehicle, fixed 60 Hz, rendering interpolated between steps. A frame is clamped to
  0.1 s and runs at most 5 physics steps, so on a very slow machine game time runs slower than wall
  time.
- Gravity 13 instead of 9.81: heavier feel, more grip, shorter jumps.
- Arcade assists: speed-sensitive steering, downforce, anti-roll, yaw limiter, slide alignment
  (stronger while counter-steering), air levelling.
- Brake + steer above 12 m/s cuts rear grip (oversteer). Handbrake cuts rear grip and locks the
  rear wheels.
- Surfaces: every physics triangle carries a surface (asphalt, kerb, grass, gravel). Each wheel
  reads the surface under it for grip and rolling drag; grass and gravel slow the car hard.
- Slipstream is aero only (D-3): within 16 m behind a car above 20 m/s, up to 55% less air drag. No
  push.
- Measured at M1, asserted (with margins) in `sim/car.test.ts`:

  | Measure                          | Value                           |
  | -------------------------------- | ------------------------------- |
  | 0-100 km/h                       | 3.6 s                           |
  | Top speed                        | ~176 km/h                       |
  | 140-0 km/h                       | 64 m                            |
  | Peak cornering grip              | ~2.6 g                          |
  | Full lock at top speed           | slides at 22°, no wheel lifts   |
  | Brake tap mid-corner at 100 km/h | 15° tail slide                  |
  | Handbrake drift at 100 km/h      | caught with counter-steer in 2s |

<!-- M8-FINAL: re-measure this table on the merged build (P2 added per-wheel surface grip and
rolling drag) or drop the numbers that changed. -->

- Tuned from measurements, not yet by a person with a phone. Grip, steering rate and slides will
  need a pass after the first real session (M9 polish).
- No allocation per frame. Exceptions: collision events (rare) and the debug overlay (hidden by
  default).

## Track and race

- **Trackgen v1** (`track/gen/`) builds the track from data: an original layout file
  (`base.layout.json`, a zod-validated list of straights and arcs with spiral entries, elevation,
  bank, widths, kerbs, run-off and barriers per segment) plus a small `overrides.json` (laps,
  checkpoints, closure handles). It integrates the centre line with elevation and banking,
  distributes the closure error, and resamples stations 1 m apart (many constants count stations as
  metres).
- From the stations: corridor meshes (road, kerbs, run-off, barriers) in 150 m chunks, one physics
  mesh with a surface per triangle, convex wall hulls, a terrain heightfield blended into the
  corridor over a 12-28 m shoulder, placements (pines, tyre walls, distance boards, marshal posts,
  seeded from the track id), and a racing line with a speed profile.
- `pnpm assets:track <folder>` only checks a track folder's own files. There is no importer from any
  other format.
- **Kestrel Pines:** original layout, 3358.9 m, counter-clockwise, 3 laps, 12 corners, -6.5 to
  +15.5 m elevation, road 13-14 m wide, bank within ±0.10 rad. Gravel and tyre walls outside the five
  slow corners, grass and armco elsewhere. Checked against 196 circuit outlines: no real circuit
  closer than 0.200. Any geometry change needs that check re-run.
- No pit lane (D-6).
- 18 checkpoint gates, each a short box across the road at a station. Only the next gate counts.
- Respawn at a safe point: the car goes back to 10 m behind the last place it was on the road (before
  the first gate: 10 m behind the line), in its own lane. Triggers: on its side or roof for 3 s, stuck
  for 6 s, off the track, or a manual reset.
- Lap 1 is timed from green, later laps line to line.
- Positions: finish time, then gates passed, then distance along the track.
- Countdown: 3 s, cars held on the handbrake, 3 red gantry lamps then green, phones buzz.
- When the winner finishes the rest get 30 s, then DNF. Podium 3 s later. PLAY AGAIN needs a
  majority of connected phones. Keyboard only: Esc.
- Lap records: the TV posts best laps with its host key; the results screen shows the top 8 by name
  for Kestrel Pines. `MIN_LAP_MS` is 45 s (D-5): shorter laps are not posted. Rows for the
  retired track id stay in the database but no route reads them.
- `debug/autopilot.ts` (backtick, then P) follows the racing line. It is a test tool, not an AI
  opponent.

<!-- M8-FINAL: add the autopilot lap and race times on Kestrel Pines from the 2.9 run, and check the
respawn wording against the merged P2 race.ts. -->

## Rendering

- One WebGL renderer, one scene; each viewport has its own camera. The canvas runs at
  devicePixelRatio 1 (D-9).
- Each view renders at its own internal resolution into a scratch target (with MSAA), and is copied
  into its tile of one shared HDR atlas (D-7). A scratch target plus a copy, because three resolves
  MSAA by blitting the whole target and blit-scissor behaviour differs between drivers. Tiles have a
  16 px black border, so bloom never bleeds across viewports.
- One post chain for the whole atlas: bloom, grade, ACES, vignette (clamped per viewport), then
  composite into an LDR atlas and one always-on upscale + RCAS sharpen pass to the canvas (D-9).
  Sharpening is a uniform: 0 at 1:1 (1080p at DPR 1), on when the browser upscales (DPR above
  1.25). 1080p and 4K share the same programs, so nothing compiles mid-race.
- Not three's EffectComposer: it would mean full-screen passes per effect and per viewport.
- Dynamic resolution is driven by GPU time (`EXT_disjoint_timer_query_webgl2`): the median GPU time
  above 88% of the frame interval drops the scale 0.05; below 65% for 2 s raises it. Without a GPU
  timer it falls back to missed frames. Debug key R pins it.
- Presets by player count: High for 1, Medium for 2, Low for 3-4. A short loading benchmark can
  start one preset lower. A race that spent 20% of its time at the scale floor, or missed 1% of
  frames, starts the next race one preset lower (session memory, kept across TV reloads). Presets
  never change during a race.
- Shadows: three's SunLight (two cascades refit per view) on High and Medium; on Low one directional
  light whose shadow box is re-aimed at the car being drawn, one shadow pass per view. Cars cast
  shadows through a fixed merged stand-in mesh that only the shadow camera sees.
- Shaders precompile on the loading screen (`compileAsync` with the HDR scratch bound), then 3 warm-up
  frames run through the same post path. The overlay counts late programs. The podium's first frame
  still compiles a little; that hitch is accepted.
- The refresh rate is measured on an idle page during loading, so it reports the display, not the
  game.
- With 3 players the 4th cell is a live overview camera. It costs the same as a 4th player, which
  is the budget anyway.
- Name tags ignore depth (visible through walls) and are hidden in your own view.

## Look

- Sky: Poly Haven "Syferfontein 18d Clear (Pure Sky)", 2k HDR (4 MB), kept for M8 (D-8). Its sun is
  at 18°, which is also the directional light's elevation, so the visible sun, shadows and
  clearcoat reflections agree.
- The HDRI is edited at load: the sun capped for lighting (the directional light is the sun) and for
  the visible sky (bloom stays a glow), and a dark smudge near the horizon painted out.
- Haze: three's fog chunks are replaced so exponential fog takes the sky's horizon colour in each
  direction (16 compass bins measured from the HDRI). Terrain and forest fade into the sky with no
  edge.
- Skid marks: ring buffer of 8000 quads, one draw call, only new segments uploaded once per frame.
  Dust and smoke: 700 instanced puffs.
- Minimap: a 2D canvas per viewport, redrawn 30 times a second.

<!-- M8-FINAL: P5 facts: CC0 asphalt, sawtooth kerbs with stripes, the track mask and rubber line,
grass and gravel run-off, instanced pines (count per preset), tyre walls, armco, blob AO under
cars, sun bearing and colour for the forest, camera values (ART-DIRECTION items 1-11 and 14), and
what replaced the HDRI's below-horizon fill. -->

## Feel

- All sound is synthesised with Web Audio: no files to license, download or decode, and the engine
  can follow the car exactly.
- Engine: sawtooth at the firing rate (4 pulses per rev, like a V8) plus a square an octave down,
  soft-clipped, low-passed by throttle. A fake six-speed gearbox sets the revs; upshifts dip the
  volume for 90 ms. Holding gas on the grid revs the engine.
- Per car: tyre screech (band-passed noise by slide speed), wind (by speed squared), surface rumble
  (asphalt, kerb, grass, gravel), horn. One-shots: impacts (noise burst + thump, by hit strength),
  countdown beeps, crowd applause at each finish and on the podium.
- Each car is panned towards its viewport's side of the screen. A compressor on the master output
  stops four engines plus a crash from clipping.
- Browsers only start audio after a click or key press on the TV page; the TV shows a "Sound is off"
  hint until then.

<!-- M8-FINAL: confirm surface rumble drives audio and camera in the merged build (P2 SURFACES). -->

## Removed in M8

- Items, item boxes, the item HUD slot, the phone item button, item sounds and visuals: gone.
- Drift boost and boost pads: gone. Slipstream stays as drag reduction only (D-3).
- Game modes: removed completely (D-4). There is one way to race; lap records come from every race.
- Motion steering and its permission flow: gone. Drag steer and Buttons replace it.
- The old coastal track and its theme (sea, city, palms, dunes): retired. Kestrel Pines replaces it.
- The `action` channel message now carries only `reset`.

## Telemetry

- `POST /api/telemetry`, TV only, host key required, no GET route. Kinds: `loading-benchmark`,
  `flythrough`, `race`, `soak`. Each sample has frame-time stats, CPU and GPU ms, resolution and
  scale, preset and drops, viewports, draw calls and triangles; each request has a device block
  (user agent, GPU name, cores, memory, screen, devicePixelRatio, refresh, timer query) and the
  build commit.
- No IP addresses and no player names are stored. Kept 90 days; at most 40 rows per room per
  10 minutes and 2000 rows per hour overall.
- The client sanitises samples (round, clamp, NaN → null or 0) and splits batches into 8 samples per
  request, because one bad value would reject the whole request.
- `pnpm telemetry:report [--since 24h] [--session <id>]` reads them from Neon.

## Performance pass definition ("locked 60")

Raw frame deltas jitter around 16.7 ms even when no frame is missed, so p99 of raw deltas alone is
not the test. A measured window passes when:

- **With a GPU timer** (`timerQuery: true`): `gpuMsP99 < 16.7`, `cpuMsP99 < 16.7`,
  `missedFrames / frames < 0.5%` (missed = a frame gap above 1.5 × the refresh interval), and
  `presetDrops = 0` for the player count's preset.
- **Without a timer:** `frameMsP99 < 18.0`, `missedFrames / frames < 0.5%`, and no drops.
- The measured `refreshHz` must be 60; at 50 or 30 Hz the run is invalid.

Done for M8 means: 4 players on Low, 2 on Medium and 1 on High each hold this for a full race on
Kestrel Pines on the MacBook Air M1 (4K and 1080p output), and a 30-minute soak at 4 viewports on Low
(`?bench=soak&bots=1`) keeps p99 under 16.7 ms with no preset drop. The owner may tighten this.

## Licences

- **D-1** (owner, 2026-10-10): Track 1 uses an original layout owned by the project. Nothing from
  Speed Dreams is used or shipped: no tracks, cars, sounds, textures, models or code. Speed Dreams
  1.4 data was reviewed first: its track readmes say Free Art License, but every track XML carries a
  GPLv2-or-later header, so the licence could not be confirmed. The review is recorded in
  `LICENCES.md`.
- **D-2** (track data packaging): track data lives only in `assets/tracks/<id>/`
  (`base.layout.json`, `overrides.json`), is fetched at runtime and never bundled into JS. Each file
  carries its own `licence` and `credits` fields (JSON has no comments). Kestrel Pines is
  project-owned, so it has no separate licence file; its `LICENCES.md` row records where it came
  from.
- Every third-party source gets a `LICENCES.md` row before anything is derived from it or added.
  `assets/ASSETS.md` lists every shipped file with its source and licence.

## Decision index

- D-1: original Track 1 layout; nothing from Speed Dreams (owner, 2026-10-10).
- D-2: track data packaging.
- D-3: slipstream is drag-only.
- D-4: game modes removed completely.
- D-5: the old track id is retired from the track ids; `MIN_LAP_MS` is 45 s.
- D-6: no pit lane in M8.
- D-7: scratch target plus copy into a shared HDR atlas.
- D-8: keep the existing HDRI.
- D-9: one post path for every frame; DPR 1 canvas, always-on upscale + RCAS (sharpening off at
  1:1).
- D-10: controller v2 stays in M11: 600 ms input failsafe, direct handbrake press.
- Owner, 2026-10-10: one track only for now. After M8 goes live, polish Kestrel Pines (visuals, car
  feel, sound), push each improvement live when green, then stop for the owner's playtest. Track 2
  and Track 3 (old M9 and M10) are dropped for now.
