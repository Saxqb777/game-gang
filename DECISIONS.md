# Decisions

Where the build differs from the brief, and why. Tunable values live in
`client/src/games/splitways/config.ts`.

## Names

- Gamer Gang = platform (lobby, pads, slots). Split Ways = game (`client/src/games/splitways/`).
  Corniche Run = track.
- The brief's `client/src/game/config.ts` is `client/src/games/splitways/config.ts`.

## Transport

- Vercel + Neon, no game server. The TV browser hosts the game.
- WebRTC data channels, pre-negotiated (no `ondatachannel` wait):
  - `input`: unordered, no retransmits. The TV drops inputs older than the newest `t`.
  - `state`: reliable, ordered.
- Signaling over `/api/room` and `/api/signal`, with Neon as the mailbox.
  - The pad makes the offer.
  - Offer/answer go out after ICE gathering (max 1 s); late candidates trickle.
  - Each handshake attempt has a session id; stale messages are ignored.
- Polling: pads every 500 ms during a handshake only. The TV every 500 ms during a handshake, otherwise
  1 s in the lobby and 2 s in a race (to see new pads and keep the room alive).
- Keepalive: ping every 1 s. 5 s of silence = dead link; the pad re-handshakes with the same id and
  gets its slot back. A `bye` beacon on tab close frees the slot right away.
- Pad id is random per tab (sessionStorage). Two tabs = two players.
- STUN: Google. TURN: optional `TURN_URL` / `TURN_USER` / `TURN_PASS`, handed out by the API, never
  in the bundle.
- Fallback if WebRTC fails on real phones: Ably or PartyKit behind `HostTransportPort` /
  `PadTransport`. Not needed so far, but only verified headless.

## API and database

- One Vercel function for all `/api/*` (symlinked `.func` dirs), so one warm instance.
- Build Output API (`scripts/build-vercel.mjs`): esbuild bundles the API and `shared` into one CJS file.
- Neon over HTTP. Each request is one transaction: cleanup, room touch, statement.
- Expiry without cron: every call deletes rooms idle for 10 min and signals older than 2 min.
- Tables are created on first use. `pnpm db:migrate` does it up front.
- Extra column `rooms.host_key`: a secret only the TV has. Required to read the TV inbox, answer as
  the TV or post laps, so guessing a room code is not enough to hijack it.
- Room codes use consonants only, so they never spell words.
- Empty `DATABASE_URL` → PGlite (in-memory Postgres), same SQL. Tests use it.
- zod validates every API request and every data channel message.

## Local dev

- `pnpm dev`: http://localhost:4000 for the TV, https://LAN-IP:4443 for phones. Gyro and wake lock
  need https, so the LAN port uses a self-signed cert (cached per LAN IP, accepted once per phone).
  HMR works on both.
- LAN IP: `en0` first, then any private IPv4.
- Node 20.19+ (Vite 8). Vercel runs Node 22.

## Protocol additions

- `ready { ready }` so players can un-ready.
- `join` can be re-sent (rename, recolour, after a reconnect).
- `lobby` adds `slot`, `connected`, `inGame`, `votes`, `votesNeeded`.
- New messages: `results`, `ping` / `pong` (keepalive and round trip time).
- `kicked` only for `full`.
- Players who join mid-race wait in the lobby for the next one.

## Pad

- Tilt (default) or Buttons. Saved in localStorage, switchable from the settings button.
- The JOIN tap requests iOS motion permission. Denied, not https, or no sensor data in 1.5 s →
  Buttons with a note.
- Inputs go out on change (max 30/s) plus a 100 ms heartbeat, because the input channel is lossy.
  The TV coasts a car after 600 ms without input.

## Car and physics

- Model: "Sports" from Rgsdev's CC0 Free Low Poly Vehicles Pack. The source is FBX only, so
  `pnpm assets:car` converts it: hash check, scaled to 4.6 m, wheels centred on their axles, material
  groups merged (220 → 14 draw calls), 66 KB GLB. Materials are replaced at runtime (clearcoat paint
  per player).
- Axes: +Y up, cars face +Z, right is -X. Steer +1 = right.
- Rapier raycast vehicle, fixed 60 Hz, rendering interpolated between steps.
- Gravity 13 instead of 9.81: heavier feel, more grip, shorter jumps.
- Arcade assists: speed-sensitive steering, downforce, anti-roll, yaw limiter, slide alignment
  (stronger while counter-steering), air levelling, reverse.
- Brake + steer above 12 m/s cuts rear grip (oversteer). Handbrake cuts rear grip and locks the
  rear wheels.
- Measured, and asserted in `sim/car.test.ts`:

  | Measure                          | Value                           |
  | -------------------------------- | ------------------------------- |
  | 0-100 km/h                       | 3.6 s                           |
  | Top speed                        | ~176 km/h                       |
  | 140-0 km/h                       | 64 m                            |
  | Peak cornering grip              | ~2.6 g                          |
  | Full lock at top speed           | slides at 22°, no wheel lifts   |
  | Brake tap mid-corner at 100 km/h | 15° tail slide                  |
  | Handbrake drift at 100 km/h      | caught with counter-steer in 2s |

- Tuned from measurements, not yet by a person with a phone. Grip, steering rate and drift will need
  a pass after the first real session.
- No allocation per frame. Exceptions: collision events (rare) and the debug overlay (hidden by
  default).

## Rendering

- One renderer, one scene; each viewport is a scissored rect with its own camera.
- With 3 players the 4th cell is a LIVE overview camera. It costs the same as a 4th player, which is
  the budget anyway.
- The sun's shadow is re-aimed per viewport and snapped to texels. 2048 px, 1024 with 3-4 players.
  `PCFShadowMap` + `radius` (three r186 deprecated `PCFSoftShadowMap`).
- Name tags ignore depth (visible through walls) and are hidden in your own view.

## Track and race

- Corniche Run: 26 control points → closed centripetal Catmull-Rom, sampled every 1 m. Road, kerbs,
  markings, barriers, physics, checkpoints, grid and terrain all come from the samples. A new track
  is a new point list.
- 1204 m, ~10 corners, 13.4 m hairpin radius, two ~225 m straights, a fast S, 0.6-3.6 m elevation.
- +X east, +Z south, anticlockwise: the infield is always on the left. Railings where the road runs
  by the sea, jersey barriers elsewhere.
- Collision: road + shoulders are one trimesh (`FIX_INTERNAL_EDGES`). Walls are 1 m boxes, 2.6 m
  tall, every 4 m. A floor 6 m below catches anything that escapes (→ respawn).
- 8 checkpoints are oriented boxes tested point-in-box every step (no sensor events; 6 m deep so
  nothing skips one). Only the next gate counts.
- 3 laps. Lap 1 is timed from green, later laps line to line.
- Positions: finish time, then gates passed, then distance to the next gate. Track projection only
  searches near the previous sample, so the two legs of the hairpin never swap.
- Countdown: 3 s, cars held on the handbrake, 3 red gantry lamps then green, phones buzz.
- When the winner finishes the rest get 30 s, then DNF. Podium 3 s later. PLAY AGAIN needs a
  majority of connected phones. Keyboard only: Esc.
- Leaderboard (planned for M4) shipped with M3 because it belongs on the results screen. The TV posts
  best laps with its host key; top 8 by name.
- Respawn: on the roof for 3 s, stuck for 3 s, or off the track → fade out, last gate, own lane,
  fade in.
- `debug/autopilot.ts` (backtick, then P) is a test tool, not an AI opponent. Tests use it for full
  4-car races: ~40 s laps, ~2:10 per race.

## Look (M4)

- Per viewport: scene → half-float target with 4x MSAA → 4-level bloom → one composite pass (warm
  grade, ACES, vignette, speed lines, sRGB, dither) into that viewport's part of the canvas.
  Viewports render one after another and share the targets, so memory is one viewport's worth and
  bloom never bleeds across the seams. The canvas itself has no anti-aliasing or depth buffer.
- Not three's EffectComposer: it would mean full-screen passes per effect and no per-viewport
  effects.
- Dynamic resolution: measured over 1 s windows. Below 55 fps the 3D view drops 10% (minimum 60%);
  after 5 s at 60 fps it steps back up; a raise that fails doubles the wait. Debug key R pins it.
- Sky: Poly Haven "Syferfontein 18d Clear (Pure Sky)", 2k HDR (4 MB). Its sun is at 18°, which
  is also the directional light's elevation, so the visible sun, shadows and clearcoat reflections
  agree (a lower-sun sky with a higher light would show two suns on the paint).
- Sun bearing 240 (WSW): behind you on the start straight, straight ahead on the inland straight.
- The HDRI is edited at load: sun capped at 8 for lighting (the directional light is the sun) and
  40 for the visible sky (bloom stays a glow); below the horizon, sand for lighting and the horizon
  colour for the visible sky; a dark smudge near the horizon painted out.
- Haze: three's fog shader chunks are replaced so exponential fog takes the sky's horizon colour in
  each direction (16 compass bins measured from the HDRI). Land and sea fade into the sky with no
  edge.
- Sea: one plane with the standard PBR material, two drifting layers of procedural ripple normals,
  turquoise shallows from the distance to the shoreline function, foam at the waterline.
- Skid marks: ring buffer of 8000 quads, one draw call, only new segments uploaded once per frame.
  Dust and smoke: 700 instanced puffs.
- Scenery is instanced or merged with seeded placement (about 10 draw calls). The dunes flatten
  into the city west of x = -215.
- Cars cast shadows through one merged stand-in mesh on its own layer (only the shadow camera sees
  it): 14 → 1 draw call per car per shadow pass. 4 players: 724 → 481 draw calls per frame.
- Minimap: a 2D canvas per viewport, redrawn 30 times a second.
- Fixed an M3 bug: the empty "Reconnecting" overlay (35% black) was always on, because its class
  set `display`, which beats the `hidden` attribute. M3 screenshots were darker than intended.
