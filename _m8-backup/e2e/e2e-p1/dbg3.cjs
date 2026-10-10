const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tvCtx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await tvCtx.addInitScript(() => {
    window.__inputs = [];
    const desc = Object.getOwnPropertyDescriptor(RTCDataChannel.prototype, 'onmessage');
    Object.defineProperty(RTCDataChannel.prototype, 'onmessage', {
      set(fn) {
        const label = this.label;
        desc.set.call(this, fn && ((e) => { if (label === 'input') window.__inputs.push([performance.now(), String(e.data).slice(0, 80)]); return fn(e); }));
      },
      get() { return desc.get.call(this); },
    });
  });
  const tv = await tvCtx.newPage();
  tv.on('pageerror', (e) => console.log('[tv] pageerror', e.message));
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  const padCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const pad = await padCtx.newPage();
  pad.on('console', (m) => console.log('[pad]', m.type(), m.text().slice(0, 200)));
  pad.on('pageerror', (e) => console.log('[pad] pageerror', e.message));
  await pad.goto(`https://localhost:4443/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 30000 });
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  await pad.click('.pad-ready');
  await tv.waitForFunction(() => document.querySelector('.sw-canvas') && !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  await pad.waitForSelector('.ctl', { timeout: 15000 });
  console.log('inputs so far', await tv.evaluate(() => [window.__inputs.length, window.__inputs.slice(-2)]));
  await tv.keyboard.press('Backquote');
  const gas = await pad.$('[data-zone="gas"]');
  const box = await gas.boundingBox();
  const cdp = await padCtx.newCDPSession(pad);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const dbg = await tv.$eval('.sw-debug', (e) => e.textContent);
    console.log(dbg.split('\n').filter((l) => /^(fps|Sara)/.test(l)).join(' | '));
    console.log('inputs', await tv.evaluate(() => [window.__inputs.length, performance.now(), window.__inputs.slice(-1)]));
  }
  await browser.close();
})();
