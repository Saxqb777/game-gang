// C5: 4 viewports Low, four different cars; overlay with cars on/off; autopilot; podium.
const L = require('./lib.cjs');
const H = require('./hooks.cjs');
const { sleep, log, check } = L;
const errors = [], consoleErrors = [];
const KEYS = Number(process.env.KEYS ?? 4);
const TAG = process.env.TAG ?? `views${KEYS}`;

async function overlayPair(tv, label) {
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await sleep(6000);
  const on = await L.overlay(tv);
  await tv.keyboard.press('KeyV');
  await sleep(6000);
  const off = await L.overlay(tv);
  await tv.keyboard.press('KeyV');
  await sleep(3000);
  log(`${label}: preset ${on.preset} draws ${on.draws} -> ${off.draws} without cars (cars ${on.draws - off.draws}); tris ${on.tris} -> ${off.tris}; programs ${on.programs} late ${on.late}`);
  log(on.text.split('\n').filter((l) => /^(car|nightjar|scree|haymaker|zanna|sagitta)/.test(l)).join(' | '));
  return { on, off };
}

(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(L.VIRTUAL_CLOCK);
  const tv = await ctx.newPage();
  L.watch(tv, 'tv', errors, consoleErrors);
  await tv.goto(`${L.HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  await tv.evaluate(H.INSTALL);
  for (let i = 0; i < KEYS; i++) { await tv.keyboard.press('KeyK'); await sleep(400); }
  await tv.keyboard.press('Enter');
  await tv.setViewportSize({ width: 480, height: 270 });
  const t0 = Date.now();
  await tv.waitForFunction(() => !document.querySelector('.sw-loading') && window.__game, null, { timeout: 300000 });
  log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const cars = await tv.evaluate(() => window.__game.drivers.map((d) => `${d.player.car}/${d.player.colour}`));
  log('cars', cars.join(' '));
  await L.fast(tv, true);
  await tv.waitForFunction(() => window.__game.race.phase === 'racing', null, { timeout: 400000, polling: 1000 });
  await L.fast(tv, false);
  await L.shot(tv, `${L.OUT}/c5-${TAG}-grid.png`, { settle: 12000, hud: true, small: { width: 480, height: 270 } });
  await tv.keyboard.press('Backquote');
  const start = await overlayPair(tv, 'start line');
  await tv.keyboard.press('KeyP'); // autopilot
  await tv.setViewportSize({ width: 480, height: 270 });
  await L.fast(tv, true);
  await tv.waitForFunction(() => window.__game.race.clock > 30, null, { timeout: 900000, polling: 2000 });
  await L.fast(tv, false);
  const mid = await overlayPair(tv, 'after 30 s autopilot');
  await tv.keyboard.press('Backquote');
  await L.shot(tv, `${L.OUT}/c5-${TAG}-30s.png`, { settle: 8000, hud: true, small: { width: 480, height: 270 } });
  check(Number(mid.on.late) === 0, `late programs after GO = ${mid.on.late}`);
  await tv.evaluate(() => window.__game.showPodium());
  await L.shot(tv, `${L.OUT}/c5-${TAG}-podium.png`, { settle: 15000, hud: true, small: { width: 480, height: 270 } });
  await sleep(1000);
  await L.shot(tv, `${L.OUT}/c5-${TAG}-podium2.png`, { settle: 9000, hud: true, small: null });
  check(errors.length === 0, `no pageerror ${errors.join(' | ')}`);
  log('console errors', consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
