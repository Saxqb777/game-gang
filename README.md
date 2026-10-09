# Gamer Gang

A party game console in the browser. A laptop plugged into the TV opens one page, friends open
another on their phones, and the phones become controllers. No installs, no accounts.

First game: **Split Ways**. Up to 4 players race split screen around **Corniche Run**, a coastal
circuit at golden hour, steering by tilting their phones. **Items** mode adds mystery boxes
(rockets, oil, shields, nitro); **Classic** is pure racing.

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
3. Accept the certificate warning once (the phone page is https so it can use the gyro):
   - iPhone: Show Details → visit this website → Visit Website.
   - Android: Advanced → Proceed.
4. Type a name, pick a colour, pick **Tilt** or **Buttons**, tap **JOIN**. iPhone asks for motion
   access: allow it.
5. Pick **Items** or **Classic** on the game card (`M` on the TV, or any phone).
6. Everyone taps **READY**. The race starts when all connected players are ready.

## Controls

**Phone**

- Tilt: hold it sideways and turn it like a wheel. Right thumb gas, left thumb brake.
- Buttons: left thumb on the arrows, right thumb on gas and brake.
- Both: handbrake (drift), horn, brake at a standstill to reverse. Settings (top right) switches
  steering any time.
- Items mode: the **ITEM** button (tilt: above gas, and the horn moves to the middle of the wheel;
  buttons: between handbrake and horn). Drive through a **?** box, wait for the slot to stop, tap.

**Speed tricks (both modes)**

- Drift boost: hold a handbrake slide until the sparks turn blue, orange, then purple. Straighten
  up to cash it in; the longer the slide, the longer the boost.
- Boost pads: the glowing blue strips after the tightest corners.
- Slipstream: tuck in right behind another car at speed. The HUD shows SLIPSTREAM.

**TV keyboard**

| Key         | Lobby                               | Race                                |
| ----------- | ----------------------------------- | ----------------------------------- |
| `K`         | add a keyboard player (up to two)   |                                     |
| `Enter`     | keyboard players ready              | player 2 item                       |
| `Q`         |                                     | player 1 item                       |
| `M`         | switch Items / Classic              |                                     |
| `Backspace` | remove a keyboard player            |                                     |
| WASD, Space | drive player 1 (handbrake: Space)   | same                                |
| Arrows      | drive player 2 (handbrake: R Shift) | same                                |
| `Esc`       |                                     | back to the lobby                   |
| `` ` ``     |                                     | debug overlay (fps, inputs, timing) |
| `F`         | fullscreen                          | fullscreen                          |

With the debug overlay open: `P` autopilot for every car, `N` every car to its next checkpoint,
`R` pin the resolution, `I` give every car an item.

## Troubleshooting

- **Phone can't reach the page**: phone and Mac must be on the same wifi. Guest networks often
  block devices from seeing each other; use the main network.
- **macOS asks whether `node` may accept incoming connections**: click Allow. If you clicked Deny:
  System Settings → Network → Firewall → Options, set node to Allow.
- **Certificate warning on the phone**: expected for the local https server; accept it once per
  phone. The deployed version on Vercel has a real certificate.
- **Tilt doesn't respond on iPhone**: tap "Tap to enable wheel" and allow motion access. Denied by
  mistake: quit Safari (swipe it away) and open the link again, or switch to Buttons.
- **No sound**: click the TV page once. The yellow "Sound is off" pill disappears.
- **Phone shows Reconnecting**: it rejoins by itself into the same car. The car coasts meanwhile.
- **Stutters**: press `` ` `` on the TV. Fps should read 60. `render scale` below 1.00 means the
  game is lowering resolution to keep up.

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

| Command             | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `pnpm start`        | Build, then serve on :4000 (TV) and https :4443 (phones)                 |
| `pnpm dev`          | Same ports with hot reload                                               |
| `pnpm test`         | Unit tests (signaling, car physics, race rules, steering, items)         |
| `pnpm check`        | Typecheck, lint, format check and tests                                  |
| `pnpm build:vercel` | Build the Vercel deployment into `.vercel/output`                        |
| `pnpm db:migrate`   | Create the Neon tables up front (optional, the API does it on first use) |
| `pnpm assets:car`   | Rebuild the car model from its CC0 source pack                           |

## Layout

- `shared/`: message schemas shared by TV, phones and API (zod).
- `server/`: signaling API (`/api/room`, `/api/signal`, `/api/laps`) and the local servers.
- `client/src/hub/`, `tv/`, `pad/`, `net/`: the console: lobby, rooms, WebRTC, phone screens.
- `client/src/games/splitways/`: the game. Every tunable is in `config.ts`.
- `assets/`: model, textures, sky. Sources and licenses in [assets/ASSETS.md](assets/ASSETS.md).

## Docs

- [PROGRESS.md](PROGRESS.md): what each milestone delivered and how to test it.
- [DECISIONS.md](DECISIONS.md): why things are built the way they are.
- [ROADMAP.md](ROADMAP.md): what is deliberately not in v1.
