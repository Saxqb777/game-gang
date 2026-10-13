// Quick look: join screen landscape + portrait, lobby screens, TV lobby. node look.cjs 5300 5743
const L = require('./lib.cjs');
const { sleep, log } = L;
(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser);
  const A = await L.openPad(browser, code, 'padA');
  await A.pad.fill('#pad-name', 'Sara');
  await A.pad.click('button[aria-label="Next car"]');
  await A.pad.click('button[aria-label="Next car"]');
  await sleep(600);
  await L.padShot(A.pad, 'look-join-landscape');
  await A.pad.setViewportSize({ width: 390, height: 844 });
  await sleep(500);
  await L.padShot(A.pad, 'look-join-portrait');
  await A.pad.click('button.pad-btn--big');
  await A.pad.waitForSelector('.pad-ready', { timeout: 60000 });
  await sleep(500);
  await L.padShot(A.pad, 'look-lobby-portrait');
  await A.pad.setViewportSize(L.PAD_SIZE);
  await sleep(500);
  await L.padShot(A.pad, 'look-lobby-landscape');
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await sleep(1000);
  await tv.screenshot({ path: `${L.OUT}/look-tv.png` });
  L.finish('look');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
