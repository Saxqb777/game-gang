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
    subtitle: 'Kestrel Pines',
    details: '3 laps · 1-4 players · touch controls',
    art: 'linear-gradient(135deg, #2f6b3a 0%, #1d4a3a 45%, #0e2233 100%)',
  },
};

export const GAME_LIST: readonly GameDescriptor[] = Object.values(GAMES);
