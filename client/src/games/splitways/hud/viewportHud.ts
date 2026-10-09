import type { Vector3 } from 'three';
import type { Rect } from '../render/viewports';
import type { Track } from '../track/track';
import { Minimap } from './minimap';

const ORDINAL_SUFFIX = ['st', 'nd', 'rd', 'th'];
/** Speed bar steps, prebuilt so the per-frame update allocates nothing. */
const BAR_STEPS = 40;
const BAR_SCALE = Array.from({ length: BAR_STEPS + 1 }, (_, i) => `scaleX(${i / BAR_STEPS})`);
/** The speed bar is full at this speed (km/h). */
const BAR_FULL_KPH = 190;
const SPEED_TEXT = Array.from({ length: 401 }, (_, i) => String(i));

export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

function element(className: string, parent: HTMLElement, tag = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  parent.appendChild(el);
  return el;
}

/** Per-viewport overlay drawn with plain DOM on top of the canvas. Text only changes when values do. */
export class ViewportHud {
  readonly element = document.createElement('div');
  private readonly position: HTMLElement;
  private readonly positionSuffix: HTMLElement;
  private readonly positionTotal: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly lapTime: HTMLElement;
  private readonly lastLap: HTMLElement;
  private readonly speedValue: HTMLElement;
  private readonly speedBar: HTMLElement;
  private readonly minimap: Minimap;
  private readonly countdown: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly status: HTMLElement;
  private readonly fade: HTMLElement;
  private readonly shown = new Map<string, string | number>();

  constructor(parent: HTMLElement, name: string, colourHex: string, track: Track) {
    this.element.className = 'sw-hud';
    this.element.style.setProperty('--player', colourHex);
    parent.appendChild(this.element);

    const tag = element('sw-hud-name', this.element);
    tag.textContent = name;

    const race = element('sw-hud-race', this.element);
    const place = element('sw-hud-place', race);
    this.position = element('sw-hud-pos', place, 'b');
    this.positionSuffix = element('sw-hud-suffix', place, 'small');
    this.positionTotal = element('sw-hud-total', place, 'span');
    const lapBox = element('sw-hud-lapbox', race);
    this.lap = element('sw-hud-lap', lapBox);
    this.lapTime = element('sw-hud-laptime', lapBox);
    this.lastLap = element('sw-hud-lastlap', lapBox);
    this.lastLap.hidden = true;

    const speed = element('sw-hud-speed', this.element);
    const readout = element('sw-hud-readout', speed);
    this.speedValue = element('', readout, 'b');
    element('', readout, 'small').textContent = 'km/h';
    const bar = element('sw-hud-speedbar', speed);
    this.speedBar = element('', bar, 'i');

    this.minimap = new Minimap(track);
    this.element.appendChild(this.minimap.canvas);

    this.countdown = element('sw-hud-countdown', this.element);
    this.banner = element('sw-hud-banner', this.element);
    this.status = element('sw-hud-status', this.element);
    this.fade = element('sw-hud-fade', this.element);
    this.banner.hidden = true;
    this.status.hidden = true;
  }

  place(rect: Rect): void {
    const style = this.element.style;
    style.left = `${rect.x}px`;
    style.top = `${rect.y}px`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
    // Scale type with the viewport so 1 and 4 player layouts both read well.
    const scale = Math.min(rect.width / 1280, rect.height / 720) ** 0.6;
    style.setProperty('--hud-scale', String(scale));
    this.minimap.resize(
      Math.max(64, Math.min(190, rect.height * 0.22)),
      Math.min(window.devicePixelRatio, 2),
    );
  }

  /** Every car's position and colour; `self` is this viewport's car. */
  updateMinimap(positions: readonly Vector3[], colours: readonly string[], self: number): void {
    this.minimap.update(positions, colours, self);
  }

  /** "LAST 0:41.23" under the lap clock for a few seconds after a lap; empty hides it. */
  setLastLap(text: string): void {
    if (!this.changed('lastlap', text)) return;
    this.lastLap.textContent = text;
    this.lastLap.hidden = text === '';
  }

  setSpeed(kph: number): void {
    const rounded = Math.round(kph);
    if (this.changed('speed', rounded))
      this.speedValue.textContent = SPEED_TEXT[rounded] ?? String(rounded);
    const step = Math.round(Math.min(1, kph / BAR_FULL_KPH) * BAR_STEPS);
    if (this.changed('bar', step)) this.speedBar.style.transform = BAR_SCALE[step] ?? '';
  }

  setPosition(place: number, total: number): void {
    if (this.changed('place', place * 10 + total)) {
      this.position.textContent = String(place);
      this.positionSuffix.textContent = ORDINAL_SUFFIX[Math.min(place, 4) - 1] ?? 'th';
      this.positionTotal.textContent = `/${total}`;
    }
  }

  setLap(lap: number, totalLaps: number, lapMs: number): void {
    const shownLap = Math.max(1, Math.min(lap, totalLaps));
    if (this.changed('lap', shownLap)) this.lap.textContent = `Lap ${shownLap}/${totalLaps}`;
    // Tenths are plenty for a running clock and cut DOM writes.
    const tenths = Math.floor(lapMs / 100);
    if (this.changed('laptime', tenths))
      this.lapTime.textContent = formatTime(tenths * 100).slice(0, -1);
  }

  /** "3", "2", "1", "GO" or empty. Each new value pops in. */
  setCountdown(text: string): void {
    if (!this.changed('countdown', text)) return;
    this.countdown.replaceChildren();
    if (!text) return;
    const span = document.createElement('span');
    span.textContent = text;
    if (text === 'GO') span.className = 'is-go';
    this.countdown.appendChild(span);
  }

  /** Centre banner: "WRONG WAY", "FINISHED 2ND", or empty to hide. */
  setBanner(text: string, tone: 'warn' | 'good' = 'warn'): void {
    const textChanged = this.changed('banner', text);
    const toneChanged = this.changed('tone', tone);
    if (!textChanged && !toneChanged) return;
    this.banner.textContent = text;
    this.banner.dataset.tone = tone;
    this.banner.hidden = text === '';
  }

  /** Full-viewport message (e.g. "Reconnecting..."); empty string hides it. */
  setStatus(text: string): void {
    if (!this.changed('status', text)) return;
    this.status.textContent = text;
    this.status.hidden = text === '';
  }

  /** 0..1 black fade, used while respawning. */
  setFade(amount: number): void {
    const rounded = Math.round(amount * 50) / 50;
    if (this.changed('fade', rounded)) this.fade.style.opacity = String(rounded);
  }

  dispose(): void {
    this.element.remove();
  }

  private changed(key: string, value: string | number): boolean {
    if (this.shown.get(key) === value) return false;
    this.shown.set(key, value);
    return true;
  }
}
