# Decisions

Why things are the way they are. Newest milestone at the bottom of each section.

## Naming

- **Gamer Gang** is the platform (hub): lobby, QR, pad connection, player slots, game picker.
- **Split Ways** is the first game. Its code lives in `client/src/games/splitways/`. The track is **Corniche Run**.
- The brief's `client/src/game/config.ts` therefore lives at `client/src/games/splitways/config.ts`.

## Deployment and transport (overrides the original "local only + socket.io" brief)

- **Stack is Vercel + Neon only.** No long-running server. The TV browser is the game host.
- **WebRTC data channels** carry all gameplay traffic, directly between each phone and the TV:
  - `input` channel: unordered, `maxRetransmits: 0`. A late steering packet is worse than a lost one.
    The TV drops any input whose `t` is older than the newest one it has seen.
  - `state` channel: reliable and ordered, for join/lobby/ready/vote/race/results/haptics.
  - Both channels are **pre-negotiated** (`negotiated: true`, fixed ids) so neither side waits for
    `ondatachannel`.
- **Signaling** goes through `/api/room` and `/api/signal` (Vercel functions) with Neon as the mailbox.
  - The **pad makes the offer** (it knows the TV exists; the TV does not know the pad yet).
  - Offers/answers are sent once ICE gathering finishes or after 1 s, so they usually carry all
    candidates in one message. Late candidates are trickled as separate messages. This keeps the
    number of 500 ms polling round trips to a minimum.
  - Each handshake attempt has a `session` id so stale messages from an old attempt are ignored.
- **Polling cadence.** Pads poll every 500 ms only while handshaking, then never touch the API again.
  The TV cannot go fully silent: it must notice new pads joining and keep its room alive (rooms expire
  after 10 minutes without activity). So the TV polls every 500 ms while a handshake is in flight,
  otherwise every 1 s in the lobby/results and every 2 s during a race (only reconnects can happen then).
- **Keepalive.** The TV pings every pad once a second over the state channel; the pad answers.
  Either side treats 5 s of silence as a dead link. The pad then silently runs a fresh handshake with
  the same client id, and the TV gives it back the same slot/car. A `bye` beacon on `pagehide` lets the
  TV free a slot immediately when a tab is closed.
- **Pad identity** is a random id per browser tab (sessionStorage). It survives reloads and reconnects,
  and two tabs on one phone are two players (handy for testing).
- **STUN** is Google's public servers. **TURN** is optional via `TURN_URL`, `TURN_USER`, `TURN_PASS`
  (server-side env vars, handed to clients by the API at runtime, never baked into the bundle).
  Phones on the same wifi as the TV normally connect directly; phones on cellular or isolated guest
  wifi may need TURN.
- **Fallback plan.** If WebRTC proves unreliable on real phones, swap the transport for Ably or
  PartyKit. The hub only talks to `HostTransportPort` (`client/src/net/hostTransport.ts`) and the pad
  only to `PadTransport`, so that is a contained change. Verified so far: handshake, data channels,
  reconnect and `bye` between headless Chromium pages through the real API. Not yet verified: real
  iPhone/Android on home wifi (needs the user's devices).

## API and database

- **One Vercel function** serves all `/api/*` routes (`room`, `signal`, `laps` are symlinks to the same
  `.func`, which the Build Output API documents as one backing function). One warm instance instead of
  three cold ones.
- **Build Output API** (`scripts/build-vercel.mjs` writes `.vercel/output`) instead of the zero-config
  `/api` folder. esbuild bundles the TypeScript API and the shared workspace package into one CommonJS
  file, so there is no dependence on how Vercel compiles workspace TypeScript or ESM import extensions.
- **Neon over HTTP** (`@neondatabase/serverless` `neon()`): no pool to manage in a serverless function.
  Each request is one HTTP round trip: cleanup + room touch + the actual statement run as a single
  non-interactive transaction.
- **Expiry without cron**: every API call first deletes rooms idle for 10 minutes (signals cascade) and
  signals older than 2 minutes.
- **Schema is created lazily**: if a query fails with "relation does not exist" the API creates the
  tables and retries. `pnpm db:migrate` exists for doing it up front. Adding env vars on Vercel is all
  the setup needed.
- **`rooms.host_key`** is one column more than the brief listed. It is a random secret the TV gets when
  it creates the room; only its holder can read the TV's inbox, answer as the TV, or post lap times.
  Without it anyone who knows a 4 letter code could hijack handshakes.
- **Room codes** use consonants only (`BCDFGHJKLMNPQRSTVWXZ`), so random codes never spell words.
- **Local dev without Neon**: when `DATABASE_URL` is empty the local server uses PGlite (Postgres
  compiled to WASM, in memory). It runs the exact same SQL as production, and the tests use it too.
- **Validation.** There is no relay server any more, so "validate on the server" became: the API
  validates every request with zod, and each peer validates every data channel message with the zod
  schemas in `shared/` and silently drops anything malformed.
- `shared/` has exactly one runtime dependency, **zod**, because the brief also asks for the zod
  schemas to live in `shared/protocol.ts`.

## Local development

- `pnpm dev` serves **http://localhost:4000** (the TV; localhost already counts as a secure page) and
  **https://LAN-IP:4443** (phones). Phones only expose the gyroscope and wake lock to secure pages, so
  the LAN port uses a self-signed certificate generated on first run and cached per LAN IP. Each phone
  accepts the warning once. Vite hot reload works on both ports.
- The LAN IP prefers `en0` (Wi-Fi on macOS), then any private IPv4.
- The terminal prints the pad URL + QR on start, and each room's join QR whenever a TV page creates one.
- Node **20.19+** is required (Vite 8). Vercel functions run on `nodejs22.x`.

## Protocol details beyond the brief

- `ready` carries `{ ready: boolean }` so a player can un-ready.
- `join` can be re-sent to change name/colour, and is re-sent automatically after a reconnect.
- `lobby` also carries `slot`, `connected` and `inGame` per player, plus the play-again `votes`.
- `results` (final standings) and `ping`/`pong` (keepalive + round trip time for the debug overlay) were
  added. `kicked` only has `full`; everything else is handled by reconnecting.
- Late joiners during a race are accepted into a free slot and wait in the lobby for the next race.

## Pad controls

- Two steering modes, picked on the join screen and switchable any time from the settings button:
  **Tilt** (default) and **Buttons** (hold left/right, steering ramps to full over ~150 ms and back).
  The choice is remembered in localStorage.
- The JOIN tap is the user gesture that asks iOS for motion permission (and Android for fullscreen).
  If permission is denied, the page is not secure, or no sensor reports within 1.5 s, the pad drops to
  Buttons with a short note.

## M1: driving

- **Car model:** "Sports" from the CC0 _Free Low Poly Vehicles Pack_ by Rgsdev (OpenGameArt). The
  source is FBX only, so `pnpm assets:car` (`client/scripts/build-car-model.mjs`) downloads the pack,
  checks its hash, bakes transforms, scales to a 4.6 m car, re-centres each wheel on its axle, smooths
  normals on gentle curves while keeping panel edges sharp, merges the 80+ material groups into one
  per material (220 -> 14 draw calls per car) and writes `assets/models/sports-car.glb` (66 KB).
  All materials are replaced at runtime by our own PBR set (clearcoat paint tinted per player, dark
  glossy glass, chrome rims, emissive head/tail lights; tail lights flare when braking).
- **Coordinate convention:** +Y up, cars face +Z, right is -X. Steering input +1 = right.
- **Physics:** Rapier `DynamicRayCastVehicleController`, fixed 60 Hz, render interpolates between the
  last two physics states. Gravity is 13 m/s^2 (not 9.81): cars feel heavier, grip harder and land
  jumps sooner. Car mass and inertia are set explicitly with a low centre of mass instead of coming
  from the collider shape.
- **Arcade assists on top of the raycast vehicle** (all in `config.ts`): speed-sensitive steering
  angle and steering rate, engine falloff towards top speed, drag + rolling resistance, downforce
  ~ speed^2, anti-roll and pitch damping, a yaw-rate limiter (spins stay recoverable), slide alignment
  that is boosted when you counter-steer, air levelling, reverse when holding brake at a standstill.
  Brake-induced oversteer lowers rear side grip while braking with steering above 12 m/s; the
  handbrake drops rear grip and side stiffness and locks the rear wheels.
- **Tuned numbers, measured headlessly** (`client/src/games/splitways/sim/car.test.ts` asserts them):

  | Measure                          | Value                                                            |
  | -------------------------------- | ---------------------------------------------------------------- |
  | 0-100 km/h                       | 3.6 s                                                            |
  | 0-150 km/h                       | 7.0 s                                                            |
  | Top speed                        | ~176 km/h (asymptotic, engine fades towards 187)                 |
  | 140-0 km/h                       | 64 m (~1.2 g)                                                    |
  | Peak cornering grip              | ~2.6 g (gravity 13 x grip 1.9 + downforce)                       |
  | Full lock at 46 km/h             | ~6 m radius, 8 deg slip                                          |
  | Full lock at top speed           | slides (22 deg slip), sheds ~50 km/h in 2 s, never lifts a wheel |
  | Mid-corner brake tap at 100 km/h | 15 deg tail slide                                                |
  | Handbrake + steer at 100 km/h    | full drift; release + counter-steer catches it within 2 s        |
  | Reverse                          | 11 km/h max                                                      |

  Key values: mass 1300 kg, COM 0.28 m high, inertia (pitch/yaw/roll) 2300/2100/900, engine 11.5 kN
  (30 % front), grip front 1.9 / rear 1.8, suspension stiffness 42, damping 4.2/5.2, brake impulse 62
  per wheel (62 % front), handbrake rear grip x0.4 / side x0.35, steering 0.58 rad at low speed to
  0.17 rad at 44 m/s, downforce 3.2, drag 0.42. These are first-pass values tuned from measurements,
  not yet from a human driving with a phone: expect to adjust grip, steering rates and the drift
  multipliers after the first couch session (debug overlay: backtick on the TV).

- **Inputs:** pads send on change (max 30/s) plus a 100 ms heartbeat, because the input channel is
  lossy on purpose and a lost "gas released" packet must not leave a car accelerating. The TV treats
  600 ms without a pad packet as "coast" (no gas, no brake, wheel centred). Keyboard players on the
  TV: press K in the lobby (WASD + Space, then arrows + right Shift). With no keyboard players, WASD
  also drives the first car, so a laptop alone can test.
- **Shadows:** one sun, re-aimed at each viewport's car before that viewport renders and snapped to
  shadow texels to stop shimmering. three.js r186 deprecated `PCFSoftShadowMap`; we use
  `PCFShadowMap` with `shadow.radius` for soft edges.
- **No allocation in the frame loop:** physics state, cameras and visuals reuse scratch vectors;
  Rapier getters are called with target objects; viewport rects are cached and only rebuilt on resize.
  The only per-step allocations are collision events (rare) and the debug overlay (hidden by default).

## M2: split screen

- One renderer, one scene, one canvas; each viewport is a scissored rectangle with its own chase
  camera. Viewport rectangles are cached and only recomputed on resize.
- With 3 players the 4th quarter shows a broadcast camera rather than a black hole: it costs the same
  as a 4-player frame, which is the budget we must hit anyway.
- Name tags are sprites drawn without depth testing so you can spot a rival behind a wall; each
  viewport hides its own car's tag.
- The shadow map is re-rendered per viewport (aimed at that viewport's car), so its size scales with
  the player count (2048 -> 1024 with 3-4 players).
