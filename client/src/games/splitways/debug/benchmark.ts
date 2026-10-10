/**
 * Scripted benchmarks (the game drives them; see SplitWaysGame):
 *  - fly-through (`?bench=auto|matrix`, debug key B): physics paused, N cameras glide along the track
 *    at 45 m/s, one per viewport, for each viewport count and preset; one telemetry sample per run.
 *  - soak (`?bench=soak`): a 99-lap autopilot race, one sample per minute, a summary after 30 min.
 */
import type { TelemetrySample, TrackId } from '@gamergang/shared';
import { PerspectiveCamera, Vector3 } from 'three';
import { BENCH } from '../config';
import type { FrameWindow } from '../render/frameStats';
import { PRESET_ORDER, type PresetId } from '../render/quality';
import type { RenderStats } from '../render/renderer';
import type { Track } from '../track/track';

export interface BenchRun {
  views: number;
  preset: PresetId;
}

/** `auto`: the three real configurations. `matrix`: every viewport count with every preset. */
export function benchRuns(mode: 'auto' | 'matrix'): BenchRun[] {
  if (mode === 'auto') {
    return [
      { views: 1, preset: 'high' },
      { views: 2, preset: 'medium' },
      { views: 4, preset: 'low' },
    ];
  }
  const runs: BenchRun[] = [];
  for (const views of [1, 2, 4]) {
    for (const preset of PRESET_ORDER) runs.push({ views, preset });
  }
  return runs;
}

export function flythroughScenario(run: BenchRun): string {
  return `fly-${run.views}-${run.preset}`;
}

const LOOK_LIFT = 0.9;
const BENCH_FOV = 62;

/** N cameras spaced evenly round the lap, gliding along the centre line. */
export class FlyThrough {
  readonly cameras: PerspectiveCamera[];
  private readonly eye = new Vector3();
  private readonly target = new Vector3();

  constructor(
    private readonly track: Track,
    count: number,
    far: number,
  ) {
    this.cameras = Array.from(
      { length: count },
      () => new PerspectiveCamera(BENCH_FOV, 1, 0.1, far),
    );
  }

  /** Places every camera `seconds` into the run; `aspects` are the views' width / height. */
  update(seconds: number, aspects: readonly number[]): void {
    const track = this.track;
    const n = this.cameras.length;
    this.cameras.forEach((camera, k) => {
      const d = track.startLine.distance + (k * track.length) / n + seconds * BENCH.cameraSpeed;
      this.eye.copy(track.sampleAt(track.wrap(d)).position);
      this.eye.y += BENCH.cameraHeight;
      this.target.copy(track.sampleAt(track.wrap(d + BENCH.lookAhead)).position);
      this.target.y += LOOK_LIFT;
      camera.position.copy(this.eye);
      camera.lookAt(this.target);
      camera.aspect = aspects[k] ?? 16 / 9;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    });
  }
}

/** One telemetry sample from a frame window and the renderer's current state. */
export function telemetrySample(
  kind: TelemetrySample['kind'],
  scenario: string,
  window: FrameWindow,
  render: RenderStats,
  track: TrackId | null,
): TelemetrySample {
  return {
    kind,
    scenario,
    track,
    viewports: render.viewports,
    preset: render.preset,
    durationMs: window.durationMs,
    frames: window.frames,
    fpsAvg: window.fpsAvg,
    frameMsP50: window.frameMsP50,
    frameMsP95: window.frameMsP95,
    frameMsP99: window.frameMsP99,
    frameMsMax: window.frameMsMax,
    cpuMsP99: window.cpuMsP99,
    gpuMsAvg: window.gpuMsAvg,
    gpuMsP95: window.gpuMsP95,
    gpuMsP99: window.gpuMsP99,
    missedFrames: window.missedFrames,
    internalWidth: render.internalWidth,
    internalHeight: render.internalHeight,
    outputWidth: render.outputWidth,
    outputHeight: render.outputHeight,
    scaleAvg: window.scaleAvg,
    scaleMin: window.scaleMin,
    drawCallsAvg: window.drawCallsAvg,
    trianglesAvg: window.trianglesAvg,
    presetDrops: render.drops,
  };
}

const n1 = (n: number) => n.toFixed(1);
const opt = (n: number | null) => (n === null ? '-' : n.toFixed(1));

/** The results table shown after a fly-through. */
export function formatBenchTable(
  title: string,
  samples: readonly TelemetrySample[],
  render: RenderStats,
): string {
  const header = [
    'run'.padEnd(14),
    'fps'.padStart(6),
    'p50'.padStart(6),
    'p95'.padStart(6),
    'p99'.padStart(6),
    'max'.padStart(6),
    'cpu99'.padStart(6),
    'gpu avg/p99'.padStart(12),
    'missed'.padStart(7),
    'scale'.padStart(10),
    'internal'.padStart(10),
    'draws'.padStart(6),
    'tris'.padStart(7),
  ].join(' ');
  const rows = samples.map((s) =>
    [
      s.scenario.padEnd(14),
      n1(s.fpsAvg).padStart(6),
      n1(s.frameMsP50).padStart(6),
      n1(s.frameMsP95).padStart(6),
      n1(s.frameMsP99).padStart(6),
      n1(s.frameMsMax).padStart(6),
      n1(s.cpuMsP99).padStart(6),
      `${opt(s.gpuMsAvg)}/${opt(s.gpuMsP99)}`.padStart(12),
      `${s.missedFrames}/${s.frames}`.padStart(7),
      `${s.scaleAvg.toFixed(2)}>${s.scaleMin.toFixed(2)}`.padStart(10),
      `${s.internalWidth}x${s.internalHeight}`.padStart(10),
      s.drawCallsAvg.toFixed(0).padStart(6),
      `${(s.trianglesAvg / 1e6).toFixed(2)}M`.padStart(7),
    ].join(' '),
  );
  return [
    title,
    `refresh ${render.refreshHz} Hz  gpu timer ${render.timing === 'timer-query' ? 'yes' : 'no'}  dpr ${render.devicePixelRatio.toFixed(2)}  drops ${render.drops}`,
    '',
    header,
    ...rows,
    '',
    'Press any key to close',
  ].join('\n');
}

/** The soak summary over the whole run. */
export function formatSoakSummary(
  total: TelemetrySample,
  minutes: number,
  render: RenderStats,
): string {
  const missedShare = total.frames > 0 ? (total.missedFrames / total.frames) * 100 : 0;
  return [
    `SOAK DONE  ${minutes} min  ${total.viewports} viewports  preset ${total.preset.toUpperCase()}  drops ${total.presetDrops}`,
    `frames ${total.frames}  fps ${n1(total.fpsAvg)}  frame p99 ${n1(total.frameMsP99)} ms  max ${n1(total.frameMsMax)} ms`,
    `cpu p99 ${n1(total.cpuMsP99)} ms  gpu avg ${opt(total.gpuMsAvg)} p99 ${opt(total.gpuMsP99)} ms (${render.timing === 'timer-query' ? 'timer' : 'no timer'})`,
    `missed ${total.missedFrames} (${missedShare.toFixed(2)}%)  scale avg ${total.scaleAvg.toFixed(2)} min ${total.scaleMin.toFixed(2)}  refresh ${render.refreshHz} Hz`,
    'Still running. Esc ends the soak.',
  ].join('\n');
}

/**
 * The next period start: one period on, so windows don't drift late frame by frame, unless the page
 * stalled for longer than that (a hidden tab), when the schedule restarts from now.
 */
function advance(start: number, now: number, period: number): number {
  return now - start >= 2 * period ? now : start + period;
}

/** Wall-clock schedule of the soak: window samples, batched posts, the end. */
export class SoakClock {
  private startedAt: number | null = null;
  private windowAt = 0;
  private postAt = 0;
  private windows = 0;
  private finished = false;

  start(now: number): void {
    this.startedAt = now;
    this.windowAt = now;
    this.postAt = now;
  }

  /**
   * What is due now: `window` is the number (1-based) of the window that just closed, for scenario
   * names like soak-07, or null. Each event is reported once.
   */
  tick(now: number): { window: number | null; post: boolean; done: boolean } {
    if (this.startedAt === null || this.finished) return { window: null, post: false, done: false };
    let window: number | null = null;
    if (now - this.windowAt >= BENCH.soakWindowSeconds * 1000) {
      this.windowAt = advance(this.windowAt, now, BENCH.soakWindowSeconds * 1000);
      window = ++this.windows;
    }
    const post = now - this.postAt >= BENCH.soakPostEveryMinutes * 60_000;
    if (post) this.postAt = advance(this.postAt, now, BENCH.soakPostEveryMinutes * 60_000);
    const done = now - this.startedAt >= BENCH.soakMinutes * 60_000;
    if (done) this.finished = true;
    return { window, post, done };
  }
}

/** The `<pre>` results panel over the game; any key closes it (unless it is sticky). */
export class BenchPanel {
  private readonly element = document.createElement('pre');

  constructor(parent: HTMLElement) {
    this.element.className = 'sw-bench';
    this.element.hidden = true;
    parent.appendChild(this.element);
  }

  show(text: string, closeOnKey: boolean): void {
    this.element.textContent = text;
    this.element.hidden = false;
    window.removeEventListener('keydown', this.onKey);
    if (closeOnKey) {
      // Not the key press that is still being handled (B itself, say).
      setTimeout(() => window.addEventListener('keydown', this.onKey), 0);
    }
  }

  hide(): void {
    this.element.hidden = true;
    window.removeEventListener('keydown', this.onKey);
  }

  dispose(): void {
    this.hide();
    this.element.remove();
  }

  private readonly onKey = (): void => {
    this.hide();
  };
}
