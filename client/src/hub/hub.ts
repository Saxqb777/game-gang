/**
 * The Gamer Gang hub: room, player slots, lobby, ready-up and play-again votes.
 * It runs on the TV and knows nothing about any particular game. A game attaches a session to
 * receive inputs, and tells the hub when it has finished.
 */
import {
  MAX_PLAYERS,
  PLAYER_COLOURS,
  type ColourId,
  type GameAction,
  type GameId,
  type HubPhase,
  type InputMessage,
  type JoinMessage,
  type LobbyMessage,
  type PadMessage,
  type TvMessage,
} from '@gamergang/shared';
import { PING_INTERVAL_MS, randomId } from '../net/rtc';
import type { HostTransportEvents, HostTransportPort, RoomInfo } from '../net/hostTransport';

export interface HubPlayer {
  id: string;
  name: string;
  colour: ColourId;
  slot: number;
  ready: boolean;
  connected: boolean;
  /** Has a role in the current game. Late joiners wait in the lobby for the next round. */
  inGame: boolean;
  /** Plays with the TV keyboard instead of a phone. */
  local: boolean;
}

export interface HubState {
  room: RoomInfo | null;
  phase: HubPhase;
  players: readonly HubPlayer[];
  votes: readonly string[];
}

export interface GameSessionHandlers {
  onInput(playerId: string, input: InputMessage): void;
  /** A button press sent reliably, e.g. reset. */
  onAction(playerId: string, action: GameAction): void;
  onPlayerConnection(playerId: string, connected: boolean): void;
}

/** Disconnected players keep their slot this long in the lobby before it is freed. */
const LOBBY_GRACE_MS = 15_000;
/** Length of the per-seat secret a pad must show to claim an existing seat. */
const SEAT_KEY_LENGTH = 24;
/** If every player is gone for this long mid-game, the hub returns to the lobby. */
const ABANDONED_GAME_MS = 30_000;
const IDLE_POLL_MS: Record<HubPhase, number> = { lobby: 1000, playing: 2000, results: 1000 };

export class Hub {
  private state: HubState;
  private readonly listeners = new Set<() => void>();
  private readonly peers = new Set<string>();
  private readonly lastInputTime = new Map<string, number>();
  private readonly rtt = new Map<string, number>();
  private readonly removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Phone seats' secrets, sent only to the owning pad in `joined`. */
  private readonly seatKeys = new Map<string, string>();
  /**
   * Links that proved they own their seat (a join with the right key) since they opened. Peer ids
   * are public and signalling does not check them, so an unproven link may not drive, vote or ready.
   */
  private readonly verified = new Set<string>();
  private readonly transport: HostTransportPort;
  private session: GameSessionHandlers | null = null;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private abandonTimer: ReturnType<typeof setTimeout> | undefined;

  /** Called when everyone is ready. The TV app starts the selected game here. */
  onStart: ((players: readonly HubPlayer[]) => void) | null = null;
  /** Called when the hub leaves a game (vote passed or everyone left). */
  onEnd: (() => void) | null = null;

  constructor(
    readonly game: GameId,
    createTransport: (events: HostTransportEvents) => HostTransportPort,
  ) {
    this.state = { room: null, phase: 'lobby', players: [], votes: [] };
    this.transport = createTransport({
      onRoom: (room) => this.update({ room }),
      onPeerOpen: (peerId) => this.handlePeerOpen(peerId),
      onPeerMessage: (peerId, message) => this.handleMessage(peerId, message),
      onPeerClose: (peerId) => this.handlePeerClose(peerId),
    });
  }

  start(): void {
    this.transport.setIdlePollMs(IDLE_POLL_MS.lobby);
    this.transport.start();
    this.pingTimer = setInterval(() => {
      for (const peerId of this.peers)
        this.transport.send(peerId, { type: 'ping', t: performance.now() });
    }, PING_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.pingTimer);
    clearTimeout(this.abandonTimer);
    for (const timer of this.removalTimers.values()) clearTimeout(timer);
    this.transport.stop();
  }

  // ---- React binding -------------------------------------------------------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): HubState => this.state;

  // ---- Game-facing API ----------------------------------------------------

  attachSession(session: GameSessionHandlers | null): void {
    this.session = session;
  }

  player(playerId: string): HubPlayer | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  rttMs(playerId: string): number | null {
    return this.rtt.get(playerId) ?? null;
  }

  roomCredentials(): { code: string; hostKey: string } | null {
    return this.transport.credentials();
  }

  send(playerId: string, message: TvMessage): void {
    if (!this.player(playerId)?.local) this.transport.send(playerId, message);
  }

  /** Sends to every pad currently in the game. */
  sendToGame(message: TvMessage): void {
    for (const player of this.state.players) if (player.inGame) this.send(player.id, message);
  }

  /** The game is over: show results and collect play-again votes. */
  finishGame(): void {
    if (this.state.phase !== 'playing') return;
    this.update({ phase: 'results', votes: [] });
  }

  /** Ends the current game immediately and returns everyone to the lobby. */
  returnToLobby(): void {
    if (this.state.phase === 'lobby') return;
    clearTimeout(this.abandonTimer);
    this.session = null;
    this.update({
      phase: 'lobby',
      votes: [],
      players: this.state.players.map((p) => ({ ...p, ready: false, inGame: false })),
    });
    for (const player of this.state.players) {
      if (player.connected) continue;
      // A phone that tapped Leave gave up its key: free its slot now instead of after the grace.
      if (!player.local && !this.seatKeys.has(player.id)) this.removePlayer(player.id);
      else this.scheduleRemoval(player.id);
    }
    this.onEnd?.();
  }

  // ---- Local (keyboard) players --------------------------------------------

  addLocalPlayer(id: string, name: string): void {
    if (this.player(id) || this.state.players.length >= MAX_PLAYERS) return;
    this.addPlayer(id, name, this.firstFreeColour(), true);
  }

  removeLocalPlayer(id: string): void {
    if (this.player(id)?.local && this.state.phase === 'lobby') this.removePlayer(id);
  }

  toggleLocalReady(id: string): void {
    const player = this.player(id);
    if (player?.local) this.setReady(id, !player.ready);
  }

  // ---- Transport events ---------------------------------------------------

  private handlePeerOpen(peerId: string): void {
    this.peers.add(peerId);
    this.verified.delete(peerId);
    // A fresh pad needs the lobby (taken colours, phase) before it joins.
    this.transport.send(peerId, this.lobbyMessage());
  }

  private handlePeerClose(peerId: string): void {
    this.peers.delete(peerId);
    this.verified.delete(peerId);
    this.rtt.delete(peerId);
    this.lastInputTime.delete(peerId);
    const player = this.player(peerId);
    if (!player) return;
    this.patchPlayer(peerId, { connected: false });
    if (player.inGame) this.session?.onPlayerConnection(peerId, false);
    if (this.state.phase === 'lobby') this.scheduleRemoval(peerId);
    this.checkAbandoned();
  }

  private handleMessage(peerId: string, message: PadMessage): void {
    if (message.type === 'join') {
      this.handleJoin(peerId, message);
      return;
    }
    if (message.type === 'pong') {
      this.rtt.set(peerId, Math.max(0, performance.now() - message.t));
      return;
    }
    // Everything else acts for a seat, so it needs a link that has proved it owns one.
    if (!this.verified.has(peerId)) return;
    switch (message.type) {
      case 'leave':
        this.handleLeave(peerId);
        return;
      case 'ready':
        if (this.player(peerId) && this.state.phase === 'lobby')
          this.setReady(peerId, message.ready);
        return;
      case 'vote':
        this.handleVote(peerId);
        return;
      case 'action':
        if (this.player(peerId)?.inGame && this.state.phase === 'playing')
          this.session?.onAction(peerId, message.action);
        return;
      case 'input': {
        const player = this.player(peerId);
        if (!player?.inGame || this.state.phase !== 'playing') return;
        // Inputs travel on an unordered channel: drop anything older than what we already have.
        if (message.t <= (this.lastInputTime.get(peerId) ?? -1)) return;
        this.lastInputTime.set(peerId, message.t);
        this.session?.onInput(peerId, message);
        return;
      }
    }
  }

  private handleJoin(peerId: string, message: JoinMessage): void {
    const existing = this.player(peerId);
    if (existing) {
      // Anyone can learn a player id from the lobby list, so only the seat's key claims it.
      const ownKey = this.seatKeys.get(peerId);
      if (!ownKey || message.seatKey !== ownKey) {
        this.transport.send(peerId, { type: 'kicked', reason: 'taken' });
        return;
      }
      // Same peer id: a link reconnect, a reloaded pad claiming its seat back, or an edit.
      clearTimeout(this.removalTimers.get(peerId));
      this.removalTimers.delete(peerId);
      // A car already on track keeps its paint and name tag, so the pad must not drift from it.
      const locked = existing.inGame && this.state.phase !== 'lobby';
      if (message.rejoin || locked) {
        this.patchPlayer(peerId, { connected: true });
      } else {
        const colour = this.isColourFree(message.colour, peerId) ? message.colour : existing.colour;
        this.patchPlayer(peerId, { name: message.name, colour, connected: true });
      }
      if (existing.inGame && !existing.connected) this.session?.onPlayerConnection(peerId, true);
      clearTimeout(this.abandonTimer);
    } else {
      if (this.state.players.length >= MAX_PLAYERS) {
        this.transport.send(peerId, { type: 'kicked', reason: 'full' });
        return;
      }
      const colour = this.isColourFree(message.colour) ? message.colour : this.firstFreeColour();
      this.addPlayer(peerId, message.name, colour, false);
    }
    const player = this.player(peerId);
    const seatKey = this.seatKeys.get(peerId);
    if (player && seatKey) {
      this.verified.add(peerId);
      this.transport.send(peerId, {
        type: 'joined',
        playerId: peerId,
        seatKey,
        colour: player.colour,
        slot: player.slot,
      });
    }
    // A pad that was ready before its reload may have been the last one the lobby waited for.
    this.maybeStart();
  }

  /** An explicit Leave: the seat is freed now, unless the player's car is in the race. */
  private handleLeave(peerId: string): void {
    const player = this.player(peerId);
    if (!player || player.local) return;
    if (this.state.phase === 'lobby' || !player.inGame) {
      clearTimeout(this.removalTimers.get(peerId));
      this.removePlayer(peerId);
      return;
    }
    // Mid-game the car stays on the grid without a driver; the lobby frees the slot afterwards.
    // Without its key the seat can no longer be claimed back.
    this.seatKeys.delete(peerId);
    this.verified.delete(peerId);
    if (player.connected) {
      this.patchPlayer(peerId, { connected: false });
      this.session?.onPlayerConnection(peerId, false);
      this.checkAbandoned();
    }
  }

  /** A strict majority of the connected phones. */
  votesNeeded(): number {
    const voters = this.state.players.filter((p) => p.connected && !p.local).length;
    return Math.floor(Math.max(1, voters) / 2) + 1;
  }

  private handleVote(peerId: string): void {
    if (this.state.phase !== 'results' || !this.player(peerId)) return;
    if (this.state.votes.includes(peerId)) return;
    this.update({ votes: [...this.state.votes, peerId] });
    if (this.state.votes.length >= this.votesNeeded()) this.returnToLobby();
  }

  // ---- State helpers ---------------------------------------------------------

  private addPlayer(id: string, name: string, colour: ColourId, local: boolean): void {
    const taken = new Set(this.state.players.map((p) => p.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    if (!local) this.seatKeys.set(id, randomId(SEAT_KEY_LENGTH));
    const player: HubPlayer = {
      id,
      name,
      colour,
      slot,
      ready: false,
      connected: true,
      inGame: false,
      local,
    };
    this.update({ players: [...this.state.players, player].sort((a, b) => a.slot - b.slot) });
  }

  private removePlayer(id: string): void {
    this.removalTimers.delete(id);
    this.seatKeys.delete(id);
    this.verified.delete(id);
    this.update({ players: this.state.players.filter((p) => p.id !== id) });
    this.maybeStart();
  }

  private scheduleRemoval(id: string): void {
    clearTimeout(this.removalTimers.get(id));
    this.removalTimers.set(
      id,
      setTimeout(() => {
        // The grace is over either way, so this seat no longer holds up the start.
        this.removalTimers.delete(id);
        const player = this.player(id);
        if (player && !player.connected && this.state.phase === 'lobby') this.removePlayer(id);
      }, LOBBY_GRACE_MS),
    );
  }

  private setReady(id: string, ready: boolean): void {
    this.patchPlayer(id, { ready });
    this.maybeStart();
  }

  private maybeStart(): void {
    const present = this.state.players.filter((p) => p.connected);
    if (this.state.phase !== 'lobby' || present.length === 0) return;
    if (!present.every((p) => p.ready)) return;
    // A pad inside its reconnect grace (most often a reload) still holds its seat: wait for it,
    // or for the grace to run out, rather than start the race without it.
    if (this.state.players.some((p) => !p.connected && this.removalTimers.has(p.id))) return;
    this.update({
      phase: 'playing',
      votes: [],
      players: this.state.players.map((p) => ({ ...p, inGame: p.connected })),
    });
    this.onStart?.(this.state.players.filter((p) => p.inGame));
  }

  private checkAbandoned(): void {
    if (this.state.phase === 'lobby') return;
    if (this.state.players.some((p) => p.inGame && p.connected)) return;
    clearTimeout(this.abandonTimer);
    this.abandonTimer = setTimeout(() => {
      if (!this.state.players.some((p) => p.inGame && p.connected)) this.returnToLobby();
    }, ABANDONED_GAME_MS);
  }

  private isColourFree(colour: ColourId, exceptPlayerId?: string): boolean {
    return !this.state.players.some((p) => p.colour === colour && p.id !== exceptPlayerId);
  }

  private firstFreeColour(): ColourId {
    const free = PLAYER_COLOURS.find((c) => this.isColourFree(c.id));
    return free?.id ?? PLAYER_COLOURS[0].id;
  }

  private patchPlayer(id: string, patch: Partial<HubPlayer>): void {
    this.update({ players: this.state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  private lobbyMessage(): LobbyMessage {
    return {
      type: 'lobby',
      room: this.state.room?.code ?? 'XXXX',
      game: this.game,
      state: this.state.phase,
      players: this.state.players.map(({ id, name, colour, ready, connected, inGame, slot }) => ({
        id,
        name,
        colour,
        ready,
        connected,
        inGame,
        slot,
      })),
      votes: [...this.state.votes],
      votesNeeded: this.votesNeeded(),
    };
  }

  private update(patch: Partial<HubState>): void {
    const phaseChanged = patch.phase !== undefined && patch.phase !== this.state.phase;
    this.state = { ...this.state, ...patch };
    if (phaseChanged) this.transport.setIdlePollMs(IDLE_POLL_MS[this.state.phase]);
    if (this.state.room) {
      const lobby = this.lobbyMessage();
      for (const peerId of this.peers) this.transport.send(peerId, lobby);
    }
    for (const listener of this.listeners) listener();
  }
}
