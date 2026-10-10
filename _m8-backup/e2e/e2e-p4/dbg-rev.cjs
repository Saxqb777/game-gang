const L = require('./lib.cjs');
const { sleep, log, poll, overlay, hud } = L;
const errors = [], ce = [];
(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser, errors, ce);
  const { pad, cdp } = await L.openPad(browser, code, 'pad', errors, ce);
  await pad.fill('#pad-name', 'Sara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');
  await tv.setViewportSize({ width: 480, height: 270 });
  await pad.click('.pad-ready');
  await tv.waitForFunction(() => !document.querySelector('.sw-loading') && document.querySelector('.sw-canvas'), null, { timeout: 150000 });
  await poll(() => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))), 120000);
  await tv.keyboard.press('Backquote');
  await sleep(1000);
  for (const size of [{ width: 480, height: 270 }, { width: 320, height: 180 }]) {
    await tv.setViewportSize(size);
    await sleep(2000);
    const raf = await pad.evaluate(() => new Promise((res) => { let n = 0; let maxGap = 0; let last = performance.now(); const t0 = last; const f = (now) => { n++; maxGap = Math.max(maxGap, now - last); last = now; if (now - t0 < 5000) requestAnimationFrame(f); else res({ n, maxGap }); }; requestAnimationFrame(f); }));
    const fps = (await tv.$eval('.sw-debug', (e) => e.textContent)).split('\n')[0];
    log(JSON.stringify(size), 'pad rAF in 5 s', JSON.stringify(raf), fps);
  }
  const b = await pad.$eval('[data-zone="brake"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 1 }] });
  for (let i = 0; i < 40; i++) {
    const o = await overlay(tv, 'Sara');
    const h = await hud(tv, 0);
    const rev = await pad.$eval('.ctl-brake', (e) => e.dataset.reverse);
    const fps = (await tv.$eval('.sw-debug', (e) => e.textContent)).split('\n')[0];
    log(o && o.line, '| tvR', h.gear, '| pad', rev, '|', fps.slice(0, 40), h.lapTime);
    await sleep(500);
  }
  await browser.close();
})();
