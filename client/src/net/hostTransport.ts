/**
 * TV side of the WebRTC transport. The TV is the host peer: it owns a room, answers offers from
 * pads that arrive through /api/signal, and then talks to each pad over direct data channels.
 */
import {
  TV_PEER_ID,
  parsePadMessage,
  type IceServer,
  type PadMessage,
  type SignalPayload,
  type TvMessage,
} from '@gamergang/shared';
import { ApiError, api } from './api';
import {
  HANDSHAKE_POLL_MS,
  HANDSHAKE_TIMEOUT_MS,
  ICE_GATHER_TIMEOUT_MS,
  LINK_SILENCE_TIMEOUT_MS,
  candidatePayload,
  closePeer,
  createChannels,
  createPeerConnection,
  waitForIceGathering,
  type Channels,
} from './rtc';

export interface RoomInfo {
  code: string;
  padUrl: string;
}

export interface HostTransportEvents {
  onRoom(room: RoomInfo): void;
  onPeerOpen(peerId: string): void;
  onPeerMessage(peerId: string, message: PadMessage): void;
  onPeerClose(peerId: string): void;
}

/** What the hub needs from a transport. Lets tests swap in a fake. */
export interface HostTransportPort {
  start(): void;
  stop(): void;
  send(peerId: string, message: TvMessage): boolean;
  setIdlePollMs(ms: number): void;
}

interface RoomCredentials extends RoomInfo {
  hostKey: string;
  iceServers: IceServer[];
}

interface Link {
  peerId: string;
  session: string;
  pc: RTCPeerConnection;
  channels: Channels;
  open: boolean;
  remoteDescriptionSet: boolean;
  answerSent: boolean;
  pendingRemoteCandidates: RTCIceCandidateInit[];
  createdAt: number;
  lastHeardAt: number;
}

const SAVED_ROOM_KEY = 'gamergang.tv.room';

function readSavedRoom(): { code: string; hostKey: string } | null {
  try {
    const raw = sessionStorage.getItem(SAVED_ROOM_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { code?: unknown; hostKey?: unknown };
    return typeof value.code === 'string' && typeof value.hostKey === 'string'
      ? { code: value.code, hostKey: value.hostKey }
      : null;
  } catch {
    return null;
  }
}

export class HostTransport implements HostTransportPort {
  private readonly links = new Map<string, Link>();
  private room: RoomCredentials | null = null;
  private idlePollMs = 1000;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private failures = 0;
  private running = false;

  constructor(private readonly events: HostTransportEvents) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.watchdog = setInterval(() => this.checkLinks(), 1000);
    void this.openRoom().then(() => this.schedulePoll(0));
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.pollTimer);
    clearInterval(this.watchdog);
    for (const link of [...this.links.values()]) this.closeLink(link);
  }

  setIdlePollMs(ms: number): void {
    this.idlePollMs = ms;
  }

  send(peerId: string, message: TvMessage): boolean {
    const link = this.links.get(peerId);
    if (!link?.open || link.channels.state.readyState !== 'open') return false;
    link.channels.state.send(JSON.stringify(message));
    return true;
  }

  /** Resume this tab's room after a reload if it is still alive, otherwise create a new one. */
  private async openRoom(): Promise<void> {
    while (this.running) {
      try {
        const saved = readSavedRoom();
        if (saved) {
          try {
            const info = await api.roomInfo(saved.code, saved.hostKey);
            this.setRoom({ ...saved, padUrl: info.padUrl, iceServers: info.iceServers });
            return;
          } catch (error) {
            if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 403)) {
              throw error;
            }
          }
        }
        const created = await api.createRoom();
        this.setRoom(created);
        return;
      } catch (error) {
        console.warn('[host] could not open a room, retrying', error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private setRoom(room: RoomCredentials): void {
    this.room = room;
    sessionStorage.setItem(SAVED_ROOM_KEY, JSON.stringify({ code: room.code, hostKey: room.hostKey }));
    this.events.onRoom({ code: room.code, padUrl: room.padUrl });
  }

  private schedulePoll(delayMs: number): void {
    clearTimeout(this.pollTimer);
    if (!this.running) return;
    this.pollTimer = setTimeout(() => void this.poll(), delayMs);
  }

  private get handshaking(): boolean {
    for (const link of this.links.values()) if (!link.open) return true;
    return false;
  }

  private async poll(): Promise<void> {
    const room = this.room;
    if (!room) return;
    try {
      const messages = await api.pollSignals(room.code, TV_PEER_ID, room.hostKey);
      this.failures = 0;
      for (const message of messages) this.handleSignal(room, message.from, message.payload);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        // The room expired (e.g. the laptop slept). Connected pads keep working; new joins need the new code.
        sessionStorage.removeItem(SAVED_ROOM_KEY);
        this.room = null;
        await this.openRoom();
      } else {
        this.failures++;
      }
    }
    const base = this.handshaking ? HANDSHAKE_POLL_MS : this.idlePollMs;
    this.schedulePoll(this.failures ? Math.min(8000, base * 2 ** this.failures) : base);
  }

  private handleSignal(room: RoomCredentials, from: string, payload: SignalPayload): void {
    const existing = this.links.get(from);
    switch (payload.kind) {
      case 'offer': {
        // A new offer from a known pad means it is reconnecting: replace the old link.
        if (existing) this.closeLink(existing);
        // Not awaited: answering takes up to the ICE gathering timeout and other pads may be waiting.
        void this.answer(room, from, payload.session, payload.sdp);
        return;
      }
      case 'candidate': {
        if (!existing || existing.session !== payload.session) return;
        if (existing.remoteDescriptionSet) {
          existing.pc.addIceCandidate(payload.candidate).catch(() => undefined);
        } else {
          existing.pendingRemoteCandidates.push(payload.candidate);
        }
        return;
      }
      case 'bye': {
        if (existing && existing.session === payload.session) this.closeLink(existing);
        return;
      }
      case 'answer':
        return; // The TV never sends offers, so it never expects answers.
    }
  }

  private async answer(room: RoomCredentials, peerId: string, session: string, sdp: string): Promise<void> {
    const pc = createPeerConnection(room.iceServers);
    const link: Link = {
      peerId,
      session,
      pc,
      channels: createChannels(pc),
      open: false,
      remoteDescriptionSet: false,
      answerSent: false,
      pendingRemoteCandidates: [],
      createdAt: performance.now(),
      lastHeardAt: performance.now(),
    };
    this.links.set(peerId, link);
    this.wireLink(room, link);

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      link.remoteDescriptionSet = true;
      for (const candidate of link.pendingRemoteCandidates.splice(0)) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
      }
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIceGathering(pc, ICE_GATHER_TIMEOUT_MS);
      if (this.links.get(peerId) !== link || !pc.localDescription) return;
      // Candidates gathered so far are inside this SDP; later ones are trickled by onicecandidate.
      link.answerSent = true;
      await api.postSignal({
        room: room.code,
        from: TV_PEER_ID,
        to: peerId,
        key: room.hostKey,
        payload: { kind: 'answer', session, sdp: pc.localDescription.sdp },
      });
    } catch (error) {
      console.warn('[host] handshake failed', peerId, error);
      if (this.links.get(peerId) === link) this.closeLink(link);
    }
  }

  private wireLink(room: RoomCredentials, link: Link): void {
    const { pc, channels, peerId } = link;
    pc.onicecandidate = (event) => {
      if (!event.candidate || !link.answerSent) return;
      void api
        .postSignal({
          room: room.code,
          from: TV_PEER_ID,
          to: peerId,
          key: room.hostKey,
          payload: { kind: 'candidate', session: link.session, candidate: candidatePayload(event.candidate) },
        })
        .catch(() => undefined);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.closeLink(link);
    };
    channels.state.onopen = () => {
      link.open = true;
      link.lastHeardAt = performance.now();
      this.events.onPeerOpen(peerId);
    };
    channels.state.onclose = () => this.closeLink(link);
    const onMessage = (event: MessageEvent) => {
      link.lastHeardAt = performance.now();
      const message = parsePadMessage(event.data);
      if (message) this.events.onPeerMessage(peerId, message);
    };
    channels.state.onmessage = onMessage;
    channels.input.onmessage = onMessage;
  }

  /** Drops links that never finished their handshake or went silent (pads answer pings every second). */
  private checkLinks(): void {
    const now = performance.now();
    for (const link of [...this.links.values()]) {
      const stale = link.open
        ? now - link.lastHeardAt > LINK_SILENCE_TIMEOUT_MS
        : now - link.createdAt > HANDSHAKE_TIMEOUT_MS;
      if (stale) this.closeLink(link);
    }
  }

  private closeLink(link: Link): void {
    if (this.links.get(link.peerId) !== link) return;
    this.links.delete(link.peerId);
    closePeer(link.pc, link.channels);
    if (link.open) this.events.onPeerClose(link.peerId);
  }
}
