const L = require('./lib.cjs');
const { sleep, log } = L;
(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser);
  const A = await L.openPad(browser, code, 'padA');
  await A.pad.fill('#pad-name', 'Sara');
  await A.pad.click('button.pad-btn--big');
  await A.pad.waitForSelector('.pad-ready', { timeout: 60000 });
  await tv.setViewportSize(L.SMALL);
  await A.pad.click('.pad-ready');
  log('loaded', await L.waitGameLoaded(tv));
  for (let i = 0; i < 6; i++) {
    await sleep(15000);
    const st = await tv.evaluate(() => ({ huds: document.querySelectorAll('.sw-hud').length, lap: [...document.querySelectorAll('.sw-hud-laptime')].map((e) => e.textContent), body: document.body.innerText.slice(0, 200) }));
    log(JSON.stringify(st));
  }
  await tv.setViewportSize(L.BIG);
  await sleep(3000);
  await tv.screenshot({ path: `${L.OUT}/dbg-tv.png` });
  await L.padShot(A.pad, 'dbg-pad');
  L.finish('dbg');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
