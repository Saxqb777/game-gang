import { NEUTRAL_INPUT, copyInput, type DriveInput } from '../sim/input';

interface KeyMap {
  left: string[];
  right: string[];
  gas: string[];
  brake: string[];
  handbrake: string[];
  horn: string[];
  /** Reset a stuck car (not KeyR: that is the debug resolution toggle). */
  reset: string[];
}

/**
 * Two drivers can share the TV keyboard: WASD + Space (Q resets) and the arrow keys + right Shift
 * (Enter resets).
 */
const KEY_MAPS: readonly KeyMap[] = [
  {
    left: ['KeyA'],
    right: ['KeyD'],
    gas: ['KeyW'],
    brake: ['KeyS'],
    handbrake: ['Space'],
    horn: ['KeyE'],
    reset: ['KeyQ'],
  },
  {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    gas: ['ArrowUp'],
    brake: ['ArrowDown'],
    handbrake: ['ShiftRight'],
    horn: ['Slash'],
    reset: ['Enter', 'NumpadEnter'],
  },
];

const DRIVING_KEYS = new Set(
  KEY_MAPS.flatMap((m) => [
    ...m.left,
    ...m.right,
    ...m.gas,
    ...m.brake,
    ...m.handbrake,
    ...m.horn,
    ...m.reset,
  ]),
);

/** Digital keyboard controls. The car's own steering rate turns the on/off keys into a smooth turn. */
export class KeyboardDriver {
  readonly inputs: DriveInput[] = KEY_MAPS.map(() =>
    copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT),
  );
  private readonly down = new Set<string>();
  /** Reset key presses not yet handed to the game, per key set. */
  private readonly resetPresses = KEY_MAPS.map(() => 0);

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Refresh `inputs` from the keys currently held. */
  poll(): void {
    for (let i = 0; i < KEY_MAPS.length; i++) {
      const map = KEY_MAPS[i] as KeyMap;
      const input = this.inputs[i] as DriveInput;
      input.steer = (this.held(map.right) ? 1 : 0) - (this.held(map.left) ? 1 : 0);
      input.throttle = this.held(map.gas) ? 1 : 0;
      input.brake = this.held(map.brake) ? 1 : 0;
      input.handbrake = this.held(map.handbrake);
      input.horn = this.held(map.horn);
    }
  }

  /** True once per press of key set `set`'s reset key. */
  takeResetPress(set: number): boolean {
    const presses = this.resetPresses[set] ?? 0;
    if (presses === 0) return false;
    this.resetPresses[set] = presses - 1;
    return true;
  }

  private held(keys: readonly string[]): boolean {
    for (const key of keys) if (this.down.has(key)) return true;
    return false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!DRIVING_KEYS.has(event.code)) return;
    event.preventDefault();
    this.down.add(event.code);
    if (event.repeat) return;
    KEY_MAPS.forEach((map, set) => {
      if (map.reset.includes(event.code))
        this.resetPresses[set] = (this.resetPresses[set] ?? 0) + 1;
    });
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.down.delete(event.code);
  };

  private readonly onBlur = () => {
    this.down.clear();
  };
}
