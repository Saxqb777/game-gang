/**
 * Pad side of the WebRTC transport. The pad initiates: it sends an offer through /api/signal,
 * polls for the TV's answer, then stops touching the API once the data channels are open.
 * If the link drops (wifi blip, phone locked) it quietly starts a fresh handshake.
 */
import {
  TV_PEER_ID,
  parseTvMessage,
  type IceServer,
  type PadMessage,
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
  randomId,
  waitForIceGathering,
  type Channels,
} from './rtc';

export type PadLinkStatus = 'connecting' | 'open' | 'reconnecting' | 'room-not-found';

export interface PadTransportEvents {
  onStatus(status: PadLinkStatus): void;
  onMessage(message: TvMessage): void;
}

interface Attempt {
  session: string;
  pc: RTCPeerConnection;
  channels: Channels;
  open: boolean;
  offerSent: boolean;
  remoteDescriptionSet: boolean;
  pendingRemoteCandidates: RTCIceCandidateInit[];
  startedAt: number;
  lastHeardAt: number;
}

export class PadTransport {
  private attempt: Attempt | null = null;
  private iceServers: IceServer[] | null = null;
  private running = false;
  private everOpened = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly room: string,
    readonly clientId: string,
    private readonly events: PadTransportEvents,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.watchdog = setInterval(() => this.checkSilence(), 1000);
    window.addEventListener('pagehide', this.sayGoodbye);
    void this.connect();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.retryTimer);
    clearInterval(this.watchdog);
    window.removeEventListener('pagehide', this.sayGoodbye);
    if (this.attempt) this.discard(this.attempt);
  }

  get isOpen(): boolean {
    return this.attempt?.open ?? false;
  }

  send(message: PadMessage): boolean {
    const attempt = this.attempt;
    if (!attempt?.open) return false;
    const channel = message.type === 'input' ? attempt.channels.input : attempt.channels.state;
    if (channel.readyState !== 'open') return false;
    channel.send(JSON.stringify(message));
    return true;
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    this.events.onStatus(this.everOpened ? 'reconnecting' : 'connecting');
    try {
      this.iceServers ??= (await api.roomInfo(this.room)).iceServers;
    } catch (error) {
      this.handleApiError(error);
      return;
    }

    const pc = createPeerConnection(this.iceServers);
    const now = performance.now();
    const attempt: Attempt = {
      session: randomId(10),
      pc,
      channels: createChannels(pc),
      open: false,
      offerSent: false,
      remoteDescriptionSet: false,
      pendingRemoteCandidates: [],
      startedAt: now,
      lastHeardAt: now,
    };
    this.attempt = attempt;
    this.wire(attempt);

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc, ICE_GATHER_TIMEOUT_MS);
      if (this.attempt !== attempt || !pc.localDescription) return;
      attempt.offerSent = true;
      await api.postSignal({
        room: this.room,
        from: this.clientId,
        to: TV_PEER_ID,
        payload: { kind: 'offer', session: attempt.session, sdp: pc.localDescription.sdp },
      });
      await this.awaitAnswer(attempt);
    } catch (error) {
      if (this.attempt === attempt) this.handleApiError(error);
    }
  }

  private wire(attempt: Attempt): void {
    const { pc, channels } = attempt;
    pc.onicecandidate = (event) => {
      if (!event.candidate || !attempt.offerSent || this.attempt !== attempt) return;
      void api
        .postSignal({
          room: this.room,
          from: this.clientId,
          to: TV_PEER_ID,
          payload: { kind: 'candidate', session: attempt.session, candidate: candidatePayload(event.candidate) },
        })
        .catch(() => undefined);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.fail(attempt);
    };
    channels.state.onopen = () => {
      attempt.open = true;
      attempt.lastHeardAt = performance.now();
      this.everOpened = true;
      this.retries = 0;
      this.events.onStatus('open');
    };
    channels.state.onclose = () => this.fail(attempt);
    const onMessage = (event: MessageEvent) => {
      attempt.lastHeardAt = performance.now();
      const message = parseTvMessage(event.data);
      if (!message) return;
      if (message.type === 'ping') {
        this.send({ type: 'pong', t: message.t });
        return;
      }
      this.events.onMessage(message);
    };
    channels.state.onmessage = onMessage;
    channels.input.onmessage = onMessage;
  }

  /** Polls the signaling inbox until the data channel opens or the attempt times out. */
  private async awaitAnswer(attempt: Attempt): Promise<void> {
    while (this.attempt === attempt && !attempt.open) {
      if (performance.now() - attempt.startedAt > HANDSHAKE_TIMEOUT_MS) {
        this.fail(attempt);
        return;
      }
      const messages = await api.pollSignals(this.room, this.clientId);
      for (const { payload } of messages) {
        if (payload.session !== attempt.session) continue;
        if (payload.kind === 'answer' && !attempt.remoteDescriptionSet) {
          await attempt.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
          attempt.remoteDescriptionSet = true;
          for (const candidate of attempt.pendingRemoteCandidates.splice(0)) {
            await attempt.pc.addIceCandidate(candidate).catch(() => undefined);
          }
        } else if (payload.kind === 'candidate') {
          if (attempt.remoteDescriptionSet) {
            await attempt.pc.addIceCandidate(payload.candidate).catch(() => undefined);
          } else {
            attempt.pendingRemoteCandidates.push(payload.candidate);
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, HANDSHAKE_POLL_MS));
    }
  }

  private handleApiError(error: unknown): void {
    if (error instanceof ApiError && error.status === 404) {
      this.running = false;
      if (this.attempt) this.discard(this.attempt);
      this.events.onStatus('room-not-found');
      return;
    }
    if (this.attempt) this.fail(this.attempt);
    else this.scheduleRetry();
  }

  private checkSilence(): void {
    const attempt = this.attempt;
    // The TV pings every second, so a few seconds of silence means the link is gone.
    if (attempt?.open && performance.now() - attempt.lastHeardAt > LINK_SILENCE_TIMEOUT_MS) {
      this.fail(attempt);
    }
  }

  private fail(attempt: Attempt): void {
    if (this.attempt !== attempt) return;
    this.discard(attempt);
    this.scheduleRetry();
  }

  private discard(attempt: Attempt): void {
    if (this.attempt === attempt) this.attempt = null;
    closePeer(attempt.pc, attempt.channels);
  }

  private scheduleRetry(): void {
    if (!this.running) return;
    this.events.onStatus(this.everOpened ? 'reconnecting' : 'connecting');
    const delay = Math.min(5000, 400 * 2 ** this.retries);
    this.retries++;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  /** Lets the TV free the slot immediately instead of waiting for the link to time out. */
  private readonly sayGoodbye = () => {
    if (!this.attempt) return;
    api.beaconSignal({
      room: this.room,
      from: this.clientId,
      to: TV_PEER_ID,
      payload: { kind: 'bye', session: this.attempt.session },
    });
  };
}
