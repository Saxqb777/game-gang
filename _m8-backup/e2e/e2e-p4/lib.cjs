// Shared helpers for the P4 browser checks (ports 4300/4743).
const { chromium } = require('playwright');

const OUT = '/tmp/claude-0/e2e-p4';
const HTTP = 'http://localhost:4300';
const HTTPS = 'https://localhost:4743';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (ok, what) => {
  results.push({ ok: Boolean(ok), what });
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
async function poll(fn, timeoutMs, stepMs = 200) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
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

function watch(page, tag, errors, consoleErrors) {
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text().slice(0, 300)}`);
  });
}

async function openTv(browser, errors, consoleErrors) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await ctx.newPage();
  watch(tv, 'tv', errors, consoleErrors);
  await tv.goto(`${HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 60000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 30000 });
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  return { tv, code };
}

async function openPad(browser, code, tag, errors, consoleErrors, size = { width: 844, height: 390 }) {
  const ctx = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await ctx.newPage();
  watch(pad, tag, errors, consoleErrors);
  await pad.goto(`${HTTPS}/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 60000 });
  const cdp = await ctx.newCDPSession(pad);
  return { pad, ctx, cdp };
}

/** Debug overlay row for a driver: steer, gas, brake, hb, horn, kph. */
async function overlay(tv, name) {
  const text = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  const line = text.split('\n').find((l) => l.startsWith(name));
  if (!line) return null;
  const cols = line.slice(12).trim().split(/\s+/);
  return {
    line: line.replace(/\s+/g, ' '),
    steer: Number(cols[0]),
    gas: Number(cols[1]),
    brake: Number(cols[2]),
    hb: cols[3] === 'x',
    horn: cols[4] === 'x',
    kph: Number(cols[5]),
  };
}

/** Viewport i's HUD: gear chip shown, hint text, lap time text, fade opacity. */
async function hud(tv, i) {
  return tv.$$eval(
    '.sw-hud',
    (els, i) => {
      const el = els[i];
      if (!el) return null;
      const gear = el.querySelector('.sw-hud-gear');
      const hint = el.querySelector('.sw-hud-hint');
      return {
        gear: Boolean(gear && !gear.hidden),
        hint: hint && !hint.hidden ? hint.textContent : '',
        lapTime: el.querySelector('.sw-hud-laptime')?.textContent ?? '',
        fade: Number(getComputedStyle(el.querySelector('.sw-hud-fade')).opacity),
      };
    },
    i,
  );
}

const lapSeconds = (text) => {
  const m = /^(\d+):(\d+(?:\.\d+)?)/.exec(text || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

module.exports = { OUT, HTTP, HTTPS, sleep, log, check, poll, launch, openTv, openPad, overlay, hud, lapSeconds, results };
