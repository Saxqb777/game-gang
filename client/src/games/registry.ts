import type { GameId } from '@gamergang/shared';

/** Everything the hub UI needs to show a game card. Game code itself lives in games/<id>/. */
export interface GameDescriptor {
  id: GameId;
  title: string;
  subtitle: string;
  details: string;
  /** Card artwork gradient. */
  art: string;
}

export const GAMES: Readonly<Record<GameId, GameDescriptor>> = {
  splitways: {
    id: 'splitways',
    title: 'Split Ways',
    subtitle: 'Corniche Run',
    details: '3 laps · 1-4 players · tilt to steer',
    art: 'linear-gradient(135deg, #ff8a1f 0%, #ff3b6b 45%, #3a1c71 100%)',
  },
};

export const GAME_LIST: readonly GameDescriptor[] = Object.values(GAMES);
