// P3 extra: devicePixelRatio 2 (a 4K Mac drives the canvas at DPR 1 and the browser upscales):
// the overlay reports dpr 2.00 and sharpening on; 2 keyboard players race on Medium with clean
// tiles; a car drives; no page errors.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p3';
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
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  await tv.goto('http://localhost:4200/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  await tv.keyboard.press('KeyK');
  await sleep(300);
  await tv.keyboard.press('KeyK');
  await sleep(300);
  await tv.keyboard.press('Enter');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 200000 });
  const canvas = await tv.$eval('.sw-canvas', (c) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }));
  check(canvas.w === canvas.cw && canvas.h === canvas.ch, `canvas buffer equals its CSS size at DPR 2 (${JSON.stringify(canvas)})`);
  await tv.keyboard.press('Backquote');
  // The overlay paints on the next rendered frame (slow under SwiftShader).
  const dbg = await poll(async () => (await tv.$eval('.sw-debug', (e) => e.textContent)) || null, 60000);
  log(dbg.split('\n').slice(0, 4).join(' | '));
  check(/dpr 2\.00/.test(dbg) && /sharpen on/.test(dbg), 'overlay: dpr 2.00, sharpen on');
  check(/preset (MEDIUM|LOW)/.test(dbg) && /viewports 2/.test(dbg), '2 viewports on Medium (or Low after a loading drop)');
  await tv.keyboard.press('Backquote');
  const green = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => /^\d+:\d\d\.\d/.test(e.textContent) && !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  check(green, 'race went green');
  // Drive the first car (WASD): hold W until the overlay shows speed (SwiftShader runs ~1 fps).
  await tv.keyboard.press('Backquote');
  await tv.keyboard.down('KeyW');
  const speedOf = async () => {
    const text = (await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '')) || '';
    const line = text.split('\n').find((l) => l.startsWith('Keys WASD')) ?? '';
    return Number(line.trim().split(/\s+/).at(-6)) || 0;
  };
  const kph = (await poll(async () => {
    const v = await speedOf();
    return v > 5 ? v : null;
  }, 90000)) ?? (await speedOf());
  await tv.keyboard.up('KeyW');
  check(kph > 5, `the WASD car drives (${kph} km/h)`);
  await tv.keyboard.press('Backquote');
  await tv.evaluate(() => {
    for (const sel of ['.sw-hud-layer', '.tv-keys', '.tv-sound']) {
      const el = document.querySelector(sel);
      if (el) el.style.visibility = 'hidden';
    }
  });
  await sleep(6000);
  const shot = `${OUT}/p3f-2players-dpr2.png`;
  await tv.screenshot({ path: shot });
  try {
    log(execFileSync('python3', ['-I', `${OUT}/tiles.py`, shot, '2', '6'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | '));
    check(true, '2 views at DPR 2 with clean seams');
  } catch (e) {
    log(String(e.stdout));
    check(false, '2 views at DPR 2 with clean seams');
  }
  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
