import type { InputMessage } from '@gamergang/shared';
import { quantiseThrottle } from '../input/controls';

export type PadInput = Omit<InputMessage, 'type' | 't'>;

/** Send at most this often while the controls are changing (30 per second). */
const MIN_INTERVAL_MS = 1000 / 30;
/**
 * The input channel is lossy by design, so an unchanged state is still repeated this often.
 * Otherwise a single lost "released the gas" packet would leave the car accelerating.
 */
const HEARTBEAT_MS = 100;
/** Steering changes smaller than this are noise, not news. */
const STEER_DEAD_ZONE = 0.015;

export class InputSender {
  private last: PadInput | null = null;
  private lastSentAt = -Infinity;

  constructor(private readonly send: (input: Omit<InputMessage, 'type'>) => boolean) {}

  update(input: PadInput, now: number): void {
    const last = this.last;
    // Throttle travels on the 0.05 grid: comparing quantised values means a change is a full step.
    const throttle = quantiseThrottle(input.throttle);
    const changed =
      !last ||
      Math.abs(input.steer - last.steer) > STEER_DEAD_ZONE ||
      throttle !== last.throttle ||
      input.brake !== last.brake ||
      input.handbrake !== last.handbrake ||
      input.horn !== last.horn;
    const elapsed = now - this.lastSentAt;
    if (elapsed < (changed ? MIN_INTERVAL_MS : HEARTBEAT_MS)) return;
    const message = {
      steer: Math.round(input.steer * 1000) / 1000,
      throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      horn: input.horn,
      t: now,
    };
    if (this.send(message)) {
      this.last = message;
      this.lastSentAt = now;
    }
  }
}
