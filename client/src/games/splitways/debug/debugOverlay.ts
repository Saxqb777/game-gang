import type { DriveInput } from '../sim/input';

export interface DebugStats {
  fps: number;
  frameMs: number;
  physicsMs: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  /** Dynamic resolution scale (1 = full) and whether it is adjusting itself. */
  renderScale: number;
  autoResolution: boolean;
  viewports: number;
  autopilot: boolean;
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
}

const fmt = (n: number, digits = 2) => (n >= 0 ? ' ' : '') + n.toFixed(digits);

/** Hidden tuning overlay on the TV. Toggle with the backtick key. */
export class DebugOverlay {
  private readonly element = document.createElement('pre');
  private visible = false;
  private lastPaint = 0;

  constructor(parent: HTMLElement) {
    this.element.className = 'sw-debug';
    this.element.hidden = true;
    parent.appendChild(this.element);
    window.addEventListener('keydown', this.onKey);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  update(stats: DebugStats, drivers: readonly DebugDriver[]): void {
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastPaint < 250) return;
    this.lastPaint = now;
    const lines = [
      `fps ${stats.fps.toFixed(0).padStart(3)}   frame ${stats.frameMs.toFixed(1)} ms   physics ${stats.physicsMs.toFixed(2)} ms/step`,
      `draw calls ${stats.drawCalls}   triangles ${(stats.triangles / 1000).toFixed(0)}k   viewports ${stats.viewports}   pixel ratio ${stats.pixelRatio.toFixed(2)}`,
      `render scale ${stats.renderScale.toFixed(2)} (${stats.autoResolution ? 'auto' : 'fixed'}, R to toggle)`,
      '',
      stats.autopilot ? 'AUTOPILOT ON (P to stop)' : 'P: autopilot for every car (testing)',
      'N: every car to its next checkpoint   I: give every car an item',
      '',
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
  };
}
