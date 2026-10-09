import type { GameId, GameMode } from '@gamergang/shared';

export interface GameModeInfo {
  id: GameMode;
  label: string;
  hint: string;
}

/** Everything the hub UI needs to show a game card. Game code itself lives in games/<id>/. */
export interface GameDescriptor {
  id: GameId;
  title: string;
  subtitle: string;
  details: string;
  /** Card artwork gradient. */
  art: string;
  /** Picked in the lobby, first is the default (same order as GAME_MODES). */
  modes: readonly GameModeInfo[];
}

export const GAMES: Readonly<Record<GameId, GameDescriptor>> = {
  splitways: {
    id: 'splitways',
    title: 'Split Ways',
    subtitle: 'Corniche Run',
    details: '3 laps · 1-4 players · tilt to steer',
    art: 'linear-gradient(135deg, #ff8a1f 0%, #ff3b6b 45%, #3a1c71 100%)',
    modes: [
      { id: 'items', label: 'Items', hint: 'Mystery boxes: rockets, oil, shields, nitro' },
      { id: 'classic', label: 'Classic', hint: 'Pure racing, lap records count' },
    ],
  },
};

export const GAME_LIST: readonly GameDescriptor[] = Object.values(GAMES);
