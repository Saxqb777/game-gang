// Prints the debug overlay fps / draw calls / triangles for N keyboard players (default 1).
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const players = Number(process.argv[2] ?? 1);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => console.log('[tv] pageerror', e.message));
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await sleep(1000);
  for (let i = 0; i < players; i++) { await tv.keyboard.press('KeyK'); await sleep(200); }
  await tv.keyboard.press('Enter');
  await tv.waitForFunction(() => document.querySelector('.sw-canvas') && !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  await tv.keyboard.press('Backquote');
  for (let i = 0; i < 4; i++) {
    await sleep(5000);
    const text = await tv.$eval('.sw-debug', (e) => e.textContent);
    console.log(text.split('\n').slice(0, 2).join(' | '));
  }
  await tv.screenshot({ path: `/tmp/claude-0/e2e-p1/fps-${players}.png` });
  await browser.close();
})();
