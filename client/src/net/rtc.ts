/** WebRTC pieces shared by the TV (host) and pad (client) transports. */
import type { IceServer, SignalPayload } from '@gamergang/shared';

type CandidatePayload = Extract<SignalPayload, { kind: 'candidate' }>['candidate'];

/** How long we wait for ICE candidates before sending an offer/answer with what we have. */
export const ICE_GATHER_TIMEOUT_MS = 1000;
/** Poll /api/signal this often while a handshake is in flight. */
export const HANDSHAKE_POLL_MS = 500;
/** Give up on a handshake attempt after this long and start a fresh one. */
export const HANDSHAKE_TIMEOUT_MS = 15_000;
/** A link with no traffic for this long is treated as dead (pings flow every second). */
export const LINK_SILENCE_TIMEOUT_MS = 5000;
export const PING_INTERVAL_MS = 1000;

export interface Channels {
  /** Reliable + ordered: lobby, join, ready, votes, race status. */
  state: RTCDataChannel;
  /** Unreliable + unordered: driving input. A late input is worse than a lost one. */
  input: RTCDataChannel;
}

export function createPeerConnection(iceServers: IceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
}

/** Both sides create the same pre-negotiated channels, so neither waits for `ondatachannel`. */
export function createChannels(pc: RTCPeerConnection): Channels {
  return {
    state: pc.createDataChannel('state', { negotiated: true, id: 0, ordered: true }),
    input: pc.createDataChannel('input', {
      negotiated: true,
      id: 1,
      ordered: false,
      maxRetransmits: 0,
    }),
  };
}

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

/** Lowercase base36 id. Uses getRandomValues because randomUUID needs a secure context. */
export function randomId(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (const byte of bytes) id += (byte % 36).toString(36);
  return id;
}

export function candidatePayload(candidate: RTCIceCandidate): CandidatePayload {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
}

export function closePeer(pc: RTCPeerConnection, channels: Channels): void {
  channels.state.onopen = channels.state.onclose = channels.state.onmessage = null;
  channels.input.onmessage = null;
  pc.onicecandidate = pc.onconnectionstatechange = null;
  channels.state.close();
  channels.input.close();
  pc.close();
}
