// P3 baseline: draw calls at 4 viewports (4 pads) at the grid, before the P3 render changes.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p3';
const TAG = process.argv[2] || 'base';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  await tv.goto('http://localhost:4200/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  log('room', code);
  const names = ['Sara', 'Omar', 'Lina', 'Zed'];
  const pads = [];
  for (let i = 0; i < 4; i++) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
    const pad = await ctx.newPage();
    pad.on('pageerror', (e) => errors.push(`[pad${i}] ${e.message}`));
    await pad.goto(`https://localhost:4643/pad?room=${code}`);
    await pad.waitForSelector('#pad-name', { timeout: 30000 });
    await pad.fill('#pad-name', names[i]);
    await pad.click('button.pad-btn--big');
    await pad.waitForSelector('.pad-ready');
    pads.push(pad);
  }
  await tv.setViewportSize({ width: 320, height: 180 });
  for (const pad of pads) await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 180000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 180000 });
  log('game loaded');
  await tv.keyboard.press('Backquote');
  for (let k = 0; k < 6; k++) {
    await sleep(3000);
    const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
    log(dbg.split('\n').slice(0, 5).join(' | '));
  }
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(6000);
  const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  log('1280:', dbg.split('\n').slice(0, 5).join(' | '));
  await tv.screenshot({ path: `${OUT}/${TAG}-4pads.png` });
  log('errors', errors.length, errors.join('\n'));
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
