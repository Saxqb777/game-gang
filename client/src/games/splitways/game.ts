/**
 * Split Ways on the TV: owns the physics, the race, the scene, every player's car and camera, and
 * the loop. The hub feeds it pad inputs; it answers with race status, haptics and the results.
 */
import { colourHex, type ColourId, type InputMessage, type TvMessage } from '@gamergang/shared';
import { Color, Fog, HemisphereLight, PMREMGenerator, Scene, Vector3, type Sprite } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAR, INPUT, RACE, RENDER } from './config';
import { autopilot } from './debug/autopilot';
import { DebugOverlay } from './debug/debugOverlay';
import { ViewportHud } from './hud/viewportHud';
import { KeyboardDriver } from './input/keyboard';
import { FixedStepLoop } from './loop';
import { Race, type Racer } from './race/race';
import { ChaseCamera } from './render/chaseCamera';
import { OverviewCamera } from './render/overviewCamera';
import { GameRenderer } from './render/renderer';
import { Sun } from './render/sun';
import { overviewCell, viewportLayout, type Rect } from './render/viewports';
import { CarModelLibrary, type CarVisual } from './scene/carVisual';
import { NAME_TAG_HEIGHT, createNameTag, disposeNameTag } from './scene/nameTag';
import { Podium, type PodiumEntry } from './scene/podium';
import { WorldVisual } from './scene/world';
import type { Car } from './sim/car';
import { NEUTRAL_INPUT, copyInput, mergeInputs, type DriveInput } from './sim/input';
import { Simulation, type Impact } from './sim/simulation';
import { PhysicsWorld } from './sim/world';
import { CORNICHE_RUN } from './track/cornicheRun';
import { Terrain } from './track/terrain';
import { Track } from './track/track';
import { buildTrackPhysics } from './track/trackPhysics';

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
}

const VIEWPORT_GAP = 4;
const RACE_STATUS_INTERVAL_MS = 200;
const HAPTIC_COOLDOWN_MS = 350;
const ANISOTROPY = 8;
/** Impacts above this force (N) shake the camera and buzz the pad. */
const IMPACT_THRESHOLD = CAR.mass * 40;
const FINISHED_BANNERS = ['FINISHED 1ST', 'FINISHED 2ND', 'FINISHED 3RD', 'FINISHED 4TH'];
const COUNTDOWN_TEXT = ['GO', '1', '2', '3'];
/** How long "GO" stays on screen after the lights turn green (s). */
const GO_DISPLAY_SECONDS = 1;

export class SplitWaysGame {
  private readonly scene = new Scene();
  private readonly renderer: GameRenderer;
  private readonly sun: Sun;
  private readonly sim: Simulation;
  private readonly race: Race;
  private readonly drivers: Driver[];
  private readonly keyboard = new KeyboardDriver();
  private readonly debug: DebugOverlay;
  private readonly loop: FixedStepLoop;
  private readonly canvas = document.createElement('canvas');
  private readonly hudLayer = document.createElement('div');
  private readonly resizeObserver: ResizeObserver;
  private readonly statusTimer: ReturnType<typeof setInterval>;
  /** Viewport rectangles, recomputed only on resize. */
  private rects: Rect[] = [];
  /** With 3 players the free quarter shows a broadcast-style overview of the pack. */
  private overviewRect: Rect | null = null;
  private readonly fullRect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private readonly overview = new OverviewCamera();
  private readonly overviewBadge = document.createElement('div');
  private readonly carPositions: Vector3[];
  private mode: 'race' | 'podium' = 'race';
  private podium: Podium | null = null;
  private raceEndedAt: number | null = null;
  private autopilotOn = false;
  private stepTime = 0;
  private frames = 0;
  private fps = 0;
  private fpsWindowStart = performance.now();
  private lastFrameMs = 0;

  static async create(
    container: HTMLElement,
    players: readonly GamePlayer[],
    hooks: GameHooks,
  ): Promise<SplitWaysGame> {
    const physics = await PhysicsWorld.create();
    try {
      const track = new Track(CORNICHE_RUN);
      const terrain = new Terrain(track);
      const [models, world] = await Promise.all([
        CarModelLibrary.load(),
        WorldVisual.create(track, terrain, ANISOTROPY),
      ]);
      return new SplitWaysGame(container, players, hooks, physics, models, track, world);
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
  ) {
    this.canvas.className = 'sw-canvas';
    this.hudLayer.className = 'sw-hud-layer';
    container.append(this.canvas, this.hudLayer);
    this.renderer = new GameRenderer(this.canvas);

    this.scene.background = new Color(0xa9c8e6);
    this.scene.fog = new Fog(0xa9c8e6, 220, 900);
    const pmrem = new PMREMGenerator(this.renderer.webgl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new HemisphereLight(0xd6e6ff, 0x6d6457, 0.9));
    this.sun = new Sun(
      this.scene,
      new Vector3(-0.45, 0.75, 0.5),
      new Color(0xfff0dc),
      3.2,
      players.length > 2 ? RENDER.shadowMapSizeManyPlayers : RENDER.shadowMapSize,
    );
    this.scene.add(world.group);

    buildTrackPhysics(physics, track);
    this.sim = new Simulation(physics);

    const ordered = [...players].sort((a, b) => a.slot - b.slot);
    const cars = track.gridSpawns(ordered.length).map((spawn) => this.sim.addCar(spawn));
    this.race = new Race(track, cars);
    this.race.onGo = () => {
      this.broadcast({ type: 'haptic', pattern: 'start' });
    };
    this.race.onFinish = (racer) => {
      const driver = this.drivers.find((d) => d.racer === racer);
      if (driver) this.hooks.send(driver.player.id, { type: 'haptic', pattern: 'finish' });
    };

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
        hud: new ViewportHud(this.hudLayer, player.name, colourHex(player.colour)),
        padInput: copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT),
        padInputAt: 0,
        connected: true,
        keyboardSet,
        lastHapticAt: 0,
      };
    });

    this.carPositions = this.drivers.map((d) => d.visual.root.position);
    this.overviewBadge.className = 'sw-overview-badge';
    this.overviewBadge.textContent = 'Live';
    this.hudLayer.appendChild(this.overviewBadge);
    this.debug = new DebugOverlay(container);
    window.addEventListener('keydown', this.onKey);
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(container);
    this.layout();

    this.loop = new FixedStepLoop(
      () => this.step(),
      (alpha, seconds) => this.render(alpha, seconds),
    );
    this.loop.start();
    this.statusTimer = setInterval(() => this.sendRaceStatus(), RACE_STATUS_INTERVAL_MS);
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

  setConnected(playerId: string, connected: boolean): void {
    const driver = this.drivers.find((d) => d.player.id === playerId);
    if (driver) driver.connected = connected;
  }

  dispose(): void {
    this.loop.stop();
    clearInterval(this.statusTimer);
    window.removeEventListener('keydown', this.onKey);
    this.resizeObserver.disconnect();
    this.keyboard.dispose();
    this.debug.dispose();
    for (const driver of this.drivers) {
      driver.visual.dispose();
      driver.hud.dispose();
      disposeNameTag(driver.tag);
    }
    this.podium?.dispose();
    this.world.dispose();
    this.sim.dispose();
    this.models.dispose();
    this.scene.environment?.dispose();
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

  private readonly onKey = (event: KeyboardEvent): void => {
    // Debug-only autopilot, so a whole race can be tested without four people.
    if (event.code === 'KeyP' && this.debug.isVisible) this.autopilotOn = !this.autopilotOn;
  };

  private layout(): void {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.fullRect.width = this.renderer.width;
    this.fullRect.height = this.renderer.height;
    this.rects = viewportLayout(
      this.drivers.length,
      this.renderer.width,
      this.renderer.height,
      VIEWPORT_GAP,
    );
    this.drivers.forEach((driver, i) => {
      const rect = this.rects[i];
      if (rect) driver.hud.place(rect);
    });
    this.overviewRect =
      this.drivers.length === 3
        ? overviewCell(this.renderer.width, this.renderer.height, VIEWPORT_GAP)
        : null;
    this.overviewBadge.hidden = this.overviewRect === null;
    if (this.overviewRect) {
      this.overviewBadge.style.left = `${this.overviewRect.x + 18}px`;
      this.overviewBadge.style.top = `${this.overviewRect.y + 16}px`;
    }
  }

  private step(): void {
    this.keyboard.poll();
    const now = performance.now();
    for (const driver of this.drivers) {
      if (this.autopilotOn) {
        autopilot(this.track, driver.racer, driver.car.input);
        continue;
      }
      const padFresh = driver.connected && now - driver.padInputAt < INPUT.staleAfterMs;
      const pad = padFresh ? driver.padInput : NEUTRAL_INPUT;
      const keys =
        driver.keyboardSet === null
          ? NEUTRAL_INPUT
          : (this.keyboard.inputs[driver.keyboardSet] ?? NEUTRAL_INPUT);
      mergeInputs(driver.car.input, pad, keys);
    }
    this.race.holdInputs();

    this.sim.step();
    this.stepTime = now;
    this.sim.drainImpacts(this.onImpact);
    this.race.update(this.sim.dt);

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
    driver.camera.addShake(Math.min(1, (impact.force - IMPACT_THRESHOLD) / (IMPACT_THRESHOLD * 6)));
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
    this.broadcast({ type: 'results', standings: results });
    this.hooks.onResults(results);
  }

  private render(alpha: number, seconds: number): void {
    const started = performance.now();
    this.renderer.beginFrame();
    if (this.mode === 'podium' && this.podium) {
      const full = this.fullRect;
      this.podium.update(seconds, full.width / full.height);
      this.renderer.renderView(this.podium.scene, this.podium.camera, full);
    } else {
      this.renderRace(alpha, seconds);
    }
    this.trackFps(started);
    if (this.debug.isVisible) this.paintDebug();
    this.lastFrameMs = performance.now() - started;
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
      this.sun.focus(root.position);
      // Your own name tag would only hover over your roof.
      for (const other of this.drivers) other.tag.visible = other !== driver;
      this.renderer.renderView(this.scene, driver.camera.camera, rect);
      this.paintHud(driver, countdownText);
    }
    if (this.overviewRect) {
      const rect = this.overviewRect;
      this.overview.update(seconds, this.carPositions, rect.width / rect.height);
      for (const driver of this.drivers) driver.tag.visible = true;
      this.sun.focus(this.overview.focus);
      this.renderer.renderView(this.scene, this.overview.camera, rect);
    }
  }

  private paintHud(driver: Driver, countdownText: string): void {
    const { hud, racer, car } = driver;
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
  }

  private trackFps(now: number): void {
    this.frames++;
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = (this.frames * 1000) / (now - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = now;
    }
  }

  private paintDebug(): void {
    const info = this.renderer.webgl.info.render;
    this.debug.update(
      {
        fps: this.fps,
        frameMs: this.lastFrameMs,
        physicsMs: this.sim.lastStepMs,
        drawCalls: info.calls,
        triangles: info.triangles,
        pixelRatio: this.renderer.webgl.getPixelRatio(),
        viewports: this.drivers.length,
        autopilot: this.autopilotOn,
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
    const race = this.race;
    const playerCount = this.drivers.length;
    for (const driver of this.drivers) {
      if (driver.player.local) continue;
      const { racer } = driver;
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
        playerCount,
        lap: Math.min(Math.max(racer.lap, 1), race.totalLaps),
        totalLaps: race.totalLaps,
        speedKph: Math.min(999, driver.car.speedKph),
      });
    }
  }
}
