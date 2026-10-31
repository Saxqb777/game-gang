# Roadmap

Out of scope for v1. Written down so the v1 code leaves room for them, not built.

## Milestones

- **M8:** Track 1 Kestrel Pines, the performance foundation (render path, presets, profiling,
  telemetry) and the minimum touch controller. Built; done once the owner's M1 run passes. See
  PROGRESS.md.
- **Cars update:** five debranded cars from invented makes, car select with paint, per-car handling
  and credits: the car part of M12, pulled forward (owner, 2026-10-12). Built; done once the
  owner signs off the car reworks and the M1 run passes. Released together with M8 (owner,
  2026-10-31).
- **M9:** Track 1 polish: visuals (impostor forests, baked light, KTX2 textures, grade), car
  feel and sound on Kestrel Pines. A later update after the M8 and cars release (owner,
  2026-10-31), each step pushed live when green; the owner tests once at the end.
- **M10:** Dropped for now (owner, 2026-10-10: one track only). More tracks come later through
  the generator.
- **M11:** Feel: tyre model and assists ladder, controller v2 (binary input packets, 250 ms failsafe,
  handbrake slide), HUD v2, engine audio v1.
- **M12:** Liveries and sponsor decals, class kits, and the chase-cam rewrite. (New cars and paint
  shipped in the cars update.)
- **M13:** Premium TV and site UI.
- **M14:** On hold until the owner says it is ready.
- **M15 and after:** new tracks and car packs through the generator; the WebGPU gate.

## Platform (Gamer Gang)

- **Accounts, profiles, matchmaking.** v1 rooms are anonymous and joined by QR or code.
- **A second game: COD Zombies style hot seat.** The hub is already game-agnostic: lobby, pad
  connection, player slots, ready-up and votes live in `client/src/hub` and know nothing about racing.
  A new game adds `client/src/games/<id>/` (TV module + pad controller), an entry in
  `client/src/games/registry.ts`, and its messages in `shared/protocol.ts`. The lobby already renders
  games as cards, so the picker only needs a second card and a way to choose it.
- **TURN by default.** v1 ships STUN only with optional TURN env vars. If friends join over cellular
  or locked-down wifi often, wire up a free/cheap TURN provider by default.

## Split Ways

- AI opponents.
- More tracks and cars (trackgen builds a track from a layout file plus a small override file, so a
  track is mostly content), unlockables.
- Rubber band assist as an option (races are pure skill today).
- Spectator mode, replays, ghost laps.
