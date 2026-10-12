// P2 pre-handoff smoke: TV loads Kestrel Pines, a pad joins, the pad car drives, a keyboard
// player's car respawns with Q, no pageerror. Ports 4100/4543.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p2';
const errors = [];
const consoleErrors = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
async function poll(fn, timeoutMs, stepMs = 250) {
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
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await tvCtx.newPage();
  const big = async (path) => {
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(4000);
    await tv.screenshot({ path, timeout: 120000 });
    await tv.setViewportSize({ width: 320, height: 180 });
  };
  tv.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[tv] ${m.text().slice(0, 300)}`);
  });
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  await tv.goto('http://localhost:4100/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 60000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 30000 });
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  console.log('room', code);
  const subtitle = await tv.$eval('.game-card-subtitle', (el) => el.textContent);
  check(subtitle === 'Kestrel Pines', `TV game card subtitle is "${subtitle}"`);

  const padCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await padCtx.newPage();
  pad.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[pad] ${m.text().slice(0, 300)}`);
  });
  pad.on('pageerror', (e) => errors.push(`[pad] ${e.message}`));
  await pad.goto(`https://localhost:4543/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 60000 });
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready', { timeout: 30000 });
  check(true, 'pad joined the room');

  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 2, null, { timeout: 15000 });
  await tv.keyboard.press('Enter');
  await sleep(300);
  await tv.setViewportSize({ width: 320, height: 180 });
  await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  check(true, 'TV loading overlay gone, .sw-canvas present');
  await pad.waitForSelector('.ctl', { timeout: 30000 });

  const racing = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  check(racing, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(600);

  const gas = await pad.$('[data-zone="gas"]');
  const box = await gas.boundingBox();
  const cdp = await padCtx.newCDPSession(pad);
  const gx = box.x + box.width / 2;
  const gy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx, y: gy, id: 1 }] });
  let maxGas = 0;
  let maxKph = 0;
  let saraLine = '';
  const holdStart = Date.now();
  while (Date.now() - holdStart < 4000 || (Date.now() - holdStart < 20000 && !(maxGas === 1 && maxKph > 5))) {
    await sleep(300);
    const text = await tv.$eval('.sw-debug', (e) => e.textContent);
    saraLine = text.split('\n').find((l) => l.startsWith('Sara')) ?? '';
    const cols = saraLine.trim().split(/\s+/);
    if (cols.length >= 7) {
      maxGas = Math.max(maxGas, Number(cols[2]) || 0);
      maxKph = Math.max(maxKph, Number(cols[6]) || 0);
    }
  }
  await pad.screenshot({ path: `${OUT}/p2smoke-pad-gas.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('debug line:', saraLine);
  check(maxGas === 1 && maxKph > 5, `pad car drives: gas ${maxGas.toFixed(2)}, up to ${maxKph} km/h`);
  await tv.keyboard.press('Backquote');
  await big(`${OUT}/p2smoke-tv-race.png`);

  const fadeOf = (i) => tv.$$eval('.sw-hud-fade', (els, i) => Number(getComputedStyle(els[i]).opacity), i);
  await tv.keyboard.press('KeyQ');
  const faded = await poll(async () => (await fadeOf(1)) > 0.5, 20000, 50);
  check(faded, 'Q fades the keyboard player car out');
  const back = await poll(async () => (await fadeOf(1)) === 0, 30000, 100);
  check(back, 'the car respawned and faded back in');
  await sleep(1500);
  await big(`${OUT}/p2smoke-tv-after-reset.png`);

  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) console.log('  ', e);
  console.log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) console.log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
