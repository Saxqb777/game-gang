# Gamer Gang

A party game console in the browser. A laptop plugged into the TV opens one page, friends open
another on their phones, and the phones become controllers. No installs, no accounts.

First game: **Split Ways**. Up to 4 players race split screen around **Kestrel Pines**, an original
3.4 km club circuit through a temperate pine forest. Phones are the controllers: drag a thumb to
steer, or use arrow buttons.

## Play at home

Needs Node 20.19+ and pnpm (`corepack enable`).

```sh
pnpm install
pnpm start        # production build, fastest
# or: pnpm dev    # hot reload while changing code
```

1. On the Mac, open **http://localhost:4000/tv** in Chrome, drag it to the TV, press `F` for
   fullscreen and click once (browsers only play sound after a click).
2. Each phone (same wifi as the Mac): scan the QR code on the TV.
3. Accept the certificate warning once (the phone page is https so it can keep the screen awake):
   - iPhone: Show Details → visit this website → Visit Website.
   - Android: Advanced → Proceed.
4. Type a name, pick a colour, pick **Drag steer** (default) or **Buttons**, tap **JOIN**.
5. Everyone taps **READY**. The race starts when all connected players are ready.

## Controls

**Phone** (hold it sideways)

- **Drag steer** (default): put your left thumb down anywhere in the left zone and slide it
  sideways. A quarter of the screen height either side is full lock. A ghost wheel shows where you
  are; lifting the thumb centres the wheel.
- **Buttons**: left and right arrows. Holding one ramps the steering to full lock.
- **GAS**: the tall pedal on the right. Slide your thumb down the pedal to feather the throttle
  (30% of the pedal height lifts off completely). Slide it left onto BRAKE·R to brake.
- **BRAKE·R**: brakes. Held at a standstill (0.35 s) it engages reverse: a ring fills, the label
  reads REVERSE and an **R** chip lights on the phone and the TV. Keep holding to reverse; let go to
  leave reverse.
- **HANDBRAKE**: the strip next to the pedals.
- **HOLD · RESET** (top right): hold it for 0.6 s to put the car back on the track at the last
  checkpoint. It greys out for 3 s after a reset.
- Horn: top right, next to RESET.
- Stuck against a wall with gas held: after 2 s the phone and the TV show "Hold BRAKE to reverse".
- Settings (top left) switches between Drag steer and Buttons at any time, also mid-race.
- Slipstream: tuck in right behind another car at speed for less air drag. The HUD shows
  SLIPSTREAM.

**TV keyboard**

| Key         | Lobby                               | Race                                     |
| ----------- | ----------------------------------- | ---------------------------------------- |
| `K`         | add a keyboard player (up to two)   |                                          |
| `Enter`     | keyboard players ready              | player 2 reset                           |
| `Q`         |                                     | player 1 reset                           |
| `Backspace` | remove a keyboard player            |                                          |
| WASD, Space | drive player 1 (handbrake: Space)   | same; `S` held at a standstill = reverse |
| Arrows      | drive player 2 (handbrake: R Shift) | same; `↓` held at a standstill = reverse |
| `E`, `/`    |                                     | horn (player 1, player 2)                |
| `Esc`       |                                     | back to the lobby                        |
| `` ` ``     |                                     | debug overlay                            |
| `F`         | fullscreen                          | fullscreen                               |

<!-- M8-FINAL: re-check the phone layout words (top left/top right, zone names) and the reset,
reverse and hint timings against the merged P4/P5 build and the 2.9 screenshots. -->

**Debug keys** (TV). `` ` `` shows or hides the overlay: fps, frame p50/p99, missed frames, GPU ms,
preset, resolution scale, draw calls, triangles and every driver's inputs. With the overlay open:

- `P`: autopilot for every car (a test tool, not an AI opponent).
- `N`: every car to its next checkpoint.
- `R`: pin the resolution scale at 1; press again to hand it back.
- `B`: run the fly-through benchmark (`auto`) now.

## Benchmarks

Open the TV page with a query string, press `K`, then `Enter`:

- `/tv?bench=auto`: after loading, cameras fly along the track with 1 view on High, 2 on Medium and
  4 on Low (3 s warm-up, then 20 s measured each). A results table follows, then the race.
- `/tv?bench=matrix`: the same for every viewport count (1, 2, 4) with every preset (9 runs).
- `/tv?bench=soak&bots=1`: a 30-minute autopilot race. Press `K` four times for 4 viewports on Low.
- `?bots=1`: `K` keeps adding driverless bots after the two keyboard players.

Every run is printed to the browser console as `[splitways-bench]` JSON and posted as telemetry.

<!-- M8-FINAL: add the Kestrel Pines numbers from the owner's M1 run (§5.5), or link PROGRESS.md. -->

## Telemetry

The TV (never a phone) posts performance samples to `/api/telemetry` with the room's host key:
after the loading benchmark, after each race, after each benchmark run and during the soak.

- Collected: frame-time stats (average fps, p50/p95/p99/max, missed frames), CPU and GPU ms, the
  internal and output resolution, the resolution scale, the preset and preset drops, the viewport
  count, draw calls and triangles, plus the machine: browser user agent, GPU name, CPU cores,
  memory, screen size, devicePixelRatio, refresh rate and whether a GPU timer exists.
- Not collected: IP addresses, player names, or anything from the phones.
- Kept 90 days. Rate-limited per room and globally.
- Read it with `pnpm telemetry:report` (`--since 24h`, `--session <id>`). Needs `DATABASE_URL`.

## Troubleshooting

- **Phone can't reach the page**: phone and Mac must be on the same wifi. Guest networks often
  block devices from seeing each other; use the main network.
- **macOS asks whether `node` may accept incoming connections**: click Allow. If you clicked Deny:
  System Settings → Network → Firewall → Options, set node to Allow.
- **Certificate warning on the phone**: expected for the local https server; accept it once per
  phone. The deployed version on Vercel has a real certificate.
- **"Turn your phone sideways"**: the controller only works in landscape. Turn off the rotation
  lock.
- **Car stuck against a wall**: let go of GAS and hold BRAKE·R to reverse out, or hold
  **HOLD · RESET**. A car that stays stuck for 6 s, or sits on its roof for 3 s, is put back on the
  track by itself.
- **No sound**: click the TV page once. The yellow "Sound is off" pill disappears.
- **Phone shows Reconnecting**: it rejoins by itself into the same car. The car coasts meanwhile.
- **Stutters**: press `` ` `` on the TV. Fps should read 60. A scale below 1.00 means the game is
  lowering resolution to keep up. The preset (HIGH, MEDIUM, LOW) follows the player count and can
  drop one step between races.

## Deploy (Vercel + Neon)

1. Create a free project on [neon.tech](https://neon.tech) and copy its connection string.
2. On [vercel.com](https://vercel.com): Add New → Project → import this GitHub repo. Leave the
   framework as detected (`vercel.json` sets the build).
3. Add environment variables: `DATABASE_URL` (the Neon string). Optional, for phones on networks
   that block direct connections: `TURN_URL`, `TURN_USER`, `TURN_PASS`.
4. Deploy. Every push to `main` deploys again.

Then open `https://<your-app>.vercel.app/tv` on the TV laptop; phones scan the QR. Tables are
created on first use (or run `pnpm db:migrate` with `DATABASE_URL` set).

## Scripts

| Command                      | What it does                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| `pnpm start`                 | Build, then serve on :4000 (TV) and https :4443 (phones)                 |
| `pnpm dev`                   | Same ports with hot reload                                               |
| `pnpm test`                  | Unit tests (signaling, car physics, race rules, steering, trackgen)      |
| `pnpm check`                 | Typecheck, lint, format check and tests                                  |
| `pnpm build:vercel`          | Build the Vercel deployment into `.vercel/output`                        |
| `pnpm db:migrate`            | Create the Neon tables up front (optional, the API does it on first use) |
| `pnpm telemetry:report`      | Print the TV performance samples stored in Neon (read only)              |
| `pnpm assets:car`            | Rebuild the car model from its CC0 source pack                           |
| `pnpm assets:track <folder>` | Check a track folder's layout files; it converts and writes nothing      |

`pnpm assets:track assets/tracks/kestrel-pines` validates both JSON files, runs the generator and
prints the length, closure, radii, elevation and any corridor warnings.

<!-- M8-FINAL: confirm `pnpm assets:track` and its output after the P2 merge, and the `pnpm test`
areas against the final test list. -->

## Layout

- `shared/`: message schemas shared by TV, phones and API (zod).
- `server/`: the API (`/api/room`, `/api/signal`, `/api/laps`, `/api/telemetry`) and the local
  servers.
- `client/src/hub/`, `tv/`, `pad/`, `net/`: the console: lobby, rooms, WebRTC, phone screens.
- `client/src/games/splitways/`: the game. Every tunable is in `config.ts`. `track/gen/` is
  trackgen, which builds a track from a layout file plus a small override file.
- `assets/`: car model, textures, sky and the track data (`assets/tracks/kestrel-pines/`). Sources
  and licences in [assets/ASSETS.md](assets/ASSETS.md) and [LICENCES.md](LICENCES.md).

<!-- M8-FINAL: LICENCES.md and assets/tracks/ arrive with the P2 merge; check both links resolve. -->

## Docs

- [PROGRESS.md](PROGRESS.md): what each milestone delivered and how to test it.
- [DECISIONS.md](DECISIONS.md): why things are built the way they are.
- [ROADMAP.md](ROADMAP.md): milestones and what is deliberately not built yet.
- [LICENCES.md](LICENCES.md): every third-party source that was reviewed, and the decision on it.
