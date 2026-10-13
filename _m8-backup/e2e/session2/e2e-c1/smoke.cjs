// C1 smoke: TV + one pad joins; the pad's lobby messages carry car 'nightjar'; the race loads and
// the lap clock runs; no pageerror. Usage: node smoke.cjs 5000 5443
const L = require('./lib.cjs');
const { sleep, log, check, poll } = L;

/** Test harness only: records every parsed message with a `type` on the pad. */
const RECORD = () => {
  window.__msgs = [];
  const parse = JSON.parse;
  JSON.parse = function (...args) {
    const value = parse.apply(this, args);
    if (value && typeof value === 'object' && typeof value.type === 'string') {
      window.__msgs.push(value);
      if (value.type === 'lobby' || value.type === 'joined') console.log('[pad msg]', JSON.stringify(value));
    }
    return value;
  };
};

(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser);
  log('room', code);
  const ctx = await browser.newContext({ viewport: L.PAD_SIZE, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  await ctx.addInitScript(RECORD);
  const pad = await ctx.newPage();
  L.watch(pad, 'pad');
  pad.on('console', (m) => {
    if (m.text().startsWith('[pad msg]')) log(m.text().slice(0, 400));
  });
  await pad.goto(`${L.HTTPS}/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 90000 });
  await pad.fill('#pad-name', 'Cara');
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready', { timeout: 60000 });
  await sleep(1000);
  const msgs = await pad.evaluate(() => window.__msgs);
  const joined = msgs.filter((m) => m.type === 'joined').at(-1);
  const lobbies = msgs.filter((m) => m.type === 'lobby' && m.players.length > 0);
  check(1, joined?.car === 'nightjar', `joined carries car ${joined?.car}`);
  check(1, lobbies.length > 0 && lobbies.every((m) => m.players.every((p) => p.car === 'nightjar')),
    `pad lobby messages carry car 'nightjar' (${lobbies.length} with players)`);

  await pad.click('.pad-ready');
  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  await tv.setViewportSize(L.SMALL);
  await pad.waitForSelector('.ctl', { timeout: 120000 }).catch(() => null);
  const green = await L.waitGreen(tv, 400000);
  check(1, green, 'race started: lap clock running');
  await sleep(3000);
  L.finish('c1-smoke');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
