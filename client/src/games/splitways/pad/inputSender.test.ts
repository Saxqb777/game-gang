import { describe, expect, it } from 'vitest';
import type { InputMessage } from '@gamergang/shared';
import { HEARTBEAT_MS, InputSender, type PadInput } from './inputSender';

const FRAME_MS = 1000 / 60;
const idle: PadInput = { steer: 0, throttle: 0, brake: 0, handbrake: false, horn: false };

function recorder() {
  const sent: Omit<InputMessage, 'type'>[] = [];
  const sender = new InputSender((message) => {
    sent.push(message);
    return true;
  });
  return { sent, sender };
}

function gapsOf(sent: readonly { t: number }[]): number[] {
  return sent.slice(1).map((m, i) => m.t - (sent[i]?.t ?? m.t));
}

/** A frame clock with up to ±1.5 ms of callback jitter, the same every run. */
function jitteredFrames(count: number): number[] {
  let seed = 7;
  return Array.from({ length: count }, (_, n) => {
    seed = (seed * 16807) % 2147483647;
    return 1 + n * FRAME_MS + ((seed / 2147483647) * 3 - 1.5);
  });
}

describe('InputSender', () => {
  it('sends every frame at 60 Hz while steering keeps changing, despite frame jitter', () => {
    const { sent, sender } = recorder();
    const frames = jitteredFrames(600);
    frames.forEach((now, n) =>
      sender.update({ ...idle, throttle: 1, steer: (n % 60) / 30 - 1 }, now),
    );
    expect(sent).toHaveLength(frames.length);
    const gaps = gapsOf(sent);
    expect(Math.max(...gaps)).toBeLessThan(FRAME_MS + 3.1);
  });

  it('does not send faster than about once a frame when sampled twice a frame', () => {
    const { sent, sender } = recorder();
    for (let n = 0; n < 1200; n++)
      sender.update({ ...idle, steer: Math.sin(n / 5) }, n * (FRAME_MS / 2));
    const seconds = (1199 * (FRAME_MS / 2)) / 1000;
    expect(sent.length / seconds).toBeLessThanOrEqual(61);
  });

  it('sends presses and releases at once, without waiting for the rate limit', () => {
    const { sent, sender } = recorder();
    let now = 0;
    sender.update({ ...idle, throttle: 0.5 }, now);
    const steps: Partial<PadInput>[] = [
      { throttle: 0 },
      { throttle: 0.5 },
      { throttle: 0.5, brake: 1 },
      { throttle: 0.5, brake: 0 },
      { throttle: 0.5, handbrake: true },
      { throttle: 0.5, handbrake: false },
      { throttle: 0.5, horn: true },
    ];
    for (const step of steps) {
      now += 1;
      sender.update({ ...idle, ...step }, now);
    }
    expect(sent.map((m) => m.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('rate-limits throttle feathering that does not cross zero', () => {
    const { sent, sender } = recorder();
    sender.update({ ...idle, throttle: 0.5 }, 0);
    sender.update({ ...idle, throttle: 0.6 }, 5);
    expect(sent).toHaveLength(1);
    sender.update({ ...idle, throttle: 0.6 }, FRAME_MS);
    expect(sent.at(-1)).toMatchObject({ throttle: 0.6, t: FRAME_MS });
  });

  it('never repeats a timestamp, so the TV does not drop a press as stale', () => {
    const { sent, sender } = recorder();
    sender.update({ ...idle, brake: 1 }, 10);
    sender.update({ ...idle, brake: 0 }, 10);
    expect(sent).toHaveLength(1);
    sender.update({ ...idle, brake: 0 }, 10.1);
    expect(sent.at(-1)).toMatchObject({ brake: 0, t: 10.1 });
  });

  it('repeats an unchanged state every heartbeat', () => {
    const { sent, sender } = recorder();
    for (let now = 0; now <= 1000; now += FRAME_MS) sender.update({ ...idle, throttle: 1 }, now);
    const gaps = gapsOf(sent);
    expect(gaps.length).toBeGreaterThanOrEqual(8);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(HEARTBEAT_MS);
      expect(gap).toBeLessThan(HEARTBEAT_MS + FRAME_MS);
    }
  });

  it('ignores steering noise inside the dead zone', () => {
    const { sent, sender } = recorder();
    sender.update({ ...idle, steer: 0.5 }, 0);
    sender.update({ ...idle, steer: 0.51 }, 20);
    sender.update({ ...idle, steer: 0.505 }, 40);
    expect(sent).toHaveLength(1);
  });

  it('retries a failed send on the next sample', () => {
    let ok = false;
    const sent: number[] = [];
    const sender = new InputSender((message) => {
      if (ok) sent.push(message.t);
      return ok;
    });
    sender.update({ ...idle, brake: 1 }, 0);
    ok = true;
    sender.update({ ...idle, brake: 1 }, 1);
    expect(sent).toEqual([1]);
  });
});
