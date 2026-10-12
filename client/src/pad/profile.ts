import { PLAYER_COLOURS, playerNameSchema, type ColourId } from '@gamergang/shared';
import { randomId } from '../net/rtc';

/** Pad steering layouts, the first being the default: drag a thumb, or hold arrow buttons. */
export const STEERING_MODES = ['drag', 'buttons'] as const;
export type SteeringMode = (typeof STEERING_MODES)[number];

export interface Profile {
  name: string;
  colour: ColourId;
  mode: SteeringMode;
}

const PROFILE_KEY = 'gamergang.pad.profile';
const CLIENT_ID_KEY = 'gamergang.pad.clientId';

function isColour(value: unknown): value is ColourId {
  return PLAYER_COLOURS.some((c) => c.id === value);
}

export function loadProfile(): Profile {
  const fallback: Profile = { name: '', colour: 'red', mode: STEERING_MODES[0] };
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Partial<Profile> | null;
    if (!raw) return fallback;
    return {
      name: playerNameSchema.safeParse(raw.name).success ? String(raw.name) : '',
      colour: isColour(raw.colour) ? raw.colour : fallback.colour,
      // Any other stored value becomes drag.
      mode: raw.mode === 'buttons' ? 'buttons' : 'drag',
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode storage can throw; the profile just won't be remembered.
  }
}

/**
 * Stable id for this browser tab. It survives reloads and reconnects, which is how the TV
 * recognises a returning pad and gives it back the same car. Per tab, so two tabs are two players.
 */
export function clientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = randomId(16);
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
