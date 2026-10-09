import type { Rect } from '../render/viewports';

/** Per-viewport overlay drawn with plain DOM on top of the canvas. Text only changes when values do. */
export class ViewportHud {
  readonly element = document.createElement('div');
  private readonly speedValue = document.createElement('b');
  private readonly status = document.createElement('div');
  private shownSpeed = -1;
  private shownStatus = '';

  constructor(parent: HTMLElement, name: string, colourHex: string) {
    this.element.className = 'sw-hud';
    this.element.style.setProperty('--player', colourHex);

    const tag = document.createElement('div');
    tag.className = 'sw-hud-name';
    tag.textContent = name;

    const speed = document.createElement('div');
    speed.className = 'sw-hud-speed';
    const unit = document.createElement('small');
    unit.textContent = 'km/h';
    speed.append(this.speedValue, unit);

    this.status.className = 'sw-hud-status';
    this.status.hidden = true;

    this.element.append(tag, speed, this.status);
    parent.appendChild(this.element);
  }

  place(rect: Rect): void {
    const style = this.element.style;
    style.left = `${rect.x}px`;
    style.top = `${rect.y}px`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
    // Scale type with the viewport so 1 and 4 player layouts both read well.
    style.setProperty('--hud-scale', String(Math.min(rect.width / 1280, rect.height / 720) ** 0.6));
  }

  setSpeed(kph: number): void {
    const rounded = Math.round(kph);
    if (rounded === this.shownSpeed) return;
    this.shownSpeed = rounded;
    this.speedValue.textContent = String(rounded);
  }

  /** Big centred message (e.g. "Reconnecting..."); empty string hides it. */
  setStatus(text: string): void {
    if (text === this.shownStatus) return;
    this.shownStatus = text;
    this.status.textContent = text;
    this.status.hidden = text === '';
  }

  dispose(): void {
    this.element.remove();
  }
}
