const L = require('./lib.cjs'); const H = require('./hooks.cjs');
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.addInitScript(L.VIRTUAL_CLOCK);
  const tv = await ctx.newPage();
  tv.on('pageerror', e => console.log('PAGEERROR', e.message));
  tv.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0,200)));
  await tv.goto(`${L.HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  console.log(await tv.evaluate(H.INSTALL));
  await tv.keyboard.press('KeyK'); await L.sleep(500); await tv.keyboard.press('Enter');
  for (let i = 0; i < 8; i++) { await L.sleep(15000); console.log(await tv.evaluate(() => JSON.stringify({ loading: !!document.querySelector('.sw-loading'), text: document.querySelector('.sw-loading')?.textContent, canvas: !!document.querySelector('.sw-canvas'), game: !!window.__game }))); }
  const urls = await tv.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /game\.ts|renderer\.ts/.test(n)));
  console.log(urls);
  await browser.close();
})();
