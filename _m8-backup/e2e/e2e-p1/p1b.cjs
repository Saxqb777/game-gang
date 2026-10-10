// P1 acceptance 4: four pads, autopilot race to the finish, results screen, podium, lap board on
// kestrel-pines, pad results and the play-again vote. No page errors.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p1';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
const consoleErrors = [];
const check = (ok, what) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
(async () => {
  // Autopilot laps on the interim loop are ~41 s, under the 45 s record minimum, so seed the
  // kestrel-pines board through the API to see the results screen list real entries.
  const room = await (await fetch('http://localhost:4000/api/room', { method: 'POST' })).json();
  const seeded = await fetch('http://localhost:4000/api/laps', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      room: room.code,
      key: room.hostKey,
      track: 'kestrel-pines',
      laps: [
        { name: 'Pine Ace', bestLapMs: 58_240 },
        { name: 'Kestrel', bestLapMs: 61_910 },
      ],
    }),
  });
  check(seeded.ok, `seeded the kestrel-pines board (${seeded.status})`);
  const tooShort = await fetch('http://localhost:4000/api/laps', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: room.code, key: room.hostKey, track: 'kestrel-pines', laps: [{ name: 'Speedy', bestLapMs: 40_500 }] }),
  });
  check(tooShort.status === 400, `a 40.5 s lap is rejected (${tooShort.status})`);
  const oldTrack = await fetch('http://localhost:4000/api/laps?track=corniche-run');
  check(oldTrack.status === 400, `the retired track id is rejected (${oldTrack.status})`);

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  tv.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[tv] ${m.text().slice(0, 300)}`);
  });
  await tv.goto('http://localhost:4000/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'));
  const code = await tv.$eval('.lobby-code', (el) => el.textContent);
  log('room', code);
  const names = ['Sara', 'Omar', 'Lina', 'Zed'];
  const colours = ['Lagoon', 'Taxi', 'Flamingo', 'Venom'];
  const pads = [];
  for (let i = 0; i < 4; i++) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
    const pad = await ctx.newPage();
    pad.on('pageerror', (e) => errors.push(`[pad${i}] ${e.message}`));
    pad.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[pad${i}] ${m.text().slice(0, 300)}`);
    });
    await pad.goto(`https://localhost:4443/pad?room=${code}`);
    await pad.waitForSelector('#pad-name', { timeout: 30000 });
    await pad.fill('#pad-name', names[i]);
    await pad.click(`button[aria-label^="${colours[i]}"]`);
    await pad.click('button.pad-btn--big');
    await pad.waitForSelector('.pad-ready');
    pads.push(pad);
  }
  await sleep(600);
  await tv.screenshot({ path: `${OUT}/p1b-lobby.png` });
  await pads[0].screenshot({ path: `${OUT}/p1b-pad-lobby.png` });
  // Small TV while racing: SwiftShader is fill-rate bound.
  await tv.setViewportSize({ width: 320, height: 180 });
  for (const pad of pads) await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 180000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 180000 });
  log('game loaded');
  for (const pad of pads) await pad.waitForSelector('.ctl', { timeout: 30000 });
  check((await tv.$$('.sw-hud')).length === 4, '4 viewports');
  await tv.keyboard.press('Backquote');
  await sleep(300);
  await tv.keyboard.press('KeyP');
  log('autopilot on');
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(3000);
  await tv.screenshot({ path: `${OUT}/p1b-race-start.png` });
  await tv.setViewportSize({ width: 320, height: 180 });
  const started = Date.now();
  let shot = 0;
  while (Date.now() - started < 30 * 60 * 1000) {
    await sleep(20000);
    if (await tv.$('.sw-results')) break;
    const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
    log(dbg.split('\n').filter((l) => /^(fps|Sara|Zed)/.test(l)).map((l) => l.replace(/\s+/g, ' ')).join(' | '));
    if (shot < 3 && Date.now() - started > (shot + 1) * 150000) {
      await tv.setViewportSize({ width: 1280, height: 720 });
      await sleep(2500);
      await tv.screenshot({ path: `${OUT}/p1b-race-${shot}.png` });
      await pads[shot].screenshot({ path: `${OUT}/p1b-pad-race-${shot}.png` });
      await tv.setViewportSize({ width: 320, height: 180 });
      shot++;
    }
  }
  const finished = Boolean(await tv.$('.sw-results'));
  check(finished, `race finished in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  if (!finished) throw new Error('race did not finish in time');
  await tv.keyboard.press('Backquote');
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(6000);
  await tv.screenshot({ path: `${OUT}/p1b-results.png` });
  const rows = await tv.$$eval('.sw-results-list li', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')));
  log('results:', JSON.stringify(rows));
  check(rows.length === 4, 'results list has 4 drivers');
  const board = await tv.$eval('.sw-results-board', (e) => e.innerText.replace(/\n/g, ' '));
  log('board:', board);
  check(/Kestrel Pines/i.test(board) && /Pine Ace/.test(board) && /0:58\.24/.test(board), 'lap board for Kestrel Pines lists the seeded entries');
  check(!/Items race|Classic/i.test(board), 'no items/classic note on the board');
  for (const pad of pads) await pad.waitForSelector('.pad-results', { timeout: 30000 });
  log('pad results:', await pads[0].$eval('.pad-results-me', (e) => e.innerText.replace(/\n/g, ' ')));
  await pads[0].screenshot({ path: `${OUT}/p1b-pad-results.png` });
  // Hide the results panel to see the podium behind it.
  await tv.evaluate(() => { document.querySelector('.sw-results').style.visibility = 'hidden'; });
  await sleep(1500);
  await tv.screenshot({ path: `${OUT}/p1b-podium.png` });
  await tv.evaluate(() => { document.querySelector('.sw-results').style.visibility = ''; });
  // Play again: 3 of 4 votes is a majority.
  for (const pad of pads.slice(0, 3)) {
    await pad.click('.pad-ready');
    await sleep(800);
  }
  await tv.waitForSelector('.lobby', { timeout: 20000 });
  for (const pad of pads) await pad.waitForSelector('.pad-lobby', { timeout: 20000 });
  check(true, 'majority vote returned everyone to the lobby');
  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
