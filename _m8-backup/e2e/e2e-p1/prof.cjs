const { chromium } = require('playwright');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tv = await ctx.newPage();
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await sleep(1000);
  const cdp = await ctx.newCDPSession(tv);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await tv.keyboard.press('KeyK'); await sleep(300);
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await tv.keyboard.press('Enter');
  await tv.waitForFunction(() => document.querySelector('.sw-canvas') && !document.querySelector('.sw-loading'), null, { timeout: 120000 });
  console.log('loaded after', Date.now() - t0);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const counts = new Map();
  for (const s of profile.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [id, c] of counts) {
    const n = byId.get(id);
    const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + c);
  }
  const total = profile.samples.length;
  console.log('samples', total);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(((v / total) * 100).toFixed(1) + '%', k);
  await browser.close();
})();
