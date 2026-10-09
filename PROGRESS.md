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
