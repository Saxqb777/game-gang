import './stage.css';
import {
  CAR_INFO,
  MAX_LAP_MS,
  MIN_LAP_MS,
  colourHex,
  type LeaderboardEntry,
  type TelemetrySample,
} from '@gamergang/shared';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { Hub } from '../../../hub/hub';
import { api } from '../../../net/api';
import { createTelemetryClient, type RendererInfo } from '../../../net/telemetry';
import { audioContext } from '../../../tv/audio';
import { readBenchFlags } from '../debug/benchFlags';
import { LOADING } from '../config';
import {
  ContextLostError,
  SplitWaysGame,
  type GameHooks,
  type LoadStep,
  type RaceResult,
} from '../game';
import { LoadTimeoutError } from '../loadGuard';
import { chooseLightMode, probeDevice, rememberLight, rememberedLight } from '../render/lightMode';
import { formatTime } from '../hud/viewportHud';
import { TRACK_1 } from '../track/tracks';

/** Posts this race's best laps (host only) and fetches the all-time board for the results screen. */
async function syncLeaderboard(
  hub: Hub,
  results: readonly RaceResult[],
): Promise<LeaderboardEntry[]> {
  const credentials = hub.roomCredentials();
  // The API rejects the whole post if any lap is out of range, so drop those first.
  const laps = results
    .filter(
      (r): r is RaceResult & { bestLapMs: number } =>
        r.bestLapMs !== null && r.bestLapMs >= MIN_LAP_MS && r.bestLapMs <= MAX_LAP_MS,
    )
    .map((r) => ({ name: r.name, bestLapMs: r.bestLapMs }));
  if (credentials && laps.length > 0) {
    await api
      .postLaps({ room: credentials.code, key: credentials.hostKey, track: TRACK_1.id, laps })
      .catch((error: unknown) => console.warn('[splitways] could not save lap times', error));
  }
  const board = await api.leaderboard(TRACK_1.id);
  return board.entries;
}

function ResultsPanel({
  hub,
  results,
  leaderboard,
}: {
  hub: Hub;
  results: readonly RaceResult[];
  leaderboard: readonly LeaderboardEntry[] | null;
}) {
  const state = useSyncExternalStore(hub.subscribe, hub.getState);
  const voters = state.players.filter((p) => p.connected && !p.local).length;
  const needed = Math.floor(voters / 2) + 1;
  const names = new Set(results.map((r) => r.name.toLowerCase()));
  return (
    <div className="sw-results">
      <section className="sw-results-card">
        <h2>Results</h2>
        <ol className="sw-results-list">
          {results.map((r) => (
            <li key={r.id} style={{ '--player': colourHex(r.colour) } as CSSProperties}>
              <span className={`sw-results-place p${r.place}`}>{r.place}</span>
              <span className="sw-results-name">
                {r.name}
                <span className="sw-results-car">{CAR_INFO[r.car].model}</span>
              </span>
              <span className="sw-results-time">
                {r.totalMs === null ? 'DNF' : formatTime(r.totalMs)}
              </span>
              <span className="sw-results-best">
                best {r.bestLapMs === null ? '-' : formatTime(r.bestLapMs)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="sw-results-card sw-results-board">
        <h2>All-time best laps · {TRACK_1.name}</h2>
        {leaderboard === null ? (
          <p className="sw-results-muted">Loading...</p>
        ) : leaderboard.length === 0 ? (
          <p className="sw-results-muted">No laps on the board yet.</p>
        ) : (
          <ol className="sw-board-list">
            {leaderboard.slice(0, 8).map((entry, i) => (
              <li
                key={`${entry.name}-${i}`}
                className={names.has(entry.name.toLowerCase()) ? 'is-new' : ''}
              >
                <span>{i + 1}</span>
                <span>{entry.name}</span>
                <span>{formatTime(entry.bestLapMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <footer className="sw-results-vote">
        {voters > 0 ? (
          <>
            Tap <b>PLAY AGAIN</b> on your phone · {state.votes.length}/{needed} votes
          </>
        ) : (
          <>
            Press <b>Esc</b> to go back to the lobby
          </>
        )}
      </footer>
    </div>
  );
}

/** The status line under the spinner: which load step a stuck TV is on, readable from a photo. */
const STEP_LABELS: Record<LoadStep, string> = {
  physics: 'Loading physics',
  track: 'Loading track',
  assets: 'Loading cars',
  display: 'Checking display',
  graphics: 'Preparing graphics',
  speed: 'Testing speed',
  start: 'Starting',
};

/** Why an attempt failed, short enough for the loading screen and a telemetry scenario. */
interface Failure {
  code: 'timeout' | 'lost' | 'error' | 'nowebgl';
  reason: string;
}

function describeFailure(error: unknown, step: LoadStep | null): Failure {
  if (error instanceof ContextLostError) return { code: 'lost', reason: 'graphics reset' };
  if (error instanceof LoadTimeoutError) {
    return { code: 'timeout', reason: `${error.step.toLowerCase()} timed out` };
  }
  const message = error instanceof Error ? error.message : String(error);
  const at = step ? ` while ${STEP_LABELS[step].toLowerCase()}` : '';
  return { code: 'error', reason: `${message.slice(0, 80)}${at}` };
}

/** A loading failure as a telemetry row (no frames): fits the existing schema, no server change. */
function failureSample(
  failure: Failure,
  light: boolean,
  viewports: number,
  elapsedMs: number,
): TelemetrySample {
  return {
    kind: 'loading-benchmark',
    scenario: `load-fail-${failure.code}${light ? '-light' : ''}`,
    track: TRACK_1.id,
    viewports: Math.max(1, Math.min(4, viewports)),
    preset: 'low',
    durationMs: Math.round(elapsedMs),
    frames: 0,
    fpsAvg: 0,
    frameMsP50: 0,
    frameMsP95: 0,
    frameMsP99: 0,
    frameMsMax: 0,
    cpuMsP99: 0,
    gpuMsAvg: null,
    gpuMsP95: null,
    gpuMsP99: null,
    missedFrames: 0,
    internalWidth: 1,
    internalHeight: 1,
    outputWidth: 1,
    outputHeight: 1,
    scaleAvg: 0,
    scaleMin: 0,
    drawCallsAvg: 0,
    trianglesAvg: 0,
    presetDrops: 0,
  };
}

/** Telemetry still describes the machine when the game never got as far as a renderer. */
const NO_RENDERER: RendererInfo = { refreshHz: Number.NaN, timerQuery: false, gpu: null };

/**
 * Mounts the Split Ways game for the players the hub put in this round.
 *
 * Loading can never hang (D-TV1): each attempt has a watchdog, and a normal attempt that times out,
 * loses its WebGL context or throws is retried once in light mode, which this device then
 * remembers. A light attempt that fails shows the failure with its reason. A context lost mid-race
 * restarts the race the same way (once).
 */
export default function SplitWaysStage({ hub }: { hub: Hub }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'failed'>('loading');
  const [results, setResults] = useState<RaceResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [step, setStep] = useState<LoadStep | null>(null);
  const [lightMode, setLightMode] = useState(false);
  const [failReason, setFailReason] = useState('');

  useEffect(() => {
    const container = gameRef.current;
    if (!container) return;
    let game: SplitWaysGame | null = null;
    let lastInfo: RendererInfo | null = null;
    let cancelled = false;
    /** Bumped per attempt: anything an older attempt finishes late is thrown away. */
    let attemptId = 0;
    let retried = false;
    /** The podium is up: a lost context then only costs the 3D backdrop, not worth a restart. */
    let raceOver = false;
    const players = hub
      .getState()
      .players.filter((p) => p.inGame)
      .map(({ id, name, colour, car, slot, local }) => ({ id, name, colour, car, slot, local }));

    const flags = readBenchFlags(window.location.search);
    if (flags.light === false) rememberLight(false);
    const probe = probeDevice();
    const choice = chooseLightMode(flags.light, rememberedLight(), probe);
    if (choice.light) console.info(`[splitways] light mode (${choice.reason})`);

    // One client per attempt: it describes the device once, from the renderer it first sees.
    const newTelemetry = () => createTelemetryClient(hub, () => game?.rendererInfo() ?? lastInfo);
    let telemetry = newTelemetry();
    // A closing TV page still sends what it measured (soak windows not posted yet).
    const onPageHide = () => {
      if (game) telemetry.queue(game.drainTelemetry());
      telemetry.flushBeacon();
    };
    window.addEventListener('pagehide', onPageHide);

    const baseHooks: Omit<GameHooks, 'onContextLost'> = {
      send: (playerId, message) => {
        hub.send(playerId, message);
      },
      rttMs: (playerId) => hub.rttMs(playerId),
      audio: audioContext(),
      onResults: (final) => {
        raceOver = true;
        hub.finishGame();
        setResults(final);
        syncLeaderboard(hub, final).then(
          (entries) => {
            if (!cancelled) setLeaderboard(entries);
          },
          () => {
            if (!cancelled) setLeaderboard([]);
          },
        );
      },
      telemetry: (samples) => {
        telemetry.sendSamples(samples);
      },
    };

    const run = (light: boolean): void => {
      const id = ++attemptId;
      const isStale = () => cancelled || id !== attemptId;
      const startedAt = performance.now();
      let current: LoadStep | null = null;
      let running = false;
      setLightMode(light);
      setStep(null);
      setStatus('loading');

      const fail = (failure: Failure, error: unknown) => {
        if (isStale()) return;
        attemptId++;
        clearTimeout(watchdog);
        console.error(
          `[splitways] ${light ? 'light ' : ''}attempt failed: ${failure.reason}`,
          error,
        );
        lastInfo = game?.rendererInfo() ?? lastInfo ?? NO_RENDERER;
        telemetry.sendSamples([
          failureSample(failure, light, players.length, performance.now() - startedAt),
        ]);
        hub.attachSession(null);
        game?.dispose();
        game = null;
        telemetry = newTelemetry();
        // A normal load that failed here means this device needs light mode from now on.
        if (!light) rememberLight(true);
        if (!retried && failure.code !== 'nowebgl') {
          retried = true;
          run(true);
          return;
        }
        setFailReason(failure.reason);
        setStatus('failed');
      };

      const watchdog = setTimeout(() => {
        const at = current ? STEP_LABELS[current].toLowerCase() : 'loading';
        fail({ code: 'timeout', reason: `timed out while ${at}` }, null);
      }, LOADING.attemptMs);

      if (!probe.webgl2) {
        fail({ code: 'nowebgl', reason: 'this browser has no WebGL 2' }, null);
        return;
      }

      const hooks: GameHooks = {
        ...baseHooks,
        onContextLost: () => {
          // During loading prepare() notices too; a loss mid-race restarts the race (once).
          if (raceOver) return;
          fail({ code: 'lost', reason: 'graphics reset' }, null);
        },
      };
      const options = {
        bench: flags.bench,
        light,
        onStep: (next: LoadStep) => {
          current = next;
          if (!isStale() && !running) setStep(next);
        },
      };

      void (async () => {
        try {
          const created = await SplitWaysGame.create(container, players, hooks, options);
          if (isStale()) {
            created.dispose();
            return;
          }
          game = created;
          // Pad input during loading is harmless: the race holds the cars until GO.
          hub.attachSession({
            onInput: (playerId, input) => created.handleInput(playerId, input),
            onAction: (playerId, action) => created.handleAction(playerId, action),
            onPlayerConnection: (playerId, connected) => created.setConnected(playerId, connected),
          });
          // Shader compile and the loading benchmark run behind the loading screen.
          await created.prepare();
          if (isStale()) return;
          clearTimeout(watchdog);
          running = true;
          setStatus('running');
        } catch (error: unknown) {
          fail(describeFailure(error, current), error);
        }
      })();
    };

    run(choice.light);

    return () => {
      cancelled = true;
      attemptId++;
      window.removeEventListener('pagehide', onPageHide);
      hub.attachSession(null);
      game?.dispose();
    };
  }, [hub]);

  return (
    <div className="sw-stage">
      <div className="sw-game" ref={gameRef} />
      {status === 'loading' ? (
        <div className="sw-loading">
          <div className="sw-loading-spinner" />
          <span>Warming up the tyres...</span>
          <span className="sw-loading-step">
            {[lightMode ? 'Light mode' : null, step ? STEP_LABELS[step] : null]
              .filter(Boolean)
              .join(' · ') || '\u00a0'}
          </span>
        </div>
      ) : null}
      {status === 'failed' ? (
        <div className="sw-loading">
          <span>Could not start the game. Press Esc to go back to the lobby.</span>
          {failReason ? <span className="sw-loading-step">{failReason}</span> : null}
        </div>
      ) : null}
      {results ? <ResultsPanel hub={hub} results={results} leaderboard={leaderboard} /> : null}
    </div>
  );
}
