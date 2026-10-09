/** Item icons (inline SVG data URLs) and names, shared by the TV HUD and the phone. */
import { ITEM_KINDS, type ItemKind } from '@gamergang/shared';

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`,
  )}`;

export const ITEM_ICONS: Readonly<Record<ItemKind, string>> = {
  nitro: svg(
    '<path d="M37 4 14 36h14l-5 24 27-34H35z" fill="#ffb21e" stroke="#fff3c4" stroke-width="3" stroke-linejoin="round"/>',
  ),
  oil: svg(
    '<path d="M32 6C24 20 14 30 14 41a18 18 0 0 0 36 0c0-11-10-21-18-35z" fill="#101318" stroke="#8a7cff" stroke-width="3"/><path d="M23 41c0 5 4 9 9 9" fill="none" stroke="#3fe8d0" stroke-width="3" stroke-linecap="round"/>',
  ),
  rocket: svg(
    '<path d="M32 4c9 8 12 20 10 34H22C20 24 23 12 32 4z" fill="#ff3b3b" stroke="#fff" stroke-width="2.5"/><circle cx="32" cy="22" r="5" fill="#bfe9ff" stroke="#fff" stroke-width="2"/><path d="M22 30 12 44l10-2zM42 30l10 14-10-2z" fill="#ffd60a"/><path d="M26 40h12l-6 18z" fill="#ff8a1f"/>',
  ),
  shield: svg(
    '<path d="M32 4 10 12v18c0 15 9 25 22 30 13-5 22-15 22-30V12z" fill="#1fe0e6" fill-opacity=".35" stroke="#1fe0e6" stroke-width="4" stroke-linejoin="round"/><path d="M22 32l7 7 13-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  shockwave: svg(
    '<circle cx="32" cy="32" r="7" fill="#ffd60a"/><circle cx="32" cy="32" r="16" fill="none" stroke="#ffd60a" stroke-width="4"/><circle cx="32" cy="32" r="26" fill="none" stroke="#ffd60a" stroke-width="3" stroke-opacity=".55"/>',
  ),
  bounty: svg(
    '<circle cx="32" cy="32" r="22" fill="none" stroke="#c45bff" stroke-width="4"/><circle cx="32" cy="32" r="8" fill="#c45bff"/><path d="M32 2v14M32 48v14M2 32h14M48 32h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  ),
};

/** Empty slot: a mystery box. */
export const MYSTERY_ICON = svg(
  '<rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="4"/><text x="32" y="44" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="34" fill="#ffffff" fill-opacity=".6">?</text>',
);

export const ITEM_NAMES: Readonly<Record<ItemKind, string>> = {
  nitro: 'Nitro',
  oil: 'Oil slick',
  rocket: 'Rocket',
  shield: 'Shield',
  shockwave: 'Shockwave',
  bounty: 'Bounty drone',
};

/** Icon to show while the slot spins: changes every 70 ms. */
export function rollingIcon(timeMs: number): string {
  return ITEM_ICONS[ITEM_KINDS[Math.floor(timeMs / 70) % ITEM_KINDS.length] ?? 'nitro'];
}
