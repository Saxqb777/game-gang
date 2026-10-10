// P3 acceptance 3c (+ 3e: 1 player full screen): ?bench=auto completes 3 runs, logs
// [splitways-bench] with 3 samples, posts them (200). ?bench=matrix: 9 samples in two posts (8 + 1).
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
async function poll(fn, timeoutMs, stepMs = 1000) {
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
const MODES = process.argv.slice(2).length ? process.argv.slice(2) : ['auto', 'matrix'];

async function runBench(browser, mode) {
  const tv = await (await browser.newContext({ viewport: BIG })).newPage();
  const posts = [];
  let bench = null;
  tv.on('pageerror', (e) => errors.push(`[tv ${mode}] ${e.message}`));
  tv.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[splitways-bench]')) bench = JSON.parse(text.slice('[splitways-bench]'.length).trim());
    if (m.type() === 'error' || /GL_INVALID|WebGL: /i.test(text)) consoleErrors.push(`[tv ${mode} ${m.type()}] ${text.slice(0, 300)}`);
  });
  tv.on('response', async (response) => {
    if (!response.url().endsWith('/api/telemetry')) return;
    const body = JSON.parse(response.request().postData() ?? '{}');
    posts.push({ status: response.status(), samples: body.samples?.map((s) => s.scenario) ?? [], kind: body.samples?.[0]?.kind });
    log(`telemetry POST ${response.status()}: ${body.samples?.length} samples ${JSON.stringify(body.samples?.map((s) => s.scenario))} build ${body.build} timer ${body.device?.timerQuery} refresh ${body.device?.refreshHz} gpu ${body.device?.gpu}`);
  });
  await tv.goto(`http://localhost:4200/tv?bench=${mode}`);
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  await tv.keyboard.press('KeyK');
  await sleep(300);
  await tv.keyboard.press('Enter');
  await tv.setViewportSize(SMALL);
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log(`[${mode}] game loaded, benchmark running`);
  const started = Date.now();
  let lastPanel = '';
  let shot = false;
  const done = await poll(async () => {
    const panel = await tv.$eval('.sw-bench', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
    if (panel && panel.split('\n')[0] !== lastPanel) {
      lastPanel = panel.split('\n')[0];
      log(`[${mode}] panel: ${lastPanel}`);
    }
    if (!shot && /run 2\//.test(panel)) {
      // A mid-benchmark frame: two fly-through views.
      shot = true;
      await tv.setViewportSize(BIG);
      await sleep(6000);
      await tv.screenshot({ path: `${OUT}/p3c-${mode}-flythrough.png` });
      await tv.setViewportSize(SMALL);
    }
    return bench !== null;
  }, mode === 'matrix' ? 1_200_000 : 600_000, 2000);
  check(done, `[${mode}] benchmark finished in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (!done) return tv;
  const expected = mode === 'matrix' ? 9 : 3;
  check(bench.length === expected, `[${mode}] [splitways-bench] logged ${bench.length} samples: ${bench.map((s) => s.scenario).join(', ')}`);
  await sleep(4000);
  const flyPosts = posts.filter((p) => p.kind === 'flythrough');
  const sizes = flyPosts.map((p) => p.samples.length);
  check(
    mode === 'matrix' ? JSON.stringify(sizes) === '[8,1]' : JSON.stringify(sizes) === '[3]',
    `[${mode}] fly-through telemetry posts carry ${JSON.stringify(sizes)} samples`,
  );
  check(flyPosts.length > 0 && flyPosts.every((p) => p.status === 200), `[${mode}] fly-through posts answered ${flyPosts.map((p) => p.status).join(', ')}`);
  const loading = posts.filter((p) => p.kind === 'loading-benchmark');
  check(loading.length === 1 && loading[0].status === 200, `[${mode}] loading-benchmark sample posted (${loading.map((p) => p.status)})`);
  await tv.setViewportSize(BIG);
  await sleep(6000);
  const table = await tv.$eval('.sw-bench', (e) => e.textContent).catch(() => '');
  log(`[${mode}] results table:\n${table}`);
  await tv.screenshot({ path: `${OUT}/p3c-${mode}-results.png` });
  return tv;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const mode of MODES) {
    const tv = await runBench(browser, mode);
    if (mode === 'auto') {
      // 3e: back in the race, 1 player is full screen. Close the table with a key first.
      await tv.keyboard.press('KeyX');
      await tv.evaluate(() => {
        for (const sel of ['.sw-hud-layer', '.tv-keys', '.sw-debug', '.tv-sound']) {
          const el = document.querySelector(sel);
          if (el) el.style.visibility = 'hidden';
        }
      });
      await sleep(6000);
      const path = `${OUT}/p3e-1player.png`;
      await tv.screenshot({ path });
      try {
        log(execFileSync('python3', ['-I', `${OUT}/tiles.py`, path, '1'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | '));
        check(true, '1-player view fills the screen');
      } catch (e) {
        log(String(e.stdout));
        check(false, '1-player view fills the screen');
      }
    }
    await tv.context().close();
  }
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
