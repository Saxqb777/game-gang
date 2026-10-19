// C5: the five real cars on the grid in five paints, close chase shots, and close-ups (1 player, High).
const L = require('./lib.cjs');
const H = require('./hooks.cjs');
const { sleep, log, check } = L;
const errors = [], consoleErrors = [];
const PAINT = { nightjar: 'red', scree: 'lime', haymaker: 'yellow', zanna: 'blue', sagitta: 'purple' };
const FRAMING = { nightjar: [4.73, 1.35], scree: [3.96, 1.34], haymaker: [4.77, 1.4], zanna: [4.79, 1.21], sagitta: [4.65, 1.1] };
const ONLY = process.env.ONLY;

(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(L.VIRTUAL_CLOCK);
  const tv = await ctx.newPage();
  L.watch(tv, 'tv', errors, consoleErrors);
  await tv.goto(`${L.HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  log(await tv.evaluate(H.INSTALL));
  await tv.keyboard.press('KeyK');
  await sleep(500);
  await tv.keyboard.press('Enter');
  await tv.setViewportSize({ width: 480, height: 270 });
  const t0 = Date.now();
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 200000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading') && window.__game, null, { timeout: 200000 });
  log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await L.fast(tv, true);
  await tv.waitForFunction(() => window.__game.race.phase === 'racing' && window.__game.race.clock > 1, null, { timeout: 400000, polling: 1000 });
  await L.fast(tv, false);
  log('racing');
  const extras = [
    { car: 'scree', paint: PAINT.scree, slot: 1 },
    { car: 'haymaker', paint: PAINT.haymaker, slot: 2 },
    { car: 'zanna', paint: PAINT.zanna, slot: 3 },
    { car: 'sagitta', paint: PAINT.sagitta, slot: 4 },
  ];
  const S0 = await tv.evaluate(() => { const s = window.__game.track.gridSpawns(1)[0]; return { ...s, y: s.y - 0.5 }; });
  if (ONLY === 'paints') {
    const fx = Math.sin(S0.yaw), fz = Math.cos(S0.yaw), rx = -fz, rz = fx;
    const paints = ['red', 'orange', 'yellow', 'lime', 'cyan', 'blue', 'purple', 'pink'];
    const at = (f, r) => ({ x: S0.x + fx * f + rx * r, y: S0.y + 0.5, z: S0.z + fz * f + rz * r, yaw: S0.yaw });
    extras.length = 0;
    paints.forEach((paint, i) => extras.push({ car: process.env.PCAR ?? 'nightjar', paint, spawn: at(40, (i - 3.5) * 2.5) }));
  }
  log('extras', await tv.evaluate(H.ADD_EXTRAS, extras));
  const info = await tv.evaluate(() => {
    const g = window.__game;
    const d = g.drivers[0];
    return { preset: g.renderer.preset.id, car: d.player.car, paint: d.player.colour, spawns: g.track.gridSpawns(6).map((s) => ({ ...s, y: s.y - 0.5 })) };
  });
  log(JSON.stringify(info).slice(0, 300));
  const S = info.spawns;
  const cam = (spec) => tv.evaluate(H.SET_CAMERA, spec);
  const shoot = async (name, settle = 12000) => {
    await L.shot(tv, `${L.OUT}/${name}.png`, { settle, small: { width: 480, height: 270 } });
  };
  if (!ONLY || ONLY === 'grid') {
    await cam({ ref: S[2], eye: [16, 8, 3.4], at: [-1, -0.5, 0.4], fov: 38 });
    await shoot('c5-grid-five');
    await cam({ ref: S[2], eye: [3, 13, 1.4], at: [0, 0, 0.7], fov: 42 });
    await shoot('c5-grid-side');
  }
  if (ONLY === 'paints') {
    await cam({ ref: { ...S0 }, eye: [52, 7, 3.2], at: [40, -0.5, 0.5], fov: 50 });
    await shoot(`c5-paints-${process.env.PCAR ?? 'nightjar'}`);
  }
  const order = ['nightjar', 'scree', 'haymaker', 'zanna', 'sagitta'];
  if (!ONLY || ONLY === 'chase') {
    for (const [slot, car] of order.entries()) {
      const [len, h] = FRAMING[car];
      const dist = 6.1 + (len - 4.4) * 0.6, height = 2.1 + (h - 1.3) * 0.8, look = 1 + (h - 1.3) * 0.8;
      await cam({ ref: S[slot], eye: [-dist, 0, height], at: [4, 0, look], fov: 57 });
      await shoot(`c5-chase-${car}`, 8000);
    }
  }
  if (!ONLY || ONLY === 'close') {
    for (const [slot, car] of order.entries()) {
      await cam({ ref: S[slot], eye: [4.6, -3.6, 1.25], at: [0.2, 0, 0.55], fov: 40 });
      await shoot(`c5-close-${car}`, 8000);
    }
  }
  check(errors.length === 0, `no pageerror ${errors.join(' | ')}`);
  log('console errors', consoleErrors.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
