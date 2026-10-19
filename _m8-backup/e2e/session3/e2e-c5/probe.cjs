const L = require('./lib.cjs'); const H = require('./hooks.cjs');
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.addInitScript(L.VIRTUAL_CLOCK);
  const tv = await ctx.newPage(); tv.on('pageerror', e => console.log('PAGEERROR', e.message)); tv.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,300)); });
  await tv.goto(`${L.HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  await tv.evaluate(H.INSTALL);
  await tv.keyboard.press('KeyK'); await L.sleep(500); await tv.keyboard.press('Enter');
  await tv.waitForFunction(() => !document.querySelector('.sw-loading') && window.__game, null, { timeout: 200000 });
  for (let k = 0; k < 3; k++) {
    console.log(await tv.evaluate(() => { const g = window.__game; const c = g.drivers[0].car; const s = g.track.gridSpawns(1)[0];
      return JSON.stringify({ phase: g.race.phase, pos: c.position.toArray().map(v=>+v.toFixed(3)), spawnY: s.y, susp: [...c.wheelSuspension].map(v=>+v.toFixed(3)), mount: [...c.mountHeights].map(v=>+v.toFixed(3)), contact: [...c.wheelInContact], cy: c.wheelContact.map(v=>+v.y.toFixed(3)), vis: g.drivers[0].visual.root.position.y }); }));
    await L.sleep(5000);
  }
  await browser.close();
})();
