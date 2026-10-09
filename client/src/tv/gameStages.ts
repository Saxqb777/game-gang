import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameId } from '@gamergang/shared';
import type { Hub } from '../hub/hub';

/** Each game's TV component, loaded only when that game starts (three.js + physics are big). */
export const GAME_STAGES: Record<GameId, LazyExoticComponent<ComponentType<{ hub: Hub }>>> = {
  splitways: lazy(() => import('../games/splitways/tv/SplitWaysStage')),
};
