/**
 * Split Ways on the TV: owns the physics, the race, the scene, every player's car and camera, and
 * the loop. The hub feeds it pad inputs and button actions; it answers with race status, haptics
 * and the results.
 */
import {
  colourHex,
  type ColourId,
  type GameAction,
  type InputMessage,
  type TelemetrySample,
  type TvMessage,
} from '@gamergang/shared';
import { Color, FogExp2, Scene, type DataTexture, type Sprite, type Vector3 } from 'three';
import { RaceAudio } from './audio/raceAudio';
import { BENCH, CAR, INPUT, LIGHTING, POST, RACE, RESOLUTION } from './config';
import { autopilot } from './debug/autopilot';
import { DebugOverlay } from './debug/debugOverlay';
import {
  BenchPanel,
  FlyThrough,
  SoakClock,
  benchRuns,
  flythroughScenario,
  formatBenchTable,
  formatSoakSummary,
  telemetrySample,
} from './debug/benchmark';
import { ViewportHud, formatTime } from './hud/viewportHud';
import { KeyboardDriver } from './input/keyboard';
import { FixedStepLoop } from './loop';
import { Race, type Racer } from './race/race';
import { Slipstream } from './race/slipstream';
import { ChaseCamera } from './render/chaseCamera';
import { frameIntervalMs } from './render/frameStats';
import { OverviewCamera } from './render/overviewCamera';
import { GameRenderer, measureRefreshHz } from './render/renderer';
import { installHaze } from './render/haze';
import {
  getPreset,
  lowerPreset,
  noteLoadingDrop,
  recordRaceOutcome,
  sessionDrops,
  startingPreset,
  type QualityPreset,
} from './render/quality';
import { createShadowRig, type ShadowRig } from './render/shadowRig';
import { Sky } from './render/sky';
import { overviewCell, roundRect, viewportLayout, type Rect } from './render/viewports';
import { CarModelLibrary, type CarVisual } from './scene/carVisual';
import { Dust } from './scene/dust';
import { NAME_TAG_HEIGHT, createNameTag, disposeNameTag } from './scene/nameTag';
import { Podium, type PodiumEntry } from './scene/podium';
import { SkidMarks } from './scene/skidMarks';
import { WorldVisual } from './scene/world';
import type { Car } from './sim/car';
import { NEUTRAL_INPUT, copyInput, mergeInputs, type DriveInput } from './sim/input';
import { Simulation, type Impact } from './sim/simulation';
import { PhysicsWorld } from './sim/world';
import { Terrain } from './track/terrain';
import type { Track } from './track/track';
import { buildTrackPhysics } from './track/trackPhysics';
import { TRACK_1, loadTrack1 } from './track/tracks';

export interface GamePlayer {
  id: string;
  name: string;
  colour: ColourId;
  slot: number;
  /** Plays on the TV keyboard. */
  local: boolean;
}

export interface RaceResult {
  id: string;
  name: string;
  colour: ColourId;
  place: number;
  totalMs: number | null;
  bestLapMs: number | null;
}

export interface GameHooks {
  send(playerId: string, message: TvMessage): void;
  rttMs(playerId: string): number | null;
  /** The race is over and the podium is up: final standings, winner first. */
  onResults(results: RaceResult[]): void;
  /** Where race sound goes; null plays silently. */
  audio: AudioContext | null;
  /** Performance samples for the telemetry API (the client batches and sends them). */
  telemetry(samples: TelemetrySample[]): void;
}

/** `?bench=`: fly-through after loading (auto, matrix) or a 30-minute autopilot soak race. */
export type BenchMode = 'auto' | 'matrix' | 'soak';
export interface GameOptions {
  bench: BenchMode | null;
}

interface Driver {
  player: GamePlayer;
  car: Car;
  racer: Racer;
  visual: CarVisual;
  /** Name floating above the car, shown in everyone else's viewport. */
  tag: Sprite;
  camera: ChaseCamera;
  hud: ViewportHud;
  /** Latest input from the pad, and when it arrived (performance.now()). */
  padInput: DriveInput;
  padInputAt: number;
  connected: boolean;
  /** Which keyboard key set drives this car, if any. */
  keyboardSet: number | null;
  lastHapticAt: number;
  /** What the player is pressing, even while the race holds the car (engines rev on the grid). */
  wantThrottle: number;
  wantHorn: boolean;
  /** On the sand shoulder (dust, ruts, rumble). */
  onSand: boolean;
  /** "LAST 0:41.23" shows for a few seconds after each lap. */
  lastLapSeen: number | null;
  lastLapUntil: number;
  lastLapText: string;
}

const VIEWPORT_GAP = 4;
const RACE_STATUS_INTERVAL_MS = 200;
const HAPTIC_COOLDOWN_MS = 350;
/** Impacts above this force (N) shake the camera and buzz the pad. */
const IMPACT_THRESHOLD = CAR.mass * 40;
const FINISHED_BANNERS = ['FINISHED 1ST', 'FINISHED 2ND', 'FINISHED 3RD', 'FINISHED 4TH'];
const COUNTDOWN_TEXT = ['GO', '1', '2', '3'];
/** How long "GO" stays on screen after the lights turn green (s). */
const GO_DISPLAY_SECONDS = 1;
const LAST_LAP_SECONDS = 4;
/** Name tags of cars closer than this to the camera are hidden (m). */
const TAG_HIDE_DISTANCE = 10;
/** The soak race: the protocol's lap maximum, about 2.6 h, far longer than the soak. */
const SOAK_LAPS = 99;
/** Without a GPU timer the loading benchmark drops a preset when more frames than this missed. */
const LOADING_MISSED_SHARE = 0.1;

export class SplitWaysGame {
  private readonly scene = new Scene();
  private readonly renderer: GameRenderer;
  private readonly sky: Sky;
  private shadows: ShadowRig;
  private readonly sim: Simulation;
  private readonly race: Race;
  private readonly slipstream: Slipstream;
  private readonly drivers: Driver[];
  private readonly keyboard = new KeyboardDriver();
  private readonly debug: DebugOverlay;
  private readonly loop: FixedStepLoop;
  private readonly canvas = document.createElement('canvas');
  private readonly hudLayer = document.createElement('div');
  private readonly resizeObserver: ResizeObserver;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  /** Viewport rectangles, recomputed only on resize. */
  private rects: Rect[] = [];
  /** With 3 players the free quarter shows a broadcast-style overview of the pack. */
  private overviewRect: Rect | null = null;
  private readonly fullRect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private readonly overview = new OverviewCamera();
  private readonly skids = new SkidMarks();
  private readonly audio: RaceAudio | null;
  private readonly dust = new Dust();
  private readonly overviewBadge = document.createElement('div');
  private readonly carPositions: Vector3[];
  private readonly carColours: string[];
  private mode: 'race' | 'podium' = 'race';
  private podium: Podium | null = null;
  private raceEndedAt: number | null = null;
  private autopilotOn = false;
  /** Seconds since the game started, for shader animation. */
  private clock = 0;
  private stepTime = 0;
  private frames = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsWindowStart = performance.now();
  private readonly options: GameOptions;
  private readonly playerCount: number;
  private readonly benchPanel: BenchPanel;
  private disposed = false;
  private started = false;
  /** A fly-through is running: its cameras replace the race views. */
  private flight: { fly: FlyThrough; startedAt: number; aspects: number[] } | null = null;
  private benchRunning = false;
  private benchRanThisRace = false;
  /** The race window runs from GO to the finish (frame stats, telemetry, the next race's preset). */
  private raceWindowOpen = false;
  private raceWindowClosed = false;
  private readonly soak = new SoakClock();
  /** Soak samples waiting for the next batched post. */
  private pendingTelemetry: TelemetrySample[] = [];
  private loadingBench: {
    frames: number;
    gpu: number[];
    until: number;
    resolve: () => void;
  } | null = null;

  static async create(
    container: HTMLElement,
    players: readonly GamePlayer[],
    hooks: GameHooks,
    options: GameOptions = { bench: null },
  ): Promise<SplitWaysGame> {
    // Decided before anything loads: texture anisotropy comes from the preset.
    const preset = getPreset(startingPreset(players.length));
    const physics = await PhysicsWorld.create();
    try {
      const track = await loadTrack1();
      const terrain = new Terrain(track);
      const [models, world, skyTexture] = await Promise.all([
        CarModelLibrary.load(),
        WorldVisual.create(track, terrain, preset.anisotropy),
        Sky.loadTexture(),
      ]);
      return new SplitWaysGame(
        container,
        players,
        hooks,
        physics,
        models,
        track,
        world,
        skyTexture,
        options,
        preset,
      );
    } catch (error) {
      physics.dispose();
      throw error;
    }
  }

  private constructor(
    private readonly container: HTMLElement,
    players: readonly GamePlayer[],
    private readonly hooks: GameHooks,
    physics: PhysicsWorld,
    private readonly models: CarModelLibrary,
    private readonly track: Track,
    private readonly world: WorldVisual,
    skyTexture: DataTexture,
    options: GameOptions,
    preset: QualityPreset,
  ) {
    this.canvas.className = 'sw-canvas';
    this.hudLayer.className = 'sw-hud-layer';
    container.append(this.canvas, this.hudLayer);
    this.options = options;
    this.playerCount = players.length;
    this.renderer = new GameRenderer(this.canvas, preset);

    this.sky = new Sky(this.renderer.webgl, skyTexture);
    this.sky.apply(this.scene);
    // White fog: the haze shader supplies the colour (the sky's, per direction).
    installHaze(this.sky.hazeColours);
    this.scene.fog = new FogExp2(0xffffff, LIGHTING.fogDensity);
    this.shadows = this.createShadows(preset);
    world.setQuality(preset);
    this.scene.add(world.group, this.skids.mesh, this.dust.mesh);

    buildTrackPhysics(physics, track);
    this.sim = new Simulation(physics);

    const ordered = [...players].sort((a, b) => a.slot - b.slot);
    const cars = track.gridSpawns(ordered.length).map((spawn) => this.sim.addCar(spawn));
    for (const car of cars) {
      this.skids.addCar(car);
      this.dust.addCar(car);
    }
    this.race = new Race(track, cars, options.bench === 'soak' ? SOAK_LAPS : undefined);
    this.race.onGo = () => {
      this.broadcast({ type: 'haptic', pattern: 'start' });
    };
    this.race.onFinish = (racer) => {
      const driver = this.drivers.find((d) => d.racer === racer);
      if (driver) this.hooks.send(driver.player.id, { type: 'haptic', pattern: 'finish' });
      this.audio?.cheer(racer.place === 1);
    };
    this.slipstream = new Slipstream(cars);

    const hasLocalPlayers = ordered.some((p) => p.local);
    let nextKeySet = 0;
    this.drivers = ordered.map((player, index) => {
      const car = cars[index] as Car;
      const visual = models.create(colourHex(player.colour));
      const tag = createNameTag(player.name, colourHex(player.colour));
      this.scene.add(visual.root, tag);
      // Keyboard players get a key set each; with no keyboard players WASD also drives the first car.
      const keyboardSet = player.local ? nextKeySet++ : !hasLocalPlayers && index === 0 ? 0 : null;
      return {
        player,
        car,
        racer: this.race.racers[index] as Racer,
        visual,
        tag,
        camera: new ChaseCamera(),
        hud: new ViewportHud(this.hudLayer, player.name, colourHex(player.colour), track),
        padInput: copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT),
        padInputAt: 0,
        connected: true,
        keyboardSet,
        lastHapticAt: 0,
        wantThrottle: 0,
        wantHorn: false,
        onSand: false,
        lastLapSeen: null,
        lastLapUntil: 0,
        lastLapText: '',
      };
    });

    this.audio = hooks.audio ? new RaceAudio(hooks.audio, cars) : null;
    this.carPositions = this.drivers.map((d) => d.visual.root.position);
    this.carColours = this.drivers.map((d) => colourHex(d.player.colour));
    this.overviewBadge.className = 'sw-overview-badge';
    this.overviewBadge.textContent = 'Live';
    this.hudLayer.appendChild(this.overviewBadge);
    this.debug = new DebugOverlay(container);
    this.benchPanel = new BenchPanel(container);
    window.addEventListener('keydown', this.onKey);
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(container);
    this.layout();

    this.loop = new FixedStepLoop(
      () => this.step(),
      (alpha, seconds) => this.render(alpha, seconds),
    );
    // The soak drives every car itself; the loop starts in prepare().
    this.autopilotOn = options.bench === 'soak';
  }

  /**
   * The loading screen's work: measure the display refresh on the idle page, compile every shader,
   * run the loading benchmark (one preset lower if this machine can't hold it), then start the
   * race. Pads get no race message (so no countdown) until the race starts.
   */
  async prepare(): Promise<void> {
    const renderer = this.renderer;
    renderer.frameStats.setRefreshHz(await measureRefreshHz());
    if (this.isDisposed()) return;
    this.setCameraFar(renderer.preset.cameraFar);
    this.layout();
    this.snapCameras();
    await renderer.precompile(this.scene, this.firstCamera());
    if (this.isDisposed()) return;
    await this.loadingBenchmark();
    if (this.isDisposed()) return;
    renderer.resolution.enabled = true;
    renderer.resolution.resetStats();
    renderer.frameStats.resetWindow();
    renderer.frameStats.resetTotal();
    this.start();
    const bench = this.options.bench;
    if (bench === 'auto' || bench === 'matrix') void this.runBenchmark(bench);
  }

  /** What telemetry needs to describe this machine's renderer. */
  rendererInfo(): { refreshHz: number; timerQuery: boolean; gpu: string | null } {
    const renderer = this.renderer;
    return {
      refreshHz: renderer.frameStats.refreshHz(),
      timerQuery: renderer.gpuTimer.supported,
      gpu: renderer.gpuName,
    };
  }

  /** Soak samples not posted yet (the TV page is closing: they go by beacon). */
  drainTelemetry(): TelemetrySample[] {
    const samples = this.pendingTelemetry;
    this.pendingTelemetry = [];
    return samples;
  }

  /** A method, not the field: TypeScript keeps narrowing a field across awaits. */
  private isDisposed(): boolean {
    return this.disposed;
  }

  private start(): void {
    if (this.isDisposed()) return;
    this.started = true;
    this.loop.stepping = true;
    this.loop.start();
    this.statusTimer ??= setInterval(() => this.sendRaceStatus(), RACE_STATUS_INTERVAL_MS);
  }

  private createShadows(preset: QualityPreset): ShadowRig {
    return createShadowRig(
      this.scene,
      preset,
      this.sky.sunDirection,
      new Color(LIGHTING.sunColour),
      LIGHTING.sunIntensity,
    );
  }

  private setCameraFar(far: number): void {
    for (const driver of this.drivers) driver.camera.camera.far = far;
    this.overview.camera.far = far;
  }

  private firstCamera() {
    return this.flight?.fly.cameras[0] ?? this.drivers[0]?.camera.camera ?? this.overview.camera;
  }

  /** Every chase camera at rest behind its car on the grid, before anything has rendered. */
  private snapCameras(): void {
    this.drivers.forEach((driver, i) => {
      const rect = this.rects[i];
      const { root } = driver.visual;
      driver.visual.update(driver.car, 1, 0);
      driver.camera.snap();
      const aspect = rect ? rect.width / rect.height : 16 / 9;
      driver.camera.update(0, root.position, root.quaternion, driver.car.velocity, aspect);
      driver.camera.camera.updateMatrixWorld();
    });
    this.shadows.beforeView(
      this.drivers[0]?.visual.root.position ?? this.track.startLine.sample.position,
    );
  }

  /**
   * Another preset, between races or inside a benchmark only: the renderer's targets, the sun rig
   * (a different light type means different shaders), the world's density, the view distance, and
   * a fresh precompile so nothing compiles once the race or the run is going.
   */
  private async applyPreset(preset: QualityPreset): Promise<void> {
    this.renderer.setPreset(preset);
    this.shadows.dispose();
    this.shadows = this.createShadows(preset);
    this.world.setQuality(preset);
    this.setCameraFar(preset.cameraFar);
    this.shadows.beforeView(this.firstCamera().position);
    await this.renderer.precompile(this.scene, this.firstCamera());
  }

  /**
   * Renders the race views from the grid at scale 1 with physics paused. If the GPU (or, without a
   * timer, the frame rate) is clearly over budget, the race starts one preset lower.
   */
  private async loadingBenchmark(): Promise<void> {
    const renderer = this.renderer;
    const measured = renderer.preset;
    renderer.resolution.enabled = false;
    renderer.frameStats.resetWindow();
    this.loop.stepping = false;
    const gpu: number[] = [];
    await new Promise<void>((resolve) => {
      this.loadingBench = {
        frames: 0,
        gpu,
        until: performance.now() + RESOLUTION.loadingBenchMaxMs,
        resolve,
      };
      this.loop.start();
    });
    if (this.isDisposed()) return;
    const window = renderer.frameStats.snapshot();
    const sample = telemetrySample(
      'loading-benchmark',
      'loading',
      window,
      renderer.stats,
      TRACK_1.id,
    );
    const target = RESOLUTION.targetShare * frameIntervalMs(renderer.frameStats.refreshHz());
    gpu.sort((a, b) => a - b);
    const gpuMedian = gpu[gpu.length >> 1];
    const slow =
      gpuMedian !== undefined
        ? gpuMedian > RESOLUTION.loadingDropFactor * target
        : window.frames > 0 && window.missedFrames / window.frames > LOADING_MISSED_SHARE;
    if (slow && measured.id !== 'low') {
      noteLoadingDrop(this.playerCount);
      this.loop.stop();
      await this.applyPreset(getPreset(lowerPreset(measured.id)));
      if (this.isDisposed()) return;
    }
    sample.presetDrops = sessionDrops();
    this.hooks.telemetry([sample]);
  }

  /** Counts the loading benchmark's frames; called after each rendered frame. */
  private tickLoadingBench(): void {
    const bench = this.loadingBench;
    if (!bench) return;
    bench.frames++;
    const gpuMs = this.renderer.frameGpuMs;
    if (gpuMs !== null) bench.gpu.push(gpuMs);
    if (bench.frames >= RESOLUTION.loadingBenchFrames || performance.now() >= bench.until) {
      this.loadingBench = null;
      bench.resolve();
    }
  }

  /**
   * Fly-through benchmark: for each run, N cameras glide round the lap (physics paused), 3 s of
   * warm-up then 20 s measured. Afterwards the race layout and preset come back, the table shows,
   * and the samples go to telemetry and the console.
   */
  private async runBenchmark(mode: 'auto' | 'matrix'): Promise<void> {
    if (this.benchRunning || this.disposed || this.mode !== 'race') return;
    this.benchRunning = true;
    this.benchRanThisRace = true;
    this.loop.stepping = false;
    this.hudLayer.hidden = true;
    const racePreset = this.renderer.preset;
    const runs = benchRuns(mode);
    const samples: TelemetrySample[] = [];
    for (const [i, run] of runs.entries()) {
      this.benchPanel.show(
        `BENCHMARK ${mode}  run ${i + 1}/${runs.length}  ${flythroughScenario(run)}`,
        false,
      );
      const preset = getPreset(run.preset);
      this.flight = {
        fly: new FlyThrough(this.track, run.views, preset.cameraFar),
        startedAt: performance.now(),
        aspects: [],
      };
      this.layout();
      this.flight.fly.update(0, this.flight.aspects);
      if (preset.id !== this.renderer.preset.id) {
        this.loop.stop();
        await this.applyPreset(preset);
        if (this.isDisposed()) return;
        this.loop.start();
      }
      this.flight.startedAt = performance.now();
      await sleep(BENCH.warmupSeconds * 1000);
      if (this.isDisposed()) return;
      this.renderer.frameStats.resetWindow();
      await sleep(BENCH.measureSeconds * 1000);
      if (this.isDisposed()) return;
      const scenario = flythroughScenario(run);
      const stats = this.renderer.stats;
      samples.push(telemetrySample('flythrough', scenario, stats.window, stats, TRACK_1.id));
    }
    this.flight = null;
    this.layout();
    if (this.renderer.preset.id !== racePreset.id) {
      this.loop.stop();
      this.snapCameras();
      await this.applyPreset(racePreset);
      if (this.isDisposed()) return;
      this.loop.start();
    }
    this.hudLayer.hidden = false;
    this.loop.stepping = true;
    this.benchRunning = false;
    this.benchPanel.show(
      formatBenchTable(
        `SPLIT WAYS BENCHMARK  ${mode}  ${TRACK_1.name}`,
        samples,
        this.renderer.stats,
      ),
      true,
    );
    this.hooks.telemetry(samples);
    console.info('[splitways-bench]', JSON.stringify(samples));
  }

  private renderFlight(flight: { fly: FlyThrough; startedAt: number; aspects: number[] }): void {
    flight.fly.update((performance.now() - flight.startedAt) / 1000, flight.aspects);
    flight.fly.cameras.forEach((camera, i) => {
      this.shadows.beforeView(camera.position);
      this.renderer.renderView(i, this.scene, camera, 0);
    });
  }

  /** GO opens the race window, the finish closes it with a telemetry sample; the soak ticks here. */
  private trackRaceWindow(now: number): void {
    const renderer = this.renderer;
    const phase = this.race.phase;
    if (!this.raceWindowOpen && phase !== 'countdown') {
      this.raceWindowOpen = true;
      this.benchRanThisRace = this.benchRunning;
      renderer.frameStats.resetWindow();
      renderer.resolution.resetStats();
      if (this.options.bench === 'soak') {
        renderer.frameStats.resetTotal();
        this.soak.start(now);
      }
    }
    if (this.raceWindowOpen && !this.raceWindowClosed && phase === 'finished') {
      // Before the podium and its shader compile hitch.
      this.raceWindowClosed = true;
      if (!this.benchRanThisRace && this.options.bench !== 'soak') {
        const stats = renderer.stats;
        const sample = telemetrySample('race', 'race', stats.window, stats, TRACK_1.id);
        recordRaceOutcome(this.playerCount, {
          atFloorShare: renderer.resolution.atFloorShare(),
          missedShare: renderer.resolution.missedShare(),
        });
        this.hooks.telemetry([sample]);
      }
    }
    if (this.options.bench === 'soak') this.tickSoak(now);
  }

  private tickSoak(now: number): void {
    const due = this.soak.tick(now);
    if (!due.window && !due.post && !due.done) return;
    const renderer = this.renderer;
    if (due.window !== null) {
      const scenario = `soak-${String(due.window).padStart(2, '0')}`;
      const stats = renderer.stats;
      this.pendingTelemetry.push(
        telemetrySample('soak', scenario, stats.window, stats, TRACK_1.id),
      );
      renderer.frameStats.resetWindow();
    }
    if (due.done) {
      const stats = renderer.stats;
      const total = telemetrySample(
        'soak',
        'soak-total',
        renderer.frameStats.snapshotTotal(),
        stats,
        TRACK_1.id,
      );
      this.pendingTelemetry.push(total);
      this.benchPanel.show(formatSoakSummary(total, BENCH.soakMinutes, stats), false);
    }
    if (due.post || due.done) this.flushTelemetry();
  }

  private flushTelemetry(): void {
    const samples = this.drainTelemetry();
    if (samples.length > 0) this.hooks.telemetry(samples);
  }

  handleInput(playerId: string, message: InputMessage): void {
    const driver = this.drivers.find((d) => d.player.id === playerId);
    if (!driver) return;
    const input = driver.padInput;
    input.steer = message.steer;
    input.throttle = message.throttle;
    input.brake = message.brake;
    input.handbrake = message.handbrake;
    input.horn = message.horn;
    driver.padInputAt = performance.now();
  }

  /** What each reliable pad button does, by driver index. */
  private readonly actions: Record<GameAction, (index: number) => void> = {
    reset: (index) => {
      const driver = this.drivers[index];
      if (driver) this.race.requestRespawn(driver.racer);
    },
  };

  /** A reliable button press from a pad. */
  handleAction(playerId: string, action: GameAction): void {
    const index = this.drivers.findIndex((d) => d.player.id === playerId);
    if (index >= 0) this.actions[action](index);
  }

  setConnected(playerId: string, connected: boolean): void {
    const driver = this.drivers.find((d) => d.player.id === playerId);
    if (driver) driver.connected = connected;
  }

  dispose(): void {
    this.disposed = true;
    this.loop.stop();
    if (this.statusTimer !== null) clearInterval(this.statusTimer);
    this.loadingBench?.resolve();
    this.loadingBench = null;
    this.flushTelemetry();
    window.removeEventListener('keydown', this.onKey);
    this.resizeObserver.disconnect();
    this.keyboard.dispose();
    this.debug.dispose();
    this.benchPanel.dispose();
    for (const driver of this.drivers) {
      driver.visual.dispose();
      driver.hud.dispose();
      disposeNameTag(driver.tag);
    }
    this.podium?.dispose();
    this.audio?.dispose();
    this.skids.dispose();
    this.dust.dispose();
    this.world.dispose();
    this.sky.dispose();
    this.sim.dispose();
    this.models.dispose();
    this.scene.environment?.dispose();
    this.shadows.dispose();
    this.renderer.dispose();
    // Only remove what this game added: in dev, React may briefly run two games in one container.
    this.canvas.remove();
    this.hudLayer.remove();
  }

  private broadcast(message: TvMessage): void {
    for (const driver of this.drivers) {
      if (!driver.player.local) this.hooks.send(driver.player.id, message);
    }
  }

  /**
   * Debug keys (only while the overlay is up): P autopilot, N next checkpoint, R resolution,
   * B benchmark.
   */
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.debug.isVisible) return;
    if (event.code === 'KeyP') this.autopilotOn = !this.autopilotOn;
    if (event.code === 'KeyN') {
      for (const driver of this.drivers) {
        this.race.skipToNextGate(driver.racer);
        driver.camera.snap();
      }
    }
    if (event.code === 'KeyR') {
      // Pins the scale at 1 (or hands it back); the targets are already allocated at scale 1.
      const resolution = this.renderer.resolution;
      resolution.enabled = !resolution.enabled;
    }
    if (event.code === 'KeyB' && this.started && this.options.bench !== 'soak') {
      void this.runBenchmark('auto');
    }
  };

  private layout(): void {
    const width = Math.max(1, Math.round(this.container.clientWidth));
    const height = Math.max(1, Math.round(this.container.clientHeight));
    this.renderer.setSize(width, height);
    this.fullRect.width = width;
    this.fullRect.height = height;
    this.rects = viewportLayout(this.drivers.length, width, height, VIEWPORT_GAP).map(roundRect);
    this.drivers.forEach((driver, i) => {
      const rect = this.rects[i];
      if (!rect) return;
      driver.hud.place(rect);
      // Each car's sound leans towards its viewport's side of the screen.
      this.audio?.setPan(i, ((rect.x + rect.width / 2) / width - 0.5) * 0.9);
    });
    this.overviewRect =
      this.drivers.length === 3 ? roundRect(overviewCell(width, height, VIEWPORT_GAP)) : null;
    this.overviewBadge.hidden = this.overviewRect === null;
    if (this.overviewRect) {
      this.overviewBadge.style.left = `${this.overviewRect.x + 18}px`;
      this.overviewBadge.style.top = `${this.overviewRect.y + 16}px`;
    }
    if (this.flight) {
      const views = this.flight.fly.cameras.length;
      const rects = viewportLayout(views, width, height, VIEWPORT_GAP).map(roundRect);
      this.flight.aspects = rects.map((r) => r.width / r.height);
      this.renderer.setLayout(rects);
    } else if (this.mode === 'podium') {
      this.renderer.setLayout([this.fullRect]);
    } else {
      this.renderer.setLayout(this.overviewRect ? [...this.rects, this.overviewRect] : this.rects);
    }
  }

  private step(): void {
    this.keyboard.poll();
    const now = performance.now();
    for (let i = 0; i < this.drivers.length; i++) {
      const driver = this.drivers[i] as Driver;
      if (driver.keyboardSet !== null && this.keyboard.takeResetPress(driver.keyboardSet)) {
        this.race.requestRespawn(driver.racer);
      }
      if (this.autopilotOn) {
        autopilot(this.track, driver.racer, driver.car.input);
        driver.wantThrottle = driver.car.input.throttle;
        driver.wantHorn = false;
        continue;
      }
      const padFresh = driver.connected && now - driver.padInputAt < INPUT.staleAfterMs;
      const pad = padFresh ? driver.padInput : NEUTRAL_INPUT;
      const keys =
        driver.keyboardSet === null
          ? NEUTRAL_INPUT
          : (this.keyboard.inputs[driver.keyboardSet] ?? NEUTRAL_INPUT);
      mergeInputs(driver.car.input, pad, keys);
      driver.wantThrottle = driver.car.input.throttle;
      driver.wantHorn = driver.car.input.horn;
    }
    this.race.holdInputs();

    this.sim.step();
    this.stepTime = now;
    this.sim.drainImpacts(this.onImpact);
    this.race.update(this.sim.dt);
    this.slipstream.update(this.sim.dt, this.race.phase === 'racing');
    for (const driver of this.drivers) {
      const { car, racer } = driver;
      driver.onSand = Math.abs(racer.projection.lateral) > this.track.halfRoad + 0.3;
      this.skids.update(car, driver.onSand);
      this.dust.emit(car, driver.onSand, this.sim.dt);
    }

    if (this.race.phase === 'finished' && this.raceEndedAt === null) this.raceEndedAt = now;
    if (
      this.mode === 'race' &&
      this.raceEndedAt !== null &&
      now - this.raceEndedAt > RACE.podiumDelaySeconds * 1000
    ) {
      this.showPodium();
    }
  }

  private readonly onImpact = (impact: Impact): void => {
    if (impact.force < IMPACT_THRESHOLD) return;
    const driver = this.drivers.find((d) => d.car === impact.car);
    if (!driver) return;
    const strength = Math.min(1, (impact.force - IMPACT_THRESHOLD) / (IMPACT_THRESHOLD * 6));
    driver.camera.addShake(strength);
    this.audio?.impact(this.drivers.indexOf(driver), strength);
    if (this.stepTime - driver.lastHapticAt > HAPTIC_COOLDOWN_MS) {
      driver.lastHapticAt = this.stepTime;
      this.hooks.send(driver.player.id, { type: 'haptic', pattern: 'collision' });
    }
  };

  private showPodium(): void {
    this.mode = 'podium';
    const results: RaceResult[] = this.race.standings().map((racer) => {
      const driver = this.drivers.find((d) => d.racer === racer);
      if (!driver) throw new Error('Racer without a driver');
      return {
        id: driver.player.id,
        name: driver.player.name,
        colour: driver.player.colour,
        place: racer.place,
        totalMs: racer.finishedMs,
        bestLapMs: racer.bestLapMs,
      };
    });
    const entries: PodiumEntry[] = results.slice(0, 3).map((result, i) => ({
      place: (i + 1) as 1 | 2 | 3,
      colourHex: colourHex(result.colour),
    }));
    this.podium = new Podium(this.models, entries, this.scene.environment);
    this.hudLayer.hidden = true;
    this.audio?.podium();
    this.layout();
    this.broadcast({ type: 'results', standings: results });
    this.hooks.onResults(results);
  }

  private render(alpha: number, seconds: number): void {
    const now = performance.now();
    this.clock += seconds;
    this.dust.update(seconds);
    this.skids.flush();
    const renderer = this.renderer;
    renderer.beginFrame(now, this.loop.lastDeltaMs);
    if (this.flight) {
      this.renderFlight(this.flight);
    } else if (this.mode === 'podium' && this.podium) {
      const full = this.fullRect;
      this.podium.update(seconds, full.width / full.height);
      renderer.renderView(0, this.podium.scene, this.podium.camera, 0);
    } else {
      this.renderRace(alpha, seconds);
    }
    // The loop's CPU time for this frame is only known once this callback returns.
    renderer.endFrame(this.clock, this.loop.lastCpuMs);
    this.tickLoadingBench();
    if (this.started) this.trackRaceWindow(now);
    this.trackFps(now);
    if (this.debug.needsPaint) this.paintDebug();
  }

  private renderRace(alpha: number, seconds: number): void {
    const race = this.race;
    const countdown = race.countdown;
    this.world.gantry.setLights(
      race.phase === 'countdown' ? 4 - countdown : 0,
      race.phase !== 'countdown',
    );
    const countdownText =
      race.phase === 'countdown'
        ? (COUNTDOWN_TEXT[countdown] ?? '')
        : race.clock < GO_DISPLAY_SECONDS
          ? 'GO'
          : '';

    for (const driver of this.drivers) {
      driver.visual.update(driver.car, alpha, seconds);
      driver.tag.position.copy(driver.visual.root.position);
      driver.tag.position.y += NAME_TAG_HEIGHT;
    }
    for (let i = 0; i < this.drivers.length; i++) {
      const driver = this.drivers[i] as Driver;
      const rect = this.rects[i];
      if (!rect) continue;
      const { root } = driver.visual;
      // Right after a respawn teleport, jump the camera instead of swooping across the map.
      if (driver.racer.respawn === 'in' && driver.racer.respawnTimer < 0.05) driver.camera.snap();
      driver.camera.update(
        seconds,
        root.position,
        root.quaternion,
        driver.car.velocity,
        rect.width / rect.height,
      );
      this.shadows.beforeView(root.position);
      // Your own name tag would only hover over your roof; a car right next to the camera
      // needs no tag (and it would fill the screen).
      const eye = driver.camera.camera.position;
      for (const other of this.drivers) {
        other.tag.visible =
          other !== driver &&
          other.visual.root.position.distanceToSquared(eye) > TAG_HIDE_DISTANCE ** 2;
      }
      const { car } = driver;
      this.renderer.renderView(
        i,
        this.scene,
        driver.camera.camera,
        Math.max(speedEffect(car.speedKph), car.draft * 0.7),
      );
      this.paintHud(driver, i, countdownText);
    }
    if (this.audio) {
      for (let i = 0; i < this.drivers.length; i++) {
        const driver = this.drivers[i] as Driver;
        this.audio.updateCar(
          i,
          driver.wantThrottle,
          driver.wantHorn,
          driver.onSand,
          driver.car.draft,
        );
      }
      this.audio.updateRace(race.countdown, race.phase !== 'countdown');
    }
    if (this.overviewRect) {
      const rect = this.overviewRect;
      this.overview.update(seconds, this.carPositions, rect.width / rect.height);
      for (const driver of this.drivers) driver.tag.visible = true;
      this.shadows.beforeView(this.overview.focus);
      this.renderer.renderView(this.drivers.length, this.scene, this.overview.camera, 0);
    }
  }

  private paintHud(driver: Driver, index: number, countdownText: string): void {
    const { hud, racer, car } = driver;
    // The map only needs 30 updates a second.
    if (this.frames % 2 === 0) hud.updateMinimap(this.carPositions, this.carColours, index);
    if (racer.lastLapMs !== driver.lastLapSeen) {
      driver.lastLapSeen = racer.lastLapMs;
      if (racer.lastLapMs !== null) {
        driver.lastLapUntil = this.clock + LAST_LAP_SECONDS;
        const best = racer.lastLapMs === racer.bestLapMs && racer.lap > 2 ? ' · BEST' : '';
        driver.lastLapText = `LAST ${formatTime(racer.lastLapMs)}${best}`;
      }
    }
    hud.setLastLap(this.clock < driver.lastLapUntil ? driver.lastLapText : '');
    hud.setSpeed(car.speedKph);
    hud.setPosition(racer.place, this.drivers.length);
    const lapMs =
      this.race.phase === 'countdown'
        ? 0
        : racer.finishedMs !== null
          ? (racer.lastLapMs ?? 0)
          : (this.race.clock - racer.lapStartedAt) * 1000;
    hud.setLap(racer.lap, this.race.totalLaps, lapMs);
    hud.setCountdown(countdownText);
    if (racer.finishedMs !== null) hud.setBanner(FINISHED_BANNERS[racer.place - 1] ?? '', 'good');
    else hud.setBanner(racer.wrongWayTime > 1.5 ? 'WRONG WAY' : '', 'warn');
    hud.setFade(racer.fade);
    hud.setStatus(driver.connected || driver.player.local ? '' : 'Reconnecting...');
    hud.setTag(car.draft > 0.4 ? 'SLIPSTREAM' : '');
  }

  private trackFps(now: number): void {
    this.frames++;
    this.fpsFrames++;
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsWindowStart);
      this.fpsFrames = 0;
      this.fpsWindowStart = now;
    }
  }

  private paintDebug(): void {
    this.debug.update(
      {
        render: this.renderer.stats,
        physicsMs: this.sim.lastStepMs,
        autopilot: this.autopilotOn,
        viewports: this.drivers.length,
        fps: this.fps,
        autoResolution: this.renderer.resolution.enabled,
      },
      this.drivers.map((d) => ({
        name: d.player.name,
        colour: colourHex(d.player.colour),
        input: d.car.input,
        speedKph: d.car.speedKph,
        slipDeg: (d.car.slipAngle * 180) / Math.PI,
        rttMs: this.hooks.rttMs(d.player.id),
        connected: d.connected || d.player.local,
        lap: d.racer.lap,
        nextGate: d.racer.nextGate,
        place: d.racer.place,
      })),
    );
  }

  private sendRaceStatus(): void {
    if (this.mode === 'podium') return;
    for (let i = 0; i < this.drivers.length; i++) this.sendRaceStatusTo(i);
  }

  /** Phase, position, lap and speed for one pad. */
  private sendRaceStatusTo(index: number): void {
    const driver = this.drivers[index];
    if (!driver || driver.player.local) return;
    const { racer } = driver;
    const race = this.race;
    this.hooks.send(driver.player.id, {
      type: 'race',
      phase:
        race.phase === 'countdown'
          ? 'countdown'
          : racer.finishedMs !== null
            ? 'finished'
            : 'racing',
      countdown: race.countdown,
      position: racer.place,
      playerCount: this.drivers.length,
      lap: Math.min(Math.max(racer.lap, 1), race.totalLaps),
      totalLaps: race.totalLaps,
      speedKph: Math.min(999, driver.car.speedKph),
    });
  }
}

/** 0..1 strength of the speed effects (speed lines, extra vignette) at this speed. */
function speedEffect(kph: number): number {
  const t = (kph - POST.speedLinesFromKph) / (POST.speedLinesFullKph - POST.speedLinesFromKph);
  return Math.min(1, Math.max(0, t));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
