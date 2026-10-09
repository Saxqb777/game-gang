/**
 * Split Ways on the TV: owns the physics, the race, the scene, every player's car and camera, and
 * the loop. The hub feeds it pad inputs and item presses; it answers with race status, haptics and
 * the results.
 */
import {
  ITEM_KINDS,
  colourHex,
  type ColourId,
  type GameAction,
  type GameMode,
  type HapticPattern,
  type InputMessage,
  type TvMessage,
} from '@gamergang/shared';
import { Color, FogExp2, Scene, type DataTexture, type Sprite, type Vector3 } from 'three';
import { RaceAudio } from './audio/raceAudio';
import { CAR, INPUT, LIGHTING, POST, RACE, RENDER } from './config';
import { autopilot } from './debug/autopilot';
import { DebugOverlay } from './debug/debugOverlay';
import { ViewportHud, formatTime } from './hud/viewportHud';
import { KeyboardDriver } from './input/keyboard';
import { FixedStepLoop } from './loop';
import { Boosts } from './race/boosts';
import { Items, type Holder } from './race/items';
import { Race, type Racer } from './race/race';
import { ChaseCamera } from './render/chaseCamera';
import { OverviewCamera } from './render/overviewCamera';
import { GameRenderer } from './render/renderer';
import { installHaze } from './render/haze';
import { Sky } from './render/sky';
import { Sun } from './render/sun';
import { overviewCell, viewportLayout, type Rect } from './render/viewports';
import { CarModelLibrary, type CarVisual } from './scene/carVisual';
import { Dust } from './scene/dust';
import { ItemVisuals } from './scene/itemVisuals';
import { NAME_TAG_HEIGHT, createNameTag, disposeNameTag } from './scene/nameTag';
import { Podium, type PodiumEntry } from './scene/podium';
import { SkidMarks } from './scene/skidMarks';
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
  /** Where race sound goes; null plays silently. */
  audio: AudioContext | null;
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
const ANISOTROPY = 8;
/** Impacts above this force (N) shake the camera and buzz the pad. */
const IMPACT_THRESHOLD = CAR.mass * 40;
const FINISHED_BANNERS = ['FINISHED 1ST', 'FINISHED 2ND', 'FINISHED 3RD', 'FINISHED 4TH'];
const COUNTDOWN_TEXT = ['GO', '1', '2', '3'];
/** How long "GO" stays on screen after the lights turn green (s). */
const GO_DISPLAY_SECONDS = 1;
const LAST_LAP_SECONDS = 4;
/** Name tags of cars closer than this to the camera are hidden (m). */
const TAG_HIDE_DISTANCE = 10;

export class SplitWaysGame {
  private readonly scene = new Scene();
  private readonly renderer: GameRenderer;
  private readonly sky: Sky;
  private readonly sun: Sun;
  private readonly sim: Simulation;
  private readonly race: Race;
  private readonly boosts: Boosts;
  /** Items mode only. */
  private readonly items: Items | null;
  private readonly itemVisuals: ItemVisuals;
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
  private debugItem = 0;
  /** Seconds since the game started, for shader animation. */
  private clock = 0;
  private stepTime = 0;
  private frames = 0;
  private fps = 0;
  private fpsWindowStart = performance.now();
  private lastFrameMs = 0;

  static async create(
    container: HTMLElement,
    players: readonly GamePlayer[],
    hooks: GameHooks,
    mode: GameMode,
  ): Promise<SplitWaysGame> {
    const physics = await PhysicsWorld.create();
    try {
      const track = new Track(CORNICHE_RUN);
      const terrain = new Terrain(track);
      const [models, world, skyTexture] = await Promise.all([
        CarModelLibrary.load(),
        WorldVisual.create(track, terrain, ANISOTROPY),
        Sky.loadTexture(),
      ]);
      return new SplitWaysGame(
        container,
        players,
        hooks,
        mode,
        physics,
        models,
        track,
        world,
        skyTexture,
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
    mode: GameMode,
    physics: PhysicsWorld,
    private readonly models: CarModelLibrary,
    private readonly track: Track,
    private readonly world: WorldVisual,
    skyTexture: DataTexture,
  ) {
    this.canvas.className = 'sw-canvas';
    this.hudLayer.className = 'sw-hud-layer';
    container.append(this.canvas, this.hudLayer);
    this.renderer = new GameRenderer(this.canvas);

    this.sky = new Sky(this.renderer.webgl, skyTexture);
    this.sky.apply(this.scene);
    // White fog: the haze shader supplies the colour (the sky's, per direction).
    installHaze(this.sky.hazeColours);
    this.scene.fog = new FogExp2(0xffffff, LIGHTING.fogDensity);
    this.sun = new Sun(
      this.scene,
      this.sky.sunDirection,
      new Color(LIGHTING.sunColour),
      LIGHTING.sunIntensity,
      players.length > 2 ? RENDER.shadowMapSizeManyPlayers : RENDER.shadowMapSize,
    );
    this.scene.add(world.group, this.skids.mesh, this.dust.mesh);

    buildTrackPhysics(physics, track);
    this.sim = new Simulation(physics);

    const ordered = [...players].sort((a, b) => a.slot - b.slot);
    const cars = track.gridSpawns(ordered.length).map((spawn) => this.sim.addCar(spawn));
    for (const car of cars) {
      this.skids.addCar(car);
      this.dust.addCar(car);
    }
    this.race = new Race(track, cars);
    this.race.onGo = () => {
      this.broadcast({ type: 'haptic', pattern: 'start' });
    };
    this.race.onFinish = (racer) => {
      const driver = this.drivers.find((d) => d.racer === racer);
      if (driver) this.hooks.send(driver.player.id, { type: 'haptic', pattern: 'finish' });
      this.audio?.cheer(racer.place === 1);
    };
    this.boosts = new Boosts(track, cars);
    this.items = mode === 'items' ? new Items(track, this.race, this.boosts) : null;

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
    this.itemVisuals = new ItemVisuals(
      track,
      this.boosts,
      this.items,
      cars,
      this.drivers.map((d) => d.visual.root),
      this.carColours,
      this.dust,
    );
    this.scene.add(this.itemVisuals.group);
    this.wireItemEvents();
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

  /** What each reliable pad button does, by driver index. */
  private readonly actions: Record<GameAction, (index: number) => void> = {
    item: (index) => this.items?.requestUse(index),
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
    this.itemVisuals.dispose();
    this.audio?.dispose();
    this.skids.dispose();
    this.dust.dispose();
    this.world.dispose();
    this.sky.dispose();
    this.sim.dispose();
    this.models.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    // Only remove what this game added: in dev, React may briefly run two games in one container.
    this.canvas.remove();
    this.hudLayer.remove();
  }

  private wireItemEvents(): void {
    this.boosts.onBoost = (index, source) => this.audio?.boost(index, source);
    this.boosts.onDriftLevel = (index, level) => this.audio?.driftLevel(index, level);
    const { items } = this;
    if (!items) return;
    items.onPickup = (index) => {
      this.audio?.pickup(index);
      this.haptic(index, 'pickup');
      this.sendRaceStatusTo(index);
    };
    items.onUse = (index, kind) => {
      this.audio?.use(index, kind);
      const driver = this.drivers[index];
      if (driver && kind === 'shockwave') this.itemVisuals.shockwave(driver.car.position);
      this.sendRaceStatusTo(index);
    };
    items.onHit = (index, kind) => {
      const driver = this.drivers[index];
      driver?.camera.addShake(kind === 'shockwave' ? 0.5 : 1);
      if (kind === 'oil') this.audio?.impact(index, 0.4);
      this.haptic(index, 'hit');
    };
    items.onBlocked = (index) => {
      this.audio?.blocked(index);
      this.itemVisuals.blocked(index);
    };
    items.onExplode = (position, kind) => {
      this.itemVisuals.explosion(position, kind === 'bounty');
      this.audio?.explosion(kind === 'bounty');
    };
  }

  private haptic(index: number, pattern: HapticPattern): void {
    const driver = this.drivers[index];
    if (driver && !driver.player.local)
      this.hooks.send(driver.player.id, { type: 'haptic', pattern });
  }

  private broadcast(message: TvMessage): void {
    for (const driver of this.drivers) {
      if (!driver.player.local) this.hooks.send(driver.player.id, message);
    }
  }

  /**
   * Debug keys (only while the overlay is up): P autopilot, N next checkpoint, R resolution,
   * I give every car an item (cycling through them).
   */
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.debug.isVisible) return;
    if (event.code === 'KeyP') this.autopilotOn = !this.autopilotOn;
    if (event.code === 'KeyI' && this.items) {
      for (let i = 0; i < this.drivers.length; i++) {
        this.items.give(i, ITEM_KINDS[(this.debugItem + i) % ITEM_KINDS.length] ?? 'nitro');
      }
      this.debugItem++;
    }
    if (event.code === 'KeyN') {
      for (const driver of this.drivers) {
        this.race.skipToNextGate(driver.racer);
        driver.camera.snap();
      }
    }
    if (event.code === 'KeyR') {
      const resolution = this.renderer.resolution;
      resolution.enabled = !resolution.enabled;
      resolution.reset();
      this.layout();
    }
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
      if (!rect) return;
      driver.hud.place(rect);
      // Each car's sound leans towards its viewport's side of the screen.
      this.audio?.setPan(i, ((rect.x + rect.width / 2) / this.renderer.width - 0.5) * 0.9);
    });
    if (this.mode === 'podium')
      this.renderer.setViewSize(this.renderer.width, this.renderer.height);
    else if (this.rects[0]) this.renderer.setViewSize(this.rects[0].width, this.rects[0].height);
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
    for (let i = 0; i < this.drivers.length; i++) {
      const driver = this.drivers[i] as Driver;
      if (driver.keyboardSet !== null && this.keyboard.takeItemPress(driver.keyboardSet)) {
        this.items?.requestUse(i);
      }
      if (this.autopilotOn) {
        autopilot(this.track, driver.racer, driver.car.input);
        driver.wantThrottle = driver.car.input.throttle;
        driver.wantHorn = false;
        // Testing aid: autopilot cars fire their items soon after the slot stops.
        const holder = this.items?.holders[i];
        if (holder?.item && this.race.clock > holder.rollUntil + 0.8) this.items?.requestUse(i);
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
    this.items?.update(this.sim.dt);
    this.boosts.update(this.sim.dt, this.race.phase === 'racing');
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
    const started = performance.now();
    this.clock += seconds;
    this.world.update(seconds);
    if (this.mode === 'race') this.itemVisuals.update(seconds, this.clock);
    this.dust.update(seconds);
    this.skids.flush();
    this.renderer.beginFrame(started);
    if (this.mode === 'podium' && this.podium) {
      const full = this.fullRect;
      this.podium.update(seconds, full.width / full.height);
      this.renderer.renderView(this.podium.scene, this.podium.camera, full, 0, this.clock);
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
        this.scene,
        driver.camera.camera,
        rect,
        Math.max(speedEffect(car.speedKph), car.boost * 0.9, car.draft * 0.7),
        this.clock,
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
      this.sun.focus(this.overview.focus);
      this.renderer.renderView(this.scene, this.overview.camera, rect, 0, this.clock);
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
    const { items } = this;
    const holder = items?.holders[index];
    if (items && holder) hud.setItem(holder.item, holder.charges, items.rolling(index), this.clock);
    hud.setTag(car.draft > 0.4 ? 'SLIPSTREAM' : '');
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
        renderScale: this.renderer.resolution.scale,
        autoResolution: this.renderer.resolution.enabled,
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
    for (let i = 0; i < this.drivers.length; i++) this.sendRaceStatusTo(i);
  }

  /** Position, lap, speed and item for one pad (also sent straight away when the item changes). */
  private sendRaceStatusTo(index: number): void {
    const driver = this.drivers[index];
    if (!driver || driver.player.local) return;
    const { racer } = driver;
    const race = this.race;
    const holder: Holder | undefined = this.items?.holders[index];
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
      item: holder?.item ?? null,
      charges: holder?.charges ?? 0,
      rolling: this.items?.rolling(index) ?? false,
    });
  }
}

/** 0..1 strength of the speed effects (speed lines, extra vignette) at this speed. */
function speedEffect(kph: number): number {
  const t = (kph - POST.speedLinesFromKph) / (POST.speedLinesFullKph - POST.speedLinesFromKph);
  return Math.min(1, Math.max(0, t));
}
