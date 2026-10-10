// P3 acceptance 3a/3b/3f (+ draw-call budget): 2 keyboard players + 2 bots (?bots=1), 4 viewports.
// Tile screenshots (auto, R pinned at scale 1, and scale < 1), late program compiles after GO and
// after the first scale drop, no page errors or WebGL errors.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p3';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
const consoleErrors = [];
const check = (ok, what) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
async function poll(fn, timeoutMs, stepMs = 500) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(stepMs);
  }
}
const SMALL = { width: 480, height: 270 };
const BIG = { width: 1280, height: 720 };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: BIG })).newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  tv.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' || /GL_INVALID|WebGL: /i.test(text)) consoleErrors.push(`[tv ${m.type()}] ${text.slice(0, 300)}`);
  });
  await tv.goto('http://localhost:4200/tv?bots=1');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const keys = await tv.$eval('.tv-keys', (el) => el.textContent);
  check(/bots/.test(keys), `lobby key bar shows the bot hint: "${keys.trim()}"`);
  for (let i = 0; i < 4; i++) {
    await tv.keyboard.press('KeyK');
    await sleep(300);
  }
  const slots = await tv.$$eval('.slot:not(.slot--empty)', (els) => els.map((e) => e.textContent.trim()));
  check(slots.length === 4, `K x4 adds 4 local players: ${JSON.stringify(slots)}`);
  await tv.keyboard.press('Enter');
  await tv.setViewportSize(SMALL);
  const loadStart = Date.now();
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log(`game running after ${((Date.now() - loadStart) / 1000).toFixed(0)} s`);
  check((await tv.$$('.sw-hud')).length === 4, '4 viewports');
  await tv.keyboard.press('Backquote');
  const overlay = async () => (await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '')) || '';
  const head = async () => (await overlay()).split('\n').slice(0, 5).join(' | ');
  await sleep(2000);
  const grid = await overlay();
  log('grid overlay:', grid.split('\n').slice(0, 5).join(' | '));
  const draws = Number(/draws (\d+)/.exec(grid)?.[1]);
  check(draws > 0 && draws <= 509 + 16, `draw calls at 4 viewports on the grid ${draws} <= baseline 509 + 16`);
  check(/preset LOW/.test(grid), 'preset LOW for 4 players');

  const hideUi = async (hidden) => {
    await tv.evaluate((h) => {
      for (const sel of ['.sw-hud-layer', '.tv-keys', '.sw-debug', '.tv-sound']) {
        const el = document.querySelector(sel);
        if (el) el.style.visibility = h ? 'hidden' : '';
      }
    }, hidden);
  };
  const shoot = async (name) => {
    await tv.setViewportSize(BIG);
    await hideUi(true);
    await sleep(5000);
    const path = `${OUT}/${name}.png`;
    await tv.screenshot({ path });
    await hideUi(false);
    await tv.setViewportSize(SMALL);
    try {
      log(execFileSync('python3', ['-I', `${OUT}/tiles.py`, path, '4'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | '));
      check(true, `tiles OK in ${name}.png`);
    } catch (e) {
      log(String(e.stdout).trim().replace(/\n/g, ' | '));
      check(false, `tiles OK in ${name}.png`);
    }
    return path;
  };
  await shoot('p3a-tiles-grid');

  // GO: the lap clocks start moving.
  const racing = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  check(racing, 'race went green');
  const goAt = Date.now();
  await tv.keyboard.press('KeyP');
  await sleep(10000);
  const afterGo = await overlay();
  log('10 s after GO:', afterGo.split('\n').slice(0, 5).join(' | '));
  check(/late 0\)/.test(afterGo), `late 0 programs 10 s after GO (${/programs \d+ \(late \d+\)/.exec(afterGo)?.[0]})`);

  // R pins the scale at 1.
  await tv.keyboard.press('KeyR');
  await sleep(1500);
  const pinned = await poll(async () => /scale 1\.00 \(fixed/.test(await overlay()), 20000);
  check(pinned, `R pins scale 1.00: ${(await head()).split(' | ')[2]}`);
  await shoot('p3a-tiles-pinned');
  await tv.keyboard.press('KeyR');
  // SwiftShader misses every frame, so the fallback controller drops the scale on its own.
  const dropped = await poll(async () => {
    const m = /scale (\d\.\d\d) \(auto/.exec(await overlay());
    return m && Number(m[1]) < 1 ? m[1] : null;
  }, 120000);
  check(Boolean(dropped), `scale dropped below 1 on its own (${dropped})`);
  await sleep(10000);
  const afterDrop = await overlay();
  log('10 s after the drop:', afterDrop.split('\n').slice(0, 5).join(' | '));
  check(/late 0\)/.test(afterDrop), `still late 0 10 s after the first scale drop (${/programs \d+ \(late \d+\)/.exec(afterDrop)?.[0]})`);
  check(/sharpen on/.test(afterDrop), 'sharpening on while upscaling');
  await shoot('p3a-tiles-scaled');
  const final = await overlay();
  log('final overlay:', final.split('\n').slice(0, 5).join(' | '));
  log(`race time since GO ${(Date.now() - goAt) / 1000} s wall`);

  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  check(consoleErrors.length === 0, `no console or WebGL errors (${consoleErrors.length})`);
  for (const e of consoleErrors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
