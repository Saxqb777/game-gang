// P3 acceptance 3d: ?bench=soak&bots=1 with 4 players, shortened by a local uncommitted edit
// (BENCH.soakMinutes 2, soakWindowSeconds 20): window samples and the SOAK DONE summary appear,
// telemetry posts succeed.
const { chromium } = require('playwright');
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
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const posts = [];
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  tv.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' || /GL_INVALID|WebGL: /i.test(text)) consoleErrors.push(`[tv ${m.type()}] ${text.slice(0, 300)}`);
  });
  tv.on('response', (response) => {
    if (!response.url().endsWith('/api/telemetry')) return;
    const body = JSON.parse(response.request().postData() ?? '{}');
    const scenarios = body.samples?.map((s) => s.scenario) ?? [];
    posts.push({ status: response.status(), scenarios });
    log(`telemetry POST ${response.status()}: ${JSON.stringify(scenarios)}`);
  });
  await tv.goto('http://localhost:4200/tv?bench=soak&bots=1');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  for (let i = 0; i < 4; i++) {
    await tv.keyboard.press('KeyK');
    await sleep(300);
  }
  await tv.keyboard.press('Enter');
  await tv.setViewportSize({ width: 320, height: 180 });
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log('soak race loaded');
  const laps = await tv.$eval('.sw-hud-lap', (e) => e.textContent).catch(() => '');
  check(/\/\s*99/.test(laps), `soak race has 99 laps ("${laps}")`);
  const done = await poll(async () => {
    const panel = await tv.$eval('.sw-bench', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
    return /SOAK DONE/.test(panel) ? panel : null;
  }, 900_000, 2000);
  check(Boolean(done), 'SOAK DONE summary appeared');
  log(`summary:\n${done}`);
  await sleep(3000);
  const scenarios = posts.flatMap((p) => p.scenarios);
  check(scenarios.filter((s) => /^soak-\d\d$/.test(s)).length >= 5, `window samples posted: ${scenarios.join(', ')}`);
  check(scenarios.includes('soak-total'), 'soak-total posted');
  check(posts.length > 0 && posts.every((p) => p.status === 200), `all telemetry posts 200 (${posts.map((p) => p.status).join(', ')})`);
  check(!scenarios.includes('race'), 'no race sample in soak mode');
  // The cars really drove (autopilot) during the soak.
  await tv.keyboard.press('Backquote');
  await sleep(2000);
  const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  log(dbg.split('\n').slice(0, 12).join('\n'));
  check(/AUTOPILOT ON/.test(dbg), 'autopilot on in soak mode');
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(10000);
  await tv.screenshot({ path: `${OUT}/p3d-soak-done.png` });
  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  check(consoleErrors.length === 0, `no console or WebGL errors (${consoleErrors.length})`);
  for (const e of consoleErrors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
