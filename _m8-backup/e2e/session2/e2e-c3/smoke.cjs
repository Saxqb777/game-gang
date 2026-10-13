// C3 post-merge smoke: /tv?bots=1, K x4, Enter, debug P; the four different cars drive on the
// autopilot (speeds rise, gates advance), no pageerror. Usage: node smoke.cjs 5200 5643
const L = require('./lib.cjs');
const { sleep, log, check } = L;
const VIRTUAL_CLOCK = () => {
  const realRaf = window.requestAnimationFrame.bind(window);
  let lastReal = -1;
  let virtual = 0;
  window.requestAnimationFrame = (cb) =>
    realRaf((t) => {
      if (t !== lastReal) {
        lastReal = t;
        virtual = virtual ? virtual + (window.__swFrameMs ?? 1000 / 60) : t;
      }
      cb(virtual);
    });
};
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: L.BIG });
  await ctx.addInitScript(VIRTUAL_CLOCK);
  const tv = await ctx.newPage();
  L.watch(tv, 'tv');
  await tv.goto(`${L.HTTP}/tv?bots=1`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 60000 });
  for (let i = 0; i < 4; i++) {
    await tv.keyboard.press('KeyK');
    await sleep(400);
  }
  await tv.keyboard.press('Enter');
  log(`TV game loaded in ${await L.waitGameLoaded(tv)} s`);
  await tv.keyboard.press('Backquote');
  await sleep(500);
  await tv.keyboard.press('KeyP');
  await tv.setViewportSize(L.SMALL);
  await tv.evaluate(() => (window.__swFrameMs = 84));
  check(1, await L.waitGreen(tv, 400000), 'race started: lap clocks running');
  await sleep(180000);
  const text = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  const rows = text.split('\n').filter((l) => /^(Keys|Bot)/.test(l)).map((l) => l.replace(/\s+/g, ' '));
  for (const r of rows) log('overlay', r);
  const kph = rows.map((r) => Number(r.split(' ').at(-6)));
  check(1, rows.length === 4 && kph.every((v) => v > 20), `four cars driving on the autopilot (${kph.join(', ')} km/h)`);
  try {
    await tv.screenshot({ path: `${L.OUT}/c3-smoke.png`, timeout: 180000 });
    log(`screenshot ${L.OUT}/c3-smoke.png`);
  } catch (e) {
    log('screenshot failed', e.message.split('\n')[0]);
  }
  L.finish('c3-smoke');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
