// Shared helpers for the P5 browser checks (ports 4400/4843).
const { chromium } = require('playwright');

const OUT = '/tmp/claude-0/e2e-p5';
const HTTP = 'http://localhost:4400';
const HTTPS = 'https://localhost:4843';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
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

async function launch() {
  return chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

/**
 * Test harness only (never in the repo): a virtual 60 Hz clock for SwiftShader. Every animation
 * frame reports exactly 1/60 s since the last one and the GPU timer is hidden, so the loading
 * benchmark keeps the player-count preset (SwiftShader would always drop one), physics advances
 * one step per rendered frame (slow motion in wall time, deterministic in race time), and the
 * overlay shows the preset's real draw calls and triangles.
 */
const VIRTUAL_CLOCK = () => {
  const realRaf = window.requestAnimationFrame.bind(window);
  let lastReal = -1;
  let virtual = 0;
  window.requestAnimationFrame = (cb) =>
    realRaf((t) => {
      if (t !== lastReal) {
        lastReal = t;
        virtual = virtual ? virtual + (window.__swFrameMs ?? 1000 / 60) : t;
      }
      cb(virtual);
    });
  const getExtension = WebGL2RenderingContext.prototype.getExtension;
  WebGL2RenderingContext.prototype.getExtension = function (name) {
    if (name === 'EXT_disjoint_timer_query_webgl2') return null;
    return getExtension.call(this, name);
  };
};

function watch(page, tag, errors, consoleErrors) {
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' || /GL_INVALID|WebGL: /i.test(text)) consoleErrors.push(`[${tag} ${m.type()}] ${text.slice(0, 300)}`);
  });
}

/** A TV with `keys` keyboard players (K each), started with Enter; resolves once loaded. */
async function startTv(browser, { query = '', keys = 1, virtual = true, size = { width: 1280, height: 720 }, small = { width: 320, height: 180 }, errors, consoleErrors }) {
  const ctx = await browser.newContext({ viewport: size });
  if (virtual) await ctx.addInitScript(VIRTUAL_CLOCK);
  const tv = await ctx.newPage();
  watch(tv, 'tv', errors, consoleErrors);
  await tv.goto(`${HTTP}/tv${query}`);
  await tv.waitForSelector('.lobby-code', { timeout: 60000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 30000 });
  for (let i = 0; i < keys; i++) {
    await tv.keyboard.press('KeyK');
    await sleep(300);
  }
  await tv.keyboard.press('Enter');
  if (small) await tv.setViewportSize(small);
  const started = Date.now();
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log(`TV loaded in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  return { tv, ctx };
}

/** Virtual clock speed: 5 physics steps per frame (fast) or 1 (for screenshots and the loading benchmark). */
async function fast(tv, on) {
  await tv.evaluate((ms) => {
    window.__swFrameMs = ms;
  }, on ? 5000 / 60 : 1000 / 60);
}

const debugText = (tv) => tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');

/** Overlay numbers: preset, draws, triangles (as text), viewports. */
async function overlay(tv) {
  let text = await debugText(tv);
  for (let i = 0; i < 80 && !/draws \d+/.test(text); i++) {
    await sleep(250);
    text = await debugText(tv);
  }
  const preset = /preset (\w+)/.exec(text)?.[1] ?? '?';
  const draws = Number(/draws (\d+)/.exec(text)?.[1] ?? NaN);
  const tris = /tris ([\d.]+[kM]?)/.exec(text)?.[1] ?? '?';
  const viewports = Number(/viewports (\d+)/.exec(text)?.[1] ?? NaN);
  const programs = /programs (\d+) \(late (\d+)\)/.exec(text);
  return { preset, draws, tris, viewports, programs: programs?.[1], late: programs?.[2], text };
}

/** Lap clock on the first HUD (seconds). */
async function lapSeconds(tv, index = 0) {
  const text = await tv.$$eval('.sw-hud-laptime', (els, i) => els[i]?.textContent ?? '', index).catch(() => '');
  const m = /(\d+):(\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

async function lapNumber(tv, index = 0) {
  const text = await tv.$$eval('.sw-hud-lap', (els, i) => els[i]?.textContent ?? '', index).catch(() => '');
  const m = /(\d+)\//.exec(text);
  return m ? Number(m[1]) : NaN;
}

const HIDE = ['.sw-hud', '.tv-keys', '.tv-sound', '.sw-debug', '.sw-overview-badge', '.sw-bench'];
async function chrome(tv, visible) {
  await tv.evaluate(
    ({ sels, visible }) => {
      for (const sel of sels) for (const el of document.querySelectorAll(sel)) el.style.visibility = visible ? '' : 'hidden';
    },
    { sels: HIDE, visible },
  );
}

/** Enlarges, waits for `frames` rendered frames (by the overlay-free lap clock or a sleep), shoots, shrinks back. */
async function shot(tv, path, { size = { width: 1920, height: 1080 }, small = { width: 320, height: 180 }, settle = 4000, hud = false } = {}) {
  await tv.setViewportSize(size);
  if (!hud) await chrome(tv, false);
  await sleep(settle);
  await tv.screenshot({ path, timeout: 300000 });
  if (!hud) await chrome(tv, true);
  if (small) await tv.setViewportSize(small);
  log(`screenshot ${path}`);
}

module.exports = { fast, OUT, HTTP, HTTPS, sleep, log, check, poll, launch, startTv, watch, overlay, debugText, lapSeconds, lapNumber, chrome, shot, VIRTUAL_CLOCK };
