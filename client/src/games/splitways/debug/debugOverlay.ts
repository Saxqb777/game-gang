import type { RenderStats } from '../render/renderer';
import type { DriveInput } from '../sim/input';

export interface DebugStats {
  render: RenderStats;
  physicsMs: number;
  autopilot: boolean;
  /** Players (the 3-player overview cell is a view, not a player). */
  viewports: number;
  /** Debug key V: every car hidden, so draws and tris without cars can be read off. */
  carsHidden: boolean;
}

export interface DebugDriver {
  name: string;
  colour: string;
  input: Readonly<DriveInput>;
  speedKph: number;
  slipDeg: number;
  rttMs: number | null;
  connected: boolean;
  lap: number;
  nextGate: number;
  place: number;
  car: string;
  /** The car's level of detail in this driver's own view. */
  lod: number;
  paint: string;
}

const fmt = (n: number, digits = 2) => (n >= 0 ? ' ' : '') + n.toFixed(digits);
const ms = (n: number) => n.toFixed(1);

/** 1.9M, 348k, 512 */
function count(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(0);
}

const PAINT_EVERY_MS = 250;

/** Hidden tuning and profiling overlay on the TV. Toggle with the backtick key. */
export class DebugOverlay {
  private readonly element = document.createElement('pre');
  private visible = false;
  private lastPaint = 0;
  /** The frame window at the last paint, for a live fps between paints. */
  private paintedFrames = 0;
  private paintedMs = 0;

  constructor(parent: HTMLElement) {
    this.element.className = 'sw-debug';
    this.element.hidden = true;
    parent.appendChild(this.element);
    window.addEventListener('keydown', this.onKey);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** True when the overlay is up and due a repaint (4 times a second), so stats are only gathered then. */
  get needsPaint(): boolean {
    return this.visible && performance.now() - this.lastPaint >= PAINT_EVERY_MS;
  }

  update(stats: DebugStats, drivers: readonly DebugDriver[]): void {
    if (!this.visible) return;
    this.lastPaint = performance.now();
    const r = stats.render;
    const w = r.window;
    // Frames since the last paint; after a window reset (or the first paint) the window average.
    const frames = w.frames - this.paintedFrames;
    const elapsed = w.durationMs - this.paintedMs;
    const fps = frames > 0 && elapsed > 0 ? (frames * 1000) / elapsed : w.fpsAvg;
    this.paintedFrames = w.frames;
    this.paintedMs = w.durationMs;
    const gpu =
      r.timing === 'timer-query'
        ? `gpu ${r.gpuMs === null ? '-' : ms(r.gpuMs)} ms (timer)  p99 ${w.gpuMsP99 === null ? '-' : ms(w.gpuMsP99)}`
        : `gpu n/a (no timer)  cpu frame ${ms(r.cpuMs)} ms`;
    const lines = [
      `fps ${fps.toFixed(0).padStart(3)}  frame p50 ${ms(w.frameMsP50)} p99 ${ms(w.frameMsP99)} ms  missed ${w.missedFrames}  cpu ${ms(r.cpuMs)} ms  physics ${stats.physicsMs.toFixed(2)} ms/step`,
      gpu,
      `preset ${r.preset.toUpperCase()} (auto, drops ${r.drops})  scale ${r.scale.toFixed(2)} (${r.resolutionAuto ? 'auto' : 'fixed'}, R toggles)  internal ${r.internalWidth}x${r.internalHeight} x${r.viewports} -> out ${r.outputWidth}x${r.outputHeight}  dpr ${r.devicePixelRatio.toFixed(2)}  sharpen ${r.sharpening ? 'on' : 'off'}`,
      `draws ${r.drawCalls}  tris ${count(r.triangles)}  programs ${r.programs} (late ${r.latePrograms})  viewports ${r.viewports}  refresh ${r.refreshHz} Hz`,
      'B benchmark  P autopilot  N next checkpoint  R resolution  V cars on/off',
      stats.autopilot ? 'AUTOPILOT ON (P to stop)' : '',
      stats.carsHidden ? 'CARS HIDDEN (V to show): draws and tris above are without cars' : '',
      'driver        steer  gas   brake hb horn  km/h  slip   rtt   P lap gate',
      ...drivers.map((d) => {
        const i = d.input;
        return [
          d.name.padEnd(12).slice(0, 12),
          fmt(i.steer),
          i.throttle.toFixed(2),
          i.brake.toFixed(2),
          i.handbrake ? ' x' : ' -',
          i.horn ? '  x ' : '  - ',
          d.speedKph.toFixed(0).padStart(5),
          `${d.slipDeg.toFixed(0).padStart(4)}°`,
          d.connected
            ? d.rttMs === null
              ? '   -'
              : `${d.rttMs.toFixed(0).padStart(4)}ms`
            : ' lost',
          ` ${d.place}`,
          String(d.lap).padStart(3),
          String(d.nextGate).padStart(4),
        ].join(' ');
      }),
      'car         lod  paint',
      ...drivers.map((d) => `${d.car.padEnd(11)} ${String(d.lod).padStart(3)}  ${d.paint}`),
    ];
    this.element.textContent = lines.join('\n');
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.element.remove();
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.code !== 'Backquote') return;
    this.visible = !this.visible;
    this.element.hidden = !this.visible;
    this.lastPaint = 0;
    this.paintedFrames = 0;
    this.paintedMs = 0;
  };
}
