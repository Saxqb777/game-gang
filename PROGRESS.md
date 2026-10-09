# Progress

Each milestone: what was built, what to test, and how to test it on the Mac + phones.

## M0 - Skeleton

**Built**

- pnpm workspace: `shared` (protocol + zod schemas), `server` (signaling API, local servers), `client`
  (Vite + React: `/tv`, `/pad`, and a small landing page at `/`).
- Signaling API on Vercel + Neon: `POST/GET /api/room`, `POST/GET /api/signal`, `POST/GET /api/laps`.
  Locally it runs on an in-memory Postgres when `DATABASE_URL` is empty.
- WebRTC transport: phones connect straight to the TV browser over two data channels (fast/lossy for
  driving input, reliable for everything else). Automatic reconnect with the same slot.
- TV lobby: big QR, room code, the Split Ways game card, 4 player slots with live connected dots and
  ready state.
- Pad: room code entry (if not opened from the QR), join screen (name, colour, Tilt/Buttons steering),
  lobby with READY, settings sheet to switch steering any time.
- `pnpm dev` prints the TV URL, the phone URL and a QR in the terminal, plus a QR for every room.
- `pnpm build:vercel` produces the Vercel deployment (`vercel.json` runs it on every push).

**Test it on your Mac + phones**

1. Install once: `corepack enable && pnpm install` (Node 20.19+).
2. `pnpm dev`. If macOS asks whether `node` may accept incoming connections, click **Allow**.
3. On the Mac open **http://localhost:4000/tv** in Chrome and put it on the TV (fullscreen: Ctrl+Cmd+F).
4. On each phone (same wifi), scan the QR on the TV. The phone warns about the certificate once:
   - iPhone: **Show Details** -> **visit this website** -> **Visit Website**.
   - Android Chrome: **Advanced** -> **Proceed**.
5. Type a name, pick a colour, pick Tilt or Buttons, tap **JOIN**. Your card appears on the TV with a
   green dot within a second or two.
6. Join with a second phone. Tap **READY** on one: the TV card turns green.
7. Turn wifi off on a phone for a few seconds: the TV dot goes grey ("Reconnecting..."). Turn it back
   on: the phone reconnects by itself into the same slot.
8. Close a phone's tab: the TV frees that slot after 15 seconds.

**Automated checks**: `pnpm test` (signaling store + API), `pnpm typecheck`, `pnpm lint`.

**Verified here**: headless Chromium with one TV page and two pad pages through the real API:
pads connect in about 3 s including page load, cards/dots/ready update live, a closed pad is noticed
in about 0.3 s. Real phones and a real Neon database are not verified yet.

## M1 - Drive

**Built**

- Split Ways game module (`client/src/games/splitways/`): Rapier physics with the raycast vehicle and
  arcade assists, fixed 60 Hz loop with interpolation, chase camera with lag, speed FOV and impact
  shake, sun with soft shadows that follow the car, the CC0 sports car with PBR materials and working
  wheels (spin, steer, suspension), brake lights.
- Test plane: 700 m grey grid with ramps and blocks, invisible boundary walls, auto-respawn if the car
  is on its roof for 3 s.
- Phone controller: Tilt (gyro, rotating wheel graphic) or Buttons (left/right zones, 150 ms ramp),
  GAS, BRAKE (hold at a standstill to reverse), HANDBRAKE, HORN, live position/speed, countdown and
  finish overlays, "turn your phone sideways" prompt, settings button to switch steering mid-race.
  Collisions buzz the phone (Android).
- TV keyboard: WASD/Space drives too. `K` adds keyboard players in the lobby, `Enter` readies them,
  `Esc` returns to the lobby, `` ` `` toggles the debug overlay (fps, physics ms, draw calls, triangles,
  each driver's inputs, speed, slip angle and round-trip time), `F` fullscreen.
- `client/src/games/splitways/config.ts` holds every tunable with plain-English comments; tuning
  values and how they were measured are in DECISIONS.md.

**Test it on your Mac + phones**

1. `pnpm dev`, open http://localhost:4000/tv, join with your phone as in M0.
2. Tap READY on the phone. The TV loads the test plane and your car.
3. Hold the phone sideways. Tilt mode: turn it like a wheel, right thumb GAS, left thumb BRAKE. Buttons
   mode: left thumb on the arrows, right thumb on GAS/BRAKE.
4. Try: full throttle down the plane; a hard turn; tap BRAKE mid-corner (the tail steps out); hold
   HANDBRAKE with some steering (drift), then counter-steer to catch it; jump the orange ramps;
   hold BRAKE at a standstill to reverse.
5. Press backtick on the Mac to see fps and your live inputs. Press Esc to go back to the lobby.
6. No phone handy? Press `K` then `Enter` in the lobby and drive with WASD + Space.

**Automated checks**: `pnpm test` now also runs the driving-feel tests (acceleration, top speed,
braking, steering direction, no rollover, handbrake drift and recovery, brake oversteer, reverse) and
the tilt/button steering maths.

**Verified here**: headless Chromium (software WebGL) with a TV page and a phone page through the real
API: holding GAS on the phone accelerates the car on the TV, two-finger input (gas + steer) registers,
keyboard drives the same car, Esc returns both screens to the lobby. Real phones and real 60 fps on
the M1 are for you to confirm.

## M2 - Split screen

**Built**

- Every player in the round gets a car and a viewport: 1 player full screen, 2 players top/bottom,
  3-4 players in a 2x2 grid. With 3 players the free quarter shows a "LIVE" broadcast camera that
  circles the pack.
- Cars spawn on a 2x2 grid and collide with each other (and the scenery). Hard hits shake that
  player's camera and buzz their phone.
- Floating name tags in each player's colour above every car, hidden in your own view so you see who
  is who in other viewports.
- Shadow map resolution drops from 2048 to 1024 with 3-4 players (it is re-rendered per viewport).

**Test it on your Mac + phones**

1. `pnpm dev`, open the TV page, join with 2, 3 and then 4 phones (or add keyboard players with `K`).
2. Everyone taps READY. Check the layout matches the player count, each phone drives its own car,
   and name tags show over the other cars.
3. Bump into each other: the hit should shake your view and buzz your phone (Android).
4. Press backtick: with 4 players watch fps (target 60 on the M1), draw calls and triangles.

**Automated checks**: new simulation test for head-on car-to-car collisions (both cars get the
impact, nobody drives through anybody).

**Verified here**: headless Chromium with 4 and then 3 phone pages: each phone's inputs reach its own
car (debug overlay shows 4 independent input rows), layouts render as expected, the 3-player overview
cell renders. 4 viewports = ~420 draw calls on the test plane. Real 60 fps on the M1 is for you to
confirm.
