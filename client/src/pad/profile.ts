import { PLAYER_COLOURS, playerNameSchema, type ColourId } from '@gamergang/shared';
import { randomId } from '../net/rtc';

export type SteeringMode = 'tilt' | 'buttons';

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
  const fallback: Profile = { name: '', colour: 'red', mode: 'tilt' };
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Partial<Profile> | null;
    if (!raw) return fallback;
    return {
      name: playerNameSchema.safeParse(raw.name).success ? String(raw.name) : '',
      colour: isColour(raw.colour) ? raw.colour : fallback.colour,
      mode: raw.mode === 'buttons' ? 'buttons' : 'tilt',
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
