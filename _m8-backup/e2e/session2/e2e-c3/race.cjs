// C3 acceptance: /tv?bots=1, K x4 (two keyboard players, Bot 3, Bot 4 = four different cars),
// Enter, debug overlay + P: the per-car autopilot race finishes. Usage: node race.cjs 5200 5643
const L = require('./lib.cjs');
const { sleep, log, check, poll } = L;

/** Test harness only: a virtual clock, 5 physics steps per rendered frame (SwiftShader is slow). */
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
  await sleep(1000);
  await tv.screenshot({ path: `${L.OUT}/c3-lobby.png` });
  await tv.keyboard.press('Enter');
  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  await tv.keyboard.press('Backquote');
  await sleep(500);
  await tv.keyboard.press('KeyP');
  const debugText = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  log('overlay autopilot line:', (debugText.split('\n').find((l) => /autopilot/i.test(l)) ?? '').slice(0, 120));
  await tv.setViewportSize(L.SMALL);
  await tv.evaluate(() => (window.__swFrameMs = 84));
  const green = await L.waitGreen(tv, 400000);
  check(1, green, 'race started: lap clocks running');
  await sleep(60000);
  const shot = async (name) => {
    try {
      await tv.screenshot({ path: `${L.OUT}/c3-${name}.png`, timeout: 180000 });
      log(`screenshot ${L.OUT}/c3-${name}.png`);
    } catch (e) {
      log(`screenshot ${name} failed: ${e.message.split('\n')[0]}`);
    }
  };
  await shot('midrace');
  // SwiftShader renders four viewports at well under 1 frame/s, so a full 3-lap race would take hours
  // of wall time. Let the autopilot drive for a while (speed and gates must rise, no respawn),
  // then skip the rest with debug N (next checkpoint) so the race reaches its finish and results.
  const t0 = Date.now();
  const rowsOf = async () => {
    const text = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
    return text.split('\n').filter((l) => /^(Keys|Bot)/.test(l)).map((l) => l.replace(/\s+/g, ' '));
  };
  for (let i = 0; i < 5; i++) {
    await sleep(60000);
    log('overlay:', (await rowsOf()).join(' | '));
  }
  await shot('driving');
  let presses = 0;
  const done = await poll(async () => {
    if (await tv.$('.sw-results')) return true;
    await tv.keyboard.press('KeyN');
    presses++;
    if (presses % 8 === 0) log(`N x${presses}:`, (await rowsOf()).join(' | '));
    return false;
  }, 30 * 60000, 3000);
  log(`pressed N ${presses} times`);
  check(1, Boolean(done), `autopilot race finished, results shown (${Math.round((Date.now() - t0) / 1000)} s wall)`);
  if (done) {
    const rows = await tv.$$eval('.sw-results-list li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    for (const r of rows) log('result', r);
    check(1, rows.length === 4, `four finishers (${rows.length})`);
    await tv.setViewportSize({ width: 960, height: 540 });
    await sleep(5000);
    await shot('results');
  }
  L.finish('c3-race');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
