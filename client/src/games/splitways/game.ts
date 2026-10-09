/**
 * Split Ways on the TV: owns the physics, the scene, every player's car and camera, and the loop.
 * The hub feeds it pad inputs; it answers with race status and haptics for the pads.
 */
import { colourHex, type ColourId, type InputMessage, type TvMessage } from '@gamergang/shared';
import { Color, Fog, HemisphereLight, PMREMGenerator, Scene, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CAR, INPUT, RESPAWN } from './config';
import { DebugOverlay } from './debug/debugOverlay';
import { ViewportHud } from './hud/viewportHud';
import { KeyboardDriver } from './input/keyboard';
import { FixedStepLoop } from './loop';
import { ChaseCamera } from './render/chaseCamera';
import { GameRenderer } from './render/renderer';
import { Sun } from './render/sun';
import { viewportLayout, type Rect } from './render/viewports';
import { CarModelLibrary, type CarVisual } from './scene/carVisual';
import { createTestPlaneVisual } from './scene/testPlaneVisual';
import type { Car } from './sim/car';
import { NEUTRAL_INPUT, copyInput, mergeInputs, type DriveInput } from './sim/input';
import { Simulation, type Impact } from './sim/simulation';
import { PhysicsWorld } from './sim/world';
import { TEST_PLANE_SPAWNS, buildTestPlanePhysics } from './track/testPlane';

export interface GamePlayer {
  id: string;
  name: string;
  colour: ColourId;
  slot: number;
  /** Plays on the TV keyboard. */
  local: boolean;
}

export interface GameHooks {
  send(playerId: string, message: TvMessage): void;
  rttMs(playerId: string): number | null;
}

interface Driver {
  player: GamePlayer;
  car: Car;
  visual: CarVisual;
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
/** Impacts above this force (N) shake the camera and buzz the pad. */
const IMPACT_THRESHOLD = CAR.mass * 40;

const respawnTarget = new Vector3();

export class SplitWaysGame {
  private readonly scene = new Scene();
  private readonly renderer: GameRenderer;
  private readonly sun: Sun;
  private readonly sim: Simulation;
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
      const models = await CarModelLibrary.load();
      return new SplitWaysGame(container, players, hooks, physics, models);
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
  ) {
    this.canvas.className = 'sw-canvas';
    this.hudLayer.className = 'sw-hud-layer';
    container.append(this.canvas, this.hudLayer);
    this.renderer = new GameRenderer(this.canvas);

    this.scene.background = new Color(0xa9c8e6);
    this.scene.fog = new Fog(0xa9c8e6, 180, 650);
    const pmrem = new PMREMGenerator(this.renderer.webgl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new HemisphereLight(0xd6e6ff, 0x6d6457, 0.9));
    this.sun = new Sun(this.scene, new Vector3(-0.45, 0.75, -0.5), new Color(0xfff0dc), 3.2);

    buildTestPlanePhysics(physics);
    this.scene.add(createTestPlaneVisual(this.renderer.webgl.capabilities.getMaxAnisotropy()));
    this.sim = new Simulation(physics);

    const ordered = [...players].sort((a, b) => a.slot - b.slot);
    const hasLocalPlayers = ordered.some((p) => p.local);
    let nextKeySet = 0;
    this.drivers = ordered.map((player, index) => {
      const spawn = TEST_PLANE_SPAWNS[index % TEST_PLANE_SPAWNS.length] ?? TEST_PLANE_SPAWNS[0];
      if (!spawn) throw new Error('No spawn points');
      const car = this.sim.addCar(spawn);
      const visual = models.create(colourHex(player.colour));
      this.scene.add(visual.root);
      // Keyboard players get a key set each; with no keyboard players WASD also drives the first car.
      const keyboardSet = player.local ? nextKeySet++ : !hasLocalPlayers && index === 0 ? 0 : null;
      return {
        player,
        car,
        visual,
        camera: new ChaseCamera(),
        hud: new ViewportHud(this.hudLayer, player.name, colourHex(player.colour)),
        padInput: copyInput({ ...NEUTRAL_INPUT }, NEUTRAL_INPUT),
        padInputAt: 0,
        connected: true,
        keyboardSet,
        lastHapticAt: 0,
      };
    });

    this.debug = new DebugOverlay(container);
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
    this.resizeObserver.disconnect();
    this.keyboard.dispose();
    this.debug.dispose();
    for (const driver of this.drivers) {
      driver.visual.dispose();
      driver.hud.dispose();
    }
    this.sim.dispose();
    this.models.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    // Only remove what this game added: in dev, React may briefly run two games in one container.
    this.canvas.remove();
    this.hudLayer.remove();
  }

  private layout(): void {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
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
  }

  private step(): void {
    this.keyboard.poll();
    const now = performance.now();
    for (const driver of this.drivers) {
      const padFresh = driver.connected && now - driver.padInputAt < INPUT.staleAfterMs;
      const pad = padFresh ? driver.padInput : NEUTRAL_INPUT;
      const keys =
        driver.keyboardSet === null
          ? NEUTRAL_INPUT
          : (this.keyboard.inputs[driver.keyboardSet] ?? NEUTRAL_INPUT);
      mergeInputs(driver.car.input, pad, keys);
    }

    this.sim.step();
    this.stepTime = now;
    this.sim.drainImpacts(this.onImpact);

    for (const driver of this.drivers) {
      const { car } = driver;
      if (car.flippedTime > RESPAWN.flippedSeconds || car.position.y < -20) {
        // Back on its wheels where it stopped, same heading.
        respawnTarget.set(0, 0, 1).applyQuaternion(car.quaternion);
        const yaw = Math.atan2(respawnTarget.x, respawnTarget.z);
        const outOfWorld = car.position.y < -20;
        car.placeAt({
          x: outOfWorld ? 0 : car.position.x,
          y: outOfWorld ? 0.5 : Math.max(car.position.y, 0) + 0.6,
          z: outOfWorld ? 0 : car.position.z,
          yaw,
        });
        driver.camera.snap();
      }
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

  private render(alpha: number, seconds: number): void {
    const started = performance.now();
    this.renderer.beginFrame();
    for (const driver of this.drivers) driver.visual.update(driver.car, alpha, seconds);
    for (let i = 0; i < this.drivers.length; i++) {
      const driver = this.drivers[i] as Driver;
      const rect = this.rects[i];
      if (!rect) continue;
      const { root } = driver.visual;
      driver.camera.update(
        seconds,
        root.position,
        root.quaternion,
        driver.car.velocity,
        rect.width / rect.height,
      );
      this.sun.focus(root.position);
      this.renderer.renderView(this.scene, driver.camera.camera, rect);
      driver.hud.setSpeed(driver.car.speedKph);
      driver.hud.setStatus(driver.connected || driver.player.local ? '' : 'Reconnecting...');
    }

    this.frames++;
    if (started - this.fpsWindowStart >= 1000) {
      this.fps = (this.frames * 1000) / (started - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = started;
    }
    if (this.debug.isVisible) {
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
        },
        this.drivers.map((d) => ({
          name: d.player.name,
          colour: colourHex(d.player.colour),
          input: d.car.input,
          speedKph: d.car.speedKph,
          slipDeg: (d.car.slipAngle * 180) / Math.PI,
          rttMs: this.hooks.rttMs(d.player.id),
          connected: d.connected || d.player.local,
        })),
      );
    }
    this.lastFrameMs = performance.now() - started;
  }

  private sendRaceStatus(): void {
    const playerCount = this.drivers.length;
    this.drivers.forEach((driver, index) => {
      if (driver.player.local) return;
      this.hooks.send(driver.player.id, {
        type: 'race',
        phase: 'racing',
        countdown: 0,
        position: index + 1,
        playerCount,
        lap: 0,
        totalLaps: 3,
        speedKph: Math.min(999, driver.car.speedKph),
      });
    });
  }
}
