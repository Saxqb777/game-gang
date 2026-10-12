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

/** The seat this tab holds in a room: what a reloaded pad needs to rejoin without a tap. */
export interface Seat extends Profile {
  room: string;
}

const PROFILE_KEY = 'gamergang.pad.profile';
const CLIENT_ID_KEY = 'gamergang.pad.clientId';
const SEAT_KEY = 'gamergang.pad.seat';

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

/**
 * The seat this tab joined in `room`, or null. Kept in sessionStorage next to the client id it
 * belongs to: the TV knows the player by that id, so a seat is only meaningful in the same tab.
 * A fresh phone or tab has none and gets the join screen.
 */
export function loadSeat(room: string): Seat | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEAT_KEY) ?? 'null') as Partial<Seat> | null;
    if (raw?.room !== room || !playerNameSchema.safeParse(raw.name).success) return null;
    if (!isColour(raw.colour)) return null;
    return {
      room,
      name: String(raw.name),
      colour: raw.colour,
      mode: raw.mode === 'buttons' ? 'buttons' : 'drag',
    };
  } catch {
    return null;
  }
}

export function saveSeat(seat: Seat): void {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    // Without storage a reload shows the join screen, as before.
  }
}

export function clearSeat(): void {
  try {
    sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
