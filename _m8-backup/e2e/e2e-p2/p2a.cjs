// P2 acceptance 4a: Kestrel Pines loads, one pad on the debug autopilot laps the track twice with
// at most one respawn, no page errors. Screenshots: the grid, banked corners and other track views.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p2';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
const consoleErrors = [];
const check = (ok, what) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
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
const SMALL = { width: 320, height: 180 };
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  tv.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[tv] ${m.text().slice(0, 300)}`);
  });
  const big = async (path, settle = 2500) => {
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(settle);
    await tv.screenshot({ path });
    await tv.setViewportSize(SMALL);
  };
  await tv.goto('http://localhost:4100/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 15000 });
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  log('room', code);
  const subtitle = await tv.$eval('.game-card-subtitle', (el) => el.textContent);
  check(subtitle === 'Kestrel Pines', `TV game card subtitle is "${subtitle}"`);

  const padCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await padCtx.newPage();
  pad.on('pageerror', (e) => errors.push(`[pad] ${e.message}`));
  pad.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[pad] ${m.text().slice(0, 300)}`);
  });
  await pad.goto(`https://localhost:4543/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 30000 });
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  await tv.setViewportSize(SMALL);
  const loadStart = Date.now();
  await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log(`game loaded in ${((Date.now() - loadStart) / 1000).toFixed(0)} s`);
  check(Boolean(await tv.$('.sw-canvas')), '.sw-canvas exists and the loading overlay is gone');
  // The grid, during the countdown (enlarging slows the countdown; that is fine).
  await big(`${OUT}/p2a-grid.png`, 3000);

  await tv.keyboard.press('Backquote');
  await sleep(500);
  await tv.keyboard.press('KeyP');
  log('autopilot on');
  const debugText = () => tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  const sara = async () => {
    const line = (await debugText()).split('\n').find((l) => l.startsWith('Sara')) ?? '';
    const cols = line.trim().split(/\s+/);
    // driver steer gas brake hb horn km/h slip rtt P lap gate
    return { line, kph: Number(cols[6]), lap: Number(cols.at(-2)), gate: Number(cols.at(-1)) };
  };
  const fade = () => tv.$$eval('.sw-hud-fade', (els) => Number(getComputedStyle(els[0]).opacity)).catch(() => 0);

  // Views to capture, by the next gate the car is heading for (gates every ~186.6 m).
  const views = [
    { gate: 2, name: 'p2a-t1-millrace', note: 'T1 Millrace (left, R40, gravel and tyres outside)' },
    { gate: 5, name: 'p2a-ladder', note: 'the Ladder climb (5%)' },
    { gate: 7, name: 'p2a-brow', note: 'the Brow crest' },
    { gate: 10, name: 'p2a-kestrel-banked', note: 'the Kestrel, banked +0.10 rad' },
    { gate: 14, name: 'p2a-hollow-banked', note: 'the Hollow, banked -0.04 rad' },
    { gate: 17, name: 'p2a-switchback', note: 'the Switchback hairpin' },
  ];
  let respawns = 0;
  let fadedBefore = false;
  let maxKph = 0;
  let last = { lap: 0, gate: 0 };
  const started = Date.now();
  while (Date.now() - started < 50 * 60 * 1000) {
    await sleep(400);
    const f = await fade();
    if (f > 0.5 && !fadedBefore) {
      respawns++;
      log(`respawn #${respawns} at lap ${last.lap} gate ${last.gate}`);
      await tv.screenshot({ path: `${OUT}/p2a-respawn-${respawns}.png` }).catch(() => {});
    }
    fadedBefore = f > 0.5;
    const s = await sara();
    if (Number.isFinite(s.lap)) {
      if (s.lap !== last.lap || s.gate !== last.gate) log(`lap ${s.lap} gate ${s.gate} ${s.kph} km/h`);
      last = s;
      maxKph = Math.max(maxKph, s.kph || 0);
    }
    if (last.lap === 1) {
      const view = views.find((v) => v.gate === last.gate && !v.done);
      if (view) {
        view.done = true;
        await tv.keyboard.press('Backquote'); // hide the overlay for the picture
        await big(`${OUT}/${view.name}.png`);
        await tv.keyboard.press('Backquote');
        log(`screenshot ${view.name}: ${view.note}`);
      }
    }
    if (last.lap >= 3) break;
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  check(last.lap >= 3, `autopilot completed 2 laps (lap ${last.lap}) in ${minutes} min wall time`);
  check(respawns <= 1, `respawned ${respawns} time(s) in 2 laps (at most 1)`);
  check(maxKph > 150, `top speed on the overlay ${maxKph} km/h`);
  log('debug head:', (await debugText()).split('\n').slice(0, 4).join(' | '));
  await tv.keyboard.press('Backquote');
  await big(`${OUT}/p2a-lap3.png`);

  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
