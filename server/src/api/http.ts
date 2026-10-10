import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 32 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.length;
    if (size > maxBytes) throw new HttpError(413, 'Body too large');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

/** Origin the request was made to, honouring the proxy headers Vercel sets. */
export function requestOrigin(req: IncomingMessage): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ??
    ('encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${host ?? 'localhost'}`;
}
