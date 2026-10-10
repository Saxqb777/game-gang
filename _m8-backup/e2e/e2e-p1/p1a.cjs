// P1 acceptance 3: one pad plus one keyboard player. Lobby has no mode chips/radios, the steering
// picker shows only Buttons, gas drives the car, Q resets the keyboard player's car, no page errors.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p1';
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
  // SwiftShader is fill-rate bound: below ~2 fps the TV drops pad input as stale (600 ms), so the
  // race runs at 480x270 and the TV is enlarged only for screenshots.
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const big = async (path) => {
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(2500);
    await tv.screenshot({ path });
    await tv.setViewportSize({ width: 480, height: 270 });
  };
  const tv = await tvCtx.newPage();
  tv.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[tv] ${m.text().slice(0, 300)}`);
  });
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 15000 });
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  console.log('room', code);
  check((await tv.$$('.game-modes')).length === 0, 'TV lobby has no mode chips');
  const subtitle = await tv.$eval('.game-card-subtitle', (el) => el.textContent);
  check(subtitle === 'Kestrel Pines', `TV game card subtitle is "${subtitle}"`);
  const lobbyKeys = await tv.$eval('.tv-keys', (el) => el.textContent);
  check(!/mode/i.test(lobbyKeys), `TV lobby key bar has no mode key: "${lobbyKeys.trim()}"`);

  const padCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await padCtx.newPage();
  pad.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[pad] ${m.text().slice(0, 300)}`);
  });
  pad.on('pageerror', (e) => errors.push(`[pad] ${e.message}`));
  await pad.goto(`https://localhost:4443/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 30000 });
  const modes = await pad.$$eval('button.pad-mode', (els) => els.map((e) => e.querySelector('strong').textContent));
  check(modes.length === 1 && modes[0] === 'Buttons', `steering picker shows only ${JSON.stringify(modes)}`);
  await pad.fill('#pad-name', 'Sara');
  await pad.screenshot({ path: `${OUT}/p1a-pad-join.png` });
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  check((await pad.$$('[aria-label="Mode"], .pad-game-card .pad-modes')).length === 0, 'pad lobby has no mode radios');
  await pad.screenshot({ path: `${OUT}/p1a-pad-lobby.png` });

  // Keyboard player (key set 0: WASD, Q resets), ready on the TV, then the pad readies up.
  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 2, null, { timeout: 10000 });
  await tv.keyboard.press('Enter');
  await sleep(300);
  await tv.screenshot({ path: `${OUT}/p1a-tv-lobby.png` });
  await tv.setViewportSize({ width: 480, height: 270 });
  await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  console.log('game running on TV');
  await pad.waitForSelector('.ctl', { timeout: 15000 });
  check((await pad.$$('.ctl-item, .ctl-wheel, .ctl-enable')).length === 0, 'pad controller has no item, wheel or tilt overlay');
  const gameKeys = await tv.$eval('.tv-keys', (el) => el.textContent);
  check(/Q\s*reset/.test(gameKeys), `in-game key bar shows the reset hint: "${gameKeys.trim()}"`);

  // Wait for GO: the lap clock of the first viewport starts moving.
  const racing = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    90000,
  );
  check(racing, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(600);

  // Hold gas on the pad for 3 s (CDP touch, like a thumb).
  const gas = await pad.$('[data-zone="gas"]');
  const box = await gas.boundingBox();
  const cdp = await padCtx.newCDPSession(pad);
  const gx = box.x + box.width / 2;
  const gy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx, y: gy, id: 1 }] });
  // Sample the overlay while the gas is held (at SwiftShader frame rates a single frame can miss
  // a pad packet, so look at the whole 3 s).
  let maxGas = 0;
  let maxKph = 0;
  let saraLine = '';
  let head = '';
  // At least 3 s; up to 10 s when the machine is busy (SwiftShader at 1 fps).
  const holdStart = Date.now();
  while (Date.now() - holdStart < 3000 || (Date.now() - holdStart < 10000 && !(maxGas === 1 && maxKph > 0))) {
    await sleep(250);
    const text = await tv.$eval('.sw-debug', (e) => e.textContent);
    head = text.split('\n')[0];
    saraLine = text.split('\n').find((l) => l.startsWith('Sara')) ?? '';
    const cols = saraLine.trim().split(/\s+/);
    if (cols.length >= 7) {
      maxGas = Math.max(maxGas, Number(cols[2]) || 0);
      maxKph = Math.max(maxKph, Number(cols[6]) || 0);
    }
  }
  await pad.screenshot({ path: `${OUT}/p1a-pad-gas.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('debug line:', saraLine);
  console.log('debug head:', head);
  check(maxGas === 1 && maxKph > 0, `overlay shows gas ${maxGas.toFixed(2)} and up to ${maxKph} km/h`);
  await tv.keyboard.press('Backquote');
  await big(`${OUT}/p1a-tv-race.png`);

  // Reset the keyboard player's car with Q: its viewport fades out, then back in.
  const fadeOf = (i) => tv.$$eval('.sw-hud-fade', (els, i) => Number(getComputedStyle(els[i]).opacity), i);
  check((await fadeOf(1)) === 0, 'keyboard viewport not faded before Q');
  await tv.keyboard.press('KeyQ');
  const faded = await poll(async () => (await fadeOf(1)) > 0.5, 10000, 50);
  check(faded, 'Q fades the keyboard player car out');
  await tv.screenshot({ path: `${OUT}/p1a-tv-reset.png` });
  const back = await poll(async () => (await fadeOf(1)) === 0, 15000, 100);
  check(back, 'the car respawned and faded back in');
  check((await fadeOf(0)) === 0, 'the pad player was not reset');
  // A second Q straight away is inside the 3 s cooldown.
  await tv.keyboard.press('KeyQ');
  await sleep(600);
  check((await fadeOf(1)) === 0, 'a second Q inside the cooldown does nothing');
  await sleep(1500);
  await big(`${OUT}/p1a-tv-after.png`);

  await tv.keyboard.press('Escape');
  await tv.waitForSelector('.lobby', { timeout: 10000 });
  await pad.waitForSelector('.pad-ready', { timeout: 10000 });
  console.log('Esc returned both to lobby');
  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) console.log('  ', e);
  console.log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) console.log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
