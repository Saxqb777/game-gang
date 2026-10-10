// P3 acceptance 3e: a connected pad shows no countdown overlay until the TV loading overlay is
// gone; a 3-player game shows the overview cell; the podium renders. Debug key N skips gates so the
// race finishes in minutes. No page errors.
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
  await tv.goto('http://localhost:4200/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  log('room', code);
  const padCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await padCtx.newPage();
  pad.on('pageerror', (e) => errors.push(`[pad] ${e.message}`));
  pad.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[pad] ${m.text().slice(0, 300)}`);
  });
  await pad.goto(`https://localhost:4643/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 30000 });
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  await tv.keyboard.press('KeyK');
  await sleep(300);
  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 3, null, { timeout: 10000 });
  await tv.keyboard.press('Enter');
  await tv.setViewportSize(SMALL);
  await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });

  // While the TV shows its loading overlay, the pad must not count down.
  let countdownDuringLoading = 0;
  let loadingPolls = 0;
  for (;;) {
    const loading = await tv.$('.sw-loading');
    if (!loading) break;
    loadingPolls++;
    if (await pad.$('.ctl-countdown')) countdownDuringLoading++;
    if (loadingPolls === 3) await pad.screenshot({ path: `${OUT}/p3e-pad-during-loading.png` });
    await sleep(500);
    if (loadingPolls > 400) break;
  }
  log(`TV loading overlay gone after ${loadingPolls} polls`);
  check(loadingPolls > 2 && countdownDuringLoading === 0, `pad showed no countdown during ${loadingPolls} loading polls (${countdownDuringLoading} with a countdown)`);
  const padCountdown = await poll(async () => Boolean(await pad.$('.ctl-countdown')), 60000, 200);
  check(padCountdown, 'pad shows the countdown once the race starts');
  await pad.screenshot({ path: `${OUT}/p3e-pad-countdown.png` });

  // 3 players: three chase views plus the overview cell.
  check((await tv.$$('.sw-hud')).length === 3, '3 player HUDs');
  const badge = await tv.$eval('.sw-overview-badge', (e) => !e.hidden && getComputedStyle(e).display !== 'none');
  check(badge, 'overview badge visible');
  await tv.setViewportSize(BIG);
  await tv.evaluate(() => {
    for (const sel of ['.sw-hud', '.tv-keys', '.tv-sound']) for (const el of document.querySelectorAll(sel)) el.style.visibility = 'hidden';
  });
  await sleep(10000);
  const overviewShot = `${OUT}/p3e-3players-overview.png`;
  await tv.screenshot({ path: overviewShot });
  await tv.evaluate(() => {
    for (const sel of ['.sw-hud', '.tv-keys', '.tv-sound']) for (const el of document.querySelectorAll(sel)) el.style.visibility = '';
  });
  try {
    log(execFileSync('python3', ['-I', `${OUT}/tiles.py`, overviewShot, '3'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | '));
    check(true, '3 player views + overview cell render with clean seams');
  } catch (e) {
    log(String(e.stdout));
    check(false, '3 player views + overview cell render with clean seams');
  }
  await tv.setViewportSize(SMALL);

  // Finish the race fast: N moves every car to its next gate (debug overlay open).
  await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  log('race green; skipping gates');
  await tv.keyboard.press('Backquote');
  const started = Date.now();
  const finished = await poll(async () => {
    if (await tv.$('.sw-results')) return true;
    await tv.keyboard.press('KeyN');
    return false;
  }, 900000, 1500);
  check(finished, `race finished and results showed after ${((Date.now() - started) / 1000).toFixed(0)} s of gate skipping`);
  await tv.keyboard.press('Backquote');
  await tv.setViewportSize(BIG);
  await tv.evaluate(() => {
    const results = document.querySelector('.sw-results');
    if (results) results.style.visibility = 'hidden';
  });
  await sleep(12000);
  const podiumShot = `${OUT}/p3e-podium.png`;
  await tv.screenshot({ path: podiumShot });
  try {
    log(execFileSync('python3', ['-I', `${OUT}/tiles.py`, podiumShot, '1'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | '));
    check(true, 'podium renders full screen');
  } catch (e) {
    log(String(e.stdout));
    check(false, 'podium renders full screen');
  }
  await tv.evaluate(() => {
    const results = document.querySelector('.sw-results');
    if (results) results.style.visibility = '';
  });
  await sleep(1000);
  await tv.screenshot({ path: `${OUT}/p3e-results.png` });
  await pad.waitForSelector('.pad-results', { timeout: 60000 });
  check(true, 'pad shows results');
  await tv.keyboard.press('Escape');
  await tv.waitForSelector('.lobby', { timeout: 20000 });
  check(true, 'Esc returns to the lobby');

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
