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
