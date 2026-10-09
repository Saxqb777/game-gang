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

  constructor(
    private readonly step: () => void,
    private readonly render: (alpha: number, frameSeconds: number) => void,
  ) {}

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
    // rAF timestamps can predate start() (they mark the frame's start), so never go negative;
    // clamp long gaps (tab in background) so we don't fast-forward the race.
    const frameSeconds = Math.max(0, Math.min((now - this.last) / 1000, 0.1));
    this.last = now;
    this.accumulator += frameSeconds;
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < PHYSICS.maxStepsPerFrame) {
      this.step();
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) this.accumulator = 0;
    this.render(this.accumulator / this.stepSeconds, frameSeconds);
    this.frameHandle = requestAnimationFrame(this.frame);
  };
}
