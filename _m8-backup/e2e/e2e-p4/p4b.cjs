// P4 regression: four players with mixed controllers (Sara drag 844x390, Omar Buttons on a small
// 667x375 phone, Lina drag on a 915x412 phone, one keyboard player). Controller screenshots per size,
// portrait rotate overlay, everyone drives, then an autopilot race to the finish: results, lap
// board on kestrel-pines, pad results and the play-again vote. No page errors.
const L = require('./lib.cjs');
const { OUT, HTTP, sleep, log, check, poll, overlay } = L;

const errors = [];
const consoleErrors = [];
const FULL = process.env.FULL !== '0';

(async () => {
  const room = await (await fetch(`${HTTP}/api/room`, { method: 'POST' })).json();
  const seeded = await fetch(`${HTTP}/api/laps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: room.code, key: room.hostKey, track: 'kestrel-pines', laps: [{ name: 'Pine Ace', bestLapMs: 58_240 }] }),
  });
  check(seeded.ok, `seeded the kestrel-pines board (${seeded.status})`);

  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser, errors, consoleErrors);
  log('room', code);
  const players = [
    { name: 'Sara', colour: 'Lagoon', size: { width: 844, height: 390 }, mode: 'drag' },
    { name: 'Omar', colour: 'Taxi', size: { width: 667, height: 375 }, mode: 'buttons' },
    { name: 'Lina', colour: 'Flamingo', size: { width: 915, height: 412 }, mode: 'drag' },
  ];
  const pads = [];
  for (const [i, p] of players.entries()) {
    const { pad, cdp } = await L.openPad(browser, code, `pad${i}`, errors, consoleErrors, p.size);
    await pad.fill('#pad-name', p.name);
    await pad.click(`button[aria-label^="${p.colour}"]`);
    if (p.mode === 'buttons') await pad.click('button.pad-mode:nth-child(2)');
    if (i === 1) await pad.screenshot({ path: `${OUT}/p4b-pad-join-buttons.png` });
    await pad.click('button.pad-btn--big');
    await pad.waitForSelector('.pad-ready');
    pads.push({ ...p, pad, cdp });
  }
  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 4, null, { timeout: 10000 });
  await tv.keyboard.press('Enter');
  await sleep(500);
  await tv.screenshot({ path: `${OUT}/p4b-tv-lobby.png` });
  await tv.setViewportSize({ width: 320, height: 180 });
  for (const p of pads) await p.pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 180000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 180000 });
  log('game loaded');
  for (const p of pads) await p.pad.waitForSelector('.ctl', { timeout: 30000 });
  check((await tv.$$('.sw-hud')).length === 4, '4 viewports');
  for (const p of pads) {
    const ok = Boolean(await p.pad.$(`.ctl--${p.mode}`));
    check(ok, `${p.name}'s controller is in ${p.mode} mode`);
  }
  const racing = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    150000,
  );
  check(racing, 'race went green');
  await tv.keyboard.press('Backquote');
  await poll(() => pads[0].pad.$('.ctl-reset[data-ready]'), 20000);

  // Controller layout at each phone size: every zone inside the screen, none overlapping.
  for (const p of pads) {
    const zones = await p.pad.$$eval('[data-zone]', (els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { zone: e.dataset.zone, l: r.left, t: r.top, r: r.right, b: r.bottom };
    }));
    const inside = zones.every((z) => z.l >= 0 && z.t >= 0 && z.r <= p.size.width && z.b <= p.size.height);
    let overlap = false;
    for (const a of zones) for (const b of zones) {
      if (a !== b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlap = true;
    }
    const steer = zones.find((z) => z.zone === 'steer' || z.zone === 'left');
    const gas = zones.find((z) => z.zone === 'gas');
    log(p.name, JSON.stringify(zones.map((z) => `${z.zone}:${Math.round(z.r - z.l)}x${Math.round(z.b - z.t)}`)));
    check(inside && !overlap, `${p.name} ${p.size.width}x${p.size.height}: all zones on screen, none overlapping`);
    check(steer && steer.l >= 24, `${p.name}: steer zone starts ${steer ? Math.round(steer.l) : '?'} px from the left edge (>= 24)`);
    check(gas && gas.r - gas.l >= 0.23 * p.size.width, `${p.name}: GAS is ${gas ? Math.round(gas.r - gas.l) : '?'} px wide`);
    await p.pad.screenshot({ path: `${OUT}/p4b-pad-${p.name.toLowerCase()}-${p.size.width}x${p.size.height}.png` });
  }

  // Everyone drives at once: Sara drag right + gas, Omar right arrow + gas, Lina gas, keys W.
  const touchPoints = async (p) => {
    const gas = await p.pad.$eval('[data-zone="gas"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (p.mode === 'buttons') {
      const right = await p.pad.$eval('[data-zone="right"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      return [{ ...right, id: 1 }, { ...gas, id: 2 }];
    }
    const z = await p.pad.$eval('.ctl-steer', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    return [{ ...z, id: 1 }, { ...gas, id: 2 }];
  };
  for (const p of pads) {
    const points = await touchPoints(p);
    await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    if (p.mode === 'drag' && p.name === 'Sara') {
      points[0].x += 0.2 * p.size.height;
      await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
    }
  }
  await tv.keyboard.down('KeyW');
  const all = await poll(async () => {
    const rows = await Promise.all(['Sara', 'Omar', 'Lina', 'Keys WASD'].map((n) => overlay(tv, n)));
    if (rows.some((r) => !r)) return null;
    const [s, o, l, k] = rows;
    return s.gas === 1 && s.steer > 0.5 && o.gas === 1 && o.steer > 0.9 && l.gas === 1 && k.gas === 1 ? rows : null;
  }, 60000, 300);
  if (all) for (const r of all) log(r.line);
  check(all, 'four drivers at once: drag steer, buttons steer, gas and keyboard all reach the TV');
  await pads[0].pad.screenshot({ path: `${OUT}/p4b-pad-sara-driving.png` });
  await pads[1].pad.screenshot({ path: `${OUT}/p4b-pad-omar-driving.png` });
  await tv.keyboard.up('KeyW');
  for (const p of pads) await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // Portrait: the rotate overlay covers the controller and swallows touches.
  const lina = pads[2];
  await lina.pad.setViewportSize({ width: 412, height: 915 });
  await sleep(500);
  const rotate = await lina.pad.$eval('.ctl-rotate', (e) => getComputedStyle(e).display !== 'none');
  check(rotate, 'portrait shows "Turn your phone sideways"');
  await lina.pad.screenshot({ path: `${OUT}/p4b-pad-portrait.png` });
  await lina.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 800, id: 1 }] });
  await sleep(1500);
  const linaRow = await overlay(tv, 'Lina');
  check(linaRow && linaRow.gas === 0 && linaRow.brake === 0, `a touch on the rotate overlay does nothing (${linaRow ? linaRow.line : '?'})`);
  await lina.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await lina.pad.setViewportSize(lina.size);

  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(3000);
  await tv.screenshot({ path: `${OUT}/p4b-tv-4p.png` });
  await tv.setViewportSize({ width: 320, height: 180 });

  if (FULL) {
    await tv.keyboard.press('KeyP');
    log('autopilot on');
    const started = Date.now();
    while (Date.now() - started < 40 * 60 * 1000) {
      await sleep(20000);
      if (await tv.$('.sw-results')) break;
      const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
      log(dbg.split('\n').filter((l) => /^(fps|Sara|Keys)/.test(l)).map((l) => l.replace(/\s+/g, ' ')).join(' | '));
    }
    const finished = Boolean(await tv.$('.sw-results'));
    check(finished, `race finished in ${((Date.now() - started) / 60000).toFixed(1)} min`);
    if (finished) {
      await tv.keyboard.press('Backquote');
      await tv.setViewportSize({ width: 1280, height: 720 });
      await sleep(6000);
      await tv.screenshot({ path: `${OUT}/p4b-results.png` });
      const rows = await tv.$$eval('.sw-results-list li', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')));
      log('results:', JSON.stringify(rows));
      check(rows.length === 4, 'results list has 4 drivers');
      const board = await tv.$eval('.sw-results-board', (e) => e.innerText.replace(/\n/g, ' '));
      log('board:', board);
      check(/Kestrel Pines/i.test(board) && /Pine Ace/.test(board), 'lap board for Kestrel Pines shows');
      for (const p of pads) await p.pad.waitForSelector('.pad-results', { timeout: 30000 });
      await pads[0].pad.screenshot({ path: `${OUT}/p4b-pad-results.png` });
      for (const p of pads) {
        await p.pad.click('.pad-ready');
        await sleep(800);
      }
      await tv.waitForSelector('.lobby', { timeout: 30000 });
      for (const p of pads) await p.pad.waitForSelector('.pad-lobby', { timeout: 30000 });
      check(true, 'play-again vote returned everyone to the lobby');
    }
  }
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
