/**
 * The TV's single AudioContext. Browsers keep it silent until someone clicks or presses a key on
 * the page, so the TV shows a hint until sound is running.
 */
import { useSyncExternalStore } from 'react';

let context: AudioContext | null = null;
const listeners = new Set<() => void>();

export function audioContext(): AudioContext | null {
  if (context) return context;
  if (typeof AudioContext === 'undefined') return null;
  context = new AudioContext({ latencyHint: 'interactive' });
  context.addEventListener('statechange', () => {
    for (const listener of listeners) listener();
  });
  return context;
}

function unlock(): void {
  const ctx = audioContext();
  if (ctx && ctx.state !== 'running') void ctx.resume();
}

// Kept for the page's lifetime: a context can be suspended again (e.g. after sleep).
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribe, () => audioContext()?.state === 'running');
}
