import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameId } from '@gamergang/shared';
import type { PadStore } from './padStore';
import type { SteeringMode } from './profile';

/** What every game's pad controller gets from the hub side of the pad. */
export interface PadControllerProps {
  store: PadStore;
  mode: SteeringMode;
  colourHex: string;
  onSettings: () => void;
  /** Asks for motion access again; call it straight from a tap (iOS only prompts during one). */
  onEnableTilt: () => void;
}

export const PAD_CONTROLLERS: Record<
  GameId,
  LazyExoticComponent<ComponentType<PadControllerProps>>
> = {
  splitways: lazy(() => import('../games/splitways/pad/SplitWaysController')),
};
