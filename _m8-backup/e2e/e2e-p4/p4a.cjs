// P4 acceptance: one phone (Sara, drag steer by default) and one keyboard player (Keys WASD).
// Drag steer, gas feathering, handbrake, gas->brake slide, reverse (pad + TV), stuck hint (pad +
// TV, both wordings), Buttons mode under the banner, hold-to-reset with cooldown, keyboard reverse,
// keyboard hint and Q reset. No page errors.
const L = require('./lib.cjs');
const { OUT, sleep, log, check, poll, overlay, hud, lapSeconds } = L;

const errors = [];
const consoleErrors = [];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (stage) => !ONLY || ONLY.includes(stage);

(async () => {
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser, errors, consoleErrors);
  log('room', code);
  const { pad, cdp } = await L.openPad(browser, code, 'pad', errors, consoleErrors);
  const modes = await pad.$$eval('button.pad-mode', (els) =>
    els.map((e) => ({ label: e.querySelector('strong').textContent, on: e.getAttribute('aria-checked') })),
  );
  log('modes', JSON.stringify(modes));
  check(
    modes.length === 2 && modes[0].label === 'Drag steer' && modes[0].on === 'true' && modes[1].label === 'Buttons',
    'join picker: Drag steer (default, selected) and Buttons',
  );
  await pad.fill('#pad-name', 'Sara');
  await pad.screenshot({ path: `${OUT}/p4a-pad-join.png` });
  await pad.click('button.pad-btn--big');
  await pad.waitForSelector('.pad-ready');

  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 2, null, { timeout: 10000 });
  await tv.keyboard.press('Enter');
  await sleep(300);
  await tv.setViewportSize({ width: 320, height: 180 });
  await pad.click('.pad-ready');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log('game running on TV');
  await pad.waitForSelector('.ctl', { timeout: 15000 });
  check(Boolean(await pad.$('.ctl--drag')), 'controller opens in drag mode');
  await pad.screenshot({ path: `${OUT}/p4a-pad-countdown.png` });
  const racing = await poll(
    () => tv.$$eval('.sw-hud-laptime', (els) => els.length > 0 && els.every((e) => !/^0:00\.0/.test(e.textContent))),
    120000,
  );
  check(racing, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(500);
  await poll(() => pad.$('.ctl-reset[data-ready]'), 20000);
  await pad.screenshot({ path: `${OUT}/p4a-pad-idle.png` });

  const W = 844;
  const H = 390;
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const rect = async (sel) => pad.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  const sara = () => overlay(tv, 'Sara');
  const keys = () => overlay(tv, 'Keys WASD');
  const waitSara = (pred, ms, label) => poll(async () => {
    const o = await sara();
    return o && pred(o) ? o : null;
  }, ms).then((o) => {
    if (label) log(label, o ? o.line : 'timeout');
    return o;
  });
  const releaseAll = async () => {
    await touch('touchEnd', []);
    await sleep(300);
  };
  const waitStill = async (o = sara) => poll(async () => {
    const r = await o();
    return r && r.kph < 1 ? r : null;
  }, 60000, 300);

  // ---- Drag steer --------------------------------------------------------------------------
  if (want('drag')) {
    const x0 = 0.2 * W;
    const y0 = 0.6 * H;
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    for (let i = 1; i <= 5; i++) {
      await touch('touchMove', [{ x: x0 + (0.25 * H * i) / 5, y: y0, id: 1 }]);
      await sleep(30);
    }
    const t0 = Date.now();
    const full = await waitSara((o) => o.steer > 0.95, 30000, 'drag full:');
    check(full, `drag +25% height: overlay steer ${full ? full.steer : '?'} > 0.95 (${Date.now() - t0} ms wall)`);
    await pad.screenshot({ path: `${OUT}/p4a-pad-drag.png` });
    const ghost = await pad.$eval('.ctl-ghost', (e) => ({ on: e.classList.contains('is-on'), wheel: e.querySelector('.ctl-wheel').style.transform }));
    check(ghost.on && /rotate\(120deg\)/.test(ghost.wheel), `ghost wheel shown, ${ghost.wheel}`);
    // Overdrag then come back: the origin follows, so steering answers at once.
    await touch('touchMove', [{ x: x0 + 0.4 * H, y: y0, id: 1 }]);
    await sleep(100);
    await touch('touchMove', [{ x: x0 + 0.4 * H - 0.125 * H, y: y0, id: 1 }]);
    const back = await waitSara((o) => o.steer < 0.6 && o.steer > 0.2, 30000, 'overdrag back:');
    check(back, `after overdrag, moving back 12.5% height reads about half lock (${back ? back.steer : '?'})`);
    await touch('touchEnd', []);
    const centred = await waitSara((o) => Math.abs(o.steer) < 0.05, 30000, 'released:');
    check(centred, `release: steer ${centred ? centred.steer : '?'} < 0.05`);
    const hidden = await poll(() => pad.$eval('.ctl-ghost', (e) => !e.classList.contains('is-on')), 3000);
    check(hidden, 'ghost wheel hidden after release');
  }

  // ---- Gas feathering ----------------------------------------------------------------------
  if (want('gas')) {
    const gas = await rect('[data-zone="gas"]');
    const gx = gas.cx;
    const gy = gas.y + gas.h * 0.3;
    await touch('touchStart', [{ x: gx, y: gy, id: 2 }]);
    const g1 = await waitSara((o) => o.gas === 1, 30000, 'gas held:');
    check(g1, 'gas held: throttle 1.00');
    await touch('touchMove', [{ x: gx, y: gy + 0.15 * gas.h, id: 2 }]);
    const g2 = await waitSara((o) => o.gas >= 0.45 && o.gas <= 0.55, 30000, 'gas 15%:');
    check(g2, `slide down 15% of the pedal: throttle ${g2 ? g2.gas : '?'} (about 0.5)`);
    await pad.screenshot({ path: `${OUT}/p4a-pad-feather.png` });
    await touch('touchMove', [{ x: gx, y: gy + 0.3 * gas.h, id: 2 }]);
    const g3 = await waitSara((o) => o.gas === 0, 30000, 'gas 30%:');
    check(g3, 'slide down 30%: throttle 0.00');
    await releaseAll();
  }

  // ---- Handbrake strip and gas -> brake ------------------------------------------------------
  if (want('hb')) {
    const gas = await rect('[data-zone="gas"]');
    const hb = await rect('[data-zone="handbrake"]');
    const brake = await rect('[data-zone="brake"]');
    await touch('touchStart', [{ x: gas.cx, y: gas.cy, id: 3 }]);
    await waitSara((o) => o.gas === 1, 30000);
    await touch('touchStart', [{ x: gas.cx, y: gas.cy, id: 3 }, { x: hb.cx, y: hb.cy, id: 4 }]);
    const h = await waitSara((o) => o.hb && o.gas === 1, 30000, 'gas + handbrake:');
    check(h, 'second finger on HANDBRAKE: hb on, gas stays 1.00');
    await pad.screenshot({ path: `${OUT}/p4a-pad-handbrake.png` });
    // Lift the handbrake finger only.
    await touch('touchEnd', [{ x: hb.cx, y: hb.cy, id: 4 }]);
    const h2 = await waitSara((o) => !o.hb && o.gas === 1, 30000);
    check(h2, 'handbrake released, gas still held');
    // Slide the gas finger left onto BRAKE·R.
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const x = gas.cx + ((brake.cx - gas.cx) * i) / steps;
      const y = gas.cy + ((brake.cy - gas.cy) * i) / steps;
      await touch('touchMove', [{ x, y, id: 3 }]);
      await sleep(40);
    }
    const b = await waitSara((o) => o.brake === 1 && o.gas === 0, 30000, 'gas slid to brake:');
    check(b, 'sliding from GAS onto BRAKE·R switches to brake');
    await releaseAll();
  }

  // ---- Reverse -------------------------------------------------------------------------------
  if (want('reverse')) {
    await waitStill();
    const brake = await rect('[data-zone="brake"]');
    await touch('touchStart', [{ x: brake.cx, y: brake.cy + brake.h * 0.2, id: 5 }]);
    const arming = await poll(() => pad.$('.ctl-brake[data-reverse="arming"]'), 15000, 30);
    // Let the ring fill part way (it fills over 0.85 x 350 ms) before the screenshot.
    if (arming) {
      await sleep(170);
      await pad.screenshot({ path: `${OUT}/p4a-pad-arming.png` });
    }
    check(arming, 'pad shows the arming ring while the TV arms reverse');
    const on = await poll(async () => {
      const label = await pad.$eval('.ctl-brake strong', (e) => e.textContent);
      const chip = await pad.$('.ctl-rchip[data-on]');
      return label === 'REVERSE' && chip ? label : null;
    }, 30000);
    check(on, 'pad: BRAKE·R label reads REVERSE and the R chip is lit');
    const tvGear = await poll(async () => (await hud(tv, 0))?.gear, 30000);
    check(tvGear, 'TV HUD shows the R chip');
    const moving = await waitSara((o) => o.brake === 1 && o.kph >= 2, 60000, 'reversing:');
    check(moving, `holding BRAKE·R in reverse drives the car backwards (${moving ? moving.kph : '?'} km/h with only brake held)`);
    await pad.screenshot({ path: `${OUT}/p4a-pad-reverse.png` });
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(2500);
    await tv.screenshot({ path: `${OUT}/p4a-tv-reverse.png` });
    await tv.setViewportSize({ width: 320, height: 180 });
    await releaseAll();
    const off = await poll(async () => !(await pad.$('.ctl-rchip[data-on]')) && !(await hud(tv, 0)).gear, 20000);
    check(off, 'releasing brake leaves reverse (pad chip and TV chip off)');
  }

  // ---- Stuck hint ------------------------------------------------------------------------------
  let stuckDirection = 1;
  const steerZone = await rect('.ctl-steer');
  const sx = steerZone.x + steerZone.w * 0.5;
  const sy = steerZone.y + steerZone.h * 0.4;
  async function getStuck(withPad) {
    // Steer hard to one side with gas until the car is pinned against the barrier and the hint shows.
    for (const dir of [1, -1]) {
      stuckDirection = dir;
      const gas = await rect('[data-zone="gas"]');
      await withPad(dir, gas);
      const shown = await poll(async () => (await hud(tv, 0))?.hint, 75000, 300);
      if (shown) return shown;
      log(`no hint steering ${dir > 0 ? 'right' : 'left'}; trying the other way`);
      await releaseAll();
      await tv.keyboard.press('KeyN');
      await sleep(1500);
    }
    return '';
  }
  if (want('hint')) {
    await tv.keyboard.press('KeyN');
    await sleep(1500);
    const hint = await getStuck(async (dir, gas) => {
      await touch('touchStart', [
        { x: sx, y: sy, id: 6 },
        { x: gas.cx, y: gas.cy, id: 7 },
      ]);
      await touch('touchMove', [
        { x: sx + dir * 0.3 * H, y: sy, id: 6 },
        { x: gas.cx, y: gas.cy, id: 7 },
      ]);
    });
    const at = await hud(tv, 0);
    log('hint', JSON.stringify(hint), 'lap clock', at.lapTime);
    check(hint === 'Hold BRAKE to reverse', `TV HUD hint: "${hint}"`);
    const padHint = await poll(() => pad.$eval('.ctl-hint', (e) => e.textContent).catch(() => ''), 15000);
    check(padHint === 'Hold BRAKE to reverse', `pad banner: "${padHint}"`);
    await pad.screenshot({ path: `${OUT}/p4a-pad-hint.png` });
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(2500);
    await tv.screenshot({ path: `${OUT}/p4a-tv-hint.png` });
    await tv.setViewportSize({ width: 320, height: 180 });
    // Also hold BRAKE·R (gas still held): gas blocks arming, so the wording changes.
    const gas = await rect('[data-zone="gas"]');
    const brake = await rect('[data-zone="brake"]');
    await touch('touchStart', [
      { x: sx + stuckDirection * 0.3 * H, y: sy, id: 6 },
      { x: gas.cx, y: gas.cy, id: 7 },
      { x: brake.cx, y: brake.cy, id: 8 },
    ]);
    const both = await poll(async () => {
      const tvHint = (await hud(tv, 0))?.hint;
      const padText = await pad.$eval('.ctl-hint', (e) => e.textContent).catch(() => '');
      return tvHint === padText && tvHint === 'Let go of GAS · hold BRAKE to reverse' ? tvHint : null;
    }, 30000);
    check(both, 'gas + brake: TV and pad both read "Let go of GAS · hold BRAKE to reverse"');
    await pad.screenshot({ path: `${OUT}/p4a-pad-hint-release.png` });
    await releaseAll();
  }

  // ---- Buttons mode (switch in settings), steering ramps; a touch under the banner still works --
  if (want('buttons')) {
    await pad.click('.ctl-settings');
    await pad.waitForSelector('.pad-sheet');
    await pad.click('.pad-sheet button.pad-mode:nth-child(2)');
    await pad.click('.pad-sheet .pad-btn:not(.pad-btn--ghost)');
    await pad.waitForSelector('.ctl--buttons', { timeout: 5000 });
    check(true, 'switched to Buttons in settings');
    const right = await rect('[data-zone="right"]');
    await touch('touchStart', [{ x: right.cx, y: right.cy, id: 9 }]);
    const r = await waitSara((o) => o.steer >= 0.99, 30000, 'right arrow:');
    check(r, 'holding the right arrow ramps steer to 1');
    await pad.screenshot({ path: `${OUT}/p4a-pad-buttons.png` });
    await releaseAll();
    await waitSara((o) => Math.abs(o.steer) < 0.05, 30000);
    // Stuck again with gas (and the arrow towards the barrier), wait for the banner.
    const arrowFor = async (dir) => rect(dir > 0 ? '[data-zone="right"]' : '[data-zone="left"]');
    const hint = await getStuck(async (dir, gas) => {
      const a = await arrowFor(dir);
      await touch('touchStart', [
        { x: a.cx, y: a.cy, id: 10 },
        { x: gas.cx, y: gas.cy, id: 11 },
      ]);
    });
    check(hint === 'Hold BRAKE to reverse', `buttons mode: stuck hint shows ("${hint}")`);
    const banner = await poll(() => pad.$eval('.ctl-hint', (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }).catch(() => null), 15000);
    check(banner, 'pad banner is showing over the arrows');
    await pad.screenshot({ path: `${OUT}/p4a-pad-buttons-hint.png` });
    // Keep gas, let go of the arrow, then touch the OTHER arrow right where the banner is.
    const gas = await rect('[data-zone="gas"]');
    const other = await arrowFor(-stuckDirection);
    const bx = other.cx;
    const by = banner ? banner.y + banner.h / 2 : other.y + other.h - 20;
    const held = await arrowFor(stuckDirection);
    await touch('touchEnd', [{ x: held.cx, y: held.cy, id: 10 }]);
    await touch('touchStart', [
      { x: gas.cx, y: gas.cy, id: 11 },
      { x: bx, y: by, id: 12 },
    ]);
    const ramped = await waitSara((o) => o.steer * -stuckDirection >= 0.99, 30000, 'arrow under banner:');
    check(ramped, 'a touch on the lower steer zone under the banner still ramps the steering');
    await releaseAll();
  }

  // ---- Reset --------------------------------------------------------------------------------
  if (want('reset')) {
    await poll(() => pad.$('.ctl-reset[data-ready]'), 30000);
    const reset = await rect('[data-zone="reset"]');
    const before = await hud(tv, 0);
    check(before.fade === 0, 'viewport not faded before the reset');
    await touch('touchStart', [{ x: reset.cx, y: reset.cy, id: 13 }]);
    await sleep(350);
    await pad.screenshot({ path: `${OUT}/p4a-pad-reset-hold.png` });
    await sleep(550);
    await touch('touchEnd', []);
    const faded = await poll(async () => (await hud(tv, 0)).fade > 0.5, 30000, 50);
    check(faded, 'HOLD · RESET for 0.9 s fades the TV viewport out (respawn)');
    const grey = await poll(() => pad.$('.ctl-reset:not([data-ready])'), 10000, 50);
    check(grey, 'the RESET button greys out after a reset');
    await pad.screenshot({ path: `${OUT}/p4a-pad-reset-grey.png` });
    const back = await poll(async () => (await hud(tv, 0)).fade === 0, 30000, 100);
    check(back, 'the car respawned and faded back in');
    // A second hold inside the cooldown: greyed, nothing happens.
    const stillGrey = Boolean(await pad.$('.ctl-reset:not([data-ready])'));
    check(stillGrey, 'within the 3 s cooldown the button is still greyed');
    await touch('touchStart', [{ x: reset.cx, y: reset.cy, id: 14 }]);
    await sleep(900);
    await touch('touchEnd', []);
    const fadeAgain = await poll(async () => (await hud(tv, 0)).fade > 0, 2500, 50);
    check(!fadeAgain, 'a second hold within the cooldown does nothing');
    const readyAgain = await poll(() => pad.$('.ctl-reset[data-ready]'), 60000);
    check(readyAgain, 'RESET is available again after the cooldown');
  }

  // ---- Keyboard player ---------------------------------------------------------------------
  if (want('keys')) {
    await tv.keyboard.down('KeyW');
    const moving = await poll(async () => {
      const k = await keys();
      return k && k.gas === 1 && k.kph > 3 ? k : null;
    }, 60000);
    log('keys W:', moving ? moving.line : 'timeout');
    check(moving, 'keyboard: W drives');
    await tv.keyboard.up('KeyW');
    await waitStill(keys);
    await tv.keyboard.down('KeyS');
    const gear = await poll(async () => (await hud(tv, 1))?.gear, 30000);
    check(gear, 'keyboard: holding S at a standstill shows the TV R chip');
    const rev = await poll(async () => {
      const k = await keys();
      return k && k.brake === 1 && k.kph >= 2 ? k : null;
    }, 60000);
    log('keys S:', rev ? rev.line : 'timeout');
    check(rev, 'keyboard: S in reverse drives backwards');
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(2500);
    await tv.screenshot({ path: `${OUT}/p4a-tv-keys-reverse.png` });
    await tv.setViewportSize({ width: 320, height: 180 });
    await tv.keyboard.up('KeyS');
    // W + D (or A) into the barrier until the hint shows.
    let hint = '';
    for (const key of ['KeyD', 'KeyA']) {
      await tv.keyboard.down('KeyW');
      await tv.keyboard.down(key);
      hint = await poll(async () => (await hud(tv, 1))?.hint, 75000, 300);
      await tv.keyboard.up(key);
      if (hint) break;
      await tv.keyboard.up('KeyW');
      await tv.keyboard.press('KeyN');
      await sleep(1500);
    }
    check(hint === 'Hold S to reverse', `keyboard hint on the TV: "${hint}"`);
    await tv.setViewportSize({ width: 1280, height: 720 });
    await sleep(2500);
    await tv.screenshot({ path: `${OUT}/p4a-tv-keys-hint.png` });
    await tv.setViewportSize({ width: 320, height: 180 });
    await tv.keyboard.down('KeyS');
    const hint2 = await poll(async () => {
      const h = (await hud(tv, 1))?.hint;
      return h === 'Let go of W · hold S to reverse' ? h : null;
    }, 30000);
    check(hint2, 'keyboard W + S: "Let go of W · hold S to reverse"');
    await tv.keyboard.up('KeyS');
    await tv.keyboard.up('KeyW');
    await sleep(500);
    await tv.keyboard.press('KeyQ');
    const faded = await poll(async () => (await hud(tv, 1)).fade > 0.5, 30000, 50);
    check(faded, 'keyboard: Q during racing respawns the car');
  }

  await tv.keyboard.press('Backquote');
  await tv.keyboard.press('Escape');
  await tv.waitForSelector('.lobby', { timeout: 15000 }).catch(() => null);
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
