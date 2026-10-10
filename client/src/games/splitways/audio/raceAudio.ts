/**
 * Race sound, all synthesised with Web Audio (no audio files): an engine per car with a fake
 * six-speed gearbox, tyre screech, wind (louder in a slipstream), off-road rumble, horn, impacts,
 * countdown beeps and a crowd. Each car is panned towards its viewport's side of the screen.
 */
import { AUDIO } from '../config';
import type { Car } from '../sim/car';

/** Time constant for smoothly following per-frame targets (s). */
const FOLLOW = 0.04;

interface Voice {
  car: Car;
  saw: OscillatorNode;
  sub: OscillatorNode;
  engineFilter: BiquadFilterNode;
  engineGain: GainNode;
  screechFilter: BiquadFilterNode;
  screechGain: GainNode;
  windGain: GainNode;
  sandGain: GainNode;
  hornGain: GainNode;
  panner: StereoPannerNode;
  gear: number;
  rpm: number;
  shiftUntil: number;
  lastImpact: number;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A few hundred pairs of hands (short filtered noise bursts) over a low roar. */
function applauseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, Math.floor(seconds * rate), rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const claps = Math.floor(240 * seconds);
    for (let c = 0; c < claps; c++) {
      const length = Math.floor(rate * (0.006 + Math.random() * 0.012));
      const start = Math.floor(Math.random() * (data.length - length));
      const amplitude = 0.08 + Math.random() * 0.22;
      const tone = 0.25 + Math.random() * 0.5;
      let filtered = 0;
      for (let i = 0; i < length; i++) {
        filtered += tone * (Math.random() * 2 - 1 - filtered);
        data[start + i] =
          (data[start + i] ?? 0) + filtered * amplitude * Math.exp(-i / (length * 0.3));
      }
    }
    let roar = 0;
    for (let i = 0; i < data.length; i++) {
      roar += 0.03 * (Math.random() * 2 - 1 - roar);
      data[i] = (data[i] ?? 0) + roar * 0.9;
    }
  }
  return buffer;
}

export class RaceAudio {
  private readonly master: GainNode;
  private readonly whiteNoise: AudioBuffer;
  private readonly applause: AudioBuffer;
  private readonly voices: Voice[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private lastCountdown = -1;
  private wasRacing = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    cars: readonly Car[],
  ) {
    this.whiteNoise = noiseBuffer(ctx, 2);
    this.applause = applauseBuffer(ctx, 5);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(AUDIO.master, ctx.currentTime, 0.3);
    this.master.connect(limiter).connect(ctx.destination);
    for (const car of cars) this.voices.push(this.createVoice(car));
  }

  /** -1 (left) .. 1 (right) for car `index`, from where its viewport sits on screen. */
  setPan(index: number, pan: number): void {
    this.voices[index]?.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.1);
  }

  /**
   * Once per frame per car. `throttle` and `horn` are what the player is pressing, even while the
   * car is held on the grid (so engines rev during the countdown).
   */
  updateCar(index: number, throttle: number, horn: boolean, onSand: boolean, draft: number): void {
    const voice = this.voices[index];
    if (!voice) return;
    const { car } = voice;
    const now = this.ctx.currentTime;
    const speed = Math.abs(car.forwardSpeed);
    const tops = AUDIO.gearTops;

    // Gearbox with a little hysteresis so it doesn't hunt between two gears.
    const top = tops[voice.gear - 1] ?? Infinity;
    const below = voice.gear > 1 ? (tops[voice.gear - 2] ?? 0) : 0;
    if (speed > top && voice.gear < tops.length) {
      voice.gear++;
      voice.shiftUntil = now + 0.09;
    } else if (voice.gear > 1 && speed < below - 2) {
      voice.gear--;
    }
    const low = voice.gear > 1 ? (tops[voice.gear - 2] ?? 0) : 0;
    const high = tops[voice.gear - 1] ?? 54;
    const t = Math.min(1, Math.max(0, (speed - low) / (high - low)));
    const geared =
      voice.gear === 1
        ? AUDIO.idleRpm + (AUDIO.redlineRpm - AUDIO.idleRpm) * t
        : AUDIO.redlineRpm * (0.55 + 0.45 * t);
    // Standing still with the gas down: free revs.
    const free = AUDIO.idleRpm + (AUDIO.redlineRpm * 0.8 - AUDIO.idleRpm) * throttle;
    const target = speed < 1.5 ? free : geared;
    voice.rpm += (target - voice.rpm) * 0.25;
    const pulses = (voice.rpm / 60) * 4;

    voice.saw.frequency.setTargetAtTime(pulses, now, FOLLOW);
    voice.sub.frequency.setTargetAtTime(pulses / 2, now, FOLLOW);
    const load = 0.3 + 0.7 * throttle;
    voice.engineFilter.frequency.setTargetAtTime(
      300 + 3200 * load * (voice.rpm / AUDIO.redlineRpm),
      now,
      FOLLOW,
    );
    const shifting = now < voice.shiftUntil ? 0.35 : 1;
    voice.engineGain.gain.setTargetAtTime(
      AUDIO.engine * (0.35 + 0.65 * load) * shifting,
      now,
      0.03,
    );

    let slide = 0;
    for (let i = 0; i < 4; i++) {
      if (car.wheelSkidding[i] === 1) slide = Math.max(slide, car.wheelSlide[i] ?? 0);
    }
    const screech = onSand ? 0 : Math.min(1, Math.max(0, (slide - 2.5) / 7));
    voice.screechGain.gain.setTargetAtTime(AUDIO.screech * screech, now, 0.05);
    voice.screechFilter.frequency.setTargetAtTime(1300 + Math.min(slide, 20) * 60, now, 0.05);

    const fast = Math.min(1, speed / 52);
    // Slipstream: the wind roars louder in another car's wake.
    voice.windGain.gain.setTargetAtTime(AUDIO.wind * fast * fast * (1 + 2.5 * draft), now, 0.1);
    voice.sandGain.gain.setTargetAtTime(
      onSand ? AUDIO.sand * Math.min(1, speed / 25) : 0,
      now,
      0.05,
    );
    voice.hornGain.gain.setTargetAtTime(horn ? AUDIO.horn : 0, now, 0.01);
  }

  /** Once per frame: beeps as the lights change. `countdown` is 3, 2, 1, then 0 once racing. */
  updateRace(countdown: number, racing: boolean): void {
    if (countdown !== this.lastCountdown && countdown > 0) this.beep(520, 0.16);
    if (racing && !this.wasRacing) this.beep(1040, 0.55);
    this.lastCountdown = countdown;
    this.wasRacing = racing;
  }

  /** A hit: `strength` 0..1. */
  impact(index: number, strength: number): void {
    const voice = this.voices[index];
    const now = this.ctx.currentTime;
    if (!voice || now - voice.lastImpact < 0.12) return;
    voice.lastImpact = now;
    const level = AUDIO.impact * (0.25 + 0.75 * strength);
    const source = this.ctx.createBufferSource();
    source.buffer = this.whiteNoise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + strength * 1500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + strength * 0.25);
    source.connect(filter).connect(gain).connect(voice.panner);
    source.start(now, Math.random());
    source.stop(now + 0.6);
    const thump = this.ctx.createOscillator();
    thump.frequency.setValueAtTime(90, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(level * 0.9, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    thump.connect(thumpGain).connect(voice.panner);
    thump.start(now);
    thump.stop(now + 0.3);
  }

  /** The crowd: big for the winner, smaller for everyone after. */
  cheer(big: boolean): void {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.applause;
    const gain = this.ctx.createGain();
    const level = AUDIO.crowd * (big ? 1 : 0.5);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.4);
    gain.gain.setTargetAtTime(0, now + 3.2, 0.6);
    source.connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 5);
  }

  /** Podium: engines and tyres fade out under the applause. */
  podium(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.voices) {
      for (const gain of [
        voice.engineGain,
        voice.screechGain,
        voice.windGain,
        voice.sandGain,
        voice.hornGain,
      ]) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.4);
      }
    }
    this.cheer(true);
  }

  dispose(): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.05);
    for (const source of this.sources) source.stop(now + 0.3);
    setTimeout(() => this.master.disconnect(), 400);
  }

  private beep(frequency: number, seconds: number): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = frequency;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(AUDIO.beeps, now + 0.01);
    gain.gain.setTargetAtTime(0, now + seconds, 0.03);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + seconds + 0.3);
  }

  private createVoice(car: Car): Voice {
    const { ctx } = this;
    const panner = ctx.createStereoPanner();
    panner.connect(this.master);

    // Engine: sawtooth at the firing rate plus a square an octave down, soft-clipped and filtered.
    const saw = this.started(ctx.createOscillator());
    saw.type = 'sawtooth';
    const sub = this.started(ctx.createOscillator());
    sub.type = 'square';
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 255) * 2 - 1) * 2.5);
    shaper.curve = curve;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.Q.value = 1.8;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    saw.connect(mix);
    sub.connect(mix);
    mix.connect(shaper).connect(engineFilter).connect(engineGain).connect(panner);

    // One noise loop per car feeds the screech, the wind and the sand rumble.
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteNoise;
    noise.loop = true;
    this.started(noise, Math.random() * 2);
    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.Q.value = 7;
    const screechGain = ctx.createGain();
    screechGain.gain.value = 0;
    noise.connect(screechFilter).connect(screechGain).connect(panner);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter).connect(windGain).connect(panner);
    const sandFilter = ctx.createBiquadFilter();
    sandFilter.type = 'lowpass';
    sandFilter.frequency.value = 380;
    const sandGain = ctx.createGain();
    sandGain.gain.value = 0;
    noise.connect(sandFilter).connect(sandGain).connect(panner);

    // Horn: two notes a third apart.
    const hornGain = ctx.createGain();
    hornGain.gain.value = 0;
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 1800;
    hornFilter.connect(hornGain).connect(panner);
    for (const frequency of [392, 494]) {
      const horn = this.started(ctx.createOscillator());
      horn.type = 'square';
      horn.frequency.value = frequency;
      horn.connect(hornFilter);
    }

    return {
      car,
      saw,
      sub,
      engineFilter,
      engineGain,
      screechFilter,
      screechGain,
      windGain,
      sandGain,
      hornGain,
      panner,
      gear: 1,
      rpm: AUDIO.idleRpm,
      shiftUntil: 0,
      lastImpact: 0,
    };
  }

  /** Starts a looping source now and remembers it so dispose() can stop it. */
  private started<T extends OscillatorNode | AudioBufferSourceNode>(node: T, offset = 0): T {
    this.sources.push(node);
    if (node instanceof AudioBufferSourceNode) node.start(0, offset);
    else node.start();
    return node;
  }
}
