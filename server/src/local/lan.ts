import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

function isPrivateIpv4(address: string): boolean {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

/** The Mac's address on the home wifi. Prefers en0 (the Wi-Fi interface on macOS). */
export function detectLanIp(): string {
  const interfaces = networkInterfaces();
  const candidates: { name: string; address: string }[] = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const info of addresses ?? []) {
      if (info.family === 'IPv4' && !info.internal) candidates.push({ name, address: info.address });
    }
  }
  const pick =
    candidates.find((c) => c.name === 'en0') ??
    candidates.find((c) => isPrivateIpv4(c.address)) ??
    candidates[0];
  return pick?.address ?? '127.0.0.1';
}

export async function terminalQr(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'terminal', small: true });
}
