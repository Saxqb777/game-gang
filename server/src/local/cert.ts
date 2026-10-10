import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generate } from 'selfsigned';

export interface DevCert {
  key: string;
  cert: string;
}

/**
 * Phones only allow the screen wake lock on secure pages, so the LAN server needs HTTPS.
 * A self-signed certificate is cached per LAN IP so the phone's "proceed anyway" choice keeps working.
 */
export async function loadDevCert(cacheDir: string, lanIp: string): Promise<DevCert> {
  const file = join(cacheDir, `dev-cert-${lanIp.replaceAll('.', '-')}.json`);
  try {
    const cached = JSON.parse(await readFile(file, 'utf8')) as Partial<DevCert>;
    if (typeof cached.key === 'string' && typeof cached.cert === 'string') {
      return { key: cached.key, cert: cached.cert };
    }
  } catch {
    // No cached certificate yet.
  }
  const pems = await generate([{ name: 'commonName', value: 'Gamer Gang (local)' }], {
    keyType: 'ec',
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: lanIp },
        ],
      },
    ],
  });
  const devCert = { key: pems.private, cert: pems.cert };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(devCert));
  return devCert;
}
