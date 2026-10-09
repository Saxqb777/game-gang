import RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | null = null;

/** Rapier ships its WASM inlined; it must be initialised once before use. */
export function loadRapier(): Promise<Rapier> {
  loading ??= RAPIER.init().then(() => RAPIER);
  return loading;
}
