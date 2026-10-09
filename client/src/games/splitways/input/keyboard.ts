import { NEUTRAL_INPUT, copyInput, type DriveInput } from '../sim/input';

interface KeyMap {
  left: string[];
  right: string[];
  gas: string[];
  brake: string[];
  handbrake: string[];
  horn: string[];
}

/** Two drivers can share the TV keyboard: WASD + Space and the arrow keys + right Shift. */
const KEY_MAPS: readonly KeyMap[] = [
  {
    left: ['KeyA'],
    right: ['KeyD'],
    gas: ['KeyW'],
    brake: ['KeyS'],
    handbrake: ['Space'],
    horn: ['KeyE'],
  },
  {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    gas: ['ArrowUp'],
    brake: ['ArrowDown'],
    handbrake: ['ShiftRight'],
    horn: ['Slash'],
  },
];

const DRIVING_KEYS = new Set(
  KEY_MAPS.flatMap((m) => [...m.left, ...m.right, ...m.gas, ...m.brake, ...m.handbrake, ...m.horn]),
);

/** Digital keyboard controls. The car's own steering rate turns the on/off keys into a smooth turn. */
export class KeyboardDriver {
  readonly inputs: DriveInput[] = KEY_MAPS.map(() =>
    copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT),
  );
  private readonly down = new Set<string>();

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
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.down.delete(event.code);
  };

  private readonly onBlur = () => {
    this.down.clear();
  };
}
