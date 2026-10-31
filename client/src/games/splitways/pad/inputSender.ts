import type { InputMessage } from '@gamergang/shared';
import { quantiseThrottle } from '../input/controls';

export type PadInput = Omit<InputMessage, 'type' | 't'>;

/** Send at most once a frame while the controls are changing (60 per second). */
export const MIN_INTERVAL_MS = 1000 / 60;
/**
 * Frame callbacks jitter, so "a whole interval since the last send" skips frames (at 30/s it fell
 * to every third frame, ~23/s). A send this much early still counts as on time.
 */
export const INTERVAL_SLACK_MS = 4;
/**
 * The input channel is lossy by design, so an unchanged state is still repeated this often.
 * Otherwise a single lost "released the gas" packet would leave the car accelerating.
 */
export const HEARTBEAT_MS = 100;
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
    // Presses and releases skip the rate limit: they are where a driver feels lag.
    const edge =
      !last ||
      (throttle === 0) !== (last.throttle === 0) ||
      input.brake !== last.brake ||
      input.handbrake !== last.handbrake ||
      input.horn !== last.horn;
    const changed =
      edge || Math.abs(input.steer - last.steer) > STEER_DEAD_ZONE || throttle !== last.throttle;
    const elapsed = now - this.lastSentAt;
    // The TV keeps only inputs newer than the last `t`, so never send twice at the same time.
    if (elapsed <= 0) return;
    const wait = edge ? 0 : changed ? MIN_INTERVAL_MS - INTERVAL_SLACK_MS : HEARTBEAT_MS;
    if (elapsed < wait) return;
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
