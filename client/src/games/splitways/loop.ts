import { PHYSICS } from './config';

/**
 * Fixed-timestep game loop: physics always advances in 1/60 s steps, rendering happens once per
 * display frame and gets `alpha` (0..1) to interpolate between the last two physics states.
 */
export class FixedStepLoop {
  private frameHandle = 0;
  private last = 0;
  private accumulator = 0;
  private running = false;
  readonly stepSeconds = 1 / PHYSICS.stepHz;
  /**
   * False pauses physics but keeps rendering (loading benchmark, fly-through). Paused time is not
   * banked, so there is no catch-up burst when stepping resumes.
   */
  stepping = true;
  /** Raw, unclamped time since the previous animation frame (ms). */
  lastDeltaMs = 0;
  /** Time spent inside the last animation frame callback: physics steps plus rendering (ms). */
  lastCpuMs = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (alpha: number, frameSeconds: number) => void,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const started = performance.now();
    // rAF timestamps can predate start() (they mark the frame's start), so never go negative;
    // clamp long gaps (tab in background) so we don't fast-forward the race.
    this.lastDeltaMs = Math.max(0, now - this.last);
    const frameSeconds = Math.min(this.lastDeltaMs / 1000, 0.1);
    this.last = now;
    if (this.stepping) {
      this.accumulator += frameSeconds;
      let steps = 0;
      while (this.accumulator >= this.stepSeconds && steps < PHYSICS.maxStepsPerFrame) {
        this.step();
        this.accumulator -= this.stepSeconds;
        steps++;
      }
      if (steps === PHYSICS.maxStepsPerFrame) this.accumulator = 0;
    }
    this.render(this.accumulator / this.stepSeconds, frameSeconds);
    this.lastCpuMs = performance.now() - started;
    this.frameHandle = requestAnimationFrame(this.frame);
  };
}
