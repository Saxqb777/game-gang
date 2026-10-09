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
