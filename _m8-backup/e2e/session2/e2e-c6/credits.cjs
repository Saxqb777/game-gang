// C6 acceptance: /credits (desktop, phone), landing footer, TV credits panel (C, Esc, ignored in game).
// Usage: node credits.cjs 5500 5943
const L = require('./lib.cjs');
const { sleep, log, check, poll } = L;
const shot = async (page, name, fullPage = false) => {
  const path = `${L.OUT}/c6-${name}.png`;
  await page.screenshot({ path, fullPage });
  log('screenshot', path);
};

(async () => {
  const browser = await L.launch();

  // Landing footer and /credits on desktop.
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  L.watch(desk, 'desk');
  await desk.goto(`${L.HTTP}/`);
  await desk.waitForSelector('.landing-footer a', { timeout: 60000 });
  await shot(desk, 'landing-desktop');
  await desk.click('.landing-footer a');
  await desk.waitForSelector('.credits--page', { timeout: 60000 });
  check(1, desk.url().endsWith('/credits'), `footer link opens /credits (${desk.url()})`);
  const entries = await desk.$$eval('.credits-section--cars .credits-entry', (els) => els.length);
  check(1, entries === 5, `five car credits (${entries})`);
  const text = await desk.$eval('.credits--page', (e) => e.textContent);
  for (const s of ['Dashwood Nightjar', 'Arvanta Sagitta', 'CC BY 4.0', 'CC0 1.0', 'Modified:', 'Poly Haven', 'Chakra Petch', 'Rapier', 'Kestrel Pines', 'Synthesised'])
    check(1, text.includes(s), `page mentions ${s}`);
  await shot(desk, 'credits-desktop', true);

  // Phone.
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneCtx.newPage();
  L.watch(phone, 'phone');
  await phone.goto(`${L.HTTP}/credits`);
  await phone.waitForSelector('.credits--page', { timeout: 60000 });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(1, overflow <= 0, `phone: no horizontal scroll (${overflow})`);
  await shot(phone, 'credits-phone', true);
  await phone.goto(`${L.HTTP}/`);
  await phone.waitForSelector('.landing-footer a', { timeout: 60000 });
  await shot(phone, 'landing-phone');
  const phoneLand = await (await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage();
  await phoneLand.goto(`${L.HTTP}/`);
  await phoneLand.waitForSelector('.landing-footer a', { timeout: 60000 });
  await shot(phoneLand, 'landing-phone-landscape');

  // TV at 1080p.
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  L.watch(tv, 'tv');
  await tv.goto(`${L.HTTP}/tv`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  const hint = await tv.$eval('.tv-keys', (e) => e.textContent);
  check(2, /C\s*credits/.test(hint), `lobby key hint: ${hint}`);
  await tv.keyboard.press('KeyC');
  await tv.waitForSelector('.credits--tv', { timeout: 10000 });
  const body = await tv.$eval('.credits--tv .credits-entry p', (e) => parseFloat(getComputedStyle(e).fontSize));
  check(2, body >= 24, `TV body text ${body} px at 1080p`);
  const fits = await tv.$eval('.credits--tv', (e) => [e.scrollHeight, e.clientHeight]);
  check(2, fits[0] <= fits[1] + 1, `TV panel fits one screen (${fits.join(' / ')})`);
  await sleep(500);
  await shot(tv, 'tv-credits');
  await tv.keyboard.press('Escape');
  check(2, await poll(async () => !(await tv.$('.credits--tv')), 5000), 'Esc closes');
  await tv.keyboard.press('KeyC');
  check(2, Boolean(await tv.waitForSelector('.credits--tv', { timeout: 5000 }).catch(() => null)), 'C opens again');
  await tv.keyboard.press('KeyC');
  check(2, await poll(async () => !(await tv.$('.credits--tv')), 5000), 'C toggles closed');

  if (process.env.SKIPGAME) { L.finish('c6-credits'); await browser.close(); return; }
  // Outside the lobby C does nothing: add a keyboard player, ready, wait for the game.
  await tv.setViewportSize(L.SMALL);
  await tv.keyboard.press('KeyK');
  await sleep(500);
  await tv.keyboard.press('Enter');
  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  await tv.keyboard.press('KeyC');
  await sleep(1000);
  check(2, !(await tv.$('.credits--tv')), 'C ignored in a game');
  check(2, Boolean(await tv.$('.sw-canvas')), '.sw-canvas exists');
  await tv.keyboard.press('Escape');
  await tv.waitForSelector('.lobby-code', { timeout: 60000 });
  check(2, !(await tv.$('.credits--tv')), 'back in lobby, credits stay closed');

  L.finish('c6-credits');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
