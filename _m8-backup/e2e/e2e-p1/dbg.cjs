const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('console', (m) => console.log('[tv]', m.type(), m.text().slice(0, 300)));
  tv.on('pageerror', (e) => console.log('[tv] pageerror', e.message));
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await sleep(1000);
  await tv.keyboard.press('KeyK'); await sleep(300); await tv.keyboard.press('Enter');
  await sleep(8000);
  console.log(await tv.evaluate(() => document.body.innerText.slice(0, 500)));
  console.log('canvas', await tv.$$eval('.sw-canvas', (els) => els.map((e) => [e.width, e.height, e.clientWidth, e.clientHeight])));
  await tv.screenshot({ path: '/tmp/claude-0/e2e-p1/dbg.png' });
  await browser.close();
})();
