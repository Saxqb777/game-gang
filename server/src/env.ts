import type { IceServer } from '@gamergang/shared';

/** Server-side configuration. Never bundled into the client: the client gets ICE servers from the API. */
export interface ServerEnv {
  databaseUrl: string | undefined;
  iceServers: IceServer[];
  /** Overrides the public origin used in pad links (e.g. a custom domain). */
  publicUrl: string | undefined;
}

const GOOGLE_STUN: IceServer = {
  urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const iceServers: IceServer[] = [GOOGLE_STUN];
  const turnUrl = nonEmpty(source.TURN_URL);
  if (turnUrl) {
    const username = nonEmpty(source.TURN_USER);
    const credential = nonEmpty(source.TURN_PASS);
    iceServers.push({
      // Comma separated so turn: and turns: variants of one provider can be listed together.
      urls: turnUrl.split(',').map((url) => url.trim()),
      ...(username ? { username } : {}),
      ...(credential ? { credential } : {}),
    });
  }
  return {
    databaseUrl: nonEmpty(source.DATABASE_URL),
    iceServers,
    publicUrl: nonEmpty(source.PUBLIC_URL)?.replace(/\/+$/, ''),
  };
}
