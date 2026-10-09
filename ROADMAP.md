# Roadmap

Out of scope for v1. Written down so the v1 code leaves room for them, not built.

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
- More tracks (the track builder takes a list of spline control points, so this is mostly content),
  more cars, unlockables.
- Rubber band assist as an option (v1 is pure skill).
- Drift scoring, boost pads, items.
- Spectator mode, replays, ghost laps.
