import type { Vector3 } from 'three';
import type { Track } from '../track/track';

const PADDING = 10;

/**
 * Track map in the corner of a viewport, north up. The loop is drawn once per size into a cached
 * canvas; each update only blits it and draws one dot per car (yours bigger, with a white ring).
 */
export class Minimap {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base = document.createElement('canvas');
  private readonly minX: number;
  private readonly minZ: number;
  private readonly spanX: number;
  private readonly spanZ: number;
  private scale = 1;
  private pixelRatio = 1;

  constructor(private readonly track: Track) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.canvas.className = 'sw-minimap';
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.position.x);
      maxX = Math.max(maxX, s.position.x);
      minZ = Math.min(minZ, s.position.z);
      maxZ = Math.max(maxZ, s.position.z);
    }
    this.minX = minX;
    this.minZ = minZ;
    this.spanX = maxX - minX;
    this.spanZ = maxZ - minZ;
  }

  /** `height` in CSS pixels; the width follows the track's shape. */
  resize(height: number, pixelRatio: number): void {
    const width = (height - PADDING * 2) * (this.spanX / this.spanZ) + PADDING * 2;
    this.pixelRatio = pixelRatio;
    this.canvas.style.width = `${Math.round(width)}px`;
    this.canvas.style.height = `${Math.round(height)}px`;
    this.canvas.width = this.base.width = Math.round(width * pixelRatio);
    this.canvas.height = this.base.height = Math.round(height * pixelRatio);
    this.scale = ((height - PADDING * 2) * pixelRatio) / this.spanZ;
    this.drawBase();
  }

  /** Every car's position and colour; `self` is this viewport's car. */
  update(positions: readonly Vector3[], colours: readonly string[], self: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    for (let i = 0; i < positions.length; i++) {
      if (i !== self) this.dot(positions[i] as Vector3, colours[i] ?? '#fff', 3.5, false);
    }
    const own = positions[self];
    if (own) this.dot(own, colours[self] ?? '#fff', 5.5, true);
  }

  private dot(position: Vector3, colour: string, radius: number, ringed: boolean): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(this.mapX(position.x), this.mapY(position.z), radius * this.pixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    if (ringed) {
      ctx.lineWidth = 2 * this.pixelRatio;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  private mapX(x: number): number {
    return PADDING * this.pixelRatio + (x - this.minX) * this.scale;
  }

  private mapY(z: number): number {
    return PADDING * this.pixelRatio + (z - this.minZ) * this.scale;
  }

  private drawBase(): void {
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const r = this.pixelRatio;
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    ctx.fillStyle = 'rgba(5, 6, 9, 0.45)';
    ctx.beginPath();
    ctx.roundRect(0, 0, this.base.width, this.base.height, 10 * r);
    ctx.fill();
    ctx.beginPath();
    this.track.samples.forEach((s, i) => {
      if (i === 0) ctx.moveTo(this.mapX(s.position.x), this.mapY(s.position.z));
      else ctx.lineTo(this.mapX(s.position.x), this.mapY(s.position.z));
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 7 * r;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3.5 * r;
    ctx.stroke();
    // Start/finish line.
    const start = this.track.startLine.sample;
    const x = this.mapX(start.position.x);
    const y = this.mapY(start.position.z);
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 3 * r;
    ctx.beginPath();
    ctx.moveTo(x - start.right.x * 7 * r, y - start.right.z * 7 * r);
    ctx.lineTo(x + start.right.x * 7 * r, y + start.right.z * 7 * r);
    ctx.stroke();
  }
}
