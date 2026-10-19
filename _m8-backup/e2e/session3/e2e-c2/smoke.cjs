// C2a smoke: the pad join screen shows the car thumbnails from assets/cars; the TV runs a race
// with ?bots=1 and K x4 (four different cars); no pageerror. Usage: node smoke.cjs 5100 5543
const L = require('./lib.cjs');
const { sleep, log, check } = L;
(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser, '?bots=1');
  log('room', code);
  const { pad } = await L.openPad(browser, code, 'pad');
  await sleep(4000);
  const thumbs = await pad.$$eval('img', (els) =>
    els.filter((e) => e.src.includes('/cars/')).map((e) => ({ src: e.src.replace(/^.*\/cars\//, '/cars/'), w: e.naturalWidth, h: e.naturalHeight })),
  );
  log('pad thumbnails', JSON.stringify(thumbs));
  check(1, thumbs.length > 0 && thumbs.every((t) => t.w === 512 && t.h === 288), 'pad car card shows a 512x288 thumbnail');
  await L.padShot(pad, 'pad-join');
  await pad.close();
  await tv.bringToFront();
  for (let i = 0; i < 4; i++) {
    await tv.keyboard.press('k');
    await sleep(800);
  }
  await L.tvShot(tv, 'lobby', 1500);
  await tv.keyboard.press('Enter');
  const loadS = await L.waitGameLoaded(tv, 400000);
  log(`TV game loaded in ${loadS} s`);
  await tv.setViewportSize(L.SMALL);
  const green = await L.waitGreen(tv, 400000);
  check(1, green, 'race started: lap clocks running in every viewport');
  await sleep(8000);
  await L.tvShot(tv, 'race', 4000);
  L.finish('c2-smoke');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
