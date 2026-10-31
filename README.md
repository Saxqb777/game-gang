# Gamer Gang

A party game console in the browser. A laptop plugged into the TV opens one page, friends open
another on their phones, and the phones become controllers. No installs, no accounts.

First game: **Split Ways**. Up to 4 players race split screen around **Kestrel Pines**, an original
3.4 km club circuit through a temperate pine forest, in five invented cars. Phones are the
controllers: drag a thumb to steer, or use arrow buttons.

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
4. Type a name, pick a car and a paint, pick **Drag steer** (default) or **Buttons**, tap **JOIN**.
5. Everyone taps **READY**. The race starts when all connected players are ready.

## Cars and paint

Five cars from invented makes, all equally fast on Kestrel Pines (lap times within 1.5%):

| Car               | Body                      | Drive |
| ----------------- | ------------------------- | ----- |
| Dashwood Nightjar | GT coupe (the default)    | RWD   |
| Mudlark Scree     | Rally coupe               | AWD   |
| Brazen Haymaker   | Muscle restomod           | RWD   |
| Briganti Zanna    | Supercar                  | RWD   |
| Arvanta Sagitta   | Electric hypercar concept | AWD   |

- The join screen shows a car card: picture in your paint, make and model, body and drive, five
  stat bars (speed, acceleration, handling, braking, ease) and the credit line. Swipe or use the
  arrows to change car.
- The eight paints are the eight player colours. Two players may drive the same car, never in the
  same paint: a taken paint is greyed out.
- In the lobby, **Change car** (or Settings → Change name / car) reopens the join screen.
- A phone that reloads or reconnects keeps its car and paint, also mid-race.
- TV keyboard players and bots get Nightjar, Scree, Haymaker and Zanna in that order.

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
| `C`         | credits (`Esc` closes)              |                                          |
| `Enter`     | keyboard players ready              | player 2 reset                           |
| `Q`         |                                     | player 1 reset                           |
| `Backspace` | remove a keyboard player            |                                          |
| WASD, Space | drive player 1 (handbrake: Space)   | same; `S` held at a standstill = reverse |
| Arrows      | drive player 2 (handbrake: R Shift) | same; `↓` held at a standstill = reverse |
| `E`, `/`    |                                     | horn (player 1, player 2)                |
| `Esc`       |                                     | back to the lobby                        |
| `` ` ``     |                                     | debug overlay                            |
| `F`         | fullscreen                          | fullscreen                               |

**Debug keys** (TV). `` ` `` shows or hides the overlay: fps, frame p50/p99, missed frames, GPU ms,
preset, resolution scale, draw calls, triangles and every driver's inputs. With the overlay open:

- `P`: autopilot for every car (a test tool, not an AI opponent).
- `N`: every car to its next checkpoint.
- `R`: pin the resolution scale at 1; press again to hand it back.
- `B`: run the fly-through benchmark (`auto`) now.
- `V`: hide or show every car (the draw calls and triangles the cars cost).

## Benchmarks

Open the TV page with a query string, press `K`, then `Enter`:

- `/tv?bench=auto`: after loading, cameras fly along the track with 1 view on High, 2 on Medium and
  4 on Low (3 s warm-up, then 20 s measured each). A results table follows, then the race.
- `/tv?bench=matrix`: the same for every viewport count (1, 2, 4) with every preset (9 runs).
- `/tv?bench=soak&bots=1`: a 30-minute autopilot race. Press `K` four times for 4 viewports on Low.
- `?bots=1`: `K` keeps adding driverless bots after the two keyboard players.

Every run is printed to the browser console as `[splitways-bench]` JSON and posted as telemetry.
Results from the reference MacBook Air M1 go in [PROGRESS.md](PROGRESS.md).

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
| `pnpm test`                  | Unit tests (signaling, hub, car physics, balance, race rules, trackgen)  |
| `pnpm check`                 | Typecheck, lint, format check and tests                                  |
| `pnpm build:vercel`          | Build the Vercel deployment into `.vercel/output`                        |
| `pnpm db:migrate`            | Create the Neon tables up front (optional, the API does it on first use) |
| `pnpm telemetry:report`      | Print the TV performance samples stored in Neon (read only)              |
| `pnpm assets:cars <folder>`  | Build the five car files from the debranded source cars (see below)      |
| `pnpm assets:track <folder>` | Check a track folder's layout files; it converts and writes nothing      |

`pnpm assets:track assets/tracks/kestrel-pines` validates both JSON files, runs the generator and
prints the length, closure, radii, elevation and any corridor warnings.

`pnpm assets:cars <folder>` turns each debranded source car into `assets/cars/<id>/<id>.glb` (three
levels of detail plus a shadow stand-in). `--check` rebuilds in memory and fails if a file differs or
breaks a budget; `--only <id>` builds one car. It needs ImageMagick (`convert` with JPEG, PNG and
WebP); the game and the tests do not. The phone thumbnails come from the dev-only studio at
`/tools/thumbs` (`pnpm dev`): render, "Download all", then `pnpm assets:cars --thumbs <zip>`.
`/tools/thumbs?sheet=<id>` shows one car's debrand contact sheet.

## Layout

- `shared/`: message schemas shared by TV, phones and API (zod).
- `server/`: the API (`/api/room`, `/api/signal`, `/api/laps`, `/api/telemetry`) and the local
  servers.
- `client/src/hub/`, `tv/`, `pad/`, `net/`: the console: lobby, rooms, WebRTC, phone screens.
- `client/src/credits/`: the `/credits` page and the TV credits panel.
- `client/src/games/splitways/`: the game. Every tunable is in `config.ts`. `track/gen/` is
  trackgen, which builds a track from a layout file plus a small override file.
- `assets/`: the cars and their thumbnails (`assets/cars/`), textures, sky and the track data
  (`assets/tracks/kestrel-pines/`). Sources and licences in [assets/ASSETS.md](assets/ASSETS.md)
  and [LICENCES.md](LICENCES.md).

## Credits

The cars are built from these models, renamed, reshaped, debranded, re-materialed and reduced to
three levels of detail:

- **Dashwood Nightjar** is based on "Generic Sport Coupé Car" by MMC Works (mmcworks),
  https://sketchfab.com/3d-models/generic-sport-coupe-car-820a13c4831c41959ce75e6c2014e882,
  licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified.
- **Mudlark Scree** is based on "Ariel_350-V2" by orcha (gandoplyas),
  https://sketchfab.com/3d-models/ariel-350-v2-7a9a44bcf152405792424408bb573482, licensed under
  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified.
- **Brazen Haymaker** is based on "Muscle Car Concept" by ViktorKom,
  https://sketchfab.com/3d-models/muscle-car-concept-aa5dbdc7d492478ababfd4d385b8339f, licensed
  under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified, hidden parts removed.
- **Briganti Zanna** is based on "Fictional supercar - V12 Goblin" by Olli Teittinen (ollitei),
  https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786,
  licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified.
- **Arvanta Sagitta** is based on "FREE Concept Car 039 - public domain (CC0)" by
  unityfan777 (Unity Fan YouTube channel),
  https://sketchfab.com/3d-models/free-concept-car-039-public-domain-cc0-f17b9d37e0e34f15b4c2e417a98f5ed6,
  dedicated to the public domain (CC0 1.0); credited as a courtesy. Modified.

Our changes are (C) 2026 the Gamer Gang project; the original works stay under their licences. CC BY
grants no trademark rights; the models were debranded. The makes and models are invented.

Everything else (track, textures, sky, font, sound, libraries) is listed on the **/credits** page
(also key `C` in the TV lobby), in [assets/ASSETS.md](assets/ASSETS.md) and in
[LICENCES.md](LICENCES.md).

## Docs

- [PROGRESS.md](PROGRESS.md): what each milestone delivered and how to test it.
- [DECISIONS.md](DECISIONS.md): why things are built the way they are.
- [ROADMAP.md](ROADMAP.md): milestones and what is deliberately not built yet.
- [LICENCES.md](LICENCES.md): every third-party source that was reviewed, and the decision on it.
