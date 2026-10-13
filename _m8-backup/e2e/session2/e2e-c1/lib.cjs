// Shared helpers for the M8 integration acceptance scripts (spec 2.9).
// Usage of every script: node <script>.cjs <httpPort> <httpsPort>   (final run: 4000 4443)
// Env: TAG=<prefix> for screenshots and logs (default "int").
const { chromium } = require('playwright');

const OUT = '/tmp/claude-0/e2e-c1';
const HTTP_PORT = Number(process.argv[2] ?? 4000);
const HTTPS_PORT = Number(process.argv[3] ?? 4443);
if (!Number.isInteger(HTTP_PORT) || !Number.isInteger(HTTPS_PORT)) {
  console.error('usage: node <script>.cjs <httpPort> <httpsPort>');
  process.exit(2);
}
const HTTP = `http://localhost:${HTTP_PORT}`;
const HTTPS = `https://localhost:${HTTPS_PORT}`;
const TAG = process.env.TAG || 'int';
const SMALL = { width: 320, height: 180 };
const BIG = { width: 1280, height: 720 };
const PAD_SIZE = { width: 844, height: 390 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const results = [];
const errors = [];
const consoleErrors = [];

/** One PASS/FAIL line. `item` is the 2.9 item number (or "KP" for Kestrel Pines-only facts). */
function check(item, ok, what) {
  results.push({ item, ok: Boolean(ok), what });
  log(`${ok ? 'PASS' : 'FAIL'} [2.9-${item}] ${what}`);
  if (!ok) process.exitCode = 1;
  return Boolean(ok);
}

async function poll(fn, timeoutMs, stepMs = 500) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    let value;
    try {
      value = await fn();
    } catch {
      value = null;
    }
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(stepMs);
  }
}

async function launch() {
  return chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

function watch(page, tag) {
  page.on('pageerror', (e) => {
    errors.push(`[${tag}] ${e.message}`);
    log(`[${tag}] pageerror ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text().slice(0, 300)}`);
  });
}

async function openTv(browser, query = '') {
  const ctx = await browser.newContext({ viewport: BIG });
  const tv = await ctx.newPage();
  watch(tv, 'tv');
  await tv.goto(`${HTTP}/tv${query}`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  await tv.waitForFunction(
    () => !document.querySelector('.lobby-code').textContent.includes('·'),
    null,
    { timeout: 60000 },
  );
  const code = (await tv.$eval('.lobby-code', (el) => el.textContent)).trim();
  return { tv, code };
}

async function openPad(browser, code, tag, size = PAD_SIZE) {
  const ctx = await browser.newContext({
    viewport: size,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const pad = await ctx.newPage();
  watch(pad, tag);
  await pad.goto(`${HTTPS}/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 90000 });
  const cdp = await ctx.newCDPSession(pad);
  return { pad, ctx, cdp };
}

/** Waits for the TV game to load (canvas attached, loading screen gone). Returns seconds taken. */
async function waitGameLoaded(tv, timeoutMs = 240000) {
  const t0 = Date.now();
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: timeoutMs });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, {
    timeout: timeoutMs,
  });
  return Math.round((Date.now() - t0) / 1000);
}

/** Every viewport's lap clock has started. */
function waitGreen(tv, timeoutMs = 300000) {
  return poll(
    () =>
      tv.$$eval(
        '.sw-hud-laptime',
        (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent)),
      ),
    timeoutMs,
    1000,
  );
}

/** Debug overlay (`) row for a driver: steer, gas, brake, hb, horn, kph, connected, place, lap, gate. */
async function overlay(tv, name) {
  const text = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  const line = text.split('\n').find((l) => l.startsWith(name.padEnd(12).slice(0, 12)));
  if (!line) return null;
  const cols = line.slice(12).trim().split(/\s+/);
  return {
    line: line.replace(/\s+/g, ' '),
    steer: Number(cols[0]),
    gas: Number(cols[1]),
    brake: Number(cols[2]),
    hb: cols[3] === 'x',
    kph: Number(cols[5]),
    connected: !/ lost /.test(line),
    lap: Number(cols.at(-2)),
    gate: Number(cols.at(-1)),
  };
}

/** Every viewport HUD in order: name, player colour, R chip, hint, lap clock, fade opacity. */
function huds(tv) {
  return tv.$$eval('.sw-hud', (els) =>
    els.map((el) => {
      const gear = el.querySelector('.sw-hud-gear');
      const hint = el.querySelector('.sw-hud-hint');
      return {
        name: el.querySelector('.sw-hud-name')?.textContent ?? '',
        colour: el.style.getPropertyValue('--player').trim(),
        gear: Boolean(gear && !gear.hidden),
        hint: hint && !hint.hidden ? hint.textContent : '',
        lapTime: el.querySelector('.sw-hud-laptime')?.textContent ?? '',
        fade: Number(getComputedStyle(el.querySelector('.sw-hud-fade')).opacity),
      };
    }),
  );
}

async function hudFor(tv, name) {
  const all = await huds(tv);
  const index = all.findIndex((h) => h.name === name);
  return index < 0 ? null : { index, ...all[index] };
}

async function rect(page, sel) {
  return page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
}

/** Screenshot of the TV at 1280x720, then back to the small race viewport. */
async function tvShot(tv, name, settleMs = 6000) {
  await tv.setViewportSize(BIG);
  await sleep(settleMs);
  const path = `${OUT}/${TAG}-${name}.png`;
  // The debug overlay stays on (P and N need it) but would cover viewport 1 in the picture.
  const hide = (v) =>
    tv.evaluate((v) => {
      const el = document.querySelector('.sw-debug');
      if (el) el.style.visibility = v;
    }, v);
  await hide('hidden').catch(() => null);
  await tv.screenshot({ path });
  await hide('').catch(() => null);
  await tv.setViewportSize(SMALL);
  log(`screenshot ${path}`);
  return path;
}

async function padShot(pad, name) {
  const path = `${OUT}/${TAG}-${name}.png`;
  await pad.screenshot({ path });
  log(`screenshot ${path}`);
  return path;
}

/** Same format as the game's formatTime (m:ss.cc). */
function formatTime(ms) {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

/** Item 7 check and the summary block. Call last. */
function finish(scriptName) {
  check(7, errors.length === 0, `${scriptName}: no pageerror on the TV or any pad (${errors.length})`);
  for (const e of errors) log('   pageerror', e);
  log(`console errors (informational): ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 20)) log('  ', e);
  const failed = results.filter((r) => !r.ok);
  log(`SUMMARY ${scriptName}: ${results.length - failed.length} PASS, ${failed.length} FAIL`);
  for (const f of failed) log(`  FAIL [2.9-${f.item}] ${f.what}`);
}

module.exports = {
  OUT,
  HTTP,
  HTTPS,
  TAG,
  SMALL,
  BIG,
  PAD_SIZE,
  sleep,
  log,
  check,
  poll,
  launch,
  watch,
  openTv,
  openPad,
  waitGameLoaded,
  waitGreen,
  overlay,
  huds,
  hudFor,
  rect,
  tvShot,
  padShot,
  formatTime,
  finish,
  results,
  errors,
  consoleErrors,
};
