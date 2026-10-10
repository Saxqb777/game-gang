// P3 smoke: the TV loads, cars drive (soak autopilot), no page errors; and leaving the page during
// a soak sends the unposted window sample by sendBeacon (pagehide).
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
const check = (ok, what) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
async function poll(fn, timeoutMs, stepMs = 1000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(stepMs);
  }
}
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const beacons = [];
  ctx.on('request', (request) => {
    if (!request.url().endsWith('/api/telemetry')) return;
    const body = request.postData() ?? '';
    const scenarios = (() => {
      try {
        return JSON.parse(body).samples.map((s) => s.scenario);
      } catch {
        return [];
      }
    })();
    beacons.push({ type: request.resourceType(), scenarios });
    log(`telemetry request (${request.resourceType()}): ${JSON.stringify(scenarios)}`);
  });
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  await tv.goto('http://localhost:4200/tv?bench=soak&bots=1');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  for (let i = 0; i < 4; i++) {
    await tv.keyboard.press('KeyK');
    await sleep(300);
  }
  await tv.keyboard.press('Enter');
  await tv.setViewportSize({ width: 320, height: 180 });
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log('TV loaded');
  const go = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  check(go, 'race went green');
  const goAt = Date.now();
  await tv.keyboard.press('Backquote');
  const moving = await poll(async () => {
    const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
    const kph = dbg.split('\n').filter((l) => /^(Keys|Bot)/.test(l)).map((l) => Number(l.trim().split(/\s+/).at(-6)));
    return kph.length === 4 && kph.every((k) => k > 5) ? kph : null;
  }, 60000);
  check(Boolean(moving), `all four cars drive under the soak autopilot (km/h ${JSON.stringify(moving)})`);
  // The first 60 s window closes on the wall clock; it is posted only every 5 minutes.
  await sleep(Math.max(0, 66000 - (Date.now() - goAt)));
  const before = beacons.length;
  await tv.goto('about:blank');
  await sleep(4000);
  const sent = beacons.slice(before);
  check(sent.some((b) => b.scenarios.includes('soak-01')), `pagehide sent the pending soak window (${JSON.stringify(sent)})`);
  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
