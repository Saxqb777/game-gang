# Gamer Gang

A party game console in the browser. The TV (a laptop plugged into it) opens one page, every friend
opens another on their phone, and the phones become controllers. No installs, no accounts.

The first game is **Split Ways**: up to 4 players racing split screen around **Corniche Run**, phones
held sideways like steering wheels.

## Quick start (local)

Needs Node 20.19+ and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm dev
```

- TV: open **http://localhost:4000/tv** in Chrome on the laptop.
- Phones (same wifi): scan the QR code on the TV, accept the certificate warning once, join.

Step-by-step testing notes for each milestone are in [PROGRESS.md](PROGRESS.md).

## Scripts

| Command                        | What it does                                                             |
| ------------------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`                     | Local dev with hot reload: http on :4000 (TV), https on :4443 (phones)   |
| `pnpm test`                    | Unit tests                                                               |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint                                                    |
| `pnpm build:vercel`            | Build the Vercel deployment into `.vercel/output`                        |
| `pnpm db:migrate`              | Create the Neon tables up front (optional, the API does it on first use) |

## Docs

- [DECISIONS.md](DECISIONS.md): why things are built the way they are.
- [PROGRESS.md](PROGRESS.md): what each milestone delivered and how to test it.
- [ROADMAP.md](ROADMAP.md): what is deliberately not in v1.
- [assets/ASSETS.md](assets/ASSETS.md): every asset with its source and license.
