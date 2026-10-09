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
