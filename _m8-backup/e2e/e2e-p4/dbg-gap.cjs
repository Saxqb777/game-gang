const L = require('./lib.cjs');
const { sleep, log, poll, overlay, hud } = L;
const errors = [], ce = [];
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.__gaps = [];
    const orig = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function (...args) {
      const ch = orig.apply(this, args);
      if (args[0] === 'input') {
        let last = 0;
        ch.addEventListener('message', (e) => {
          const now = performance.now();
          const m = JSON.parse(e.data);
          if (last) window.__gaps.push([Math.round(now - last), m.brake, Math.round(now - m.t)]);
          last = now;
        });
      }
      return ch;
    };
    window.__frames = [];
    let lf = performance.now();
    const f = (now) => { window.__frames.push(Math.round(now - lf)); lf = now; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const tv = await ctx.newPage();
  await tv.goto('http://localhost:4300/tv');
  await tv.waitForSelector('.lobby-code');
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  const pctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  await pctx.addInitScript(() => {
    window.__sent = [];
    const orig = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function (...args) {
      const ch = orig.apply(this, args);
      if (args[0] === 'input') {
        const send = ch.send.bind(ch);
        ch.send = (d) => { window.__sent.push([Math.round(performance.now()), ch.readyState, ch.bufferedAmount]); return send(d); };
      }
      return ch;
    };
  });
  const pad = await pctx.newPage();
  await pad.goto(`https://localhost:4743/pad?room=${code}`);
  await pad.waitForSelector('#pad-name');
  const cdp = await pctx.newCDPSession(pad);
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  await tv.setViewportSize({ width: 320, height: 180 });
  await pad.click('.pad-ready');
  await tv.waitForFunction(() => !document.querySelector('.sw-loading') && document.querySelector('.sw-canvas'), null, { timeout: 150000 });
  await poll(() => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))), 120000);
  const b = await pad.$eval('[data-zone="brake"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tv.evaluate(() => { window.__gaps = []; window.__frames = []; });
  await pad.evaluate(() => { window.__sent = []; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 1 }] });
  await sleep(8000);
  const { gaps, frames } = await tv.evaluate(() => ({ gaps: window.__gaps, frames: window.__frames }));
  log('msgs', gaps.length, 'max gap', Math.max(...gaps.map((g) => g[0])), 'gaps>300:', JSON.stringify(gaps.filter((g) => g[0] > 300)));
  log('brakes', JSON.stringify(gaps.map((g) => g[1]).join('')));
  log('frames', frames.length, 'max', Math.max(...frames), JSON.stringify(frames.slice(0, 60)));
  const sent = await pad.evaluate(() => window.__sent);
  log('pad sent', sent.length, 'gaps', JSON.stringify(sent.slice(1).map((x, i) => x[0] - sent[i][0]).slice(0, 80)), 'buffered max', Math.max(...sent.map((x) => x[2])));
  await browser.close();
})();
